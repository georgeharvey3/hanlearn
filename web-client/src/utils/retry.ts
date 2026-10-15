/**
 * Retry a request that failed because the network dropped it.
 *
 * On a patchy mobile connection a single request can fail outright: Safari
 * reports "Load failed", and a Firebase callable reports `functions/internal`
 * because it got no response at all (HTTP status 0). Asking once more usually
 * succeeds. Any other error is thrown straight away, since asking again would
 * only fail the same way.
 */

const TRANSIENT_CODES = new Set([
  'functions/internal',
  'functions/unavailable',
  'functions/deadline-exceeded',
]);

// What each browser's fetch says when the request never got a response.
const NETWORK_MESSAGES = [
  /load failed/i,
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
];

export function isTransientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true;
  return typeof message === 'string' && NETWORK_MESSAGES.some((pattern) => pattern.test(message));
}

export async function retryTransient<T>(
  request: () => Promise<T>,
  { retries = 1, delayMs = 800 }: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (attempt >= retries || !isTransientError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}
