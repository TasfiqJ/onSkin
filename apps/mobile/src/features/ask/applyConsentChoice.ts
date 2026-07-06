type ApplyAskConsentChoiceDeps = {
  grant: () => Promise<void>;
  revoke: () => Promise<void>;
  onSaved: () => void | Promise<void>;
  onFailure: () => void;
  invalidate: () => Promise<unknown>;
};

export async function applyAskConsentChoice(
  enabled: boolean,
  deps: ApplyAskConsentChoiceDeps,
): Promise<boolean> {
  try {
    if (enabled) await deps.grant();
    else await deps.revoke();
  } catch {
    deps.onFailure();
    await deps.invalidate().catch(() => undefined);
    return false;
  }

  await deps.onSaved();
  await deps.invalidate().catch(() => undefined);
  return true;
}
