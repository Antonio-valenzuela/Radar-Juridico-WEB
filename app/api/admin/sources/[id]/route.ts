import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { validateUrlSafety } from "@/lib/security/urlValidation";
import { resolveSourceAdapter } from "@/lib/sources/sourceHealth";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "bad_request", message: "Cuerpo de petición inválido" }, { status: 400 });
    }

    const source = await prisma.officialSource.findUnique({
      where: { id },
    });

    if (!source) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "Fuente oficial no encontrada." },
        { status: 404 }
      );
    }

    // Si se actualiza la baseUrl, validar seguridad de nuevo (SSRF)
    if (body.baseUrl && body.baseUrl.trim() !== source.baseUrl) {
      const safety = await validateUrlSafety(body.baseUrl.trim());
      if (!safety.safe) {
        return NextResponse.json(
          { ok: false, error: "unsafe_url", message: `URL rechazada por seguridad: ${safety.error}` },
          { status: 400 }
        );
      }
    }

    if (body.healthUrl?.trim() && body.healthUrl.trim() !== source.healthUrl) {
      const healthSafety = await validateUrlSafety(body.healthUrl.trim());
      if (!healthSafety.safe) {
        return NextResponse.json(
          { ok: false, error: "unsafe_health_url", message: `Health URL rechazada por seguridad: ${healthSafety.error}` },
          { status: 400 }
        );
      }
    }

    // Normalizar slug si se actualiza
    let cleanSlug = undefined;
    if (body.slug) {
      cleanSlug = body.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      if (cleanSlug !== source.slug) {
        const existing = await prisma.officialSource.findUnique({
          where: { slug: cleanSlug },
        });
        if (existing) {
          return NextResponse.json(
            { ok: false, error: "duplicate_slug", message: `El slug '${cleanSlug}' ya está en uso.` },
            { status: 400 }
          );
        }
      }
    }

    const updatedSource = await prisma.officialSource.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        slug: cleanSlug,
        baseUrl: body.baseUrl !== undefined ? body.baseUrl.trim() : undefined,
        adapter: body.adapter !== undefined || body.type !== undefined || cleanSlug !== undefined
          ? resolveSourceAdapter({
              adapter: body.adapter,
              slug: cleanSlug || source.slug,
              type: body.type || source.type,
            })
          : undefined,
        healthUrl: body.healthUrl !== undefined ? (body.healthUrl?.trim() || null) : undefined,
        requiresBrowser: body.requiresBrowser !== undefined ? Boolean(body.requiresBrowser) : undefined,
        type: body.type !== undefined ? body.type.trim().toLowerCase() : undefined,
        jurisdiction: body.jurisdiction !== undefined ? body.jurisdiction.trim() : undefined,
        country: body.country !== undefined ? body.country.trim() : undefined,
        state: body.state !== undefined ? (body.state?.trim() || null) : undefined,
        matter: body.matter !== undefined ? (body.matter?.trim() || null) : undefined,
        description: body.description !== undefined ? (body.description?.trim() || null) : undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
        isOfficial: body.isOfficial !== undefined ? body.isOfficial : undefined,
        trustLevel: body.trustLevel !== undefined ? body.trustLevel.trim() : undefined,
        crawlMode: body.crawlMode !== undefined ? body.crawlMode.trim() : undefined,
        refreshFrequency: body.refreshFrequency !== undefined ? body.refreshFrequency.trim() : undefined,
      },
    });

    return NextResponse.json({ ok: true, source: updatedSource });
  } catch (error: any) {
    console.error(`[api/admin/sources/${id}] PATCH error:`, error);
    return NextResponse.json(
      { ok: false, error: "server_error", message: error.message || "Error al actualizar la fuente." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const source = await prisma.officialSource.findUnique({
      where: { id },
    });

    if (!source) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "Fuente oficial no encontrada." },
        { status: 404 }
      );
    }

    // Borrado lógico como indica el requerimiento
    const updatedSource = await prisma.officialSource.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true, source: updatedSource, message: "Fuente oficial desactivada correctamente." });
  } catch (error: any) {
    console.error(`[api/admin/sources/${id}] DELETE error:`, error);
    return NextResponse.json(
      { ok: false, error: "server_error", message: error.message || "Error al desactivar la fuente." },
      { status: 500 }
    );
  }
}
