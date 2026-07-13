export type RevenueCatOperationBarrier = ReturnType<typeof createRevenueCatOperationBarrier>;

/**
 * Tracks every native RevenueCat operation that can touch the configured
 * subscriber. `block` is synchronous, so an operation either registers in the
 * same JavaScript turn that starts it or is refused before native work begins.
 */
export function createRevenueCatOperationBarrier(blocked: () => boolean) {
  const active = new Set<Promise<unknown>>();

  function run<T>(operation: () => T | Promise<T>): Promise<T> | null {
    if (blocked()) return null;

    let value: T | Promise<T>;
    try {
      value = operation();
    } catch (error) {
      return Promise.reject(error);
    }

    const pending = Promise.resolve(value);
    active.add(pending);
    void pending.then(
      () => active.delete(pending),
      () => active.delete(pending),
    );
    return pending;
  }

  async function waitForSettled(): Promise<void> {
    // Once account deletion has synchronously blocked new work, the set can
    // only shrink. Looping also makes this primitive safe for other callers.
    while (active.size > 0) {
      await Promise.allSettled([...active]);
    }
  }

  return {
    activeCount: () => active.size,
    run,
    waitForSettled,
  };
}
