export type ReduceMotionPreference = boolean | null;
export type MotionModalAnimation = 'fade' | 'none' | 'slide';

export function shouldReduceMotion(preference: ReduceMotionPreference): boolean {
  return preference !== false;
}

export function motionAllowed(preference: ReduceMotionPreference): boolean {
  return preference === false;
}

export function motionAwareModalAnimation<TAnimation extends Exclude<MotionModalAnimation, 'none'>>(
  preference: ReduceMotionPreference,
  animation: TAnimation,
): TAnimation | 'none' {
  return motionAllowed(preference) ? animation : 'none';
}

export function devReduceMotionFixture(
  value: string | undefined,
  development: boolean,
): ReduceMotionPreference {
  if (!development) return null;
  if (value === 'enabled') return true;
  if (value === 'disabled') return false;
  return null;
}
