/** Waits between attempts: three attempts in total, then the caller keeps the intent. */
export const WRITE_RETRY_DELAYS_MS: readonly number[] = [300, 1500];

/**
 * Runs a storage write, retrying a bounded number of times. Rejects with the
 * last error once the retries are spent or when the error is not retryable.
 */
export async function writeWithRetry(
  write: () => Promise<void>,
  isRetryable: (error: unknown) => boolean = () => true
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await write();
    } catch (error) {
      if (attempt >= WRITE_RETRY_DELAYS_MS.length || !isRetryable(error)) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, WRITE_RETRY_DELAYS_MS[attempt])
      );
    }
  }
}
