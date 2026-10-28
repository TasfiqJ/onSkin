import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  CANONICAL_POSTGRES24 as PIN,
  assertCanonicalPostgres24,
  isCanonicalPostgresMirrorQuota24,
  isCanonicalPostgresQuota24,
  prepareCanonicalPostgresMirror24,
} from './canonical-postgres-mirror24.mjs';

const source = await readFile(new URL('./local-supabase-reset.mjs', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../../.github/workflows/quality.yml', import.meta.url), 'utf8');
const refusal = error => /^H01_CANONICAL_POSTGRES24: exact pinned image proof required\.$/u.test(error.message);

function quota(overrides = {}, diagnostic = 'Error response from daemon: error from registry: Data limit exceeded') {
  return new Error('H01_SQL_PROBE_FAILED: exit-nonzero. public registry quota', { cause: {
    reason: 'exit-nonzero', originReason: 'exit-nonzero',
    containment: 'posix-process-group-empty', diagnostic, ...overrides,
  } });
}

function mirrorQuota(overrides = {}, diagnostic = '0123456789ab: Download complete\nerror from registry: retry-after: 1.042664ms, allowed: 44000/minute') {
  return quota(overrides, diagnostic);
}

function fixture(architecture = 'amd64') {
  const calls = [];
  const image = {
    Id: PIN.platforms[architecture].config, Os: 'linux', Architecture: architecture,
    RepoDigests: [PIN.mirror], RepoTags: [PIN.canonical],
  };
  const state = { pull: { stdout: `Digest: ${PIN.index}\n`, stderr: '' },
    first: JSON.stringify([image]), final: JSON.stringify([image]) };
  const runDocker = async args => {
    calls.push(args);
    if (args[0] === 'pull') return state.pull;
    if (args[1] === 'tag') return { stdout: '', stderr: '' };
    return { stdout: args[2] === PIN.mirror ? state.first : state.final, stderr: '' };
  };
  return { calls, image, state, runDocker, architecture };
}

test('quota classification is exact and cannot broaden cancellation, timeout or disclosure failures', () => {
  for (const diagnostic of [
    'Error response from daemon: error from registry: Data limit exceeded',
    'Error response from daemon: error from registry: toomanyrequests: Rate exceeded',
    'Error response from daemon: error from registry: 429 Too Many Requests\n',
  ]) assert.equal(isCanonicalPostgresQuota24(quota({}, diagnostic)), true);
  for (const error of [
    new Error('Data limit exceeded'), {}, null,
    quota({ reason: 'timeout' }), quota({ originReason: 'cancelled' }),
    quota({ containment: 'unconfirmed' }), quota({ diagnostic: null }),
    quota({}, 'unauthorized: access denied'), quota({}, 'network unavailable'),
    quota({}, 'Error response from daemon: error from registry: Data limit exceeded\nSENSITIVE_SENTINEL'),
    quota({}, 'SENSITIVE_SENTINEL Data limit exceeded'),
    { message: 'different operation', cause: quota().cause },
  ]) assert.equal(isCanonicalPostgresQuota24(error), false);
});

test('immutable official image proof supports both exact native platforms without a tag-based pull', async t => {
  for (const architecture of ['amd64', 'arm64']) await t.test(architecture, async () => {
    const f = fixture(architecture);
    const identity = await prepareCanonicalPostgresMirror24(f);
    assert.deepEqual(identity, { id: f.image.Id, digest: PIN.index, architecture });
    assert.ok(Object.isFrozen(identity));
    assert.deepEqual(f.calls, [
      ['pull', '--platform', `linux/${architecture}`, PIN.mirror],
      ['image', 'inspect', PIN.mirror],
      ['image', 'tag', f.image.Id, PIN.canonical],
      ['image', 'inspect', PIN.canonical],
    ]);
    assert.doesNotThrow(() => assertCanonicalPostgres24(identity));
  });
});

test('frozen pins have no caller-controlled architecture, registry, digest or mutable witness', async () => {
  assert.ok(Object.isFrozen(PIN) && Object.isFrozen(PIN.platforms));
  for (const key of ['amd64', 'arm64']) assert.ok(Object.isFrozen(PIN.platforms[key]));
  assert.throws(() => { PIN.platforms.amd64.config = 'changed'; }, TypeError);
  for (const architecture of ['__proto__', 'constructor', 'toString', 'x64', 'unknown', undefined]) {
    let calls = 0;
    await assert.rejects(prepareCanonicalPostgresMirror24({ architecture, runDocker: async () => { calls++; } }), refusal);
    assert.equal(calls, 0);
    assert.throws(() => assertCanonicalPostgres24({ architecture, digest: PIN.index }), refusal);
  }
  for (const identity of [null, {}, { architecture: 'amd64', id: PIN.platforms.arm64.config, digest: PIN.index },
    { architecture: 'amd64', id: PIN.platforms.amd64.config, digest: `sha256:${'a'.repeat(64)}` }]) {
    assert.throws(() => assertCanonicalPostgres24(identity), refusal);
  }
});

test('missing, duplicate, stale and foreign pull digests fail before inspect or retag', async t => {
  for (const stdout of ['', 'Digest: SENSITIVE_SENTINEL\n', `Digest: sha256:${'a'.repeat(64)}\n`,
    `Digest: ${PIN.index}\nDigest: ${PIN.index}\n`]) await t.test(JSON.stringify(stdout).slice(0, 35), async () => {
    const f = fixture(); f.state.pull = { stdout, stderr: '' };
    await assert.rejects(prepareCanonicalPostgresMirror24(f), refusal);
    assert.equal(f.calls.length, 1);
  });
});

test('malformed, foreign, wrong-platform and changed mirror sources cannot acquire the canonical name', async t => {
  const controls = [
    ['malformed', () => 'SENSITIVE_SENTINEL'], ['object', () => '{}'], ['missing', () => '[]'],
    ['duplicate', row => JSON.stringify([row, row])],
    ['wrong config', row => JSON.stringify([{ ...row, Id: `sha256:${'b'.repeat(64)}` }])],
    ['wrong OS', row => JSON.stringify([{ ...row, Os: 'windows' }])],
    ['wrong platform', row => JSON.stringify([{ ...row, Architecture: 'arm64' }])],
    ['foreign registry', row => JSON.stringify([{ ...row, RepoDigests: [`foreign.invalid/postgres@${PIN.index}`] }])],
    ['stale digest', row => JSON.stringify([{ ...row, RepoDigests: ['ghcr.io/supabase/postgres@sha256:' + 'b'.repeat(64)] }])],
    ['missing digest list', row => JSON.stringify([{ ...row, RepoDigests: null }])],
  ];
  for (const [name, mutate] of controls) await t.test(name, async () => {
    const f = fixture(); f.state.first = mutate(f.image);
    await assert.rejects(prepareCanonicalPostgresMirror24(f), refusal);
    assert.equal(f.calls.length, 2);
    assert.ok(!f.calls.some(args => args[1] === 'tag'));
  });
});

test('canonical cache retag must survive exact readback before any identity is returned', async t => {
  for (const [name, mutate] of [
    ['swapped id', row => ({ ...row, Id: PIN.platforms.arm64.config })],
    ['swapped name', row => ({ ...row, RepoTags: ['foreign.invalid/sensitive'] })],
    ['lost digest', row => ({ ...row, RepoDigests: [] })],
  ]) await t.test(name, async () => {
    const f = fixture(); f.state.final = JSON.stringify([mutate(f.image)]);
    await assert.rejects(prepareCanonicalPostgresMirror24(f), refusal);
    assert.equal(f.calls.length, 4);
  });
});

test('contained command failures are retained and never trigger an unpinned alternate pull', async () => {
  for (const operation of [1, 2, 3, 4]) {
    const f = fixture(); const original = f.runDocker;
    const error = new Error('test command failure');
    f.runDocker = async args => { if (f.calls.length + 1 === operation) throw error; return await original(args); };
    await assert.rejects(prepareCanonicalPostgresMirror24(f), value => value === error);
    assert.equal(f.calls.length, operation - 1);
  }
});

test('cancellation before or between every Docker command prevents further acquisition', async () => {
  for (const abortAfter of [0, 1, 2, 3, 4]) {
    const f = fixture(); const original = f.runDocker; const controller = new AbortController();
    if (abortAfter === 0) controller.abort();
    f.runDocker = async args => { const value = await original(args); if (f.calls.length === abortAfter) controller.abort(); return value; };
    await assert.rejects(prepareCanonicalPostgresMirror24({ ...f, signal: controller.signal }), { name: 'AbortError' });
    assert.equal(f.calls.length, abortAfter);
  }
});

test('only the observed structured contained mirror rate response allows bounded retries', () => {
  assert.equal(isCanonicalPostgresMirrorQuota24(mirrorQuota()), true);
  assert.equal(isCanonicalPostgresQuota24(mirrorQuota()), false);
  for (const error of [
    mirrorQuota({ containment: 'unconfirmed' }), mirrorQuota({ originReason: 'timeout' }),
    mirrorQuota({ reason: 'cancelled' }), new Error('retry-after: 1ms'),
    mirrorQuota({}, 'unauthorized: SENSITIVE_SENTINEL'),
    mirrorQuota({}, 'error from registry: retry-after: Infinitys, allowed: 44000/minute'),
    mirrorQuota({}, 'error from registry: retry-after: 1ms, allowed: 44000/minute\nSENSITIVE_SENTINEL'),
    mirrorQuota({}, 'error from registry: retry-after: 1ms, allowed: 0/minute'),
    mirrorQuota({}, 'SENSITIVE_SENTINEL'.repeat(5000)),
    mirrorQuota({}, 'SENSITIVE_SENTINEL\nerror from registry: retry-after: 1ms, allowed: 44000/minute'),
    mirrorQuota({}, 'unauthorized: access denied\nerror from registry: retry-after: 1ms, allowed: 44000/minute'),
    mirrorQuota({}, 'network unavailable\nerror from registry: retry-after: 1ms, allowed: 44000/minute'),
    mirrorQuota({}, 'foreign.invalid/postgres:latest: Pulling from supabase/postgres\nerror from registry: retry-after: 1ms, allowed: 44000/minute'),
    mirrorQuota({}, '0123456789ab: Download complete\n'.repeat(301) + 'error from registry: retry-after: 1ms, allowed: 44000/minute'),
  ]) assert.equal(isCanonicalPostgresMirrorQuota24(error), false);
  assert.equal(isCanonicalPostgresMirrorQuota24(mirrorQuota({},
    `${PIN.mirror}: Pulling from supabase/postgres\n0123456789ab: Pulling fs layer\n0123456789ab: Download complete\nerror from registry: retry-after: 1.042664ms, allowed: 44000/minute`)), true);
});

test('transient GHCR throttling retries exactly the same immutable source with fixed delays', async () => {
  const f = fixture(); const original = f.runDocker; const waits = []; let attempts = 0;
  f.runDocker = async args => {
    if (args[0] === 'pull' && ++attempts < 3) { f.calls.push(args); throw mirrorQuota(); }
    return await original(args);
  };
  const result = await prepareCanonicalPostgresMirror24({ ...f, wait: async milliseconds => { waits.push(milliseconds); } });
  assert.equal(result.id, f.image.Id);
  assert.deepEqual(waits, [3000, 10000]);
  assert.equal(f.calls.filter(args => args[0] === 'pull').length, 3);
  assert.ok(f.calls.filter(args => args[0] === 'pull').every(args => args[3] === PIN.mirror));
});

test('persistent GHCR quota permits only the second official identical-index mirror after four attempts', async t => {
  for (const architecture of ['amd64', 'arm64']) {
  for (const repoDigest of [PIN.secondaryMirror, `supabase/postgres@${PIN.index}`]) await t.test(`${architecture}:${repoDigest}`, async () => {
    const f = fixture(architecture); const waits = []; const image = { ...f.image, RepoDigests: [repoDigest] };
    f.runDocker = async args => {
      f.calls.push(args);
      if (args[0] === 'pull' && args[3] === PIN.mirror) throw mirrorQuota();
      if (args[0] === 'pull') return f.state.pull;
      if (args[1] === 'tag') return { stdout: '', stderr: '' };
      return { stdout: JSON.stringify([image]), stderr: '' };
    };
    const result = await prepareCanonicalPostgresMirror24({ ...f, wait: async milliseconds => { waits.push(milliseconds); } });
    assert.deepEqual(result, { id: image.Id, digest: PIN.index, architecture });
    assert.deepEqual(waits, [3000, 10000, 30000]);
    assert.deepEqual(f.calls.slice(0, 4), Array.from({ length: 4 }, () => ['pull', '--platform', `linux/${architecture}`, PIN.mirror]));
    assert.deepEqual(f.calls[4], ['pull', '--platform', `linux/${architecture}`, PIN.secondaryMirror]);
    assert.deepEqual(f.calls[5], ['image', 'inspect', PIN.secondaryMirror]);
    assert.equal(f.calls.length, 8);
  });
  }
});

test('foreign, changed or malformed secondary image responses cannot use the canonical name', async () => {
  for (const change of [row => ({ ...row, Id: PIN.platforms.arm64.config }),
    row => ({ ...row, RepoDigests: [PIN.mirror] }), row => ({ ...row, Architecture: 'arm64' })]) {
    const f = fixture();
    f.runDocker = async args => {
      f.calls.push(args);
      if (args[0] === 'pull' && args[3] === PIN.mirror) throw mirrorQuota();
      if (args[0] === 'pull') return f.state.pull;
      return { stdout: JSON.stringify([change(f.image)]), stderr: '' };
    };
    await assert.rejects(prepareCanonicalPostgresMirror24({ ...f, wait: async () => {} }), refusal);
    assert.ok(!f.calls.some(args => args[1] === 'tag'));
  }
});

test('both quota-limited mirrors exhaust finite attempts and retain the actual last error', async () => {
  const f = fixture(); const waits = []; let last;
  f.runDocker = async args => { f.calls.push(args); last = mirrorQuota(); throw last; };
  await assert.rejects(prepareCanonicalPostgresMirror24({ ...f, wait: async milliseconds => { waits.push(milliseconds); } }), error => error === last);
  assert.equal(f.calls.length, 8);
  assert.deepEqual(waits, [3000, 10000, 30000, 3000, 10000, 30000]);
  assert.ok(f.calls.every(args => args[0] === 'pull'));
});

test('cancelling the real mirror backoff prevents another pull or registry transition', async () => {
  const f = fixture(); const controller = new AbortController();
  f.runDocker = async args => { f.calls.push(args); queueMicrotask(() => controller.abort()); throw mirrorQuota(); };
  await assert.rejects(prepareCanonicalPostgresMirror24({ ...f, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(f.calls.length, 1);
});

function dispatcher(context) {
  const start = source.indexOf('async function prepareCanonicalPostgresImage24(');
  const end = source.indexOf('\nfunction assertHistoryDatabaseTarget(', start);
  assert.ok(start > 0 && end > start);
  return runInNewContext(`${source.slice(start, end)}\nprepareCanonicalPostgresImage24;`, context);
}

test('current dispatch retains successful ECR acquisition, pins it, and does not invoke a mirror', async () => {
  let legacy = 0; let mirror = 0;
  const identity = { id: PIN.platforms.amd64.config, digest: PIN.index, architecture: 'amd64' };
  const context = { canonicalPostgresIdentity: identity, assertCanonicalPostgres24, isCanonicalPostgresQuota24,
    prepareCanonicalPostgresImage: async () => { legacy++; },
    prepareCanonicalPostgresMirror24: async () => { mirror++; } };
  await dispatcher(context)();
  assert.equal(legacy, 1); assert.equal(mirror, 0);
  context.canonicalPostgresIdentity = { ...identity, digest: `sha256:${'e'.repeat(64)}` };
  await assert.rejects(dispatcher(context)(), refusal);
  assert.equal(mirror, 0);
});

test('only a contained canonical ECR quota failure can dispatch to the verified native mirror', async () => {
  let mirrors = 0;
  const f = fixture();
  const context = { process: { arch: 'x64' }, signalCleanup: { signal: undefined },
    canonicalPostgresIdentity: undefined, assertCanonicalPostgres24, isCanonicalPostgresQuota24,
    prepareCanonicalPostgresImage: async () => { throw quota(); }, runHistoryDocker: f.runDocker,
    prepareCanonicalPostgresMirror24: async options => { mirrors++; return await prepareCanonicalPostgresMirror24(options); },
    console: { log: () => {} } };
  await dispatcher(context)();
  assert.equal(mirrors, 1);
  assert.deepEqual(context.canonicalPostgresIdentity, { id: f.image.Id, digest: PIN.index, architecture: 'amd64' });
  for (const error of [new Error('429'), quota({ containment: 'unconfirmed' }), quota({ originReason: 'timeout' })]) {
    context.prepareCanonicalPostgresImage = async () => { throw error; };
    await assert.rejects(dispatcher(context)(), value => value === error);
  }
  assert.equal(mirrors, 1);
});

test('real canonical path dispatches before startup and Quality executes the new bootstrap controls', () => {
  const body = source.slice(source.indexOf('let verificationFailure;'));
  assert.match(body, /await prepareCanonicalPostgresImage24\(\);\s*stackMayExist = true;\s*await runLocalCli\('start isolated credential-free stack'/u);
  assert.doesNotMatch(body, /await prepareCanonicalPostgresImage\(\)/u);
  assert.match(workflow, /run: node --test scripts\/phase2\/canonical-postgres-mirror24\.test\.mjs/u);
  assert.match(workflow, /run: npm run phase2:db-local-contract/u);
  assert.match(workflow, /run: npm run phase2:db-local-verify/u);
  assert.doesNotMatch(workflow, /continue-on-error/u);
  assert.match(source, /const publicDockerConfig = join\(sandboxRoot, '\.docker-public'\);\s*await mkdir\(publicDockerConfig\);\s*await writeFile\(join\(publicDockerConfig, 'config\.json'\), '\{"auths":\{\}\}\\n', \{ mode: 0o600 \}\);\s*childEnv\.DOCKER_CONFIG = publicDockerConfig;\s*delete childEnv\.DOCKER_AUTH_CONFIG;/u);
});
