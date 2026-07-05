export interface ExpandedQuery {
  alternativeTerms: string[];
  relatedAuthorities: Array<{ name: string; relevance: string }>;
  legalTopics: string[];
  documentTypes: string[];
  officialSources: Array<{ domain: string; name: string; searchQuery: string }>;
}

export interface ExternalSearchResult {
  title: string;
  url: string;
  date: string;
  excerpt: string;
  type: string;
  sourceName: string;
}

export interface ExternalResult {
  source: string;
  results: ExternalSearchResult[];
}

export interface LocalResult {
  title: string;
  source: string;
  type: string;
  publishedAt: string | null;
  lastModifiedAt: string | null;
  status: "nuevo" | "modificado" | "sin cambios" | "desconocido";
  matches: number;
  excerpt: string;
  officialUrl: string;
  score: number;
}

export interface WeeklyChange {
  title: string;
  changeType: string;
  changedAt: string;
  affectedSections: string[];
  summary: string;
}

export interface APIResponse {
  ok: boolean;
  query: string;
  expandedQuery: {
    alternativeTerms: string[];
    relatedAuthorities: Array<{ name: string; relevance: string }>;
    officialSources: Array<{ domain: string; name: string }>;
  };
  localResults: LocalResult[];
  weeklyChanges: WeeklyChange[];
  externalResults: ExternalResult[];
  aiAnalysis: {
    summary: string;
    legalImpact: string;
    attentionPoints: string[];
    provider: string;
    model: string;
    usedFallback: boolean;
  } | null;
  warnings: string[];
  radarStatus: "success" | "partial";
  sourcesConsulted: string[];
  attempts: any;
  debug: {
    localDocumentsFound: number;
    weeklyChangesFound: number;
    externalSourcesQueried: string[];
    llmCalled: boolean;
  };
}
