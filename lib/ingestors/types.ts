export interface IngestorParams {
  days?: number;
  from?: Date;
  to?: Date;
}

export interface IngestorResult {
  source: string;
  ok: boolean;
  found: number;
  saved: number;
  errors: string[];
  sample?: { title: string; url: string }[];
}
