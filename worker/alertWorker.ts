import { Job } from 'bullmq';
import { evaluateAlertsForItem } from '../lib/alerts/evaluateAlerts';

export async function processAlertJob(job: Job) {
  const itemId = job.data?.itemId;
  
  if (!itemId) {
    throw new Error('itemId is required for alert job');
  }

  console.log(`Evaluating alerts for Item: ${itemId}`);
  
  const result = await evaluateAlertsForItem(itemId);
  
  return {
    ok: true,
    queue: 'alerts',
    job: job.name,
    itemId,
    matches: result.matches
  };
}
