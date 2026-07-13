import { describe, expect, it } from 'vitest';

import { routineGateFeatureForPath } from './gatedRoutes';

describe('routine route gate mapping', () => {
  it('uses the full-routine paywall for routine intelligence routes', () => {
    for (const path of [
      '/routine/plan',
      '/routine/reorder',
      '/routine/ramp',
      '/routine/tolerance',
      '/routine/adaptation',
    ]) {
      expect(routineGateFeatureForPath(path)).toBe('full_routine');
    }
  });

  it('uses the reminders paywall for streak routes', () => {
    for (const path of ['/routine/streak', '/routine/welcome-back']) {
      expect(routineGateFeatureForPath(path)).toBe('reminders_widgets');
    }
  });

  it('does not put the unavailable widgets route behind a paywall', () => {
    expect(routineGateFeatureForPath('/routine/widgets')).toBeNull();
  });

  it('ignores query and hash suffixes when mapping a route', () => {
    expect(routineGateFeatureForPath('/routine/widgets?source=you#top')).toBeNull();
    expect(routineGateFeatureForPath('/routine/plan?source=reveal#start')).toBe('full_routine');
  });
});
