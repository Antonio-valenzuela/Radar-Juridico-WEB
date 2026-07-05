import { logMetric } from './logger';

export async function withMetrics<T>(
  event: string, 
  operation: () => Promise<T>, 
  payload?: Record<string, any>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    logMetric(event, Date.now() - start, { ...payload, status: 'success' });
    return result;
  } catch (error) {
    logMetric(event, Date.now() - start, { ...payload, status: 'error' });
    throw error;
  }
}
