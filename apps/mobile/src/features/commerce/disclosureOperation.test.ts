import { describe, expect, it, vi } from 'vitest';

import { runCommerceDisclosure } from './disclosureOperation';

describe('COM-01A commerce disclosure operation', () => {
  it('returns closed without refreshing consent or running either effect', async () => {
    const refreshConsent = vi.fn(async () => true);
    const confirmServerClick = vi.fn(async () => undefined);
    const finalAction = vi.fn(async () => undefined);

    await expect(
      runCommerceDisclosure({ refreshConsent, confirmServerClick, finalAction }),
    ).resolves.toBe('consent_closed');
    expect(refreshConsent).not.toHaveBeenCalled();
    expect(confirmServerClick).not.toHaveBeenCalled();
    expect(finalAction).not.toHaveBeenCalled();
  });

  it('does not inspect an adversarial callback container', async () => {
    const params = new Proxy(
      {},
      {
        get() {
          throw new Error('commerce disclosure input was inspected');
        },
      },
    );

    await expect(runCommerceDisclosure(params as never)).resolves.toBe('consent_closed');
  });
});
