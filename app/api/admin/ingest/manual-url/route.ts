import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { ingestManualUrl } from "@/lib/ingest/manualUrl";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
        message: "Solicitud inválida: revisa que los datos enviados sean JSON válido.",
        warnings: [],
        timings: { validationMs: 0, fetchMs: 0, extractMs: 0, persistMs: 0, indexMs: 0 },
        indexed: false,
      },
      { status: 400 }
    );
  }

  try {
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
    console.error("POST /api/admin/ingest/manual-url error:", errMsg);

    // Detectar errores de validación de seguridad (SSRF / URL privada / puerto bloqueado)
    const isSecurityError = /ssrf|private|blocked|privada|bloqueada|internal|localhost|127\.|0\.0\.0|192\.168|10\.\d|172\.(1[6-9]|2\d|3[01])/i.test(errMsg);

    return NextResponse.json(
      {
        ok: false,
        status: "failed",
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
