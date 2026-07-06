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

  it('keeps onboarding fixed-footer screens scrollable above phone actions', () => {
    const goals = readAppRoute('onboarding/goals.tsx');
    const quiz = readAppRoute('onboarding/quiz.tsx');
    const products = readAppRoute('onboarding/products.tsx');

    expect(goals).toContain('<View className="flex-1 overflow-hidden">');
    expect(quiz).toContain('<View className="flex-1 overflow-hidden">');
    expect(products).toContain('<View className="flex-1 overflow-hidden">');
    expect(goals).toMatch(/<ScrollView\s+className="flex-1"\s+showsVerticalScrollIndicator/);
    expect(quiz).toMatch(/<ScrollView\s+className="flex-1"\s+showsVerticalScrollIndicator/);
    expect(products).toMatch(
      /<ScrollView\s+ref={scrollRef}\s+className="flex-1"\s+showsVerticalScrollIndicator/,
    );
    expect(goals).not.toMatch(/<ScrollView\s+className="flex-1 overflow-hidden"/);
    expect(quiz).not.toMatch(/<ScrollView\s+className="flex-1 overflow-hidden"/);
    expect(products).not.toMatch(/<ScrollView\s+className="flex-1 overflow-hidden"/);
    expect(goals).toContain('const compactPhone = height < 640');
    expect(quiz).toContain('const compactPhone = height < 640');
    expect(products).toContain('const compactPhone = height < 640');
    expect(products).toContain('const compactFooterAdds = compactPhone && name.trim().length > 0');
    expect(products).toContain('const scrollRef = useRef<ScrollView>(null)');
    expect(products).toContain('scrollRef.current?.scrollToEnd({ animated: true })');
    expect(products).toContain('if (compactPhone) scrollToShelfList()');
    expect(goals).toContain("className={compactPhone ? 'mt-5' : 'mt-8'}");
    expect(goals).toContain("className={compactPhone ? 'mt-4 gap-1' : 'mt-6 gap-3'}");
    expect(quiz).toContain("className={compactPhone ? 'mt-5' : 'mt-7'}");
    expect(quiz).toContain("className={compactPhone ? 'mt-4 gap-2' : 'mt-6 gap-3'}");
    expect(products).toContain("className={compactPhone ? 'mt-4' : 'mt-6'}");
    expect(products).toContain("className={compactPhone ? 'mt-4 p-4' : 'mt-6'}");
    expect(products).toContain(
      "className={compactPhone ? 'flex-row flex-wrap gap-1' : 'flex-row flex-wrap gap-2'}",
    );
    expect(goals).toContain('compact={compactPhone}');
    expect(quiz).toContain('compact={compactPhone}');
    expect(goals).toContain('tight={compactPhone}');
    expect(quiz).toContain('tight={compactPhone}');
    expect(goals).toContain('contentContainerClassName="pb-28"');
    expect(quiz).toContain('contentContainerClassName="pb-28"');
    expect(products).toContain('contentContainerClassName="pb-28"');
    expect(goals).toContain('className="bg-paper pb-4 pt-2"');
    expect(quiz).toContain('className="bg-paper pb-4 pt-2"');
    expect(products).toContain('className="bg-paper pb-4 pt-2"');
    expect(products).toContain(
      "compactFooterAdds ? 'Add to shelf' : added.length > 0 ? 'Continue' : 'Skip for now'",
    );
    expect(products).toContain('onPress={compactFooterAdds ? () => void add() : go}');
    expect(products).toContain('{!compactPhone ? (');
    expect(goals).not.toContain('contentContainerClassName="pb-4"');
    expect(quiz).not.toContain('contentContainerClassName="pb-4"');
    expect(products).not.toContain('contentContainerClassName="pb-4"');
    expect(goals).not.toContain('<View className="pb-4">');
    expect(quiz).not.toContain('<View className="pb-4">');
    expect(products).not.toContain('<View className="pb-4">');
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
    expect(source).toContain('const compactPhone = height < 640');
    expect(source).toContain('<View className="flex-1 overflow-hidden">');
    expect(source).toMatch(
      /<ScrollView\s+ref={scrollRef}\s+className="flex-1"\s+showsVerticalScrollIndicator/,
    );
    expect(source).not.toMatch(/<ScrollView\s+className="flex-1 overflow-hidden"/);
    expect(source).toContain('const scrollRef = useRef<ScrollView>(null)');
    expect(source).toContain('scrollRef.current?.scrollTo({ y: 0, animated: true })');
    expect(source.indexOf('HEALTH_DATA_CONSENT.declinedTitle')).toBeLessThan(
      source.indexOf('<Card className={compactPhone'),
    );
    expect(source).toContain(
      "contentContainerClassName={compactPhone ? 'pb-8 pt-8' : 'pb-6 pt-10'}",
    );
    expect(source).toContain("className={compactPhone ? 'mt-5 p-4' : 'mt-7'}");
    expect(source).toContain('compact={compactPhone}');
    expect(source).toContain('className="bg-paper pb-4 pt-2"');
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
