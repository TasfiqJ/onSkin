import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  auditCatalogOperatorAuthorityContract,
  CATALOG_OPERATOR_AUTHORITY_SOURCE_KEYS,
} from './catalog-operator-authority-contract.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readMany = (paths) => paths.map((path) => read(path)).join('\n');

const sources = Object.freeze({
  migration: read('supabase/migrations/20260722000063_catalog_operator_authority.sql'),
  authorityRepair: read(
    'supabase/migrations/20260926000078_catalog_operator_public_execute_fence.sql',
  ),
  databaseTest: read('supabase/tests/database/catalog_operator_authority.test.sql'),
  raceRehearsal: read(
    'supabase/tests/rehearsal/catalog_operator_revocation_race.test.sql',
  ),
  edge: readMany([
    'supabase/functions/catalog-operator/index.ts',
    'supabase/functions/catalog-operator/httpHandler.ts',
    'supabase/functions/catalog-operator/contract.ts',
    'supabase/functions/catalog-operator/databaseGateway.ts',
    'supabase/functions/catalog-operator/databaseUrl.ts',
    'supabase/functions/catalog-operator/responseContract.ts',
    'supabase/functions/catalog-operator/runtimeContext.ts',
    'supabase/functions/catalog-operator/verifiedAuth.ts',
  ]),
  edgeTests: readMany([
    'supabase/functions/catalog-operator/httpHandler.test.ts',
    'supabase/functions/catalog-operator/contract.test.ts',
    'supabase/functions/catalog-operator/databaseGateway.test.ts',
    'supabase/functions/catalog-operator/databaseUrl.test.ts',
    'supabase/functions/catalog-operator/responseContract.test.ts',
    'supabase/functions/catalog-operator/runtimeContext.test.ts',
    'supabase/functions/catalog-operator/verifiedAuth.test.ts',
  ]),
  console: readMany([
    'apps/catalog-operator-console/src/env.ts',
    'apps/catalog-operator-console/src/auth.ts',
    'apps/catalog-operator-console/src/operatorApi.ts',
    'apps/catalog-operator-console/src/sessionTimer.ts',
    'apps/catalog-operator-console/src/sessionWorkEpoch.ts',
    'apps/catalog-operator-console/src/workflow.ts',
    'apps/catalog-operator-console/src/main.ts',
    'apps/catalog-operator-console/vite.config.ts',
    'apps/catalog-operator-console/public/_headers',
    'apps/catalog-operator-console/package.json',
  ]),
  consoleTests: readMany([
    'apps/catalog-operator-console/src/env.test.ts',
    'apps/catalog-operator-console/src/auth.test.ts',
    'apps/catalog-operator-console/src/operatorApi.test.ts',
    'apps/catalog-operator-console/src/sessionTimer.test.ts',
    'apps/catalog-operator-console/src/sessionWorkEpoch.test.ts',
    'apps/catalog-operator-console/src/workflow.test.ts',
  ]),
  runbook: read('docs/phase-4/catalog-operator-authority-runbook.md'),
  correctionPolicy: read('docs/phase-4/catalog-correction-serving-hold-policy.md'),
  packageJson: read('package.json'),
});

function mutate(key, search, replacement) {
  const changed = sources[key].replace(search, replacement);
  assert.notEqual(changed, sources[key], `test mutation must change ${key}`);
  return { ...sources, [key]: changed };
}

function rejected(changed, pattern) {
  const result = auditCatalogOperatorAuthorityContract(changed);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), pattern);
}

test('accepts the integrated CAT-08 operator authority source candidate', () => {
  const result = auditCatalogOperatorAuthorityContract(sources);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.errors), true);
});

test('requires the exact aggregate source inventory', () => {
  const missing = { ...sources };
  delete missing.migration;
  assert.throws(() => auditCatalogOperatorAuthorityContract(missing), /exact nonempty source set/);
  assert.deepEqual([...CATALOG_OPERATOR_AUTHORITY_SOURCE_KEYS].sort(), Object.keys(sources).sort());
});

test('rejects a commented Auth-session actor derivation decoy', () => {
  const changed = mutate(
    'migration',
    'select auth_session.user_id',
    'select auth_session.id',
  );
  rejected(
    {
      ...changed,
      migration: `${changed.migration}\n-- select auth_session.user_id`,
    },
    /nonanonymous live AAL2/,
  );
});

test('rejects an operator RPC grant to authenticated', () => {
  rejected(
    mutate(
      'migration',
      'grant execute on function catalog_operator_gateway.catalog_operator_session(\n  uuid, text, text, text, bigint, text\n) to catalog_operator_edge;',
      'grant execute on function catalog_operator_gateway.catalog_operator_session(\n  uuid, text, text, text, bigint, text\n) to authenticated;',
    ),
    /dedicated-gateway-role-only|unreviewed role/,
  );
});

test('requires the forward repair to close current and future PUBLIC execution', () => {
  const cases = [
    [
      'from public, catalog_operator_edge;',
      'from catalog_operator_edge;',
    ],
    [
      'from public, catalog_operator_edge;',
      'from public;',
    ],
    [
      'alter default privileges for role postgres\n  revoke execute on functions from public;',
      'alter default privileges for role postgres\n  grant execute on functions to public;',
    ],
    [
      'alter default privileges for role postgres in schema public\n  revoke execute on functions from public;',
      'alter default privileges for role postgres in schema public\n  grant execute on functions to public;',
    ],
    [
      'alter default privileges for role postgres in schema private\n  revoke execute on functions from public;',
      'alter default privileges for role postgres in schema private\n  grant execute on functions to public;',
    ],
  ];

  for (const [search, replacement] of cases) {
    rejected(
      mutate('authorityRepair', search, replacement),
      /forward repair does not close current and future PUBLIC function execution/,
    );
  }
});

test('requires object-reporting database assertions for every ambient lane', () => {
  rejected(
    mutate(
      'databaseTest',
      'the dedicated login has no ambient public/private function lane',
      'the dedicated login function lane is assumed closed',
    ),
    /Database test does not prove RPC ACLs/,
  );
});

test('rejects a reusable gateway role with superuser or membership drift checks removed', () => {
  rejected(
    mutate(
      'migration',
      "'CATALOG_OPERATOR_EDGE_ROLE_MEMBERSHIP_DRIFT'",
      "'CATALOG_OPERATOR_EDGE_ROLE_MEMBERSHIP_UNCHECKED'",
    ),
    /constrained gateway login/,
  );
});

test('rejects scheduled immutable grant revocation semantics', () => {
  rejected(
    mutate(
      'migration',
      'new.revoked_at := pg_catalog.clock_timestamp()',
      'new.revoked_at := new.revoked_at',
    ),
    /revalidate grants|server rate budgets/,
  );
});

test('rejects an unverified MFA factor', () => {
  rejected(
    mutate('migration', "factor.status::text = 'verified'", "factor.status::text = 'unverified'"),
    /nonanonymous live AAL2/,
  );
});

test('rejects a longer database operator session', () => {
  rejected(mutate('migration', "interval '10 minutes'", "interval '30 minutes'"), /bounded work-session/);
});

test('rejects authority relation inventory drift', () => {
  rejected(
    mutate(
      'migration',
      'create table private.catalog_operator_grant_revocations',
      'create table private.catalog_operator_revocations',
    ),
    /relation inventory/,
  );
});

test('rejects reporter identity copied into an independent hold', () => {
  rejected(
    mutate(
      'migration',
      '  product_id            uuid not null references public.products (id) on delete restrict,',
      '  product_id            uuid not null references public.products (id) on delete restrict,\n  reporter_user_id uuid,',
    ),
    /reporter-free/,
  );
});

test('rejects reporter erasure deleting an independent hold', () => {
  rejected(
    mutate(
      'migration',
      "  delete from private.catalog_operator_claims as claim\n  where claim.item_kind = 'correction_report'",
      "  delete from private.catalog_operator_product_holds;\n  delete from private.catalog_operator_claims as claim\n  where claim.item_kind = 'correction_report'",
    ),
    /Reporter erasure cleanup/,
  );
});

test('rejects release without current served-state proof', () => {
  const migration = sources.migration.replaceAll(
    'private.catalog_launch_current_served_state_mutation_root_sha256(',
    'private.catalog_launch_previous_served_state_mutation_root_sha256(',
  );
  assert.notEqual(migration, sources.migration);
  rejected({ ...sources, migration }, /current CAT-02\/staged-CAT-03/);
});

test('rejects release actor reuse of the repair attestor', () => {
  rejected(
    mutate(
      'migration',
      'or v_auth.actor_user_id = v_receipt.attested_by_user_id\n     or',
      'or false\n     or',
    ),
    /fourth distinct/,
  );
});

test('rejects a direct Edge service-role environment read', () => {
  rejected(
    { ...sources, edge: `${sources.edge}\nconst elevated = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');` },
    /dedicated transaction-pooler gateway/,
  );
});

test('rejects hosted Postgres TLS without certificate and hostname verification', () => {
  rejected(
    mutate(
      'edge',
      'ssl: appEnvironment === "development" ? false : "verify-full"',
      'ssl: appEnvironment === "development" ? false : "require"',
    ),
    /dedicated transaction-pooler gateway/,
  );
});

test('rejects an Edge auth boundary without exact Supabase issuer binding', () => {
  rejected(
    mutate(
      'edge',
      'claims.iss !== expectedIssuer',
      'typeof claims.iss !== "string"',
    ),
    /signed-AAL2 publishable-key admission/,
  );
});

test('rejects a missing frozen-runtime database binding', () => {
  rejected(
    mutate(
      'migration',
      "'CATALOG_OPERATOR_RUNTIME_FROZEN_OR_MISMATCH'",
      "'CATALOG_OPERATOR_RUNTIME_UNCHECKED'",
    ),
    /frozen, receipt-bound runtime control/,
  );
});

test('rejects a non-gateway Postgres function target', () => {
  rejected(
    mutate(
      'edge',
      'catalog_operator_gateway.catalog_operator_session(',
      'public.catalog_operator_session(',
    ),
    /dedicated transaction-pooler gateway/,
  );
});

test('rejects correction evidence accepted by the Edge parser', () => {
  rejected(
    mutate(
      'edge',
      'if (Object.hasOwn(body, "evidenceSha256")) return invalid();',
      'if (false) return invalid();',
    ),
    /evidence-scoped/,
  );
});

test('rejects non-HTTPS production origins', () => {
  rejected(
    mutate('edge', 'parsed.protocol !== "https:"', 'parsed.protocol !== "http:"'),
    /allowlisted origin/,
  );
});

test('rejects a commented publishable-key helper decoy', () => {
  const changed = mutate('edge', 'readSupabasePublishableKey()', 'readUnreviewedKey()');
  rejected(
    { ...changed, edge: `${changed.edge}\n// readSupabasePublishableKey()` },
    /publishable-key/,
  );
});

test('rejects persistent browser auth in the console', () => {
  rejected(mutate('console', 'persistSession: false', 'persistSession: true'), /Console auth/);
});

test('rejects a console session boundary without asynchronous work invalidation', () => {
  rejected(
    mutate(
      'console',
      'sessionWorkEpoch.invalidate()',
      'sessionWorkEpoch.capture()',
    ),
    /no-persistence, no-store, timer-bounded, hardened internal surface/,
  );
});

test('rejects a logout path that keeps the retired token-bearing Auth client', () => {
  rejected(
    mutate(
      'console',
      'this.#client = this.#clientFactory(this.#environment)',
      'this.#client = retiredClient',
    ),
    /no-persistence, no-store, timer-bounded, hardened internal surface/,
  );
});

test('rejects a direct console database RPC path', () => {
  rejected(
    { ...sources, console: `${sources.console}\nvoid client.rpc('catalog_operator_session');` },
    /Edge-only/,
  );
});

test('rejects a longer console inactivity window', () => {
  rejected(
    mutate(
      'console',
      'OPERATOR_IDLE_TIMEOUT_MS = 15 * 60 * 1000',
      'OPERATOR_IDLE_TIMEOUT_MS = 60 * 60 * 1000',
    ),
    /timer-bounded/,
  );
});

test('rejects missing stale-proof database coverage', () => {
  const databaseTest = sources.databaseTest.replaceAll(
    'CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED',
    'CATALOG_OPERATOR_REPAIR_PROOF_SKIPPED',
  );
  assert.notEqual(databaseTest, sources.databaseTest);
  rejected(
    { ...sources, databaseTest },
    /stale-proof denial/,
  );
});

test('rejects a concurrency rehearsal that stops proving the session-revocation lock wait', () => {
  rejected(
    mutate(
      'raceRehearsal',
      "'the real session request waits behind the uncommitted revocation'",
      "'the real session request runs without waiting for revocation'",
    ),
    /Two-connection rehearsal/,
  );
});

test('rejects a scheduler-sensitive wall-clock race latch', () => {
  rejected(
    mutate(
      'raceRehearsal',
      'perform pg_catalog.pg_advisory_xact_lock(p_latch_key)',
      'perform pg_catalog.pg_sleep(0.8)',
    ),
    /Two-connection rehearsal/,
  );
});

test('rejects a runbook that claims the source is deployed', () => {
  rejected(
    mutate('runbook', 'not deployed or E2E-proven', 'deployed and E2E-proven'),
    /Runbook is missing/,
  );
});

test('rejects launch verification disconnected from the console gate', () => {
  const packageRecord = JSON.parse(sources.packageJson);
  packageRecord.scripts['launch:verify'] = packageRecord.scripts['launch:verify'].replace(
    ' && npm run phase4:catalog-operator-console:verify',
    '',
  );
  rejected({ ...sources, packageJson: `${JSON.stringify(packageRecord, null, 2)}\n` }, /Package verification/);
});

test('rejects an aggregate authority gate without the adversarial fixture contract', () => {
  const packageRecord = JSON.parse(sources.packageJson);
  packageRecord.scripts['phase4:operator-authority-contract:test'] =
    'node --test scripts/phase4/catalog-operator-authority-contract.test.mjs';
  rejected(
    { ...sources, packageJson: `${JSON.stringify(packageRecord, null, 2)}\n` },
    /Package verification/,
  );
});
