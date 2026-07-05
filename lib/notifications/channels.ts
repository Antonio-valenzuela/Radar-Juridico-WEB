import { sendEmail } from "@/lib/email";

export type NotificationDigestItem = {
  id: string;
  title: string;
  url: string;
  impacto: string | null;
  tipo: string | null;
  tema: string | null;
  reasons: string[];
};

export function buildDigestText(items: NotificationDigestItem[]) {
  return items
    .slice(0, 10)
    .map((item, index) => {
      const meta = [item.impacto, item.tipo, item.tema].filter(Boolean).join(" / ");
      return `${index + 1}. ${item.title}\n${meta}\nMatch: ${item.reasons.join(", ")}\n${item.url}`;
    })
    .join("\n\n");
}

export function buildDigestHtml(items: NotificationDigestItem[]) {
  const rows = items
    .slice(0, 10)
    .map(
      (item) => `
        <li style="margin-bottom:16px">
          <a href="${escapeHtml(item.url)}" style="font-weight:700;color:#111">${escapeHtml(item.title)}</a>
          <div style="font-size:13px;color:#555">${escapeHtml(
            [item.impacto, item.tipo, item.tema].filter(Boolean).join(" / ") || "Sin clasificacion"
          )}</div>
          <div style="font-size:13px;color:#555">Match: ${escapeHtml(item.reasons.join(", "))}</div>
        </li>`
    )
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.45">
      <h1 style="font-size:20px">Radar juridico: ${items.length} novedad(es)</h1>
      <ul style="padding-left:20px">${rows}</ul>
    </div>`;
}

export async function sendEmailDigest(to: string, items: NotificationDigestItem[]) {
  return await sendEmail({
    to,
    subject: `Radar juridico: ${items.length} novedad(es) relevantes`,
    html: buildDigestHtml(items),
  });
}

export async function sendWebhookDigest(items: NotificationDigestItem[]) {
  const webhookUrl = process.env.WEBHOOK_URL?.trim();
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const telegramChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const text = `Radar juridico: ${items.length} novedad(es)\n\n${buildDigestText(items)}`;

  if (telegramToken && telegramChatId) {
    const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: text.slice(0, 3900),
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return true;
  }

  if (!webhookUrl) return false;

  const payload = webhookUrl.includes("discord.com/api/webhooks")
    ? {
        embeds: [
          {
            title: `Radar juridico: ${items.length} novedad(es)`,
            description: buildDigestText(items).slice(0, 3900),
            color: 0xcc0000,
            timestamp: new Date().toISOString(),
          },
        ],
      }
    : webhookUrl.includes("hooks.slack.com") || webhookUrl.includes("slack.com")
    ? { text }
    : { event: "juridico_radar_digest", count: items.length, items };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Webhook HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
