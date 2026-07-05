import { Job } from 'bullmq';
import { createWeeklyDigest } from '../lib/digest/storeDigest';

export async function processDigestJob(job: Job) {
  const days = job.data?.days || 7;
  
  console.log(`Generating weekly digest for past ${days} days...`);
  
  const result = await createWeeklyDigest(days);
  
  return {
    ok: true,
    queue: 'digest',
    job: job.name,
    digestId: result.digestId,
    skipped: result.skipped
  };
}
