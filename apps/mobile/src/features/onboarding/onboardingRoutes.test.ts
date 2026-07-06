import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('onboarding route contracts', () => {
  it('keeps health-data consent fail-closed before quiz access', () => {
    const source = readAppRoute('onboarding/consent.tsx');

    expect(source).not.toContain('Non-fatal until the backend is configured');
    expect(source).toContain('setConsentSaveError(true)');
    expect(source).toContain('HEALTH_DATA_CONSENT.saveFailedTitle');
    expect(source).toContain('HEALTH_DATA_CONSENT.saveFailedBody');
    expect(source.indexOf('grantHealthDataCollectionConsent()')).toBeLessThan(
      source.indexOf("router.push('/onboarding/quiz')"),
    );
    expect(source.indexOf('declineHealthDataCollectionConsent()')).toBeLessThan(
      source.indexOf("track('health_consent_declined')"),
    );
  });

  it('does not reveal the profile after a failed local profile save', () => {
    const source = readAppRoute('onboarding/analyzing.tsx');

    expect(source).not.toContain('persistSkinProfile().catch(() => {})');
    expect(source).toContain('setSaveError(true)');
    expect(source).toContain('We could not save your profile.');
    expect(source).toContain("router.replace('/onboarding/reveal')");
    expect(source.indexOf('persistSkinProfile()')).toBeLessThan(
      source.indexOf("router.replace('/onboarding/reveal')"),
    );
  });
});
