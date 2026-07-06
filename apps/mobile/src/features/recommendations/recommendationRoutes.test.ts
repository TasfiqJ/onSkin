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
    expect(source).toContain('className="flex-1 font-mono text-[10.5px]"');
    expect(source).toContain('flexShrink: 1');
    expect(source).toContain("flexShrink: 0, textAlign: 'right'");
  });

  it('keeps recommendation preferences fail-closed on local save failure', () => {
    const source = readAppRoute('recommendations/preferences.tsx');

    expect(source).toContain('applyRecommendationPreferences');
    expect(source).toContain('disabled={controlsDisabled}');
    expect(source).toContain('accessibilityState={{ selected: active, disabled }}');
    expect(source).toContain('Alert.alert(REC_COPY.preferences.saveFailedTitle');
    expect(source).toContain("track('preference_set')");
    expect(source.indexOf('save: savePreferences')).toBeLessThan(
      source.indexOf("track('preference_set')"),
    );
  });

  it('keeps recommendation preferences navigation touchable on phones', () => {
    const source = readAppRoute('recommendations/preferences.tsx');

    expect(source).toContain('accessibilityLabel="Back"');
    expect(source).toContain('width: 44');
    expect(source).toContain('height: 44');
  });
});
