import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_CONSENT,
  CONSENT_COPY_VERSION,
  assertHealthDataConsentCopyReleaseAllowed,
  HEALTH_DATA_CONSENT,
  HEALTH_DATA_CONSENT_COPY_RELEASE_BLOCKED,
  HEALTH_DATA_CONSENT_COPY_REVIEW_STATUS,
  HEALTH_DATA_WITHDRAWAL,
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
  it('matches the server allowlisted health-consent contract exactly', () => {
    const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

    expect(CONSENT_COPY_VERSION).toBe('draft-v1-2026-07-10');
    expect(sha256(HEALTH_DATA_CONSENT.fullText)).toBe(
      '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
    );
    expect(sha256(HEALTH_DATA_CONSENT.declineText)).toBe(
      '6a34a4d3b8086a0ee86951261f612c502bd4376bc8378cf22533b49817cdedea',
    );
    expect(sha256(HEALTH_DATA_WITHDRAWAL.fullText)).toBe(
      '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f',
    );
  });

  it('does not expose placeholder markers in user-facing consent screens', () => {
    expect(visibleConsentCopy).not.toContainEqual(expect.stringMatching(/placeholder/i));
  });

  it('blocks only new production grants while keeping withdrawal available', () => {
    expect(HEALTH_DATA_CONSENT_COPY_REVIEW_STATUS).toEqual({
      collection: 'draft_blocked',
      withdrawal: 'draft_blocked',
    });
    expect(() => assertHealthDataConsentCopyReleaseAllowed('grant', 'development')).not.toThrow();
    expect(() => assertHealthDataConsentCopyReleaseAllowed('grant', 'staging')).not.toThrow();
    expect(() => assertHealthDataConsentCopyReleaseAllowed('grant', 'production')).toThrow(
      HEALTH_DATA_CONSENT_COPY_RELEASE_BLOCKED,
    );
    expect(() =>
      assertHealthDataConsentCopyReleaseAllowed('withdrawal', 'production'),
    ).not.toThrow();
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
