import { describe, expect, it } from 'vitest';

import { shouldTrackCycleNightCompleted } from './cycleCompletion';

describe('cycle night completion analytics gate', () => {
  const stepKeys = ['PM:cleanser', 'PM:retinoid', 'PM:moisturiser'];

  it('fires when the latest PM check-off completes every scheduled cycle-night step', () => {
    expect(
      shouldTrackCycleNightCompleted({
        completedAfter: new Set(stepKeys),
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        changed: true,
      }),
    ).toBe(true);
  });

  it('waits until all PM steps are complete', () => {
    expect(
      shouldTrackCycleNightCompleted({
        completedAfter: new Set(['PM:cleanser', 'PM:retinoid']),
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        changed: true,
      }),
    ).toBe(false);
  });

  it('does not fire for AM, non-cycle, empty, or rejected completions', () => {
    const completedAfter = new Set(stepKeys);

    expect(
      shouldTrackCycleNightCompleted({
        completedAfter,
        cycleActive: true,
        phase: 'AM',
        stepKeys,
        changed: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedAfter,
        cycleActive: false,
        phase: 'PM',
        stepKeys,
        changed: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedAfter,
        cycleActive: true,
        phase: 'PM',
        stepKeys: [],
        changed: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedAfter,
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        changed: false,
      }),
    ).toBe(false);
  });
});
