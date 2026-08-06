import { describe, it, expect } from 'vitest';
import { normalizeExpediente } from '../../lib/utils/normalizeExpediente';

describe('normalizeExpediente', () => {
  it('normalizes standard 2-digit year format "1234/24" -> "1234/2024"', () => {
    expect(normalizeExpediente('1234/24')).toBe('1234/2024');
  });

  it('normalizes hyphenated format "1234-2024" -> "1234/2024"', () => {
    expect(normalizeExpediente('1234-2024')).toBe('1234/2024');
  });

  it('normalizes format with prefix "Exp. 1234/2024" -> "1234/2024"', () => {
    expect(normalizeExpediente('Exp. 1234/2024')).toBe('1234/2024');
  });

  it('normalizes space separator "1234 2024" -> "1234/2024"', () => {
    expect(normalizeExpediente('1234 2024')).toBe('1234/2024');
  });

  it('handles zero padding on serial numbers "001234/2024" -> "1234/2024"', () => {
    expect(normalizeExpediente('001234/2024')).toBe('1234/2024');
  });

  it('handles "Expediente 001012-26" -> "1012/2026"', () => {
    expect(normalizeExpediente('Expediente 001012-26')).toBe('1012/2026');
  });

  it('handles source slug parameters e.g. TJA_JALISCO', () => {
    expect(normalizeExpediente('1234/2024', 'TJA_JALISCO')).toBe('1234/2024');
  });

  it('returns null for unrecognized or invalid formats', () => {
    expect(normalizeExpediente('abc')).toBeNull();
    expect(normalizeExpediente('1234')).toBeNull();
    expect(normalizeExpediente('foo/bar')).toBeNull();
    expect(normalizeExpediente('')).toBeNull();
    expect(normalizeExpediente(null as any)).toBeNull();
    expect(normalizeExpediente(undefined as any)).toBeNull();
  });

  it('returns null for unrealistic or future years e.g. "999999/2099"', () => {
    expect(normalizeExpediente('999999/2099')).toBeNull();
  });
});
