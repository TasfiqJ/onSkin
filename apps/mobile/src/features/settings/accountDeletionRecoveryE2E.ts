const MODES = [
  'pending_then_completed_manual',
  'invalid',
  'invalid_support_only',
  'expired',
] as const;
export type AccountDeletionRecoveryFixture = (typeof MODES)[number];
type Phase = 'pending' | 'completed' | 'acknowledged';
const KEY = 'routinekind.e2e.deletionRecoveryPhase.v1';
type FixtureStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function resolveAccountDeletionRecoveryFixture(input: {
  platform: string;
  isDev: boolean;
  appEnvironment: string;
  supabaseConfigured: boolean;
  mode: unknown;
}): AccountDeletionRecoveryFixture | null {
  return input.platform === 'web' &&
    input.isDev &&
    input.appEnvironment === 'development' &&
    !input.supabaseConfigured &&
    MODES.includes(input.mode as AccountDeletionRecoveryFixture)
    ? (input.mode as AccountDeletionRecoveryFixture)
    : null;
}

// Synthetic transport state, never a real deletion receipt. Retain it across
// router remounts and document reloads so acknowledgement cannot regress to pending.
export function readAccountDeletionFixturePhase(
  storage: FixtureStorage = globalThis.sessionStorage,
): Phase {
  const value = storage.getItem(KEY);
  if (value === null) return 'pending';
  if (value === 'completed' || value === 'acknowledged') return value;
  throw new Error('E2E_ACCOUNT_DELETION_PHASE_INVALID');
}

export function writeAccountDeletionFixturePhase(
  phase: Exclude<Phase, 'pending'>,
  storage: FixtureStorage = globalThis.sessionStorage,
): void {
  if (readAccountDeletionFixturePhase(storage) === 'acknowledged') return;
  storage.setItem(KEY, phase);
}
