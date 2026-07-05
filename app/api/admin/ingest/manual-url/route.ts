import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { ingestManualUrl } from "@/lib/ingest/manualUrl";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = requireAdmin(req);
    if (!auth.ok) return auth.response;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          status: "failed",
          error: "Solicitud inválida: revisa que los datos enviados sean JSON válido.",
          message: "Solicitud inválida: revisa que los datos enviados sean JSON válido.",
          warnings: [],
          timings: { validationMs: 0, fetchMs: 0, extractMs: 0, persistMs: 0, indexMs: 0 },
          indexed: false,
        },
        { status: 400 }
      );
    }

    const result = await ingestManualUrl({
      url: body?.url,
      matter: body?.matter,
      sourceName: body?.sourceName,
      jurisdiction: body?.jurisdiction,
      tags: Array.isArray(body?.tags)
        ? body.tags
        : String(body?.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      indexNow: body?.indexNow !== false,
    });

    const payload = {
      ...result,
      indexed: result.indexingStatus === "indexed",
      versionId: result.documentVersionId,
    };
    const status = result.status === "failed" ? 400 : 200;
    return NextResponse.json(payload, { status });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[manual-url-ingest] failed", error);

    // Detectar errores de validación de seguridad (SSRF / URL privada / puerto bloqueado)
    const isSecurityError = /ssrf|private|blocked|privada|bloqueada|internal|localhost|127\.|0\.0\.0|192\.168|10\.\d|172\.(1[6-9]|2\d|3[01])/i.test(errMsg);

    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        error: isSecurityError
          ? "URL bloqueada por seguridad. No se permiten direcciones IP privadas, localhost ni puertos internos."
          : `Error al procesar la ingesta: ${errMsg}`,
        message: isSecurityError
          ? "URL bloqueada por seguridad. No se permiten direcciones IP privadas, localhost ni puertos internos."
          : "No se pudo procesar la URL. Revisa los datos e intenta de nuevo.",
        warnings: [],
        timings: { validationMs: 0, fetchMs: 0, extractMs: 0, persistMs: 0, indexMs: 0 },
        indexed: false,
      },
      { status: isSecurityError ? 400 : 500 }
    );
  }
}
