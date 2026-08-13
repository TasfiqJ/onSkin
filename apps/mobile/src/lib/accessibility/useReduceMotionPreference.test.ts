import { describe, expect, it } from 'vitest';

import {
  devReduceMotionFixture,
  motionAllowed,
  motionAwareModalAnimation,
  shouldReduceMotion,
} from './reduceMotionPolicy';

describe('Reduce Motion policy', () => {
  it('fails safe while the platform preference is unresolved', () => {
    expect(shouldReduceMotion(null)).toBe(true);
    expect(motionAllowed(null)).toBe(false);
    expect(motionAwareModalAnimation(null, 'slide')).toBe('none');
  });

  it('disables optional motion when the platform preference is enabled', () => {
    expect(shouldReduceMotion(true)).toBe(true);
    expect(motionAllowed(true)).toBe(false);
    expect(motionAwareModalAnimation(true, 'fade')).toBe('none');
  });

  it('allows optional motion only after an explicit disabled preference', () => {
    expect(shouldReduceMotion(false)).toBe(false);
    expect(motionAllowed(false)).toBe(true);
    expect(motionAwareModalAnimation(false, 'slide')).toBe('slide');
  });

  it('keeps the E2E override development-only and explicit', () => {
    expect(devReduceMotionFixture('enabled', true)).toBe(true);
    expect(devReduceMotionFixture('disabled', true)).toBe(false);
    expect(devReduceMotionFixture('unknown', true)).toBeNull();
    expect(devReduceMotionFixture('enabled', false)).toBeNull();
  });
});
