type ApplyTrendConsentChoiceDeps = {
  grant: () => Promise<void>;
  revoke: () => Promise<void>;
  invalidate: () => Promise<unknown>;
  onFailure: () => void;
};

export async function applyTrendConsentChoice(
  enabled: boolean,
  deps: ApplyTrendConsentChoiceDeps,
): Promise<boolean> {
  try {
    if (enabled) await deps.grant();
    else await deps.revoke();
    return true;
  } catch {
    deps.onFailure();
    return false;
  } finally {
    await deps.invalidate().catch(() => undefined);
  }
}
