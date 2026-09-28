import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('PHOTO-05A Trend route contracts', () => {
  it.each(['trend/optin.tsx', 'trend/fairness.tsx'])(
    'keeps %s unconditionally deferred and analytics-free',
    (route) => {
      const source = readAppRoute(route);

      expect(source).toContain('<DeferredSurface');
      expect(source).toContain('surface="trend"');
      expect(source).toContain('fallbackRoute={APP_PROGRESS_ROUTE}');
      expect(source).toContain('fallbackLabel="Back to Progress"');
      expect(source).toContain('fallbackBehavior="replace"');
      expect(source).toContain('trackView={false}');

      for (const forbidden of [
        'phase7Flags',
        'useTrend',
        'useMonkBand',
        'usePhotos',
        'TREND_COPY',
        'grantTrendInsightsConsent',
        'revokeTrendInsightsConsent',
        'setTrendInsightsLocal',
        'photo_trend_insights',
        'ToggleSwitch',
        'process.env',
        '__DEV__',
        "track('",
      ]) {
        expect(source).not.toContain(forbidden);
      }
    },
  );

  it('preserves both exact direct-entry URLs instead of a layout redirect', () => {
    const layout = readAppRoute('trend/_layout.tsx');

    expect(layout).toContain('<DeferredSurface');
    expect(layout).toContain('screenLayout={({ children }) =>');
    expect(layout).toContain('trackView={false}');
    expect(layout).not.toContain('phase7Flags');
    expect(layout).not.toContain('<Redirect');
    expect(layout).toContain('<Stack.Screen name="optin" />');
    expect(layout).toContain('<Stack.Screen name="fairness" />');
  });

  it('removes disabled-path Trend observers from Progress and the no-score explainer', () => {
    const progress = readAppRoute('(tabs)/progress.tsx');
    const about = readAppRoute('progress/about.tsx');

    for (const source of [progress, about]) {
      expect(source).not.toContain("from '@/features/trend/");
      expect(source).not.toContain('useTrendConsent');
      expect(source).not.toContain('useTrendInsight');
      expect(source).not.toContain('TrendInsight');
      expect(source).not.toContain("router.push('/trend/");
    }
    expect(progress).not.toContain('ProgressTrendBoundary');
    expect(progress).not.toContain('phase7Flags.trend');
  });
});
