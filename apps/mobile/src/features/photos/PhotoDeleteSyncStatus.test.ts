import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const componentSource = readFileSync(
  requireFromTest.resolve('./PhotoDeleteSyncStatus.tsx'),
  'utf8',
);
const copySource = readFileSync(requireFromTest.resolve('./copy.ts'), 'utf8');
const progressRoute = readFileSync(
  requireFromTest.resolve('../../app/(tabs)/progress.tsx'),
  'utf8',
);
const detailRoute = readFileSync(requireFromTest.resolve('../../app/progress/[id].tsx'), 'utf8');
const privacyRoute = readFileSync(
  requireFromTest.resolve('../../app/settings/privacy.tsx'),
  'utf8',
);
const diagnosticsRoute = readFileSync(
  requireFromTest.resolve('../../app/settings/diagnostics.tsx'),
  'utf8',
);

describe('photo deletion sync status UI contract', () => {
  it('distinguishes completed local image deletion from account-record cleanup', () => {
    expect(copySource).toContain("savedTitle: 'Deletion saved'");
    expect(copySource).toContain("syncingTitle: 'Finishing deletion'");
    expect(copySource).toContain("attentionTitle: 'Deletion needs attention'");
    expect(copySource).toContain("unavailableTitle: 'Deletion status unavailable'");
    expect(copySource.match(/Any deleted photos are already gone from this phone/g)).toHaveLength(
      3,
    );
    expect(copySource.match(/Progress photo images are not uploaded in this build/g)).toHaveLength(
      3,
    );
    expect(copySource).toContain("retry: 'Try deletion again'");
    expect(copySource).toContain("checkAgain: 'Check again'");
    expect(componentSource).toContain('PHOTO_COPY.deleteSync');
    expect(componentSource).not.toContain('photoId');
    expect(componentSource).not.toContain('entityId');
  });

  it('keeps status current-owner scoped, event-driven, and manually retryable', () => {
    expect(componentSource).toContain('useAuth()');
    expect(componentSource).toContain('useOwnerQueryScope()');
    expect(componentSource).toContain('queryKeys.photoDeleteOutboxStatus(ownerScope, revision)');
    expect(componentSource).toContain('readPhotoDeleteOutboxStatus(ownerScope, ownerId)');
    expect(componentSource).toContain('retryPhotoDeleteOutbox(ownerScope, ownerId)');
    expect(componentSource).toContain('useSyncExternalStore(');
    expect(componentSource).toContain('isOwnerQueryScopeCurrent(ownerScope)');
    expect(componentSource).toContain('runPhotoDeleteRetrySingleFlight(retryPromiseRef');
    expect(componentSource).not.toContain('setInterval(');
    expect(componentSource).not.toContain('setTimeout(');
  });

  it('uses one non-blocking leaf with accessible progress, alert, and retry states', () => {
    expect(componentSource).toContain("displayedState.value.kind === 'idle'");
    expect(componentSource).toContain("displayedState.value.kind === 'saved_local'");
    expect(componentSource).toContain("displayedState.value.kind === 'syncing'");
    expect(componentSource).toContain('accessibilityLiveRegion="polite"');
    expect(componentSource).toContain('accessibilityLabel={PHOTO_COPY.deleteSync.syncingTitle}');
    expect(componentSource).toContain('accessibilityState={{ busy: true }}');
    expect(componentSource).toContain("kind={needsAttention ? 'error' : 'unavailable'}");
    expect(componentSource).toContain('disabled={retrying}');
  });

  it('mounts only inside locked, storage-readable Progress scroll content', () => {
    expect(progressRoute.match(/<PhotoDeleteSyncStatus className=/g)).toHaveLength(2);
    expect(progressRoute).toContain('<PhotoStorageBoundary query={viewModel.photos} tone="paper">');
    expect(progressRoute).toContain('<PhotoTimelineLockGate>');
    expect(progressRoute).toContain('<ProGate feature="photo_timeline">');
    expect(progressRoute).toContain('<PhotoDeleteSyncStatus className="mt-3" />');
    expect(progressRoute).toContain('<PhotoDeleteSyncStatus className="mt-4" />');
    expect(detailRoute).not.toContain('PhotoDeleteSyncStatus');
    expect(privacyRoute).not.toContain('PhotoDeleteSyncStatus');
    expect(diagnosticsRoute).not.toContain('PhotoDeleteSyncStatus');
  });

  it('keeps visual fixtures development-web-only', () => {
    expect(componentSource).toContain('EXPO_PUBLIC_E2E_PHOTO_DELETE_SYNC_STATUS');
    expect(componentSource).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(componentSource).toContain("Platform.OS !== 'web'");
  });
});
