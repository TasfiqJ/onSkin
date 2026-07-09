import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('onboarding route contracts', () => {
  it('keeps first-run age gate copy free of mojibake punctuation', () => {
    const source = readAppRoute('onboarding/age.tsx');

    expect(source).toContain("We don't store your birth date.");
    expect(source).not.toContain('donâ');
    expect(source).not.toContain('â€™');
  });

  it('keeps the first-session E2E local reset dev-only and env-gated', () => {
    const source = readAppRoute('index.tsx');

    expect(source).toContain('useLocalSearchParams<{ e2eReset?: string }>()');
    expect(source).toContain('function shouldRunE2ELocalReset');
    expect(source).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(source).toContain("process.env.EXPO_PUBLIC_E2E_LOCAL_RESET !== '1'");
    expect(source).toContain("return value === 'local'");
    expect(source).toContain('clearLocalPrivateData');
    expect(source).toContain('queryClient.clear()');
    expect(source).toContain("router.replace('/')");
    expect(source).toContain('enabled: !resetting && !!session && !initializing');
    expect(source).toContain('const deciding = resetting || initializing ||');
  });

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
    const age = readAppRoute('onboarding/age.tsx');
    const goals = readAppRoute('onboarding/goals.tsx');
    const quiz = readAppRoute('onboarding/quiz.tsx');
    const products = readAppRoute('onboarding/products.tsx');

    expect(age).toContain('useWindowDimensions');
    expect(age).toContain('const compactPhone = height < 640');
    expect(age).toContain('<View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>');
    expect(age).toMatch(/<ScrollView\s+className="flex-1"\s+showsVerticalScrollIndicator/);
    expect(age).toContain("contentContainerClassName={compactPhone ? 'pb-28 pt-6' : 'pb-8 pt-10'}");
    expect(age).toContain(
      "className={compactPhone ? 'mt-5 flex-row gap-2' : 'mt-8 flex-row gap-3'}",
    );
    expect(age).toContain('className="bg-paper pb-4 pt-2"');
    expect(age).toContain('confirms your age before skin-health data');
    expect(age).not.toContain('<View className="flex-1 justify-center">');
    expect(goals).toContain('<View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>');
    expect(quiz).toContain('<View className="flex-1 overflow-hidden">');
    expect(products).toContain('className="flex-1 overflow-hidden"');
    expect(products).toContain('style={{ minHeight: 0 }}');
    expect(goals).toMatch(/<ScrollView\s+className="flex-1"\s+showsVerticalScrollIndicator/);
    expect(quiz).toMatch(/<ScrollView\s+className="flex-1"\s+showsVerticalScrollIndicator/);
    expect(products).toMatch(
      /<ScrollView\s+ref={scrollRef}\s+className="flex-1"\s+showsVerticalScrollIndicator/,
    );
    expect(goals).not.toMatch(/<ScrollView\s+className="flex-1 overflow-hidden"/);
    expect(quiz).not.toMatch(/<ScrollView\s+className="flex-1 overflow-hidden"/);
    expect(products).not.toMatch(/<ScrollView\s+className="flex-1 overflow-hidden"/);
    expect(goals).toContain('const compactPhone = height < 640');
    expect(goals).toContain('const splitShortPhone = height < 420');
    expect(quiz).toContain('const compactPhone = height < 640');
    expect(products).toContain('const compactPhone = height < 640');
    for (const source of [age, goals, products]) {
      expect(source).toContain('const supportFloorTextPressurePhone =');
      expect(source).toContain(
        "width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web')",
      );
    }
    for (const source of [age, goals]) {
      expect(source).toContain(
        'const compactPhone = height < 640 || supportFloorTextPressurePhone;',
      );
    }
    expect(products).toContain('const modernTextPressurePhone =');
    expect(products).toContain(
      "width <= 390 && height >= 800 && height < 900 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(products).toContain(
      'const compactPhone = height < 640 || supportFloorTextPressurePhone || modernTextPressurePhone;',
    );
    expect(products).toContain('const showIntroCopy = !modernTextPressurePhone;');
    expect(products).toContain('const showProgressBody = !modernTextPressurePhone;');
    expect(products).toContain('const compactFooterAdds = compactPhone && name.trim().length > 0');
    expect(products).toContain('const inputRef = useRef<TextInput>(null)');
    expect(products).toContain('placeholder="e.g. Retinol serum"');
    expect(products).not.toContain('placeholder="e.g. Retinol 0.3% Night Serum"');
    expect(products).toContain('const scrollRef = useRef<ScrollView>(null)');
    expect(products).toContain('scrollRef.current?.scrollToEnd({ animated: true })');
    expect(products).toContain('if (compactPhone) scrollToShelfList()');
    expect(products).toContain('scrollRef.current?.scrollTo({ y: 0, animated: true })');
    expect(products).toContain('inputRef.current?.focus()');
    expect(goals).toContain("splitShortPhone ? 'mt-3' : compactPhone ? 'mt-5' : 'mt-8'");
    expect(goals).toContain('function CompactGoalCard');
    expect(goals).toContain("width: '48%'");
    expect(goals).toContain('min-h-[74px] rounded-card');
    expect(goals).toContain('min-h-[60px] rounded-card');
    expect(goals).toContain('splitShort?: boolean');
    expect(goals).toContain('numberOfLines={splitShort ? 1 : 2}');
    expect(goals).toContain('splitShort={splitShortPhone}');
    expect(goals).toContain("'mt-4 flex-row flex-wrap gap-2'");
    expect(goals).toContain("'mt-2 flex-row flex-wrap gap-1.5'");
    expect(goals).toContain('<View className="mt-6 gap-3">');
    expect(quiz).toContain("className={compactPhone ? 'mt-5' : 'mt-7'}");
    expect(quiz).toContain("className={compactPhone ? 'mt-4 gap-2' : 'mt-6 gap-3'}");
    expect(products).toContain("className={compactPhone ? 'mt-4' : 'mt-6'}");
    expect(products).toContain(
      "className={modernTextPressurePhone ? 'mt-3 p-4' : compactPhone ? 'mt-4 p-4' : 'mt-6'}",
    );
    expect(products).toContain(
      'const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);',
    );
    expect(products).toContain('const selectedCategoryLabel =');
    expect(products).toContain('setCategoryPickerOpen(false);');
    expect(products).toContain('accessibilityLabel={');
    expect(products).toContain('const showCompactCategoryFooter = compactFooterAdds');
    expect(products).toContain("'Choose product category'");
    expect(products).toContain(
      'className="mb-2 min-h-[48px] flex-row items-center justify-between',
    );
    expect(products).toContain('<CategoryPickerSheet');
    expect(products).toContain('visible={categoryPickerOpen}');
    expect(products).toContain('if (!visible) return null;');
    expect(products).toContain('className="absolute inset-0 justify-end"');
    expect(products).toContain(
      "style={{ backgroundColor: 'rgba(32,27,21,0.4)', zIndex: 20, elevation: 20 }}",
    );
    expect(products).toContain('accessibilityLabel="Choose product category"');
    expect(products).toContain('accessibilityLabel="Dismiss category picker"');
    expect(products).toContain('useSafeAreaInsets');
    expect(products).toContain('const { height: viewportHeight } = useWindowDimensions();');
    expect(products).toContain('const insets = useSafeAreaInsets();');
    expect(products).toContain('const sheetMaxHeight = Math.max(0, viewportHeight - 52);');
    expect(products).toContain('insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined');
    expect(products).toContain('aria-modal');
    expect(products).toContain('role="dialog"');
    expect(products).toContain('accessibilityLabel="Choose product category"');
    expect(products).toContain(
      'className="overflow-hidden rounded-t-sheet bg-paper px-6 pb-10 pt-4"',
    );
    expect(products).toContain('paddingBottom: sheetPaddingBottom');
    expect(products).toContain('{ height: sheetMaxHeight, maxHeight: sheetMaxHeight }');
    expect(products).toContain('aria-hidden={categoryPickerOpen || undefined}');
    expect(products).toContain('accessibilityElementsHidden={categoryPickerOpen}');
    expect(products).toContain(
      "importantForAccessibility={categoryPickerOpen ? 'no-hide-descendants' : 'auto'}",
    );
    expect(products).toContain('showsVerticalScrollIndicator={false}');
    expect(products).toContain('style={{ flexShrink: 1 }}');
    expect(products).toContain('contentContainerClassName="pb-6"');
    expect(products).toContain('keyboardShouldPersistTaps="handled"');
    expect(products).toContain('setCategoryPickerOpen((open) => !open)');
    expect(products).not.toContain('horizontal');
    expect(products).not.toContain('contentContainerStyle={{ gap: 4, paddingRight: 8 }}');
    expect(products).not.toContain('className="mt-2 flex-row flex-wrap gap-1.5"');
    expect(products).not.toContain('import { Modal');
    expect(products).not.toContain('<Modal');
    expect(products).not.toContain('animationType="slide"');
    expect(products).toContain('<View className="flex-row flex-wrap gap-2">');
    expect(goals).not.toContain('compact={compactPhone}');
    expect(quiz).toContain('compact={compactPhone}');
    expect(goals).not.toContain('tight={compactPhone}');
    expect(quiz).toContain('tight={compactPhone}');
    expect(goals).toContain('contentContainerClassName="pb-28"');
    expect(quiz).toContain('contentContainerClassName="pb-28"');
    expect(products).toContain(
      "contentContainerClassName={showContinueAnyway ? 'pb-36' : 'pb-28'}",
    );
    expect(goals).toContain('className="bg-paper pb-4 pt-2"');
    expect(quiz).toContain('className="bg-paper pb-4 pt-2"');
    expect(products).toContain('className="bg-paper pb-4 pt-2"');
    expect(products).toContain('const footerPrimaryLabel = compactFooterAdds');
    expect(products).toContain('? `Add ${remainingToTarget} more`');
    expect(products).toContain('label={footerPrimaryLabel}');
    expect(products).toContain('onPress={footerAction}');
    expect(products).toContain('label={continueAnywayLabel}');
    expect(products).toContain('variant="ghost"');
    expect(products).toContain('className="mt-1 min-h-[48px] py-2"');
    expect(products).not.toContain(
      "compactFooterAdds ? 'Add to shelf' : added.length > 0 ? 'Continue' : 'Skip for now'",
    );
    expect(products).not.toContain('onPress={compactFooterAdds ? () => void add() : go}');
    expect(products).toContain('{!compactPhone ? (');
    expect(goals).not.toContain('contentContainerClassName="pb-4"');
    expect(quiz).not.toContain('contentContainerClassName="pb-4"');
    expect(products).not.toContain('contentContainerClassName="pb-4"');
    expect(goals).not.toContain('<View className="pb-4">');
    expect(quiz).not.toContain('<View className="pb-4">');
    expect(products).not.toContain('<View className="pb-4">');
  });

  it('nudges onboarding product intake toward the three-product first-insight target', () => {
    const products = readAppRoute('onboarding/products.tsx');

    expect(products).toContain('const ONBOARDING_PRODUCT_TARGET = 3');
    expect(products).toContain(
      'const remainingToTarget = Math.max(ONBOARDING_PRODUCT_TARGET - added.length, 0)',
    );
    expect(products).toContain('const hasTargetProducts = remainingToTarget === 0');
    expect(products).toContain(
      'const showContinueAnyway = added.length > 0 && !hasTargetProducts && !compactFooterAdds',
    );
    expect(products).toContain('Three products gives your first routine enough context');
    expect(products).toContain('gives your first insight more to work with.');
    expect(products).toContain('{Math.min(added.length, ONBOARDING_PRODUCT_TARGET)} OF');
    expect(products).toContain('{ONBOARDING_PRODUCT_TARGET}{');
    expect(products).toContain('PRODUCTS');
    expect(products).toContain('function footerAction()');
    expect(products).toContain('focusNextProduct();');
    expect(products).toContain('label={continueAnywayLabel}');
  });

  it('shows the shelf-derived first insight on reveal before reminder setup', () => {
    const reveal = readAppRoute('onboarding/reveal.tsx');

    expect(reveal).toContain("import { usePlan } from '@/features/routine/usePlan';");
    expect(reveal).toContain('routineFirstInsightCopy(planResult.data.plan');
    expect(reveal).toContain('recordFirstUsefulInsightAnalytics');
    expect(reveal).toContain("source: 'reveal'");
    expect(reveal).toContain('routineInsightCount(planResult.data.plan)');
    expect(reveal).toContain("(firstInsight?.eyebrow ?? 'Routine preview').toUpperCase()");
    expect(reveal).toContain('label="Continue"');
    expect(reveal).toContain("router.push('/onboarding/notifications')");
    expect(reveal).not.toContain('label="See my routine"');
  });

  it('keeps health-data consent fail-closed before quiz access', () => {
    const source = readAppRoute('onboarding/consent.tsx');
    const quiz = readAppRoute('onboarding/quiz.tsx');

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
    expect(quiz).toContain('getHealthDataCollectionConsentLocal');
    expect(quiz).toContain('consent?.granted === true');
    expect(quiz).toContain("router.replace('/onboarding/consent')");
    expect(quiz).toContain('if (!consentChecked)');
    expect(quiz).toContain('Privacy check');
    expect(quiz).toContain('Checking your privacy choice');
    expect(quiz).toContain('One moment while we confirm the quiz can start.');
    expect(quiz).not.toContain('<View className="flex-1" />');
    expect(quiz.indexOf('getHealthDataCollectionConsentLocal()')).toBeLessThan(
      quiz.indexOf('const total = ONBOARDING_QUIZ.length'),
    );
  });

  it('recovers direct quiz completion without inventing missing goals', () => {
    const goals = readAppRoute('onboarding/goals.tsx');
    const products = readAppRoute('onboarding/products.tsx');
    const analyzing = readAppRoute('onboarding/analyzing.tsx');

    expect(goals).toContain('getQuizCompletionState');
    expect(goals).toContain('const { goals, quizAnswers, toggleGoal } = useOnboarding();');
    expect(goals).toContain('const quizCompletion = getQuizCompletionState(quizAnswers);');
    expect(goals).toContain(
      "router.push(quizCompletion.complete ? '/onboarding/products' : '/onboarding/consent')",
    );
    expect(products).toContain('const { goals } = useOnboarding();');
    expect(products).toContain('if (goals.length === 0)');
    expect(products).toContain("router.replace('/onboarding/goals')");
    expect(analyzing).toContain(
      'const { goals, persistSkinProfile, quizAnswers } = useOnboarding();',
    );
    expect(analyzing).toContain('if (goals.length === 0)');
    expect(analyzing).toContain("router.replace('/onboarding/goals')");
    expect(analyzing).toContain('goals.length');
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

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const supportFloorTextPressurePhone =');
    expect(source).toContain(
      "width <= 390 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(source).toContain('const compactPhone = height < 640 || supportFloorTextPressurePhone;');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
    expect(source).toContain("justifyContent: compactPhone ? 'flex-start' : 'center'");
    expect(source).toContain('{isSupabaseConfigured ? (');
    expect(source).toContain('className="bg-paper pb-4 pt-2"');
    expect(source).toContain('className="min-h-[48px] items-center justify-center py-2"');
    expect(source).not.toContain('editable={isSupabaseConfigured}');
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
    expect(source).toContain('EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE');
    expect(source).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(source).toContain('simulatedProfileSaveFailureUsed.current = true');
    expect(source).toContain("new Error('E2E_PROFILE_SAVE_FAILURE')");
    expect(source).toContain('setSaveError(true)');
    expect(source).toContain('We could not save your profile.');
    expect(source).toContain("router.replace('/onboarding/reveal')");
    expect(source.indexOf('persistSkinProfile()')).toBeLessThan(
      source.indexOf("router.replace('/onboarding/reveal')"),
    );
    expect(source.indexOf('simulatedProfileSaveFailureUsed.current = true')).toBeLessThan(
      source.indexOf("new Error('E2E_PROFILE_SAVE_FAILURE')"),
    );
  });
});
