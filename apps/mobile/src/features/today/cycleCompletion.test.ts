import { describe, expect, it } from 'vitest';

import { shouldTrackCycleNightCompleted } from './cycleCompletion';

describe('cycle night completion analytics gate', () => {
  const stepKeys = ['PM:cleanser', 'PM:retinoid', 'PM:moisturiser'];

  it('fires when the latest PM check-off completes every scheduled cycle-night step', () => {
    expect(
      shouldTrackCycleNightCompleted({
        completedBefore: new Set(['PM:cleanser', 'PM:retinoid']),
        completedKey: 'PM:moisturiser',
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        completionDone: true,
      }),
    ).toBe(true);
  });

  it('waits until all PM steps are complete', () => {
    expect(
      shouldTrackCycleNightCompleted({
        completedBefore: new Set(['PM:cleanser']),
        completedKey: 'PM:retinoid',
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        completionDone: true,
      }),
    ).toBe(false);
  });

  it('does not fire for AM, non-cycle, empty, or rejected completions', () => {
    const completedBefore = new Set(['PM:cleanser', 'PM:retinoid']);

    expect(
      shouldTrackCycleNightCompleted({
        completedBefore,
        completedKey: 'PM:moisturiser',
        cycleActive: true,
        phase: 'AM',
        stepKeys,
        completionDone: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedBefore,
        completedKey: 'PM:moisturiser',
        cycleActive: false,
        phase: 'PM',
        stepKeys,
        completionDone: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedBefore,
        completedKey: 'PM:moisturiser',
        cycleActive: true,
        phase: 'PM',
        stepKeys: [],
        completionDone: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedBefore,
        completedKey: 'PM:moisturiser',
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        completionDone: false,
      }),
    ).toBe(false);
  });
});
