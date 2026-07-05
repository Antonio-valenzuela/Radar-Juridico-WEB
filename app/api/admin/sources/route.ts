import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { validateUrlSafety } from "@/lib/security/urlValidation";
import { resolveSourceAdapter } from "@/lib/sources/sourceHealth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const sources = await prisma.officialSource.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        fetchLogs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
    return NextResponse.json({ ok: true, sources });
  } catch (error: any) {
    console.error("[api/admin/sources] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "database_error", message: "Error al obtener las fuentes oficiales." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "bad_request", message: "Cuerpo de petición no es JSON válido" }, { status: 400 });
    }

    const {
      name,
      slug,
      baseUrl,
      adapter,
      healthUrl,
      requiresBrowser = false,
      type,
      jurisdiction = "MX",
      country = "MX",
      state,
      matter,
      description,
      isActive = true,
      isOfficial = true,
      trustLevel = "official",
      crawlMode = "api",
      refreshFrequency = "daily",
    } = body;

    // 1. Validaciones obligatorias
    if (!name?.trim() || !slug?.trim() || !baseUrl?.trim() || !type?.trim()) {
      return NextResponse.json(
        { ok: false, error: "validation_error", message: "Los campos name, slug, baseUrl y type son obligatorios." },
        { status: 400 }
      );
    }

    // Normalizar slug
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

    // 2. Validar unicidad del slug
    const existing = await prisma.officialSource.findUnique({
      where: { slug: cleanSlug },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "duplicate_slug", message: `El slug '${cleanSlug}' ya está registrado.` },
        { status: 400 }
      );
    }

    // 3. Validar seguridad de la URL (prevención SSRF)
    const safety = await validateUrlSafety(baseUrl.trim());
    if (!safety.safe) {
      return NextResponse.json(
        { ok: false, error: "unsafe_url", message: `URL rechazada por seguridad: ${safety.error}` },
        { status: 400 }
      );
    }

    if (healthUrl?.trim()) {
      const healthSafety = await validateUrlSafety(healthUrl.trim());
      if (!healthSafety.safe) {
        return NextResponse.json(
          { ok: false, error: "unsafe_health_url", message: `Health URL rechazada por seguridad: ${healthSafety.error}` },
          { status: 400 }
        );
      }
    }

    // 4. Crear registro en BD
    const newSource = await prisma.officialSource.create({
      data: {
        name: name.trim(),
        slug: cleanSlug,
        baseUrl: baseUrl.trim(),
        adapter: resolveSourceAdapter({ adapter, slug: cleanSlug, type }),
        healthUrl: healthUrl?.trim() || null,
        requiresBrowser: Boolean(requiresBrowser),
        type: type.trim().toLowerCase(),
        jurisdiction: jurisdiction.trim(),
        country: country.trim(),
        state: state?.trim() || null,
        matter: matter?.trim() || null,
        description: description?.trim() || null,
        isActive,
        isOfficial,
        trustLevel: trustLevel.trim(),
        crawlMode: crawlMode.trim(),
        refreshFrequency: refreshFrequency.trim(),
      },
    });

    return NextResponse.json({ ok: true, source: newSource }, { status: 201 });
  } catch (error: any) {
    console.error("[api/admin/sources] POST error:", error);
    return NextResponse.json(
      { ok: false, error: "server_error", message: error.message || "Error interno al crear la fuente oficial." },
      { status: 500 }
    );
  }
}
