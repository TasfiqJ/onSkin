import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextDecoder } from 'node:util';

import {
  hashStableRootBoundWorkingFile,
  readStableRootBoundWorkingFile,
  runTrustedGit,
} from '../phase9/release-qa-integrity.mjs';
import { launchContractSnapshot, validateLaunchContract } from './contract.mjs';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/u;
const GIT_OBJECT_ID = /^[0-9a-f]{40,64}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const RELEASE_CANDIDATE_DIR = /^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const LEDGER_KIND = 'layerwell_governed_evidence_chain';
const LEDGER_FILE_NAME = 'evidence-chain.json';
const MAX_HISTORY_COMMITS = 4096;
const MAX_GIT_METADATA_BYTES = 64 * 1024 * 1024;

export const GOVERNED_EVIDENCE_CHAIN_SCHEMA_VERSION = 2;
export const GOVERNED_PUBLICATION_POLICY_VERSION = 1;
export const GOVERNED_PUBLICATION_POLICY_ID = 'ios-all-features-generated-publication-v1';
export const GOVERNED_LAUNCH_CONTRACT_PATH = 'docs/hugeToDo/launch-contract.json';
export const GOVERNED_EVIDENCE_LEDGER_MAX_BYTES = 1024 * 1024;
export const GOVERNED_EVIDENCE_ENTRY_MAX_BYTES = 64 * 1024 * 1024;
export const GOVERNED_EVIDENCE_AGGREGATE_MAX_BYTES = 512 * 1024 * 1024;
export const GOVERNED_EVIDENCE_MAX_ENTRIES = 20_000;

export const GOVERNED_DOWNSTREAM_GENERATED_PATHS = Object.freeze([
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/generated/generated-packet-status-audit.json',
  'docs/generated/generated-packet-status-audit.md',
  'docs/generated/device-support-policy-audit.json',
  'docs/generated/device-support-policy-audit.md',
  'docs/generated/performance-readiness-audit.json',
  'docs/generated/performance-readiness-audit.md',
  'docs/generated/readiness-status-audit.json',
  'docs/generated/readiness-status-audit.md',
  'docs/generated/source-packet-audit.json',
  'docs/generated/source-packet-audit.md',
  'docs/generated/tas-todo-audit.json',
  'docs/generated/tas-todo-audit.md',
  'docs/phase-3/generated/review-packet-manifest.json',
  'docs/phase-3/generated/review-packet.md',
  'docs/phase-3/generated/review-operator-queue.json',
  'docs/phase-3/generated/review-operator-queue.md',
  'docs/phase-3/generated/review-worklist.json',
  'docs/phase-3/generated/review-worklist.md',
  'docs/phase-4/generated/beta-coverage-report.json',
  'docs/phase-4/generated/beta-coverage-report.md',
  'docs/phase-4/generated/catalog-qa-report.json',
  'docs/phase-4/generated/catalog-qa-report.md',
  'docs/phase-4/generated/cosing-catalog-qa-report.json',
  'docs/phase-4/generated/cosing-catalog-qa-report.md',
  'docs/phase-4/generated/cosing-fixture-import.json',
  'docs/phase-4/generated/obf-fixture-import.json',
  'docs/phase-4/generated/source-worklist.json',
  'docs/phase-4/generated/source-worklist.md',
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-5/generated/device-qa-packet.md',
  'docs/phase-6/generated/payments-qa-packet.json',
  'docs/phase-6/generated/payments-qa-packet.md',
  'docs/phase-7/generated/core-loop-qa-packet.json',
  'docs/phase-7/generated/core-loop-qa-packet.md',
  'docs/phase-8/generated/growth-store-qa-packet.json',
  'docs/phase-8/generated/growth-store-qa-packet.md',
  'docs/phase-9/generated/dependency-inventory.json',
  'docs/phase-9/generated/dependency-inventory.md',
  'docs/phase-9/generated/ios-privacy-source-audit.json',
  'docs/phase-9/generated/ios-privacy-source-audit.md',
  'docs/phase-9/generated/live-catalog-rate-limit.json',
  'docs/phase-9/generated/live-catalog-rate-limit.md',
  'docs/phase-9/generated/live-consent-withdrawal.json',
  'docs/phase-9/generated/live-consent-withdrawal.md',
  'docs/phase-9/generated/live-data-rights.json',
  'docs/phase-9/generated/live-data-rights.md',
  'docs/phase-9/generated/live-edge-auth.json',
  'docs/phase-9/generated/live-edge-auth.md',
  'docs/phase-9/generated/live-order-report-poll.json',
  'docs/phase-9/generated/live-order-report-poll.md',
  'docs/phase-9/generated/live-public-forms.json',
  'docs/phase-9/generated/live-public-forms.md',
  'docs/phase-9/generated/live-revenuecat-webhook.json',
  'docs/phase-9/generated/live-revenuecat-webhook.md',
  'docs/phase-9/generated/live-supabase-adversarial.json',
  'docs/phase-9/generated/live-supabase-adversarial.md',
  'docs/phase-9/generated/release-engineering-qa-packet.json',
  'docs/phase-9/generated/release-engineering-qa-packet.md',
  'docs/phase-9/generated/store-build-inspection.json',
  'docs/phase-10/generated/closed-beta-packet.json',
  'docs/phase-10/generated/closed-beta-packet.md',
  'docs/phase-10/generated/support-handoff-packet.json',
  'docs/phase-10/generated/support-handoff-packet.md',
  'docs/phase-11/generated/public-launch-packet.json',
  'docs/phase-11/generated/public-launch-packet.md',
]);

function buildGovernedDownstreamPublicationUnits(paths) {
  const inventory = new Set(paths);
  const specialMarkdownByJson = new Map([
    [
      'docs/phase-3/generated/review-packet-manifest.json',
      'docs/phase-3/generated/review-packet.md',
    ],
  ]);
  const consumed = new Set();
  const units = [];
  for (const repoPath of paths) {
    if (consumed.has(repoPath)) continue;
    if (repoPath.endsWith('.md')) {
      throw new Error(`governed Markdown output has no preceding JSON publication: ${repoPath}`);
    }
    if (!repoPath.endsWith('.json')) {
      throw new Error(`governed downstream output is not JSON or Markdown: ${repoPath}`);
    }
    const markdownPath =
      specialMarkdownByJson.get(repoPath) ?? `${repoPath.slice(0, -'.json'.length)}.md`;
    const unitPaths = inventory.has(markdownPath) ? [repoPath, markdownPath] : [repoPath];
    for (const path of unitPaths) consumed.add(path);
    units.push(
      Object.freeze({
        id: repoPath.slice(0, -'.json'.length),
        kind: unitPaths.length === 2 ? 'json_markdown_pair' : 'json_singleton',
        paths: Object.freeze(unitPaths),
      }),
    );
  }
  if (consumed.size !== inventory.size) {
    throw new Error('governed downstream publication units do not cover the exact path inventory');
  }
  return Object.freeze(units);
}

export const GOVERNED_DOWNSTREAM_PUBLICATION_UNITS = buildGovernedDownstreamPublicationUnits(
  GOVERNED_DOWNSTREAM_GENERATED_PATHS,
);

export const GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS = Object.freeze(
  [
    'docs/generated/performance-readiness-audit',
    'docs/generated/source-packet-audit',
    'docs/generated/tas-todo-audit',
    'docs/phase-3/generated/review-operator-queue',
    'docs/phase-3/generated/review-packet-manifest',
    'docs/phase-3/generated/review-worklist',
    'docs/phase-4/generated/catalog-qa-report',
    'docs/phase-4/generated/cosing-catalog-qa-report',
    'docs/phase-4/generated/cosing-fixture-import',
    'docs/phase-4/generated/obf-fixture-import',
    'docs/phase-4/generated/source-worklist',
    'docs/phase-9/generated/ios-privacy-source-audit',
  ].sort(utf8Compare),
);

export const GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS = Object.freeze(
  [
    'docs/e2e/generated/human-e2e-manifest',
    'docs/generated/generated-packet-status-audit',
    'docs/generated/device-support-policy-audit',
    'docs/phase-4/generated/beta-coverage-report',
    'docs/phase-5/generated/device-qa-packet',
    'docs/phase-6/generated/payments-qa-packet',
    'docs/phase-7/generated/core-loop-qa-packet',
    'docs/phase-8/generated/growth-store-qa-packet',
    'docs/phase-9/generated/dependency-inventory',
    'docs/phase-9/generated/live-catalog-rate-limit',
    'docs/phase-9/generated/live-consent-withdrawal',
    'docs/phase-9/generated/live-data-rights',
    'docs/phase-9/generated/live-edge-auth',
    'docs/phase-9/generated/live-order-report-poll',
    'docs/phase-9/generated/live-public-forms',
    'docs/phase-9/generated/live-revenuecat-webhook',
    'docs/phase-9/generated/live-supabase-adversarial',
    'docs/phase-9/generated/release-engineering-qa-packet',
    'docs/phase-9/generated/store-build-inspection',
    'docs/phase-10/generated/closed-beta-packet',
    'docs/phase-10/generated/support-handoff-packet',
    'docs/phase-11/generated/public-launch-packet',
  ].sort(utf8Compare),
);

export const GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID = 'docs/generated/readiness-status-audit';

export const GOVERNED_POST_E_PUBLICATION_DAG_EDGES = Object.freeze(
  [
    [
      'docs/e2e/generated/human-e2e-manifest',
      'docs/generated/device-support-policy-audit',
      'input_dependency',
    ],
    [
      'docs/e2e/generated/human-e2e-manifest',
      'docs/phase-5/generated/device-qa-packet',
      'input_dependency',
    ],
    [
      'docs/e2e/generated/human-e2e-manifest',
      'docs/phase-6/generated/payments-qa-packet',
      'input_dependency',
    ],
    [
      'docs/e2e/generated/human-e2e-manifest',
      'docs/phase-7/generated/core-loop-qa-packet',
      'input_dependency',
    ],
    [
      'docs/e2e/generated/human-e2e-manifest',
      'docs/phase-8/generated/growth-store-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-4/generated/beta-coverage-report',
      'docs/phase-5/generated/device-qa-packet',
      'policy_order',
    ],
    [
      'docs/phase-5/generated/device-qa-packet',
      'docs/phase-7/generated/core-loop-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-5/generated/device-qa-packet',
      'docs/phase-8/generated/growth-store-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-6/generated/payments-qa-packet',
      'docs/phase-7/generated/core-loop-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-7/generated/core-loop-qa-packet',
      'docs/phase-8/generated/growth-store-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-6/generated/payments-qa-packet',
      'docs/phase-8/generated/growth-store-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-4/generated/beta-coverage-report',
      'docs/phase-9/generated/release-engineering-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-5/generated/device-qa-packet',
      'docs/phase-9/generated/release-engineering-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-7/generated/core-loop-qa-packet',
      'docs/phase-9/generated/release-engineering-qa-packet',
      'input_dependency',
    ],
    [
      'docs/phase-9/generated/release-engineering-qa-packet',
      'docs/phase-10/generated/closed-beta-packet',
      'input_dependency',
    ],
    [
      'docs/phase-10/generated/support-handoff-packet',
      'docs/phase-10/generated/closed-beta-packet',
      'input_dependency',
    ],
    [
      'docs/phase-9/generated/release-engineering-qa-packet',
      'docs/phase-11/generated/public-launch-packet',
      'input_dependency',
    ],
    [
      'docs/phase-10/generated/support-handoff-packet',
      'docs/phase-11/generated/public-launch-packet',
      'input_dependency',
    ],
    [
      'docs/phase-10/generated/closed-beta-packet',
      'docs/phase-11/generated/public-launch-packet',
      'input_dependency',
    ],
    [
      'docs/phase-9/generated/release-engineering-qa-packet',
      'docs/phase-10/generated/support-handoff-packet',
      'policy_order',
    ],
    ...[
      'docs/generated/device-support-policy-audit',
      'docs/phase-8/generated/growth-store-qa-packet',
      'docs/phase-9/generated/dependency-inventory',
      'docs/phase-9/generated/live-catalog-rate-limit',
      'docs/phase-9/generated/live-consent-withdrawal',
      'docs/phase-9/generated/live-data-rights',
      'docs/phase-9/generated/live-edge-auth',
      'docs/phase-9/generated/live-order-report-poll',
      'docs/phase-9/generated/live-public-forms',
      'docs/phase-9/generated/live-revenuecat-webhook',
      'docs/phase-9/generated/live-supabase-adversarial',
      'docs/phase-9/generated/store-build-inspection',
    ].map((id) => [id, 'docs/phase-9/generated/release-engineering-qa-packet', 'policy_order']),
    ...GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.filter(
      (id) =>
        ![
          'docs/e2e/generated/human-e2e-manifest',
          'docs/generated/device-support-policy-audit',
          'docs/generated/generated-packet-status-audit',
        ].includes(id),
    ).map((id) => [id, 'docs/generated/generated-packet-status-audit', 'input_dependency']),
    ...['docs/e2e/generated/human-e2e-manifest', 'docs/generated/device-support-policy-audit'].map(
      (id) => [id, 'docs/generated/generated-packet-status-audit', 'policy_order'],
    ),
  ]
    .map(([before, after, kind]) => Object.freeze({ before, after, kind }))
    .sort((left, right) =>
      utf8Compare(
        `${left.before}\0${left.after}\0${left.kind}`,
        `${right.before}\0${right.after}\0${right.kind}`,
      ),
    ),
);

const governedPolicyPartition = [
  ...GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
  ...GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
  GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID,
].sort(utf8Compare);
const governedUnitInventory = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.map(({ id }) => id).sort(
  utf8Compare,
);
if (!samePathSet(governedPolicyPartition, governedUnitInventory)) {
  throw new Error('governed publication policy does not exactly partition the unit inventory');
}

const GOVERNED_PUBLICATION_UNIT_BY_PATH = new Map(
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.flatMap((unit) =>
    unit.paths.map((repoPath) => [repoPath, unit]),
  ),
);

export const GOVERNED_DIRECT_EVIDENCE_ROLES = Object.freeze([
  'release-candidate',
  'phase5-widget-lifecycle',
  'phase5-native-ocr',
  'phase5-camera-lifecycle',
  'phase5-performance',
  'human-e2e',
]);

const FIXED_ROLE_ROOTS = Object.freeze({
  'human-e2e': 'test-results/human-e2e/',
  'phase5-camera-lifecycle': 'docs/phase-5/evidence/camera-lifecycle/',
  'phase5-native-ocr': 'docs/phase-5/evidence/native-ocr/',
  'phase5-performance': 'docs/phase-5/evidence/performance/',
  'phase5-widget-lifecycle': 'docs/phase-5/evidence/widget-lifecycle/',
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function utf8Compare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function exactKeys(value, expected) {
  const keys =
    value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function pathIdentity(repoPath) {
  return repoPath.normalize('NFC').toLowerCase();
}

function assertNoPathCollisions(paths, label) {
  const identities = new Map();
  for (const repoPath of paths) {
    const identity = pathIdentity(repoPath);
    const previous = identities.get(identity);
    if (previous !== undefined) {
      throw new Error(`${label} contains colliding paths: ${previous} and ${repoPath}`);
    }
    identities.set(identity, repoPath);
  }
}

export function canonicalGovernedEvidencePath(value) {
  const raw = String(value ?? '');
  if (
    !raw ||
    raw !== raw.normalize('NFC') ||
    raw.includes('\\') ||
    raw.includes('\0') ||
    raw.includes('\n') ||
    raw.includes('\r') ||
    raw.startsWith('/') ||
    raw.startsWith('./') ||
    /^[a-z]:/iu.test(raw) ||
    raw.includes(':') ||
    raw.endsWith('/') ||
    Buffer.byteLength(raw, 'utf8') > 4096
  ) {
    throw new Error('governed evidence path is not canonical');
  }
  const segments = raw.split('/');
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment !== segment.normalize('NFC') ||
        /[. ]$/u.test(segment) ||
        /[\u0000-\u001f\u007f]/u.test(segment) ||
        segment.replace(/[. ]+$/gu, '').toLowerCase() === '.git' ||
        WINDOWS_RESERVED_SEGMENT.test(segment),
    )
  ) {
    throw new Error('governed evidence path contains an unsafe segment');
  }
  return raw;
}

function validateReleaseCandidateDir(value) {
  const normalized = canonicalGovernedEvidencePath(`${value}/placeholder`).replace(
    /\/placeholder$/u,
    '',
  );
  if (!RELEASE_CANDIDATE_DIR.test(normalized) || normalized !== value) {
    throw new TypeError('releaseCandidateDir must be one strict non-template RC directory.');
  }
  return normalized;
}

export function governedEvidenceLedgerPath(releaseCandidateDir) {
  return `${validateReleaseCandidateDir(releaseCandidateDir)}/${LEDGER_FILE_NAME}`;
}

export function governedEvidenceRoleForPath(path, releaseCandidateDir) {
  const normalizedPath = canonicalGovernedEvidencePath(path);
  const normalizedReleaseCandidateDir = validateReleaseCandidateDir(releaseCandidateDir);
  const ledgerPath = `${normalizedReleaseCandidateDir}/${LEDGER_FILE_NAME}`;
  if (
    normalizedPath !== ledgerPath &&
    normalizedPath.startsWith(`${normalizedReleaseCandidateDir}/`)
  ) {
    return 'release-candidate';
  }
  for (const [role, prefix] of Object.entries(FIXED_ROLE_ROOTS)) {
    if (normalizedPath.startsWith(prefix) && normalizedPath.length > prefix.length) return role;
  }
  return null;
}

function normalizeRequiredPublicationUnitIds(
  requiredPublicationUnitIds = GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
) {
  if (
    !Array.isArray(requiredPublicationUnitIds) ||
    requiredPublicationUnitIds.length === 0 ||
    requiredPublicationUnitIds.length > GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.length
  ) {
    throw new TypeError('requiredPublicationUnitIds must be one bounded, non-empty list.');
  }
  const knownIds = new Set(GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.map(({ id }) => id));
  const normalized = requiredPublicationUnitIds.map((id) => {
    const value = canonicalGovernedEvidencePath(`${id}.json`).slice(0, -'.json'.length);
    if (value !== id || !knownIds.has(value)) {
      throw new Error(`required publication unit is unknown: ${id}`);
    }
    return value;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('requiredPublicationUnitIds contains a duplicate unit.');
  }
  return normalized.sort(utf8Compare);
}

function placeholderGovernedPublicationPolicy() {
  return {
    policyVersion: GOVERNED_PUBLICATION_POLICY_VERSION,
    policyId: GOVERNED_PUBLICATION_POLICY_ID,
    launchContract: {
      path: GOVERNED_LAUNCH_CONTRACT_PATH,
      exists: false,
      sha256: null,
      snapshot: null,
    },
    sourceSnapshotUnits: GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.map((unitId) => {
      const unit = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === unitId);
      return {
        unitId,
        files: unit.paths.map((path) => ({ path, exists: false, sha256: null })),
      };
    }),
    postEvidenceRequiredUnitIds: [...GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS],
    postEvidenceDagEdges: GOVERNED_POST_E_PUBLICATION_DAG_EDGES.map(({ before, after, kind }) => ({
      before,
      after,
      kind,
    })),
    finalReadinessUnitId: GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID,
  };
}

function normalizeGovernedPublicationPolicy(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !exactKeys(value, [
      'policyVersion',
      'policyId',
      'launchContract',
      'sourceSnapshotUnits',
      'postEvidenceRequiredUnitIds',
      'postEvidenceDagEdges',
      'finalReadinessUnitId',
    ]) ||
    value.policyVersion !== GOVERNED_PUBLICATION_POLICY_VERSION ||
    value.policyId !== GOVERNED_PUBLICATION_POLICY_ID ||
    value.finalReadinessUnitId !== GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID
  ) {
    throw new Error('governed publication policy header is invalid');
  }
  const launchContract = value.launchContract;
  if (
    launchContract === null ||
    typeof launchContract !== 'object' ||
    Array.isArray(launchContract) ||
    !exactKeys(launchContract, ['path', 'exists', 'sha256', 'snapshot']) ||
    launchContract.path !== GOVERNED_LAUNCH_CONTRACT_PATH ||
    typeof launchContract.exists !== 'boolean' ||
    (launchContract.exists
      ? !SHA256.test(String(launchContract.sha256 ?? '')) ||
        launchContract.snapshot === null ||
        typeof launchContract.snapshot !== 'object' ||
        Array.isArray(launchContract.snapshot)
      : launchContract.sha256 !== null || launchContract.snapshot !== null)
  ) {
    throw new Error('governed launch-contract binding is invalid');
  }

  const sourceSnapshotUnits = value.sourceSnapshotUnits;
  if (
    !Array.isArray(sourceSnapshotUnits) ||
    sourceSnapshotUnits.length !== GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.length
  ) {
    throw new Error('governed source-snapshot unit inventory is incomplete');
  }
  const normalizedSourceUnits = sourceSnapshotUnits.map((record) => {
    if (
      record === null ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      !exactKeys(record, ['unitId', 'files']) ||
      !GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.includes(record.unitId)
    ) {
      throw new Error('governed source-snapshot unit is invalid');
    }
    const unit = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === record.unitId);
    if (!Array.isArray(record.files) || record.files.length !== unit.paths.length) {
      throw new Error(`${record.unitId} source-snapshot file inventory is incomplete`);
    }
    const files = record.files.map((file, index) => {
      if (
        file === null ||
        typeof file !== 'object' ||
        Array.isArray(file) ||
        !exactKeys(file, ['path', 'exists', 'sha256']) ||
        file.path !== unit.paths[index] ||
        typeof file.exists !== 'boolean' ||
        (file.exists ? !SHA256.test(String(file.sha256 ?? '')) : file.sha256 !== null)
      ) {
        throw new Error(`${record.unitId} has an invalid source-snapshot file binding`);
      }
      return { path: file.path, exists: file.exists, sha256: file.sha256 };
    });
    return { unitId: record.unitId, files };
  });
  normalizedSourceUnits.sort((left, right) => utf8Compare(left.unitId, right.unitId));
  if (
    !samePathSet(
      normalizedSourceUnits.map(({ unitId }) => unitId),
      GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
    )
  ) {
    throw new Error('governed source-snapshot units are duplicated or non-canonical');
  }

  const postEvidenceRequiredUnitIds = normalizeRequiredPublicationUnitIds(
    value.postEvidenceRequiredUnitIds,
  );
  if (!samePathSet(postEvidenceRequiredUnitIds, GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS)) {
    throw new Error('governed post-E required publication inventory does not match policy');
  }
  const postEvidenceDagEdges = value.postEvidenceDagEdges;
  if (
    !Array.isArray(postEvidenceDagEdges) ||
    postEvidenceDagEdges.length !== GOVERNED_POST_E_PUBLICATION_DAG_EDGES.length
  ) {
    throw new Error('governed post-E publication DAG is incomplete');
  }
  const normalizedEdges = postEvidenceDagEdges
    .map((edge) => {
      if (
        edge === null ||
        typeof edge !== 'object' ||
        Array.isArray(edge) ||
        !exactKeys(edge, ['before', 'after', 'kind']) ||
        !GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.includes(edge.before) ||
        !GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.includes(edge.after) ||
        edge.before === edge.after ||
        !['input_dependency', 'policy_order', 'audit_order'].includes(edge.kind)
      ) {
        throw new Error('governed post-E publication DAG contains an invalid edge');
      }
      return { before: edge.before, after: edge.after, kind: edge.kind };
    })
    .sort((left, right) =>
      utf8Compare(
        `${left.before}\0${left.after}\0${left.kind}`,
        `${right.before}\0${right.after}\0${right.kind}`,
      ),
    );
  if (JSON.stringify(normalizedEdges) !== JSON.stringify(GOVERNED_POST_E_PUBLICATION_DAG_EDGES)) {
    throw new Error('governed post-E publication DAG does not match policy');
  }
  return {
    policyVersion: value.policyVersion,
    policyId: value.policyId,
    launchContract: {
      path: launchContract.path,
      exists: launchContract.exists,
      sha256: launchContract.sha256,
      snapshot: launchContract.snapshot,
    },
    sourceSnapshotUnits: normalizedSourceUnits,
    postEvidenceRequiredUnitIds,
    postEvidenceDagEdges: normalizedEdges,
    finalReadinessUnitId: value.finalReadinessUnitId,
  };
}

export function buildGovernedPublicationPolicy(value) {
  return deepFreeze(normalizeGovernedPublicationPolicy(value));
}

export function buildGovernedPublicationPolicyTemplate() {
  return deepFreeze(normalizeGovernedPublicationPolicy(placeholderGovernedPublicationPolicy()));
}

function normalizeLedger({ sourceGitSha, releaseCandidateDir, publicationPolicy, entries }) {
  if (!FULL_GIT_SHA.test(String(sourceGitSha ?? ''))) {
    throw new TypeError('sourceGitSha must be a lowercase 40-character Git SHA.');
  }
  const normalizedReleaseCandidateDir = validateReleaseCandidateDir(releaseCandidateDir);
  if (
    !Array.isArray(entries) ||
    entries.length === 0 ||
    entries.length > GOVERNED_EVIDENCE_MAX_ENTRIES
  ) {
    throw new TypeError('entries must be a bounded, non-empty evidence list.');
  }
  const normalizedEntries = entries.map((entry) => {
    if (!exactKeys(entry, ['role', 'path', 'sha256'])) {
      throw new TypeError('every evidence entry must contain exactly role, path, and sha256.');
    }
    const path = canonicalGovernedEvidencePath(entry.path);
    const expectedRole = governedEvidenceRoleForPath(path, normalizedReleaseCandidateDir);
    if (!GOVERNED_DIRECT_EVIDENCE_ROLES.includes(entry.role) || entry.role !== expectedRole) {
      throw new Error(`${path} is outside its governed direct-evidence role.`);
    }
    if (!SHA256.test(String(entry.sha256 ?? ''))) {
      throw new TypeError(`${path} has an invalid SHA-256 digest.`);
    }
    return { role: entry.role, path, sha256: entry.sha256 };
  });
  normalizedEntries.sort((left, right) => utf8Compare(left.path, right.path));
  assertNoPathCollisions(
    normalizedEntries.map(({ path }) => path),
    'evidence ledger',
  );
  if (!normalizedEntries.some(({ role }) => role === 'release-candidate')) {
    throw new Error('evidence ledger must bind at least one selected RC file.');
  }
  return {
    schemaVersion: GOVERNED_EVIDENCE_CHAIN_SCHEMA_VERSION,
    kind: LEDGER_KIND,
    sourceGitSha,
    releaseCandidateDir: normalizedReleaseCandidateDir,
    publicationPolicy: normalizeGovernedPublicationPolicy(publicationPolicy),
    entries: normalizedEntries,
  };
}

export function buildGovernedEvidenceLedger({
  sourceGitSha,
  releaseCandidateDir,
  publicationPolicy,
  entries,
}) {
  return deepFreeze(
    normalizeLedger({ sourceGitSha, releaseCandidateDir, publicationPolicy, entries }),
  );
}

export function renderGovernedEvidenceLedger(value) {
  const normalized = normalizeLedger(value);
  return Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

export function validateGovernedEvidenceChainBinding(record, audit) {
  const errors = [];
  if (audit?.status !== 'pass' || !audit.ledger) {
    errors.push('fresh governed evidence-chain audit is not pass');
    return deepFreeze({ status: 'blocked', errors });
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    errors.push('governed evidence-chain binding is not one object');
    return deepFreeze({ status: 'blocked', errors });
  }
  if (record.status !== 'pass') {
    errors.push('governed evidence-chain binding status is not pass');
  }
  const expectedLedgerSha256 = sha256(renderGovernedEvidenceLedger(audit.ledger));
  for (const [field, expected] of [
    ['sourceGitSha', audit.sourceGitSha],
    ['releaseCandidateDir', audit.releaseCandidateDir],
    ['ledgerPath', audit.ledgerPath],
    ['ledgerSha256', expectedLedgerSha256],
    ['ledgerEntryCount', audit.ledger.entries.length],
  ]) {
    if (record[field] !== expected) {
      errors.push(`governed ${field} does not match the fresh audit`);
    }
  }
  if (record.evidenceCommitSha !== audit.evidenceCommitSha) {
    errors.push('governed evidence commit does not match the fresh audit');
  }
  if (Object.hasOwn(record, 'evidenceGitSha')) {
    errors.push('legacy governed evidenceGitSha is not accepted');
  }
  const prefixHeads = [
    audit.evidenceCommitSha,
    ...audit.downstreamCommits.map(({ commitSha }) => commitSha),
  ];
  const prefixPosition = prefixHeads.indexOf(record.currentGitSha);
  if (prefixPosition < 0) {
    errors.push('governed currentGitSha is not E or an audited generated descendant');
  } else if (
    !Number.isSafeInteger(record.downstreamCommitCount) ||
    record.downstreamCommitCount !== prefixPosition
  ) {
    errors.push('governed downstreamCommitCount does not match its exact prefix position');
  }
  return deepFreeze({
    status: errors.length === 0 ? 'pass' : 'blocked',
    errors,
  });
}

export function validateGovernedGeneratedPublication(record, audit, outputPaths) {
  const binding = validateGovernedEvidenceChainBinding(record, audit);
  const errors = [...binding.errors];
  let normalizedOutputPaths = [];
  let publicationCommitSha = null;

  try {
    if (!Array.isArray(outputPaths) || outputPaths.length !== 2) {
      throw new TypeError('governed publication must contain exactly one JSON/Markdown pair');
    }
    normalizedOutputPaths = outputPaths
      .map((repoPath) => canonicalGovernedEvidencePath(repoPath))
      .sort(utf8Compare);
    assertNoPathCollisions(normalizedOutputPaths, 'governed publication outputs');
    const jsonPath = normalizedOutputPaths.find((repoPath) => repoPath.endsWith('.json'));
    const markdownPath = normalizedOutputPaths.find((repoPath) => repoPath.endsWith('.md'));
    if (
      !jsonPath ||
      !markdownPath ||
      jsonPath.slice(0, -'.json'.length) !== markdownPath.slice(0, -'.md'.length)
    ) {
      throw new Error('governed publication outputs are not one matching JSON/Markdown pair');
    }
    if (
      normalizedOutputPaths.some(
        (repoPath) => !GOVERNED_DOWNSTREAM_GENERATED_PATHS.includes(repoPath),
      )
    ) {
      throw new Error('governed publication output is outside the downstream allowlist');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (binding.status === 'pass' && normalizedOutputPaths.length === 2) {
    const prefixHeads = [
      audit.evidenceCommitSha,
      ...audit.downstreamCommits.map(({ commitSha }) => commitSha),
    ];
    const prefixPosition = prefixHeads.indexOf(record.currentGitSha);
    const publication = audit.downstreamCommits[prefixPosition] ?? null;
    if (!publication) {
      errors.push('no downstream publication commit follows governed currentGitSha');
    } else {
      publicationCommitSha = publication.commitSha;
      if (publication.parentSha !== record.currentGitSha) {
        errors.push('governed publication commit is not the direct child of currentGitSha');
      }
      const changedPaths = [...publication.changedPaths].sort(utf8Compare);
      if (!samePathSet(changedPaths, normalizedOutputPaths)) {
        errors.push('governed publication commit does not change exactly the output pair');
      }
      const laterCommits = audit.downstreamCommits.slice(prefixPosition + 1);
      if (
        laterCommits.some(({ changedPaths: laterPaths }) =>
          laterPaths.some((repoPath) => normalizedOutputPaths.includes(repoPath)),
        )
      ) {
        errors.push('governed publication output changed after its publication commit');
      }
    }
  }

  return deepFreeze({
    status: errors.length === 0 ? 'pass' : 'blocked',
    errors: [...new Set(errors)],
    outputPaths: normalizedOutputPaths,
    publicationCommitSha,
  });
}

export function captureGovernedEvidenceWorkingBindings(audit, rootPath) {
  if (audit?.status !== 'pass' || !audit.ledger || !audit.ledgerPath) {
    throw new Error('cannot bind files from a non-passing governed evidence-chain audit');
  }
  const expectedHashes = new Map([
    [audit.ledgerPath, sha256(renderGovernedEvidenceLedger(audit.ledger))],
    ...audit.ledger.entries.map(({ path, sha256: digest }) => [path, digest]),
  ]);
  const downstreamPaths = [
    ...new Set(
      audit.downstreamCommits.flatMap(({ changedPaths }) =>
        Array.isArray(changedPaths) ? changedPaths : [],
      ),
    ),
  ];
  const paths = [...expectedHashes.keys(), ...downstreamPaths];
  assertNoPathCollisions(paths, 'governed evidence working bindings');
  const records = paths.map((repoPath) => {
    const binding = hashStableRootBoundWorkingFile(rootPath, repoPath);
    const expectedHash = expectedHashes.get(repoPath) ?? null;
    if (
      binding.kind !== 'file' ||
      !binding.identity ||
      !binding.sha256 ||
      (expectedHash !== null && binding.sha256 !== expectedHash) ||
      !Number.isSafeInteger(binding.sizeBytes)
    ) {
      throw new Error(`${repoPath} is not the audited stable governed evidence file`);
    }
    return { path: repoPath, ...binding };
  });
  return deepFreeze({ records });
}

export function verifyGovernedEvidenceWorkingBindings(
  bindings,
  rootPath,
  { context = 'governed evidence publication' } = {},
) {
  if (!bindings || !Array.isArray(bindings.records) || bindings.records.length === 0) {
    return [`${context} has no retained governed evidence file bindings`];
  }
  const errors = [];
  for (const binding of bindings.records) {
    const current = hashStableRootBoundWorkingFile(rootPath, binding.path, {
      expectedSizeBytes: binding.sizeBytes,
    });
    if (
      current.kind !== 'file' ||
      current.identity !== binding.identity ||
      current.sha256 !== binding.sha256 ||
      current.sizeBytes !== binding.sizeBytes
    ) {
      errors.push(`${binding.path} changed during ${context}`);
    }
  }
  return errors;
}

export function parseGovernedEvidenceLedger(
  bytes,
  { expectedSourceGitSha = null, expectedReleaseCandidateDir = null } = {},
) {
  if (!Buffer.isBuffer(bytes) || bytes.length > GOVERNED_EVIDENCE_LEDGER_MAX_BYTES) {
    throw new TypeError('governed evidence ledger must be a bounded Buffer.');
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('governed evidence ledger is not valid UTF-8');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('governed evidence ledger is not valid JSON');
  }
  if (
    !exactKeys(parsed, [
      'schemaVersion',
      'kind',
      'sourceGitSha',
      'releaseCandidateDir',
      'publicationPolicy',
      'entries',
    ]) ||
    parsed.schemaVersion !== GOVERNED_EVIDENCE_CHAIN_SCHEMA_VERSION ||
    parsed.kind !== LEDGER_KIND
  ) {
    throw new Error('governed evidence ledger has an unsupported schema');
  }
  const normalized = normalizeLedger(parsed);
  const canonicalBytes = Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  if (!canonicalBytes.equals(bytes)) {
    throw new Error('governed evidence ledger is not canonical JSON');
  }
  if (expectedSourceGitSha !== null && normalized.sourceGitSha !== expectedSourceGitSha) {
    throw new Error('governed evidence ledger sourceGitSha does not match the requested source');
  }
  if (
    expectedReleaseCandidateDir !== null &&
    normalized.releaseCandidateDir !== expectedReleaseCandidateDir
  ) {
    throw new Error('governed evidence ledger releaseCandidateDir does not match the selected RC');
  }
  return deepFreeze(normalized);
}

function gitBuffer(root, args, maxBuffer = MAX_GIT_METADATA_BYTES) {
  return runTrustedGit(root, args, { maxBuffer });
}

function gitText(root, args, maxBuffer = MAX_GIT_METADATA_BYTES) {
  return gitBuffer(root, args, maxBuffer).toString('utf8');
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} contains invalid UTF-8`);
  }
}

function parseNulRecords(bytes, label) {
  if (bytes.length === 0) return [];
  if (bytes.at(-1) !== 0) throw new Error(`${label} is not NUL terminated`);
  const records = [];
  let offset = 0;
  while (offset < bytes.length) {
    const end = bytes.indexOf(0, offset);
    if (end < 0 || end === offset) throw new Error(`${label} contains an empty record`);
    records.push(decodeUtf8(bytes.subarray(offset, end), label));
    offset = end + 1;
  }
  return records;
}

function canonicalRealPath(value) {
  const real = realpathSync(value);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

function directoryIdentity(stat) {
  return [stat.dev, stat.ino, stat.mode].join(':');
}

function captureExactRepositoryRoot(root) {
  const stat = lstatSync(root, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('governed evidence root must be a real directory');
  }
  const topLevel = gitText(root, ['rev-parse', '--show-toplevel']).trim();
  if (canonicalRealPath(topLevel) !== canonicalRealPath(root)) {
    throw new Error('supplied root is not the exact Git worktree root');
  }
  return {
    identity: directoryIdentity(stat),
    realPath: canonicalRealPath(root),
    root,
  };
}

function assertRepositoryRootBinding(binding) {
  const stat = lstatSync(binding.root, { bigint: true });
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    directoryIdentity(stat) !== binding.identity ||
    canonicalRealPath(binding.root) !== binding.realPath
  ) {
    throw new Error('governed evidence repository root identity changed during audit');
  }
}

function runAuditPhase(binding, onPhase, phase) {
  assertRepositoryRootBinding(binding);
  onPhase?.(phase);
  assertRepositoryRootBinding(binding);
}

function readHeadSha(root) {
  const head = gitText(root, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  if (!FULL_GIT_SHA.test(head)) throw new Error('Git HEAD is not one full SHA-1 commit ID');
  return head;
}

function readLinearCommitChain(root, sourceGitSha, headGitSha) {
  gitBuffer(root, ['cat-file', '-e', `${sourceGitSha}^{commit}`]);
  const output = gitText(root, [
    'rev-list',
    '--reverse',
    '--topo-order',
    '--parents',
    `${sourceGitSha}..${headGitSha}`,
  ]);
  const lines = output.trim() ? output.trim().split('\n') : [];
  if (lines.length === 0) throw new Error('HEAD must descend from a distinct evidence commit');
  if (lines.length > MAX_HISTORY_COMMITS) {
    throw new Error('governed evidence history exceeds the commit ceiling');
  }
  const commits = [];
  let expectedParent = sourceGitSha;
  for (const line of lines) {
    const fields = line.trim().split(/ +/u);
    if (
      fields.length !== 2 ||
      !FULL_GIT_SHA.test(fields[0]) ||
      !FULL_GIT_SHA.test(fields[1]) ||
      fields[1] !== expectedParent
    ) {
      throw new Error('S..HEAD must be one strictly linear, non-merge commit chain');
    }
    commits.push({ commitSha: fields[0], parentSha: fields[1] });
    expectedParent = fields[0];
  }
  if (commits.at(-1)?.commitSha !== headGitSha) {
    throw new Error('sourceGitSha is not the unique linear ancestor of HEAD');
  }
  return commits;
}

function readChangedPaths(root, parentSha, commitSha) {
  const records = parseNulRecords(
    gitBuffer(root, [
      'diff',
      '--no-renames',
      '--no-ext-diff',
      '--no-textconv',
      '--name-only',
      '-z',
      `${parentSha}..${commitSha}`,
      '--',
    ]),
    'Git diff path set',
  ).map(canonicalGovernedEvidencePath);
  if (new Set(records).size !== records.length) {
    throw new Error('Git diff returned duplicate changed paths');
  }
  assertNoPathCollisions(records, 'Git diff');
  return records.sort(utf8Compare);
}

function chunkPaths(paths) {
  const chunks = [];
  let current = [];
  let bytes = 0;
  for (const repoPath of paths) {
    const pathBytes = Buffer.byteLength(repoPath, 'utf8') + 16;
    if (current.length > 0 && (current.length >= 64 || bytes + pathBytes > 8192)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(repoPath);
    bytes += pathBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function readTreeEntries(root, commitSha, paths) {
  const requested = new Set(paths);
  const entries = new Map();
  for (const chunk of chunkPaths(paths)) {
    const records = parseNulRecords(
      gitBuffer(root, [
        'ls-tree',
        '-z',
        commitSha,
        '--',
        ...chunk.map((repoPath) => `:(literal)${repoPath}`),
      ]),
      'Git tree entry set',
    );
    for (const record of records) {
      const match = /^(\d{6}) ([a-z]+) ([0-9a-f]{40,64})\t(.+)$/u.exec(record);
      if (!match) throw new Error('Git returned a malformed tree entry');
      const repoPath = canonicalGovernedEvidencePath(match[4]);
      if (!requested.has(repoPath) || entries.has(repoPath)) {
        throw new Error('Git returned an unexpected or duplicate tree entry');
      }
      entries.set(repoPath, { mode: match[1], objectType: match[2], objectId: match[3] });
    }
  }
  return entries;
}

function assertNormalBlobTreeEntries(entries, paths, label) {
  for (const repoPath of paths) {
    const entry = entries.get(repoPath);
    if (
      !entry ||
      entry.mode !== '100644' ||
      entry.objectType !== 'blob' ||
      !GIT_OBJECT_ID.test(entry.objectId)
    ) {
      throw new Error(`${label} ${repoPath} is not one normal 100644 Git blob`);
    }
  }
}

function readGitBlobs(root, commitSha, paths, { maxEntryBytes, maxAggregateBytes }) {
  if (
    !Number.isSafeInteger(maxEntryBytes) ||
    maxEntryBytes < 0 ||
    !Number.isSafeInteger(maxAggregateBytes) ||
    maxAggregateBytes < maxEntryBytes
  ) {
    throw new TypeError('governed evidence blob ceilings are invalid');
  }
  const input = Buffer.from(paths.map((repoPath) => `${commitSha}:${repoPath}\n`).join(''), 'utf8');
  const maxBuffer = maxAggregateBytes + input.length + paths.length * 256;
  if (!Number.isSafeInteger(maxBuffer)) throw new TypeError('Git blob output ceiling is invalid');
  const output = runTrustedGit(root, ['cat-file', '--batch'], { input, maxBuffer });
  const records = new Map();
  let offset = 0;
  let aggregateBytes = 0;
  for (const repoPath of paths) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) throw new Error('Git returned a truncated blob header');
    const header = decodeUtf8(output.subarray(offset, newline), 'Git blob header');
    offset = newline + 1;
    if (header.endsWith(' missing')) throw new Error(`${repoPath} is missing from ${commitSha}`);
    const match = /^([0-9a-f]{40,64}) blob ([0-9]+)$/u.exec(header);
    if (!match) throw new Error(`${repoPath} is not a Git blob`);
    const size = Number(match[2]);
    aggregateBytes += size;
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > maxEntryBytes ||
      aggregateBytes > maxAggregateBytes ||
      offset + size >= output.length
    ) {
      throw new Error('governed evidence blobs exceed their byte ceiling');
    }
    const bytes = Buffer.from(output.subarray(offset, offset + size));
    offset += size;
    if (output[offset] !== 0x0a) throw new Error('Git omitted a blob terminator');
    offset += 1;
    records.set(repoPath, { bytes, objectId: match[1], sha256: sha256(bytes) });
  }
  if (offset !== output.length) throw new Error('Git returned trailing blob bytes');
  return records;
}

function parseGovernedLaunchContractSnapshot(bytes) {
  let value;
  try {
    value = JSON.parse(decodeUtf8(bytes, 'governed launch contract'));
  } catch (error) {
    throw new Error(
      `governed launch contract is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('governed launch contract is not one JSON object');
  }
  return value;
}

export function captureGovernedPublicationPolicy(
  root,
  sourceGitSha,
  {
    maxEntryBytes = GOVERNED_EVIDENCE_ENTRY_MAX_BYTES,
    maxAggregateBytes = GOVERNED_EVIDENCE_AGGREGATE_MAX_BYTES,
  } = {},
) {
  if (!FULL_GIT_SHA.test(String(sourceGitSha ?? ''))) {
    throw new TypeError('sourceGitSha must be a lowercase 40-character Git SHA.');
  }
  const sourceSnapshotPaths = GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.flatMap(
    (unitId) => GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === unitId).paths,
  );
  const allPaths = [GOVERNED_LAUNCH_CONTRACT_PATH, ...sourceSnapshotPaths];
  const treeEntries = readTreeEntries(root, sourceGitSha, allPaths);
  const missingPaths = allPaths.filter((repoPath) => !treeEntries.has(repoPath));
  if (missingPaths.length > 0) {
    throw new Error(
      `pinned S publication policy is missing required source paths: ${missingPaths.join(', ')}`,
    );
  }
  const presentPaths = allPaths.filter((repoPath) => treeEntries.has(repoPath));
  assertNormalBlobTreeEntries(treeEntries, presentPaths, 'source publication policy');
  const blobs = readGitBlobs(root, sourceGitSha, presentPaths, {
    maxEntryBytes,
    maxAggregateBytes,
  });
  const launchBlob = blobs.get(GOVERNED_LAUNCH_CONTRACT_PATH) ?? null;
  const parsedLaunchContract = parseGovernedLaunchContractSnapshot(launchBlob.bytes);
  const launchContractErrors = validateLaunchContract(parsedLaunchContract);
  if (launchContractErrors.length > 0) {
    throw new Error(`pinned S launch contract is invalid: ${launchContractErrors.join('; ')}`);
  }
  const launchContract = {
    path: GOVERNED_LAUNCH_CONTRACT_PATH,
    exists: true,
    sha256: launchBlob.sha256,
    snapshot: launchContractSnapshot(parsedLaunchContract),
  };
  return buildGovernedPublicationPolicy({
    ...placeholderGovernedPublicationPolicy(),
    launchContract,
    sourceSnapshotUnits: GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.map((unitId) => {
      const unit = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === unitId);
      return {
        unitId,
        files: unit.paths.map((path) => {
          const blob = blobs.get(path) ?? null;
          return blob
            ? { path, exists: true, sha256: blob.sha256 }
            : { path, exists: false, sha256: null };
        }),
      };
    }),
  });
}

function inspectIndex(root) {
  const bytes = gitBuffer(root, ['ls-files', '-v', '-z']);
  const records = parseNulRecords(bytes, 'Git index');
  if (records.length === 0) throw new Error('Git index is empty');
  const paths = [];
  for (const record of records) {
    if (!record.startsWith('H ') || record.length <= 2) {
      throw new Error('Git index contains a non-normal entry');
    }
    paths.push(canonicalGovernedEvidencePath(record.slice(2)));
  }
  assertNoPathCollisions(paths, 'Git index');
  return bytes;
}

function inspectCleanStatus(root) {
  const bytes = gitBuffer(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--ignore-submodules=none',
  ]);
  if (bytes.length !== 0) throw new Error('governed evidence validation requires a clean worktree');
  return bytes;
}

function samePathSet(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function publicationUnitIdForChangedPaths(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) return null;
  const unit = GOVERNED_PUBLICATION_UNIT_BY_PATH.get(changedPaths[0]) ?? null;
  return unit && samePathSet(changedPaths, unit.paths) ? unit.id : null;
}

export function validateGovernedPublicationCompletion(audit, { stage = 'R' } = {}) {
  const errors = [];
  if (!['R', 'F'].includes(stage)) throw new TypeError('completion stage must be R or F');
  if (audit?.status !== 'pass' || !audit.ledger) {
    errors.push('fresh governed evidence-chain audit is not pass');
  }
  const policy = audit?.ledger?.publicationPolicy ?? null;
  const ledgerPlan = Array.isArray(policy?.postEvidenceRequiredUnitIds)
    ? policy.postEvidenceRequiredUnitIds
    : [];
  if (!samePathSet(ledgerPlan, GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS)) {
    errors.push('evidence-ledger required publication plan does not match launch policy');
  }
  if (
    !Array.isArray(policy?.sourceSnapshotUnits) ||
    policy.sourceSnapshotUnits.length !== GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.length ||
    policy.sourceSnapshotUnits.some(({ files }) =>
      files.some(({ exists, sha256: digest }) => exists !== true || !SHA256.test(String(digest))),
    )
  ) {
    errors.push('all 12 source-snapshot publication units must exist and be SHA-bound at S');
  }
  const launchSnapshot = policy?.launchContract?.snapshot;
  if (
    policy?.launchContract?.exists !== true ||
    !SHA256.test(String(policy?.launchContract?.sha256 ?? '')) ||
    launchSnapshot?.releaseMode !== 'all-features' ||
    launchSnapshot?.androidRelease !== false ||
    !samePathSet(launchSnapshot?.platforms, ['ios']) ||
    !Array.isArray(launchSnapshot?.requiredFeatureIds) ||
    launchSnapshot.requiredFeatureIds.length !== 20
  ) {
    errors.push('pinned S launch contract is not the active iOS all-features policy');
  }
  const published = [
    ...new Set(
      (audit?.downstreamCommits ?? [])
        .map(({ changedPaths }) => publicationUnitIdForChangedPaths(changedPaths))
        .filter((id) => id !== null),
    ),
  ].sort(utf8Compare);
  const expectedPublished = [
    ...GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
    ...(stage === 'F' ? [GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID] : []),
  ].sort(utf8Compare);
  if (!samePathSet(published, expectedPublished)) {
    const missing = expectedPublished.filter((id) => !published.includes(id));
    const unexpected = published.filter((id) => !expectedPublished.includes(id));
    errors.push(
      `stage ${stage} publication set is not exact (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'})`,
    );
  }
  const finalPublishedUnitId = audit?.downstreamCommits?.at(-1)?.publicationUnitId ?? null;
  if (
    (stage === 'R' && finalPublishedUnitId !== 'docs/generated/generated-packet-status-audit') ||
    (stage === 'F' && finalPublishedUnitId !== GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID)
  ) {
    errors.push(`stage ${stage} does not end at its required final publication unit`);
  }
  return deepFreeze({
    status: errors.length === 0 ? 'pass' : 'blocked',
    errors: [...new Set(errors)],
    stage,
    expectedPublicationUnitIds: expectedPublished,
    publishedPublicationUnitIds: published,
  });
}

export function auditGovernedEvidenceChain({
  root: rootPath,
  sourceGitSha,
  releaseCandidateDir,
  expectedHeadSha = null,
  maxLedgerBytes = GOVERNED_EVIDENCE_LEDGER_MAX_BYTES,
  maxEntryBytes = GOVERNED_EVIDENCE_ENTRY_MAX_BYTES,
  maxAggregateBytes = GOVERNED_EVIDENCE_AGGREGATE_MAX_BYTES,
  onPhase = null,
}) {
  if (!FULL_GIT_SHA.test(String(sourceGitSha ?? ''))) {
    throw new TypeError('sourceGitSha must be a lowercase 40-character Git SHA.');
  }
  const normalizedReleaseCandidateDir = validateReleaseCandidateDir(releaseCandidateDir);
  if (expectedHeadSha !== null && !FULL_GIT_SHA.test(String(expectedHeadSha))) {
    throw new TypeError('expectedHeadSha must be null or one lowercase 40-character Git SHA.');
  }
  if (
    !Number.isSafeInteger(maxLedgerBytes) ||
    maxLedgerBytes < 1 ||
    maxLedgerBytes > GOVERNED_EVIDENCE_LEDGER_MAX_BYTES ||
    !Number.isSafeInteger(maxEntryBytes) ||
    maxEntryBytes < 0 ||
    !Number.isSafeInteger(maxAggregateBytes) ||
    maxAggregateBytes < maxEntryBytes
  ) {
    throw new TypeError('governed evidence audit byte ceilings are invalid');
  }
  if (onPhase !== null && typeof onPhase !== 'function') {
    throw new TypeError('onPhase must be null or a function');
  }

  const root = resolve(rootPath);
  const ledgerPath = governedEvidenceLedgerPath(normalizedReleaseCandidateDir);
  const errors = [];
  let headGitSha = null;
  let evidenceCommitSha = null;
  let directEvidenceCommit = false;
  let evidenceOnlyCommit = false;
  let cleanWorktree = false;
  let normalIndexState = false;
  let ledgerValid = false;
  let publicationPolicyValid = false;
  let sourceSnapshotStable = false;
  let postEvidenceDagValid = false;
  let hashesValid = false;
  let downstreamGeneratedOnly = false;
  let ledger = null;
  let downstreamCommits = [];
  let publishedPublicationUnitIds = [];
  let missingRequiredPublicationUnitIds = [];
  let requiredPublicationUnitsComplete = false;

  try {
    const rootBinding = captureExactRepositoryRoot(root);
    headGitSha = readHeadSha(root);
    if (expectedHeadSha !== null && headGitSha !== expectedHeadSha) {
      throw new Error('Git HEAD does not match expectedHeadSha');
    }
    const initialStatus = inspectCleanStatus(root);
    cleanWorktree = true;
    const initialIndex = inspectIndex(root);
    normalIndexState = true;
    runAuditPhase(rootBinding, onPhase, 'after-initial-snapshot');

    const chain = readLinearCommitChain(root, sourceGitSha, headGitSha);
    evidenceCommitSha = chain[0].commitSha;
    directEvidenceCommit = chain[0].parentSha === sourceGitSha;

    const ledgerTreeAtEvidence = readTreeEntries(root, evidenceCommitSha, [ledgerPath]);
    assertNormalBlobTreeEntries(ledgerTreeAtEvidence, [ledgerPath], 'evidence commit');
    const ledgerBlob = readGitBlobs(root, evidenceCommitSha, [ledgerPath], {
      maxAggregateBytes: maxLedgerBytes,
      maxEntryBytes: maxLedgerBytes,
    }).get(ledgerPath);
    ledger = parseGovernedEvidenceLedger(ledgerBlob.bytes, {
      expectedReleaseCandidateDir: normalizedReleaseCandidateDir,
      expectedSourceGitSha: sourceGitSha,
    });
    ledgerValid = true;
    const sourcePublicationPolicy = captureGovernedPublicationPolicy(root, sourceGitSha, {
      maxAggregateBytes,
      maxEntryBytes,
    });
    if (JSON.stringify(sourcePublicationPolicy) !== JSON.stringify(ledger.publicationPolicy)) {
      throw new Error(
        'evidence-ledger publication policy does not match the pinned S launch contract and source snapshots',
      );
    }
    publicationPolicyValid = true;
    runAuditPhase(rootBinding, onPhase, 'after-ledger');

    const evidencePaths = ledger.entries.map(({ path }) => path);
    const expectedEvidenceDiff = [ledgerPath, ...evidencePaths].sort(utf8Compare);
    const evidenceDiff = readChangedPaths(root, sourceGitSha, evidenceCommitSha);
    if (!samePathSet(evidenceDiff, expectedEvidenceDiff)) {
      throw new Error(
        'S..E changed paths do not exactly equal the evidence ledger plus ledger file',
      );
    }
    evidenceOnlyCommit = true;

    const immutablePaths = [ledgerPath, ...evidencePaths];
    assertNoPathCollisions(immutablePaths, 'immutable evidence');
    const evidenceTree = readTreeEntries(root, evidenceCommitSha, immutablePaths);
    const headTree = readTreeEntries(root, headGitSha, immutablePaths);
    assertNormalBlobTreeEntries(evidenceTree, immutablePaths, 'evidence commit');
    assertNormalBlobTreeEntries(headTree, immutablePaths, 'HEAD');
    const evidenceBlobs = readGitBlobs(root, evidenceCommitSha, immutablePaths, {
      maxAggregateBytes,
      maxEntryBytes,
    });
    const headBlobs = readGitBlobs(root, headGitSha, immutablePaths, {
      maxAggregateBytes,
      maxEntryBytes,
    });
    for (const entry of ledger.entries) {
      if (evidenceBlobs.get(entry.path)?.sha256 !== entry.sha256) {
        throw new Error(`${entry.path} does not match its evidence-ledger SHA-256`);
      }
    }
    for (const repoPath of immutablePaths) {
      const atEvidence = evidenceBlobs.get(repoPath);
      const atHead = headBlobs.get(repoPath);
      if (
        evidenceTree.get(repoPath).objectId !== atEvidence.objectId ||
        headTree.get(repoPath).objectId !== atHead.objectId ||
        atEvidence.objectId !== atHead.objectId ||
        !atEvidence.bytes.equals(atHead.bytes)
      ) {
        throw new Error(`${repoPath} changed after the evidence commit`);
      }
    }
    hashesValid = true;

    const downstreamPaths = new Set();
    const publishedDownstreamPaths = new Set();
    let downstreamAggregateBytes = 0;
    downstreamCommits = [];
    const publishedUnitIds = new Set();
    const downstreamRecords = chain.slice(1);
    for (const [recordIndex, record] of downstreamRecords.entries()) {
      const changedPaths = readChangedPaths(root, record.parentSha, record.commitSha);
      const publicationUnit = GOVERNED_PUBLICATION_UNIT_BY_PATH.get(changedPaths[0]) ?? null;
      if (
        changedPaths.length === 0 ||
        publicationUnit === null ||
        !samePathSet(changedPaths, publicationUnit.paths)
      ) {
        throw new Error(
          `${record.commitSha} changes a non-allowlisted downstream path or fails to publish exactly one governed JSON/Markdown pair or approved JSON singleton`,
        );
      }
      if (changedPaths.some((repoPath) => publishedDownstreamPaths.has(repoPath))) {
        throw new Error(`${record.commitSha} changes a governed output after its publication`);
      }
      if (GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.includes(publicationUnit.id)) {
        throw new Error(
          `${record.commitSha} changes source-snapshot unit ${publicationUnit.id} after S`,
        );
      }
      const isFinalReadinessUnit =
        publicationUnit.id === GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID;
      if (
        !isFinalReadinessUnit &&
        !GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.includes(publicationUnit.id)
      ) {
        throw new Error(`${record.commitSha} changes an unexpected lifecycle-class unit`);
      }
      if (isFinalReadinessUnit) {
        const missingBeforeReadiness = GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.filter(
          (id) => !publishedUnitIds.has(id),
        );
        if (recordIndex !== downstreamRecords.length - 1 || missingBeforeReadiness.length > 0) {
          throw new Error(
            `readiness F must be the unique final unit after all 22 post-E publications; missing: ${missingBeforeReadiness.join(', ')}`,
          );
        }
      } else {
        const missingDependencies = GOVERNED_POST_E_PUBLICATION_DAG_EDGES.filter(
          ({ after }) => after === publicationUnit.id,
        )
          .map(({ before }) => before)
          .filter((id) => !publishedUnitIds.has(id));
        if (missingDependencies.length > 0) {
          throw new Error(
            `${record.commitSha} publishes ${publicationUnit.id} before required DAG predecessors: ${missingDependencies.join(', ')}`,
          );
        }
      }
      const changedTree = readTreeEntries(root, record.commitSha, changedPaths);
      assertNormalBlobTreeEntries(changedTree, changedPaths, 'downstream commit');
      const remainingAggregateBytes = Math.max(0, maxAggregateBytes - downstreamAggregateBytes);
      const changedBlobs = readGitBlobs(root, record.commitSha, changedPaths, {
        maxAggregateBytes: Math.max(maxEntryBytes, remainingAggregateBytes),
        maxEntryBytes,
      });
      for (const repoPath of changedPaths) {
        const blob = changedBlobs.get(repoPath);
        downstreamAggregateBytes += blob.bytes.length;
        if (
          downstreamAggregateBytes > maxAggregateBytes ||
          changedTree.get(repoPath).objectId !== blob.objectId
        ) {
          throw new Error('downstream generated blobs exceed their byte ceiling');
        }
        publishedDownstreamPaths.add(repoPath);
        downstreamPaths.add(repoPath);
      }
      downstreamCommits.push(
        deepFreeze({
          commitSha: record.commitSha,
          parentSha: record.parentSha,
          publicationUnitId: publicationUnit.id,
          changedPaths,
        }),
      );
      publishedUnitIds.add(publicationUnit.id);
    }
    downstreamGeneratedOnly = true;
    postEvidenceDagValid = true;
    publishedPublicationUnitIds = downstreamCommits
      .map(({ publicationUnitId }) => publicationUnitId)
      .sort(utf8Compare);
    missingRequiredPublicationUnitIds = ledger.publicationPolicy.postEvidenceRequiredUnitIds.filter(
      (id) => !publishedPublicationUnitIds.includes(id),
    );
    requiredPublicationUnitsComplete = missingRequiredPublicationUnitIds.length === 0;
    const finalDownstreamPaths = [...downstreamPaths].sort(utf8Compare);
    const downstreamHeadTree = readTreeEntries(root, headGitSha, finalDownstreamPaths);
    assertNormalBlobTreeEntries(downstreamHeadTree, finalDownstreamPaths, 'HEAD downstream');
    const downstreamHeadBlobs = readGitBlobs(root, headGitSha, finalDownstreamPaths, {
      maxAggregateBytes,
      maxEntryBytes,
    });
    for (const repoPath of finalDownstreamPaths) {
      if (
        downstreamHeadTree.get(repoPath).objectId !== downstreamHeadBlobs.get(repoPath).objectId
      ) {
        throw new Error(`${repoPath} has an inconsistent downstream HEAD blob`);
      }
    }
    const headPublicationPolicy = captureGovernedPublicationPolicy(root, headGitSha, {
      maxAggregateBytes,
      maxEntryBytes,
    });
    if (JSON.stringify(headPublicationPolicy) !== JSON.stringify(ledger.publicationPolicy)) {
      throw new Error('pinned S launch contract or source-snapshot units changed by HEAD');
    }
    sourceSnapshotStable = true;
    runAuditPhase(rootBinding, onPhase, 'before-working-tree-verification');

    let aggregateWorkingBytes = 0;
    const finalWorkingPaths = [...immutablePaths, ...finalDownstreamPaths];
    assertNoPathCollisions(finalWorkingPaths, 'final governed files');
    for (const repoPath of finalWorkingPaths) {
      const expected = headBlobs.get(repoPath) ?? downstreamHeadBlobs.get(repoPath);
      const working = readStableRootBoundWorkingFile(root, repoPath, { maxBytes: maxEntryBytes });
      aggregateWorkingBytes += working.bytes?.length ?? 0;
      if (
        aggregateWorkingBytes > maxAggregateBytes ||
        working.kind !== 'file' ||
        !working.bytes?.equals(expected.bytes)
      ) {
        throw new Error(`${repoPath} is not a stable, single-link working file matching HEAD`);
      }
    }
    runAuditPhase(rootBinding, onPhase, 'before-final-snapshot');

    if (readHeadSha(root) !== headGitSha) throw new Error('Git HEAD changed during chain audit');
    if (!inspectCleanStatus(root).equals(initialStatus)) {
      throw new Error('Git status changed during chain audit');
    }
    if (!inspectIndex(root).equals(initialIndex))
      throw new Error('Git index changed during chain audit');
    for (const repoPath of finalWorkingPaths) {
      const expected = headBlobs.get(repoPath) ?? downstreamHeadBlobs.get(repoPath);
      const working = readStableRootBoundWorkingFile(root, repoPath, { maxBytes: maxEntryBytes });
      if (working.kind !== 'file' || !working.bytes?.equals(expected.bytes)) {
        throw new Error(`${repoPath} drifted during chain audit`);
      }
    }
    assertRepositoryRootBinding(rootBinding);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return deepFreeze({
    schemaVersion: 1,
    kind: 'governed_evidence_chain_audit',
    status: errors.length === 0 ? 'pass' : 'invalid',
    sourceGitSha,
    headGitSha,
    evidenceCommitSha,
    releaseCandidateDir: normalizedReleaseCandidateDir,
    ledgerPath,
    directEvidenceCommit,
    evidenceOnlyCommit,
    cleanWorktree,
    normalIndexState,
    ledgerValid,
    publicationPolicyValid,
    sourceSnapshotStable,
    postEvidenceDagValid,
    hashesValid,
    downstreamGeneratedOnly,
    requiredPublicationUnitsComplete,
    publishedPublicationUnitIds,
    missingRequiredPublicationUnitIds,
    ledger,
    downstreamCommits,
    errors,
  });
}
