import { describe, expect, it } from 'vitest';

import { askGate, ASK_TRIAL_GROUNDED_CAP } from './gate';

// The grounded-turn gate (docs/13 §15). Deterministic answers are always free; only the
// cloud-grounded layer is Pro-gated, capped during the trial, uncapped when fully paid.

describe('free users: the grounded layer is Pro (the deterministic advisor stays free)', () => {
  it('blocks grounded turns with reason free_locked', () => {
    const g = askGate({ isPro: false, inTrial: false, inReverseTrial: false, groundedTurnsUsed: 0 });
    expect(g.groundedAllowed).toBe(false);
    expect(g.reason).toBe('free_locked');
  });
});

describe('trial / reverse-trial: a hard cap on the grounded taste', () => {
  it('allows grounded turns under the cap and reports remaining', () => {
    const g = askGate({ isPro: true, inTrial: true, inReverseTrial: false, groundedTurnsUsed: 2 });
    expect(g.groundedAllowed).toBe(true);
    expect(g.remaining).toBe(ASK_TRIAL_GROUNDED_CAP - 2);
  });
  it('blocks once the cap is reached, with reason cap_reached', () => {
    const g = askGate({
      isPro: true,
      inTrial: false,
      inReverseTrial: true,
      groundedTurnsUsed: ASK_TRIAL_GROUNDED_CAP,
    });
    expect(g.groundedAllowed).toBe(false);
    expect(g.capReached).toBe(true);
    expect(g.reason).toBe('cap_reached');
    expect(g.remaining).toBe(0);
  });
});

describe('fully paid: uncapped', () => {
  it('always allows grounded turns, with null remaining', () => {
    const g = askGate({ isPro: true, inTrial: false, inReverseTrial: false, groundedTurnsUsed: 999 });
    expect(g.groundedAllowed).toBe(true);
    expect(g.reason).toBeNull();
    expect(g.remaining).toBeNull();
  });
});
