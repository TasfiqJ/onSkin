import { afterEach, describe, expect, it } from 'vitest';

import { canUseRoutineCadence, ROUTINE_CADENCE_REVIEWED } from './reviewGate';

afterEach(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
  delete process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE;
});

describe('routine cadence review gate', () => {
  it('keeps unreviewed cadence available in dev for buildability', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
    expect(canUseRoutineCadence()).toBe(true);
  });

  it('withholds cadence outside dev until clinical review flips the gate', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
    expect(canUseRoutineCadence()).toBe(false);
  });

  it('can force the unreviewed cadence gate closed in dev for E2E coverage', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'closed';

    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
    expect(canUseRoutineCadence()).toBe(false);
  });

  it('does not let the E2E fixture open unreviewed cadence outside dev', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'open';

    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
    expect(canUseRoutineCadence()).toBe(false);
  });
});
