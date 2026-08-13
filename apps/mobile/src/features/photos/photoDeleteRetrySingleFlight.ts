export type PhotoDeleteRetryPromiseRef = {
  current: Promise<void> | null;
};

export function runPhotoDeleteRetrySingleFlight(
  promiseRef: PhotoDeleteRetryPromiseRef,
  operation: () => Promise<void>,
): Promise<void> {
  if (promiseRef.current) return promiseRef.current;

  const operationPromise = (async () => {
    try {
      await operation();
    } finally {
      promiseRef.current = null;
    }
  })();
  promiseRef.current = operationPromise;
  return operationPromise;
}
