import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(`${SRC}/${path}`, 'utf8');

describe('health lifecycle route contract', () => {
  it('mounts the lifecycle gate above every health provider and route', () => {
    const root = read('app/_layout.tsx');
    expect(root.indexOf('<PrivateDataAvailabilityGate>')).toBeLessThan(
      root.indexOf('<HealthDataLifecycleGate>'),
    );
    expect(root.indexOf('<HealthDataLifecycleGate>')).toBeLessThan(
      root.indexOf('<OnboardingProvider>'),
    );
    expect(root.indexOf('<HealthDataLifecycleGate>')).toBeLessThan(
      root.indexOf('<IntakeProvider>'),
    );
    expect(root.indexOf('<HealthDataLifecycleGate>')).toBeLessThan(root.indexOf('<OfflineSync />'));
    expect(root.indexOf('<HealthDataLifecycleGate>')).toBeLessThan(
      root.indexOf('<Stack screenOptions='),
    );
  });

  it('keeps account deletion and health withdrawal as separate controls', () => {
    const actions = read('features/settings/actions.ts');
    const withdrawal = actions.slice(
      actions.indexOf('export async function withdrawHealthDataConsent'),
      actions.indexOf('// GDPR Art. 20 export'),
    );
    expect(withdrawal).toContain('beginHealthDataConsentWithdrawal(ownerUserId)');
    expect(withdrawal).not.toContain('deleteAccount(');
    expect(withdrawal).not.toContain('signOut');
    expect(withdrawal).not.toContain('resetRevenueCatIdentity');
  });

  it('offers recovery, fresh consent, export, billing, sign-out, and deletion in the paused shell', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    for (const label of [
      'Retry / check status',
      'Review fresh consent',
      'I agree. Start a new profile',
      'Manage subscription',
      'Restore purchases',
      'Export my data',
      'Sign out',
      'Delete account',
      'Consumer health data policy',
      'Support',
    ]) {
      expect(gate).toContain(label);
    }
  });

  it('routes every permitted paused-shell consent grant through the gate-owned goals flow', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    const reconsent = gate.slice(
      gate.indexOf('async function reconsent()'),
      gate.indexOf('async function exportAccountData()'),
    );
    expect(reconsent).toContain('if (isSupabaseConfigured && !terminal)');
    expect(reconsent).toContain('onRecord(next)');
    expect(reconsent).not.toContain("router.replace('/onboarding/goals')");
    expect(gate).toContain('I agree. Start a new profile');
    expect(gate).toContain(
      'Accepting starts a new processing epoch with empty goals, quiz answers, shelf, routines, reminders, and Progress history',
    );
  });

  it('atomically interlocks active store notifications before router navigation settles', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    const interlock = read('features/healthConsent/activationInterlock.ts');
    const subscription = gate.slice(
      gate.indexOf('subscribeToHealthDataLifecycle'),
      gate.indexOf('const activationRouteSelected'),
    );
    expect(subscription).toContain('commitLifecycleRecord(next, baseline.record)');
    expect(subscription).toContain('commitLifecycleRecord(next)');
    expect(gate).toContain('!healthDataChildrenMayMount(gateSnapshot)');
    expect(gate).toContain("router.replace('/onboarding/goals')");
    expect(gate).toContain('releaseHealthDataActivationRoute(latest');
    expect(interlock).toContain('record: next, activationRouteEpoch');
    expect(interlock).toContain("previous.verificationReason === 'status_unavailable'");
  });

  it('gives lifecycle reconciliation a single activation-route navigation owner', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    const activationRouteEffect = gate.slice(
      gate.indexOf('const activationRouteSelected'),
      gate.indexOf('const acknowledgeMountedGoalsRoute'),
    );
    const reconciliation = gate.slice(
      gate.indexOf('const reconcile = async () =>'),
      gate.indexOf("const appState = AppState.addEventListener('change'"),
    );

    expect(activationRouteEffect).toContain('current.activationRouteEpoch === null');
    expect(activationRouteEffect).toContain('!activationRouteSelected');
    expect(activationRouteEffect).toContain("router.replace('/onboarding/goals')");
    expect(reconciliation).toContain('commitLifecycleRecord(next, before)');
    expect(reconciliation).not.toContain("router.replace('/onboarding/goals')");
    expect(reconciliation).not.toContain('healthDataActivationRequiresFreshRoute');
  });

  it('mounts the empty goals route before durably acknowledging fresh activation', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    const mountedInterlock = read('features/healthConsent/HealthDataActivationMount.tsx');
    const acknowledgement = gate.slice(
      gate.indexOf('const acknowledgeMountedGoalsRoute'),
      gate.indexOf('const unconsentedRouteAllowed'),
    );
    expect(mountedInterlock).toContain('{children}');
    expect(mountedInterlock).toContain('if (!activationPending) return;');
    expect(mountedInterlock).toContain('void onAcknowledge()');
    expect(mountedInterlock).toContain("pointerEvents={activationPending ? 'none' : 'auto'}");
    expect(mountedInterlock).toContain('{activationPending ? (');
    expect(acknowledgement).toContain('completeHealthDataActivationRoute');
    expect(acknowledgement).toContain('releaseHealthDataActivationRoute');
    expect(acknowledgement.indexOf('completeHealthDataActivationRoute')).toBeLessThan(
      acknowledgement.indexOf('releaseHealthDataActivationRoute'),
    );
    expect(gate).toContain("activationRouteSelected && record.state === 'active'");
    expect(mountedInterlock).toContain('Retry profile activation');
  });

  it('preserves the mounted navigator identity when activation acknowledgement releases', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    const pendingBranch = gate.slice(
      gate.indexOf('if (!healthDataChildrenMayMount(gateSnapshot))'),
      gate.indexOf("record.state === 'active' &&\n    isSupabaseConfigured"),
    );
    const releasedBranch = gate.slice(
      gate.indexOf('// Keep the navigator and its browser-history adapter under the same parent'),
    );

    expect(pendingBranch).toContain('<MountedGoalsActivationInterlock');
    expect(pendingBranch).toContain('activationPending');
    expect(releasedBranch).toContain('<MountedGoalsActivationInterlock');
    expect(releasedBranch).toContain('activationPending={false}');
    expect(releasedBranch).not.toContain('return <>{children}</>');
  });

  it('leaves retry route selection to the activation epoch interlock', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    const retry = gate.slice(
      gate.indexOf('async function retry()'),
      gate.indexOf('async function reconsent()'),
    );
    expect(retry).toContain('onRecord(next)');
    expect(retry).not.toContain("router.replace('/onboarding/goals')");
    expect(retry).not.toContain('verificationCanResumeActiveEpoch');
  });

  it('offers configured reconsent only from a clean server-compatible terminal state', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    expect(gate).toContain(
      "const terminal = record.state === 'withdrawn' && record.localCleanupComplete;",
    );
    expect(gate).toContain('const mayReviewConsent = terminal || localOnlyVerificationReady;');
    expect(gate).toContain('!isSupabaseConfigured &&');
    expect(gate).toContain('verificationRequiresLocalCleanup(record)');
    expect(gate).toContain(
      'Consent cannot restart until the server confirms a compatible terminal state.',
    );
  });

  it('keeps allowed pre-consent providers empty and free of mount-time health I/O', () => {
    const onboarding = read('features/onboarding/OnboardingContext.tsx');
    const intake = read('features/shelf/IntakeContext.tsx');
    expect(onboarding).toContain('const [goals, setGoals] = useState<GoalId[]>([]);');
    expect(onboarding).toContain(
      'const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});',
    );
    expect(onboarding).not.toContain('useEffect(');
    expect(intake).toContain('const [draft, setDraft] = useState<IntakeDraft>(EMPTY);');
    expect(intake).not.toContain('useEffect(');
    expect(intake).not.toContain('getPrivateItem(');
    expect(intake).not.toContain('setPrivateItem(');
  });

  it('states the provable active-system withdrawal boundary without overclaiming backups', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    expect(gate).toContain('cleared from this device and the live service');
    expect(gate).toContain(
      'Protected backups, if any, follow policy retention and are not used for personalization',
    );
    expect(gate).toContain('Active-system withdrawal is complete.');
    expect(gate).toContain(
      'The app will not restore the old profile into active use; create a new one.',
    );
    expect(gate).not.toContain('Your old profile cannot be restored.');
  });

  it('does not mount direct health routes from an authoritative unconsented state', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    expect(gate).toContain("record.state === 'unconsented'");
    expect(gate).toContain("router.replace('/onboarding/consent')");
    expect(gate).toContain("record.state === 'unconsented' && !unconsentedRouteAllowed");
    expect(gate).toContain("segments[1] === 'age'");
    expect(gate).toContain("segments[1] === 'consent'");
    expect(gate).not.toContain("segments[1] === 'goals'");
    expect(gate).not.toContain("segments[1] === 'quiz'");
  });

  it('rechecks the committed lifecycle snapshot before redirecting goals to consent', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    const redirectEffect = gate.slice(
      gate.indexOf('healthDataUnconsentedRedirectRequired('),
      gate.indexOf("router.replace('/onboarding/consent')") + 39,
    );

    expect(redirectEffect).toContain('gateSnapshotRef.current');
    expect(redirectEffect).toContain('unconsentedRouteAllowed');
    expect(redirectEffect).not.toContain("record.state === 'unconsented'");
  });

  it('allows only welcome and account entry before a configured owner exists', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    expect(gate).toContain('signedOutConfiguredRouteMayMount');
    expect(gate).toContain("segments[1] === 'account'");
    expect(gate).toContain("router.replace('/')");
    expect(gate).toContain('Sign in before entering health information');
    expect(gate).not.toContain("segments[1] === 'products' ||");
  });

  it('revalidates active status on foreground and at the bounded lease deadline', () => {
    const gate = read('features/healthConsent/HealthDataLifecycleGate.tsx');
    expect(gate).toContain('healthProcessingStatusLeaseExpiresAt');
    expect(gate).toContain('isHealthProcessingStatusLeaseCurrent');
    expect(gate).toContain("state === 'active'");
    expect(gate).toContain('setReconcileRevision');
    expect(gate).toContain('Revalidating health-data access');
    expect(gate).toContain('commitLifecycleRecord(next, before)');
    expect(gate).toContain(
      'reconciliationBaselineRef.current = { token: baselineToken, record: before }',
    );
    expect(gate).toContain('if (isAccountGenerationLeaseError(error)) return;');
    expect(gate).toContain('generation: lease.generation');
    expect(gate).toContain('if (!clearExactProcessingLease(scheduledLease, ownerUserId)) return;');
  });
});
