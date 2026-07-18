import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const componentSource = readFileSync(requireFromTest.resolve('./ShelfSyncStatus.tsx'), 'utf8');
const shelfRouteSource = readFileSync(
  requireFromTest.resolve('../../app/(tabs)/shelf.tsx'),
  'utf8',
);

describe('Shelf sync status UI contract', () => {
  it('names every required state without blocking local Shelf use', () => {
    expect(componentSource).toContain('Saved locally');
    expect(componentSource).toContain('Syncing Shelf changes');
    expect(componentSource).toContain('Shelf sync needs attention');
    expect(componentSource).toContain('Your Shelf stays usable while this finishes.');
    expect(componentSource).toContain('still safe on this phone but could not sync.');
  });

  it('keeps status owner-scoped, observable, and free of polling', () => {
    expect(componentSource).toContain('useOwnerQueryScope()');
    expect(componentSource).toContain('isOwnerQueryScopeCurrent(ownerScope)');
    expect(componentSource).toContain('useSyncExternalStore(');
    expect(componentSource).toContain('subscribeOutboxChanges');
    expect(componentSource).not.toContain('setInterval(');
    expect(componentSource).not.toContain('setTimeout(');
  });

  it('renders the narrow status leaf for populated and empty Shelf states', () => {
    expect(shelfRouteSource.match(/<ShelfSyncStatus className="mt-3" \/>/g)).toHaveLength(2);
    expect(componentSource).toContain('accessibilityLabel="Syncing Shelf changes"');
    expect(componentSource).toContain('accessibilityState={{ busy: true }}');
    expect(componentSource).toContain('accessibilityLiveRegion="polite"');
    expect(componentSource).toContain('kind="error"');
    expect(componentSource).toContain('Try sync again');
  });

  it('keeps visual E2E fixtures development-web-only', () => {
    expect(componentSource).toContain('EXPO_PUBLIC_E2E_SHELF_SYNC_STATUS');
    expect(componentSource).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(componentSource).toContain("Platform.OS !== 'web'");
  });
});
