import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('onboarding route contracts', () => {
  it('keeps onboarding chip and product-remove controls touchable on phones', () => {
    const quiz = readAppRoute('onboarding/quiz.tsx');
    const products = readAppRoute('onboarding/products.tsx');

    expect(quiz).toContain('<Chip');
    expect(products).toContain('<Chip');
    expect(products).toContain('accessibilityLabel={`Remove ${it.name}`}');
    expect(products).toContain('className="h-12 w-12 items-center justify-center');
    expect(products).not.toContain('hitSlop={8}');
  });

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

  it('keeps health-data consent copy scrollable above buffered phone actions', () => {
    const source = readAppRoute('onboarding/consent.tsx');

    expect(source).toContain('ScrollView');
    expect(source).toContain('className="flex-1"');
    expect(source).toContain('contentContainerClassName="pb-6 pt-10"');
    expect(source).toContain('className="pb-6 pt-2"');
    expect(source).toContain('className="mt-3 min-h-[48px] items-center justify-center py-2"');
    expect(source).toContain('className="mt-1 min-h-[48px] items-center justify-center py-2"');
    expect(source).not.toContain('<View className="flex-1">');
    expect(source).not.toContain('className="mt-3 items-center py-3"');
    expect(source).not.toContain('className="mt-1 items-center py-3"');
  });

  it('keeps account onboarding fail-closed before account-created side effects', () => {
    const source = readAppRoute('onboarding/account.tsx');

    expect(source).not.toContain('best-effort until backend configured');
    expect(source).toContain('recordAccountConsent');
    expect(source).toContain('setError(ACCOUNT_CONSENT.saveFailedBody)');
    expect(source.indexOf('await recordAccountConsent()')).toBeLessThan(
      source.indexOf("track('account_created')"),
    );
    expect(source.indexOf('await recordAccountConsent()')).toBeLessThan(
      source.indexOf("router.replace('/onboarding/paywall')"),
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
