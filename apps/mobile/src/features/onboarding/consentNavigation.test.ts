import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HealthConsentScreen from '../../app/onboarding/consent';

const mocks = vi.hoisted(() => ({
  decline: vi.fn(),
  grant: vi.fn(),
  invalidate: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  resetConsumers: vi.fn(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  useWindowDimensions: () => ({ height: 844, width: 390 }),
}));
vi.mock('expo-router', () => ({
  router: {
    back: vi.fn(),
    canGoBack: () => false,
    push: mocks.push,
    replace: mocks.replace,
  },
  useLocalSearchParams: () => ({}),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  Card: 'Card',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('@/features/healthConsent/lifecycle', () => ({
  LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER: 'local-device-unclaimed',
}));
vi.mock('@/features/onboarding/ageGateStore', () => ({
  getAgeVerified: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/features/onboarding/healthConsent', () => ({
  declineHealthDataCollectionConsent: mocks.decline,
  grantHealthDataCollectionConsent: mocks.grant,
  resetHealthProfileConsumers: mocks.resetConsumers,
}));
vi.mock('@/features/subscription/ComplianceRow', () => ({ openPolicy: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: false }));
vi.mock('@/lib/legal/disclaimer', () => ({ NOT_MEDICAL_ADVICE_SHORT: 'Not medical advice.' }));
vi.mock('@/lib/legal/policyLinks', () => ({
  POLICY_LINKS: { consumerHealthPrivacy: { url: 'https://example.com/health' } },
}));
vi.mock('@/lib/navigation/externalUrl', () => ({ safeExternalHttpsUrl: (url: string) => url }));
vi.mock('@/theme/tokens', () => ({ colors: { clayTint: '#eee' } }));

let renderer: ReactTestRenderer | null = null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
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
  mocks.decline.mockReset().mockResolvedValue(undefined);
  mocks.grant.mockReset().mockResolvedValue({ activationRoutePending: true });
  mocks.invalidate.mockReset().mockResolvedValue(undefined);
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.resetConsumers.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('health-consent decline to grant navigation', () => {
  it('records one grant and leaves fresh-route selection exclusively to the lifecycle gate', async () => {
    const grant = deferred<{ activationRoutePending: boolean }>();
    const neverSettles = new Promise<void>(() => {});
    mocks.grant.mockReturnValueOnce(grant.promise);
    mocks.invalidate.mockReturnValue(neverSettles);

    await act(async () => {
      renderer = create(createElement(HealthConsentScreen));
    });
    await flush();

    const declineButton = renderer!.root.findAll(
      (node) =>
        node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
    )[0]!;
    await act(async () => {
      declineButton.props.onPress();
      await Promise.resolve();
    });
    await flush();
    expect(JSON.stringify(renderer!.toJSON())).toContain('No consent recorded');

    const agreeButton = renderer!.root.findByProps({ label: 'I agree. Continue' });
    await act(async () => {
      agreeButton.props.onPress();
      agreeButton.props.onPress();
      await Promise.resolve();
    });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();

    grant.resolve({ activationRoutePending: true });
    await flush();

    expect(mocks.grant).toHaveBeenCalledExactlyOnceWith('local-device-unclaimed');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.invalidate).toHaveBeenCalledTimes(3);
  });

  it('navigates once when an already-active refresh has no activation-route barrier', async () => {
    mocks.grant.mockResolvedValueOnce({ activationRoutePending: false });

    await act(async () => {
      renderer = create(createElement(HealthConsentScreen));
    });
    await flush();

    const agreeButton = renderer!.root.findByProps({ label: 'I agree. Continue' });
    await act(async () => {
      agreeButton.props.onPress();
      agreeButton.props.onPress();
      await Promise.resolve();
    });
    await flush();

    expect(mocks.grant).toHaveBeenCalledExactlyOnceWith('local-device-unclaimed');
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/onboarding/goals');
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
