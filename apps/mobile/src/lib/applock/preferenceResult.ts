import type { PrivateBooleanCorruptReason } from '@/lib/storage/privateBoolean';
import type { PrivateKVReadFailureReason } from '@/lib/storage/privateKV';

export type AppLockPreferenceReadResult =
  | { status: 'absent'; enabled: false }
  | { status: 'available'; enabled: boolean; format: 'current' | 'legacy' }
  | { status: 'unavailable'; enabled: null; reason: PrivateKVReadFailureReason }
  | { status: 'corrupt'; enabled: null; reason: PrivateBooleanCorruptReason }
  | { status: 'unsupported_version'; enabled: null };

export function isRepairableAppLockPreferenceResult(result: AppLockPreferenceReadResult): boolean {
  return (
    result.status === 'unsupported_version' ||
    (result.status === 'corrupt' &&
      (result.reason === 'invalid_value' || result.reason === 'envelope_invalid'))
  );
}
