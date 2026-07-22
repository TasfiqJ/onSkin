import { createHash } from 'node:crypto';

import {
  validateGovernedEvidenceChainBinding,
  validateGovernedGeneratedPublication,
} from '../launch/governed-evidence-chain.mjs';
import { validateLaunchContract } from '../launch/contract.mjs';
import { parseCatalogControlJson } from './source-policy.mjs';
import { validateBetaCoverageEvidenceInventory } from './beta-coverage-packet-contract.mjs';

const SHA256 = /^[0-9a-f]{64}$/u;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function parsePinnedBetaLaunchContract(record) {
  if (
    record?.workingKind !== 'file' ||
    record.workingTreeMatchesHead !== true ||
    !Buffer.isBuffer(record.headBytes) ||
    !Buffer.isBuffer(record.workingBytes) ||
    !record.headBytes.equals(record.workingBytes)
  ) {
    throw new Error('launch contract is not one pinned regular HEAD-matching file');
  }
  const contract = JSON.parse(decodedUtf8(record.headBytes, 'Pinned launch contract'));
  const errors = validateLaunchContract(contract);
  if (errors.length > 0) throw new Error(errors.join('; '));
  return Object.freeze(contract);
}

function decodedUtf8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function exactIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function replaceExactlyOnce(text, search, replacement, errors, label) {
  const first = text.indexOf(search);
  if (first < 0 || text.indexOf(search, first + search.length) >= 0) {
    errors.push(`canonical Markdown does not contain exactly one ${label}`);
    return text;
  }
  return `${text.slice(0, first)}${replacement}${text.slice(first + search.length)}`;
}

function objectClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeByteMap(value) {
  if (value instanceof Map) return value;
  return new Map(Object.entries(value ?? {}));
}

function validateSourceHashReplay({
  recordedPacket,
  sourceHashPaths,
  prefixSourceBytes,
  currentHeadSourceBytes,
  errors,
}) {
  const sourceHashes = recordedPacket?.sourceHashes;
  if (!Array.isArray(sourceHashes) || sourceHashes.length !== sourceHashPaths.length) {
    errors.push('committed beta source-hash inventory is not exact');
    return;
  }
  const prefixBytesByPath = normalizeByteMap(prefixSourceBytes);
  const currentBytesByPath = normalizeByteMap(currentHeadSourceBytes);
  for (let index = 0; index < sourceHashPaths.length; index += 1) {
    const path = sourceHashPaths[index];
    const record = sourceHashes[index];
    const prefixBytes = prefixBytesByPath.get(path);
    const currentBytes = currentBytesByPath.get(path);
    if (
      record === null ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      Object.keys(record).join('\0') !== 'path\0exists\0bytes\0sha256' ||
      record.path !== path ||
      record.exists !== true ||
      !Number.isSafeInteger(record.bytes) ||
      record.bytes < 0 ||
      !SHA256.test(String(record.sha256 ?? ''))
    ) {
      errors.push(`committed beta source hash is malformed: ${path}`);
      continue;
    }
    if (!Buffer.isBuffer(prefixBytes)) {
      errors.push(`${path} is missing from the recorded beta replay prefix`);
      continue;
    }
    if (!Buffer.isBuffer(currentBytes)) {
      errors.push(`${path} is missing from pinned current HEAD`);
      continue;
    }
    if (record.bytes !== prefixBytes.length || record.sha256 !== sha256(prefixBytes)) {
      errors.push(`${path} does not match its committed beta source hash`);
    }
    if (!prefixBytes.equals(currentBytes)) {
      errors.push(`${path} changed after the recorded beta replay prefix`);
    }
  }
}

function validateMountedInput({ recordedPacket, mountedInput, errors }) {
  const artifact = recordedPacket?.inputArtifact;
  if (
    artifact === null ||
    typeof artifact !== 'object' ||
    Array.isArray(artifact) ||
    Object.keys(artifact).join('\0') !== 'path\0exists\0bytes\0sha256' ||
    artifact.path !== recordedPacket?.inputPath ||
    artifact.exists !== true ||
    !Number.isSafeInteger(artifact.bytes) ||
    artifact.bytes < 0 ||
    !SHA256.test(String(artifact.sha256 ?? ''))
  ) {
    errors.push('committed beta aggregate input binding is malformed');
    return;
  }
  if (
    mountedInput?.kind !== 'file' ||
    mountedInput.path !== recordedPacket.inputPath ||
    !Buffer.isBuffer(mountedInput.bytes)
  ) {
    errors.push('recorded beta aggregate input is not mounted as one stable regular file');
    return;
  }
  if (
    artifact.bytes !== mountedInput.bytes.length ||
    artifact.sha256 !== sha256(mountedInput.bytes)
  ) {
    errors.push('mounted beta aggregate input bytes do not match the committed binding');
  }
}

function comparableReport({ freshReport, recordedPacket }) {
  const projected = objectClone(freshReport);
  const recorded = objectClone(recordedPacket);
  projected.generatedAt = '<generatedAt>';
  recorded.generatedAt = '<generatedAt>';
  projected.gitSha = recordedPacket.gitSha;
  projected.governedEvidenceChain.currentGitSha =
    recordedPacket.governedEvidenceChain?.currentGitSha;
  projected.governedEvidenceChain.downstreamCommitCount =
    recordedPacket.governedEvidenceChain?.downstreamCommitCount;
  return { projected, recorded };
}

function comparableMarkdown({
  freshReport,
  freshMarkdownBytes,
  recordedPacket,
  recordedMarkdownBytes,
  errors,
}) {
  let projected = decodedUtf8(freshMarkdownBytes, 'fresh beta coverage Markdown');
  let recorded = decodedUtf8(recordedMarkdownBytes, 'committed beta coverage Markdown');
  projected = replaceExactlyOnce(
    projected,
    `Generated: ${freshReport.generatedAt}`,
    'Generated: <generatedAt>',
    errors,
    'fresh generatedAt line',
  );
  recorded = replaceExactlyOnce(
    recorded,
    `Generated: ${recordedPacket.generatedAt}`,
    'Generated: <generatedAt>',
    errors,
    'committed generatedAt line',
  );
  projected = replaceExactlyOnce(
    projected,
    `Git SHA: ${freshReport.gitSha}`,
    `Git SHA: ${recordedPacket.gitSha}`,
    errors,
    'fresh Git SHA line',
  );
  projected = replaceExactlyOnce(
    projected,
    `- Current R/F HEAD: ${freshReport.governedEvidenceChain.currentGitSha ?? 'BLOCKED'}`,
    `- Current R/F HEAD: ${recordedPacket.governedEvidenceChain?.currentGitSha ?? 'BLOCKED'}`,
    errors,
    'fresh governed current-commit line',
  );
  projected = replaceExactlyOnce(
    projected,
    `- Downstream generated commits: ${freshReport.governedEvidenceChain.downstreamCommitCount}`,
    `- Downstream generated commits: ${recordedPacket.governedEvidenceChain?.downstreamCommitCount}`,
    errors,
    'fresh governed downstream-count line',
  );
  return { projected, recorded };
}

export function validateCommittedBetaCoverageReplay({
  recordedJsonBytes,
  recordedMarkdownBytes,
  freshReport,
  freshMarkdownBytes,
  audit,
  outputPaths,
  sourceHashPaths,
  prefixSourceBytes,
  currentHeadSourceBytes,
  mountedInput,
  initialSnapshotErrors = [],
  finalSnapshotErrors = [],
  governedBindingErrors = [],
}) {
  const errors = [...initialSnapshotErrors];
  let recordedPacket = null;
  try {
    recordedPacket = parseCatalogControlJson(recordedJsonBytes, 'Committed beta coverage report');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (
    recordedPacket === null ||
    typeof recordedPacket !== 'object' ||
    Array.isArray(recordedPacket)
  ) {
    if (recordedPacket !== null) errors.push('committed beta coverage report is not one object');
    return Object.freeze({ status: 'blocked', errors: Object.freeze([...new Set(errors)]) });
  }

  if (!canonicalJsonBytes(recordedPacket).equals(recordedJsonBytes)) {
    errors.push('committed beta coverage JSON is not canonical generated JSON');
  }
  if (!exactIsoTimestamp(recordedPacket.generatedAt)) {
    errors.push('committed beta coverage generatedAt is not one canonical ISO timestamp');
  }
  if (recordedPacket.status !== 'ready') errors.push('committed beta coverage status is not ready');
  if (recordedPacket.strict !== true)
    errors.push('committed beta coverage was not generated strictly');
  if (recordedPacket.gitStatus !== '') {
    errors.push('committed beta coverage was not generated from a clean worktree');
  }
  for (const field of ['codeErrors', 'evidenceBlockers', 'warnings']) {
    if (!Array.isArray(recordedPacket[field]) || recordedPacket[field].length !== 0) {
      errors.push(`committed beta coverage ${field} is not an empty array`);
    }
  }
  errors.push(...validateBetaCoverageEvidenceInventory(recordedPacket.evidence).errors);
  errors.push(
    ...validateGovernedGeneratedPublication(
      recordedPacket.governedEvidenceChain,
      audit,
      outputPaths,
    ).errors,
  );
  if (recordedPacket.gitSha !== recordedPacket.governedEvidenceChain?.currentGitSha) {
    errors.push('committed beta gitSha does not match governed currentGitSha');
  }
  errors.push(
    ...validateGovernedEvidenceChainBinding(freshReport?.governedEvidenceChain, audit).errors.map(
      (error) => `fresh beta replay ${error}`,
    ),
  );

  validateSourceHashReplay({
    recordedPacket,
    sourceHashPaths,
    prefixSourceBytes,
    currentHeadSourceBytes,
    errors,
  });
  validateMountedInput({ recordedPacket, mountedInput, errors });

  const reports = comparableReport({ freshReport, recordedPacket });
  if (JSON.stringify(reports.projected) !== JSON.stringify(reports.recorded)) {
    errors.push(
      'committed beta coverage JSON does not match canonical replay inputs at its validated prefix',
    );
  }
  try {
    const markdown = comparableMarkdown({
      freshReport,
      freshMarkdownBytes,
      recordedPacket,
      recordedMarkdownBytes,
      errors,
    });
    if (markdown.projected !== markdown.recorded) {
      errors.push(
        'committed beta coverage Markdown does not match canonical replay inputs at its validated prefix',
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  errors.push(...finalSnapshotErrors);
  errors.push(...governedBindingErrors);
  const uniqueErrors = [...new Set(errors)];
  return Object.freeze({
    status: uniqueErrors.length === 0 ? 'pass' : 'blocked',
    errors: Object.freeze(uniqueErrors),
    recordedPacket: Object.freeze(recordedPacket),
  });
}
