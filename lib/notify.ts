export interface NotifyItem {
  title: string;
  url: string;
  impacto?: string | null;
  tipo?: string | null;
  tema?: string | null;
}

function buildDiscordPayload(items: NotifyItem[]): object {
  const lines = items
    .slice(0, 5)
    .map(
      (i) =>
        `• **${i.title}**\n  Tipo: ${i.tipo || "—"} | Tema: ${i.tema || "—"}\n  ${i.url}`
    )
    .join("\n\n");

  return {
    embeds: [
      {
        title: "🔴 Radar Jurídico — Nuevos items de ALTO IMPACTO",
        description: lines,
        color: 0xcc0000,
        footer: { text: "juridico-radar" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function buildSlackPayload(items: NotifyItem[]): object {
  const lines = items
    .slice(0, 5)
    .map((i) => `• <${i.url}|${i.title}> · ${i.tipo || "—"} / ${i.tema || "—"}`)
    .join("\n");

  return {
    text: `🔴 *Radar Jurídico — ${items.length} nuevos items de ALTO IMPACTO*\n${lines}`,
  };
}

function buildGenericPayload(items: NotifyItem[]): object {
  return {
    event: "high_impact_items",
    count: items.length,
    items: items.slice(0, 5).map((i) => ({
      title: i.title,
      url: i.url,
      tipo: i.tipo,
      tema: i.tema,
    })),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sends a webhook notification with top high-impact items.
 * Detects Discord vs Slack vs generic based on URL pattern.
 * Reads WEBHOOK_URL from environment. No-op if not configured.
 */
export async function sendWebhookNotification(items: NotifyItem[]): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL?.trim();
  if (!webhookUrl || items.length === 0) return;

  let payload: object;
  if (webhookUrl.includes("discord.com/api/webhooks")) {
    payload = buildDiscordPayload(items);
  } else if (
    webhookUrl.includes("hooks.slack.com") ||
    webhookUrl.includes("slack.com")
  ) {
    payload = buildSlackPayload(items);
  } else {
    payload = buildGenericPayload(items);
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Webhook responded ${res.status}: ${body.slice(0, 200)}`);
  }
}
