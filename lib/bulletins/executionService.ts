import { prisma } from '@/lib/prisma';
import { queryJaliscoBulletin } from '@/lib/bulletins/adapters/jalisco';
import { queryFederalBulletin } from '@/lib/bulletins/adapters/federal';
import { queryCjfBulletin } from '@/lib/bulletins/adapters/cjf';
import type { BulletinAdapterResult, BulletinParsedEntry, BulletinQuery } from '@/lib/bulletins/types';

export type SubscriptionExecutionResult = {
  ok: boolean;
  queryStatus: string;
  publicationStatus: string;
  totalChecked: number;
  newMatches: number;
  warnings: string[];
  lastRunAt: Date;
  nextRunAt: Date;
};

export function calculateNextRunDate(frequency: string, baseDate = new Date()): Date {
  const next = new Date(baseDate.getTime());
  switch (frequency) {
    case 'cada_6_horas':
      next.setHours(next.getHours() + 6);
      break;
    case 'cada_12_horas':
      next.setHours(next.getHours() + 12);
      break;
    case 'semanal':
      next.setDate(next.getDate() + 7);
      break;
    case 'diario':
    default:
      next.setDate(next.getDate() + 1);
      break;
  }
  return next;
}

export function matchSubscriptionEntry(
  subscription: {
    expediente?: string | null;
    actor?: string | null;
    demandado?: string | null;
    juzgado?: string | null;
    abogado?: string | null;
    keywords?: any;
  },
  entry: BulletinParsedEntry
): { isMatch: boolean; reasons: string[]; matchedFields: Record<string, string>; score: number } {
  const reasons: string[] = [];
  const matchedFields: Record<string, string> = {};
  let score = 0;

  const fullText = [
    entry.expedienteNumber,
    entry.court,
    entry.heading,
    entry.extract,
    typeof entry.parties === 'string' ? entry.parties : JSON.stringify(entry.parties || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Match Expediente
  if (subscription.expediente) {
    const expNorm = subscription.expediente.trim().toLowerCase();
    if (fullText.includes(expNorm)) {
      reasons.push(`Coincidencia en expediente: ${subscription.expediente}`);
      matchedFields.expediente = subscription.expediente;
      score += 0.4;
    }
  }

  // Match Actor
  if (subscription.actor) {
    const actorNorm = subscription.actor.trim().toLowerCase();
    if (fullText.includes(actorNorm)) {
      reasons.push(`Coincidencia en actor: ${subscription.actor}`);
      matchedFields.actor = subscription.actor;
      score += 0.3;
    }
  }

  // Match Demandado
  if (subscription.demandado) {
    const demNorm = subscription.demandado.trim().toLowerCase();
    if (fullText.includes(demNorm)) {
      reasons.push(`Coincidencia en demandado: ${subscription.demandado}`);
      matchedFields.demandado = subscription.demandado;
      score += 0.3;
    }
  }

  // Match Juzgado
  if (subscription.juzgado) {
    const juzNorm = subscription.juzgado.trim().toLowerCase();
    if (fullText.includes(juzNorm)) {
      reasons.push(`Coincidencia en órgano/juzgado: ${subscription.juzgado}`);
      matchedFields.juzgado = subscription.juzgado;
      score += 0.2;
    }
  }

  // Match Abogado
  if (subscription.abogado) {
    const abogNorm = subscription.abogado.trim().toLowerCase();
    if (fullText.includes(abogNorm)) {
      reasons.push(`Coincidencia en abogado: ${subscription.abogado}`);
      matchedFields.abogado = subscription.abogado;
      score += 0.2;
    }
  }

  // Match Keywords
  const keywordsList: string[] = Array.isArray(subscription.keywords)
    ? subscription.keywords
    : typeof subscription.keywords === 'string'
    ? subscription.keywords.split(',').map((k) => k.trim())
    : [];

  const matchedKeywords: string[] = [];
  for (const kw of keywordsList) {
    if (kw && fullText.includes(kw.toLowerCase())) {
      matchedKeywords.push(kw);
    }
  }

  if (matchedKeywords.length > 0) {
    reasons.push(`Coincidencia en palabras clave: ${matchedKeywords.join(', ')}`);
    matchedFields.keywords = matchedKeywords.join(', ');
    score += 0.2 * matchedKeywords.length;
  }

  // If no specific criteria were provided, matched by default if entry exists
  const hasSpecificCriteria =
    subscription.expediente ||
    subscription.actor ||
    subscription.demandado ||
    subscription.juzgado ||
    subscription.abogado ||
    keywordsList.length > 0;

  const isMatch = hasSpecificCriteria ? score > 0 : true;
  if (!hasSpecificCriteria) {
    reasons.push('Nuevas publicaciones registradas para el juzgado');
    score = 1.0;
  }

  return {
    isMatch,
    reasons,
    matchedFields,
    score: Math.min(Math.round(score * 100) / 100, 1.0),
  };
}

export async function executeSubscriptionCheck(subscription: any): Promise<SubscriptionExecutionResult> {
  const now = new Date();
  const sourceSlug = subscription.source?.slug || 'boletin-jalisco';

  const query: BulletinQuery = {
    sourceSlug,
    expedienteNumber: subscription.expediente || undefined,
    court: subscription.juzgado || undefined,
    matter: subscription.juzgado || undefined,
  };

  let adapterResult: BulletinAdapterResult;

  if (sourceSlug.includes('jalisco')) {
    adapterResult = await queryJaliscoBulletin(query);
  } else if (sourceSlug.includes('federal')) {
    adapterResult = await queryFederalBulletin(query);
  } else if (sourceSlug.includes('cjf')) {
    adapterResult = await queryCjfBulletin(query);
  } else {
    adapterResult = await queryJaliscoBulletin(query);
  }

  let newMatchesCount = 0;

  if (adapterResult.results && adapterResult.results.length > 0) {
    for (const entry of adapterResult.results) {
      const { isMatch, reasons, matchedFields, score } = matchSubscriptionEntry(subscription, entry);

      if (isMatch) {
        const publicationId = (entry as any).dedupeKey || `pub-${subscription.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const existingMatch = await prisma.bulletinMatch.findFirst({
          where: {
            subscriptionId: subscription.id,
            publicationId,
          },
        });

        if (!existingMatch) {
          await prisma.bulletinMatch.create({
            data: {
              subscriptionId: subscription.id,
              publicationId,
              publicationTitle: entry.heading || `Publicación ${entry.expedienteNumber}`,
              publicationExtract: entry.extract || entry.heading || '',
              publicationUrl: entry.sourceUrl,
              publicationDate: entry.publicationDate || now,
              court: entry.court || subscription.juzgado || 'Juzgado Oficial',
              expediente: entry.expedienteNumber || subscription.expediente || 'N/A',
              matchReason: reasons.join('; '),
              matchedFields,
              score,
              seenAt: now,
              notifiedAt: now,
            },
          });

          newMatchesCount++;

          // Create CaseAlert notification inside Jurídico Radar
          try {
            const alert = await prisma.userAlert.upsert({
              where: { id: `alert-sub-${subscription.id}` },
              create: {
                id: `alert-sub-${subscription.id}`,
                userId: subscription.userId || 'system-user',
                keywords: Array.isArray(subscription.keywords) ? subscription.keywords : [],
              },
              update: {},
            });

            await prisma.alertNotification.create({
              data: {
                alertId: alert.id,
                title: `🚨 Coincidencia en Boletín: ${entry.expedienteNumber || 'Nuevas publicaciones'}`,
                summary: `${reasons.join('. ')}. Publicación en ${entry.court || 'Juzgado'}: ${entry.heading?.slice(0, 150) || 'Sin título'}`,
                relevance: score,
              },
            });
          } catch {
            // Ignore alert notification errors gracefully
          }
        }
      }
    }
  }

  const nextRunAt = calculateNextRunDate(subscription.frequency, now);

  await prisma.bulletinSubscription.update({
    where: { id: subscription.id },
    data: {
      lastRunAt: now,
      nextRunAt,
      lastQueryStatus: adapterResult.queryStatus,
      lastErrorMessage: adapterResult.warnings?.join(' ') || null,
    },
  });

  return {
    ok: true,
    queryStatus: adapterResult.queryStatus,
    publicationStatus: adapterResult.publicationStatus,
    totalChecked: adapterResult.results?.length || 0,
    newMatches: newMatchesCount,
    warnings: adapterResult.warnings || [],
    lastRunAt: now,
    nextRunAt,
  };
}
