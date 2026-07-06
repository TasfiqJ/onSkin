import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyAskConsentChoice } from './applyConsentChoice';

const deps = {
  grant: vi.fn<() => Promise<void>>(),
  revoke: vi.fn<() => Promise<void>>(),
  onSaved: vi.fn<() => void>(),
  onFailure: vi.fn<() => void>(),
  invalidate: vi.fn<() => Promise<unknown>>(),
};

describe('Ask consent choice application', () => {
  beforeEach(() => {
    deps.grant.mockReset();
    deps.revoke.mockReset();
    deps.onSaved.mockReset();
    deps.onFailure.mockReset();
    deps.invalidate.mockReset();
    deps.grant.mockResolvedValue(undefined);
    deps.revoke.mockResolvedValue(undefined);
    deps.invalidate.mockResolvedValue(undefined);
  });

  it('saves granted consent before applying visible state', async () => {
    await expect(applyAskConsentChoice(true, deps)).resolves.toBe(true);

    expect(deps.grant).toHaveBeenCalledTimes(1);
    expect(deps.revoke).not.toHaveBeenCalled();
    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
    expect(deps.invalidate).toHaveBeenCalledTimes(1);
  });

  it('saves revoked consent before applying visible state', async () => {
    await expect(applyAskConsentChoice(false, deps)).resolves.toBe(true);

    expect(deps.revoke).toHaveBeenCalledTimes(1);
    expect(deps.grant).not.toHaveBeenCalled();
    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
    expect(deps.invalidate).toHaveBeenCalledTimes(1);
  });

  it('fails closed and refreshes stale state when persistence rejects', async () => {
    deps.revoke.mockRejectedValueOnce(new Error('withdrawal unavailable'));

    await expect(applyAskConsentChoice(false, deps)).resolves.toBe(false);

    expect(deps.onFailure).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).not.toHaveBeenCalled();
    expect(deps.invalidate).toHaveBeenCalledTimes(1);
  });
});
