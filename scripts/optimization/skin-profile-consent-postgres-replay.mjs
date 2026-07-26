import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const IMAGE = process.env.SKIN_PROFILE_CONSENT_POSTGRES_IMAGE ?? 'postgres:15-alpine';
const CONTAINER = `onskin-consent-${process.pid}`;
const DATABASE = 'onskin_consent';
const OWNER_A = '00000000-0000-4000-8000-000000000001';
const OWNER_B = '00000000-0000-4000-8000-000000000002';
const VERSION = 'draft-v1-2026-07-10';
const HASH = '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd';

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function psql(sql) {
  return docker([
    'exec',
    CONTAINER,
    'psql',
    '-X',
    '-qAt',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    DATABASE,
    '-c',
    sql,
  ]);
}

function psqlFailure(sql) {
  try {
    psql(sql);
  } catch (error) {
    return String(error?.stderr ?? error?.message ?? '');
  }
  throw new Error('Expected PostgreSQL statement to fail.');
}

function asOwner(owner, sql) {
  return String.raw`
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '${owner}', false);
${sql}
reset role;`;
}

function insertProfile(owner, marker) {
  return String.raw`
insert into public.skin_profiles (
  user_id, oily_dry, sensitive_resistant, pigmented_non, wrinkled_tight,
  goals, completed_at, version
) values (
  '${owner}', 1, 1, 1, 1, array['${marker}'], pg_catalog.clock_timestamp(), 1
);`;
}

function insertConsent({
  owner = OWNER_A,
  granted,
  version = VERSION,
  hash = HASH,
  grantedAt = null,
}) {
  return String.raw`
insert into public.consents (
  user_id, consent_type, granted, version, consent_text_hash${grantedAt ? ', granted_at' : ''}
) values (
  '${owner}', 'health_data_collection', ${String(granted)}, '${version}', '${hash}'${
    grantedAt ? `, '${grantedAt}'` : ''
  }
);`;
}

function assertSql(sql, expected, label) {
  const actual = psql(sql);
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function waitForPostgres() {
  let consecutiveSuccesses = 0;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      docker([
        'exec',
        CONTAINER,
        'psql',
        '-X',
        '-qAt',
        '-U',
        'postgres',
        '-d',
        DATABASE,
        '-c',
        'select 1',
      ]);
      consecutiveSuccesses += 1;
      if (consecutiveSuccesses >= 3) return;
    } catch {
      consecutiveSuccesses = 0;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('PostgreSQL did not become ready.');
}

function runConcurrent(sql) {
  const child = spawn(
    'docker',
    [
      'exec',
      CONTAINER,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      DATABASE,
      '-c',
      sql,
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  return {
    child,
    completion: new Promise((resolveCompletion) => {
      child.on('close', (code) => resolveCompletion({ code, stdout, stderr }));
    }),
  };
}

const bootstrap = String.raw`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
create table auth.users (id uuid primary key);
insert into auth.users (id) values ('${OWNER_A}'), ('${OWNER_B}');
`;

const accountLockStub = String.raw`
create or replace function public.fixture_account_deletion_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger trg_consents_account_deletion_freeze
  before insert or update or delete on public.consents
  for each row execute function public.fixture_account_deletion_lock();
create trigger trg_skin_profiles_account_deletion_freeze
  before insert or update or delete on public.skin_profiles
  for each row execute function public.fixture_account_deletion_lock();
`;

let started = false;
try {
  docker([
    'run',
    '--detach',
    '--rm',
    '--name',
    CONTAINER,
    '--env',
    'POSTGRES_PASSWORD=postgres',
    '--env',
    `POSTGRES_DB=${DATABASE}`,
    IMAGE,
  ]);
  started = true;
  waitForPostgres();
  psql(bootstrap);
  psql(readFileSync(resolve(ROOT, 'supabase/migrations/20260612000004_skin_profiles.sql'), 'utf8'));
  psql(readFileSync(resolve(ROOT, 'supabase/migrations/20260612000010_consents.sql'), 'utf8'));
  psql(accountLockStub);
  psql(String.raw`
grant select, insert, update, delete on public.skin_profiles to authenticated;
grant select, insert on public.consents to authenticated;
grant select, insert, update, delete on public.consents to service_role;
`);

  const forward = readFileSync(
    resolve(ROOT, 'supabase/migrations/20260726000057_skin_profile_consent_gate.sql'),
    'utf8',
  );
  psql(forward);
  psql(forward);

  psqlFailure(asOwner(OWNER_A, insertProfile(OWNER_A, 'no-consent')));
  psql(asOwner(OWNER_A, insertConsent({ granted: false })));
  psqlFailure(asOwner(OWNER_A, insertProfile(OWNER_A, 'revoked')));
  psql(asOwner(OWNER_A, insertConsent({ granted: true, version: 'stale-v0' })));
  psqlFailure(asOwner(OWNER_A, insertProfile(OWNER_A, 'stale')));
  psql(asOwner(OWNER_A, insertConsent({ granted: true, hash: 'wrong-hash' })));
  psqlFailure(asOwner(OWNER_A, insertProfile(OWNER_A, 'wrong-hash')));
  psql(asOwner(OWNER_A, insertConsent({ granted: true })));
  psql(asOwner(OWNER_A, insertProfile(OWNER_A, 'exact-grant')));

  psqlFailure(asOwner(OWNER_B, insertProfile(OWNER_A, 'foreign-owner')));
  psqlFailure(
    asOwner(
      OWNER_A,
      "update public.skin_profiles set goals = array['clear_skin'] where user_id = auth.uid();",
    ),
  );

  psql(String.raw`
set role service_role;
${insertConsent({ granted: true, grantedAt: '2099-01-01T00:00:00.000Z' })}
reset role;`);
  psqlFailure(asOwner(OWNER_A, insertProfile(OWNER_A, 'future-grant')));
  psql(String.raw`
delete from public.consents
where user_id = '${OWNER_A}' and granted_at > pg_catalog.now();
`);

  psql(asOwner(OWNER_A, insertConsent({ granted: true, grantedAt: '2099-01-01T00:00:00.000Z' })));
  assertSql(
    `select (max(granted_at) < '2099-01-01'::timestamptz)::text
       from public.consents where user_id = '${OWNER_A}';`,
    'true',
    'authenticated granted_at must be server-controlled',
  );

  psql(`delete from public.consents where user_id = '${OWNER_A}';`);
  const sameTime = '2026-07-25T15:00:00.000Z';
  psql(String.raw`
set role service_role;
${insertConsent({ granted: true, grantedAt: sameTime })}
${insertConsent({ granted: false, grantedAt: sameTime })}
reset role;`);
  psqlFailure(asOwner(OWNER_A, insertProfile(OWNER_A, 'equal-time-revocation')));

  psql(asOwner(OWNER_A, insertConsent({ granted: true })));
  const revocation = runConcurrent(String.raw`
begin;
${asOwner(OWNER_A, insertConsent({ granted: false }))}
select 'health-lock-held';
select pg_catalog.pg_sleep(1);
commit;`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  const raceFailure = psqlFailure(asOwner(OWNER_A, insertProfile(OWNER_A, 'revoke-race')));
  const revocationResult = await revocation.completion;
  if (revocationResult.code !== 0 || !revocationResult.stdout.includes('health-lock-held')) {
    throw new Error(`Concurrent revocation failed: ${revocationResult.stderr}`);
  }
  if (!/row-level security|policy/i.test(raceFailure)) {
    throw new Error(`Profile race did not fail at RLS: ${raceFailure}`);
  }

  assertSql(
    String.raw`
select concat_ws(
  ',',
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename = 'skin_profiles'
      and policyname = 'skin_profiles_insert_current_health_consent'),
  (select count(*) from pg_trigger
    where tgrelid = 'public.consents'::regclass
      and tgname = 'trg_consents_health_consent_ordering'
      and not tgisinternal),
  (select has_table_privilege('authenticated', 'public.skin_profiles', 'UPDATE')::int)
);`,
    '1,1,0',
    'double-apply policy/trigger/update contract',
  );

  process.stdout.write(
    `${JSON.stringify({
      checkpoint: 'skin_profile_consent_postgres_replay',
      postgres: docker(['exec', CONTAINER, 'psql', '--version']),
      double_apply: true,
      exact_grant: 'allowed',
      missing_false_stale_hash_future_equal_time: 'denied',
      cross_owner: 'denied',
      authenticated_update: 'revoked',
      authenticated_timestamp: 'server_controlled',
      revoke_profile_race: 'serialized_revoke_wins',
    })}\n`,
  );
} finally {
  if (started) {
    try {
      docker(['rm', '--force', CONTAINER]);
    } catch {
      // Best-effort disposable harness cleanup.
    }
  }
}
