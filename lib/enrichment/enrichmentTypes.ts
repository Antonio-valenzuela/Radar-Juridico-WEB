import { LegalMatter, LegalImpactLevel } from "../ai/types";

export interface ItemAiEnrichmentData {
  matter: LegalMatter;
  authority: string | null;
  entities: string[];
  affectedSectors: string[];
  keywords: string[];
  relatedTopics: string[];
  impactLevel: LegalImpactLevel;
  executiveSummary: string;
  explanation: string;
  provider: string;
  confidence: number;
}
