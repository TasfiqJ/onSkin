import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(fileURLToPath(new URL('./useEntitlement.ts', import.meta.url)), 'utf8');

describe('useEntitlement evidence publication contract', () => {
  it('derives provider persistence from the durable admissible merge, never effective union access', () => {
    expect(SOURCE).toContain('isDurablyAdmissibleStoreResult(');
    expect(SOURCE).toContain(
      'nativeCall.markProviderResultPersisted(persisted.providerResultPersisted)',
    );
    expect(SOURCE).not.toContain(
      'nativeCall.markProviderResultPersisted(entitlement?.isActive === true)',
    );
    expect(SOURCE).not.toContain('server ?? local');
  });

  it('uses exact owner-bound query keys for reads, cancellation, updates, and invalidation', () => {
    expect(SOURCE).toContain('entitlementQueryKey(');
    expect(SOURCE).toContain('exact: true');
    expect(SOURCE).not.toContain('queryKey: ENTITLEMENT_QUERY_KEY');
  });
});
