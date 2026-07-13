import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function expectTouchableRouteIcon(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should use the shared 44pt route icon button`).toContain(
    'RouteIconButton',
  );
  expect(source, `${route} should not shrink route icons below phone touch targets`).not.toContain(
    'h-7 w-7',
  );
}

describe('Trend route contracts', () => {
  it('keeps the launch-blocked opt-in route deferred on direct entry', () => {
    const source = readAppRoute('trend/optin.tsx');

    expect(source).toContain('<DeferredSurface');
    expect(source).toContain('surface="trend"');
    expect(source).toContain('fallbackRoute={APP_PROGRESS_ROUTE}');
    expect(source).toContain('fallbackLabel="Back to Progress"');
    expect(source).toContain('fallbackBehavior="replace"');
  });

  it('never requests or stores trend consent while the engine is unavailable', () => {
    const source = readAppRoute('trend/optin.tsx');

    expect(source).not.toContain('grantTrendInsightsConsent');
    expect(source).not.toContain('revokeTrendInsightsConsent');
    expect(source).not.toContain('setTrendInsightsLocal');
    expect(source).not.toContain('ToggleSwitch');
    expect(source).not.toContain('photo_trend_insights');
  });

  it('keeps the fairness explainer safe for direct entry', () => {
    const source = readAppRoute('trend/fairness.tsx');

    expect(source).not.toContain('router.back()');
    expect(source).toContain('if (!phase7Flags.trend)');
    expect(source).toContain('<DeferredSurface');
    expect(source).toContain('fallbackRoute={APP_PROGRESS_ROUTE}');
    expect(source).toContain('fallbackBehavior="replace"');
    expect(source).toContain('APP_TREND_OPTIN_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_TREND_OPTIN_ROUTE)');
  });

  it('keeps the matched Trend route mounted while gating its child scene', () => {
    const optIn = readAppRoute('trend/optin.tsx');
    const fairness = readAppRoute('trend/fairness.tsx');
    const layout = readAppRoute('trend/_layout.tsx');

    for (const source of [optIn, fairness]) {
      expect(source).toContain('surface="trend"');
      expect(source).toContain('fallbackRoute={APP_PROGRESS_ROUTE}');
      expect(source).toContain('fallbackLabel="Back to Progress"');
      expect(source).toContain('fallbackBehavior="replace"');
    }
    const navigator = layout.slice(layout.indexOf('export default function TrendLayout'));

    expect(layout).toContain('function TrendScreenGate');
    expect(layout).toContain('if (!phase7Flags.trend)');
    expect(layout).toContain('<DeferredSurface');
    expect(layout).toContain('surface="trend"');
    expect(layout).toContain('fallbackRoute={APP_PROGRESS_ROUTE}');
    expect(layout).toContain('fallbackLabel="Back to Progress"');
    expect(layout).toContain('fallbackBehavior="replace"');
    expect(navigator).toContain('<Stack');
    expect(navigator).toContain(
      'screenLayout={({ children }) => <TrendScreenGate>{children}</TrendScreenGate>}',
    );
    expect(navigator).not.toContain('if (!phase7Flags.trend)');
    expect(layout).toContain('<Stack.Screen name="optin" />');
    expect(layout).toContain('<Stack.Screen name="fairness" />');
  });

  it('keeps Trend route escape controls touchable on phones', () => {
    for (const route of ['trend/fairness.tsx']) {
      expectTouchableRouteIcon(route);
    }
  });
});
