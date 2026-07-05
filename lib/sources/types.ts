export const SOURCE_NAMES = [
  "SIDOF",
  "DIPUTADOS",
  "SCJN_SJF",
  "SCJN_LEG",
  "SENADO_GACETA",
] as const;

export type SourceName = (typeof SOURCE_NAMES)[number] | string;

export type SourcePriority = 1 | 2;

export type SourceCheckpoint = {
  source: SourceName;
  cursor: string | null;
  lastPublishedAt: Date | null;
};

export type SourceFetchParams = {
  source: SourceName;
  days?: number;
  limit?: number;
  checkpoint?: SourceCheckpoint | null;
};

export type RawSourceItem = {
  source: SourceName;
  sourceId: string;
  title: string;
  url: string;
  canonicalUrl?: string;
  published: Date;
  summary?: string | null;
  tipo?: string | null;
  tema?: string | null;
  impacto?: "alto" | "medio" | "bajo" | null;
  keywordsHit?: string[];
  rawRef?: string | null;
  raw?: Record<string, unknown>;
};

export type SourceFetchResult = {
  source: SourceName;
  ok: boolean;
  found: number;
  items: RawSourceItem[];
  cursor?: string | null;
  errors: string[];
};

export type SourceModule = {
  name: SourceName;
  priority: SourcePriority;
  fetchItems(params: SourceFetchParams): Promise<SourceFetchResult>;
};
