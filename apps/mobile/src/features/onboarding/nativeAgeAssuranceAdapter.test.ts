import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED } from './nativeAgeAssuranceContract';
import {
  nativeAgeAssuranceAvailability,
  requestNativeAgeAssurance,
} from './nativeAgeAssuranceAdapter.ios';

const REQUEST_ID = '10000000-0000-4000-8000-000000000001';

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  throwOnAccess: false,
  throwOnRequire: false,
}));

vi.mock('expo', () => ({
  requireOptionalNativeModule: () => {
    if (mocks.throwOnRequire) throw new Error('UNTRUSTED_NATIVE_REGISTRY_DETAIL');
    return new Proxy(
      {},
      {
        get: (_target, property) => {
          if (mocks.throwOnAccess) throw new Error('UNTRUSTED_NATIVE_GETTER_DETAIL');
          return mocks.values[String(property)];
        },
      },
    );
  },
}));

function configureNative(): void {
  Object.assign(mocks.values, {
    ageAssuranceContractVersion: 1,
    ageAssuranceReviewStatus: 'launch_blocked',
    ageAssuranceProvider: 'apple_declared_age_range',
    ageAssuranceMinimumAge: 16,
    ageAssuranceMinimumRuntime: 'iOS 26.2',
    ageAssuranceMinimumSdk: 'iOS 26.2',
    ageAssuranceExactBirthDateCollected: false,
    requestDeclaredAgeRangeJSON: vi.fn(),
  });
}

beforeEach(() => {
  mocks.throwOnAccess = false;
  mocks.throwOnRequire = false;
  for (const key of Object.keys(mocks.values)) delete mocks.values[key];
});

describe('iOS native age-assurance adapter', () => {
  it('distinguishes a missing module from a malformed native contract', () => {
    expect(nativeAgeAssuranceAvailability()).toBe('unavailable');

    configureNative();
    mocks.values.ageAssuranceMinimumAge = 18;
    expect(nativeAgeAssuranceAvailability()).toBe('misconfigured');

    configureNative();
    delete mocks.values.requestDeclaredAgeRangeJSON;
    expect(nativeAgeAssuranceAvailability()).toBe('misconfigured');
  });

  it('reports launch-blocked only for the exact reviewed source contract', () => {
    configureNative();
    expect(nativeAgeAssuranceAvailability()).toBe('launch_blocked');
  });

  it('fails throwing native access and registry lookup closed', async () => {
    mocks.throwOnAccess = true;
    expect(nativeAgeAssuranceAvailability()).toBe('misconfigured');

    mocks.throwOnRequire = true;
    vi.resetModules();
    const isolatedAdapter = await import('./nativeAgeAssuranceAdapter.ios');
    expect(isolatedAdapter.nativeAgeAssuranceAvailability()).toBe('unavailable');
  });

  it('cannot invoke Apple while launch evidence gates remain unsatisfied', async () => {
    configureNative();
    const nativeRequest = mocks.values.requestDeclaredAgeRangeJSON;

    await expect(requestNativeAgeAssurance(REQUEST_ID)).rejects.toThrow(
      NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED,
    );
    await expect(requestNativeAgeAssurance('invalid')).rejects.toThrow(
      NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED,
    );
    expect(nativeRequest).not.toHaveBeenCalled();
  });
});
