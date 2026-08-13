import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { devReduceMotionFixture, type ReduceMotionPreference } from './reduceMotionPolicy';

export {
  motionAllowed,
  motionAwareModalAnimation,
  shouldReduceMotion,
} from './reduceMotionPolicy';
export type { ReduceMotionPreference } from './reduceMotionPolicy';

export function useReduceMotionPreference(): ReduceMotionPreference {
  const fixture = devReduceMotionFixture(
    process.env.EXPO_PUBLIC_E2E_REDUCE_MOTION,
    typeof __DEV__ !== 'undefined' && __DEV__,
  );
  const [preference, setPreference] = useState<ReduceMotionPreference>(fixture);

  useEffect(() => {
    if (fixture !== null) return;

    let mounted = true;
    let receivedEvent = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      receivedEvent = true;
      if (mounted) setPreference(enabled);
    });

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !receivedEvent) setPreference(enabled);
      })
      .catch(() => {
        if (mounted && !receivedEvent) setPreference(true);
      });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [fixture]);

  return preference;
}
