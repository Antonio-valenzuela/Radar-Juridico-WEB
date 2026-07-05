import { NextRequest, NextResponse } from "next/server";
import { ensureUser } from "@/lib/notifications/run";
import { resolveTenant } from "@/lib/tenant";
import { sendEmailDigest, sendWebhookDigest, type NotificationDigestItem } from "@/lib/notifications/channels";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const email = String(body?.email || process.env.NOTIFY_TEST_EMAIL || "");
    if (!email) throw new Error("email requerido");
    await ensureUser(email);
    await resolveTenant({ email, orgSlug: body?.orgSlug ? String(body.orgSlug) : undefined });

    const item: NotificationDigestItem = {
      id: "test",
      title: "Prueba de notificacion Juridico Radar",
      url: "http://localhost:3000",
      impacto: "alto",
      tipo: "LEY",
      tema: "constitucional/amparo",
      reasons: ["impacto alto", "test"],
    };

    const emailOk = await sendEmailDigest(email, [item]);
    let webhookOk = false;
    try {
      webhookOk = await sendWebhookDigest([item]);
    } catch (error) {
      return NextResponse.json({
        ok: false,
        emailOk,
        webhookOk,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json({ ok: true, emailOk, webhookOk });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

