#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import {
  buildCatalogCoverageQualityReport,
  readCatalogCurationInput,
  trustedRootFromEnvironment,
  writeCatalogCurationJson,
} from './catalog-curation-contract.mjs';

export const CATALOG_COVERAGE_REPORT_USAGE = `Usage:
  # Phase 1: validate and authorize the database activation plan (never emits clear)
  node scripts/phase4/catalog-coverage-quality-report.mjs \\
    --envelope <artifacts/phase4/catalog-curation-envelope.<release-id>.<digest>.json> \\
    --preactivation \\
    --trust-registry <workspace JSON path> \\
    --output <artifacts/phase4/catalog-coverage-quality-report.<release-id>.<digest>.json>

  # Phase 2: validate independently signed live database release/readback (may emit clear)
  node scripts/phase4/catalog-coverage-quality-report.mjs \\
    --envelope <artifacts/phase4/catalog-curation-envelope.<release-id>.<digest>.json> \\
    --database-readback <workspace signed database-readback JSON path> \\
    --trust-registry <workspace JSON path> \\
    --output <artifacts/phase4/catalog-coverage-quality-report.<release-id>.<digest>.json>

Required environment (all four, externally pinned CAT-01 trust root):
  CATALOG_TRUST_ROOT_KEY_ID
  CATALOG_TRUST_ROOT_PUBLIC_KEY_SPKI_BASE64
  CATALOG_TRUST_REGISTRY_EPOCH
  CATALOG_TRUST_REGISTRY_SHA256

There are no positional inputs or defaults. The report revalidates every signature, lineage,
privacy, independently signed holdout access/evaluation, participant-level marginal Wilson,
HMAC/suppression/overlap, curation, replay, atomic database-release, and current-serving digest. Output is
no-clobber under artifacts/phase4. --preactivation and --database-readback are mutually exclusive;
missing/both modes fail. Preactivation can only emit approved_for_activation. Final clear is explicitly
point-in-time as of the signed readback and cannot imply immunity to later retirement or withdrawal.
Exit codes: 0 requested phase passed, 2 valid evidence but phase gates blocked, 1 invalid evidence.`;

export function buildCatalogCoverageQualityReportFromFiles(
  { phase, envelopePath, databaseReadbackPath, trustRegistryPath, outputPath },
  { root = process.cwd(), env = process.env } = {},
) {
  const envelope = readCatalogCurationInput(envelopePath, 'CAT-03 curation envelope', root);
  const databaseReadback =
    phase === 'final'
      ? readCatalogCurationInput(databaseReadbackPath, 'CAT-03 signed database readback', root)
      : null;
  const trustRegistry = readCatalogCurationInput(trustRegistryPath, 'CAT-01 trust registry', root);
  const report = buildCatalogCoverageQualityReport(envelope.value, {
    trustRegistry: trustRegistry.value,
    trustRegistryArtifactSha256: trustRegistry.sha256,
    trustedRoot: trustedRootFromEnvironment(env),
    databaseReadback: databaseReadback?.value,
  });
  const writtenPath = writeCatalogCurationJson(
    outputPath,
    report,
    [envelope.path, ...(databaseReadback ? [databaseReadback.path] : []), trustRegistry.path],
    root,
  );
  return { report, writtenPath };
}

export function parseCatalogCoverageReportArgs(argv) {
  const valuedFlags = new Set([
    '--envelope',
    '--database-readback',
    '--trust-registry',
    '--output',
  ]);
  const args = {};
  let preactivation = false;
  for (let index = 0; index < argv.length; ) {
    const flag = argv[index];
    if (flag === '--preactivation') {
      if (preactivation) throw new Error('CAT-03 report CLI flag --preactivation is duplicated.');
      preactivation = true;
      index += 1;
      continue;
    }
    const value = argv[index + 1];
    if (
      !valuedFlags.has(flag) ||
      typeof value !== 'string' ||
      value.length === 0 ||
      value.startsWith('--') ||
      Object.hasOwn(args, flag)
    ) {
      throw new Error(
        'CAT-03 report CLI received an unknown, duplicate, positional, or valueless argument.',
      );
    }
    args[flag] = value;
    index += 2;
  }
  for (const flag of ['--envelope', '--trust-registry', '--output']) {
    if (!Object.hasOwn(args, flag))
      throw new Error(`CAT-03 report CLI is missing required flag ${flag}.`);
  }
  const hasReadback = Object.hasOwn(args, '--database-readback');
  if (preactivation === hasReadback) {
    throw new Error(
      'CAT-03 report CLI requires exactly one mode: --preactivation or --database-readback <path>.',
    );
  }
  return {
    phase: preactivation ? 'preactivation' : 'final',
    envelopePath: args['--envelope'],
    databaseReadbackPath: args['--database-readback'] ?? null,
    trustRegistryPath: args['--trust-registry'],
    outputPath: args['--output'],
  };
}

async function main() {
  if (process.argv.slice(2).length === 1 && ['--help', '-h'].includes(process.argv.slice(2)[0])) {
    console.log(CATALOG_COVERAGE_REPORT_USAGE);
    return;
  }
  const options = parseCatalogCoverageReportArgs(process.argv.slice(2));
  const { report, writtenPath } = buildCatalogCoverageQualityReportFromFiles(options);
  console.log(`Wrote privacy-minimized CAT-03 quality report ${writtenPath}`);
  console.log(
    `Status ${report.status}; gates ${report.gates.length}; blockers ${report.blockerCodes.length}.`,
  );
  if (report.status === 'blocked') process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
