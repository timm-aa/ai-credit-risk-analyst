export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delayMs: number; label: string }
): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= options.retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < options.retries) {
        await new Promise((r) => setTimeout(r, options.delayMs * (i + 1)));
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
