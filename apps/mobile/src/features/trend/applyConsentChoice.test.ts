import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyTrendConsentChoice } from './applyConsentChoice';

const deps = {
  revoke: vi.fn<() => Promise<void>>(),
  invalidate: vi.fn<() => Promise<unknown>>(),
  onFailure: vi.fn<() => void>(),
};

describe('PHOTO-05A trend consent choice compatibility', () => {
  beforeEach(() => {
    deps.revoke.mockReset().mockResolvedValue(undefined);
    deps.invalidate.mockReset().mockResolvedValue(undefined);
    deps.onFailure.mockReset();
  });

  it('rejects a stale caller grant before any callback or cache side effect', async () => {
    await expect(applyTrendConsentChoice(true, deps)).resolves.toBe(false);

    expect(deps.revoke).not.toHaveBeenCalled();
    expect(deps.invalidate).not.toHaveBeenCalled();
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('preserves explicit legacy revocation and refreshes its visible state', async () => {
    await expect(applyTrendConsentChoice(false, deps)).resolves.toBe(true);

    expect(deps.revoke).toHaveBeenCalledOnce();
    expect(deps.invalidate).toHaveBeenCalledOnce();
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('surfaces revocation failure and still refreshes stale state', async () => {
    deps.revoke.mockRejectedValueOnce(new Error('consent withdrawal failed'));

    await expect(applyTrendConsentChoice(false, deps)).resolves.toBe(false);

    expect(deps.onFailure).toHaveBeenCalledOnce();
    expect(deps.invalidate).toHaveBeenCalledOnce();
  });

  it('does not turn completed revocation into a failure when refresh fails', async () => {
    deps.invalidate.mockRejectedValueOnce(new Error('query cache unavailable'));

    await expect(applyTrendConsentChoice(false, deps)).resolves.toBe(true);

    expect(deps.onFailure).not.toHaveBeenCalled();
  });
});
