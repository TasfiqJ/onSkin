import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LINTER = join(ROOT, 'scripts/phase9/supabase-policy-lint.mjs');
const MIGRATIONS = join(ROOT, 'supabase/migrations');
const TARGET_MIGRATION = '20260713000043_account_deletion_resumable.sql';
const SEARCH_BOUNDARY_MIGRATION = '20260921000073_catalog_search_promotion_boundary.sql';
const OUTBOX_MIGRATION = '20260718000046_shelf_outbox_rpc.sql';
const PHOTO_MIGRATION = '20260726000058_photo_delete_outbox_rpc.sql';
const PHOTO_OWNER_MIGRATION = '20260612000008_photos.sql';
const COMPLETION_KEY = 'account_deletion_completion_status(text)';

function runFixture(transform = (sql) => sql, targetMigration = TARGET_MIGRATION) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'layerwell-policy-lint-'));
  try {
    const fixtureMigrations = join(fixtureRoot, 'supabase/migrations');
    mkdirSync(fixtureMigrations, { recursive: true });
    cpSync(MIGRATIONS, fixtureMigrations, { recursive: true });
    const target = join(fixtureMigrations, targetMigration);
    const original = readFileSync(target, 'utf8');
    const changed = transform(original);
    assert.notEqual(changed.length, 0, 'fixture transform produced an empty migration.');
    writeFileSync(target, changed);

    const result = spawnSync(process.execPath, [LINTER], {
      cwd: fixtureRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function replaceRequired(source, before, after) {
  assert.ok(source.includes(before), `fixture source is missing ${JSON.stringify(before)}.`);
  return source.replace(before, after);
}

test('policy lint accepts the complete checked-in migration ACL and RLS inventory', () => {
  const output = runFixture();
  assert.match(output, /Phase 9 Supabase policy lint passed code gates/);
  assert.doesNotMatch(output, /FAIL /);
});

test('policy lint accepts the narrow anonymous terminal completion capability', () => {
  const output = runFixture();
  assert.doesNotMatch(output, new RegExp(`FAIL ${COMPLETION_KEY.replace(/[()]/g, '\\$&')}`));
  assert.doesNotMatch(output, /FAIL account_deletion_claim/);
});

test('policy lint rejects a PUBLIC grant for the completion capability', () => {
  const grant = `grant execute on function public.${COMPLETION_KEY}\n  to anon, authenticated, service_role;`;
  const output = runFixture((sql) =>
    replaceRequired(
      sql,
      grant,
      `${grant}\ngrant execute on function public.${COMPLETION_KEY}\n  to public;`,
    ),
  );

  assert.match(
    output,
    new RegExp(`${COMPLETION_KEY.replace(/[()]/g, '\\$&')} must not grant execute to public`),
  );
  assert.match(
    output,
    new RegExp(
      `${COMPLETION_KEY.replace(/[()]/g, '\\$&')} must grant execute exactly to anon, authenticated, and service_role`,
    ),
  );
});

test('policy lint keeps anon forbidden for every other SECURITY DEFINER RPC', () => {
  const preflightKey = 'account_deletion_preflight(uuid, text)';
  const grant = `grant execute on function public.${preflightKey}\n  to service_role;`;
  const output = runFixture((sql) =>
    replaceRequired(
      sql,
      grant,
      `${grant}\ngrant execute on function public.${preflightKey}\n  to anon;`,
    ),
  );

  assert.match(
    output,
    /account_deletion_preflight\(uuid, text\) must not grant execute to anon unless it is an approved capability RPC/,
  );
});

test('policy lint requires every reviewed role on the completion capability', () => {
  const grant = `grant execute on function public.${COMPLETION_KEY}\n  to anon, authenticated, service_role;`;
  const output = runFixture((sql) =>
    replaceRequired(
      sql,
      grant,
      `grant execute on function public.${COMPLETION_KEY}\n  to authenticated, service_role;`,
    ),
  );

  assert.match(
    output,
    new RegExp(
      `${COMPLETION_KEY.replace(/[()]/g, '\\$&')} must grant execute exactly to anon, authenticated, and service_role`,
    ),
  );
});

test('policy lint requires an explicit anon revoke for the completion capability', () => {
  const revoke = `revoke all on function public.${COMPLETION_KEY}\n  from public, anon, authenticated;`;
  const output = runFixture((sql) =>
    replaceRequired(
      sql,
      revoke,
      `revoke all on function public.${COMPLETION_KEY}\n  from public, authenticated;`,
    ),
  );

  assert.match(
    output,
    new RegExp(
      `${COMPLETION_KEY.replace(/[()]/g, '\\$&')} must revoke execute from public, anon, and authenticated`,
    ),
  );
});

test('policy lint rejects a weakened completion capability token', () => {
  const output = runFixture((sql) =>
    replaceRequired(
      sql,
      "p_completion_token_hash !~ '^t_[0-9a-f]{64}$'",
      "p_completion_token_hash !~ '^t_[0-9a-f]{32}$'",
    ),
  );

  assert.match(
    output,
    new RegExp(
      `${COMPLETION_KEY.replace(/[()]/g, '\\$&')} must validate a high-entropy capability and reveal complete receipts only`,
    ),
  );
});

test('policy lint rejects a capability that can reveal an incomplete receipt', () => {
  const predicate = `where deletion.completion_token_hash = p_completion_token_hash\n    and deletion.next_step = 'complete';`;
  const output = runFixture((sql) =>
    replaceRequired(
      sql,
      predicate,
      'where deletion.completion_token_hash = p_completion_token_hash;',
    ),
  );

  assert.match(
    output,
    new RegExp(
      `${COMPLETION_KEY.replace(/[()]/g, '\\$&')} must validate a high-entropy capability and reveal complete receipts only`,
    ),
  );
});

test('policy lint rejects a terminal capability predicate widened with OR', () => {
  const output = runFixture((sql) =>
    replaceRequired(
      sql,
      "and deletion.next_step = 'complete';",
      "and deletion.next_step = 'complete' or true;",
    ),
  );

  assert.match(output, /must validate a high-entropy capability and reveal complete receipts only/);
});

test('policy lint requires final catalog search to stay service-only SECURITY DEFINER', () => {
  const output = runFixture(
    (sql) =>
      replaceRequired(
        sql,
        'stable\nsecurity definer\nset search_path',
        'stable\nsecurity invoker\nset search_path',
      ),
    SEARCH_BOUNDARY_MIGRATION,
  );

  assert.match(output, /search_catalog_products\(text, integer\) must remain SECURITY DEFINER/);
});

test('policy lint rejects raw-product search replacing the final CAT-03 view', () => {
  const output = runFixture(
    (sql) =>
      replaceRequired(
        sql,
        'from public.catalog_servable_products as product',
        'from public.products as product',
      ),
    SEARCH_BOUNDARY_MIGRATION,
  );
  assert.match(output, /catalog search must read the exact current CAT-03 servable projection/);
});

test('policy lint rejects reinstating the service-role one-argument catalog promotion RPC', () => {
  const output = runFixture(
    (sql) => replaceRequired(sql, 'drop function public.promote_catalog_import(uuid);', ''),
    SEARCH_BOUNDARY_MIGRATION,
  );
  assert.match(output, /one-argument catalog promotion RPC must remain retired/);
});

test('policy lint rejects an anonymous outbox RPC grant', () => {
  const output = runFixture(
    (sql) =>
      replaceRequired(
        sql,
        'grant execute on function public.apply_shelf_outbox_batch(jsonb) to authenticated;',
        'grant execute on function public.apply_shelf_outbox_batch(jsonb) to authenticated, anon;',
      ),
    OUTBOX_MIGRATION,
  );

  assert.match(output, /apply_shelf_outbox_batch\(jsonb\) must not grant execute to anon/);
});

test('policy lint accepts only the restrictive owner-scoped photo rewrite exception', () => {
  const output = runFixture(
    (sql) =>
      replaceRequired(
        sql,
        'as restrictive for update to authenticated\n  using (true)',
        'for update to authenticated\n  using (true)',
      ),
    PHOTO_MIGRATION,
  );

  assert.match(
    output,
    /photos_no_outbox_delete_rewrite on public.photos uses using \(true\) outside/,
  );
});

test('policy lint requires the photo rewrite exception to retain owner UPDATE RLS', () => {
  const output = runFixture(
    (sql) =>
      replaceRequired(
        sql,
        'for update to authenticated using ((select auth.uid()) = user_id)\n  with check ((select auth.uid()) = user_id);',
        'for update to authenticated using (true)\n  with check ((select auth.uid()) = user_id);',
      ),
    PHOTO_OWNER_MIGRATION,
  );

  assert.match(
    output,
    /photos_no_outbox_delete_rewrite requires the owner-scoped photos_update_own policy/,
  );
});
