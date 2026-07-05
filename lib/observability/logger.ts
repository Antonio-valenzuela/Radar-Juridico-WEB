export function logInfo(event: string, payload?: Record<string, any>) {
  if (process.env.NODE_ENV === 'test') return;
  console.log(JSON.stringify({ level: 'info', event, timestamp: new Date().toISOString(), ...payload }));
}

export function logError(event: string, error: any, payload?: Record<string, any>) {
  if (process.env.NODE_ENV === 'test') return;
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(JSON.stringify({ level: 'error', event, errorMessage, stack, timestamp: new Date().toISOString(), ...payload }));
}

export function logWarn(event: string, payload?: Record<string, any>) {
  if (process.env.NODE_ENV === 'test') return;
  console.warn(JSON.stringify({ level: 'warn', event, timestamp: new Date().toISOString(), ...payload }));
}

export function logMetric(event: string, durationMs: number, payload?: Record<string, any>) {
  if (process.env.NODE_ENV === 'test') return;
  console.log(JSON.stringify({ level: 'metric', event, durationMs, timestamp: new Date().toISOString(), ...payload }));
}
