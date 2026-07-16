import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import { ContainedCommandError, runContainedCommand } from './contained-command.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

async function runBuild(command, args) {
  return await new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill();
      rejectBuild(new Error('job runner build timed out'));
    }, 30_000);
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.once('error', rejectBuild);
    child.once('close', (exitCode) => {
      clearTimeout(timer);
      if (exitCode !== 0) {
        rejectBuild(new Error(Buffer.concat(stderr).toString('utf8')));
        return;
      }
      resolveBuild();
    });
  });
}

function commandSource(markerPath, pidPath, { keepAlive, emitOutput, markerDelayMs = 1_500 }) {
  const grandchildSource = `
    const { writeFileSync } = require('node:fs');
    setTimeout(() => writeFileSync(${JSON.stringify(markerPath)}, 'orphaned'), ${markerDelayMs});
    setInterval(() => {}, 1000);
  `;
  return `
    const { spawn } = require('node:child_process');
    const { writeFileSync } = require('node:fs');
    const child = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildSource)}], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    });
    child.unref();
    writeFileSync(${JSON.stringify(pidPath)}, String(child.pid));
    ${emitOutput ? "process.stdout.write('x'.repeat(4096));" : ''}
    ${keepAlive ? 'setInterval(() => {}, 1000);' : ''}
  `;
}

function assertProcessStopped(pidPath) {
  assert.equal(existsSync(pidPath), true, 'the parent must record its grandchild PID');
  const pid = Number.parseInt(readFileSync(pidPath, 'utf8'), 10);
  assert.equal(Number.isSafeInteger(pid) && pid > 0, true);
  let running = true;
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error?.code === 'ESRCH') running = false;
    else throw error;
  }
  assert.equal(running, false, `grandchild ${pid} survived caller settlement`);
}

test('nested commands can remain in the parent process group for outer containment', async () => {
  const result = await runContainedCommand({
    command: process.execPath,
    args: ['-e', "process.stdout.write('nested-ok')"],
    cwd: REPO_ROOT,
    timeoutMs: 10_000,
    maxOutputBytes: 1024,
    inheritParentProcessGroup: true,
  });
  assert.equal(result.stdout, 'nested-ok');
  assert.equal(result.containment, 'inherited-parent-process-group');
});

test('nested command abort delegates descendant proof to the outer process group', async () => {
  await assert.rejects(
    runContainedCommand({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: REPO_ROOT,
      timeoutMs: 150,
      maxOutputBytes: 1024,
      inheritParentProcessGroup: true,
    }),
    (error) =>
      error instanceof ContainedCommandError &&
      error.reason === 'timeout' &&
      error.containment === 'delegated-to-parent-process-group',
  );
});

test(
  'Windows job runner contains normal, timeout, and output-limit descendants before settlement',
  { skip: process.platform !== 'win32', timeout: 30_000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'db06-contained-command-'));
    const runner = join(root, 'db06-job-runner.exe');
    try {
      await runBuild('powershell.exe', [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        join(REPO_ROOT, 'scripts', 'phase2', 'build-windows-job-runner.ps1'),
        '-SourcePath',
        join(REPO_ROOT, 'scripts', 'phase2', 'windows-job-runner.cs'),
        '-OutputPath',
        runner,
      ]);

      const normalMarker = join(root, 'normal-marker.txt');
      const normalPid = join(root, 'normal-pid.txt');
      const normalResult = await runContainedCommand({
        command: process.execPath,
        args: [
          '-e',
          commandSource(normalMarker, normalPid, {
            keepAlive: false,
            emitOutput: false,
          }),
        ],
        cwd: REPO_ROOT,
        timeoutMs: 10_000,
        maxOutputBytes: 64 * 1024,
        windowsJobRunnerPath: runner,
        cancellationPath: join(root, 'normal.cancel'),
      });
      assert.equal(normalResult.containment, 'windows-job-object-empty');
      assertProcessStopped(normalPid);

      const timeoutMarker = join(root, 'timeout-marker.txt');
      const timeoutPid = join(root, 'timeout-pid.txt');
      await assert.rejects(
        runContainedCommand({
          command: process.execPath,
          args: [
            '-e',
            commandSource(timeoutMarker, timeoutPid, {
              keepAlive: true,
              emitOutput: false,
              markerDelayMs: 4_000,
            }),
          ],
          cwd: REPO_ROOT,
          timeoutMs: 2_000,
          maxOutputBytes: 64 * 1024,
          windowsJobRunnerPath: runner,
          cancellationPath: join(root, 'timeout.cancel'),
        }),
        (error) =>
          error instanceof ContainedCommandError &&
          error.reason === 'timeout' &&
          error.containment === 'windows-job-object-empty',
      );
      assertProcessStopped(timeoutPid);

      const outputMarker = join(root, 'output-marker.txt');
      const outputPid = join(root, 'output-pid.txt');
      await assert.rejects(
        runContainedCommand({
          command: process.execPath,
          args: [
            '-e',
            commandSource(outputMarker, outputPid, {
              keepAlive: true,
              emitOutput: true,
            }),
          ],
          cwd: REPO_ROOT,
          timeoutMs: 10_000,
          maxOutputBytes: 128,
          windowsJobRunnerPath: runner,
          cancellationPath: join(root, 'output.cancel'),
        }),
        (error) =>
          error instanceof ContainedCommandError &&
          error.reason === 'output-limit' &&
          error.containment === 'windows-job-object-empty',
      );
      assertProcessStopped(outputPid);

      await delay(2_500);
      assert.equal(existsSync(normalMarker), false);
      assert.equal(existsSync(timeoutMarker), false);
      assert.equal(existsSync(outputMarker), false);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  },
);
