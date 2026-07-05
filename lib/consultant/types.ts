export type ConsultantReport = {
  executiveSummary: string;
  keyChanges: string[];
  affectedParties: string[];
  actionItems: string[];
  riskFlags: string[];
  followUpQuestions: string[];
  confidence: "alta" | "media" | "baja";
  provider: string;
  model: string;
  promptVersion: string;
};

export type ConsultantInputChange = {
  articleId?: string;
  title?: string;
  changeType?: string;
  beforePreview?: string | null;
  afterPreview?: string | null;
};
