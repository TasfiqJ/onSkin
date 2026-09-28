import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import {
  ContainedCommandError,
  runContainedCommand,
  sanitizeBoundedCommandDiagnostic,
} from './contained-command.mjs';

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

test('sanitized command diagnostics retain an actionable bounded tail without credentials', () => {
  const opaqueSecret = 'a1'.repeat(32);
  const personalAccessToken = `sbp_${'a1'.repeat(20)}`;
  const oauthAccessToken = `sbp_oauth_${'b2'.repeat(20)}`;
  const secretApiKey = 'sb_secret_abcdefghijklmnopqrstuv_12345678';
  const publishableApiKey = 'sb_publishable_ABCDEFGHIJKLMNOPQRSTUV_abcdefgh';
  const npmToken = 'npm-token-that-must-not-survive';
  const githubToken = 'github-token-that-must-not-survive';
  const diagnosticPath =
    '/tmp/catalog-import-lifecycle-verification/supabase/tests/database/catalog_import_lifecycle.test.sql';
  const diagnostic = sanitizeBoundedCommandDiagnostic(
    {
      stdout: [
        personalAccessToken,
        secretApiKey,
        `wrapped={"accessToken":"${oauthAccessToken}"}`,
        `apikey=${publishableApiKey}`,
        `SUPABASE_ACCESS_TOKEN=super-secret-token\n${'old output\n'.repeat(2)}`,
      ].join('\n'),
      stderr: [
        `opaque=${opaqueSecret}`,
        'Docker daemon is unavailable at http://127.0.0.1:54321/debug?token=secret',
        'Authorization: Bearer header.payload.signature',
        `Authorization: Basic ${Buffer.from('reviewer:password').toString('base64')}`,
        `NPM_TOKEN=${npmToken}`,
        `GITHUB_TOKEN=${githubToken}`,
        `SUPABASE_SERVICE_ROLE_KEY: ${secretApiKey}`,
        'JWT secret: another-short-secret',
        'actionable final failure',
      ].join('\n'),
    },
    { maxBytes: 1024, maxLines: 16 },
  );

  assert.ok(Buffer.byteLength(diagnostic, 'utf8') <= 1024);
  assert.ok(diagnostic.split('\n').length <= 16);
  assert.match(diagnostic, /actionable final failure/u);
  assert.match(diagnostic, /\[redacted-network-url\]/u);
  assert.match(diagnostic, /Bearer \[redacted-credential\]/u);
  assert.match(diagnostic, /Basic \[redacted-credential\]/u);
  assert.match(diagnostic, /NPM_TOKEN=\[redacted\]/u);
  assert.match(diagnostic, /GITHUB_TOKEN=\[redacted\]/u);
  assert.match(diagnostic, /SUPABASE_SERVICE_ROLE_KEY: \[redacted\]/u);
  assert.match(diagnostic, /JWT secret: \[redacted\]/u);
  assert.match(diagnostic, /\[redacted-supabase-access-token\]/u);
  assert.match(diagnostic, /\[redacted-supabase-key\]/u);
  assert.match(diagnostic, /opaque=\[redacted-long-token\]/u);
  assert.doesNotMatch(
    diagnostic,
    new RegExp(
      `super-secret-token|127\\.0\\.0\\.1|header\\.payload|another-short-secret|${npmToken}|${githubToken}|${personalAccessToken}|${oauthAccessToken}|${secretApiKey}|${publishableApiKey}|${opaqueSecret}`,
      'u',
    ),
  );

  const ordinaryPrefixProse =
    'Parser labels sb_secret_value and sb_publishable_example are not credential shapes.';
  assert.equal(
    sanitizeBoundedCommandDiagnostic({ stderr: ordinaryPrefixProse }),
    ordinaryPrefixProse,
  );

  const terminalDiagnostic = sanitizeBoundedCommandDiagnostic({
    stderr:
      `start\rSUPABASE_ACCESS_TOKEN=${personalAccessToken}\r` +
      `next\tcolumn\n\u001b]0;forged-title\u0007\u001b[31mERROR\u001b[0m\rfinal`,
  });
  assert.equal(terminalDiagnostic.includes('\r'), false);
  assert.equal(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(terminalDiagnostic),
    false,
  );
  assert.match(terminalDiagnostic, /start\nSUPABASE_ACCESS_TOKEN=\[redacted\]\nnext\tcolumn/u);
  assert.match(terminalDiagnostic, /final$/u);
  assert.doesNotMatch(terminalDiagnostic, new RegExp(personalAccessToken, 'u'));

  const utf8BudgetDiagnostic = sanitizeBoundedCommandDiagnostic(
    { stderr: `${'\u{1f9f4}'.repeat(50)}\nfinal` },
    { maxBytes: 31, maxLines: 2 },
  );
  assert.ok(Buffer.byteLength(utf8BudgetDiagnostic, 'utf8') <= 31);
  assert.ok(utf8BudgetDiagnostic.split('\n').length <= 2);
  assert.match(utf8BudgetDiagnostic, /final$/u);
  assert.doesNotMatch(utf8BudgetDiagnostic, /\uFFFD/u);

  const pathDiagnostic = sanitizeBoundedCommandDiagnostic({
    stderr:
      `psql:${diagnosticPath}:1371: ERROR: permission denied\n` +
      `C:\\Users\\reviewer\\.claude\\worktrees\\secret\\migration.sql:42\n` +
      `\\\\server\\share\\secret\\config.json:7`,
  });
  assert.match(pathDiagnostic, /\[redacted-path\]\/catalog_import_lifecycle\.test\.sql:1371/u);
  assert.match(pathDiagnostic, /\[redacted-path\]\/migration\.sql:42/u);
  assert.match(pathDiagnostic, /\[redacted-path\]\/config\.json:7/u);
  assert.doesNotMatch(pathDiagnostic, /\/tmp|C:\\Users|\.claude|\\\\server\\share/u);
  assert.doesNotMatch(pathDiagnostic, /\[redacted-long-token\]/u);
});

test('TAP diagnostics retain an early failing assertion and the final harness summary', () => {
  const secret = 'tap-secret-that-must-not-survive';
  const diagnostic = sanitizeBoundedCommandDiagnostic(
    {
      stdout: [
        'TAP version 13',
        'ok 1 - setup passed',
        'not ok 2 - exact CAT-03 set parity',
        '# Failed test 2: exact CAT-03 set parity',
        `# SERVICE_ROLE_KEY=${secret}`,
        '# have: 1',
        '# want: 0',
        ...Array.from({ length: 300 }, (_, index) => `ok ${index + 3} - later assertion`),
        'Failed 1/302 subtests',
        'Files=1, Tests=302, Result: FAIL',
      ].join('\n'),
    },
    { maxBytes: 4096, maxLines: 60, profile: 'tap' },
  );

  assert.match(diagnostic, /not ok 2 - exact CAT-03 set parity/u);
  assert.match(diagnostic, /# Failed test 2/u);
  assert.match(diagnostic, /SERVICE_ROLE_KEY=\[redacted\]/u);
  assert.match(diagnostic, /Failed 1\/302 subtests/u);
  assert.match(diagnostic, /Files=1, Tests=302, Result: FAIL/u);
  assert.doesNotMatch(diagnostic, new RegExp(secret, 'u'));
  assert.ok(Buffer.byteLength(diagnostic, 'utf8') <= 4096);
  assert.ok(diagnostic.split('\n').length <= 60);
});

test('nonzero commands can retain only their sanitized diagnostic tail', async () => {
  const secret = 'secret-value-that-must-not-survive';
  await assert.rejects(
    runContainedCommand({
      command: process.execPath,
      args: [
        '-e',
        `process.stdout.write('setup output\\n'); process.stderr.write('TOKEN=${secret}\\nactionable cli failure\\n'); process.exit(23);`,
      ],
      cwd: REPO_ROOT,
      timeoutMs: 10_000,
      maxOutputBytes: 1024,
      retainSanitizedFailureDiagnostic: true,
    }),
    (error) => {
      assert.equal(error instanceof ContainedCommandError, true);
      assert.equal(error.reason, 'exit-nonzero');
      assert.equal(error.exitCode, 23);
      assert.match(error.diagnostic, /setup output/u);
      assert.match(error.diagnostic, /TOKEN=\[redacted\]/u);
      assert.match(error.diagnostic, /actionable cli failure/u);
      assert.doesNotMatch(error.diagnostic, new RegExp(secret, 'u'));
      assert.equal('stdout' in error, false);
      assert.equal('stderr' in error, false);
      return true;
    },
  );
});

test('nonzero commands can select bounded TAP failure context', async () => {
  await assert.rejects(
    runContainedCommand({
      command: process.execPath,
      args: [
        '-e',
        `process.stdout.write('not ok 7 - retained failure\\n# Failed test 7\\n${'ok - filler\\n'.repeat(200)}Files=1, Tests=207, Result: FAIL\\n'); process.exit(1);`,
      ],
      cwd: REPO_ROOT,
      timeoutMs: 10_000,
      maxOutputBytes: 16 * 1024,
      retainSanitizedFailureDiagnostic: true,
      failureDiagnosticProfile: 'tap',
      failureDiagnosticMaxBytes: 4096,
      failureDiagnosticMaxLines: 50,
    }),
    (error) => {
      assert.equal(error instanceof ContainedCommandError, true);
      assert.match(error.diagnostic, /not ok 7 - retained failure/u);
      assert.match(error.diagnostic, /Files=1, Tests=207, Result: FAIL/u);
      assert.ok(error.diagnostic.split('\n').length <= 50);
      return true;
    },
  );
});

test('TAP diagnostics retain plan errors ahead of a large PostgreSQL notice tail', async () => {
  const diagnostic = sanitizeBoundedCommandDiagnostic(
    {
      stdout: [
        'TAP version 13',
        'catalog_launch_curation.test.sql ..',
        'All 100 subtests passed',
        '',
        'Test Summary Report',
        '-------------------',
        'catalog_launch_curation.test.sql (Wstat: 768 Tests: 100 Failed: 0)',
        '  Non-zero exit status: 3',
        '  Parse errors: Bad plan. You planned 99 tests but ran 100.',
        'Files=1, Tests=100, Result: FAIL',
      ].join('\n'),
      stderr: Array.from(
        { length: 500 },
        (_, index) => `psql:catalog_launch_curation.test.sql:${index + 1}: NOTICE: fixture notice`,
      ).join('\n'),
    },
    { maxBytes: 4096, maxLines: 60, profile: 'tap' },
  );

  assert.match(diagnostic, /Test Summary Report/u);
  assert.match(diagnostic, /Non-zero exit status: 3/u);
  assert.match(diagnostic, /Parse errors: Bad plan\. You planned 99 tests but ran 100\./u);
  assert.match(diagnostic, /Files=1, Tests=100, Result: FAIL/u);
  assert.ok(Buffer.byteLength(diagnostic, 'utf8') <= 4096);
  assert.ok(diagnostic.split('\n').length <= 60);
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
