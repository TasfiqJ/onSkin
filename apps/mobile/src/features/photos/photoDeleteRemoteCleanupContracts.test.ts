import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LOCAL_PRIVATE_DATA_KEYS,
  LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES,
} from '@/features/settings/localPrivateDataKeys';
import { HEALTH_PURPOSE_PRIVATE_DATA_KEYS } from '@/lib/consent/healthDataWriteAdmission';

const sourceRoot = resolve(import.meta.dirname, '../..');
const source = (path: string) => readFileSync(resolve(sourceRoot, path), 'utf8');
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('C-08B2-R3 minimal remote cleanup capability boundaries', () => {
  it('keeps the complete health journal destructible while only the minimal per-owner prefix survives sign-out', () => {
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).toContain('layerwell.photos.deleteJournal.v1');
    expect(LOCAL_PRIVATE_DATA_KEYS).toContain('layerwell.photos.deleteJournal.v1');
    expect(LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES).toContain('layerwell.photoDeleteCleanup.v1.');
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).not.toContain('layerwell.photoDeleteCleanup.v1.');
    expect(LOCAL_PRIVATE_DATA_KEYS).not.toContain('layerwell.photoDeleteCleanup.v1.');
    const cleanup = source('features/settings/localPrivateData.ts');
    expect(cleanup).toContain('...LOCAL_PRIVATE_DATA_KEYS');
    expect(cleanup).not.toContain('erasePhotoDeleteRemoteCleanup');
    const auth = source('lib/auth/AuthProvider.tsx');
    expect(auth).toContain('await applySessionBoundaryRef.current(null)');
    expect(source('lib/auth/localAccountIsolation.ts')).toContain(
      'await clearAccountIsolatedState',
    );
  });

  it('limits raw erasure to authoritative photo-purpose, full-health, and terminal-account owner cleanup', () => {
    const consumers = files(sourceRoot)
      .filter((path) => readFileSync(path, 'utf8').includes('erasePhotoDeleteRemoteCleanup'))
      .map((path) => path.replaceAll('\\', '/').slice(sourceRoot.replaceAll('\\', '/').length + 1))
      .sort();
    expect(consumers).toEqual([
      'features/healthConsent/selectiveCleanup.ts',
      'features/photos/photoDeleteRemoteCleanup.ts',
      'features/photos/store.ts',
      'features/settings/accountDeletionRecovery.ts',
    ]);
    const photoCleanup = source('features/photos/store.ts').split('export async function clearPhotos')[1]!;
    expect(photoCleanup).toContain('runPhotoStoreCleanup');
    expect(photoCleanup).toContain('await readLocalDataOwnerProofBinding()');
    expect(photoCleanup).toContain('erasePhotoDeleteRemoteCleanupForBinding(ownerBinding)');
    expect(source('features/photos/consent.ts')).toContain('deleteLocalOnAuthoritativeClose: clearPhotos');
    const health = source('features/healthConsent/selectiveCleanup.ts');
    expect(
      health.indexOf('await attempt(waitForAccountGenerationOperationsToSettle)'),
    ).toBeLessThan(health.indexOf('await erasePhotoDeleteRemoteCleanupForOwner(ownerUserId)'));
    const terminal = source('features/settings/accountDeletionRecovery.ts').split(
      'export async function finalizeCompletedAccountDeletion',
    )[1]!;
    expect(terminal.indexOf("record.state !== 'completed'")).toBeLessThan(
      terminal.indexOf('await dependencies.clearPhotoDeleteCleanup'),
    );
    expect(
      terminal.indexOf('await completeAccountDeletionLocalSignOutWithStartedCleanup'),
    ).toBeLessThan(terminal.indexOf('await dependencies.clearPhotoDeleteCleanup'));
    expect(terminal.indexOf('await dependencies.clearPhotoDeleteCleanup')).toBeLessThan(
      terminal.indexOf('await dependencies.clearCompletedState'),
    );
  });

  it('keeps production replay behind exact current account/health ownership without stored bearer credentials', () => {
    const vault = source('features/photos/photoDeleteRemoteCleanup.ts');
    const replay = source('features/photos/store.ts')
      .split('export function retryPhotoDeletes')[1]!
      .split('async function persist')[0]!;
    expect(vault).toContain('new LargeSecureStore()');
    expect(vault).toContain('assertHealthDataWriteLease(lease)');
    expect(vault).toContain('storage.getItem(keyForBinding(ownerBinding))');
    expect(vault).not.toContain('getAllKeys');
    expect(vault).not.toContain('supabase.rpc');
    expect(vault).not.toMatch(/access_token|refresh_token|localUri|notesCiphertext/);
    expect(replay).toContain('authenticatedOwnerUserId !== lease.ownerUserId');
    expect(replay).toContain('.abortSignal(controller.signal)');
    expect(replay).not.toContain('getSession(');
    expect(replay).not.toContain('getItemAsync');
  });
});
