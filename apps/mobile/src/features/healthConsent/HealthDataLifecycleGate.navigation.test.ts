import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HEALTH_DATA_CONSENT, HEALTH_DATA_WITHDRAWAL } from '@/features/onboarding/consentCopy';

import { PausedHealthDataShell } from './HealthDataLifecycleGate';
import type { HealthDataLifecycleRecord } from './lifecycleStore';
import { readHealthDataLifecycle } from './lifecycleStore';

const mocks = vi.hoisted(() => ({
  configured: false,
  deleteAccount: vi.fn(),
  restore: vi.fn(),
  pausedWithdraw: vi.fn(),
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
vi.mock('@/features/settings/actions', () => ({
  deleteAccount: mocks.deleteAccount,
  exportData: vi.fn(),
}));
vi.mock('@/features/subscription/storefrontCopy', () => ({
  subscriptionStorefrontCopy: () => ({ managementUnavailable: 'Unavailable' }),
}));
vi.mock('@/features/subscription/useEntitlement', () => ({
  useEntitlement: () => ({ data: null }),
  useEntitlementActions: () => ({ restore: { isPending: false, mutate: mocks.restore } }),
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
vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.configured;
  },
}));
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
  beginPausedHealthDataConsentWithdrawal: mocks.pausedWithdraw,
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
  mocks.configured = false;
  mocks.deleteAccount.mockReset();
  mocks.restore.mockReset();
  vi.mocked(readHealthDataLifecycle).mockReset();
  mocks.grant.mockReset();
  mocks.pausedWithdraw.mockReset();
  mocks.reconcile.mockReset();
  mocks.replace.mockReset();
  mocks.resume.mockReset();
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('paused health-data shell navigation ownership', () => {
  it('starts one paused withdrawal for two same-turn confirmation presses', async () => {
    let release!: (record: HealthDataLifecycleRecord) => void;
    mocks.pausedWithdraw.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const onRecord = vi.fn();
    await act(async () => {
      renderer = create(
        createElement(PausedHealthDataShell, {
          record: lifecycleRecord({ state: 'active' }),
          onRecord,
          rightsOnly: true,
        }),
      );
    });
    await act(async () =>
      renderer!.root.findByProps({ label: 'Withdraw health-data consent' }).props.onPress(),
    );
    await act(async () => {
      const confirm = renderer!.root.findByProps({ label: 'Confirm withdrawal' }).props.onPress;
      confirm();
      confirm();
    });
    expect(mocks.pausedWithdraw).toHaveBeenCalledExactlyOnceWith('owner-a');
    await act(async () => release(baseRecord));
    await flush();
    expect(onRecord).toHaveBeenCalledExactlyOnceWith(baseRecord);
  });
  it('keeps reconsent absent and status retry read-only in the isolated rights shell', async () => {
    const onRecord = vi.fn();
    const active = lifecycleRecord({ state: 'active', processingEpoch: 3 });
    vi.mocked(readHealthDataLifecycle).mockResolvedValueOnce(active);
    await act(async () => {
      renderer = create(
        createElement(PausedHealthDataShell, { record: active, onRecord, rightsOnly: true }),
      );
    });
    await act(async () =>
      renderer!.root.findByProps({ label: 'Retry / check status' }).props.onPress(),
    );
    await flush();
    expect(onRecord).toHaveBeenCalledExactlyOnceWith(active);
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.grant).not.toHaveBeenCalled();
    await act(async () =>
      renderer!.update(
        createElement(PausedHealthDataShell, { record: baseRecord, onRecord, rightsOnly: true }),
      ),
    );
    expect(renderer!.root.findAllByProps({ label: 'Review fresh consent' })).toHaveLength(0);
  });
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

  it('publishes explicit local verification reconsent once and leaves activation routing to the gate', async () => {
    const onRecord = vi.fn();
    const verification = lifecycleRecord({
      state: 'verification_required',
      processingEpoch: 2,
      verificationReason: 'local_consent_unavailable',
      verificationResumeState: 'active',
    });
    const activated = lifecycleRecord({
      state: 'active',
      processingEpoch: 3,
      activationRoutePending: true,
    });
    let release!: (record: HealthDataLifecycleRecord) => void;
    mocks.grant.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    await act(async () => {
      renderer = create(createElement(PausedHealthDataShell, { record: verification, onRecord }));
    });
    expect(renderer!.root.findAllByProps({ label: 'Review fresh consent' })).toHaveLength(0);
    expect(renderer!.root.findAllByProps({ label: 'I agree. Start a new profile' })).toHaveLength(
      0,
    );
    expect(mocks.grant).not.toHaveBeenCalled();
    await act(async () =>
      renderer!.root.findByProps({ label: 'Review current consent' }).props.onPress(),
    );
    const disclosure = JSON.stringify(renderer!.toJSON());
    for (const text of [
      HEALTH_DATA_CONSENT.what,
      HEALTH_DATA_CONSENT.why,
      HEALTH_DATA_CONSENT.never,
    ]) {
      expect(disclosure).toContain(text);
    }
    expect(renderer!.root.findAllByProps({ label: 'Not now' })).toHaveLength(1);
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(onRecord).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    await act(async () =>
      renderer!.root.findByProps({ label: 'I agree. Start a new profile' }).props.onPress(),
    );
    expect(mocks.grant).toHaveBeenCalledExactlyOnceWith({
      ownerUserId: 'owner-a',
      expectedProcessingEpoch: 2,
    });
    expect(renderer!.root.findByProps({ label: 'Saving...' }).props.disabled).toBe(true);
    expect(renderer!.root.findByProps({ label: 'Not now' }).props.disabled).toBe(true);
    expect(onRecord).not.toHaveBeenCalled();
    await act(async () => release(activated));
    await flush();
    expect(onRecord).toHaveBeenCalledExactlyOnceWith(activated);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
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

  it('describes a completed local verification pause without implying account, service or billing state', async () => {
    const onRecord = vi.fn();
    await act(async () => {
      renderer = create(
        createElement(PausedHealthDataShell, {
          record: lifecycleRecord({
            state: 'verification_required',
            processingEpoch: 0,
            verificationReason: 'authoritative_unconsented',
            verificationResumeState: null,
          }),
          onRecord,
        }),
      );
    });
    const copy = JSON.stringify(renderer!.toJSON());
    expect(copy).toContain('Health features are paused on this device.');
    expect(copy).toContain(
      'Local health-purpose cleanup is complete. Health features remain paused.',
    );
    expect(copy).toContain('App Store purchases, if any, are managed separately.');
    expect(copy).not.toContain('Your account is still here.');
    expect(copy).not.toContain('server lifecycle is not compatible');
    expect(copy).not.toContain('Billing does not stop automatically');
    expect(renderer!.root.findAllByProps({ label: 'Review current consent' })).toHaveLength(1);
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(onRecord).not.toHaveBeenCalled();
  });

  it('keeps local review cancellation paused without granting, publishing or navigating', async () => {
    const onRecord = vi.fn();
    await act(async () => {
      renderer = create(
        createElement(PausedHealthDataShell, {
          record: lifecycleRecord({
            state: 'verification_required',
            processingEpoch: 2,
            verificationReason: 'local_consent_unavailable',
            verificationResumeState: 'active',
          }),
          onRecord,
        }),
      );
    });
    await act(async () =>
      renderer!.root.findByProps({ label: 'Review current consent' }).props.onPress(),
    );
    expect(renderer!.root.findAllByProps({ label: 'I agree. Start a new profile' })).toHaveLength(
      1,
    );
    const copy = JSON.stringify(renderer!.toJSON());
    expect(copy).toContain(
      'Withdrawal clears health-purpose data from this device; starting again requires fresh consent.',
    );
    expect(copy).toContain(
      'This permission covers collection only; sharing is requested separately.',
    );
    expect(copy).not.toContain('keeping your account and subscription');
    await act(async () => renderer!.root.findByProps({ label: 'Not now' }).props.onPress());
    expect(renderer!.root.findAllByProps({ label: 'I agree. Start a new profile' })).toHaveLength(
      0,
    );
    expect(renderer!.root.findAllByProps({ label: 'Review current consent' })).toHaveLength(1);
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(onRecord).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it.each(['withdrawing', 'withdrawn', 'verification_required'] as const)(
    'keeps incomplete local %s cleanup paused without a review or grant action',
    async (state) => {
      const onRecord = vi.fn();
      await act(async () => {
        renderer = create(
          createElement(PausedHealthDataShell, {
            record: lifecycleRecord({
              state,
              localCleanupComplete: false,
              verificationReason:
                state === 'verification_required' ? 'authoritative_unconsented' : null,
            }),
            onRecord,
          }),
        );
      });
      const copy = JSON.stringify(renderer!.toJSON());
      expect(copy).toContain('pending');
      expect(copy).not.toContain('Local health-purpose cleanup is complete.');
      expect(copy).not.toContain('live service');
      expect(copy).not.toContain('server');
      for (const label of [
        'Review current consent',
        'Review fresh consent',
        'I agree. Start a new profile',
      ]) {
        expect(renderer!.root.findAllByProps({ label })).toHaveLength(0);
      }
      expect(mocks.grant).not.toHaveBeenCalled();
      expect(onRecord).not.toHaveBeenCalled();
    },
  );

  it('preserves unreadable local permission as locked data without claiming cleanup or enabling review', async () => {
    const onRecord = vi.fn();
    mocks.reconcile.mockRejectedValueOnce(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    await act(async () => {
      renderer = create(
        createElement(PausedHealthDataShell, {
          record: lifecycleRecord({
            state: 'verification_required',
            verificationReason: 'status_unavailable',
            verificationResumeState: 'active',
            localCleanupComplete: false,
          }),
          onRecord,
        }),
      );
    });
    const copy = JSON.stringify(renderer!.toJSON());
    expect(copy).toContain('Existing health data stays locked; this check does not delete it.');
    expect(copy).toContain(
      'Local data is preserved but inaccessible while device permission is checked.',
    );
    expect(copy).not.toContain('Local cleanup');
    expect(copy).not.toContain('server status');
    await act(async () =>
      renderer!.root.findByProps({ label: 'Retry / check status' }).props.onPress(),
    );
    await flush();
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      'Your health features remain safely paused.',
    );
    for (const label of [
      'Review current consent',
      'Review fresh consent',
      'I agree. Start a new profile',
    ]) {
      expect(renderer!.root.findAllByProps({ label })).toHaveLength(0);
    }
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(onRecord).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('describes local withdrawal before confirmation and lets cancellation preserve the pause', async () => {
    const onRecord = vi.fn();
    await act(async () => {
      renderer = create(
        createElement(PausedHealthDataShell, {
          record: lifecycleRecord({ state: 'active' }),
          onRecord,
          rightsOnly: true,
        }),
      );
    });
    const copy = JSON.stringify(renderer!.toJSON());
    expect(copy).toContain('starts clearing health-purpose data from this device.');
    expect(copy).toContain('This build cannot confirm remote deletion.');
    expect(copy).toContain('Starting again requires fresh consent and an empty profile.');
    expect(copy).not.toContain('The account, billing');
    await act(async () =>
      renderer!.root.findByProps({ label: 'Withdraw health-data consent' }).props.onPress(),
    );
    await act(async () => renderer!.root.findByProps({ label: 'Cancel' }).props.onPress());
    expect(renderer!.root.findAllByProps({ label: 'Confirm withdrawal' })).toHaveLength(0);
    expect(mocks.pausedWithdraw).not.toHaveBeenCalled();
    expect(onRecord).not.toHaveBeenCalled();
  });

  it('labels local terminal cleanup accurately only after the actual retry returns it', async () => {
    const onRecord = vi.fn();
    mocks.resume.mockResolvedValueOnce(baseRecord);
    await act(async () => {
      renderer = create(
        createElement(PausedHealthDataShell, {
          record: lifecycleRecord({ state: 'withdrawn', localCleanupComplete: false }),
          onRecord,
        }),
      );
    });
    await act(async () =>
      renderer!.root.findByProps({ label: 'Retry / check status' }).props.onPress(),
    );
    await flush();
    expect(onRecord).toHaveBeenCalledExactlyOnceWith(baseRecord);
    expect(JSON.stringify(renderer!.toJSON())).toContain('Local health-data cleanup is complete.');
    expect(JSON.stringify(renderer!.toJSON())).not.toContain(
      'Active-system withdrawal is complete.',
    );
    expect(mocks.grant).not.toHaveBeenCalled();
  });

  it.each([
    [
      'withdrawing',
      false,
      null,
      'Your health data is paused. This device still needs to finish its private-data cleanup.',
    ],
    [
      'withdrawing',
      true,
      null,
      'Your health data is paused on this device. Server deletion is still finishing.',
    ],
    [
      'withdrawn',
      false,
      null,
      'The server completed withdrawal, but this device still needs to finish local cleanup.',
    ],
    [
      'withdrawn',
      true,
      null,
      'Health-purpose data has been cleared from this device and the live service. Protected backups, if any, follow policy retention and are not used for personalization. Your account and subscription remain available.',
    ],
    [
      'verification_required',
      false,
      'status_unavailable',
      'We could not verify the current server permission. Existing health data remains locked on this device; this status check does not delete it.',
    ],
    [
      'verification_required',
      true,
      'status_unavailable',
      'We could not verify the current server permission. Existing health data remains locked on this device; this status check does not delete it.',
    ],
    [
      'verification_required',
      true,
      'local_consent_unavailable',
      'Local health-purpose data is cleared, but the server lifecycle is not compatible with a new consent yet. Personalized features stay locked while you retry or contact support.',
    ],
    [
      'verification_required',
      false,
      'local_consent_unavailable',
      'We could not verify the current health-data permission. Personalized features stay locked until verification succeeds.',
    ],
  ] as const)(
    'preserves configured %s cleanup=%s reason=%s copy and authority',
    async (state, localCleanupComplete, verificationReason, message) => {
      mocks.configured = true;
      const onRecord = vi.fn();
      await act(async () => {
        renderer = create(
          createElement(PausedHealthDataShell, {
            record: lifecycleRecord({ state, localCleanupComplete, verificationReason }),
            onRecord,
          }),
        );
      });
      const copy = JSON.stringify(renderer!.toJSON());
      expect(copy).toContain(message);
      expect(copy).toContain('Your account is still here.');
      expect(copy).toContain(
        'Billing does not stop automatically; use Manage subscription below whenever you need it.',
      );
      expect(renderer!.root.findAllByProps({ label: 'Review fresh consent' })).toHaveLength(
        state === 'withdrawn' && localCleanupComplete ? 1 : 0,
      );
      expect(renderer!.root.findAllByProps({ label: 'Review current consent' })).toHaveLength(0);
      expect(renderer!.root.findAllByProps({ label: 'I agree. Start a new profile' })).toHaveLength(
        0,
      );
      expect(mocks.grant).not.toHaveBeenCalled();
      expect(onRecord).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'keeps configured=%s deletion confirmation and actual purchase-result wording truthful',
    async (configured) => {
      mocks.configured = configured;
      const onRecord = vi.fn();
      await act(async () => {
        renderer = create(createElement(PausedHealthDataShell, { record: baseRecord, onRecord }));
      });
      await act(async () =>
        renderer!.root.findByProps({ label: 'Delete account' }).props.onPress(),
      );
      const copy = JSON.stringify(renderer!.toJSON());
      expect(copy).toContain(
        configured
          ? 'Delete the whole account and its remaining data? Subscription billing may continue until you cancel it in the App Store.'
          : 'Account deletion needs a configured account service. This build cannot start or confirm remote deletion. App Store purchases, if any, are managed separately.',
      );
      await act(async () => renderer!.root.findByProps({ label: 'Cancel' }).props.onPress());
      expect(mocks.deleteAccount).not.toHaveBeenCalled();
      expect(onRecord).not.toHaveBeenCalled();
      expect(mocks.replace).not.toHaveBeenCalled();
      mocks.restore.mockImplementation((_input, options) => options.onSuccess({ active: false }));
      await act(async () =>
        renderer!.root.findByProps({ label: 'Restore purchases' }).props.onPress(),
      );
      expect(JSON.stringify(renderer!.toJSON())).toContain(
        configured
          ? 'No active subscription was found for this account.'
          : 'No active App Store subscription was found.',
      );
    },
  );

  it('preserves the configured withdrawal explanation and current consent disclosure', async () => {
    mocks.configured = true;
    const onRecord = vi.fn();
    await act(async () => {
      renderer = create(createElement(PausedHealthDataShell, { record: baseRecord, onRecord }));
    });
    await act(async () =>
      renderer!.root.findByProps({ label: 'Review fresh consent' }).props.onPress(),
    );
    const disclosure = JSON.stringify(renderer!.toJSON());
    for (const text of [
      HEALTH_DATA_CONSENT.what,
      HEALTH_DATA_CONSENT.why,
      HEALTH_DATA_CONSENT.never,
      HEALTH_DATA_CONSENT.footnote,
    ]) {
      expect(disclosure).toContain(text);
    }
    await act(async () =>
      renderer!.update(
        createElement(PausedHealthDataShell, {
          record: lifecycleRecord({ state: 'active' }),
          onRecord,
          rightsOnly: true,
        }),
      ),
    );
    expect(JSON.stringify(renderer!.toJSON())).toContain(HEALTH_DATA_WITHDRAWAL.fullText);
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(onRecord).not.toHaveBeenCalled();
  });
});
