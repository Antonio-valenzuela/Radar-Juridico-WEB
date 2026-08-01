import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { BulletinAdapterResult } from '@/lib/bulletins/types';
import {
  BULLETIN_SCHEDULER_ID,
  BULLETIN_WORKER_JOB_CONCURRENCY,
  buildBulletinWorkerConfig,
  createBulletinJobProcessor,
  registerBulletinConsumer,
  upsertBulletinScheduler,
  type BulletinWorkerWatch,
} from '@/worker/bulletinWorker';

const watch = (index: number): BulletinWorkerWatch => ({
  id: `watch-${index}`,
  matterId: `matter-${index}`,
  sourceId: 'source-jalisco',
  expedienteNumber: index % 2 === 0 ? '00123 / 2026' : '123-2026',
  expedienteYear: 2026,
  matterLabel: 'Civil',
  judicialDistrict: 'Primer Partido Judicial',
  court: 'Juzgado Primero Civil',
  chamber: null,
  lastCheckedAt: null,
  source: { slug: 'boletin_judicial_jalisco', adapter: 'JALISCO_BULLETIN' },
  matter: { organizationId: `org-${index}` },
});

describe('worker agrupado del Boletín Judicial', () => {
  it('permanece deshabilitado por defecto y acepta límites configurables', () => {
    expect(buildBulletinWorkerConfig({}).enabled).toBe(false);
    expect(buildBulletinWorkerConfig({
      BULLETIN_MONITOR_ENABLED: 'true',
      BULLETIN_MONITOR_CRON: '*/15 8-18 * * 1-5',
      BULLETIN_MONITOR_TIMEZONE: 'America/Mexico_City',
      BULLETIN_MAX_GROUPS_PER_RUN: '12',
      BULLETIN_MAX_WATCHES_PER_GROUP: '250',
      BULLETIN_CONCURRENCY: '4',
    })).toMatchObject({
      enabled: true,
      cron: '*/15 8-18 * * 1-5',
      timezone: 'America/Mexico_City',
      maxGroups: 12,
      maxWatchesPerGroup: 250,
      concurrency: 4,
    });
  });

  it('consulta una vez el boletín diario para 100 expedientes distintos y filtra cada persistencia', async () => {
    const providerResult: BulletinAdapterResult = {
      status: 'PUBLISHED',
      queryStatus: 'SUCCESS',
      publicationStatus: 'NEW_PUBLICATIONS',
      checkedAt: new Date('2026-08-01T14:00:00.000Z'),
      sourceUrl: 'https://official.example/boletin',
      results: Array.from({ length: 100 }, (_, index) => ({
        expedienteNumber: `${1000 + index}/2026`,
        expedienteYear: 2026,
        publicationDate: new Date('2026-08-01T12:00:00.000Z'),
        sourceUrl: 'https://official.example/boletin',
        evidenceKind: 'bulletin_publication' as const,
      })),
      warnings: [],
    };
    const fetchGroup = vi.fn(async () => providerResult);
    const checkWatch = vi.fn(async (_item: BulletinWorkerWatch, adapterResult?: BulletinAdapterResult) => {
      return {
        runId: `run-${checkWatch.mock.calls.length}`,
        result: adapterResult as BulletinAdapterResult,
        newResults: 0,
      };
    });
    const processor = createBulletinJobProcessor({
      listWatches: async () => Array.from({ length: 100 }, (_, index) => ({
        ...watch(index),
        expedienteNumber: `${1000 + index}/2026`,
      })),
      fetchGroup,
      checkWatch,
      delay: async () => undefined,
      now: () => new Date('2026-08-01T14:00:00.000Z'),
    }, {
      ...buildBulletinWorkerConfig({ BULLETIN_MONITOR_ENABLED: 'true' }),
      maxGroups: 10,
      maxWatchesPerGroup: 200,
      concurrency: 2,
      minCheckIntervalMs: 0,
      jitterMs: 0,
    });

    const summary = await processor({ data: { date: '2026-08-01' } } as never);

    expect(summary).toMatchObject({
      groups: 1,
      checked: 100,
      providerRequests: 1,
      reusedResults: 100,
      failed: 0,
    });
    expect(fetchGroup).toHaveBeenCalledTimes(1);
    expect(checkWatch).toHaveBeenCalledTimes(100);
    for (const [item, filtered] of checkWatch.mock.calls) {
      expect(filtered?.results).toHaveLength(1);
      expect(filtered?.results[0].expedienteNumber).toBe(item.expedienteNumber);
    }
  });

  it('usa el máximo configurado cuando el job no envía maxGroups', async () => {
    const providerResult: BulletinAdapterResult = {
      status: 'MANUAL_REVIEW',
      queryStatus: 'SUCCESS',
      publicationStatus: 'UNKNOWN',
      checkedAt: new Date('2026-08-01T14:00:00.000Z'),
      sourceUrl: 'https://official.example/boletin',
      results: [],
      warnings: [],
    };
    const processor = createBulletinJobProcessor({
      listWatches: async () => [
        watch(1),
        { ...watch(2), court: 'Juzgado Segundo Civil' },
        { ...watch(3), court: 'Juzgado Tercero Civil' },
      ],
      fetchGroup: async () => providerResult,
      checkWatch: async () => ({ runId: 'run', result: providerResult, newResults: 0 }),
      delay: async () => undefined,
      now: () => new Date('2026-08-01T14:00:00.000Z'),
    }, {
      ...buildBulletinWorkerConfig({ BULLETIN_MONITOR_ENABLED: 'true' }),
      maxGroups: 3,
      minCheckIntervalMs: 0,
      jitterMs: 0,
    });

    const summary = await processor({ data: { date: '2026-08-01' } } as never);

    expect(summary.groups).toBe(3);
    expect(summary.providerRequests).toBe(3);
  });

  it('separa por año los resultados de expedientes con el mismo número', async () => {
    const providerResult: BulletinAdapterResult = {
      status: 'PUBLISHED', queryStatus: 'SUCCESS', publicationStatus: 'NEW_PUBLICATIONS',
      checkedAt: new Date('2026-08-01T14:00:00.000Z'), sourceUrl: 'https://official.example',
      results: [2025, 2026].map((year) => ({
        expedienteNumber: '123', expedienteYear: year,
        publicationDate: new Date('2026-08-01T12:00:00.000Z'),
        sourceUrl: 'https://official.example', evidenceKind: 'bulletin_publication' as const,
      })),
      warnings: [],
    };
    const fetchGroup = vi.fn(async () => providerResult);
    const persisted: Array<{ watch: BulletinWorkerWatch; result: BulletinAdapterResult }> = [];
    const processor = createBulletinJobProcessor({
      listWatches: async () => [
        { ...watch(1), expedienteNumber: '123', expedienteYear: 2025 },
        { ...watch(2), expedienteNumber: '123', expedienteYear: 2026 },
      ],
      fetchGroup,
      checkWatch: async (_item, adapterResult) => {
        persisted.push({ watch: _item, result: adapterResult as BulletinAdapterResult });
        return { runId: 'run', result: adapterResult as BulletinAdapterResult, newResults: 0 };
      },
      delay: async () => undefined,
      now: () => new Date('2026-08-01T14:00:00.000Z'),
    }, { ...buildBulletinWorkerConfig({ BULLETIN_MONITOR_ENABLED: 'true' }), minCheckIntervalMs: 0, jitterMs: 0 });

    const summary = await processor({ data: { date: '2026-08-01' } } as never);

    expect(fetchGroup).toHaveBeenCalledTimes(1);
    expect(summary.providerRequests).toBe(1);
    expect(persisted).toHaveLength(2);
    for (const item of persisted) {
      expect(item.result.results).toHaveLength(1);
      expect(item.result.results[0].expedienteYear).toBe(item.watch.expedienteYear);
    }
  });

  it('reutiliza AUTH_REQUIRED sin convertirlo en ausencia de publicación', async () => {
    const authRequired: BulletinAdapterResult = {
      status: 'AUTH_REQUIRED', queryStatus: 'AUTH_REQUIRED', publicationStatus: 'UNKNOWN',
      checkedAt: new Date('2026-08-01T14:00:00.000Z'),
      sourceUrl: 'https://official.example/boletin', results: [],
      warnings: ['CAPTCHA'], errorCode: 'CAPTCHA_PRESENT',
    };
    const fetchGroup = vi.fn(async () => authRequired);
    const checkWatch = vi.fn(async (_item: BulletinWorkerWatch, adapterResult?: BulletinAdapterResult) => ({
      runId: 'run', result: adapterResult as BulletinAdapterResult, newResults: 0,
    }));
    const processor = createBulletinJobProcessor({
      listWatches: async () => [watch(1), watch(2)],
      fetchGroup,
      checkWatch,
      delay: async () => undefined,
      now: () => new Date('2026-08-01T14:00:00.000Z'),
    }, { ...buildBulletinWorkerConfig({ BULLETIN_MONITOR_ENABLED: 'true' }), minCheckIntervalMs: 0, jitterMs: 0 });

    const summary = await processor({ data: { date: '2026-08-01' } } as never);

    expect(summary).toMatchObject({ providerRequests: 1, checked: 2, reusedResults: 2 });
    expect(fetchGroup).toHaveBeenCalledTimes(1);
    for (const [, result] of checkWatch.mock.calls) {
      expect(result).toMatchObject({ status: 'AUTH_REQUIRED', queryStatus: 'AUTH_REQUIRED', publicationStatus: 'UNKNOWN' });
    }
  });

  it('propaga fallos para que BullMQ active sus reintentos', async () => {
    const providerResult: BulletinAdapterResult = {
      status: 'NOT_FOUND_AS_OF', queryStatus: 'SUCCESS', publicationStatus: 'NO_PUBLICATION_FOUND_AS_OF',
      checkedAt: new Date('2026-08-01T14:00:00.000Z'), sourceUrl: 'https://official.example',
      results: [], warnings: [],
    };
    const processor = createBulletinJobProcessor({
      listWatches: async () => [watch(1)],
      fetchGroup: async () => providerResult,
      checkWatch: async () => { throw new Error('database unavailable'); },
      delay: async () => undefined,
      now: () => new Date('2026-08-01T14:00:00.000Z'),
    }, { ...buildBulletinWorkerConfig({ BULLETIN_MONITOR_ENABLED: 'true' }), minCheckIntervalMs: 0, jitterMs: 0 });

    await expect(processor({ data: { date: '2026-08-01' } } as never)).rejects.toThrow(/1 watch/);
  });

  it('limita el standalone a un job porque la concurrencia se aplica dentro del lote', () => {
    expect(BULLETIN_WORKER_JOB_CONCURRENCY).toBe(1);
  });

  it('registra consumidor y scheduler una sola vez por identidad estable', async () => {
    const config = buildBulletinWorkerConfig({ BULLETIN_MONITOR_ENABLED: 'true' });
    const processor = vi.fn();
    const createConsumer = vi.fn(() => ({ close: vi.fn() }));
    const consumer = registerBulletinConsumer({ config, processor, createConsumer });
    expect(consumer).not.toBeNull();
    expect(createConsumer).toHaveBeenCalledWith('bulletins', processor);

    const queue = { upsertJobScheduler: vi.fn().mockResolvedValue({}) };
    await upsertBulletinScheduler(queue, config);
    await upsertBulletinScheduler(queue, config);
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(queue.upsertJobScheduler.mock.calls.map((call) => call[0])).toEqual([
      BULLETIN_SCHEDULER_ID,
      BULLETIN_SCHEDULER_ID,
    ]);
    expect(queue.upsertJobScheduler).toHaveBeenLastCalledWith(
      BULLETIN_SCHEDULER_ID,
      { pattern: config.cron, tz: config.timezone },
      { name: 'bulletin-monitor', data: { maxGroups: config.maxGroups } },
    );
  });

  it('no registra consumidor ni scheduler cuando el monitor está deshabilitado', async () => {
    const config = buildBulletinWorkerConfig({});
    const createConsumer = vi.fn();
    expect(registerBulletinConsumer({ config, processor: vi.fn(), createConsumer })).toBeNull();
    const queue = { upsertJobScheduler: vi.fn(), removeJobScheduler: vi.fn().mockResolvedValue(true) };
    expect(await upsertBulletinScheduler(queue, config)).toBe(false);
    expect(createConsumer).not.toHaveBeenCalled();
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    expect(queue.removeJobScheduler).toHaveBeenCalledWith(BULLETIN_SCHEDULER_ID);
  });

  it('integra consumidor y scheduler en el ciclo de vida del ingest worker', () => {
    const source = fs.readFileSync('worker/ingestWorker.ts', 'utf8');
    expect(source).toMatch(/registerBulletinConsumer/);
    expect(source).toMatch(/upsertBulletinScheduler/);
    expect(source).toMatch(/createTrackedWorker/);
    expect(source).toMatch(/workers\.map\(\(worker\) => worker\.close\(\)\)/);
  });

  it('documenta y propaga configuración de boletín e identidad legal en dev y prod', () => {
    const envExample = fs.readFileSync('.env.example', 'utf8');
    const composeDev = fs.readFileSync('docker-compose.yml', 'utf8');
    const composeProd = fs.readFileSync('docker-compose.prod.yml', 'utf8');
    const names = [
      'LEGAL_CASES_USER_EMAIL',
      'LEGAL_CASES_ORG_SLUG',
      'BULLETIN_MONITOR_ENABLED',
      'BULLETIN_MONITOR_CRON',
      'BULLETIN_MONITOR_TIMEZONE',
      'BULLETIN_MAX_GROUPS_PER_RUN',
      'BULLETIN_MAX_WATCHES_PER_GROUP',
      'BULLETIN_CONCURRENCY',
      'BULLETIN_MIN_CHECK_INTERVAL_MS',
      'BULLETIN_REQUEST_JITTER_MS',
      'BULLETIN_SOURCE_TIMEOUT_MS',
      'BULLETIN_MAX_RETRIES',
    ];
    for (const name of names) {
      expect(envExample, `${name} falta en .env.example`).toContain(`${name}=`);
      expect(composeDev, `${name} falta en Compose dev`).toContain(`${name}:`);
      expect(composeProd, `${name} falta en Compose prod`).toContain(`${name}:`);
    }
    expect(envExample).toMatch(/^BULLETIN_MONITOR_ENABLED=false$/m);
    expect(composeDev).toMatch(/BULLETIN_MONITOR_ENABLED:\s*\$\{BULLETIN_MONITOR_ENABLED:-false\}/);
    expect(composeProd).toMatch(/BULLETIN_MONITOR_ENABLED:\s*"\$\{BULLETIN_MONITOR_ENABLED:-false\}"/);
  });
});
