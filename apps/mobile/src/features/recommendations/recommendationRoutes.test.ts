import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Recommendation route contracts', () => {
  it('keeps For You hub exits safe for direct entry', () => {
    const source = readAppRoute('recommendations/index.tsx');

    expect(source).not.toContain('router.back()');
    expect(source).toContain('APP_YOU_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_YOU_ROUTE)');
    expect(source).toContain('RouteIconButton');
    expect(source).not.toContain('hitSlop={8}');
    expect(source).toContain(
      'className="min-h-[48px] min-w-[48px] items-center justify-center px-2"',
    );
  });

  it('keeps nested recommendation exits safe for direct entry', () => {
    for (const route of ['recommendations/preferences.tsx', 'recommendations/[id].tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should not depend on direct-entry history`).not.toContain(
        'router.back()',
      );
      expect(source, `${route} should recover direct entries to For You`).toContain(
        'APP_RECOMMENDATIONS_ROUTE',
      );
      expect(source, `${route} should guard native back with a fallback`).toContain(
        'backOrReplace(router, APP_RECOMMENDATIONS_ROUTE)',
      );
    }
  });

  it('keeps recommendation card footers usable on narrow phones', () => {
    const source = readAppRoute('recommendations/index.tsx');

    expect(source).toContain('min-w-0 flex-1 flex-row items-start');
    expect(source).toContain("short\n                ? 'flex-1 font-mono text-[9.5px]'");
    expect(source).toContain("compact\n                  ? 'flex-1 font-mono text-[10px]'");
    expect(source).toContain("'flex-1 font-mono text-[10.5px]'");
    expect(source).toContain('flexShrink: 1');
    expect(source).toContain("flexShrink: 0, textAlign: 'right'");
  });

  it('keeps the For You hub heading and cards readable on shortest phone web', () => {
    const source = readAppRoute('recommendations/index.tsx');

    expect(source).toContain('function HubIntro({');
    expect(source).toContain('ultraShort = false');
    expect(source).toContain('accessibilityRole="header"');
    expect(source).toContain("style={{ alignSelf: 'flex-start' }}");
    expect(source).toContain("REC_COPY.hub.subtitle.split(', ')");
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactHub = height < 640;');
    expect(source).toContain('const shortHub = height < 520;');
    expect(source).toContain('const ultraShortHub = height < 460;');
    expect(source).toContain('const splitShortHub = height < 410;');
    expect(source).toContain('const narrowCompactHub = compactHub && width <= 430;');
    expect(source).toContain("ultraShortHub\n              ? 'pb-20 pt-1'");
    expect(source).toContain('<HubIntro short={shortHub} ultraShort={ultraShortHub} />');
    expect(source).toContain('const keepNextCardBelowFold = splitShortHub');
    expect(source).toContain('? recIndex > 0');
    expect(source).toContain(': narrowCompactHub && recIndex > 1;');
    expect(source).toContain('const deferredCardTopMargin = splitShortHub ? 128 : 80;');
    expect(source).toContain(
      'style={keepNextCardBelowFold ? { marginTop: deferredCardTopMargin } : undefined}',
    );
    expect(source).toContain('ultraShort={ultraShortHub}');
    expect(source).toContain("ultraShort\n          ? 'mb-1.5 rounded-[12px] bg-paper-raised p-2'");
    expect(source).toContain(
      "ultraShort\n              ? 'h-6 w-6 items-center justify-center rounded-[7px]'",
    );
    expect(source).toContain(
      "ultraShort\n            ? 'mt-1 flex-row items-start justify-between gap-2 pt-1'",
    );
    expect(source).toContain("short\n          ? 'mb-2 rounded-[14px] bg-paper-raised p-2.5'");
    expect(source).toContain('style={{ lineHeight: short ? 14 : compact ? 16 : 18 }}');
    expect(source).toContain('lineHeight: short ? 12 : compact ? 13 : 15');
  });

  it("keeps the you're-set state scrollable on compact phones", () => {
    const source = readAppRoute('recommendations/index.tsx');

    expect(source).toContain('function YoureSet({ compact = false }: { compact?: boolean })');
    expect(source).toContain('className="flex-1"');
    expect(source).toContain('showsVerticalScrollIndicator={false}');
    expect(source).toContain("'items-center px-2 pb-28 pt-3'");
    expect(source).toContain("'flex-grow items-center justify-center px-2 pb-10 pt-7'");
    expect(source).toContain('width: compact ? 50 : 78');
    expect(source).toContain('height: compact ? 50 : 78');
    expect(source).toContain('fontSize: compact ? 23 : 30');
    expect(source).toContain("'text-center text-[27px] leading-[30px]'");
    expect(source).toContain("variant={compact ? 'bodySm' : 'body'}");
    expect(source).toContain('style={{ lineHeight: compact ? 20 : 23 }}');
    expect(source).toContain('<YoureSet compact={compactHub} />');
    expect(source).not.toContain('<View className="flex-1 items-center justify-center px-2">');
    expect(source).not.toContain('<YoureSet />');
  });

  it('keeps recommendation preferences fail-closed on local save failure', () => {
    const source = readAppRoute('recommendations/preferences.tsx');

    expect(source).toContain('applyRecommendationPreferences');
    expect(source).toContain('disabled={controlsDisabled}');
    expect(source).toContain('accessibilityState={{ selected: active, disabled }}');
    expect(source).toContain('const [saveFailed, setSaveFailed] = useState(false);');
    expect(source).toContain('setSaveFailed(false);');
    expect(source).toContain('setSaveFailed(true);');
    expect(source).not.toContain('Alert.alert');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('aria-selected={active}');
    expect(source).toContain('EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE');
    expect(source).toContain('EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS');
    expect(source).toContain('const MAX_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS = 3_000;');
    expect(source).toContain(
      "process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE === 'once'",
    );
    expect(source).toContain('if (preferenceDelayMs > 0) await wait(preferenceDelayMs);');
    expect(source).toContain("throw new Error('E2E_RECOMMENDATION_PREFERENCES_FAILURE')");
    expect(source).toContain("track('preference_set')");
    expect(source.indexOf('save: savePreferenceWithFixture')).toBeLessThan(
      source.indexOf("track('preference_set')"),
    );
  });

  it('keeps recommendation preferences navigation touchable on phones', () => {
    const source = readAppRoute('recommendations/preferences.tsx');

    expect(source).toContain('RouteIconButton');
    expect(source).not.toContain('h-7 w-7');
    expect(source).toContain('Preferences');
    expect(source).toContain("'min-h-[48px] items-center justify-center rounded-pill px-4 py-2.5'");
  });

  it('keeps recommendation budget preferences fully visible on compact phones', () => {
    const source = readAppRoute('recommendations/preferences.tsx');

    expect(source).toContain(
      "import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';",
    );
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const { fontScale = 1, height, width } = useWindowDimensions();');
    expect(source).toContain('const compactPreferences = height < 640');
    expect(source).toContain('const shortPreferences = height < 600;');
    expect(source).toContain('const supportFloorPreferences = width <= 320 && height < 520;');
    expect(source).toContain(
      'const supportFloorTextPressurePreferences = width <= 390 && height >= 640 && height < 700;',
    );
    expect(source).toContain('const ultraShortPreferences = height < 460;');
    expect(source).toContain('const microShortPreferences = height < 380;');
    expect(source).toContain(
      'const splitShortPreferences = height < 600 || supportFloorTextPressurePreferences;',
    );
    expect(source).toContain(
      'const tallTextPressurePreferences = width <= 430 && height >= 900 && height < 980;',
    );
    expect(source).toContain('const showPreferencesSubtitle = !compactPreferences;');
    expect(source).toContain(
      "const preferencesTitle = supportFloorPreferences ? 'Preferences' : REC_COPY.preferences.title;",
    );
    expect(source).toContain('{showPreferencesSubtitle ? (');
    expect(source).toContain('{REC_COPY.preferences.subtitle}');
    expect(source).toContain('const valuesLabelClassName = ultraShortPreferences');
    expect(source).toContain("? 'mb-1 mt-1.5'");
    expect(source).toContain("? 'mb-1.5 mt-3'");
    expect(source).toContain("? 'mb-1.5 mt-12'");
    expect(source).toContain("? 'mb-1.5 mt-24'");
    expect(source).toContain("? 'mb-1.5 mt-28'");
    expect(source).toContain('const chipGroupClassName = shortPreferences');
    expect(source).toContain("? 'flex-row flex-wrap gap-1'");
    expect(source).toContain('const textureSectionLabelClassName = ultraShortPreferences');
    expect(source).toContain("'min-h-[48px] items-center justify-center rounded-pill px-3 py-2'");
    expect(source).toContain('minHeight: ultraDense ? 48 : undefined');
    expect(source).toContain('const textureSectionLabelStyle = ultraShortPreferences');
    expect(source).toContain('const ultraShortPreferenceFirstGroupStyle = microShortPreferences');
    expect(source).toContain('? { marginTop: 88 }');
    expect(source).toContain('? { marginTop: 48 }');
    expect(source).toContain('className={textureSectionLabelClassName}');
    expect(source).toContain('style={textureSectionLabelStyle}');
    expect(source).toContain('style={ultraShortPreferenceFirstGroupStyle}');
    expect(source).toContain("contentContainerClassName={compactPreferences ? 'pb-24' : 'pb-10'}");
    expect(source).toContain('fill?: boolean');
    expect(source).toContain('dense?: boolean');
    expect(source).toContain('ultraDense?: boolean');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('const splitShortPreferenceDeferredGroupStyle =');
    expect(source).toContain('supportFloorPreferences || supportFloorTextPressurePreferences');
    expect(source).toContain('? { marginTop: 224 }');
    expect(source).toContain(': { marginTop: 192 };');
    expect(source).toContain('const modernTextPressurePreferences = height < 900;');
    expect(source).toContain('const boundaryTextPressurePreferences =');
    expect(source).toContain(
      "height >= 700 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(source).toContain(
      'const androidMidTextPressurePreferences = width <= 390 && height >= 700 && height < 840;',
    );
    expect(source).toContain('const modernTextPressureBudgetGroupStyle =');
    expect(source).toContain('supportFloorPreferences || boundaryTextPressurePreferences');
    expect(source).toContain('boundaryTextPressurePreferences');
    expect(source).toContain('? { marginTop: 320 }');
    expect(source).toContain('modernTextPressurePreferences || tallTextPressurePreferences');
    expect(source).toContain('? { marginTop: 112 }');
    expect(source).toContain('const modernTextPressureTextureGroupStyle =');
    expect(source).toContain('androidMidTextPressurePreferences');
    expect(source).toContain('? { marginTop: 184 }');
    expect(source).toContain('? { marginTop: 56 }');
    expect(source).toContain('? { marginTop: 64 }');
    expect(source).toContain('const renderValueToggle = (v: ValuesFilter) => (');
    expect(source).toContain('VALUES_FILTERS.slice(0, 3).map(renderValueToggle)');
    expect(source).toContain('VALUES_FILTERS.slice(3).map(renderValueToggle)');
    expect(source).toContain('style={splitShortPreferenceDeferredGroupStyle}');
    expect(source).toContain('style={modernTextPressureBudgetGroupStyle}');
    expect(source).toContain('style={modernTextPressureTextureGroupStyle}');
    expect(source).toContain(
      'paddingHorizontal: fill ? 8 : ultraDense ? 10 : dense ? 12 : undefined',
    );
    expect(source).toContain('adjustsFontSizeToFit');
    expect(source).toContain('minimumFontScale={0.78}');
    expect(source).toContain('fontSize: fill ? 12 : ultraDense ? 12.5 : dense ? 13 : undefined');
    expect(source).toContain('flexGrow: fill ? 1 : undefined');
    expect(source).toContain('minWidth: fill ? 0 : dense ? 48 : undefined');
    expect(source).toContain('dense={compactPreferences || modernTextPressurePreferences}');
    expect(source).toContain('ultraDense={ultraShortPreferences || shortPreferences}');
    expect(source).toContain('fill={!compactPreferences && !modernTextPressurePreferences}');
  });

  it('keeps recommendation detail navigation touchable on phones', () => {
    const source = readAppRoute('recommendations/[id].tsx');

    expect(source).toContain('RouteIconButton');
    expect(source).not.toContain('h-7 w-7');
    expect(source).toContain(
      "import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';",
    );
    expect(source).toContain('const { width } = useWindowDimensions();');
    expect(source).toContain('const compactHeader = width <= 360;');
    expect(source).toContain('adjustsFontSizeToFit');
    expect(source).toContain('accessibilityLabel="Recommendation"');
    expect(source).toContain('className="flex-1 font-sans-semibold"');
    expect(source).toContain('minimumFontScale={0.82}');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain("{compactHeader ? 'Suggestion' : 'Recommendation'}");
    expect(source).toContain('style={{ minWidth: 0 }}');
    expect(source).toContain('style={{ width: 72, flexShrink: 0 }}');
    expect(source).toContain('mt-4 min-h-[48px] items-center justify-center py-2');
    expect(source).not.toContain('mt-4 min-h-[44px] items-center justify-center py-2');
  });
});
