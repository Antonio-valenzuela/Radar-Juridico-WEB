import { prisma } from "@/lib/prisma";

export type TenantContext = {
  orgId: string;
  orgSlug: string;
  userId: string;
  email: string;
  role: string;
  dailyNotificationLimit: number;
};

export function normalizeOrgSlug(value?: string | null) {
  const raw = (value || "default").trim().toLowerCase();
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "default";
}

export async function resolveTenant(params: {
  email: string;
  orgSlug?: string | null;
  orgName?: string | null;
}): Promise<TenantContext> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Email invalido");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Usuario no encontrado");

  const slug = normalizeOrgSlug(params.orgSlug);
  const org = await prisma.organization.findUnique({ where: { slug } });

  if (!org) throw new Error("Organizacion no encontrada");

  const membership = await prisma.orgUserRole.findUnique({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
  });

  if (!membership) throw new Error("Usuario sin acceso a esta organizacion");

  return {
    orgId: org.id,
    orgSlug: org.slug,
    userId: user.id,
    email: user.email,
    role: membership.role,
    dailyNotificationLimit: org.dailyNotificationLimit,
  };
}
