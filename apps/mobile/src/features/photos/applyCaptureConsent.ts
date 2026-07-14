type ApplyPhotoCaptureConsentDeps<T> = {
  grant: () => Promise<T>;
  requestPermission: () => Promise<unknown>;
  onSaved: (result: T) => boolean;
  onFailure: (error: unknown) => void;
};

let permissionRequestInFlight: Promise<void> | null = null;

function requestPermissionOnceDetached(requestPermission: () => Promise<unknown>): void {
  if (permissionRequestInFlight) return;

  let releasePlaceholder!: () => void;
  const placeholder = new Promise<void>((resolve) => {
    releasePlaceholder = resolve;
  });
  permissionRequestInFlight = placeholder;

  let pending: Promise<void>;
  try {
    pending = Promise.resolve(requestPermission()).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    releasePlaceholder();
    if (permissionRequestInFlight === placeholder) permissionRequestInFlight = null;
    return;
  }
  releasePlaceholder();
  permissionRequestInFlight = pending;
  void pending.then(() => {
    if (permissionRequestInFlight === pending) permissionRequestInFlight = null;
  });
}

export async function applyPhotoCaptureConsent<T>(
  deps: ApplyPhotoCaptureConsentDeps<T>,
): Promise<boolean> {
  let result: T;
  try {
    result = await deps.grant();
  } catch (error) {
    deps.onFailure(error);
    return false;
  }

  if (!deps.onSaved(result)) return true;
  requestPermissionOnceDetached(deps.requestPermission);
  return true;
}
