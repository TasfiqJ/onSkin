#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import {
  buildCatalogCurationEnvelope,
  parseExactCliArgs,
  readCatalogCurationInput,
  trustedRootFromEnvironment,
  writeCatalogCurationJson,
} from './catalog-curation-contract.mjs';

export const CATALOG_CURATION_ENVELOPE_USAGE = `Usage:
  node scripts/phase4/build-catalog-curation-envelope.mjs \\
    --target-policy <workspace JSON path> \\
    --cat02-membership-proof <workspace JSON path> \\
    --corpus <workspace JSON path> \\
    --review <workspace JSON path> \\
    --trust-registry <workspace JSON path> \\
    --generated-at <strict UTC RFC3339 instant> \\
    --output <artifacts/phase4/catalog-curation-envelope.<release-id>.<digest>.json>

Required environment (all four, externally pinned CAT-01 trust root):
  CATALOG_TRUST_ROOT_KEY_ID
  CATALOG_TRUST_ROOT_PUBLIC_KEY_SPKI_BASE64
  CATALOG_TRUST_REGISTRY_EPOCH
  CATALOG_TRUST_REGISTRY_SHA256

There are no positional inputs or defaults. Inputs must be real non-symlink files inside the
workspace. Output must be a new file under artifacts/phase4 and is never overwritten.`;

export function buildCatalogCurationEnvelopeFromFiles(
  {
    targetPolicyPath,
    cat02MembershipProofPath,
    betaShelfCorpusPath,
    curationReviewPath,
    trustRegistryPath,
    outputPath,
    generatedAt,
  },
  { root = process.cwd(), env = process.env } = {},
) {
  const targetPolicy = readCatalogCurationInput(targetPolicyPath, 'CAT-03 target policy', root);
  const cat02MembershipProof = readCatalogCurationInput(
    cat02MembershipProofPath,
    'CAT-03 signed CAT-02 membership proof',
    root,
  );
  const betaShelfCorpus = readCatalogCurationInput(
    betaShelfCorpusPath,
    'CAT-03 beta shelf corpus',
    root,
  );
  const curationReview = readCatalogCurationInput(
    curationReviewPath,
    'CAT-03 curation review',
    root,
  );
  const trustRegistry = readCatalogCurationInput(trustRegistryPath, 'CAT-01 trust registry', root);
  const envelope = buildCatalogCurationEnvelope({
    targetPolicy: targetPolicy.value,
    cat02MembershipProof: cat02MembershipProof.value,
    betaShelfCorpus: betaShelfCorpus.value,
    curationReview: curationReview.value,
    trustRegistry: trustRegistry.value,
    trustRegistryArtifactSha256: trustRegistry.sha256,
    trustedRoot: trustedRootFromEnvironment(env),
    generatedAt,
  });
  const inputPaths = [
    targetPolicy.path,
    cat02MembershipProof.path,
    betaShelfCorpus.path,
    curationReview.path,
    trustRegistry.path,
  ];
  const writtenPath = writeCatalogCurationJson(outputPath, envelope, inputPaths, root);
  return { envelope, writtenPath };
}

export function parseCatalogCurationEnvelopeArgs(argv) {
  const args = parseExactCliArgs(argv, [
    '--target-policy',
    '--cat02-membership-proof',
    '--corpus',
    '--review',
    '--trust-registry',
    '--generated-at',
    '--output',
  ]);
  return {
    targetPolicyPath: args['--target-policy'],
    cat02MembershipProofPath: args['--cat02-membership-proof'],
    betaShelfCorpusPath: args['--corpus'],
    curationReviewPath: args['--review'],
    trustRegistryPath: args['--trust-registry'],
    generatedAt: args['--generated-at'],
    outputPath: args['--output'],
  };
}

async function main() {
  if (process.argv.slice(2).length === 1 && ['--help', '-h'].includes(process.argv.slice(2)[0])) {
    console.log(CATALOG_CURATION_ENVELOPE_USAGE);
    return;
  }
  const options = parseCatalogCurationEnvelopeArgs(process.argv.slice(2));
  const { envelope, writtenPath } = buildCatalogCurationEnvelopeFromFiles(options);
  console.log(`Wrote immutable CAT-03 envelope ${writtenPath}`);
  console.log(
    `Replay key ${envelope.replayKeySha256}; signed holdout clear ${String(
      envelope.qualityAtBuild.signedHoldoutTargetsClear,
    )}; activation ${envelope.qualityAtBuild.activationDecision}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
