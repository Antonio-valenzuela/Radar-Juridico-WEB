import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQueueSnapshots } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [activeSubscriptionsCount, pausedSubscriptionsCount, totalMatchesCount, unreviewedMatchesCount, queueSnapshots] = await Promise.all([
      prisma.bulletinSubscription.count({ where: { status: 'active' } }).catch(() => 0),
      prisma.bulletinSubscription.count({ where: { status: 'paused' } }).catch(() => 0),
      prisma.bulletinMatch.count().catch(() => 0),
      prisma.bulletinMatch.count({ where: { reviewed: false } }).catch(() => 0),
      getQueueSnapshots().catch(() => []),
    ]);

    const bulletinQueue = queueSnapshots.find((q) => q.name === 'bulletins' || q.name === 'bulletin-monitor');

    return NextResponse.json({
      ok: true,
      status: {
        activeSubscriptions: activeSubscriptionsCount,
        pausedSubscriptions: pausedSubscriptionsCount,
        totalMatches: totalMatchesCount,
        unreviewedMatches: unreviewedMatchesCount,
        queue: bulletinQueue ? {
          name: bulletinQueue.name,
          counts: bulletinQueue.counts,
          totalJobs: bulletinQueue.size,
        } : { name: 'bulletin-monitor', counts: { active: 0, waiting: 0, completed: 0, failed: 0 }, totalJobs: 0 },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Error al consultar estado del servicio de boletines.' },
      { status: 500 }
    );
  }
}
