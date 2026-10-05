import { beforeEach, describe, expect, it } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  captureProgressCaptureAuthority,
  isProgressCaptureAuthorityCurrent,
  PROGRESS_CAPTURE_AUTHORITY_CONFLICT,
  releaseProgressCaptureAuthority,
  reserveProgressCaptureAuthority,
} from './progressCaptureAuthority';

const SESSION_ID = '123e4567-e89b-42d3-a456-426614174000';

describe('Progress capture authority binding', () => {
  beforeEach(() => {
    releaseProgressCaptureAuthority(SESSION_ID);
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'user-a',
      accountGeneration: 0,
    });
  });

  it('keeps one capture session bound to the exact shutter-time authority', () => {
    const authority = captureProgressCaptureAuthority();

    reserveProgressCaptureAuthority(SESSION_ID, authority);

    expect(isProgressCaptureAuthorityCurrent(SESSION_ID)).toBe(true);
    releaseProgressCaptureAuthority(SESSION_ID);
    expect(isProgressCaptureAuthorityCurrent(SESSION_ID)).toBe(false);
  });

  it('cannot inherit a later health re-grant or re-bind the stale session', () => {
    reserveProgressCaptureAuthority(SESSION_ID, captureProgressCaptureAuthority());

    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'user-a',
      accountGeneration: 0,
    });

    expect(isProgressCaptureAuthorityCurrent(SESSION_ID)).toBe(false);
    expect(() =>
      reserveProgressCaptureAuthority(SESSION_ID, captureProgressCaptureAuthority()),
    ).toThrow(PROGRESS_CAPTURE_AUTHORITY_CONFLICT);
  });

  it('invalidates the captured session across a real account identity boundary', () => {
    reserveProgressCaptureAuthority(SESSION_ID, captureProgressCaptureAuthority());

    beginAccountGenerationBoundary();
    try {
      expect(isProgressCaptureAuthorityCurrent(SESSION_ID)).toBe(false);
    } finally {
      endAccountGenerationBoundary();
    }

    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'user-b',
      accountGeneration: 1,
    });
    expect(isProgressCaptureAuthorityCurrent(SESSION_ID)).toBe(false);
  });
});
