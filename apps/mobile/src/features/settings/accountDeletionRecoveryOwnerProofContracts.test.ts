import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const recovery = readFileSync(
  fileURLToPath(new URL('./accountDeletionRecovery.ts', import.meta.url)),
  'utf8',
);

describe('account-deletion recovery owner-proof source contract', () => {
  it('uses the canonical full proof validator rather than the owner key alone', () => {
    expect(recovery).toContain('readLocalDataOwnerProofBinding,');
    expect(recovery).toContain('readLocalOwnerBinding: readLocalDataOwnerProofBinding');
    expect(recovery).not.toContain('LOCAL_DATA_OWNER_HASH_KEY');
    expect(recovery).not.toContain('AsyncStorage.getItem');
  });
});
