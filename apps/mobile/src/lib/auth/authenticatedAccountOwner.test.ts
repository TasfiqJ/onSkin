import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from './accountGeneration';
import { captureAuthenticatedAccountOwner } from './authenticatedAccountOwner';

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock('../supabase/client', () => ({
  supabase: { auth: { getUser: mocks.getUser } },
}));

let boundaryActive = false;

afterEach(() => {
  mocks.getUser.mockReset();
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('authenticated account owner capture', () => {
  it('returns the current authenticated owner', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: ' owner-a ' } },
      error: null,
    });

    await expect(
      runAccountGenerationOperation((lease) => captureAuthenticatedAccountOwner(lease)),
    ).resolves.toEqual({ userId: 'owner-a' });
  });

  it('cannot hold account isolation on a never-resolving auth request', async () => {
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.getUser.mockImplementation(() => {
      markStarted();
      return new Promise(() => undefined);
    });

    const capture = runAccountGenerationOperation((lease) =>
      captureAuthenticatedAccountOwner(lease),
    );
    await started;

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(capture).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
  });
});
