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
    expect(source).toContain('onlineManager.subscribe');
    expect(source).not.toContain("invalidateQueries({ queryKey: ['today'] })");
    expect(source).toContain("markStartupPhase('startup_reconciliation_complete')");
    expect(source).toContain('if (isOwnerQueryScopeCurrent(ownerScope))');
  });
});
