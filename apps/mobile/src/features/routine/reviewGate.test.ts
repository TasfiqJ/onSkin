import { afterEach, describe, expect, it } from 'vitest';

import { canUseRoutineCadence, ROUTINE_CADENCE_REVIEWED } from './reviewGate';

afterEach(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
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
});
