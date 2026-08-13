export type AuthMutationFence = {
  runExclusive: <T>(operation: () => T | Promise<T>) => Promise<T>;
};

/**
 * Serializes every explicit owner/session mutation made by AuthProvider.
 * Registration happens synchronously, while execution follows FIFO order.
 * Provider prompts intentionally stay outside this fence; only the SDK
 * mutation is fenced so a newer auth intent cannot enter auth-js while it is
 * internally capturing or saving a session.
 */
export function createAuthMutationFence(): AuthMutationFence {
  let tail: Promise<void> = Promise.resolve();

  return {
    runExclusive<T>(operation: () => T | Promise<T>): Promise<T> {
      const result = tail.then(operation, operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}
