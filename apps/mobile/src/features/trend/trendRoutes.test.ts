import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Trend route contracts', () => {
  it('keeps the opt-in screen safe for direct entry', () => {
    const source = readAppRoute('trend/optin.tsx');

    expect(source).not.toContain('router.back()');
    expect(source).toContain('APP_PROGRESS_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_PROGRESS_ROUTE)');
  });

  it('keeps the opt-in toggle failure handled and retryable', () => {
    const source = readAppRoute('trend/optin.tsx');

    expect(source).toContain('applyTrendConsentChoice');
    expect(source).toContain('Alert.alert(TREND_COPY.optIn.saveFailedTitle');
    expect(source).toContain("invalidate: () => qc.invalidateQueries({ queryKey: ['trendConsent'] })");
    expect(source).toContain('disabled={saving}');
    expect(source).toContain('setSaving(false)');
  });

  it('keeps the fairness explainer safe for direct entry', () => {
    const source = readAppRoute('trend/fairness.tsx');

    expect(source).not.toContain('router.back()');
    expect(source).toContain('APP_TREND_OPTIN_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_TREND_OPTIN_ROUTE)');
  });

  it('returns deferred Trend direct entries to Progress', () => {
    const source = readAppRoute('trend/_layout.tsx');

    expect(source).toContain(
      '<DeferredSurface surface="trend" fallbackRoute={APP_PROGRESS_ROUTE} />',
    );
  });
});
