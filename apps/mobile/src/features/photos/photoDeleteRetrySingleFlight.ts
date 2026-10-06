export type PhotoDeleteRetryPromiseRef = {
  current: Promise<void> | null;
};

export function runPhotoDeleteRetrySingleFlight(
  promiseRef: PhotoDeleteRetryPromiseRef,
  operation: () => Promise<void>,
): Promise<void> {
  if (promiseRef.current) return promiseRef.current;

  // Reserve the flight before invoking user code: synchronous throws and
  // re-entrant retry callbacks must not leave a stuck or duplicate attempt.
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const operationPromise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  promiseRef.current = operationPromise;
  void (async () => {
    try {
      await operation();
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      if (promiseRef.current === operationPromise) promiseRef.current = null;
    }
  })();
  return operationPromise;
}
