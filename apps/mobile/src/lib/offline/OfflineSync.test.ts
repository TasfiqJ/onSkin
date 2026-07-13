import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const OFFLINE_SYNC = fileURLToPath(new URL('./OfflineSync.tsx', import.meta.url));

describe('OfflineSync query invalidation', () => {
  it('refreshes the queries Today actually reads after a completion flush', () => {
    const source = readFileSync(OFFLINE_SYNC, 'utf8');

    expect(source).toContain('ownerQueryPrefixes.completions(ownerScope)');
    expect(source).toContain('ownerQueryPrefixes.progress(ownerScope)');
    expect(source).not.toContain("invalidateQueries({ queryKey: ['today'] })");
  });
});
