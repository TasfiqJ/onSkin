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

  it('uses the reminders/widgets paywall for streak and widget routes', () => {
    for (const path of ['/routine/streak', '/routine/welcome-back', '/routine/widgets']) {
      expect(routineGateFeatureForPath(path)).toBe('reminders_widgets');
    }
  });

  it('ignores query and hash suffixes when mapping a route', () => {
    expect(routineGateFeatureForPath('/routine/widgets?source=you#top')).toBe('reminders_widgets');
    expect(routineGateFeatureForPath('/routine/plan?source=reveal#start')).toBe('full_routine');
  });
});
