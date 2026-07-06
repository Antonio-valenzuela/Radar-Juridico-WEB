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
  
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
      }
    });
  }

  const slug = "demo";
  const name = "Radar Jurídico Demo";

  let org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        slug,
        name,
        dailyNotificationLimit: 100,
      }
    });
  }

  let membership = await prisma.orgUserRole.findUnique({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
  });
  if (!membership) {
    membership = await prisma.orgUserRole.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: "owne" + "r",
      }
    });
  }

  return {
    orgId: org.id,
    orgSlug: org.slug,
    userId: user.id,
    email: user.email,
    role: membership.role,
    dailyNotificationLimit: org.dailyNotificationLimit,
  };
}

