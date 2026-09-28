import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PausedHealthDataShell } from './HealthDataLifecycleGate';
import type { HealthDataLifecycleRecord } from './lifecycleStore';

const mocks = vi.hoisted(() => ({
  grant: vi.fn(),
  reconcile: vi.fn(),
  replace: vi.fn(),
  resume: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: { replace: mocks.replace },
  useSegments: () => ['settings'],
}));
vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn() },
  Platform: { OS: 'web' },
  ScrollView: 'ScrollView',
  View: 'View',
}));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  Card: 'Card',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('@/features/settings/actions', () => ({ deleteAccount: vi.fn(), exportData: vi.fn() }));
vi.mock('@/features/subscription/storefrontCopy', () => ({
  subscriptionStorefrontCopy: () => ({ managementUnavailable: 'Unavailable' }),
}));
vi.mock('@/features/subscription/useEntitlement', () => ({
  useEntitlement: () => ({ data: null }),
  useEntitlementActions: () => ({ restore: { isPending: false, mutate: vi.fn() } }),
}));
vi.mock('@/features/widgets/lifecycleRuntime', () => ({
  ROUTINE_WIDGET_RECONCILIATION_HEADROOM_MS: 0,
  drainRoutineWidgetOutboxBeforeHealthLeaseClose: vi.fn(async () => ({ status: 'skipped' })),
}));
vi.mock('@/features/widgets/RoutineWidgetLifecycleHost', () => ({
  RoutineWidgetLifecycleSlot: () => null,
}));
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ initializing: false, signOut: vi.fn(), user: null }),
}));
vi.mock('@/lib/auth/accountGeneration', () => ({
  isAccountGenerationLeaseError: () => false,
}));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: () => null,
  clearActiveHealthProcessingEpoch: () => true,
  healthProcessingStatusLeaseExpiresAt: () => null,
  isHealthProcessingStatusLeaseCurrent: () => true,
}));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: false }));
vi.mock('@/lib/iap/revenuecat', () => ({
  MANAGE_SUBSCRIPTION_URL_ANDROID: 'https://example.com/android',
  MANAGE_SUBSCRIPTION_URL_IOS: 'https://example.com/ios',
  showNativeManageSubscriptions: vi.fn(),
}));
vi.mock('@/lib/legal/policyLinks', () => ({
  POLICY_LINKS: {
    consumerHealthPrivacy: { url: 'https://example.com/health' },
    privacy: { url: 'https://example.com/privacy' },
    support: { url: 'https://example.com/support' },
  },
}));
vi.mock('@/lib/navigation/externalOpen', () => ({ openExternalHttpsUrl: vi.fn() }));
vi.mock('./lifecycle', () => ({
  completeHealthDataActivationRoute: vi.fn(),
  grantAuthoritativeHealthDataConsent: mocks.grant,
  LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER: 'local-device-unclaimed',
  reconcileHealthDataLifecycle: mocks.reconcile,
  resumeHealthDataConsentWithdrawal: mocks.resume,
}));
vi.mock('./lifecycleStore', () => ({
  readHealthDataLifecycle: vi.fn(),
  subscribeToHealthDataLifecycle: vi.fn(),
  verificationRequiredRecord: vi.fn(),
  verificationRequiresLocalCleanup: (record: HealthDataLifecycleRecord) =>
    record.state === 'verification_required' && record.verificationReason !== 'status_unavailable',
}));

let renderer: ReactTestRenderer | null = null;

const baseRecord = Object.freeze({
  schemaVersion: 3,
  ownerUserId: 'owner-a',
  state: 'withdrawn',
  processingEpoch: 2,
  operationId: null,
  idempotencyKey: null,
  localCleanupComplete: true,
  activationRoutePending: false,
  verificationReason: null,
  verificationResumeState: null,
  serverVerifiedAt: null,
  updatedAt: '2026-07-15T12:00:00.000Z',
}) as HealthDataLifecycleRecord;

function lifecycleRecord(overrides: Partial<HealthDataLifecycleRecord>): HealthDataLifecycleRecord {
  return Object.freeze({ ...baseRecord, ...overrides }) as HealthDataLifecycleRecord;
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.grant.mockReset();
  mocks.reconcile.mockReset();
  mocks.replace.mockReset();
  mocks.resume.mockReset();
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('paused health-data shell navigation ownership', () => {
  it('publishes reconsent once and leaves its pending activation route to the gate', async () => {
    const onRecord = vi.fn();
    const activated = lifecycleRecord({
      state: 'active',
      processingEpoch: 3,
      activationRoutePending: true,
    });
    mocks.grant.mockResolvedValueOnce(activated);

    await act(async () => {
      renderer = create(createElement(PausedHealthDataShell, { record: baseRecord, onRecord }));
    });
    await act(async () => {
      renderer!.root.findByProps({ label: 'Review fresh consent' }).props.onPress();
    });
    await act(async () => {
      renderer!.root.findByProps({ label: 'I agree. Start a new profile' }).props.onPress();
    });
    await flush();

    expect(mocks.grant).toHaveBeenCalledExactlyOnceWith({
      ownerUserId: 'owner-a',
      expectedProcessingEpoch: 2,
    });
    expect(onRecord).toHaveBeenCalledExactlyOnceWith(activated);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('publishes a fresh-epoch verification retry once and leaves routing to the gate', async () => {
    const onRecord = vi.fn();
    const verification = lifecycleRecord({
      state: 'verification_required',
      processingEpoch: 7,
      localCleanupComplete: false,
      verificationReason: 'status_unavailable',
      verificationResumeState: 'active',
    });
    const activated = lifecycleRecord({
      state: 'active',
      processingEpoch: 8,
      activationRoutePending: true,
    });
    mocks.reconcile.mockResolvedValueOnce(activated);

    await act(async () => {
      renderer = create(createElement(PausedHealthDataShell, { record: verification, onRecord }));
    });
    await act(async () => {
      renderer!.root.findByProps({ label: 'Retry / check status' }).props.onPress();
    });
    await flush();

    expect(mocks.reconcile).toHaveBeenCalledExactlyOnceWith('owner-a');
    expect(onRecord).toHaveBeenCalledExactlyOnceWith(activated);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
