type ApplyTrendConsentChoiceDeps = {
  revoke: () => Promise<void>;
  invalidate: () => Promise<unknown>;
  onFailure: () => void;
};

export async function applyTrendConsentChoice(
  enabled: boolean,
  deps: ApplyTrendConsentChoiceDeps,
): Promise<boolean> {
  // No caller-provided grant callback may bypass PHOTO-05A admission. Return before
  // invalidation or failure callbacks so a stale opt-in surface causes no side effect.
  if (enabled) return false;

  try {
    await deps.revoke();
    return true;
  } catch {
    deps.onFailure();
    return false;
  } finally {
    void deps.invalidate().catch(() => undefined);
  }
}
