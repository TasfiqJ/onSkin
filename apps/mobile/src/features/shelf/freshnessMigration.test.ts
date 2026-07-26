import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const freshnessMigration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

const localDateBoundaryMigration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260726000056_shelf_local_date_boundary.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('server Shelf freshness invariants', () => {
  it('backfills without inventing an opened date before adding coherence checks', () => {
    expect(freshnessMigration).toContain('set is_opened = false');
    expect(freshnessMigration).not.toMatch(/opened_at\s*=\s*(created_at|updated_at|current_date)/i);
    expect(freshnessMigration).toContain('where opened_at > current_date');
    expect(freshnessMigration.indexOf('set is_opened = false')).toBeLessThan(
      freshnessMigration.indexOf('user_products_opened_state_coherent'),
    );
  });

  it('requires opened, PAO, and winning expiry provenance to agree', () => {
    expect(freshnessMigration).toContain('user_products_opened_state_coherent');
    expect(freshnessMigration).toContain('opened_at <= current_date');
    expect(freshnessMigration).toContain('user_products_pao_source_coherent');
    expect(freshnessMigration).toContain('user_products_expiry_source_coherent');
    expect(freshnessMigration).toContain('expiry_computed = expiry_date');
    expect(freshnessMigration).toContain("else 'pao_computed'");
  });

  it('allows UTC tomorrow without depending on the database session timezone', () => {
    const executableMigration = localDateBoundaryMigration.replace(/^--.*$/gm, '');

    expect(localDateBoundaryMigration).toContain(
      "(pg_catalog.statement_timestamp() at time zone 'UTC')::date + 1",
    );
    expect(executableMigration).not.toContain('current_date');
    expect(localDateBoundaryMigration).toContain('or (is_opened = false and opened_at is null)');
  });

  it('validates the replacement before retiring and renaming the canonical constraint', () => {
    const addIndex = localDateBoundaryMigration.indexOf(
      'add constraint user_products_opened_state_coherent_utc_tomorrow',
    );
    const validateIndex = localDateBoundaryMigration.indexOf(
      'validate constraint user_products_opened_state_coherent_utc_tomorrow',
    );
    const dropIndex = localDateBoundaryMigration.indexOf(
      'drop constraint user_products_opened_state_coherent',
    );
    const renameIndex = localDateBoundaryMigration.indexOf(
      'rename constraint user_products_opened_state_coherent_utc_tomorrow',
    );

    expect(localDateBoundaryMigration).toMatch(
      /user_products_opened_state_coherent_utc_tomorrow[\s\S]*not valid;/,
    );
    expect(addIndex).toBeGreaterThanOrEqual(0);
    expect(validateIndex).toBeGreaterThan(addIndex);
    expect(dropIndex).toBeGreaterThan(validateIndex);
    expect(renameIndex).toBeGreaterThan(dropIndex);
    expect(localDateBoundaryMigration).not.toContain(
      'drop constraint user_products_pao_source_coherent',
    );
    expect(localDateBoundaryMigration).not.toContain(
      'drop constraint user_products_expiry_source_coherent',
    );
  });
});
