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
    expect(source).toContain("compact ? 'flex-1 font-mono text-[10px]'");
    expect(source).toContain("'flex-1 font-mono text-[10.5px]'");
    expect(source).toContain('flexShrink: 1');
    expect(source).toContain("flexShrink: 0, textAlign: 'right'");
  });

  it('keeps the For You hub heading readable on phone-width web', () => {
    const source = readAppRoute('recommendations/index.tsx');

    expect(source).toContain('function HubIntro()');
    expect(source).toContain('accessibilityRole="header"');
    expect(source).toContain("style={{ alignSelf: 'flex-start' }}");
    expect(source).toContain("REC_COPY.hub.subtitle.split(', ')");
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactHub = height < 640;');
    expect(source).toContain("contentContainerClassName={compactHub ? 'pb-12 pt-4' : 'pb-10 pt-5'}");
    expect(source).toContain('<HubIntro />');
    expect(source).toContain('<RecCard key={rec.id} rec={rec} compact={compactHub} />');
    expect(source).toContain(
      "compact\n          ? 'mb-3 rounded-[16px] bg-paper-raised p-3.5'",
    );
    expect(source).toContain('style={{ lineHeight: compact ? 16 : 18 }}');
    expect(source).toContain('lineHeight: compact ? 13 : 15');
  });

  it('keeps recommendation preferences fail-closed on local save failure', () => {
    const source = readAppRoute('recommendations/preferences.tsx');

    expect(source).toContain('applyRecommendationPreferences');
    expect(source).toContain('disabled={controlsDisabled}');
    expect(source).toContain('accessibilityState={{ selected: active, disabled }}');
    expect(source).toContain('const [saveFailed, setSaveFailed] = useState(false);');
    expect(source).toContain('setSaveFailed(false);');
    expect(source).toContain('setSaveFailed(true);');
    expect(source).toContain('Alert.alert(REC_COPY.preferences.saveFailedTitle');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE');
    expect(source).toContain(
      "process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE === 'once'",
    );
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
    expect(source).toContain('className="min-h-[48px] items-center justify-center rounded-pill');
    expect(source).not.toContain(
      'className="min-h-[44px] items-center justify-center rounded-pill',
    );
  });

  it('keeps recommendation budget preferences fully visible on compact phones', () => {
    const source = readAppRoute('recommendations/preferences.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactPreferences = height < 640');
    expect(source).toContain(
      "const sectionLabelClassName = compactPreferences ? 'mb-2 mt-5' : 'mb-3 mt-7';",
    );
    expect(source).toContain("contentContainerClassName={compactPreferences ? 'pb-24' : 'pb-10'}");
    expect(source).toContain('fill?: boolean');
    expect(source).toContain('dense?: boolean');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('paddingHorizontal: fill ? 8 : dense ? 12 : undefined');
    expect(source).toContain('fontSize: fill ? 12 : dense ? 13 : undefined');
    expect(source).toContain('flexGrow: fill ? 1 : undefined');
    expect(source).toContain('minWidth: fill ? 0 : dense ? 48 : undefined');
    expect(source).toContain('dense={compactPreferences}');
    expect(source).toContain('<Toggle\n              key={b}\n              fill');
  });

  it('keeps recommendation detail navigation touchable on phones', () => {
    const source = readAppRoute('recommendations/[id].tsx');

    expect(source).toContain('RouteIconButton');
    expect(source).not.toContain('h-7 w-7');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('style={{ width: 72, flexShrink: 0 }}');
    expect(source).toContain('mt-4 min-h-[48px] items-center justify-center py-2');
    expect(source).not.toContain('mt-4 min-h-[44px] items-center justify-center py-2');
  });
});
