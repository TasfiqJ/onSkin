export type SingleFlightLease<T> = {
  current: Promise<T> | null;
};

/**
 * Shares one native-authentication attempt across every caller until it
 * settles. This prevents an auto-prompt and a fast user tap from opening two
 * overlapping biometric/passcode sheets.
 */
export function runSingleFlight<T>(
  lease: SingleFlightLease<T>,
  operation: () => Promise<T>,
): Promise<T> {
  if (lease.current) return lease.current;

  const attempt = Promise.resolve().then(operation);
  lease.current = attempt;
  void attempt
    .finally(() => {
      if (lease.current === attempt) lease.current = null;
    })
    .catch(() => undefined);
  return attempt;
}
