#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const obfImporterPath = resolve(scriptDir, 'import-obf-snapshot.mjs');
const cosingImporterPath = resolve(scriptDir, 'import-cosing-dictionary.mjs');
const obfFixturePath = resolve(root, 'scripts/phase4/fixtures/obf-sample.jsonl');
const cosingFixturePath = resolve(root, 'scripts/phase4/fixtures/cosing-sample.csv');

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

function output(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function runImporter(args) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: processBaseEnv,
  });
}

function verifyStableOutput(name, args, outputPath, validate) {
  const first = runImporter(args);
  const firstText = output(first);
  if (first.status !== 0) {
    return { ok: false, message: `${name} first run failed\n${firstText}` };
  }
  const firstBytes = readFileSync(outputPath, 'utf8');
  const firstManifest = JSON.parse(firstBytes);

  const second = runImporter(args);
  const secondText = output(second);
  if (second.status !== 0) {
    return { ok: false, message: `${name} second run failed\n${secondText}` };
  }
  const secondBytes = readFileSync(outputPath, 'utf8');
  const secondManifest = JSON.parse(secondBytes);

  if (firstBytes !== secondBytes) {
    return { ok: false, message: `${name} fixture output changed on a no-op rerun.` };
  }
  if (
    typeof firstManifest.generatedAt !== 'string' ||
    firstManifest.generatedAt !== secondManifest.generatedAt
  ) {
    return { ok: false, message: `${name} generatedAt was not preserved across reruns.` };
  }
  if (!validate(secondManifest)) {
    return { ok: false, message: `${name} manifest contract did not match expected fixture shape.` };
  }
  return { ok: true };
}

const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase4-import-smoke-'));
try {
  const cases = [
    {
      name: 'OBF fixture import is stable across no-op reruns',
      args: [obfImporterPath, obfFixturePath, resolve(outDir, 'obf-fixture-import.json')],
      outputPath: resolve(outDir, 'obf-fixture-import.json'),
      validate(manifest) {
        return (
          manifest.source === 'open_beauty_facts' &&
          manifest.importMode === 'export_or_fixture' &&
          manifest.totals?.acceptedProducts === 2 &&
          manifest.totals?.rejectedRecords === 1 &&
          /^[0-9a-f]{64}$/i.test(manifest.inputSha256 ?? '')
        );
      },
    },
    {
      name: 'CosIng fixture import is stable across no-op reruns',
      args: [
        cosingImporterPath,
        '--fixture',
        cosingFixturePath,
        resolve(outDir, 'cosing-fixture-import.json'),
      ],
      outputPath: resolve(outDir, 'cosing-fixture-import.json'),
      validate(manifest) {
        return (
          manifest.status === 'fixture' &&
          manifest.totals?.ingredients === 3 &&
          manifest.totals?.synonyms === 2 &&
          /^[0-9a-f]{64}$/i.test(manifest.inputSha256 ?? '')
        );
      },
    },
  ];

  let failed = false;
  for (const testCase of cases) {
    const result = verifyStableOutput(
      testCase.name,
      testCase.args,
      testCase.outputPath,
      testCase.validate,
    );
    if (result.ok) {
      console.log(`OK ${testCase.name}`);
      continue;
    }
    failed = true;
    console.error(`FAIL ${testCase.name}`);
    console.error(result.message);
  }

  if (failed) process.exit(1);
} finally {
  rmSync(outDir, { force: true, recursive: true });
}
