import { prisma } from '../prisma';
import { generateWeeklyDigest } from '../ai/weeklyDigest';

export async function createWeeklyDigest(days: number = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  // Check if a digest for this exact period already exists
  const existing = await prisma.weeklyDigest.findFirst({
    where: {
      startDate: { gte: startDate },
      endDate: { lte: endDate }
    }
  });

  if (existing) {
    return { ok: true, digestId: existing.id, skipped: true };
  }

  // Fetch documents for the period
  const items = await prisma.item.findMany({
    where: { published: { gte: startDate, lte: endDate } },
    select: {
      id: true,
      title: true,
      source: true,
      tema: true,
      impacto: true
    }
  });

  if (items.length === 0) {
    return { ok: true, skipped: true, reason: 'No items in period' };
  }

  // Map to the format expected by generateWeeklyDigest
  const documents = items.map(item => ({
    id: item.id,
    title: item.title,
    source: item.source,
    matter: item.tema || undefined,
    impactLevel: item.impacto || undefined
  }));

  const digestResult = generateWeeklyDigest({
    documents,
    periodStart: startDate,
    periodEnd: endDate
  });

  const contentStr = JSON.stringify(digestResult);

  const digest = await prisma.weeklyDigest.create({
    data: {
      startDate,
      endDate,
      content: contentStr
    }
  });

  return { ok: true, digestId: digest.id, skipped: false };
}
