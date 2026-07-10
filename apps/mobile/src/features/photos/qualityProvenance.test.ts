import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));

function readRepo(path: string): string {
  return readFileSync(`${REPO_DIR}/${path}`, 'utf8');
}

describe('Progress quality provenance contract', () => {
  it('clears legacy values and rejects unproven quality metadata end to end', () => {
    const migration = readRepo('supabase/migrations/20260710000036_photo_quality_provenance.sql');
    const databaseTypes = readRepo('packages/types/src/database.types.ts');
    const store = readRepo('apps/mobile/src/features/photos/store.ts');

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
    expect(store).toContain('quality_source: rec.qualitySource');
    expect(store.indexOf('await getCloudBackupEnabled()')).toBeLessThan(
      store.indexOf('await supabase.auth.getUser()'),
    );
  });
});
