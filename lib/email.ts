/**
 * lib/email.ts
 * Envia correos usando Resend si existe API Key, o loguea en consola (MVP).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "alerts@juridico-radar.com";

interface EmailParams {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
    if (!RESEND_API_KEY) {
        console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
        return true;
    }

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to,
                subject,
                html
            })
        });

        if (!res.ok) {
            console.error("Email send failed", await res.text());
            return false;
        }
        return true;
    } catch (e) {
        console.error("Email transport error", e);
        return false;
    }
}
