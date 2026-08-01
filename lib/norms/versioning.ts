import { createHash } from 'node:crypto';
import { isOfficialLegalSourceUrl } from '@/lib/legal/officialSourceUrl';

export interface NormArticleSnapshot {
  articleNumber: string;
  heading: string | null;
  text: string;
  sourceUrl: string;
}

interface NormSnapshotInput {
  previousHash: string | null;
  contentHash: string;
  sourceUrl: string;
  text: string | null;
  publishedAt: Date | null;
  versionLabel: string | null;
}

export interface NormSnapshotPlan {
  changed: boolean;
  version: {
    hash: string;
    text: string | null;
    sourceUrl: string;
    publishedAt: Date | null;
    versionLabel: string | null;
  } | null;
  articles: NormArticleSnapshot[];
}

interface NormSnapshotVerificationInput {
  changed: boolean;
  tlsRelaxed: boolean;
  extractionWarning: string | null;
}

export interface NormSnapshotVerificationClassification {
  verificationStatus: 'verified' | 'manual_review';
  resultStatus: 'verified' | 'unchanged' | 'manual_review';
  warning: string | null;
}

export const classifyNormSnapshotVerification = (
  input: NormSnapshotVerificationInput
): NormSnapshotVerificationClassification => {
  const warning = input.tlsRelaxed
    ? 'La fuente requirió validación TLS limitada.'
    : input.extractionWarning;
  const verificationStatus = warning ? 'manual_review' : 'verified';

  return {
    verificationStatus,
    resultStatus: warning
      ? 'manual_review'
      : input.changed
        ? 'verified'
        : 'unchanged',
    warning,
  };
};

export const computeContentHash = (content: Uint8Array | string): string =>
  createHash('sha256').update(content).digest('hex');

export const extractNormArticles = (
  text: string,
  sourceUrl = ''
): NormArticleSnapshot[] => {
  if (!text.trim()) return [];

  const heading =
    /(?:^|\n)\s*Art(?:ículo|\.)\s+([0-9]+(?:[-A-Za-zÁÉÍÓÚÑáéíóúñ]+|\s+(?:Bis|Ter|Quáter))?)[.\-°º\s]*(.*?)(?=(?:\n\s*Art(?:ículo|\.)\s+[0-9])|$)/gi;
  const articles: NormArticleSnapshot[] = [];
  let match: RegExpExecArray | null;

  while ((match = heading.exec(text)) !== null) {
    const articleNumber = match[1].replace(/\s+/g, ' ').trim();
    const articleText = match[2].trim();
    if (!articleNumber || !articleText) continue;
    articles.push({
      articleNumber,
      heading: null,
      text: articleText,
      sourceUrl,
    });
  }

  return articles;
};

export const buildNormSnapshotPlan = (
  input: NormSnapshotInput
): NormSnapshotPlan => {
  if (input.previousHash === input.contentHash) {
    return { changed: false, version: null, articles: [] };
  }

  return {
    changed: true,
    version: {
      hash: input.contentHash,
      text: input.text,
      sourceUrl: input.sourceUrl,
      publishedAt: input.publishedAt,
      versionLabel: input.versionLabel,
    },
    articles: input.text
      ? extractNormArticles(input.text, input.sourceUrl)
      : [],
  };
};

interface ComparableNormArticle {
  articleNumber: string;
  text: string;
}

export interface NormArticleComparison {
  articleNumber: string;
  status: 'added' | 'removed' | 'modified';
  before: string | null;
  after: string | null;
}

export const compareNormArticles = (
  fromArticles: ComparableNormArticle[],
  toArticles: ComparableNormArticle[]
): NormArticleComparison[] => {
  const before = new Map(
    fromArticles.map((article) => [article.articleNumber, article.text.trim()])
  );
  const after = new Map(
    toArticles.map((article) => [article.articleNumber, article.text.trim()])
  );
  const articleNumbers = [...new Set([...before.keys(), ...after.keys()])].sort(
    (left, right) =>
      left.localeCompare(right, 'es-MX', { numeric: true, sensitivity: 'base' })
  );

  return articleNumbers.flatMap<NormArticleComparison>((articleNumber) => {
    const previousText = before.get(articleNumber);
    const currentText = after.get(articleNumber);
    if (previousText === currentText) return [];
    if (previousText === undefined) {
      return [
        {
          articleNumber,
          status: 'added',
          before: null,
          after: currentText || null,
        },
      ];
    }
    if (currentText === undefined) {
      return [
        {
          articleNumber,
          status: 'removed',
          before: previousText,
          after: null,
        },
      ];
    }
    return [
      {
        articleNumber,
        status: 'modified',
        before: previousText,
        after: currentText,
      },
    ];
  });
};

interface VerifiedReformInput {
  publicationDate: Date | null;
  officialUrl: string;
  articlesChanged: string[];
}

export const validateVerifiedReformInput = (
  input: VerifiedReformInput
): { valid: true } | { valid: false; error: string } => {
  if (
    !input.publicationDate ||
    Number.isNaN(input.publicationDate.getTime())
  ) {
    return {
      valid: false,
      error: 'Se requiere una fecha de publicación verificada.',
    };
  }
  if (!isOfficialLegalSourceUrl(input.officialUrl)) {
    return {
      valid: false,
      error: 'Se requiere una URL oficial permitida.',
    };
  }
  if (
    input.articlesChanged.length === 0 ||
    input.articlesChanged.some((article) => !article.trim())
  ) {
    return {
      valid: false,
      error: 'Se requiere identificar los artículos modificados.',
    };
  }
  return { valid: true };
};
