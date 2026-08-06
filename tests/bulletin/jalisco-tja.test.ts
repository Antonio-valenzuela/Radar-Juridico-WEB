import { describe, it, expect } from 'vitest';
import { queryTjaJaliscoBulletin } from '../../lib/bulletins/adapters/jalisco-tja';

describe('jalisco-tja adapter', () => {
  it('queries real active expediente (e.g. 1012/2026) and returns FOUND with entries', async () => {
    const res = await queryTjaJaliscoBulletin({
      expedienteNumber: '1012/2026',
    });

    expect(res.httpStatus).toBe(200);
    expect(res.status).toBe('FOUND');
    expect(res.entries.length).toBeGreaterThan(0);
    expect(res.entries[0].expedienteNumber).toContain('1012/2026');
  }, 25000);

  it('queries an invented non-existent expediente (999999/2099) and returns NOT_FOUND without crashing', async () => {
    const res = await queryTjaJaliscoBulletin({
      expedienteNumber: '999999/2099',
    });

    expect(res.httpStatus).toBe(200);
    expect(res.status).toBe('NOT_FOUND');
    expect(res.entries).toEqual([]);
  }, 25000);
});
