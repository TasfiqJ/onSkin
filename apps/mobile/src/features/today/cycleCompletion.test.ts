import { describe, expect, it } from 'vitest';

import { shouldTrackCycleNightCompleted } from './cycleCompletion';

describe('cycle night completion analytics gate', () => {
  const stepKeys = ['PM:cleanser', 'PM:retinoid', 'PM:moisturiser'];

  it('fires when the latest PM check-off completes every scheduled cycle-night step', () => {
    expect(
      shouldTrackCycleNightCompleted({
        completedStepKeysAfter: new Set(stepKeys),
        completedKey: 'PM:moisturiser',
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        completionInserted: true,
      }),
    ).toBe(true);
  });

  it('waits until all PM steps are complete', () => {
    expect(
      shouldTrackCycleNightCompleted({
        completedStepKeysAfter: new Set(['PM:cleanser', 'PM:retinoid']),
        completedKey: 'PM:retinoid',
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        completionInserted: true,
      }),
    ).toBe(false);
  });

  it('does not fire for AM, non-cycle, empty, or rejected completions', () => {
    const completedStepKeysAfter = new Set(stepKeys);

    expect(
      shouldTrackCycleNightCompleted({
        completedStepKeysAfter,
        completedKey: 'PM:moisturiser',
        cycleActive: true,
        phase: 'AM',
        stepKeys,
        completionInserted: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedStepKeysAfter,
        completedKey: 'PM:moisturiser',
        cycleActive: false,
        phase: 'PM',
        stepKeys,
        completionInserted: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedStepKeysAfter,
        completedKey: 'PM:moisturiser',
        cycleActive: true,
        phase: 'PM',
        stepKeys: [],
        completionInserted: true,
      }),
    ).toBe(false);
    expect(
      shouldTrackCycleNightCompleted({
        completedStepKeysAfter,
        completedKey: 'PM:moisturiser',
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        completionInserted: false,
      }),
    ).toBe(false);
  });

  it('does not fire when the inserted key is outside the scheduled PM step set', () => {
    expect(
      shouldTrackCycleNightCompleted({
        completedStepKeysAfter: new Set([...stepKeys, 'PM:legacy-step']),
        completedKey: 'PM:legacy-step',
        cycleActive: true,
        phase: 'PM',
        stepKeys,
        completionInserted: true,
      }),
    ).toBe(false);
  });
});
