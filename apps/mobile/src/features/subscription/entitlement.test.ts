import { describe, expect, it } from 'vitest';

import {
  canStartContextualReverseTrial,
  daysUntil,
  deriveState,
  type StoredEntitlement,
} from './entitlement';

const NOW = '2026-06-13T12:00:00.000Z';

function ent(over: Partial<StoredEntitlement>): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'routinekind_pro_annual_dev',
    expiresAt: null,
    willRenew: true,
    grantedAt: NOW,
    ...over,
  };
}

describe('entitlement state (docs/08 §4. Gate on is_active regardless of source)', () => {
  it('no record → free, not expired', () => {
    const s = deriveState(null, NOW);
    expect(s).toMatchObject({ tier: 'free', isPro: false, expired: false });
  });

  it('active reverse trial → Pro, inReverseTrial, days left', () => {
    const s = deriveState(
      ent({
        periodType: 'reverse_trial',
        store: 'app_granted',
        expiresAt: '2026-06-18T12:00:00.000Z',
      }),
      NOW,
    );
    expect(s.isPro).toBe(true);
    expect(s.tier).toBe('pro');
    expect(s.inReverseTrial).toBe(true);
    expect(s.inTrial).toBe(false);
    expect(s.daysLeft).toBe(5);
  });

  it('active carded trial → Pro, inTrial', () => {
    const s = deriveState(ent({ periodType: 'trial', expiresAt: '2026-06-27T12:00:00.000Z' }), NOW);
    expect(s.isPro).toBe(true);
    expect(s.inTrial).toBe(true);
    expect(s.daysLeft).toBe(14);
  });

  it('active paid subscription → Pro, willRenew surfaced', () => {
    const s = deriveState(ent({ expiresAt: '2027-06-27T12:00:00.000Z', willRenew: true }), NOW);
    expect(s.isPro).toBe(true);
    expect(s.periodType).toBe('normal');
    expect(s.willRenew).toBe(true);
  });

  it('lapsed by date → free + expired (graceful downgrade framing)', () => {
    const s = deriveState(ent({ expiresAt: '2026-06-10T12:00:00.000Z' }), NOW);
    expect(s.isPro).toBe(false);
    expect(s.tier).toBe('free');
    expect(s.expired).toBe(true);
  });

  it('deactivated (is_active false) → free + expired', () => {
    expect(deriveState(ent({ isActive: false }), NOW).expired).toBe(true);
  });

  it('pro_plus passes through', () => {
    expect(deriveState(ent({ tier: 'pro_plus' }), NOW).tier).toBe('pro_plus');
  });
});

describe('daysUntil', () => {
  it('rounds up to whole days, floors at 0', () => {
    expect(daysUntil('2026-06-18T12:00:00.000Z', NOW)).toBe(5);
    expect(daysUntil('2026-06-10T12:00:00.000Z', NOW)).toBe(0);
    expect(daysUntil(null, NOW)).toBeNull();
  });
});

describe('contextual reverse-trial eligibility', () => {
  it('offers the no-card value path only before any prior entitlement', () => {
    expect(canStartContextualReverseTrial(deriveState(null, NOW))).toBe(true);
    expect(
      canStartContextualReverseTrial(
        deriveState(
          ent({
            periodType: 'reverse_trial',
            store: 'app_granted',
            expiresAt: '2026-06-18T12:00:00.000Z',
          }),
          NOW,
        ),
      ),
    ).toBe(false);
    expect(
      canStartContextualReverseTrial(
        deriveState(
          ent({
            periodType: 'reverse_trial',
            store: 'app_granted',
            expiresAt: '2026-06-10T12:00:00.000Z',
          }),
          NOW,
        ),
      ),
    ).toBe(false);
    expect(
      canStartContextualReverseTrial(
        deriveState(ent({ periodType: 'normal', expiresAt: '2026-06-10T12:00:00.000Z' }), NOW),
      ),
    ).toBe(false);
  });
});
