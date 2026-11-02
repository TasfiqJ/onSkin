import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const path = 'supabase/tests/rehearsal/catalog_operator_revocation_race.test.sql';
const base = 'd5f3b4b46bb12a666fa793b5eaa641442db94c8e';
const prefixBytes = 17689;
const prefixSha = '04dafe0d1769ec2ebf42cbe532d5f423c3c58b6c4d6697e078ad1bc10060663a';
const originalSha = '93c9d03488f945e36887cb0f6a40cd2b254119ea593b00a07b02a6cdfd55314f';
const login = 'cat08_rehearsal_connection';
const tailStart = "select pg_catalog.set_config('test.cat08_dblink_password', '', false);";
const sha = raw => createHash('sha256').update(raw).digest('hex');
const original = execFileSync('git', ['--no-replace-objects', 'show', `${base}:${path}`], { cwd: root });
assert.equal(sha(original), originalSha, 'CAT08_ORIGINAL_SOURCE_IDENTITY');
const originalTail = original.subarray(original.indexOf(tailStart));
const candidate = readFileSync(resolve(root, path));
const normalized = value => value.replace(/--[^\n]*/gu, '').replace(/\s+/gu, ' ').trim();
const count = (value, expression) => [...value.matchAll(expression)].length;
function ordered(value, needles) {
  let previous = -1;
  for (const needle of needles) {
    const next = value.indexOf(needle);
    assert.ok(next > previous, `CAT08_CLEANUP_ORDER: ${needle}`);
    assert.equal(value.lastIndexOf(needle), next, `CAT08_CLEANUP_DUPLICATE: ${needle}`);
    previous = next;
  }
}

export function validateCat08Cleanup40(raw) {
  assert.ok(Buffer.isBuffer(raw), 'CAT08_SOURCE_BYTES_REQUIRED');
  assert.equal(sha(raw.subarray(0, prefixBytes)), prefixSha, 'CAT08_PROTECTED_PREFIX');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  const tail = raw.indexOf(tailStart);
  assert.ok(tail > prefixBytes, 'CAT08_ORIGINAL_TAIL_REQUIRED');
  assert.deepEqual(raw.subarray(tail), originalTail, 'CAT08_ORIGINAL_FREEZE_AND_FINISH');
  const prefix = text.slice(0, prefixBytes);
  assert.equal(count(prefix, /select is\(/gu), 6, 'CAT08_SIX_IS_ASSERTIONS');
  assert.equal(count(prefix, /select ok\(/gu), 4, 'CAT08_FOUR_OK_ASSERTIONS');
  assert.equal(count(prefix, /extensions\.dblink_get_result\(/gu), 8, 'CAT08_ALL_RESULTS_DRAINED');
  assert.equal(count(prefix, /as drained\(result text\)/gu), 4, 'CAT08_EMPTY_RESULT_DRAINS');
  const cleanup = text.slice(prefixBytes, tail);
  const code = normalized(cleanup);
  assert.doesNotMatch(code, /\b(?:drop owned|reassign owned|pg_terminate_backend|pg_sleep|cascade|exception when|on_error_stop off)\b/iu,
    'CAT08_NO_BROAD_OR_SUPPRESSED_CLEANUP');
  assert.doesNotMatch(code, /\bdrop\s+(?:function|role)\s+if\s+exists\b/iu, 'CAT08_NO_MASKED_DROP');
  assert.doesNotMatch(code, /\b(?:select plan|select is|select ok|dblink_send_query|dblink_get_result)\s*\(/iu,
    'CAT08_NO_NEW_ASSERTIONS_OR_ASYNC_COMMANDS');
  const remotes = [...cleanup.matchAll(/select extensions\.dblink_exec\(\n  '(cat08_race_[ab])',\n  \$(cleanup_[ab])\$([\s\S]*?)\n  \$\2\$\n\);/gu)];
  assert.equal(remotes.length, 2, 'CAT08_TWO_FAILING_REMOTE_COMMANDS');
  assert.equal(count(cleanup, /extensions\.dblink_exec\(/gu), 2, 'CAT08_NO_EXTRA_OR_SUPPRESSED_REMOTE_COMMAND');
  assert.deepEqual(remotes.map(row => row[1]), ['cat08_race_a', 'cat08_race_b'], 'CAT08_EXACT_SESSIONS');
  for (const [index, remote] of remotes.entries()) {
    const body = normalized(remote[3]);
    assert.ok(body.startsWith(index === 0 ? 'reset role; do $owner$' : 'do $owner$'), 'CAT08_A_RESET_ROLE');
    assert.equal(count(body, /\breset role;/gu), index === 0 ? 1 : 0, 'CAT08_EXACT_ROLE_RESET');
    assert.match(body, /if session_user <> 'cat08_rehearsal_connection' or current_user <> 'cat08_rehearsal_connection' or \(/u,
      'CAT08_SESSION_AND_EXECUTION_OWNER');
    assert.match(body, /select count\(\*\) from pg_catalog\.pg_proc as helper where helper\.oid/u,
      'CAT08_REAL_FUNCTION_CATALOG');
    assert.match(body, /and helper\.pronamespace = pg_catalog\.pg_my_temp_schema\(\) and helper\.proowner = current_user::pg_catalog\.regrole/u,
      'CAT08_EXACT_TEMP_SCHEMA_AND_FUNCTION_OWNER');
    assert.ok(body.includes(`) <> ${index === 0 ? 2 : 1} then raise exception 'CAT08_CLEANUP40_${index === 0 ? 'A' : 'B'}_OWNER_INVALID'; end if;`),
      'CAT08_OWNER_COUNT_FAILS_CLOSED');
    const signatures = index === 0 ? ['queue', 'session'] : ['revoke'];
    for (const name of signatures) {
      assert.ok(body.includes(`'pg_temp.cat08_${name}_then_latch(uuid,bigint)'::pg_catalog.regprocedure`),
        'CAT08_EXACT_OWNER_SIGNATURE');
    }
    const drop = index === 0
      ? 'drop function pg_temp.cat08_queue_then_latch(uuid, bigint), pg_temp.cat08_session_then_latch(uuid, bigint);'
      : 'drop function pg_temp.cat08_revoke_then_latch(uuid, bigint);';
    assert.ok(body.endsWith(drop), 'CAT08_EXACT_HELPER_DROP');
    assert.equal(count(body, /\bdrop function\b/gu), 1, 'CAT08_ONE_EXACT_REMOTE_DROP');
    assert.doesNotMatch(body, /\b(?:set role|create|grant|alter|execute|return)\b/iu, 'CAT08_NO_NEW_REMOTE_AUTHORITY');
  }
  ordered(cleanup, [
    '$cleanup_a$', '$cleanup_b$',
    'revoke execute on function',
    'drop function\n  catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(uuid, bigint);',
    'revoke usage on schema catalog_operator_gateway',
    'revoke catalog_operator_edge from cat08_rehearsal_connection;',
    'do $cleanup_dependencies$',
    "select extensions.dblink_disconnect('cat08_race_a');",
    "select extensions.dblink_disconnect('cat08_race_b');",
    'drop role cat08_rehearsal_connection;', 'do $cleanup_absence$',
  ].filter(value => !value.startsWith('$cleanup_')));
  assert.ok(remotes[1].index > remotes[0].index &&
    cleanup.indexOf('revoke execute on function') > remotes[1].index, 'CAT08_DROP_BEFORE_REVOKE');
  const dependencies = cleanup.match(/do \$cleanup_dependencies\$([\s\S]*?)\$cleanup_dependencies\$;/u)?.[1];
  assert.ok(dependencies, 'CAT08_DEPENDENCY_READBACK_REQUIRED');
  const dependencyCode = normalized(dependencies);
  assert.match(dependencyCode, /v_connections text\[\] := extensions\.dblink_get_connections\(\);/u);
  assert.match(dependencyCode, /if not coalesce\( 'cat08_race_a' = any\(v_connections\) and 'cat08_race_b' = any\(v_connections\), false \) then raise exception 'CAT08_CLEANUP40_CONNECTIONS_MISSING';/u,
    'CAT08_DEPENDENCIES_CHECKED_WHILE_CONNECTED');
  assert.match(dependencyCode, /select count\(\*\) into v_dependencies from pg_catalog\.pg_shdepend where refclassid = 'pg_catalog\.pg_authid'::pg_catalog\.regclass and refobjid = 'cat08_rehearsal_connection'::pg_catalog\.regrole;/u,
    'CAT08_ALL_ROLE_DEPENDENCIES');
  assert.match(dependencyCode, /if v_dependencies <> 0 then raise exception 'CAT08_CLEANUP40_DEPENDENCIES_REMAIN'; end if;/u,
    'CAT08_DEPENDENCIES_CANNOT_BE_IGNORED');
  assert.ok(cleanup.indexOf('$cleanup_dependencies$;') < cleanup.indexOf('select extensions.dblink_disconnect('),
    'CAT08_READBACK_BEFORE_DISCONNECT');
  assert.equal(count(cleanup, /extensions\.dblink_disconnect\(/gu), 2, 'CAT08_BOTH_HANDLES_CLOSED');
  const absence = normalized(cleanup.match(/do \$cleanup_absence\$([\s\S]*?)\$cleanup_absence\$;/u)?.[1] ?? '');
  assert.match(absence, /if exists \( select 1 from pg_catalog\.pg_roles where rolname = 'cat08_rehearsal_connection' \) or coalesce\( extensions\.dblink_get_connections\(\) && array\['cat08_race_a', 'cat08_race_b'\], false \) then raise exception 'CAT08_CLEANUP40_ROLE_OR_CONNECTION_REMAINS'; end if;/u,
    'CAT08_POST_DROP_ROLE_AND_HANDLE_READBACK');
  return { valid: true, qualification: 'SOURCE_CONTROL_ONLY', assertionsPreserved: 10,
    prefixSha256: prefixSha, sqlSha256: sha(raw), acceptanceGranted: false, release: 'NO_GO' };
}

const sourceMutations = [
  ['skipped A helper drop', value => value.replace('drop function pg_temp.cat08_queue_then_latch(uuid, bigint),\n      pg_temp.cat08_session_then_latch(uuid, bigint);', 'drop function pg_temp.cat08_session_then_latch(uuid, bigint);')],
  ['skipped B helper drop', value => value.replace('    drop function pg_temp.cat08_revoke_then_latch(uuid, bigint);\n', '')],
  ['stale DROP FUNCTION signature', value => value.replace('drop function pg_temp.cat08_revoke_then_latch(uuid, bigint);', 'drop function pg_temp.cat08_revoke_then_latch(text, bigint);')],
  ['incorrect execution role on A', value => value.replace('    reset role;\n', '')],
  ['undrained remote command', value => value.replace('-- The final empty-result drains', "select extensions.dblink_send_query('cat08_race_a', 'select 1');\n-- The final empty-result drains")],
  ['wrong session owner', value => value.replace("session_user <> 'cat08_rehearsal_connection'\n         or", "session_user <> 'postgres'\n         or")],
  ['wrong function owner', value => value.replace('helper.proowner = current_user::pg_catalog.regrole', "helper.proowner = 'catalog_operator_edge'::pg_catalog.regrole")],
  ['temp dependency left alive', value => value.replace('if v_dependencies <> 0 then', 'if v_dependencies <> 1 then')],
  ['dependency check after disconnect', value => value.replace('do $cleanup_dependencies$', "select extensions.dblink_disconnect('cat08_race_a');\ndo $cleanup_dependencies$")],
  ['masked remote error', value => value.replace('  $cleanup_b$\n);', '  $cleanup_b$, false\n);')],
  ['masked stale drop', value => value.replace('drop function pg_temp.cat08_revoke_then_latch', 'drop function if exists pg_temp.cat08_revoke_then_latch')],
  ['broad drop', value => value.replace('    drop function pg_temp.cat08_revoke_then_latch(uuid, bigint);', '    drop owned by cat08_rehearsal_connection cascade;')],
  ['post-drop role absence not checked', value => value.replace("where rolname = 'cat08_rehearsal_connection'\n  ) or", "where rolname = 'different_role'\n  ) or")],
];

export function cleanup40PsqlEnvironment(inherited) {
  const allowed = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'HOME', 'USERPROFILE', 'TEMP', 'TMP', 'LANG']);
  return { ...Object.fromEntries(Object.entries(inherited).filter(([name]) => allowed.has(name.toUpperCase()))),
    PGPASSWORD: 'layerwell_rehearsal', PGCONNECT_TIMEOUT: '5' };
}

export function cleanup40BehaviorVerdict(fixture, result, remaining) {
  assert.match(result.output, /^CAT08_CLEANUP40_SETUP_COMPLETE$/mu, 'CAT08_BEHAVIOR_SETUP_NOT_COMPLETED');
  assert.equal(result.exit, fixture.expected, `CAT08_BEHAVIOR_EXIT: ${fixture.name}`);
  if (fixture.expected === 0) {
    assert.match(result.output, /CAT08_CLEANUP40_DEPENDENCIES_BEFORE_DISCONNECT=0/u);
    assert.match(result.output, /CAT08_CLEANUP40_ROLE_ABSENT_AND_HANDLES_CLOSED/u);
    assert.equal(remaining, '0', 'CAT08_POSITIVE_ROLE_ABSENT');
  } else {
    assert.match(result.output, /ERROR:/u, 'CAT08_NEGATIVE_ERROR_VISIBLE');
    assert.match(result.output, fixture.expectedError, 'CAT08_EXPECTED_CLEANUP_ERROR_REQUIRED');
    assert.equal(remaining, '1', 'CAT08_NEGATIVE_ROLE_NOT_FALSELY_REMOVED');
  }
  return { case: fixture.name, actualPsqlExit: result.exit, expectedPsqlExit: fixture.expected,
    setupCompleted: true, expectedCleanupStageMatched: true };
}

function behavioral() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'CAT08_BEHAVIOR_REQUIRES_HOSTED_JOB');
  assert.equal(process.env.GITHUB_REPOSITORY, 'TasfiqJ/onSkin', 'CAT08_BEHAVIOR_REPOSITORY');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request', 'CAT08_BEHAVIOR_EVENT');
  assert.equal(process.env.GITHUB_JOB, 'checks', 'CAT08_BEHAVIOR_SERVICE_CUSTODY');
  validateCat08Cleanup40(candidate);
  const env = cleanup40PsqlEnvironment(process.env);
  const scrub = value => value.replaceAll('layerwell_rehearsal', '[public-fixture-password]')
    .replaceAll('cat08_cleanup40_fixture_only', '[public-fixture-password]')
    .replace(/dbname=[^\r\n]*/gu, '[redacted-connection-string]');
  const psql = (database, sql) => {
    const result = spawnSync('psql', ['-X', '--no-password', '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres',
      '-d', database, '--set=ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--quiet'],
    { input: sql, env, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true });
    assert.equal(result.error, undefined, 'CAT08_PSQL_EXECUTION');
    assert.equal(result.signal, null, 'CAT08_PSQL_TERMINAL');
    return { exit: result.status, output: scrub(result.stdout + result.stderr) };
  };
  const requirePass = (database, sql) => {
    const result = psql(database, sql);
    assert.equal(result.exit, 0, `CAT08_FIXTURE_COMMAND_FAILED: ${result.output}`);
    return result.output.trim();
  };
  const serverVersion = Number(requirePass('postgres', "select pg_catalog.current_setting('server_version_num');"));
  assert.ok(serverVersion >= 150000 && serverVersion < 160000, 'CAT08_BEHAVIOR_EXISTING_PG15_SERVICE');
  assert.equal(requirePass('postgres', "select count(*) from pg_catalog.pg_roles where rolname in ('cat08_rehearsal_connection', 'catalog_operator_edge');"), '0', 'CAT08_BEHAVIOR_ROLES_MUST_BE_ABSENT');
  requirePass('postgres', 'create role catalog_operator_edge noinherit;');
  const cleanup = candidate.toString('utf8').slice(prefixBytes, candidate.indexOf(tailStart));
  const negativeErrors = [
    /CAT08_CLEANUP40_DEPENDENCIES_REMAIN/u,
    /CAT08_CLEANUP40_DEPENDENCIES_REMAIN/u,
    /function pg_temp\.cat08_revoke_then_latch\(text, bigint\) does not exist/u,
    /CAT08_CLEANUP40_A_OWNER_INVALID/u,
    /another command is (?:already )?in progress/u,
  ];
  const cases = [
    { name: 'positive-fresh-1', expected: 0 },
    { name: 'positive-fresh-2', expected: 0 },
    ...sourceMutations.slice(0, 5).map(([name, mutate], index) => ({ name, expected: 3, mutate, expectedError: negativeErrors[index] })),
    { name: 'wrong session owner', expected: 3, wrongSession: true, expectedError: /CAT08_CLEANUP40_A_OWNER_INVALID/u },
    { name: 'wrong function owner', expected: 3, wrongFunction: true, expectedError: /CAT08_CLEANUP40_B_OWNER_INVALID/u },
    { name: 'temp dependency left alive', expected: 3, extra: true, expectedError: /CAT08_CLEANUP40_DEPENDENCIES_REMAIN/u },
  ];
  const receipts = [];
  for (const [index, fixture] of cases.entries()) {
    const database = `cat08_cleanup40_${process.pid}_${randomBytes(6).toString('hex')}_${index}`;
    requirePass('postgres', `create database ${database};`);
    const connection = user => `dbname=${database} host=127.0.0.1 port=5432 user=${user} password=${user === 'postgres' ? 'layerwell_rehearsal' : 'cat08_cleanup40_fixture_only'}`;
    const helper = name => `create function pg_temp.cat08_${name}_then_latch(uuid,bigint) returns text language sql as 'select ''synthetic''::text';`;
    const setup = `\\set ON_ERROR_STOP on
create schema extensions;
create extension dblink with schema extensions;
create schema catalog_operator_gateway;
create role ${login} login nosuperuser noinherit nocreatedb nocreaterole noreplication nobypassrls connection limit 2 password 'cat08_cleanup40_fixture_only';
grant catalog_operator_edge to ${login};
grant usage on schema catalog_operator_gateway to ${login};
create function catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(uuid,bigint) returns text language sql as 'select ''synthetic''::text';
revoke all on function catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(uuid,bigint) from public;
grant execute on function catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(uuid,bigint) to ${login};
select extensions.dblink_connect('cat08_race_a', '${connection(fixture.wrongSession ? 'postgres' : login)}');
select extensions.dblink_connect('cat08_race_b', '${connection(login)}');
select extensions.dblink_exec('cat08_race_a', $setup_a$${helper('queue')}${helper('session')}$setup_a$);
select extensions.dblink_exec('cat08_race_a', 'set role catalog_operator_edge');
select extensions.dblink_exec('cat08_race_b', $setup_b$${fixture.wrongFunction ? 'set role catalog_operator_edge;' : ''}${helper('revoke')}${fixture.wrongFunction ? 'reset role;' : ''}${fixture.extra ? "create function pg_temp.cat08_leftover() returns integer language sql as 'select 1';" : ''}$setup_b$);
select * from extensions.dblink('cat08_race_a', $read_a$select session_user::text, current_user::text, pg_catalog.pg_get_userbyid(proowner)::text, count(*) from pg_catalog.pg_proc where pronamespace=pg_catalog.pg_my_temp_schema() and proname in ('cat08_queue_then_latch','cat08_session_then_latch') group by session_user,current_user,proowner$read_a$) as owner_a(session_owner text,execution_role text,function_owner text,helper_count bigint);
select * from extensions.dblink('cat08_race_b', $read_b$select session_user::text, current_user::text, pg_catalog.pg_get_userbyid(proowner)::text, count(*) from pg_catalog.pg_proc where pronamespace=pg_catalog.pg_my_temp_schema() and proname='cat08_revoke_then_latch' group by session_user,current_user,proowner$read_b$) as owner_b(session_owner text,execution_role text,function_owner text,helper_count bigint);
select 'CAT08_CLEANUP40_SETUP_COMPLETE';
`;
    // Only disposable fixture bytes are fault-injected; the tracked SQL stays intact.
    const sql = fixture.mutate ? fixture.mutate(cleanup) : cleanup;
    const result = psql(database, setup + sql);
    console.log(JSON.stringify({ case: fixture.name, database, actualPsqlExit: result.exit,
      expectedPsqlExit: fixture.expected, qualification: 'REAL_POSTGRESQL_CLEANUP_ONLY', output: result.output }));
    const deadline = Date.now() + 15000;
    while (requirePass('postgres', `select count(*) from pg_catalog.pg_stat_activity where datname='${database}';`) !== '0') {
      assert.ok(Date.now() < deadline, 'CAT08_OWNED_DATABASE_CONNECTIONS_DID_NOT_CLOSE');
    }
    requirePass('postgres', `drop database ${database};`);
    const remaining = requirePass('postgres', `select count(*) from pg_catalog.pg_roles where rolname='${login}';`);
    assert.ok(remaining === '0' || remaining === '1', 'CAT08_ROLE_READBACK');
    if (remaining === '1') requirePass('postgres', `drop role ${login};`);
    receipts.push(cleanup40BehaviorVerdict(fixture, result, remaining));
  }
  requirePass('postgres', 'drop role catalog_operator_edge;');
  console.log(JSON.stringify({ valid: true, qualification: 'REAL_POSTGRESQL_CLEANUP_ONLY', fullRaceFixtureExecuted: false,
    serverVersion, receipts, acceptanceGranted: false, release: 'NO_GO' }));
}

if (process.argv[2] === '--check-source') {
  try {
    assert.equal(process.argv.length, 4, 'CAT08_SOURCE_CLI_ARGUMENTS');
    console.log(JSON.stringify(validateCat08Cleanup40(readFileSync(process.argv[3]))));
  } catch {
    console.error('CAT08_CLEANUP40_SOURCE_REFUSED');
    process.exitCode = 1;
  }
} else if (process.argv[2] === '--behavioral') {
  try {
    assert.equal(process.argv.length, 3, 'CAT08_BEHAVIOR_CLI_ARGUMENTS');
    behavioral();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  assert.equal(process.argv.length, 2, 'CAT08_TEST_CLI_ARGUMENTS');
  test('source-only: authentic prefix retains all ten race assertions and all result drains', () => {
    assert.equal(sha(original.subarray(0, prefixBytes)), prefixSha);
    assert.deepEqual(candidate.subarray(0, prefixBytes), original.subarray(0, prefixBytes));
    assert.equal(validateCat08Cleanup40(candidate).assertionsPreserved, 10);
  });
  test('source-only: original disconnect-dependent cleanup is refused', () => {
    assert.throws(() => validateCat08Cleanup40(original));
  });
  test('psql child receives only execution essentials and fixed isolated-service settings', () => {
    const inherited = { Path: 'synthetic-bin', HOME: 'synthetic-home', LANG: 'C', GH_TOKEN: 'synthetic-token',
      ANOTHER_SECRET: 'synthetic-secret', PGPASSWORD: 'inherited-password', PGHOST: 'remote.invalid',
      NODE_OPTIONS: '--require=untrusted', LD_PRELOAD: 'untrusted-library', GITHUB_ACTIONS: 'true' };
    const before = { ...inherited };
    assert.deepEqual(cleanup40PsqlEnvironment(inherited), { Path: 'synthetic-bin', HOME: 'synthetic-home', LANG: 'C',
      PGPASSWORD: 'layerwell_rehearsal', PGCONNECT_TIMEOUT: '5' });
    assert.deepEqual(inherited, before);
  });
  test('behavior verdict refuses setup failure and the wrong cleanup failure despite exit 3', () => {
    const fixture = { name: 'synthetic-verdict-only', expected: 3, expectedError: /CAT08_CLEANUP40_DEPENDENCIES_REMAIN/u };
    const completed = 'CAT08_CLEANUP40_SETUP_COMPLETE\n';
    assert.throws(() => cleanup40BehaviorVerdict(fixture,
      { exit: 3, output: 'ERROR: synthetic setup failure' }, '1'), /CAT08_BEHAVIOR_SETUP_NOT_COMPLETED/u);
    assert.throws(() => cleanup40BehaviorVerdict(fixture,
      { exit: 3, output: completed + 'ERROR: CAT08_CLEANUP40_B_OWNER_INVALID' }, '1'), /CAT08_EXPECTED_CLEANUP_ERROR_REQUIRED/u);
    assert.throws(() => cleanup40BehaviorVerdict(fixture,
      { exit: 0, output: completed + 'ERROR: CAT08_CLEANUP40_DEPENDENCIES_REMAIN' }, '1'), /CAT08_BEHAVIOR_EXIT/u);
    assert.equal(cleanup40BehaviorVerdict(fixture,
      { exit: 3, output: completed + 'ERROR: CAT08_CLEANUP40_DEPENDENCIES_REMAIN' }, '1').expectedCleanupStageMatched, true);
  });
  for (const [name, mutate] of sourceMutations) {
    test(`source-only refusal: ${name}`, () => {
      const changed = Buffer.from(mutate(candidate.toString('utf8')));
      assert.notDeepEqual(changed, candidate, 'MUTATION_MUST_CHANGE_BYTES');
      assert.throws(() => validateCat08Cleanup40(changed));
    });
  }
  for (const [before, after] of [
    ['select plan(10)', 'select plan(9)'],
    ["'42501:CATALOG_OPERATOR_GRANT_REQUIRED'", "'ok'"],
    ['pg_catalog.pg_advisory_lock(820801)', 'pg_catalog.pg_advisory_lock(820802)'],
    ["\\set ON_ERROR_STOP on", "\\set ON_ERROR_STOP off"],
    ["from extensions.dblink_get_result(\n  'cat08_race_a'\n) as drained(result text);", ''],
  ]) {
    test(`protected prefix refusal: ${before}`, () => {
      const changed = Buffer.from(candidate.toString('utf8').replace(before, after));
      assert.notDeepEqual(changed, candidate);
      assert.throws(() => validateCat08Cleanup40(changed), /CAT08_PROTECTED_PREFIX/u);
    });
  }
  test('source refusal remains a nonzero process exit with all ten assertion bytes intact', () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'cat08-cleanup40-')));
    try {
      for (const [name, mutate] of sourceMutations) {
        const changed = Buffer.from(mutate(candidate.toString('utf8')));
        assert.deepEqual(changed.subarray(0, prefixBytes), original.subarray(0, prefixBytes), name);
        const fixture = join(directory, 'source.sql');
        writeFileSync(fixture, changed);
        const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--check-source', fixture],
          { encoding: 'utf8', timeout: 10000, windowsHide: true });
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        assert.equal(result.status, 1, name);
        assert.match(result.stderr, /CAT08_CLEANUP40_SOURCE_REFUSED/u);
      }
    } finally {
      assert.equal(dirname(directory), realpathSync(tmpdir()));
      assert.ok(basename(directory).startsWith('cat08-cleanup40-'));
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
