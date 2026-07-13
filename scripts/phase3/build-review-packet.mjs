#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { command, gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';
import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  loadLaunchContract,
} from '../launch/contract.mjs';

const root = process.cwd();
const launchContract = loadLaunchContract(root);
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
const packetOutDir = process.env.PHASE3_REVIEW_PACKET_OUT_DIR ?? 'docs/phase-3/generated';
const generatedDir = resolve(root, packetOutDir);
const signoffDir = 'docs/phase-3/signoffs';
const signoffPaths = existsSync(resolve(root, signoffDir))
  ? readdirSync(resolve(root, signoffDir), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => `${signoffDir}/${entry.name}`)
      .sort((a, b) => a.localeCompare(b))
  : [];
const packetOutputPaths = [
  `${packetOutDir}/review-packet-manifest.json`,
  `${packetOutDir}/review-packet.md`,
].map((path) => path.replace(/\\/g, '/'));

const packets = {
  packetContract: [
    'package.json',
    'docs/hugeToDo/launch-contract.json',
    'scripts/launch/contract.mjs',
    'scripts/phase3/build-review-packet.mjs',
    'scripts/phase3/build-review-worklist.mjs',
    'scripts/phase3/build-review-operator-queue.mjs',
    'scripts/phase3/create-review-signoff-template.mjs',
    'scripts/phase3/review-signoff-template-smoke.mjs',
    'scripts/phase3/audit-copy.mjs',
    'scripts/phase3/check-production-release.mjs',
    'scripts/phase3/check-production-release-smoke.mjs',
    'apps/mobile/phase3-review-evidence.js',
    'apps/mobile/src/lib/appConfig.test.ts',
    'apps/mobile/app.config.js',
    'scripts/phase9/lib.mjs',
    'docs/phase-3/review-packet-index.md',
    'docs/phase-3/review-signoff.schema.json',
    'docs/phase-3/review-signoff.template.json',
    'docs/phase-3/signoffs/README.md',
  ],
  reviewSignoffs: signoffPaths,
  legalRegulatory: [
    'docs/phase-3/legal-regulatory-review-log.md',
    'docs/phase-3/regulatory-positioning-memo.md',
    'docs/phase-3/launch-claims-vocabulary.md',
    'docs/phase-3/data-inventory.md',
    'docs/phase-3/consent-matrix.md',
    'docs/phase-3/store-metadata-review.md',
    'docs/phase-3/app-review-notes.md',
    ...(androidReleaseRequired ? ['docs/phase-3/google-play-health-declaration-notes.md'] : []),
    'apps/mobile/src/features/onboarding/consentCopy.ts',
    'apps/mobile/src/lib/legal/disclaimer.ts',
    'apps/mobile/src/lib/legal/policyLinks.ts',
    'apps/mobile/src/lib/legal/storeMetadata.ts',
  ],
  clinical: [
    'docs/phase-3/clinical-review-log.md',
    'docs/phase-3/generated/review-worklist.json',
    'docs/phase-3/generated/review-worklist.md',
    'docs/phase-3/generated/review-operator-queue.json',
    'docs/phase-3/generated/review-operator-queue.md',
    'apps/mobile/src/features/intelligence/rules.ts',
    'apps/mobile/src/features/intelligence/pao.ts',
    'apps/mobile/src/features/recommendations/catalog.ts',
    'apps/mobile/src/features/community/notes.ts',
    'apps/mobile/src/features/ask/answer.ts',
    'apps/mobile/src/features/ask/copy.ts',
  ],
  cosmeticChemistry: [
    'docs/phase-3/cosmetic-chemistry-review-log.md',
    'docs/phase-3/generated/review-worklist.json',
    'docs/phase-3/generated/review-worklist.md',
    'docs/phase-3/generated/review-operator-queue.json',
    'docs/phase-3/generated/review-operator-queue.md',
    'apps/mobile/src/features/intelligence/tags.ts',
    'apps/mobile/src/features/intelligence/pao.ts',
    'apps/mobile/src/features/recommendations/catalog.ts',
    'apps/mobile/src/features/commerce/stacks.ts',
    'apps/mobile/src/features/shelf/categories.ts',
  ],
  ipFto: [
    'docs/phase-3/ip-fto-review-log.md',
    'docs/phase-3/quiz-fto-summary.md',
    'apps/mobile/src/features/onboarding/quiz.ts',
    'apps/mobile/src/app/onboarding/quiz.tsx',
    'apps/mobile/src/app/onboarding/reveal.tsx',
  ],
  privacyPlatform: [
    'docs/phase-3/privacy-security-review-log.md',
    'docs/store-privacy-inventory.md',
    'docs/phase-3/data-inventory.md',
    'docs/phase-3/consent-matrix.md',
    'apps/mobile/src/features/settings/actions.ts',
    'apps/mobile/src/features/settings/localDeviceExport.ts',
    'apps/mobile/src/features/settings/localDeviceExport.test.ts',
    'apps/mobile/src/lib/storage/privateKV.ts',
    'apps/mobile/src/lib/storage/privateKV.test.ts',
    'apps/mobile/src/lib/supabase/largeSecureStore.ts',
    'apps/mobile/src/lib/supabase/largeSecureStore.test.ts',
    'apps/mobile/src/lib/applock/AppLockProvider.tsx',
    'apps/mobile/src/lib/applock/authenticate.ts',
    'apps/mobile/src/lib/applock/authenticate.test.ts',
    'apps/mobile/src/lib/applock/singleFlight.ts',
    'apps/mobile/src/lib/applock/singleFlight.test.ts',
    'apps/mobile/src/lib/auth/accountGeneration.ts',
    'apps/mobile/src/lib/auth/accountGeneration.test.ts',
    'apps/mobile/src/lib/auth/localAccountIsolation.ts',
    'apps/mobile/src/lib/auth/localAccountIsolation.test.ts',
    'apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx',
    'apps/mobile/src/features/photos/PhotoStorageGate.tsx',
    'apps/mobile/src/features/photos/encryptedStorage.ts',
    'apps/mobile/src/features/photos/encryptedStorage.test.ts',
    'apps/mobile/src/features/photos/usePhotos.ts',
    'apps/mobile/src/features/photos/store.ts',
    'apps/mobile/src/features/photos/store.test.ts',
    'apps/mobile/src/features/photos/progressRoutes.test.ts',
    'supabase/functions/account-deletion/index.ts',
    'supabase/functions/account-deletion/photoStorageCleanup.ts',
    'supabase/functions/account-deletion/photoStorageCleanup.test.ts',
    'supabase/functions/_shared/storagePath.ts',
    'supabase/functions/_shared/storagePath.test.ts',
    'supabase/functions/data-export/index.ts',
    'supabase/functions/data-export/exportCore.ts',
    'supabase/functions/data-export/exportCore.test.ts',
    'supabase/functions/data-export/exportRegistry.ts',
    'supabase/functions/data-export/exportRegistry.test.ts',
    'supabase/functions/consent-withdrawal/index.ts',
    'supabase/migrations/20260615000027_phase6_payments.sql',
    'scripts/phase9/data-rights-smoke.mjs',
    'scripts/phase2/check-env.mjs',
    'scripts/phase3/audit-copy.mjs',
  ],
};

function fileRecord(packet, relPath) {
  const abs = resolve(root, relPath);
  if (!existsSync(abs)) {
    return { packet, path: relPath, exists: false };
  }
  const bytes = readFileSync(abs);
  return {
    packet,
    path: relPath,
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function gitStatusExcludingGeneratedPacket() {
  return gitStatusExcludingGeneratedEvidence(packetOutputPaths);
}

const files = Object.entries(packets).flatMap(([packet, paths]) =>
  paths.map((relPath) => fileRecord(packet, relPath)),
);
const warnings = [];
let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedPacket();
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Phase 3 review packet generated with a dirty Git worktree; do not use it as final reviewer signoff evidence.',
  );
}
const manifest = {
  generatedAt: new Date().toISOString(),
  launchContract: launchContractSnapshot(launchContract),
  purpose:
    'Phase 3 legal, clinical, cosmetic chemistry, IP/FTO, privacy, and platform review packet.',
  gitSha,
  gitStatus,
  files,
  warnings,
};

mkdirSync(generatedDir, { recursive: true });

const manifestPath = join(generatedDir, 'review-packet-manifest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const markdownPath = join(generatedDir, 'review-packet.md');
const missing = files.filter((file) => !file.exists);
const rows = files
  .map((file) => {
    if (!file.exists) return `| ${file.packet} | ${file.path} | missing |  | |`;
    return `| ${file.packet} | ${file.path} | present | ${file.bytes} | ${file.sha256} |`;
  })
  .join('\n');

writeFileSync(
  markdownPath,
  [
    '# Generated Phase 3 Review Packet',
    '',
    `Generated at: ${manifest.generatedAt}`,
    `Git SHA: ${manifest.gitSha}`,
    `Git status: ${manifest.gitStatus ? 'DIRTY' : 'clean'}`,
    '',
    'This file is generated by `npm run phase3:review-packet`. Reviewers should sign off against these exact file hashes.',
    '',
    missing.length > 0
      ? `Missing files: ${missing.map((file) => file.path).join(', ')}`
      : 'Missing files: none.',
    '',
    '| Packet | Path | Status | Bytes | SHA-256 |',
    '| --- | --- | --- | --- | --- |',
    rows,
    '',
    '## Warnings',
    '',
    warnings.length > 0 ? warnings.map((warning) => `- ${warning}`).join('\n') : '- none',
    '',
  ].join('\n'),
);

console.log(`Wrote ${relative(root, manifestPath).replaceAll('\\', '/')}`);
console.log(`Wrote ${relative(root, markdownPath).replaceAll('\\', '/')}`);
