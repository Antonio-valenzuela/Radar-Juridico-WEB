import { describe, expect, it } from 'vitest';
import {
  createBulletinBatchPlan,
  normalizeBulletinExpediente,
  type BulletinBatchWatch,
} from '@/lib/bulletins/batch';

const watch = (
  id: string,
  overrides: Partial<BulletinBatchWatch> = {},
): BulletinBatchWatch => ({
  id,
  provider: 'CJJ_JALISCO',
  providerId: 'source-jalisco',
  expedienteNumber: '123/2026',
  expedienteYear: 2026,
  matterLabel: 'Civil',
  judicialDistrict: 'Primer Partido Judicial',
  court: 'Juzgado Primero Civil',
  ...overrides,
});

describe('planeación de lotes del Boletín Judicial', () => {
  it('normaliza variantes equivalentes del número de expediente', () => {
    expect(normalizeBulletinExpediente(' 00123 / 2026 ')).toBe('123/2026');
    expect(normalizeBulletinExpediente('123-2026')).toBe('123/2026');
    expect(normalizeBulletinExpediente(' CJJ 00123 / 26 ')).toBe('CJJ123/2026');
  });

  it('conserva la precisión de identificadores más largos que un entero seguro', () => {
    expect(normalizeBulletinExpediente('0009007199254740993/2026')).toBe('9007199254740993/2026');
  });

  it('agrupa por proveedor, materia, partido, juzgado y fecha e indexa expedientes', () => {
    const plan = createBulletinBatchPlan([
      watch('watch-1', { expedienteNumber: '00123/2026' }),
      watch('watch-2', {
        provider: ' cjj_jalisco ',
        expedienteNumber: '123-2026',
        matterLabel: ' civil ',
        judicialDistrict: 'PRIMER PARTIDO JUDICIAL',
        court: 'Juzgado Primero Civil ',
      }),
      watch('watch-3', { expedienteNumber: '999/2026', court: 'Juzgado Segundo Civil' }),
    ], {
      date: '2026-08-01',
      maxGroups: 10,
      maxWatchesPerGroup: 10,
    });

    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0]).toMatchObject({
      provider: 'CJJ_JALISCO',
      matter: 'Civil',
      judicialDistrict: 'Primer Partido Judicial',
      court: 'Juzgado Primero Civil',
      date: '2026-08-01',
    });
    expect([...plan.groups[0].expedienteIndex.keys()]).toEqual(['123/2026']);
    expect(plan.groups[0].expedienteIndex.get('123/2026')?.map((item) => item.id)).toEqual([
      'watch-1',
      'watch-2',
    ]);
    expect(plan.groups[1].expedienteIndex.has('999/2026')).toBe(true);
  });

  it('aplica límites de grupos y watches sin ocultar los descartes', () => {
    const plan = createBulletinBatchPlan([
      watch('watch-1'),
      watch('watch-2', { expedienteNumber: '124/2026' }),
      watch('watch-3', { expedienteNumber: '125/2026' }),
      watch('watch-4', { court: 'Juzgado Segundo Civil' }),
      watch('watch-5', { court: 'Juzgado Tercero Civil' }),
    ], {
      date: '2026-08-01',
      maxGroups: 2,
      maxWatchesPerGroup: 2,
    });

    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0].watches.map((item) => item.id)).toEqual(['watch-1', 'watch-2']);
    expect(plan.totalWatches).toBe(5);
    expect(plan.includedWatches).toBe(3);
    expect(plan.droppedWatches).toBe(2);
    expect(plan.truncated).toBe(true);
  });

  it('no mezcla fuentes distintas aunque compartan adapter y etiquetas', () => {
    const plan = createBulletinBatchPlan([
      watch('watch-1', { providerId: 'source-a' }),
      watch('watch-2', { providerId: 'source-b' }),
    ], { date: '2026-08-01', maxGroups: 10, maxWatchesPerGroup: 10 });

    expect(plan.groups).toHaveLength(2);
  });
});
