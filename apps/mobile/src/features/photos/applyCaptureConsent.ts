type ApplyPhotoCaptureConsentDeps = {
  grant: () => Promise<void>;
  requestPermission: () => Promise<unknown>;
  onSaved: () => void;
  onFailure: () => void;
};

export async function applyPhotoCaptureConsent(
  deps: ApplyPhotoCaptureConsentDeps,
): Promise<boolean> {
  try {
    await deps.grant();
  } catch {
    deps.onFailure();
    return false;
  }

  deps.onSaved();
  await deps.requestPermission().catch(() => undefined);
  return true;
}
