import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeWatchlistType } from "@/lib/notifications/run";
import { resolveTenant } from "@/lib/tenant";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const action = String(body?.action || "list").toLowerCase();
    const tenant = await resolveTenant({
      email: String(body?.email || ""),
      orgSlug: body?.orgSlug ? String(body.orgSlug) : undefined,
      orgName: body?.orgName ? String(body.orgName) : undefined,
    });

    if (action === "add") {
      const type = normalizeWatchlistType(String(body?.type || ""));
      const value = String(body?.value || "").trim();
      if (!value) throw new Error("value requerido");
      const watch = await prisma.watchlist.upsert({
        where: { orgId_userId_type_value: { orgId: tenant.orgId, userId: tenant.userId, type, value } },
        update: { active: true },
        create: { orgId: tenant.orgId, userId: tenant.userId, type, value },
      });
      return NextResponse.json({ ok: true, action, tenant, watchlists: [watch] });
    }

    if (action === "remove") {
      const id = String(body?.id || "");
      const type = body?.type ? normalizeWatchlistType(String(body.type)) : null;
      const value = body?.value ? String(body.value).trim() : null;
      const result = await prisma.watchlist.updateMany({
        where: {
          orgId: tenant.orgId,
          userId: tenant.userId,
          ...(id ? { id } : {}),
          ...(type ? { type } : {}),
          ...(value ? { value } : {}),
        },
        data: { active: false },
      });
      return NextResponse.json({ ok: true, action, removed: result.count });
    }

    if (action === "settings") {
      const updated = await prisma.user.update({
        where: { id: tenant.userId },
        data: { onlyHighImpact: Boolean(body?.onlyHighImpact) },
      });
      return NextResponse.json({ ok: true, action, tenant, user: updated });
    }

    const watchlists = await prisma.watchlist.findMany({
      where: { orgId: tenant.orgId, userId: tenant.userId, active: true },
      orderBy: { createdAt: "desc" },
    });
    const user = await prisma.user.findUnique({ where: { id: tenant.userId } });
    return NextResponse.json({ ok: true, action: "list", tenant, user, watchlists });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

