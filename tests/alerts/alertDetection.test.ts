import { describe, expect, it } from 'vitest';
import {
  buildNormChangeAlert,
  shouldRetryNormMonitor,
} from '@/worker/normMonitorWorker';

describe('Alertas de monitoreo normativo', () => {
  it('crea una alerta legible sólo para un cambio posterior al hash inicial', () => {
    expect(
      buildNormChangeAlert({
        normName: 'Norma verificada de prueba',
        normId: 'norm-1',
        previousHash: 'old-hash',
        newHash: 'new-hash',
      })
    ).toEqual({
      level: 'warning',
      title: 'Cambio detectado en Norma verificada de prueba',
      description:
        'La fuente oficial cambió de hash. Revisa la nueva versión antes de aplicar el contenido al expediente.',
    });
  });

  it('no crea alerta para la primera huella conocida', () => {
    expect(
      buildNormChangeAlert({
        normName: 'Norma verificada de prueba',
        normId: 'norm-1',
        previousHash: null,
        newHash: 'first-hash',
      })
    ).toBeNull();
  });

  it('solicita reintento ante errores transitorios', () => {
    expect(
      shouldRetryNormMonitor([
        { normId: 'norm-1', status: 'failed', changed: false },
      ])
    ).toBe(true);
  });

  it('no reintenta cuando la fuente requiere sesión o revisión manual', () => {
    expect(
      shouldRetryNormMonitor([
        { normId: 'norm-1', status: 'session_required', changed: false },
        { normId: 'norm-2', status: 'manual_review', changed: true },
      ])
    ).toBe(false);
  });
});
