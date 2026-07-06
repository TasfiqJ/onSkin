import { describe, expect, it } from 'vitest';

import {
  HEALTH_DATA_CONSENT,
  PHOTO_CAPTURE_CONSENT,
  PHOTO_CLOUD_BACKUP_CONSENT,
} from './consentCopy';

const visibleConsentCopy = [
  HEALTH_DATA_CONSENT.what,
  HEALTH_DATA_CONSENT.why,
  HEALTH_DATA_CONSENT.never,
  HEALTH_DATA_CONSENT.footnote,
  HEALTH_DATA_CONSENT.declineCta,
  HEALTH_DATA_CONSENT.declinedTitle,
  HEALTH_DATA_CONSENT.declinedBody,
  HEALTH_DATA_CONSENT.saveFailedTitle,
  HEALTH_DATA_CONSENT.saveFailedBody,
  PHOTO_CAPTURE_CONSENT.what,
  PHOTO_CAPTURE_CONSENT.why,
  PHOTO_CAPTURE_CONSENT.never,
  PHOTO_CAPTURE_CONSENT.footnote,
  PHOTO_CLOUD_BACKUP_CONSENT.what,
  PHOTO_CLOUD_BACKUP_CONSENT.why,
  PHOTO_CLOUD_BACKUP_CONSENT.never,
  PHOTO_CLOUD_BACKUP_CONSENT.footnote,
];

describe('visible consent copy', () => {
  it('does not expose placeholder markers in user-facing consent screens', () => {
    expect(visibleConsentCopy).not.toContainEqual(expect.stringMatching(/placeholder/i));
  });
});
