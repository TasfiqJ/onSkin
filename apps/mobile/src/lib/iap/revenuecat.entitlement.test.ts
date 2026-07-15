import { beforeEach, describe, expect, it, vi } from 'vitest';

import { classifyEntitlementEvidence } from '@/features/subscription/entitlementEvidence';
import { classifyRevenueCatEntitlement } from './revenuecat';

const mocks = vi.hoisted(() => ({
  env: {
    appEnvironment: 'production' as 'development' | 'staging' | 'production',
    revenueCatEntitlementId: 'pro',
  },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@/lib/env', () => ({ env: mocks.env }));

const OWNER = '11111111-1111-4111-8111-111111111111';
const REQUEST = '2026-07-05T12:00:00.000Z';

function customerInfo(options: {
  overall?: string;
  selected?: string;
  active?: boolean;
  includeEntitlement?: boolean;
  periodType?: string | null;
  store?: string | null;
  expirationDate?: string | null;
  gracePeriodExpiresDate?: string | null;
} = {}) {
  const info = {
    identifier: 'pro',
    isActive: options.active ?? true,
    periodType: options.periodType === undefined ? 'NORMAL' : options.periodType,
    store: options.store === undefined ? 'APP_STORE' : options.store,
    productIdentifier: 'annual-product',
    expirationDate:
      options.expirationDate === undefined
        ? '2027-07-05T12:00:00.000Z'
        : options.expirationDate,
    willRenew: true,
    originalPurchaseDate: '2026-06-05T12:00:00.000Z',
    isSandbox: false,
    verification: options.selected ?? 'VERIFIED',
  };
  const included = options.includeEntitlement ?? true;
  return {
    entitlements: {
      verification: options.overall ?? 'VERIFIED',
      active: included && info.isActive ? { pro: info } : {},
      all: included ? { pro: info } : {},
    },
    subscriptionsByProductIdentifier: {
      'annual-product': {
        managementURL: 'https://apps.apple.com/account/subscriptions',
        gracePeriodExpiresDate: options.gracePeriodExpiresDate ?? null,
      },
    },
    requestDate: REQUEST,
    managementURL: 'https://apps.apple.com/account/subscriptions',
    originalAppUserId: '$RCAnonymousID:provider-alias',
  } as never;
}

beforeEach(() => {
  mocks.env.appEnvironment = 'production';
});

describe('RevenueCat trusted entitlement mapping', () => {
  it.each(['VERIFIED', 'VERIFIED_ON_DEVICE'])('accepts %s active and empty evidence', (trust) => {
    const active = classifyRevenueCatEntitlement(
      customerInfo({ overall: trust, selected: trust }),
      OWNER,
    );
    expect(active).toMatchObject({
      status: 'trusted',
      entitlement: { isActive: true, storeUserId: OWNER },
    });

    const empty = classifyRevenueCatEntitlement(
      customerInfo({ overall: trust, includeEntitlement: false }),
      OWNER,
    );
    expect(empty).toMatchObject({
      status: 'trusted',
      entitlement: null,
      emptyEvidence: { storeUserId: OWNER, verifiedAt: REQUEST },
    });
  });

  it.each([
    ['FAILED', 'VERIFIED', 'failed'],
    ['VERIFIED', 'FAILED', 'failed'],
    ['NOT_REQUESTED', 'NOT_REQUESTED', 'not_requested'],
  ])('rejects overall %s / selected %s in production', (overall, selected, reason) => {
    expect(
      classifyRevenueCatEntitlement(customerInfo({ overall, selected }), OWNER),
    ).toEqual({ status: 'untrusted', reason });
  });

  it('allows NOT_REQUESTED only in the explicit development context', () => {
    mocks.env.appEnvironment = 'development';
    expect(
      classifyRevenueCatEntitlement(
        customerInfo({ overall: 'NOT_REQUESTED', selected: 'NOT_REQUESTED' }),
        OWNER,
      ),
    ).toMatchObject({ status: 'trusted', entitlement: { isActive: true } });
  });

  it('uses a future grace boundary after the original expiration and closes exactly there', () => {
    const classified = classifyRevenueCatEntitlement(
      customerInfo({
        expirationDate: '2026-07-05T11:00:00.000Z',
        gracePeriodExpiresDate: '2026-07-06T12:00:00.000Z',
      }),
      OWNER,
    );
    expect(classified).toMatchObject({
      status: 'trusted',
      entitlement: { expiresAt: '2026-07-06T12:00:00.000Z' },
    });
    if (classified.status !== 'trusted' || !classified.entitlement) throw new Error('test');
    expect(
      classifyEntitlementEvidence(
        classified.entitlement,
        '2026-07-06T11:59:59.999Z',
        'production',
      ),
    ).not.toBe('expired');
    expect(
      classifyEntitlementEvidence(
        classified.entitlement,
        '2026-07-06T12:00:00.000Z',
        'production',
      ),
    ).toBe('expired');
  });

  it('bounds active billing-recovery evidence without a usable future expiry to 72 hours', () => {
    const classified = classifyRevenueCatEntitlement(
      customerInfo({
        expirationDate: '2026-07-05T11:00:00.000Z',
        gracePeriodExpiresDate: null,
      }),
      OWNER,
    );
    expect(classified).toMatchObject({
      status: 'trusted',
      entitlement: { isActive: true, expiresAt: null },
    });
    if (classified.status !== 'trusted' || !classified.entitlement) throw new Error('test');
    expect(
      classifyEntitlementEvidence(
        classified.entitlement,
        '2026-07-08T11:59:59.999Z',
        'production',
      ),
    ).toBe('reconciliation_due');
    expect(
      classifyEntitlementEvidence(
        classified.entitlement,
        '2026-07-08T12:00:00.000Z',
        'production',
      ),
    ).toBe('stale');
  });

  it('rejects time-boxed recovery without an exact future boundary', () => {
    const classified = classifyRevenueCatEntitlement(
      customerInfo({
        periodType: 'TRIAL',
        expirationDate: '2026-07-05T11:00:00.000Z',
        gracePeriodExpiresDate: null,
      }),
      OWNER,
    );
    expect(classified).toEqual({ status: 'untrusted', reason: 'unsupported' });
  });

  it('uses the later of a future expiration and future grace boundary', () => {
    const classified = classifyRevenueCatEntitlement(
      customerInfo({
        expirationDate: '2026-08-05T12:00:00.000Z',
        gracePeriodExpiresDate: '2026-07-06T12:00:00.000Z',
      }),
      OWNER,
    );
    expect(classified).toMatchObject({
      status: 'trusted',
      entitlement: { expiresAt: '2026-08-05T12:00:00.000Z' },
    });
  });

  it('revokes inactive/refunded evidence immediately even with a future expiry', () => {
    const classified = classifyRevenueCatEntitlement(
      customerInfo({ active: false }),
      OWNER,
    );
    expect(classified).toMatchObject({
      status: 'trusted',
      entitlement: { isActive: false },
    });
    if (classified.status !== 'trusted' || !classified.entitlement) throw new Error('test');
    expect(classifyEntitlementEvidence(classified.entitlement, REQUEST, 'production')).toBe(
      'expired',
    );
  });

  it.each([
    ['unknown period', { periodType: 'FUTURE_TRIAL' }],
    ['unknown store', { store: 'SIDE_LOAD' }],
  ])('rejects cryptographically verified %s instead of collapsing it to null', (_name, options) => {
    expect(
      classifyRevenueCatEntitlement(customerInfo(options), OWNER),
    ).toEqual({ status: 'untrusted', reason: 'unsupported' });
  });
});
