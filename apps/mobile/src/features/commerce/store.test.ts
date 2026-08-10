import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COMMERCE_ADMISSION_CLOSED } from './admission';
import {
  clearCommerceState,
  getCommerceConsentLocal,
  recordClick,
  setCommerceConsentLocal,
} from './store';

const mocks = vi.hoisted(() => ({
  removePrivateItem: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  removePrivateItem: mocks.removePrivateItem,
}));

describe('COM-01A commerce persistence boundary', () => {
  beforeEach(() => {
    mocks.removePrivateItem.mockReset();
    mocks.removePrivateItem.mockResolvedValue(undefined);
  });

  it('always reads local commerce authority as false without storage access', async () => {
    await expect(getCommerceConsentLocal()).resolves.toBe(false);
    expect(mocks.removePrivateItem).not.toHaveBeenCalled();
  });

  it('throws before storage when a positive local grant is attempted', async () => {
    await expect(setCommerceConsentLocal(true)).rejects.toThrow(COMMERCE_ADMISSION_CLOSED);
    expect(mocks.removePrivateItem).not.toHaveBeenCalled();
  });

  it('preserves explicit negative and deletion cleanup', async () => {
    await expect(setCommerceConsentLocal(false)).resolves.toBeUndefined();
    await expect(clearCommerceState()).resolves.toBeUndefined();
    expect(mocks.removePrivateItem).toHaveBeenNthCalledWith(1, 'layerwell.commerceConsent.v1');
    expect(mocks.removePrivateItem).toHaveBeenNthCalledWith(2, 'layerwell.commerceConsent.v1');
  });

  it('rejects click persistence before inspecting an adversarial payload', async () => {
    const payload = new Proxy(
      {},
      {
        get() {
          throw new Error('payload was inspected');
        },
      },
    );

    await expect(recordClick(payload as never)).rejects.toThrow(COMMERCE_ADMISSION_CLOSED);
  });
});
