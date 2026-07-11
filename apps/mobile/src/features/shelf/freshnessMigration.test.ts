import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('server Shelf freshness invariants', () => {
  it('backfills without inventing an opened date before adding coherence checks', () => {
    expect(migration).toContain('set is_opened = false');
    expect(migration).not.toMatch(/opened_at\s*=\s*(created_at|updated_at|current_date)/i);
    expect(migration).toContain('where opened_at > current_date');
    expect(migration.indexOf('set is_opened = false')).toBeLessThan(
      migration.indexOf('user_products_opened_state_coherent'),
    );
  });

  it('requires opened, PAO, and winning expiry provenance to agree', () => {
    expect(migration).toContain('user_products_opened_state_coherent');
    expect(migration).toContain('opened_at <= current_date');
    expect(migration).toContain('user_products_pao_source_coherent');
    expect(migration).toContain('user_products_expiry_source_coherent');
    expect(migration).toContain('expiry_computed = expiry_date');
    expect(migration).toContain("else 'pao_computed'");
  });
});
