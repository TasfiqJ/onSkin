import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const componentSource = readFileSync(
  requireFromTest.resolve('./RecommendationPreferenceSyncStatus.tsx'),
  'utf8',
);
const routeSource = readFileSync(
  requireFromTest.resolve('../../app/recommendations/preferences.tsx'),
  'utf8',
);

describe('recommendation preference sync status UI contract', () => {
  it('names every non-blocking state without conflating local save failure', () => {
    expect(componentSource).toContain('Saved locally');
    expect(componentSource).toContain('Syncing recommendation choices');
    expect(componentSource).toContain('Recommendation sync needs attention');
    expect(componentSource).toContain('controls stay usable while this finishes');
    expect(componentSource).toContain('still safe on this phone but could not sync');
    expect(componentSource).not.toContain('saveFailedTitle');
  });

  it('keeps status owner-scoped, entity-scoped, observable, and free of polling', () => {
    expect(componentSource).toContain('useAuth()');
    expect(componentSource).toContain('readRecommendationPreferencesOutboxStatus');
    expect(componentSource).toContain('retryRecommendationPreferencesOutbox');
    expect(componentSource).toContain(
      'recommendationPreferencesOutboxStatus(ownerScope, revision)',
    );
    expect(componentSource).toContain('useSyncExternalStore(');
    expect(componentSource).not.toContain('setInterval(');
    expect(componentSource).not.toContain('setTimeout(');
  });

  it('renders one narrow accessible leaf on the preferences route', () => {
    expect(routeSource).toContain('<RecommendationPreferenceSyncStatus className="mb-12 mt-4" />');
    expect(componentSource).toContain('accessibilityLabel="Syncing recommendation choices"');
    expect(componentSource).toContain('accessibilityState={{ busy: true }}');
    expect(componentSource).toContain('kind="error"');
    expect(componentSource).toContain('Try sync again');
  });

  it('keeps visual fixtures development-web-only', () => {
    expect(componentSource).toContain('EXPO_PUBLIC_E2E_RECOMMENDATION_SYNC_STATUS');
    expect(componentSource).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(componentSource).toContain("Platform.OS !== 'web'");
  });
});
