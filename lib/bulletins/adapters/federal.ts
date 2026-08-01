import type { BulletinAdapterResult, BulletinQuery } from '@/lib/bulletins/types';

export const FEDERAL_BULLETIN_URL = 'https://sise.cjf.gob.mx/consultasvp/default.aspx';

export async function queryFederalBulletin(_query: BulletinQuery): Promise<BulletinAdapterResult> {
  return {
    status: 'AUTH_REQUIRED',
    queryStatus: 'CAPTCHA_REQUIRED',
    publicationStatus: 'UNKNOWN',
    checkedAt: new Date(),
    sourceUrl: FEDERAL_BULLETIN_URL,
    results: [],
    warnings: ['La consulta federal requiere revisión en el portal oficial y no se automatizan credenciales, FIREL ni CAPTCHA.'],
    responseHash: null,
    httpStatus: null,
    errorCode: 'AUTH_REQUIRED',
    adapterVersion: '1.0.0',
    origin: 'OFFICIAL_PUBLIC_SOURCE',
  };
}
