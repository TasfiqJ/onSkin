import assert from 'node:assert/strict';
import test from 'node:test';

import { reportsPinnedEmptySchemaDiff } from './schema-diff-evidence.mjs';

test('pinned empty-diff signal is exact, stderr-only, and singular', () => {
  assert.equal(
    reportsPinnedEmptySchemaDiff({
      stdout: '',
      stderr: 'Creating shadow database...\nNo schema changes found\nFinished supabase db diff.\n',
    }),
    true,
  );
  assert.equal(
    reportsPinnedEmptySchemaDiff({
      stdout: '',
      stderr: '\u001B[32mNo schema changes found\u001B[0m\n',
    }),
    true,
  );
  for (const output of [
    { stdout: '', stderr: '' },
    { stdout: 'No schema changes found\n', stderr: '' },
    { stdout: '', stderr: 'prefix No schema changes found\n' },
    { stdout: '', stderr: 'No schema changes found\nNo schema changes found\n' },
  ]) {
    assert.equal(reportsPinnedEmptySchemaDiff(output), false);
  }
});
