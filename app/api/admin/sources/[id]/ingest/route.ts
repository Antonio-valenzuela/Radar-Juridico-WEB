import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { runSourceIngest } from "@/lib/ingest/runIngest";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  let id = "";
  try {
    const params = await props.params;
    id = params?.id || "";
  } catch {
    // Fallback parsing from URL path
  }

  if (!id) {
    const parts = req.nextUrl.pathname.split("/");
    // El id está justo antes del último segmento 'ingest' (ej: /api/admin/sources/ID/ingest)
    id = parts[parts.length - 2] || "";
  }

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

    if (!source.isActive) {
      return NextResponse.json({
        ok: false,
        error: "inactive_source",
        message: `La fuente '${source.name}' está desactivada y no puede ser ingestada.`,
      }, { status: 400 });
    }

    // Validar que fuentes manual_url tengan una URL específica (no solo homepage)
    if (source.crawlMode === 'manual_url') {
      try {
        const parsed = new URL(source.baseUrl);
        if (parsed.pathname === '/' || parsed.pathname === '') {
          return NextResponse.json({
            ok: false,
            errorCode: 'MANUAL_URL_REQUIRED',
            message: 'Las fuentes con modo MANUAL_URL requieren una URL específica (no la página de inicio). Configura la URL base apuntando a un documento concreto, o cambia el modo de ingesta a "html".',
          }, { status: 400 });
        }
      } catch {
        return NextResponse.json({
          ok: false,
          errorCode: 'INVALID_URL',
          message: 'La URL base de la fuente no es válida.',
        }, { status: 400 });
      }
    }

    // Ejecutar la ingesta de la fuente utilizando su slug
    const result = await runSourceIngest(source.slug);

    return NextResponse.json({
      ok: result.ok,
      found: result.found,
      saved: result.saved,
      duplicates: result.duplicates,
      errors: result.errors,
      warnings: result.warnings || [],
      sample: result.sample,
      message: result.ok 
        ? result.warnings?.length
          ? result.warnings.join(" ")
          : `Ingesta manual completada con éxito. Encontrados: ${result.found}, Guardados: ${result.saved}, Duplicados: ${result.duplicates}.`
        : `La ingesta falló o tuvo advertencias: ${result.errors.join(", ")}`
    });

  } catch (error: any) {
    console.error(`[api/admin/sources/${id}/ingest] POST error:`, error);
    return NextResponse.json(
      { ok: false, error: "server_error", message: error.message || "Error al ejecutar la ingesta manual." },
      { status: 500 }
    );
  }
}
