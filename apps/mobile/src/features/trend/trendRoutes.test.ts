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
  it('keeps the opt-in screen safe for direct entry', () => {
    const source = readAppRoute('trend/optin.tsx');

    expect(source).not.toContain('router.back()');
    expect(source).toContain('APP_PROGRESS_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_PROGRESS_ROUTE)');
  });

  it('keeps the opt-in toggle failure handled and retryable', () => {
    const source = readAppRoute('trend/optin.tsx');

    expect(source).toContain('applyTrendConsentChoice');
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compact = height < 640');
    expect(source).toContain('const showSecondaryLinks = !(compact && saveFailed)');
    expect(source).toContain('contentContainerStyle={{ paddingBottom: compact ? 24 : 40 }}');
    expect(source).toContain("? 'mt-1 rounded-[20px] bg-paper-raised p-4'");
    expect(source).toContain("? 'mt-2.5 flex-row items-center justify-between rounded-2xl bg-paper-raised p-3.5'");
    expect(source).toContain("? 'mt-2 min-h-[48px] flex-row items-center justify-between rounded-2xl bg-paper-raised px-3.5 py-1.5'");
    expect(source).toContain(
      "compact ? 'mt-2 rounded-2xl px-3.5 py-2.5' : 'mt-2.5 rounded-2xl px-4 py-3'",
    );
    expect(source).toContain('{showSecondaryLinks ? (');
    expect(source).toContain('EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE');
    expect(source).toContain('EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER');
    expect(source).toContain("process.env.EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER === 'local_only'");
    expect(source).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(source).toContain("modes.has('grant_once') || modes.has('all_once')");
    expect(source).toContain("modes.has('revoke_once') || modes.has('all_once')");
    expect(source).toContain('setTrendInsightsLocal(true)');
    expect(source).toContain('setTrendInsightsLocal(false)');
    expect(source).toContain('deleteTrendState()');
    expect(source).toContain("new Error('E2E_TREND_CONSENT_GRANT_FAILURE')");
    expect(source).toContain("new Error('E2E_TREND_CONSENT_REVOKE_FAILURE')");
    expect(source).toContain('const [saveFailed, setSaveFailed] = useState(false)');
    expect(source).toContain('setSaveFailed(false)');
    expect(source).toContain('setSaveFailed(true)');
    expect(source).toContain("qc.setQueryData(['trendConsent'], on)");
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('TREND_COPY.optIn.saveFailedTitle');
    expect(source).toContain('TREND_COPY.optIn.saveFailedBody');
    expect(source).not.toContain('Alert.alert');
    expect(source).toContain(
      "invalidate: () => qc.invalidateQueries({ queryKey: ['trendConsent'] })",
    );
    expect(source).toContain('disabled={saving}');
    expect(source).toContain('setSaving(false)');
  });

  it('keeps the opt-in switch semantic and touchable on phones', () => {
    const source = readAppRoute('trend/optin.tsx');

    expect(source).toContain('ToggleSwitch');
    expect(source).toContain('accessibilityLabel={TREND_COPY.optIn.toggleLabel}');
    expect(source).toContain('activeTrackColor={colors.sage}');
    expect(source).not.toContain('<Switch');
    expect(source).not.toContain('onValueChange');
  });

  it('keeps the fairness explainer safe for direct entry', () => {
    const source = readAppRoute('trend/fairness.tsx');

    expect(source).not.toContain('router.back()');
    expect(source).toContain('APP_TREND_OPTIN_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_TREND_OPTIN_ROUTE)');
  });

  it('returns deferred Trend direct entries to Progress', () => {
    const source = readAppRoute('trend/_layout.tsx');

    expect(source).toContain('surface="trend"');
    expect(source).toContain('fallbackRoute={APP_PROGRESS_ROUTE}');
    expect(source).toContain('fallbackLabel="Back to Progress"');
  });

  it('keeps Trend route escape controls touchable on phones', () => {
    for (const route of ['trend/optin.tsx', 'trend/fairness.tsx']) {
      expectTouchableRouteIcon(route);
    }
  });
});
