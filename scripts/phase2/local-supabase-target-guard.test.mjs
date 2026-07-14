import assert from 'node:assert/strict';
import test from 'node:test';

import { assertLocalOnlyInvocation } from './local-supabase-target-guard.mjs';

test('allows only the expected explicitly local database command', () => {
  assert.doesNotThrow(() =>
    assertLocalOnlyInvocation('test', ['db', 'diff', '--local', '--schema', 'public']),
  );
  assert.doesNotThrow(() => assertLocalOnlyInvocation('test', ['start']));
  assert.doesNotThrow(() => assertLocalOnlyInvocation('test', ['stop', '--no-backup']));
});

test('rejects split and equals remote-target flag forms', () => {
  for (const args of [
    ['db', 'diff', '--local', '--db-url', 'postgresql://remote.invalid/db'],
    ['db', 'diff', '--local', '--db-url=postgresql://remote.invalid/db'],
    ['db', 'diff', '--local', '--project-id', 'remote'],
    ['db', 'diff', '--local', '--project-id=remote'],
    ['db', 'diff', '--local', '--linked'],
    ['db', 'diff', '--local', '--from', 'linked'],
    ['db', 'diff', '--local', '--from=linked'],
    ['db', 'diff', '--local', '--to', 'postgresql://remote.invalid/db'],
    ['db', 'diff', '--local', '--to=postgresql://remote.invalid/db'],
    ['db', 'diff', '--local', '--workdir', 'elsewhere'],
    ['db', 'diff', '--local', '--workdir=elsewhere'],
  ]) {
    assert.throws(() => assertLocalOnlyInvocation('test', args));
  }
});

test('rejects non-allowlisted commands and missing explicit local targeting', () => {
  assert.throws(() => assertLocalOnlyInvocation('test', ['db', 'push']));
  assert.throws(() => assertLocalOnlyInvocation('test', ['migration', 'repair']));
  assert.throws(() => assertLocalOnlyInvocation('test', ['db', 'reset']));
});
