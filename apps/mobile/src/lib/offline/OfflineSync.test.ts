import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const OFFLINE_SYNC = fileURLToPath(new URL('./OfflineSync.tsx', import.meta.url));

describe('OfflineSync query invalidation', () => {
  it('refreshes the queries Today actually reads after a completion flush', () => {
    const source = readFileSync(OFFLINE_SYNC, 'utf8');

    expect(source).toContain('ownerQueryPrefixes.completions(ownerScope)');
    expect(source).toContain('ownerQueryPrefixes.progress(ownerScope)');
    expect(source).toContain('flushOutbox()');
    expect(source).toContain('ownerQueryPrefixes.shelf(ownerScope)');
    expect(source).toContain('outbox.flushedByEntity.shelfProducts');
    expect(source).toContain('outbox.flushedByEntity.notificationPreferences');
    expect(source).toContain('ownerQueryPrefixes.notificationPreferences(ownerScope)');
    expect(source).toContain('onlineManager.subscribe');
    expect(source).not.toContain("invalidateQueries({ queryKey: ['today'] })");
    expect(source).toContain("markStartupPhase('startup_reconciliation_complete')");
    expect(source).toContain('if (isOwnerQueryScopeCurrent(ownerScope))');
  });

  it('gates outbox retry scheduling across the app lifecycle', () => {
    const source = readFileSync(OFFLINE_SYNC, 'utf8');
    const mountState = source.indexOf("const isActive = AppState.currentState === 'active';");
    const mountGate = source.indexOf('setOutboxSchedulerActive(isActive);', mountState);
    const initialRun = source.indexOf('if (isActive) run();', mountGate);
    const lifecycleListener = source.indexOf("AppState.addEventListener('change'");
    const lifecycleGate = source.indexOf('setOutboxSchedulerActive(isActive);', lifecycleListener);
    const foregroundRun = source.indexOf('if (isActive) run();', lifecycleGate);
    const connectivityListener = source.indexOf('onlineManager.subscribe');
    const foregroundConnectivityRun = source.indexOf(
      "if (online && AppState.currentState === 'active') run();",
    );
    const cleanup = source.indexOf('return () => {');
    const cleanupGate = source.indexOf('setOutboxSchedulerActive(false);', cleanup);
    const removeAppStateListener = source.indexOf('sub.remove();', cleanup);
    const removeOnlineListener = source.indexOf('unsubscribeOnline();', cleanup);

    expect(source).toContain("import { flushOutbox, setOutboxSchedulerActive } from './outbox';");
    expect(mountState).toBeGreaterThan(-1);
    expect(mountGate).toBeGreaterThan(mountState);
    expect(initialRun).toBeGreaterThan(mountGate);
    expect(lifecycleListener).toBeGreaterThan(initialRun);
    expect(lifecycleGate).toBeGreaterThan(lifecycleListener);
    expect(foregroundRun).toBeGreaterThan(lifecycleGate);
    expect(connectivityListener).toBeGreaterThan(foregroundRun);
    expect(foregroundConnectivityRun).toBeGreaterThan(connectivityListener);
    expect(cleanupGate).toBeGreaterThan(cleanup);
    expect(removeAppStateListener).toBeGreaterThan(cleanupGate);
    expect(removeOnlineListener).toBeGreaterThan(removeAppStateListener);
  });
});
