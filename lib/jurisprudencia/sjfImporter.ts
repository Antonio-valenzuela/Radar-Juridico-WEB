import { prisma } from '@/lib/prisma';
import {
  checkSourceHealth,
  type SourceHealthResult,
} from '@/lib/sources/sourceHealth';
import {
  normalizeOfficialSjfRecord,
  type JurisprudenciaData,
} from '@/lib/jurisprudencia/validation';

export interface SJFImportParams {
  records?: Array<Record<string, unknown>>;
}

export interface ImportResult {
  success: boolean;
  status:
    | 'imported'
    | 'browser_required'
    | 'payload_required'
    | 'failed';
  message?: string;
  importedCount: number;
  rejectedCount: number;
}

interface ImportDependencies {
  checkHealth?: () => Promise<SourceHealthResult>;
  persist?: (record: JurisprudenciaData) => Promise<void>;
}

const defaultHealthCheck = () =>
  checkSourceHealth({
    adapter: 'SJF',
    baseUrl: 'https://sjf2.scjn.gob.mx/',
    healthUrl: 'https://sjf2.scjn.gob.mx/',
    requiresBrowser: true,
  });

const defaultPersist = async (record: JurisprudenciaData): Promise<void> => {
  if (!record.registroDigital) return;
  await prisma.jurisprudencia.upsert({
    where: { registroDigital: record.registroDigital },
    update: record,
    create: record,
  });
};

export const importFromSJF = async (
  params: SJFImportParams,
  dependencies: ImportDependencies = {}
): Promise<ImportResult> => {
  try {
    const health = await (dependencies.checkHealth || defaultHealthCheck)();
    if (
      health.status === 'BROWSER_REQUIRED' ||
      health.status === 'BLOCKED_BY_PROVIDER' ||
      health.status === 'WARNING_ACCESSIBLE_WITH_LIMITATIONS'
    ) {
      return {
        success: false,
        status: 'browser_required',
        message:
          'SJF requiere consulta desde navegador o sesión autorizada; no se intentó eludir la protección.',
        importedCount: 0,
        rejectedCount: 0,
      };
    }
    if (health.status !== 'OK') {
      return {
        success: false,
        status: 'failed',
        message: health.message,
        importedCount: 0,
        rejectedCount: 0,
      };
    }

    const normalized = (params.records || [])
      .slice(0, 100)
      .map(normalizeOfficialSjfRecord);
    const validRecords = normalized.flatMap((record) =>
      record.valid ? [record.data] : []
    );
    const rejectedCount = normalized.length - validRecords.length;
    if (validRecords.length === 0) {
      return {
        success: false,
        status: 'payload_required',
        message:
          'No se recibió un payload oficial completo y verificable; no se guardó ningún criterio.',
        importedCount: 0,
        rejectedCount,
      };
    }

    const persist = dependencies.persist || defaultPersist;
    for (const record of validRecords) {
      await persist(record);
    }

    return {
      success: true,
      status: 'imported',
      importedCount: validRecords.length,
      rejectedCount,
    };
  } catch {
    return {
      success: false,
      status: 'failed',
      message: 'No fue posible importar criterios desde SJF.',
      importedCount: 0,
      rejectedCount: 0,
    };
  }
};
