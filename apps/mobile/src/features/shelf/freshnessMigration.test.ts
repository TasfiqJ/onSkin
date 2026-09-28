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

const correctiveMigration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

const shelfStore = readFileSync(fileURLToPath(new URL('./store.ts', import.meta.url)), 'utf8');

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

describe('CAT-07 corrective freshness migration', () => {
  it('keeps quarantined historical dates local while mirroring actionable package dates', () => {
    expect(shelfStore).not.toContain('legacy_unverified_expiry_date');
    expect(shelfStore).toContain('expiry_date: product.expiryDate');
  });

  it('purges and seals the unreviewed legacy PAO table', () => {
    expect(correctiveMigration).toContain('delete from public.ingredient_pao_defaults;');
    expect(correctiveMigration).toContain(
      'alter table public.ingredient_pao_defaults force row level security',
    );
    expect(correctiveMigration).toContain(
      'revoke all on table public.ingredient_pao_defaults\n  from public, anon, authenticated, service_role;',
    );
    expect(correctiveMigration).toContain(
      'add constraint ingredient_pao_defaults_legacy_empty check (false)',
    );
    expect(correctiveMigration).toContain('not current Shelf PAO authority');
  });

  it('keeps category defaults launch-disabled while retaining product-specific catalog evidence', () => {
    expect(correctiveMigration).toContain('set pao_months = null');
    expect(correctiveMigration).toContain("where pao_source = 'category_default'");
    expect(correctiveMigration).toContain(
      'create or replace function private.resolve_catalog_pao_snapshot',
    );
    expect(correctiveMigration).toContain("freshness.review_status = 'reviewed'");
    expect(correctiveMigration).toContain(
      "nullif(pg_catalog.btrim(freshness.reviewed_by), '') is not null",
    );
    expect(correctiveMigration).toContain(
      "freshness.pao_source in ('label', 'brand_label', 'catalog')",
    );
    expect(correctiveMigration).toContain(
      'create or replace function private.guard_user_product_category_default_evidence',
    );
    expect(correctiveMigration).toContain("new.pao_source := 'unknown'");
    expect(correctiveMigration).not.toContain('reviewed_category_default');
  });

  it('backfills before restoring a coherent truthful-source constraint', () => {
    const dropConstraint = correctiveMigration.indexOf(
      'drop constraint if exists user_products_expiry_source_coherent',
    );
    const expiryBackfill = correctiveMigration.indexOf(
      'update public.user_products\nset expiry_source',
    );
    const addConstraint = correctiveMigration.indexOf(
      'add constraint user_products_expiry_source_coherent',
    );

    expect(dropConstraint).toBeGreaterThanOrEqual(0);
    expect(dropConstraint).toBeLessThan(expiryBackfill);
    expect(expiryBackfill).toBeLessThan(addConstraint);
    expect(correctiveMigration).toContain("where pao_source = 'unknown'");
    expect(correctiveMigration).toContain('add constraint user_products_pao_source_coherent');
    expect(correctiveMigration).toContain("and pao_source in ('label', 'catalog')");
    expect(correctiveMigration).toContain("when is_opened = false then 'unknown'");
    expect(correctiveMigration).toContain("where pao_source = 'category_default'");
    expect(correctiveMigration).toContain(
      "when pao_source in ('label', 'catalog') then 'pao_computed'",
    );
    expect(correctiveMigration).not.toContain("when is_opened = false then 'estimated'");
  });
});
