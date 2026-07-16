import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import { terminateProcessTree } from './process-tree.mjs';

test('termination stops the complete detached process tree before a grandchild can mutate', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db06-process-tree-'));
  const marker = join(root, 'orphan-marker.txt');
  const grandchildSource = `
    const { writeFileSync } = require('node:fs');
    setTimeout(() => writeFileSync(${JSON.stringify(marker)}, 'orphaned'), 1500);
    setInterval(() => {}, 1000);
  `;
  const parentSource = `
    const { spawn } = require('node:child_process');
    spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    });
    setInterval(() => {}, 1000);
  `;
  const parent = spawn(process.execPath, ['-e', parentSource], {
    stdio: 'ignore',
    windowsHide: true,
    shell: false,
    detached: true,
  });
  const closed = new Promise((resolveClose) => parent.once('close', resolveClose));
  try {
    await delay(250);
    await terminateProcessTree(parent);
    await Promise.race([
      closed,
      delay(10_000).then(() => {
        throw new Error('process tree did not exit');
      }),
    ]);
    await delay(1750);
    assert.equal(existsSync(marker), false);
  } finally {
    await terminateProcessTree(parent).catch(() => {});
    rmSync(root, { recursive: true, force: true });
  }
});
