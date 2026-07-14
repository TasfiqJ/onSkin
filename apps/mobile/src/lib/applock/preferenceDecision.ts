import {
  isRepairableAppLockPreferenceResult,
  type AppLockPreferenceReadResult,
} from './preferenceResult';

export type AppLockPreferenceRecovery = 'repair' | 'retry' | null;

export type AppLockPreferenceDecision = Readonly<{
  enabled: boolean;
  locked: boolean;
  recovery: AppLockPreferenceRecovery;
}>;

/** Convert every typed storage outcome into an explicit fail-closed UI decision. */
export function decideAppLockPreference(
  result: AppLockPreferenceReadResult,
): AppLockPreferenceDecision {
  if (result.status === 'absent' || result.status === 'available') {
    return { enabled: result.enabled, locked: result.enabled, recovery: null };
  }

  return {
    enabled: true,
    locked: true,
    recovery: isRepairableAppLockPreferenceResult(result) ? 'repair' : 'retry',
  };
}
