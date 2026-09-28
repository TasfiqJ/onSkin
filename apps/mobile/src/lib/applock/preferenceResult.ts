export type AppLockPreferenceUnavailableReason =
  | 'account_boundary'
  | 'content_key_invalid'
  | 'content_key_missing'
  | 'decryption_failed'
  | 'storage_unavailable';

export type AppLockPreferenceCorruptReason = 'envelope_invalid' | 'invalid_value';

export type AppLockPreferenceReadResult =
  | { status: 'absent'; enabled: false }
  | { status: 'available'; enabled: boolean; format: 'current' | 'legacy' }
  | { status: 'unavailable'; enabled: null; reason: AppLockPreferenceUnavailableReason }
  | { status: 'corrupt'; enabled: null; reason: AppLockPreferenceCorruptReason }
  | { status: 'unsupported_version'; enabled: null };

export function isRepairableAppLockPreferenceResult(result: AppLockPreferenceReadResult): boolean {
  return (
    result.status === 'unsupported_version' ||
    (result.status === 'corrupt' &&
      (result.reason === 'invalid_value' || result.reason === 'envelope_invalid'))
  );
}
