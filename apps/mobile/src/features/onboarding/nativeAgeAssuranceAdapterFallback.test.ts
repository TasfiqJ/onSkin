import { describe, expect, it } from 'vitest';

import { NATIVE_AGE_ASSURANCE_UNAVAILABLE } from './nativeAgeAssuranceContract';
import {
  nativeAgeAssuranceAvailability,
  requestNativeAgeAssurance,
} from './nativeAgeAssuranceAdapter';

describe('non-iOS native age-assurance adapter', () => {
  it('is unavailable and never performs an age-assurance request', async () => {
    expect(nativeAgeAssuranceAvailability()).toBe('unavailable');
    await expect(requestNativeAgeAssurance('10000000-0000-4000-8000-000000000001')).rejects.toThrow(
      NATIVE_AGE_ASSURANCE_UNAVAILABLE,
    );
  });
});
