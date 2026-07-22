import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

import { terminateProcessTree } from './process-tree.mjs';

const WINDOWS_RUNNER_UNCONFIRMED_EXIT = 124;
const WINDOWS_RUNNER_ABORT_EXIT = 125;
const CONTAINMENT_GRACE_MS = 15_000;
const FAILURE_DIAGNOSTIC_MAX_BYTES = 16 * 1024;
const FAILURE_DIAGNOSTIC_MAX_LINES = 120;
const FAILURE_DIAGNOSTIC_PROFILES = new Set(['tail', 'tap']);
// Supabase CLI v2 accepts `sbp_` plus 40 lowercase hex characters, with an
// optional `oauth_` marker. Current opaque API keys use 22 URL-safe random
// characters plus an 8-character checksum. Keep these patterns exact so
// ordinary prose containing an `sb_` prefix is not destroyed.
const SUPABASE_PERSONAL_ACCESS_TOKEN_PATTERN =
  /(?<![A-Za-z0-9_])sbp_(?:oauth_)?[a-f0-9]{40}(?![A-Za-z0-9_])/gu;
const SUPABASE_OPAQUE_API_KEY_PATTERN =
  /(?<![A-Za-z0-9_])sb_(?:secret|publishable)_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}(?![A-Za-z0-9_])/gu;
const UNSAFE_TERMINAL_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu;

export class ContainedCommandError extends Error {
  constructor(
    reason,
    { originReason = reason, exitCode = null, containment = 'not-started', diagnostic = '' } = {},
  ) {
    super(reason);
    this.name = 'ContainedCommandError';
    this.reason = reason;
    this.originReason = originReason;
    this.exitCode = exitCode;
    this.containment = containment;
    this.diagnostic = diagnostic;
  }
}

function utf8Tail(value, maxBytes) {
  const buffer = Buffer.from(value, 'utf8');
  if (buffer.length <= maxBytes) return value;

  let start = buffer.length - maxBytes;
  while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) start += 1;
  return buffer.subarray(start).toString('utf8');
}

function normalizeUntrustedDiagnosticText(value) {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(UNSAFE_TERMINAL_CONTROL_PATTERN, '');
}

function redactDiagnosticAbsolutePath(value) {
  const normalized = value.replaceAll('\\', '/');
  const basename = normalized.slice(normalized.lastIndexOf('/') + 1);
  return `[redacted-path]/${basename || 'artifact'}`;
}

function boundedTapFailureLines(lines, maxLines) {
  const failureLine =
    /^(?:\s*not ok\b|\s*Bail out!|\s*(?:#\s*)?Failed (?:test|\d+\/\d+ subtests?)\b|\s*Dubious, test returned\b|\s*Result:\s*FAIL\b|\s*Files=\d+\b|\s*Test Summary Report\b|\s*(?:psql:[^\r\n]*:\s*)?(?:ERROR|FATAL):)/iu;
  const selected = new Set();

  for (const [index, line] of lines.entries()) {
    if (!failureLine.test(line)) continue;
    for (
      let cursor = Math.max(0, index - 2);
      cursor <= Math.min(lines.length - 1, index + 12);
      cursor += 1
    ) {
      selected.add(cursor);
    }
  }

  if (selected.size === 0) return lines.slice(-maxLines);
  for (let index = Math.max(0, lines.length - 24); index < lines.length; index += 1) {
    selected.add(index);
  }

  const selectedIndexes = [...selected].sort((left, right) => left - right);
  const contextual = [];
  let previous = -1;
  for (const index of selectedIndexes) {
    if (previous >= 0 && index > previous + 1) {
      contextual.push('[... redacted output omitted ...]');
    }
    contextual.push(lines[index]);
    previous = index;
  }
  if (contextual.length <= maxLines) return contextual;

  const headCount = Math.max(1, Math.floor((maxLines - 1) / 2));
  const tailCount = Math.max(1, maxLines - headCount - 1);
  return [
    ...contextual.slice(0, headCount),
    '[... bounded diagnostic omitted ...]',
    ...contextual.slice(-tailCount),
  ];
}

export function sanitizeBoundedCommandDiagnostic(
  { stdout = '', stderr = '' },
  {
    maxBytes = FAILURE_DIAGNOSTIC_MAX_BYTES,
    maxLines = FAILURE_DIAGNOSTIC_MAX_LINES,
    profile = 'tail',
  } = {},
) {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0 ||
    !Number.isSafeInteger(maxLines) ||
    maxLines <= 0 ||
    !FAILURE_DIAGNOSTIC_PROFILES.has(profile)
  ) {
    throw new ContainedCommandError('diagnostic-options-invalid');
  }

  const combined = [stdout, stderr]
    .map((value) => normalizeUntrustedDiagnosticText(value).trimEnd())
    .filter(Boolean)
    .join('\n');
  const redacted = combined
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, '[redacted-database-url]')
    .replace(/(?:https?|wss?):\/\/[^\s"']+/giu, '[redacted-network-url]')
    .replace(
      /(?<![A-Za-z0-9])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+[\\/][^\\\s]+[\\/])(?:[^\s"'<>|:*?]+[\\/])*[^\s"'<>|:*?]+/gu,
      redactDiagnosticAbsolutePath,
    )
    .replace(
      /\/(?:Users|Volumes|dev|etc|home|mnt|opt|private|proc|root|run|srv|sys|tmp|usr|var|workspace)(?:\/[^\s"'<>:]+)+/giu,
      redactDiagnosticAbsolutePath,
    )
    .replace(
      /(?:^|[\\/])\.claude[\\/]worktrees(?:[\\/][^\s"'<>:]+)+/gimu,
      redactDiagnosticAbsolutePath,
    )
    .replace(SUPABASE_PERSONAL_ACCESS_TOKEN_PATTERN, '[redacted-supabase-access-token]')
    .replace(SUPABASE_OPAQUE_API_KEY_PATTERN, '[redacted-supabase-key]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted-jwt]')
    .replace(/\b(Basic|Bearer|Digest)\s+[A-Za-z0-9._~+/=-]+/giu, '$1 [redacted-credential]')
    .replace(
      /(\b(?:[A-Za-z0-9]+[_-])+(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY)\b"?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      '$1[redacted]',
    )
    .replace(
      /(\b(?:(?:SUPABASE|SB)[ _-]?)?(?:ACCESS[ _-]?TOKEN|ANON[ _-]?KEY|API[ _-]?(?:KEY|URL)|CLIENT[ _-]?SECRET|DATABASE[ _-]?URL|DB[ _-]?(?:PASSWORD|URL)|DIRECT[ _-]?URL|JWT[ _-]?SECRET|PASSWORD|PGPASSWORD|POSTGRES[ _-]?URL|PRIVATE[ _-]?KEY|PROJECT[ _-]?REF|PUBLISHABLE[ _-]?KEY|SECRET(?:[ _-]?KEY)?|SERVICE[ _-]?ROLE[ _-]?KEY|TOKEN)\b"?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      '$1[redacted]',
    )
    .replace(
      /(--(?:access-token|anon-key|client-secret|db-password|password|project-ref|secret-key|service-role-key|token)(?:=|\s+))(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      '$1[redacted]',
    )
    .replace(
      /(^|[\s"'=:,;()\[\]{}])([A-Za-z0-9+_-]{48,}={0,2})(?=$|[\s"',;()\[\]{}])/gmu,
      '$1[redacted-long-token]',
    );
  const lines = redacted.split(/\n/u);
  const selectedLines =
    profile === 'tap' ? boundedTapFailureLines(lines, maxLines) : lines.slice(-maxLines);
  const sanitized = selectedLines.join('\n');

  return utf8Tail(sanitized, maxBytes);
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
  retainSanitizedFailureDiagnostic = false,
  failureDiagnosticProfile = 'tail',
  failureDiagnosticMaxBytes = FAILURE_DIAGNOSTIC_MAX_BYTES,
  failureDiagnosticMaxLines = FAILURE_DIAGNOSTIC_MAX_LINES,
}) {
  assertCommandOptions({
    command,
    args,
    cwd,
    timeoutMs,
    maxOutputBytes,
    inheritParentProcessGroup,
  });
  if (
    typeof retainSanitizedFailureDiagnostic !== 'boolean' ||
    !FAILURE_DIAGNOSTIC_PROFILES.has(failureDiagnosticProfile) ||
    !Number.isSafeInteger(failureDiagnosticMaxBytes) ||
    failureDiagnosticMaxBytes <= 0 ||
    !Number.isSafeInteger(failureDiagnosticMaxLines) ||
    failureDiagnosticMaxLines <= 0
  ) {
    throw new ContainedCommandError('options-invalid');
  }
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
      const diagnostic = retainSanitizedFailureDiagnostic
        ? sanitizeBoundedCommandDiagnostic(
            {
              stdout: Buffer.concat(stdout).toString('utf8'),
              stderr: Buffer.concat(stderr).toString('utf8'),
            },
            {
              maxBytes: failureDiagnosticMaxBytes,
              maxLines: failureDiagnosticMaxLines,
              profile: failureDiagnosticProfile,
            },
          )
        : '';
      rejectCommand(
        new ContainedCommandError(reason, {
          originReason,
          exitCode: closeResult?.exitCode ?? child.exitCode ?? null,
          containment,
          diagnostic,
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
