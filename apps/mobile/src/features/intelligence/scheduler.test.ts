import { describe, expect, it } from 'vitest';

import { pickCycle, type SchedulerProfile } from './scheduler';

const base: SchedulerProfile = { sensitivity: 'neutral', goals: [], hasActives: true };

describe('cycle selection (docs/02 §5)', () => {
  it('no actives -> no cycle', () => {
    expect(pickCycle({ ...base, hasActives: false })).toBeNull();
  });
  it('sensitive -> gentle (more recovery nights)', () => {
    expect(pickCycle({ ...base, sensitivity: 'sensitive' })?.id).toBe('gentle_5');
  });
  it('barrier_repair goal -> gentle', () => {
    expect(pickCycle({ ...base, goals: ['barrier_repair'] })?.id).toBe('gentle_5');
  });
  it('resistant -> advanced', () => {
    expect(pickCycle({ ...base, sensitivity: 'resistant' })?.id).toBe('advanced_3');
  });
  it('neutral -> classic four-night', () => {
    expect(pickCycle(base)?.id).toBe('classic_4');
  });
});
