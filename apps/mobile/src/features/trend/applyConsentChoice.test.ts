import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyTrendConsentChoice } from './applyConsentChoice';

const deps = {
  grant: vi.fn<() => Promise<void>>(),
  revoke: vi.fn<() => Promise<void>>(),
  invalidate: vi.fn<() => Promise<unknown>>(),
  onFailure: vi.fn<() => void>(),
};

describe('trend consent choice application', () => {
  beforeEach(() => {
    deps.grant.mockReset();
    deps.revoke.mockReset();
    deps.invalidate.mockReset();
    deps.onFailure.mockReset();
    deps.grant.mockResolvedValue(undefined);
    deps.revoke.mockResolvedValue(undefined);
    deps.invalidate.mockResolvedValue(undefined);
  });

  it('grants consent and refreshes the visible consent state', async () => {
    await expect(applyTrendConsentChoice(true, deps)).resolves.toBe(true);

    expect(deps.grant).toHaveBeenCalledTimes(1);
    expect(deps.revoke).not.toHaveBeenCalled();
    expect(deps.invalidate).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('revokes consent and refreshes the visible consent state', async () => {
    await expect(applyTrendConsentChoice(false, deps)).resolves.toBe(true);

    expect(deps.revoke).toHaveBeenCalledTimes(1);
    expect(deps.grant).not.toHaveBeenCalled();
    expect(deps.invalidate).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('surfaces save failure and still refreshes stale consent state', async () => {
    deps.revoke.mockRejectedValueOnce(new Error('consent withdrawal failed'));

    await expect(applyTrendConsentChoice(false, deps)).resolves.toBe(false);

    expect(deps.onFailure).toHaveBeenCalledTimes(1);
    expect(deps.invalidate).toHaveBeenCalledTimes(1);
  });

  it('does not turn a saved choice into a failure when refresh fails', async () => {
    deps.invalidate.mockRejectedValueOnce(new Error('query cache unavailable'));

    await expect(applyTrendConsentChoice(true, deps)).resolves.toBe(true);

    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('does not block retry controls on a slow visible state refresh', async () => {
    let resolveInvalidate!: (value: unknown) => void;
    deps.invalidate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInvalidate = resolve;
      }),
    );

    const result = applyTrendConsentChoice(true, deps);

    await expect(
      Promise.race([result, new Promise((resolve) => setTimeout(() => resolve('blocked'), 0))]),
    ).resolves.toBe(true);
    expect(deps.invalidate).toHaveBeenCalledTimes(1);

    resolveInvalidate(undefined);
    await expect(result).resolves.toBe(true);
  });
});
