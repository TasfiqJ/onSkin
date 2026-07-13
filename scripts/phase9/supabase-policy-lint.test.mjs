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
const COMPLETION_KEY = 'account_deletion_completion_status(text)';

function runFixture(transform = (sql) => sql) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'onskin-policy-lint-'));
  try {
    const fixtureMigrations = join(fixtureRoot, 'supabase/migrations');
    mkdirSync(fixtureMigrations, { recursive: true });
    cpSync(MIGRATIONS, fixtureMigrations, { recursive: true });
    const target = join(fixtureMigrations, TARGET_MIGRATION);
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
