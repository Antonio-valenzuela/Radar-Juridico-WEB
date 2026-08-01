import { describe, expect, it } from 'vitest';
import {
  MEXICO_CITY_TIMEZONE,
  deadlineStatus,
  parseProceduralDate,
  proceduralDateKey,
} from '@/lib/cases/deadlineDates';

describe('fechas procesales', () => {
  it('conserva la fecha introducida sin desplazamiento UTC', () => {
    const parsed = parseProceduralDate('2026-07-31');
    expect(proceduralDateKey(parsed, MEXICO_CITY_TIMEZONE)).toBe('2026-07-31');
  });

  it('no marca vencido un plazo que vence hoy antes de terminar el día', () => {
    const today = parseProceduralDate('2026-07-31');
    expect(deadlineStatus(today, { now: new Date('2026-07-31T15:00:00.000Z') })).toBe('pending');
    expect(deadlineStatus(today, { now: new Date('2026-08-01T15:00:00.000Z') })).toBe('overdue');
  });

  it('mantiene fin de mes, fin de año y fines de semana sin inventar inhábiles', () => {
    expect(proceduralDateKey(parseProceduralDate('2026-12-31'), MEXICO_CITY_TIMEZONE)).toBe('2026-12-31');
    expect(deadlineStatus(parseProceduralDate('2026-08-01'), { now: new Date('2026-08-02T12:00:00.000Z') })).toBe('overdue');
  });
});
