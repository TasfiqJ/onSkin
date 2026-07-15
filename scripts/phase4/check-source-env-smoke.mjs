#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const checkEnvPath = resolve(scriptDir, 'check-source-env.mjs');

const passthroughKeys = [
  'ComSpec',
  'HOME',
  'Path',
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'WINDIR',
];

const processBaseEnv = Object.fromEntries(
  passthroughKeys
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => typeof value === 'string' && value.length > 0),
);

const completeEnv = {
  CATALOG_APP_NAME: 'RoutineKind',
  CATALOG_APP_VERSION: '0.1.0',
  CATALOG_CONTACT_EMAIL: 'catalog@routinekind.app',
  CATALOG_ATTRIBUTION_URL: 'https://routinekind.app/catalog-sources',
};

function runCheck(extraEnv) {
  const cwd = mkdtempSync(join(tmpdir(), 'routinekind-phase4-check-source-env-'));
  try {
    return spawnSync(process.execPath, [checkEnvPath, '--strict'], {
      cwd,
      encoding: 'utf8',
      env: { ...processBaseEnv, ...extraEnv },
    });
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
}

const cases = [
  {
    name: 'strict catalog source env passes with final source identity values',
    result: runCheck(completeEnv),
    expect(result) {
      return result.status === 0 && /Phase 4 source env contract is complete/.test(result.stdout);
    },
  },
  {
    name: 'strict catalog source env rejects uppercase placeholder URLs',
    result: runCheck({
      ...completeEnv,
      CATALOG_ATTRIBUTION_URL: 'https://EXAMPLE.COM/catalog-sources',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        /CATALOG_ATTRIBUTION_URL is missing, a placeholder, or still uses an uncleared brand/.test(
          result.stderr,
        )
      );
    },
  },
  {
    name: 'strict catalog source env rejects reserved attribution hosts',
    result: runCheck({
      ...completeEnv,
      CATALOG_ATTRIBUTION_URL: 'https://routinekind.local/catalog-sources',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        /CATALOG_ATTRIBUTION_URL must be a production HTTPS URL/.test(result.stderr)
      );
    },
  },
  {
    name: 'strict catalog source env rejects placeholder contact emails',
    result: runCheck({
      ...completeEnv,
      CATALOG_CONTACT_EMAIL: 'catalog@example.com',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        /CATALOG_CONTACT_EMAIL is missing, a placeholder, or still uses an uncleared brand/.test(
          result.stderr,
        )
      );
    },
  },
  {
    name: 'strict catalog source env rejects the retired live OBF API flag',
    result: runCheck({
      ...completeEnv,
      OBF_API_ENABLED: 'true',
    }),
    expect(result) {
      return (
        result.status === 1 &&
        /OBF_API_ENABLED is retired: request-time Open Beauty Facts lookup must remain disabled/.test(
          result.stderr,
        )
      );
    },
  },
  {
    name: 'strict catalog source env rejects legacy brand casing variants',
    result: runCheck({
      ...completeEnv,
      CATALOG_APP_NAME: ['on', 'skin'].join(''),
    }),
    expect(result) {
      return (
        result.status === 1 &&
        /CATALOG_APP_NAME is missing, a placeholder, or still uses an uncleared brand/.test(
          result.stderr,
        )
      );
    },
  },
];

let failed = false;
for (const testCase of cases) {
  if (testCase.expect(testCase.result)) {
    console.log(`OK ${testCase.name}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${testCase.name}`);
  if (testCase.result.stdout) console.error(testCase.result.stdout.trim());
  if (testCase.result.stderr) console.error(testCase.result.stderr.trim());
}

if (failed) process.exit(1);
