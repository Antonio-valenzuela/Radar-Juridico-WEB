import { describe, expect, it } from 'vitest';
import {
  buildMatterTenantWhere,
  getCaseAccessIdentity,
  scopedChildWhere,
} from '@/lib/cases/access';
import {
  validateMatterCreate,
  validateMatterUpdate,
} from '@/lib/cases/validation';

describe('Expedientes aislados por organización', () => {
  it('usa una identidad configurada en servidor y no datos del request', () => {
    expect(
      getCaseAccessIdentity({
        NODE_ENV: 'production',
        LEGAL_CASES_USER_EMAIL: 'server@example.test',
        LEGAL_CASES_ORG_SLUG: 'server-org',
      })
    ).toEqual({
      email: 'server@example.test',
      orgSlug: 'server-org',
    });
  });

  it('rechaza producción sin identidad de expedientes configurada', () => {
    expect(() => getCaseAccessIdentity({ NODE_ENV: 'production' })).toThrow(
      /LEGAL_CASES_USER_EMAIL/
    );
  });

  it('incluye siempre organizationId al buscar un expediente', () => {
    expect(
      buildMatterTenantWhere('matter-1', {
        organizationId: 'org-a',
        userId: 'user-a',
        role: 'owner',
      })
    ).toEqual({ id: 'matter-1', organizationId: 'org-a' });
  });

  it('acota las mutaciones hijas al expediente validado', () => {
    expect(scopedChildWhere('child-1', 'matter-1')).toEqual({
      id: 'child-1',
      matterId: 'matter-1',
    });
  });

  it('ignora organizationId y userId proporcionados por el cliente', () => {
    const result = validateMatterCreate({
      organizationId: 'org-attacker',
      userId: 'user-attacker',
      jurisdiction: 'Jurisdicción de prueba',
      court: 'Órgano de prueba',
      caseNumber: 'EXP-TEST',
      matter: 'Materia de prueba',
      notes: 'Nota de prueba',
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).not.toHaveProperty('organizationId');
      expect(result.data).not.toHaveProperty('assignedUserId');
      expect(result.data.status).toBe('open');
      expect(result.data.description).toBe('Nota de prueba');
    }
  });

  it('sólo permite estados conocidos en actualizaciones', () => {
    expect(validateMatterUpdate({ status: 'compromised' }).valid).toBe(false);
    const valid = validateMatterUpdate({ status: 'closed' });
    expect(valid.valid).toBe(true);
    if (valid.valid) expect(valid.data).toEqual({ status: 'closed' });
  });
});
