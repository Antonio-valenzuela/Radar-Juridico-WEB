export type TimeoutOutcome<T> =
  | { status: "completed"; value: T; durationMs: number }
  | { status: "timed_out"; durationMs: number }
  | { status: "failed"; error: Error; durationMs: number };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function withTimeoutOutcome<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<TimeoutOutcome<T>> {
  const startedAt = Date.now();

  if (timeoutMs <= 0) {
    try {
      const value = await promise;
      return { status: "completed", value, durationMs: Date.now() - startedAt };
    } catch (error) {
      return { status: "failed", error: toError(error), durationMs: Date.now() - startedAt };
    }
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<"__timeout__">((resolve) => {
      timeout = setTimeout(() => resolve("__timeout__"), timeoutMs);
    });

    const result = await Promise.race([promise, timeoutPromise]);
    if (result === "__timeout__") {
      promise.catch(() => undefined);
      return { status: "timed_out", durationMs: Date.now() - startedAt };
    }

    return { status: "completed", value: result as T, durationMs: Date.now() - startedAt };
  } catch (error) {
    return { status: "failed", error: toError(error), durationMs: Date.now() - startedAt };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
