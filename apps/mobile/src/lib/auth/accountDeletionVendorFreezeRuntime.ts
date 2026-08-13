// This module must stay free of React Native/native-module imports. Analytics
// and commerce consult it synchronously before they initialize their SDKs.
let writesBlocked = true;

export function accountDeletionVendorWritesBlocked(): boolean {
  return writesBlocked;
}

/** Internal mutation surface for the durable receipt controller only. */
export function setAccountDeletionVendorWritesBlockedForDurableControl(blocked: boolean): void {
  writesBlocked = blocked;
}
