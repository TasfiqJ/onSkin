import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import { terminateProcessTree } from './process-tree.mjs';

async function waitForSettlement(closed, timeoutMs) {
  let timeout;
  try {
    return await Promise.race([
      closed.then(() => true),
      new Promise((resolveTimeout) => {
        timeout = setTimeout(() => resolveTimeout(false), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function windowsTaskkillCanTerminateOwnChild() {
  if (process.platform !== 'win32') return true;

  const victim = spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 1000);'], {
    stdio: 'ignore',
    windowsHide: true,
    shell: false,
    detached: true,
  });
  const victimClosed = new Promise((resolveClose) => victim.once('close', resolveClose));
  await delay(100);

  const exitCode = await new Promise((resolveCapability) => {
    const probe = spawn('taskkill.exe', ['/PID', String(victim.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveCapability(value);
    };
    const timeout = setTimeout(() => {
      probe.kill();
      finish(null);
    }, 2_000);
    probe.once('error', () => finish(null));
    probe.once('close', finish);
  });

  await waitForSettlement(victimClosed, 2_000);
  if (victim.exitCode === null && victim.signalCode === null) {
    victim.kill();
    await waitForSettlement(victimClosed, 2_000);
  }
  return exitCode === 0;
}

test(
  'termination stops the complete detached process tree before a grandchild can mutate',
  { timeout: 20_000 },
  async (context) => {
    if (!(await windowsTaskkillCanTerminateOwnChild())) {
      context.skip(
        'Windows taskkill process-tree inspection is unavailable in this restricted runner; Job Object containment is covered by contained-command.test.mjs.',
      );
      return;
    }

    const root = mkdtempSync(join(tmpdir(), 'db06-process-tree-'));
    const marker = join(root, 'orphan-marker.txt');
    const grandchildSource = `
    const { writeFileSync } = require('node:fs');
    setTimeout(() => writeFileSync(${JSON.stringify(marker)}, 'orphaned'), 1500);
    setTimeout(() => process.exit(0), 5000);
  `;
    const parentSource = `
    const { spawn } = require('node:child_process');
    spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    });
    setTimeout(() => process.exit(0), 5000);
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
      assert.equal(await waitForSettlement(closed, 10_000), true, 'process tree did not exit');
      await delay(1750);
      assert.equal(existsSync(marker), false);
    } finally {
      await terminateProcessTree(parent).catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  },
);
