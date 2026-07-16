import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

import { terminateProcessTree } from './process-tree.mjs';

const WINDOWS_RUNNER_UNCONFIRMED_EXIT = 124;
const WINDOWS_RUNNER_ABORT_EXIT = 125;
const CONTAINMENT_GRACE_MS = 15_000;

export class ContainedCommandError extends Error {
  constructor(
    reason,
    { originReason = reason, exitCode = null, containment = 'not-started' } = {},
  ) {
    super(reason);
    this.name = 'ContainedCommandError';
    this.reason = reason;
    this.originReason = originReason;
    this.exitCode = exitCode;
    this.containment = containment;
  }
}

function assertCommandOptions({
  command,
  args,
  cwd,
  timeoutMs,
  maxOutputBytes,
  inheritParentProcessGroup,
}) {
  if (
    typeof command !== 'string' ||
    command.length === 0 ||
    !Array.isArray(args) ||
    args.some((argument) => typeof argument !== 'string') ||
    typeof cwd !== 'string' ||
    cwd.length === 0 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes <= 0 ||
    typeof inheritParentProcessGroup !== 'boolean'
  ) {
    throw new ContainedCommandError('options-invalid');
  }
}

export async function runContainedCommand({
  command,
  args = [],
  cwd,
  environment = process.env,
  timeoutMs,
  maxOutputBytes,
  windowsJobRunnerPath,
  cancellationPath,
  signal,
  inheritParentProcessGroup = false,
}) {
  assertCommandOptions({
    command,
    args,
    cwd,
    timeoutMs,
    maxOutputBytes,
    inheritParentProcessGroup,
  });
  const windowsJobContained =
    process.platform === 'win32' && typeof windowsJobRunnerPath === 'string';
  if (
    windowsJobContained &&
    (windowsJobRunnerPath.length === 0 ||
      typeof cancellationPath !== 'string' ||
      cancellationPath.length === 0)
  ) {
    throw new ContainedCommandError('options-invalid');
  }
  if (signal?.aborted) throw new ContainedCommandError('aborted');

  const spawnedCommand = windowsJobContained ? windowsJobRunnerPath : command;
  const spawnedArgs = windowsJobContained ? [cwd, cancellationPath, command, ...args] : args;
  let child;
  try {
    child = spawn(spawnedCommand, spawnedArgs, {
      cwd,
      env: environment,
      shell: false,
      windowsHide: true,
      detached: !inheritParentProcessGroup,
    });
  } catch {
    throw new ContainedCommandError('spawn-failed');
  }

  return await new Promise((resolveCommand, rejectCommand) => {
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    let abortReason;
    let closeResult;
    let resolveClosed;
    const closed = new Promise((resolveClose) => {
      resolveClosed = resolveClose;
    });

    function cleanup({ preserveCancellation = false } = {}) {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onSignalAbort);
      if (cancellationPath && !preserveCancellation) {
        rmSync(cancellationPath, { force: true });
      }
    }

    function settleSuccess() {
      if (settled) return;
      settled = true;
      cleanup();
      resolveCommand({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        exitCode: closeResult?.exitCode ?? 0,
        containment: inheritParentProcessGroup
          ? 'inherited-parent-process-group'
          : windowsJobContained
            ? 'windows-job-object-empty'
            : process.platform === 'win32'
              ? 'windows-primary-process-only'
              : 'posix-process-group-empty',
      });
    }

    function settleFailure(reason, originReason = reason, containment = 'not-started') {
      if (settled) return;
      settled = true;
      cleanup({ preserveCancellation: containment === 'unconfirmed' });
      rejectCommand(
        new ContainedCommandError(reason, {
          originReason,
          exitCode: closeResult?.exitCode ?? child.exitCode ?? null,
          containment,
        }),
      );
    }

    async function waitForCloseOrNull(timeoutMs) {
      if (closeResult) return closeResult;
      return await new Promise((resolveWait) => {
        let completed = false;
        const waitTimer = setTimeout(() => {
          if (completed) return;
          completed = true;
          resolveWait(null);
        }, timeoutMs);
        void closed.then((result) => {
          if (completed) return;
          completed = true;
          clearTimeout(waitTimer);
          resolveWait(result);
        });
      });
    }

    async function containAfterAbort(reason) {
      let externallyContained = false;
      try {
        if (inheritParentProcessGroup) {
          child.kill('SIGTERM');
          closeResult = await waitForCloseOrNull(CONTAINMENT_GRACE_MS);
          if (!closeResult) {
            child.kill('SIGKILL');
            closeResult = await waitForCloseOrNull(CONTAINMENT_GRACE_MS);
          }
          if (!closeResult) throw new Error('nested primary process did not close');
          settleFailure(reason, reason, 'delegated-to-parent-process-group');
          return;
        } else if (windowsJobContained) {
          let cancellationSignalled = false;
          try {
            writeFileSync(cancellationPath, 'cancel\n', {
              encoding: 'ascii',
              flag: 'wx',
            });
            cancellationSignalled = true;
          } catch {
            // Fall through to the independently awaited process-tree fallback.
          }
          if (cancellationSignalled) {
            closeResult = await waitForCloseOrNull(CONTAINMENT_GRACE_MS);
          }
          if (!closeResult) {
            await terminateProcessTree(child, {
              windowsJobContained: true,
              timeoutMs: CONTAINMENT_GRACE_MS,
            });
            externallyContained = true;
            closeResult = await waitForCloseOrNull(CONTAINMENT_GRACE_MS);
          }
        } else {
          await terminateProcessTree(child, {
            timeoutMs: CONTAINMENT_GRACE_MS,
          });
          externallyContained = true;
          closeResult = await waitForCloseOrNull(CONTAINMENT_GRACE_MS);
        }
        if (
          !closeResult ||
          (windowsJobContained &&
            closeResult.exitCode === WINDOWS_RUNNER_UNCONFIRMED_EXIT &&
            !externallyContained)
        ) {
          throw new Error('containment unconfirmed');
        }
        settleFailure(
          reason,
          reason,
          windowsJobContained && !externallyContained
            ? 'windows-job-object-empty'
            : process.platform === 'win32'
              ? 'windows-process-tree-terminated'
              : 'posix-process-group-empty',
        );
      } catch {
        settleFailure('termination-unconfirmed', reason, 'unconfirmed');
      }
    }

    function beginAbort(reason) {
      if (abortReason || settled || closeResult) return;
      abortReason = reason;
      clearTimeout(timeout);
      void containAfterAbort(reason);
    }

    function onSignalAbort() {
      beginAbort('aborted');
    }

    function capture(target, chunk) {
      if (settled || abortReason) return;
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        beginAbort('output-limit');
        return;
      }
      target.push(Buffer.from(chunk));
    }

    async function handleNormalClose() {
      if (settled || abortReason) return;
      try {
        if (windowsJobContained && closeResult.exitCode === WINDOWS_RUNNER_UNCONFIRMED_EXIT) {
          settleFailure('termination-unconfirmed', 'exit-nonzero', 'unconfirmed');
          return;
        }
        if (!inheritParentProcessGroup && process.platform !== 'win32') {
          await terminateProcessTree(child, {
            timeoutMs: CONTAINMENT_GRACE_MS,
          });
        }
      } catch {
        settleFailure('termination-unconfirmed', 'exit-nonzero', 'unconfirmed');
        return;
      }
      if (closeResult.exitCode === 0) {
        settleSuccess();
      } else {
        settleFailure(
          'exit-nonzero',
          'exit-nonzero',
          inheritParentProcessGroup
            ? 'inherited-parent-process-group'
            : windowsJobContained
              ? 'windows-job-object-empty'
              : process.platform === 'win32'
                ? 'windows-primary-process-exited'
                : 'posix-process-group-empty',
        );
      }
    }

    const timeout = setTimeout(() => beginAbort('timeout'), timeoutMs);
    child.stdout.on('data', (chunk) => capture(stdout, chunk));
    child.stderr.on('data', (chunk) => capture(stderr, chunk));
    child.once('error', () => {
      if (child.pid) {
        beginAbort('spawn-failed');
      } else {
        settleFailure('spawn-failed', 'spawn-failed', 'not-started');
      }
    });
    child.once('close', (exitCode, signalCode) => {
      closeResult = { exitCode, signalCode };
      clearTimeout(timeout);
      resolveClosed(closeResult);
      void handleNormalClose();
    });
    signal?.addEventListener('abort', onSignalAbort, { once: true });
    if (signal?.aborted) onSignalAbort();
  });
}

export const WINDOWS_JOB_RUNNER_ABORT_EXIT = WINDOWS_RUNNER_ABORT_EXIT;
