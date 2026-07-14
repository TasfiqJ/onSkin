import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_CONSENT,
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
  ACCOUNT_CONSENT.saveFailedBody,
  PHOTO_CAPTURE_CONSENT.title,
  PHOTO_CAPTURE_CONSENT.what,
  PHOTO_CAPTURE_CONSENT.why,
  PHOTO_CAPTURE_CONSENT.never,
  PHOTO_CAPTURE_CONSENT.footnote,
];

describe('visible consent copy', () => {
  it('does not expose placeholder markers in user-facing consent screens', () => {
    expect(visibleConsentCopy).not.toContainEqual(expect.stringMatching(/placeholder/i));
  });

  it('keeps photo capture consent honest about local-only backup tradeoffs', () => {
    const visibleCaptureCopy = [
      PHOTO_CAPTURE_CONSENT.title,
      PHOTO_CAPTURE_CONSENT.what,
      PHOTO_CAPTURE_CONSENT.why,
      PHOTO_CAPTURE_CONSENT.never,
      PHOTO_CAPTURE_CONSENT.footnote,
    ]
      .join(' ')
      .toLowerCase();

    expect(visibleCaptureCopy).toContain('cloud backup is not available in this build');
    expect(visibleCaptureCopy).toContain('lost phone');
    expect(visibleCaptureCopy).toContain('choosing not now keeps the camera closed');
    expect(visibleCaptureCopy).not.toContain('withdraw anytime in settings');
    expect(PHOTO_CAPTURE_CONSENT.fullText).toBe(
      [
        PHOTO_CAPTURE_CONSENT.title,
        `WHAT\n${PHOTO_CAPTURE_CONSENT.what}`,
        `WHY\n${PHOTO_CAPTURE_CONSENT.why}`,
        `NEVER\n${PHOTO_CAPTURE_CONSENT.never}`,
        PHOTO_CAPTURE_CONSENT.footnote,
      ].join('\n\n'),
    );
    expect(PHOTO_CAPTURE_CONSENT.version).toBe('draft-photo-v3-2026-07-14');
    expect(PHOTO_CLOUD_BACKUP_CONSENT.fullText.toLowerCase()).toContain('off until');
  });
});
