import { describe, expect, it } from 'vitest';

import { deriveState, type SubscriptionState } from './entitlement';
import { env } from '@/lib/env';

import {
  admittedSuccessState,
  monotonicSuccessClockMs,
  SUCCESS_EVIDENCE_MAX_AGE_MS,
  successEvidenceBoundaryMs,
  type SuccessEntitlementQuery,
} from './successAdmission';
import { buildPaywallSuccessPresentation } from './successPresentation';

const NOW_MS = Date.parse('2026-08-04T12:00:00.000Z');
const NOW_ISO = new Date(NOW_MS).toISOString();
const FUTURE_ISO = new Date(NOW_MS + 7 * 86_400_000).toISOString();

function state(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    ...deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'normal',
        store: 'app_store',
        productId: env.revenueCatAnnualProductId,
        expiresAt: FUTURE_ISO,
        willRenew: true,
        grantedAt: NOW_ISO,
        source: 'revenuecat',
        environment: 'sandbox',
        managementUrl: null,
        verifiedAt: NOW_ISO,
        offeringId: 'default',
        packageId: 'annual',
        storeUserId: 'test-user',
        priceLabel: '$49.99',
      },
      NOW_ISO,
    ),
    ...overrides,
  };
}

function query(overrides: Partial<SuccessEntitlementQuery> = {}): SuccessEntitlementQuery {
  return {
    data: state(),
    isError: false,
    isFetchedAfterMount: true,
    isFetching: false,
    isLoading: false,
    ...overrides,
  };
}

describe('PAY-07 success admission', () => {
  it.each([
    { isFetchedAfterMount: false },
    { isFetching: true },
    { isLoading: true },
    { isError: true },
  ])('rejects cached, pending, or failed query state %#', (flags) => {
    expect(admittedSuccessState(query(flags), NOW_MS)).toBeNull();
  });

  it('rejects expired, malformed, or stale authority evidence', () => {
    expect(admittedSuccessState(query({ data: state({ expiresAt: NOW_ISO }) }), NOW_MS)).toBeNull();
    expect(
      admittedSuccessState(query({ data: state({ expiresAt: 'not-a-date' }) }), NOW_MS),
    ).toBeNull();
    expect(
      admittedSuccessState(
        query({ data: state({ verifiedAt: '2026-08-04T11:54:59.000Z' }) }),
        NOW_MS,
      ),
    ).toBeNull();
  });

  it('admits current, freshly verified, exact authority evidence', () => {
    expect(admittedSuccessState(query(), NOW_MS)).toEqual(state());
  });

  it('expires against the live clock even when the query update time is frozen', () => {
    expect(admittedSuccessState(query(), NOW_MS)).not.toBeNull();
    expect(admittedSuccessState(query(), NOW_MS + SUCCESS_EVIDENCE_MAX_AGE_MS + 1)).toBeNull();
    expect(successEvidenceBoundaryMs(state())).toBe(NOW_MS + SUCCESS_EVIDENCE_MAX_AGE_MS);
  });

  it('rejects a delayed result that completes after its evidence boundary', () => {
    const responseCompletedAtMs = NOW_MS + SUCCESS_EVIDENCE_MAX_AGE_MS + 1;
    expect(admittedSuccessState(query(), responseCompletedAtMs)).toBeNull();
  });

  it('never reopens stale evidence after a backward device-clock adjustment', () => {
    const closedAtMs = NOW_MS + SUCCESS_EVIDENCE_MAX_AGE_MS + 1;
    const retainedClockMs = monotonicSuccessClockMs(closedAtMs, NOW_MS - 60_000);
    expect(retainedClockMs).toBe(closedAtMs);
    expect(admittedSuccessState(query(), retainedClockMs)).toBeNull();
  });

  it('advances a scheduled timer past its boundary even after a pre-boundary clock rollback', () => {
    const boundaryMs = successEvidenceBoundaryMs(state());
    expect(boundaryMs).not.toBeNull();
    const rolledBackWallClockMs = NOW_MS - 60_000;
    const callbackClockMs = monotonicSuccessClockMs(
      NOW_MS,
      Math.max(rolledBackWallClockMs, boundaryMs! + 1),
    );
    expect(callbackClockMs).toBe(boundaryMs! + 1);
    expect(admittedSuccessState(query(), callbackClockMs)).toBeNull();
  });
});

describe('PAY-07 success claims', () => {
  it('renders a no-card, non-renewing app grant without a price claim', () => {
    const presentation = buildPaywallSuccessPresentation(
      state({ periodType: 'reverse_trial', store: 'app_granted', willRenew: false }),
      'August 11',
    );
    expect(presentation.body).toContain('You will not be charged automatically.');
    expect(presentation.body).not.toMatch(/\$|renew/i);
  });

  it('renders a RevenueCat-granted promotion as non-billing access', () => {
    const presentation = buildPaywallSuccessPresentation(
      state({ store: 'promotional', willRenew: false }),
      'August 11',
    );
    expect(presentation.body).toContain('does not charge or renew');
    expect(presentation.body).not.toContain('$49.99');
  });

  it.each(['$49.99', '$49.99/year', '$49.99/yr'])(
    'renders one cadence for an exact renewing price %s',
    (priceLabel) => {
      const presentation = buildPaywallSuccessPresentation(state({ priceLabel }), 'August 11');
      expect(presentation.body).toContain('$49.99/year');
      expect(presentation.body).not.toContain('/year/year');
      expect(presentation.metaRows).toContain('set to renew $49.99/yr');
    },
  );

  it.each(['$8.99', '$8.99/month', '$8.99/mo'])(
    'renders the exact monthly cadence for %s',
    (priceLabel) => {
      const presentation = buildPaywallSuccessPresentation(
        state({ productId: env.revenueCatMonthlyProductId, priceLabel }),
        'September 4',
      );
      expect(presentation.body).toContain('$8.99/month');
      expect(presentation.body).not.toMatch(/year|\/month\/month/i);
      expect(presentation.metaRows).toContain('set to renew $8.99/month');
    },
  );

  it('uses exact expiry and only a conditional reminder statement for a mid-trial entry', () => {
    const presentation = buildPaywallSuccessPresentation(
      state({ periodType: 'trial' }),
      'August 6',
    );
    expect(presentation.body).toContain('trial is active through August 6');
    expect(presentation.body).not.toMatch(/14 days|start now|we(?:’|')ll remind/i);
  });

  it('withholds renewal price copy when the product cadence is not exact', () => {
    const presentation = buildPaywallSuccessPresentation(
      state({ productId: 'unknown.product' }),
      'August 11',
    );
    expect(presentation.body).toContain('Check Subscription for current billing details.');
    expect(presentation.body).not.toContain('$49.99');
  });

  it('does not claim renewal for paid access with renewal disabled', () => {
    const presentation = buildPaywallSuccessPresentation(state({ willRenew: false }), 'August 11');
    expect(presentation.body).toContain('No renewal is scheduled.');
    expect(presentation.body).not.toContain('$49.99');
  });

  it('does not infer billing claims when an exact renewing price is unavailable', () => {
    const presentation = buildPaywallSuccessPresentation(state({ priceLabel: null }), 'August 11');
    expect(presentation.body).toContain('Check Subscription for current billing details.');
    expect(presentation.body).not.toMatch(/renews at|\$/i);
  });
});
