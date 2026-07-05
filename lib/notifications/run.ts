import type { Item, Norma, NormaVersion, Watchlist } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmailDigest, sendWebhookDigest, type NotificationDigestItem } from "@/lib/notifications/channels";

const MAX_DIGEST_ITEMS = 10;
const VALID_WATCHLIST_TYPES = new Set(["keyword", "norma", "tema"]);

type ItemWithNorma = Item & {
  normaVersions: Array<NormaVersion & { norma: Norma }>;
};

export type NotifyRunOptions = {
  email?: string;
  orgSlug?: string;
  days?: number;
  channels?: Array<"email" | "webhook">;
  dryRun?: boolean;
};

export function normalizeWatchlistType(type: string) {
  const normalized = type.trim().toLowerCase();
  if (!VALID_WATCHLIST_TYPES.has(normalized)) {
    throw new Error("type debe ser keyword, norma o tema");
  }
  return normalized;
}

export async function ensureUser(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) throw new Error("Email invalido");
  return await prisma.user.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized },
  });
}

export async function runNotifications(options: NotifyRunOptions = {}) {
  const days = Math.max(1, Math.min(30, options.days || 1));
  const since = new Date();
  since.setDate(since.getDate() - days);
  const channels = options.channels?.length ? options.channels : (["email", "webhook"] as const);

  const orgs = await prisma.organization.findMany({
    where: options.orgSlug ? { slug: options.orgSlug.trim().toLowerCase() } : undefined,
    include: {
      roles: {
        where: options.email ? { user: { email: options.email.trim().toLowerCase() } } : undefined,
        include: {
          user: true,
        },
      },
      watchlists: { where: { active: true } },
    },
  });

  const items = await prisma.item.findMany({
    where: { createdAt: { gte: since } },
    orderBy: [{ impacto: "asc" }, { published: "desc" }],
    take: 200,
    include: { normaVersions: { include: { norma: true }, take: 1 } },
  });

  const results = [];
  for (const org of orgs) {
    const sentToday = await countOrgNotificationsToday(org.id);
    let remaining = Math.max(0, org.dailyNotificationLimit - sentToday);
    if (remaining <= 0) {
      results.push({ orgId: org.id, orgSlug: org.slug, skipped: true, reason: "daily limit reached" });
      continue;
    }

    for (const role of org.roles) {
      const user = role.user;
      const userWatchlists = org.watchlists.filter((watch) => watch.userId === user.id);
      const digest = await buildUserDigest(org.id, user.id, user.onlyHighImpact, userWatchlists, items, channels, remaining);
      if (digest.length === 0) {
        results.push({ orgId: org.id, orgSlug: org.slug, userId: user.id, email: user.email, sent: 0, skipped: true });
        continue;
      }

      const sentChannels: string[] = [];
      const failedChannels: Array<{ channel: string; error: string }> = [];

      for (const channel of channels) {
        try {
          if (options.dryRun) {
            sentChannels.push(channel);
            continue;
          }
          if (channel === "email") {
            const ok = await sendEmailDigest(user.email, digest);
            if (!ok) throw new Error("email transport failed");
          }
          if (channel === "webhook") {
            const ok = await sendWebhookDigest(digest);
            if (!ok) continue;
          }
          sentChannels.push(channel);
          await logNotifications(org.id, user.id, digest, channel, "sent");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failedChannels.push({ channel, error: message });
          await logNotifications(org.id, user.id, digest, channel, "error", message);
        }
      }

      remaining -= digest.length;
      results.push({
        orgId: org.id,
        orgSlug: org.slug,
        userId: user.id,
        email: user.email,
        matched: digest.length,
        sentChannels,
        failedChannels,
      });
      if (remaining <= 0) break;
    }
  }

  return { ok: true, orgs: orgs.length, results };
}

async function buildUserDigest(
  orgId: string,
  userId: string,
  onlyHighImpact: boolean,
  watchlists: Watchlist[],
  items: ItemWithNorma[],
  channels: readonly string[],
  limit: number
) {
  const digest: NotificationDigestItem[] = [];

  for (const item of items) {
    if (onlyHighImpact && item.impacto !== "alto") continue;

    const reasons = matchReasons(item, watchlists);
    if (item.impacto === "alto") reasons.unshift("impacto alto");
    if (reasons.length === 0) continue;
    if (await alreadySent(orgId, userId, item.id, channels)) continue;

    digest.push({
      id: item.id,
      title: item.title,
      url: item.url,
      impacto: item.impacto,
      tipo: item.tipo,
      tema: item.tema,
      reasons: Array.from(new Set(reasons)),
    });
    if (digest.length >= Math.min(MAX_DIGEST_ITEMS, limit)) break;
  }

  return digest;
}

function matchReasons(item: ItemWithNorma, watchlists: Watchlist[]) {
  const text = `${item.title} ${item.summary || ""} ${item.keywordsHit || ""}`.toLowerCase();
  const normaText = item.normaVersions
    .map((version) => `${version.norma.nombre} ${version.norma.sigla || ""}`)
    .join(" ")
    .toLowerCase();
  const reasons: string[] = [];

  for (const watch of watchlists) {
    const value = watch.value.trim().toLowerCase();
    if (!value) continue;
    if (watch.type === "keyword" && text.includes(value)) reasons.push(`keyword:${watch.value}`);
    if (watch.type === "tema" && (item.tema || "").toLowerCase() === value) reasons.push(`tema:${watch.value}`);
    if (watch.type === "norma" && (normaText.includes(value) || text.includes(value))) {
      reasons.push(`norma:${watch.value}`);
    }
  }

  return reasons;
}

async function alreadySent(orgId: string, userId: string, itemId: string, channels: readonly string[]) {
  const sent = await prisma.notificationLog.findFirst({
    where: { orgId, userId, itemId, channel: { in: [...channels] }, status: "sent" },
  });
  return Boolean(sent);
}

async function logNotifications(
  orgId: string,
  userId: string,
  digest: NotificationDigestItem[],
  channel: string,
  status: string,
  error?: string
) {
  for (const item of digest) {
    await prisma.notificationLog.upsert({
      where: { orgId_userId_itemId_channel: { orgId, userId, itemId: item.id, channel } },
      update: { sentAt: new Date(), status, error: error || null },
      create: { orgId, userId, itemId: item.id, channel, status, error: error || null },
    });
  }
}

async function countOrgNotificationsToday(orgId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return await prisma.notificationLog.count({
    where: { orgId, sentAt: { gte: start }, status: "sent" },
  });
}
