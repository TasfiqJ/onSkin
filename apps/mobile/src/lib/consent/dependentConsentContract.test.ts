import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  assertHealthDependentConsentCopyReleaseAllowed,
  HEALTH_DEPENDENT_CONSENT_COPY,
  HEALTH_DEPENDENT_CONSENT_COPY_RELEASE_BLOCKED,
  HEALTH_DEPENDENT_CONSENT_COPY_REVIEW_STATUS,
  HEALTH_DEPENDENT_CONSENT_TYPES,
} from './dependentConsentContract';

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(),
  getRandomBytesAsync: vi.fn(),
}));

describe('health-dependent consent copy contract', () => {
  it('pins the exact UTF-8 SHA-256 for every grant and withdrawal draft', () => {
    const actualHashes: Record<string, string> = {};
    const pinnedHashes: Record<string, string> = {};
    for (const type of HEALTH_DEPENDENT_CONSENT_TYPES) {
      for (const state of ['grant', 'withdrawal'] as const) {
        const copy = HEALTH_DEPENDENT_CONSENT_COPY[type][state];
        const key = `${type}:${state}`;
        actualHashes[key] = createHash('sha256').update(copy.text, 'utf8').digest('hex');
        pinnedHashes[key] = copy.sha256;
      }
    }
    expect(pinnedHashes).toEqual(actualHashes);
  });

  it('keeps every type/state pair explicit and immutable', () => {
    expect(Object.keys(HEALTH_DEPENDENT_CONSENT_COPY).sort()).toEqual(
      [...HEALTH_DEPENDENT_CONSENT_TYPES].sort(),
    );
    for (const type of HEALTH_DEPENDENT_CONSENT_TYPES) {
      expect(Object.keys(HEALTH_DEPENDENT_CONSENT_COPY[type]).sort()).toEqual([
        'grant',
        'withdrawal',
      ]);
      expect(Object.isFrozen(HEALTH_DEPENDENT_CONSENT_COPY[type])).toBe(true);
    }
  });

  it('blocks only new production grants while keeping withdrawal available', () => {
    for (const type of HEALTH_DEPENDENT_CONSENT_TYPES) {
      expect(HEALTH_DEPENDENT_CONSENT_COPY_REVIEW_STATUS[type]).toEqual({
        grant: 'draft_blocked',
        withdrawal: 'draft_blocked',
      });
      expect(() =>
        assertHealthDependentConsentCopyReleaseAllowed(type, 'grant', 'development'),
      ).not.toThrow();
      expect(() =>
        assertHealthDependentConsentCopyReleaseAllowed(type, 'grant', 'staging'),
      ).not.toThrow();
      expect(() =>
        assertHealthDependentConsentCopyReleaseAllowed(type, 'grant', 'production'),
      ).toThrow(HEALTH_DEPENDENT_CONSENT_COPY_RELEASE_BLOCKED);
      expect(() =>
        assertHealthDependentConsentCopyReleaseAllowed(type, 'withdrawal', 'production'),
      ).not.toThrow();
    }
  });
});
