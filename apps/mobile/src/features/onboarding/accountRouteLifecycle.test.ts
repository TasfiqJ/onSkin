import { describe, expect, it } from 'vitest';

import { canPublishAccountRouteRequest } from './accountRouteLifecycle';

const currentRequest = {
  currentRequestId: 12,
  focused: true,
  mounted: true,
  ownerCurrent: true,
  requestId: 12,
  requestSequence: 12,
} as const;

describe('account route async lifecycle', () => {
  it('allows publication only for the exact active focused request', () => {
    expect(canPublishAccountRouteRequest(currentRequest)).toBe(true);
  });

  it('suppresses publication immediately after focus generation changes', () => {
    expect(
      canPublishAccountRouteRequest({
        ...currentRequest,
        focused: false,
        requestSequence: 13,
      }),
    ).toBe(false);
  });

  it('suppresses publication after unmount even if a native promise resolves late', () => {
    expect(
      canPublishAccountRouteRequest({
        ...currentRequest,
        mounted: false,
        requestSequence: 13,
      }),
    ).toBe(false);
  });

  it('suppresses publication after an owner boundary or newer request', () => {
    expect(canPublishAccountRouteRequest({ ...currentRequest, ownerCurrent: false })).toBe(false);
    expect(
      canPublishAccountRouteRequest({
        ...currentRequest,
        currentRequestId: 14,
        requestSequence: 14,
      }),
    ).toBe(false);
  });
});
