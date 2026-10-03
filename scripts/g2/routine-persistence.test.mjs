/**
 * G2 isolated source regression checks. Runs the actual TypeScript order store
 * with deliberately mocked storage/admission boundaries; NOT a native-storage,
 * real React, full-app typecheck, or device-E2E substitute.
 * Run from repo root: node --test scripts/g2/routine-persistence.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = process.env.G2_SOURCE_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'apps/mobile/package.json'));
const ts = require('typescript');
const storePath = 'apps/mobile/src/features/routine/orderStore.ts';
const KEY = 'layerwell.routineOrder.v1';
const empty = () => ({ schemaVersion: 1, am: [], pm: [] });
const value = (am = [], pm = []) => ({ schemaVersion: 1, am, pm });

function deferred() {
  let resolvePromise;
  const promise = new Promise((resolve) => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

function fixture(initialRaw = null) {
  const state = {
    raw: initialRaw,
    reads: 0,
    writes: 0,
    attempts: 0,
    readError: false,
    writeError: false,
    readGate: null,
    updateGate: null,
    tail: Promise.resolve(),
    active: { generation: 1, epoch: 1, ownerUserId: 'owner-a', accountGeneration: 0, expiresAt: null },
  };
  function assertLease(lease) {
    assert.ok(state.active, 'HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    for (const key of ['generation', 'epoch', 'ownerUserId', 'accountGeneration']) {
      assert.equal(lease[key], state.active[key], `STALE_ROUTINE_${key}`);
    }
  }
  const admission = {
    assertHealthDataWriteLease: assertLease,
    runCurrentHealthDataOperation: async (operation) => {
      assert.ok(state.active, 'HEALTH_DATA_WRITE_ADMISSION_CLOSED');
      const lease = { ...state.active };
      const result = await operation({ ...lease, assertCurrent: () => assertLease(lease) });
      assertLease(lease);
      return result;
    },
  };
  const storage = {
    getPrivateItem: async (key) => {
      assert.equal(key, KEY);
      state.reads += 1;
      const raw = state.raw;
      if (state.readGate) await state.readGate.promise;
      if (state.readError) throw new Error('READ_FAILED');
      return raw;
    },
    updatePrivateItem: (key, updater) => {
      state.attempts += 1;
      const operation = state.tail.catch(() => undefined).then(async () => {
        if (state.updateGate) await state.updateGate.promise;
        const current = await storage.getPrivateItem(key);
        const next = updater(current);
        if (state.writeError) throw new Error('WRITE_FAILED');
        state.raw = next;
        state.writes += 1;
      });
      state.tail = operation.then(() => undefined, () => undefined);
      return operation;
    },
  };
  const dependencies = {
    '@/lib/storage/privateKV': storage,
    '@/lib/consent/healthDataWriteAdmission': admission,
  };
  function loadModule() {
    const source = readFileSync(resolve(root, storePath), 'utf8');
    const compiled = ts.transpileModule(source, {
      fileName: storePath,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true },
      reportDiagnostics: true,
    });
    assert.deepEqual(compiled.diagnostics ?? [], [], 'TypeScript transpile diagnostics');
    const module = { exports: {} };
    const localRequire = (name) => {
      assert.ok(name in dependencies, `Unexpected store runtime dependency: ${name}`);
      return dependencies[name];
    };
    new Function('require', 'module', 'exports', compiled.outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  return { state, store: loadModule(), reloadModule: loadModule };
}

for (const fields of [
  ['schemaVersion', 'am', 'pm'], ['schemaVersion', 'pm', 'am'],
  ['am', 'schemaVersion', 'pm'], ['am', 'pm', 'schemaVersion'],
  ['pm', 'schemaVersion', 'am'], ['pm', 'am', 'schemaVersion'],
]) {
  test(`current schema accepts property order ${fields.join('/')} without rewriting`, async () => {
    const expected = value(['serum', 'cleanser'], ['oil', 'cleanser']);
    const raw = JSON.stringify(Object.fromEntries(fields.map((key) => [key, expected[key]])), null, 2);
    const { state, store } = fixture(raw);
    assert.deepEqual(await store.loadRoutineOrderOverrides(), expected);
    assert.equal(state.raw, raw);
    assert.equal(state.attempts, 0);
  });
}

for (const raw of [
  '{bad json', 'null', '[]', '{}', '{"unrelated":true}', '{"am":[],"other":[]}',
  '{"schemaVersion":1,"am":[]}', '{"schemaVersion":1,"pm":[]}',
  '{"schemaVersion":1,"am":["a","a"],"pm":[]}',
  '{"schemaVersion":1,"am":[42],"pm":[]}',
  '{"schemaVersion":1,"am":[" a "],"pm":[]}',
  '{"schemaVersion":1,"am":[],"pm":[],"extra":true}',
  '{"schemaVersion":"1","am":[],"pm":[]}',
  '{"schemaVersion":2,"am":["a"],"pm":[]}',
]) {
  test(`unrecognized/corrupt/future record is preserved: ${raw}`, async () => {
    const { state, store } = fixture(raw);
    await assert.rejects(() => store.loadRoutineOrderOverrides());
    await assert.rejects(() => store.saveRoutineOrderOverrides({ previous: empty(), next: value(['a']) }));
    assert.equal(state.raw, raw);
    assert.equal(state.writes, 0);
  });
}

test('legacy cleanup remains read-only; explicit save migrates to strict v1', async () => {
  const raw = '{"am":[" cream ","cleanser","cleanser",4],"pm":[null,"oil"]}';
  const { state, store } = fixture(raw);
  const previous = await store.loadRoutineOrderOverrides();
  assert.deepEqual(previous, value(['cream', 'cleanser'], ['oil']));
  assert.equal(state.raw, raw);
  assert.equal(state.attempts, 0);
  await store.saveRoutineOrderOverrides({ previous, next: value(['cleanser', 'cream'], ['oil']) });
  assert.deepEqual(JSON.parse(state.raw), value(['cleanser', 'cream'], ['oil']));
});

test('valid partial legacy phase retains the historical migration path', async () => {
  const { state, store } = fixture('{"pm":["oil"]}');
  assert.deepEqual(await store.loadRoutineOrderOverrides(), value([], ['oil']));
  assert.equal(state.attempts, 0);
});

test('corruption appearing after editor load blocks save without replacement', async () => {
  const { state, store } = fixture(JSON.stringify(value(['a', 'b'], ['p'])));
  const previous = await store.loadRoutineOrderOverrides();
  state.raw = '{broken after load';
  await assert.rejects(() => store.saveRoutineOrderOverrides({ previous, next: value(['b', 'a'], ['p']) }));
  assert.equal(state.raw, '{broken after load');
  assert.equal(state.writes, 0);
});

test('read failure after editor load preserves bytes and supports explicit retry', async () => {
  const raw = JSON.stringify(value(['a', 'b'], ['p']));
  const { state, store } = fixture(raw);
  const previous = await store.loadRoutineOrderOverrides();
  state.readError = true;
  await assert.rejects(() => store.saveRoutineOrderOverrides({ previous, next: value(['b', 'a'], ['p']) }), /READ_FAILED/);
  assert.equal(state.raw, raw);
  assert.equal(state.writes, 0);
  state.readError = false;
  await store.loadRoutineOrderOverrides();
  assert.deepEqual(await store.saveRoutineOrderOverrides({ previous, next: value(['b', 'a'], ['p']) }), value(['b', 'a'], ['p']));
});

test('rejected write does not report success or poison the following transaction', async () => {
  const raw = JSON.stringify(value(['a', 'b'], ['p']));
  const { state, store } = fixture(raw);
  const previous = await store.loadRoutineOrderOverrides();
  state.writeError = true;
  await assert.rejects(() => store.saveRoutineOrderOverrides({ previous, next: value(['b', 'a'], ['p']) }), /WRITE_FAILED/);
  assert.equal(state.raw, raw);
  state.writeError = false;
  assert.deepEqual(await store.saveRoutineOrderOverrides({ previous, next: value(['b', 'a'], ['p']) }), value(['b', 'a'], ['p']));
});

test('independent queued AM/PM edits merge and a stale no-op cannot erase either', async () => {
  const { state, store } = fixture();
  await Promise.all([
    store.saveRoutineOrderOverrides({ previous: empty(), next: value(['a', 'b']) }),
    store.saveRoutineOrderOverrides({ previous: empty(), next: value([], ['p', 'q']) }),
  ]);
  assert.deepEqual(JSON.parse(state.raw), value(['a', 'b'], ['p', 'q']));
  assert.deepEqual(await store.saveRoutineOrderOverrides({ previous: empty(), next: empty() }), value(['a', 'b'], ['p', 'q']));
});

test('a concurrently reset other phase is not resurrected', async () => {
  const original = value(['a', 'b'], ['p', 'q']);
  const { state, store } = fixture(JSON.stringify(original));
  await store.saveRoutineOrderOverrides({ previous: original, next: value(['a', 'b']) });
  await store.saveRoutineOrderOverrides({ previous: original, next: value(['b', 'a'], original.pm) });
  assert.deepEqual(JSON.parse(state.raw), value(['b', 'a']));
});

test('caller-owned arrays are snapshotted before a queued operation awaits', async () => {
  const { state, store } = fixture();
  state.updateGate = deferred();
  const next = value(['a', 'b']);
  const saving = store.saveRoutineOrderOverrides({ previous: empty(), next });
  next.am.reverse();
  state.updateGate.resolve();
  assert.deepEqual(await saving, value(['a', 'b']));
});

test('stale editor authority is rejected before either read or update dispatch', async () => {
  const { state, store } = fixture(JSON.stringify(value(['owner-a-only'])));
  const expected = { ...state.active };
  state.active = { ...state.active, ownerUserId: 'owner-b', generation: 2, accountGeneration: 1 };
  await assert.rejects(() => store.loadRoutineOrderOverrides(expected));
  await assert.rejects(() => store.saveRoutineOrderOverrides({ previous: empty(), next: value(['a']) }, expected));
  assert.equal(state.reads, 0);
  assert.equal(state.attempts, 0);
});

test('same-owner same-epoch re-grant cannot inherit an older editor lease', async () => {
  const { state, store } = fixture();
  const expected = { ...state.active };
  state.active = { ...state.active, generation: 2 };
  await assert.rejects(() => store.saveRoutineOrderOverrides({ previous: empty(), next: value(['a']) }, expected));
  assert.equal(state.attempts, 0);
});

test('an old read cannot publish after an owner transition during I/O', async () => {
  const { state, store } = fixture(JSON.stringify(value(['a'])));
  state.readGate = deferred();
  const pending = store.loadRoutineOrderOverrides({ ...state.active });
  state.active = { ...state.active, ownerUserId: 'owner-b', generation: 2 };
  state.readGate.resolve();
  await assert.rejects(() => pending);
});

test('an old queued transform cannot write after its owner changes', async () => {
  const raw = JSON.stringify(value(['original']));
  const { state, store } = fixture(raw);
  state.updateGate = deferred();
  const pending = store.saveRoutineOrderOverrides({ previous: empty(), next: value(['a']) }, { ...state.active });
  state.active = { ...state.active, ownerUserId: 'owner-b', generation: 2 };
  state.updateGate.resolve();
  await assert.rejects(() => pending);
  assert.equal(state.raw, raw);
  assert.equal(state.writes, 0);
});

test('cache keys isolate owner/account and consent generations without raw owner IDs', () => {
  const { state, store } = fixture();
  const first = store.routineOrderQueryKeyForLease(state.active);
  assert.notDeepEqual(first, store.routineOrderQueryKeyForLease({ ...state.active, generation: 2 }));
  assert.notDeepEqual(first, store.routineOrderQueryKeyForLease({ ...state.active, accountGeneration: 1 }));
  assert.notDeepEqual(first, store.routineOrderQueryKeyForLease());
  assert.ok(!JSON.stringify(first).includes('owner-a'));
});

test('a fresh source-module instance recovers the serialized AM/PM record', async () => {
  const { state, store, reloadModule } = fixture();
  const expected = value(['b', 'a'], ['q', 'p']);
  await store.saveRoutineOrderOverrides({ previous: empty(), next: expected });
  assert.deepEqual(await reloadModule().loadRoutineOrderOverrides(), expected);
  assert.deepEqual(JSON.parse(state.raw), expected);
});

test('explicit canonical reset removes the valid record only after both phases clear', async () => {
  const previous = value(['a'], ['p']);
  const { state, store } = fixture(JSON.stringify(previous));
  assert.deepEqual(await store.saveRoutineOrderOverrides({ previous, next: empty() }), empty());
  assert.equal(state.raw, null);
});

test('phase reconciliation preserves active hidden anchors and never mutates input', () => {
  const { store } = fixture();
  const canonical = [{ productId: 'a' }, { productId: 'b' }];
  const edited = [...canonical].reverse();
  const previous = ['a', 'hidden', 'b', 'removed'];
  assert.deepEqual(store.routineOrderOverrideForPhase(canonical, edited, previous, ['a', 'b', 'hidden']), ['b', 'hidden', 'a']);
  assert.deepEqual(previous, ['a', 'hidden', 'b', 'removed']);
  assert.deepEqual(canonical.map((step) => step.productId), ['a', 'b']);
});

test('G2 hook source uses local-only execution and refuses empty fallback on unreadable state', () => {
  const source = readFileSync(resolve(root, 'apps/mobile/src/features/routine/usePlan.ts'), 'utf8');
  assert.match(source, /networkMode:\s*'always'/u);
  assert.match(source, /retry:\s*false/u);
  assert.match(source, /enabled:\s*orderLease !== undefined/u);
  assert.match(source, /queryKey:\s*routineOrderQueryKeyForLease\(orderLease\)/u);
  assert.match(source, /subscribeActiveHealthProcessingLeaseChanges/u);
  assert.match(source, /loadRoutineOrderOverrides\(orderLease\)/u);
  assert.doesNotMatch(source, /routineOrder\.data\s*\?\?\s*\{/u);
});

test('G2 editor source binds draft authority and preserves untouched phase intent', () => {
  const source = readFileSync(resolve(root, 'apps/mobile/src/app/routine/reorder.tsx'), 'utf8');
  assert.match(source, /if \(editingUnavailable \|\| !editorIsCurrent\(\)\) return;/u);
  assert.match(source, /const previousOverrides = original\.previousOverrides/u);
  assert.match(source, /original\.initial\.am/u);
  assert.match(source, /am:\s*amChanged\s*\?\s*routineOrderOverrideForPhase[\s\S]*?: previousOverrides\.am/u);
  assert.match(source, /pm:\s*pmChanged\s*\?\s*routineOrderOverrideForPhase[\s\S]*?: previousOverrides\.pm/u);
  const key = source.slice(source.indexOf('const editorKey ='), source.indexOf('\n\n  return (', source.indexOf('const editorKey =')));
  assert.doesNotMatch(key, /initial\.am|initial\.pm/u);
  assert.match(source, /await queryClient\.cancelQueries/u);
  assert.match(source, /queryClient\.setQueryData\(queryKey, saved\)/u);
  assert.match(source, /Reload saved order/u);
});
