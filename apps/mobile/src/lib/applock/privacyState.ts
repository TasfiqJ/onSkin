export type PrivacyAppState =
  | 'active'
  | 'background'
  | 'inactive'
  | 'unknown'
  | 'extension'
  | string;

export function shouldShowPrivacyShieldForAppState(state: PrivacyAppState): boolean {
  return state !== 'active';
}

export function shouldLockForAppState(state: PrivacyAppState, appLockEnabled: boolean): boolean {
  return appLockEnabled && shouldShowPrivacyShieldForAppState(state);
}
