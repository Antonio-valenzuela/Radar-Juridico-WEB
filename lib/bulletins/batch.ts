export type BulletinBatchWatch = {
  id: string;
  provider: string;
  providerId?: string | null;
  expedienteNumber: string;
  expedienteYear?: number | null;
  matterLabel?: string | null;
  judicialDistrict?: string | null;
  court?: string | null;
};

export type BulletinBatchGroup<T extends BulletinBatchWatch = BulletinBatchWatch> = {
  key: string;
  provider: string;
  matter: string;
  judicialDistrict: string;
  court: string;
  date: string;
  watches: T[];
  expedienteIndex: Map<string, T[]>;
};

export type BulletinBatchPlan<T extends BulletinBatchWatch = BulletinBatchWatch> = {
  groups: Array<BulletinBatchGroup<T>>;
  totalWatches: number;
  includedWatches: number;
  droppedWatches: number;
  truncated: boolean;
};

export type BulletinBatchOptions = {
  date: string;
  maxGroups: number;
  maxWatchesPerGroup: number;
};

export type BulletinExpedienteLike = {
  expedienteNumber: string;
  expedienteYear?: number | null;
};

const displayText = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || '';

const keyText = (value: string | null | undefined) => displayText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const positiveLimit = (value: number) => Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1));

export function normalizeBulletinExpediente(value: string) {
  const compact = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '/');
  const match = compact.match(/^([A-Z]*)(\d+)\/(\d{2}|\d{4})$/);
  if (!match) return compact;
  const [, prefix, serial, rawYear] = match;
  const normalizedSerial = serial.replace(/^0+(?=\d)/, '');
  const normalizedYear = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${prefix}${normalizedSerial}/${normalizedYear}`;
}

export function bulletinExpedienteKey(value: BulletinExpedienteLike) {
  const normalizedNumber = normalizeBulletinExpediente(value.expedienteNumber);
  return value.expedienteYear && !/\/\d{4}$/.test(normalizedNumber)
    ? `${normalizedNumber}/${value.expedienteYear}`
    : normalizedNumber;
}

export function createBulletinResultIndex<T extends BulletinExpedienteLike>(results: T[]) {
  const index = new Map<string, T[]>();
  for (const result of results) {
    const key = bulletinExpedienteKey(result);
    const matches = index.get(key) || [];
    matches.push(result);
    index.set(key, matches);
  }
  return index;
}

export function createBulletinBatchPlan<T extends BulletinBatchWatch>(
  watches: T[],
  options: BulletinBatchOptions,
): BulletinBatchPlan<T> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error('La fecha del lote debe usar YYYY-MM-DD.');
  }
  const maxGroups = positiveLimit(options.maxGroups);
  const maxWatchesPerGroup = positiveLimit(options.maxWatchesPerGroup);
  const groups: Array<BulletinBatchGroup<T>> = [];
  const groupsByKey = new Map<string, BulletinBatchGroup<T>>();
  let includedWatches = 0;

  for (const watch of watches) {
    const key = [
      keyText(watch.provider),
      keyText(watch.providerId),
      keyText(watch.matterLabel),
      keyText(watch.judicialDistrict),
      keyText(watch.court),
      options.date,
    ].join('|');
    let group = groupsByKey.get(key);
    if (!group) {
      if (groups.length >= maxGroups) continue;
      group = {
        key,
        provider: displayText(watch.provider),
        matter: displayText(watch.matterLabel),
        judicialDistrict: displayText(watch.judicialDistrict),
        court: displayText(watch.court),
        date: options.date,
        watches: [],
        expedienteIndex: new Map<string, T[]>(),
      };
      groups.push(group);
      groupsByKey.set(key, group);
    }
    if (group.watches.length >= maxWatchesPerGroup) continue;
    group.watches.push(watch);
    includedWatches += 1;
    const expediente = bulletinExpedienteKey(watch);
    const indexed = group.expedienteIndex.get(expediente) || [];
    indexed.push(watch);
    group.expedienteIndex.set(expediente, indexed);
  }

  const droppedWatches = watches.length - includedWatches;
  return {
    groups,
    totalWatches: watches.length,
    includedWatches,
    droppedWatches,
    truncated: droppedWatches > 0,
  };
}
