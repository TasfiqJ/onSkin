#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG_TRANSFORMED_PAYLOAD_CONTRACT } from './source-policy.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const obfImporterPath = resolve(scriptDir, 'import-obf-snapshot.mjs');
const cosingImporterPath = resolve(scriptDir, 'import-cosing-dictionary.mjs');
const obfFixturePath = resolve(root, 'scripts/phase4/fixtures/obf-sample.jsonl');
const cosingFixturePath = resolve(root, 'scripts/phase4/fixtures/cosing-sample.csv');
const obfTemplatePath = resolve(root, 'docs/phase-4/obf-source-approval.template.json');
const cosingTemplatePath = resolve(root, 'docs/phase-4/cosing-source-approval.template.json');

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

function hasExactTransformedPayloadContract(manifest) {
  return (
    JSON.stringify(manifest.transformedPayloadContract) ===
    JSON.stringify(CATALOG_TRANSFORMED_PAYLOAD_CONTRACT)
  );
}

function runImporter(args, extraEnv = {}) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...processBaseEnv, ...extraEnv },
  });
}

function relevantSourceTreeStatus() {
  const result = spawnSync(
    'git',
    [
      '-c',
      `safe.directory=${root}`,
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--',
      'docs/phase-4/catalog-release-scope.json',
      'docs/phase-4/catalog-source-policy.json',
      'docs/phase-4/catalog-source-trust-registry.json',
      'scripts/phase4',
      'apps/mobile/app.base.json',
      'apps/mobile/package.json',
      'package.json',
      'package-lock.json',
    ],
    { cwd: root, encoding: 'utf8', env: processBaseEnv },
  );
  if (result.status !== 0) throw new Error(`Git status failed:\n${output(result)}`);
  return result.stdout.trim();
}

function expectFailure({ args, env, message, name, pattern }) {
  const result = runImporter(args, env);
  if (result.status === 0 || !pattern.test(output(result))) {
    console.error(`FAIL ${name}`);
    console.error(message);
    console.error(output(result));
    return false;
  }
  console.log(`OK ${name}`);
  return true;
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
    return {
      ok: false,
      message: `${name} manifest contract did not match expected fixture shape.`,
    };
  }
  return { ok: true };
}

const artifactRoot = resolve(root, 'artifacts/phase4');
mkdirSync(artifactRoot, { recursive: true });
const outDir = mkdtempSync(join(artifactRoot, 'import-smoke-'));

try {
  let failed = false;
  const cases = [
    {
      name: 'OBF fixture import is stable across no-op reruns',
      args: [
        obfImporterPath,
        '--fixture',
        obfFixturePath,
        resolve(outDir, 'obf-fixture-import.json'),
      ],
      outputPath: resolve(outDir, 'obf-fixture-import.json'),
      validate(manifest) {
        return (
          manifest.schemaVersion === 2 &&
          manifest.status === 'fixture' &&
          manifest.source === 'open_beauty_facts' &&
          manifest.importMode === 'fixture' &&
          manifest.sourceComponentId === 'obf_odbl_component' &&
          manifest.sourceIsolationMode ===
            'separate_source_component_pending_legal_classification' &&
          manifest.sourceApproval === null &&
          hasExactTransformedPayloadContract(manifest) &&
          manifest.controls?.runtimeRequests === false &&
          manifest.controls?.imagesIncluded === false &&
          manifest.controls?.contributionBack === false &&
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
          manifest.schemaVersion === 2 &&
          manifest.status === 'fixture' &&
          manifest.source === 'cosing' &&
          manifest.importMode === 'fixture' &&
          manifest.sourceComponentId === 'cosing_reference_component' &&
          manifest.sourceApproval === null &&
          hasExactTransformedPayloadContract(manifest) &&
          manifest.controls?.claimsAuthority === 'informative_reference_only' &&
          manifest.totals?.ingredients === 3 &&
          manifest.totals?.synonyms === 2 &&
          manifest.ingredients?.every(
            (ingredient) =>
              typeof ingredient.sourceRef === 'string' &&
              ingredient.sourceRecordStatus === 'active' &&
              ingredient.glossaryDecision === 'EU_2025_1175',
          ) &&
          /^[0-9a-f]{64}$/i.test(manifest.inputSha256 ?? '')
        );
      },
    },
  ];

  for (const testCase of cases) {
    const result = verifyStableOutput(
      testCase.name,
      testCase.args,
      testCase.outputPath,
      testCase.validate,
    );
    if (result.ok) {
      console.log(`OK ${testCase.name}`);
    } else {
      failed = true;
      console.error(`FAIL ${testCase.name}`);
      console.error(result.message);
    }
  }

  failed =
    !expectFailure({
      name: 'OBF import without an explicit mode fails closed',
      message: 'Importer accepted a mode-less invocation.',
      args: [obfImporterPath, obfFixturePath, resolve(outDir, 'must-not-exist.json')],
      pattern: /Choose --fixture, --candidate, or --production/,
    }) || failed;

  const copiedObfPath = resolve(outDir, 'copied-obf.jsonl');
  writeFileSync(copiedObfPath, readFileSync(obfFixturePath), { flag: 'wx' });
  failed =
    !expectFailure({
      name: 'fixture mode rejects copied artifacts outside the fixture allowlist',
      message: 'Fixture mode accepted copied bytes from an untrusted path.',
      args: [obfImporterPath, '--fixture', copiedObfPath, resolve(outDir, 'escaped-fixture.json')],
      pattern: /only accepts real files under scripts\/phase4\/fixtures/,
    }) || failed;

  const candidateOutputPath = resolve(outDir, 'obf-candidate.json');
  const candidate = runImporter([
    obfImporterPath,
    '--candidate',
    copiedObfPath,
    candidateOutputPath,
  ]);
  const candidateManifest =
    candidate.status === 0 ? JSON.parse(readFileSync(candidateOutputPath, 'utf8')) : null;
  const sourceTreeDirty = relevantSourceTreeStatus().length > 0;
  if (sourceTreeDirty) {
    if (
      candidate.status === 0 ||
      !/requires committed catalog policy\/transformer\/release bytes/.test(output(candidate))
    ) {
      failed = true;
      console.error('FAIL candidate mode did not reject a dirty source tree.');
      console.error(output(candidate));
    } else {
      console.log('OK candidate mode rejects review hashes from a dirty source tree');
    }
  } else if (
    candidate.status !== 0 ||
    candidateManifest?.status !== 'candidate_transform_not_approved' ||
    candidateManifest?.importMode !== 'candidate_hash_only' ||
    candidateManifest?.sourceApproval !== null ||
    !hasExactTransformedPayloadContract(candidateManifest) ||
    !/^[0-9a-f]{64}$/i.test(candidateManifest?.transformedPayloadSha256 ?? '') ||
    !/^[0-9a-f]{64}$/i.test(candidateManifest?.transformerCandidate?.sha256 ?? '')
  ) {
    failed = true;
    console.error('FAIL clean-tree candidate mode did not emit a bounded non-promotable digest.');
    console.error(output(candidate));
  } else {
    console.log('OK clean-tree candidate mode emits review hashes but remains non-promotable');
  }

  failed =
    !expectFailure({
      name: 'fixture output cannot traverse outside approved evidence roots',
      message: 'Fixture mode accepted an output outside its approved evidence roots.',
      args: [
        obfImporterPath,
        '--fixture',
        obfFixturePath,
        resolve(root, 'artifacts', 'must-not-exist.json'),
      ],
      pattern: /Output must stay under docs\/phase-4\/generated or artifacts\/phase4/,
    }) || failed;

  failed =
    !expectFailure({
      name: 'OBF production import requires an approval manifest',
      message: 'Production mode accepted an artifact without an approval manifest.',
      args: [
        obfImporterPath,
        '--production',
        copiedObfPath,
        resolve(outDir, 'unapproved-obf.json'),
      ],
      pattern: /requires --approval-manifest/,
    }) || failed;

  failed =
    !expectFailure({
      name: 'pending OBF template and copied fixture bytes cannot authorize production',
      message: 'A checked-in template or known fixture bytes authorized an OBF transform.',
      args: [
        obfImporterPath,
        '--production',
        copiedObfPath,
        resolve(outDir, 'template-authorized-obf.json'),
        '--approval-manifest',
        obfTemplatePath,
      ],
      pattern:
        /Catalog build-source commit must|Production source approval is invalid:[\s\S]*(known fixture bytes|trust registry is not active|release scope)/i,
    }) || failed;

  const copiedCosingPath = resolve(outDir, 'copied-cosing.csv');
  writeFileSync(copiedCosingPath, readFileSync(cosingFixturePath), { flag: 'wx' });
  failed =
    !expectFailure({
      name: 'legacy COSING_IMPORT_APPROVED cannot authorize production',
      message: 'The retired environment flag bypassed the approval manifest.',
      args: [
        cosingImporterPath,
        '--production',
        copiedCosingPath,
        resolve(outDir, 'legacy-authorized-cosing.json'),
      ],
      env: { COSING_IMPORT_APPROVED: 'true' },
      pattern: /requires --approval-manifest/,
    }) || failed;

  failed =
    !expectFailure({
      name: 'pending CosIng template and copied fixture bytes cannot authorize production',
      message: 'A checked-in template or known fixture bytes authorized a CosIng transform.',
      args: [
        cosingImporterPath,
        '--production',
        copiedCosingPath,
        resolve(outDir, 'template-authorized-cosing.json'),
        '--approval-manifest',
        cosingTemplatePath,
      ],
      pattern:
        /Catalog build-source commit must|Production source approval is invalid:[\s\S]*(known fixture bytes|trust registry is not active|release scope)/i,
    }) || failed;

  const obfLines = readFileSync(obfFixturePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const duplicateObfPath = resolve(outDir, 'duplicate-obf.jsonl');
  writeFileSync(duplicateObfPath, `${obfLines[0]}\n${obfLines[0]}\n`, { flag: 'wx' });
  failed =
    !expectFailure({
      name: 'OBF transform rejects duplicate normalized barcodes before evidence output',
      message: 'Duplicate OBF identifiers were accepted.',
      args: [
        obfImporterPath,
        '--candidate',
        duplicateObfPath,
        resolve(outDir, 'duplicate-obf-output.json'),
      ],
      pattern: /duplicate barcode/,
    }) || failed;

  const duplicateKeyObfPath = resolve(outDir, 'duplicate-key-obf.jsonl');
  writeFileSync(
    duplicateKeyObfPath,
    `${obfLines[0].replace('{"code":', '{"code":"9999999999999","code":')}\n`,
    { flag: 'wx' },
  );
  failed =
    !expectFailure({
      name: 'OBF JSONL parser rejects duplicate keys before JSON.parse canonicalization',
      message: 'An OBF record with a shadowed duplicate key was accepted.',
      args: [
        obfImporterPath,
        '--candidate',
        duplicateKeyObfPath,
        resolve(outDir, 'duplicate-key-obf-output.json'),
      ],
      pattern: /duplicate JSON key code/,
    }) || failed;

  const cosingLines = readFileSync(cosingFixturePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const duplicateCosingPath = resolve(outDir, 'duplicate-cosing.csv');
  writeFileSync(duplicateCosingPath, `${cosingLines[0]}\n${cosingLines[1]}\n${cosingLines[1]}\n`, {
    flag: 'wx',
  });
  failed =
    !expectFailure({
      name: 'CosIng transform rejects duplicate INCI/source identifiers',
      message: 'Duplicate CosIng identifiers were accepted.',
      args: [
        cosingImporterPath,
        '--candidate',
        duplicateCosingPath,
        resolve(outDir, 'duplicate-cosing-output.json'),
      ],
      pattern: /duplicate INCI name/,
    }) || failed;

  const invalidStatusCosingPath = resolve(outDir, 'invalid-status-cosing.csv');
  writeFileSync(
    invalidStatusCosingPath,
    `${cosingLines[0]}\n${cosingLines[1].replace(',active,', ',unknown,')}\n`,
    { flag: 'wx' },
  );
  failed =
    !expectFailure({
      name: 'CosIng transform rejects unapproved record status',
      message: 'An unapproved CosIng record status was accepted.',
      args: [
        cosingImporterPath,
        '--candidate',
        invalidStatusCosingPath,
        resolve(outDir, 'invalid-status-cosing-output.json'),
      ],
      pattern: /record_status is not approved/,
    }) || failed;

  const malformedQuoteCosingPath = resolve(outDir, 'malformed-quote-cosing.csv');
  writeFileSync(
    malformedQuoteCosingPath,
    `${cosingLines[0]}\n"NIACINAMIDE"evil,Niacinamide,98-92-0,202-713-4,,Nicotinamide,COSING-1,active,EU_2025_1175\n`,
    { flag: 'wx' },
  );
  failed =
    !expectFailure({
      name: 'CosIng CSV parser rejects content after a closing quote',
      message: 'Malformed quoted CSV content was concatenated and accepted.',
      args: [
        cosingImporterPath,
        '--candidate',
        malformedQuoteCosingPath,
        resolve(outDir, 'malformed-quote-output.json'),
      ],
      pattern: /unexpected content after a closing quote/,
    }) || failed;

  if (failed) process.exitCode = 1;
} finally {
  rmSync(outDir, { force: true, recursive: true });
}
