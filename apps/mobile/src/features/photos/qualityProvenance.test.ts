import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));

function readRepo(path: string): string {
  return readFileSync(`${REPO_DIR}/${path}`, 'utf8');
}

describe('Progress quality provenance contract', () => {
  it('keeps measured values local and rejects unproven future server metadata', () => {
    const migration = readRepo('supabase/migrations/20260710000036_photo_quality_provenance.sql');
    const databaseTypes = readRepo('packages/types/src/database.types.ts');
    const store = readRepo('apps/mobile/src/features/photos/store.ts');
    const consent = readRepo('apps/mobile/src/features/photos/consent.ts');
    const rootLayout = readRepo('apps/mobile/src/app/_layout.tsx');
    const settings = readRepo('apps/mobile/src/app/(tabs)/you.tsx');

    expect(migration).toContain('add column quality_source text');
    expect(migration).toContain('alignment_score = null');
    expect(migration).toContain('lighting_score = null');
    expect(migration).toContain('head_roll = null');
    expect(migration).toContain('photos_quality_source_allowed');
    expect(migration).toContain('photos_quality_metadata_requires_source');
    expect(migration).toContain("quality_source = 'post_capture_measurement'");
    expect(migration.indexOf('update public.photos')).toBeLessThan(
      migration.indexOf('photos_quality_metadata_requires_source'),
    );

    expect(databaseTypes).toContain('quality_source: string | null;');
    expect(databaseTypes).toContain('quality_source?: string | null;');
    expect(store).toContain("value.qualitySource === 'post_capture_measurement'");
    expect(store).not.toContain("supabase.from('photos').insert");
    expect(store).not.toContain('getCloudBackupEnabled');
    expect(consent).toContain('PHOTO_CLOUD_BACKUP_AVAILABLE = false');
    expect(consent).toContain('clearUnavailableCloudBackupPreference');
    expect(consent).not.toContain('setCloudBackupEnabled');
    expect(rootLayout).toContain('void clearUnavailableCloudBackupPreference();');
    expect(settings).toContain('Cloud backup is not available in this build.');
    expect(settings).not.toContain('cloud_backup_opted_in');
    expect(settings).not.toContain('accessibilityLabel="Encrypted cloud backup"');
  });
});
