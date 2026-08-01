import { describe, expect, it } from 'vitest';
import { hasPendingMarkers } from '@/lib/templates/templateQuality';

describe('calidad de machotes', () => {
  it('detecta marcadores pendientes y permite documentos terminados', () => {
    expect(hasPendingMarkers('[PENDIENTE: verificar fundamento normativo]')).toBe(true);
    expect(hasPendingMarkers('Hechos acreditados y fundamento revisado.')).toBe(false);
  });
});
