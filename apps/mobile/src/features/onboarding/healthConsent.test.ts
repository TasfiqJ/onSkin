import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HEALTH_DATA_CONSENT } from './consentCopy';
import {
  declineHealthDataCollectionConsent,
  grantHealthDataCollectionConsent,
} from './healthConsent';

const mocks = vi.hoisted(() => ({
  recordConsent: vi.fn(async () => {}),
}));

vi.mock('@/lib/consent/consent', () => ({
  recordConsent: mocks.recordConsent,
}));

describe('health-data onboarding consent', () => {
  beforeEach(() => {
    mocks.recordConsent.mockClear();
  });

  it('records an explicit grant before the quiz can start', async () => {
    await grantHealthDataCollectionConsent();

    expect(mocks.recordConsent).toHaveBeenCalledWith({
      type: 'health_data_collection',
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
  });

  it('records an explicit decline without granting quiz access', async () => {
    await declineHealthDataCollectionConsent();

    expect(mocks.recordConsent).toHaveBeenCalledWith({
      type: 'health_data_collection',
      granted: false,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.declineText,
    });
  });
});
