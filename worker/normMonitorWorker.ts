import { prisma } from '@/lib/prisma';
import { importNormSnapshot } from '@/lib/norms/normSnapshotImporter';

export interface NormMonitorItemResult {
  normId: string;
  status:
    | 'verified'
    | 'unchanged'
    | 'manual_review'
    | 'session_required'
    | 'failed';
  changed: boolean;
  previousHash?: string | null;
  newHash?: string;
  error?: string;
}

interface NormChangeAlertInput {
  normId: string;
  normName: string;
  previousHash: string | null;
  newHash: string;
}

export const buildNormChangeAlert = (input: NormChangeAlertInput) => {
  if (!input.previousHash || input.previousHash === input.newHash) return null;
  return {
    level: 'warning',
    title: `Cambio detectado en ${input.normName}`,
    description:
      'La fuente oficial cambió de hash. Revisa la nueva versión antes de aplicar el contenido al expediente.',
  };
};

export const shouldRetryNormMonitor = (
  results: NormMonitorItemResult[]
): boolean => results.some((result) => result.status === 'failed');

const createMatterAlerts = async (input: {
  normId: string;
  normName: string;
  matter: string | null;
  previousHash: string | null;
  newHash: string;
}) => {
  if (!input.matter) return 0;
  const alert = buildNormChangeAlert(input);
  if (!alert) return 0;

  const matters = await prisma.matter.findMany({
    where: { status: 'open', matter: input.matter },
    select: { id: true },
  });
  if (matters.length === 0) return 0;

  const created = await prisma.caseAlert.createMany({
    data: matters.map((matter) => ({
      matterId: matter.id,
      ...alert,
    })),
  });
  return created.count;
};

export async function runNormMonitor(): Promise<{
  checked: number;
  changed: number;
  errors: number;
  alertsCreated: number;
  results: NormMonitorItemResult[];
}> {
  const norms = await prisma.norma.findMany({
    where: {
      urlBase: { not: null },
      monitoringStatus: { not: 'archived' },
    },
    select: {
      id: true,
      nombre: true,
      matter: true,
      urlBase: true,
      currentHash: true,
    },
  });

  const results: NormMonitorItemResult[] = [];
  let alertsCreated = 0;

  for (const norm of norms) {
    if (!norm.urlBase) continue;
    const imported = await importNormSnapshot({
      normId: norm.id,
      sourceUrl: norm.urlBase,
      versionLabel: 'Huella verificada de fuente oficial',
    });
    const result: NormMonitorItemResult = {
      normId: norm.id,
      status: imported.status,
      changed: imported.changed,
      previousHash: norm.currentHash,
      newHash: imported.contentHash,
      error: imported.success ? undefined : imported.message,
    };
    results.push(result);

    if (imported.changed && imported.contentHash) {
      alertsCreated += await createMatterAlerts({
        normId: norm.id,
        normName: norm.nombre,
        matter: norm.matter,
        previousHash: norm.currentHash,
        newHash: imported.contentHash,
      });
    }
  }

  return {
    checked: results.length,
    changed: results.filter((result) => result.changed).length,
    errors: results.filter((result) => result.status === 'failed').length,
    alertsCreated,
    results,
  };
}
