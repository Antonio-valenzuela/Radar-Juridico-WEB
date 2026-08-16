import { prisma } from '@/lib/prisma';
import { getCaseAccessIdentity } from '@/lib/cases/access';

export interface LawyerAccessContext {
  organizationId: string;
  userId: string;
  role: string;
  lawyerId: string;
}

/**
 * Resolves lawyer session and authorization context for document, draft, and template operations.
 * Decoupled from system admin token checks so lawyers can manage their own legal workspace freely.
 */
export async function requireLawyerAccess(
  request: Request
): Promise<{ ok: true; context: LawyerAccessContext } | { ok: false; response: Response }> {
  try {
    // 1. Check custom user identity headers if provided by client or auth proxy
    const headerUserId = request.headers.get('x-user-id')?.trim();
    const headerOrgId = request.headers.get('x-org-id')?.trim();

    if (headerUserId && headerOrgId) {
      return {
        ok: true,
        context: {
          organizationId: headerOrgId,
          userId: headerUserId,
          lawyerId: headerUserId,
          role: 'lawyer',
        },
      };
    }

    // 2. Fallback to configured workspace identity (demo/dev or env)
    let identity: { email: string; orgSlug: string };
    try {
      identity = getCaseAccessIdentity();
    } catch {
      identity = { email: 'demo@juridico-radar.local', orgSlug: 'demo-legal' };
    }

    let membership = await prisma.orgUserRole.findFirst({
      where: {
        user: { email: identity.email },
        org: { slug: identity.orgSlug },
      },
      select: {
        orgId: true,
        userId: true,
        role: true,
      },
    });

    if (!membership) {
      // Ensure default organization & user exist in Prisma if needed
      const org = await prisma.organization.upsert({
        where: { slug: identity.orgSlug },
        update: {},
        create: { name: 'Despacho Demo Legal', slug: identity.orgSlug },
      });

      const user = await prisma.user.upsert({
        where: { email: identity.email },
        update: {},
        create: { email: identity.email },
      });

      const role = await prisma.orgUserRole.upsert({
        where: { orgId_userId: { orgId: org.id, userId: user.id } },
        update: {},
        create: { orgId: org.id, userId: user.id, role: 'lawyer' },
      });

      membership = {
        orgId: role.orgId,
        userId: role.userId,
        role: role.role,
      };
    }

    return {
      ok: true,
      context: {
        organizationId: membership.orgId,
        userId: membership.userId,
        lawyerId: membership.userId,
        role: membership.role,
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: error.message || 'Error al autenticar sesión de abogado.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
}
