import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/security/adminAuth';

export interface CaseAccessContext {
  organizationId: string;
  userId: string;
  role: string;
}

interface CaseAccessEnvironment {
  NODE_ENV?: string;
  LEGAL_CASES_USER_EMAIL?: string;
  LEGAL_CASES_ORG_SLUG?: string;
}

export const getCaseAccessIdentity = (
  environment: CaseAccessEnvironment = process.env
): { email: string; orgSlug: string } => {
  const isProduction = environment.NODE_ENV === 'production';
  const email =
    environment.LEGAL_CASES_USER_EMAIL?.trim().toLowerCase() ||
    (isProduction ? '' : 'demo@juridico-radar.local');
  const orgSlug =
    environment.LEGAL_CASES_ORG_SLUG?.trim().toLowerCase() ||
    (isProduction ? '' : 'demo-legal');

  if (!email || !orgSlug) {
    throw new Error(
      'Configura LEGAL_CASES_USER_EMAIL y LEGAL_CASES_ORG_SLUG para habilitar expedientes.'
    );
  }
  return { email, orgSlug };
};

export const buildMatterTenantWhere = (
  id: string,
  context: CaseAccessContext
) => ({
  id,
  organizationId: context.organizationId,
});

export const scopedChildWhere = (id: string, matterId: string) => ({
  id,
  matterId,
});

export const requireCaseAccess = async (
  request: Request
): Promise<
  | { ok: true; context: CaseAccessContext }
  | { ok: false; response: Response }
> => {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth;

  let identity: { email: string; orgSlug: string };
  try {
    identity = getCaseAccessIdentity();
  } catch (error) {
    return {
      ok: false,
      response: Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'La identidad de expedientes no está configurada.',
        },
        { status: 503 }
      ),
    };
  }

  const membership = await prisma.orgUserRole.findFirst({
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
    return {
      ok: false,
      response: Response.json(
        {
          error:
            'La identidad configurada no tiene acceso a la organización de expedientes.',
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    context: {
      organizationId: membership.orgId,
      userId: membership.userId,
      role: membership.role,
    },
  };
};
