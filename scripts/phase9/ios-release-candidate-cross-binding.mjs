import { createHash } from 'node:crypto';

import { normalizeNamedSignoff } from './lib.mjs';

const RELEASE_CANDIDATE_DIR = /^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const EAS_BUILD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_PACKET_BYTES = 1_000_000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function boundedPacketSource(value, name) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    Buffer.byteLength(value, 'utf8') > MAX_PACKET_BYTES
  ) {
    throw new TypeError(`${name} must be a non-empty UTF-8 packet under one megabyte.`);
  }
  return value.replace(/\r\n/gu, '\n');
}

function tableValues(source, label) {
  const normalizedLabel = label.toLowerCase();
  const values = [];
  for (const line of source.split('\n')) {
    if (!/^\|.*\|$/u.test(line)) continue;
    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    if ((cells[0] ?? '').toLowerCase() !== normalizedLabel) continue;
    values.push(cells.length === 2 ? cells[1] : null);
  }
  return values;
}

function bulletValues(source, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const expression = new RegExp(`^-\\s*${escaped}\\s*:\\s*(.*?)\\s*$`, 'iu');
  return source
    .split('\n')
    .map((line) => expression.exec(line)?.[1] ?? null)
    .filter((value) => value !== null);
}

function exactPacketValue({ values, expected, label, packet, errors }) {
  if (values.length !== 1 || values[0] === null || values[0] === '') {
    errors.push(`${packet} ${label} must appear exactly once with one non-empty value.`);
    return false;
  }
  if (values[0] !== expected) {
    errors.push(`${packet} ${label} does not match the archive evidence index.`);
    return false;
  }
  return true;
}

function releaseSignoffRows(source, area) {
  return source
    .split('\n')
    .filter((line) => /^\|.*\|$/u.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells[0] === area);
}

function releaseSignoffRow(source, area) {
  const rows = releaseSignoffRows(source, area);
  if (rows.length !== 1 || rows[0].length !== 5) return null;
  const [, owner, decision, date] = rows[0];
  const normalizedOwner = normalizeNamedSignoff(owner);
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (
    !normalizedOwner ||
    decision !== 'APPROVE' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    !Number.isFinite(parsedDate.getTime()) ||
    !parsedDate.toISOString().startsWith(date)
  ) {
    return null;
  }
  return Object.freeze({ date, owner: normalizedOwner });
}

function reviewerIdentitySha256(name) {
  return createHash('sha256').update(Buffer.from(name, 'utf8')).digest('hex');
}

function requireString(value, path) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${path} must be a non-empty string.`);
  }
  return value;
}

function requireSha256(value, path) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256.`);
  }
  return value;
}

function requireSourceSha(value, path) {
  if (typeof value !== 'string' || !SOURCE_SHA.test(value)) {
    throw new TypeError(`${path} must be a lowercase 40-character Git SHA.`);
  }
  return value;
}

function requireEasBuildId(value, path) {
  if (typeof value !== 'string' || !EAS_BUILD_ID.test(value)) {
    throw new TypeError(`${path} must be one canonical lowercase EAS build UUID.`);
  }
  return value;
}

export function auditIosReleaseCandidateCrossBinding({
  releaseCandidateDirectory,
  references,
  manifestSource,
  storePacketSource,
  signoffSource,
  sourceGitSha,
  expectedEasBuildId,
  reviewedBuildEnvironment,
  signedOffBy,
  validation,
}) {
  if (
    typeof releaseCandidateDirectory !== 'string' ||
    !RELEASE_CANDIDATE_DIR.test(releaseCandidateDirectory)
  ) {
    throw new TypeError('releaseCandidateDirectory must be one strict non-template RC path.');
  }
  if (
    !Array.isArray(references) ||
    references.length === 0 ||
    references.some(
      (reference) =>
        !isRecord(reference) || typeof reference.path !== 'string' || reference.path.length === 0,
    )
  ) {
    throw new TypeError('references must be a non-empty list of normalized evidence references.');
  }
  if (!isRecord(validation)) {
    throw new TypeError('validation must be a validated archive evidence record.');
  }
  if (!isRecord(reviewedBuildEnvironment)) {
    throw new TypeError('reviewedBuildEnvironment must be the reviewed EAS environment record.');
  }

  const manifest = boundedPacketSource(manifestSource, 'manifestSource');
  const storePacket = boundedPacketSource(storePacketSource, 'storePacketSource');
  const signoff = boundedPacketSource(signoffSource, 'signoffSource');
  const errors = [];
  const evidenceSubtree = `${releaseCandidateDirectory}/evidence/ios/`;
  const referencePathsConfined = references.every(
    ({ path }) =>
      path.startsWith(evidenceSubtree) &&
      path.length > evidenceSubtree.length &&
      !path.includes('\\') &&
      !path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..'),
  );
  if (!referencePathsConfined) {
    errors.push(
      'The archive, EAS log, and archive-review artifacts must all stay in the selected RC evidence/ios subtree.',
    );
  }

  const expectedSourceGitSha = requireSourceSha(sourceGitSha, 'sourceGitSha');
  const expectedBuildId = requireEasBuildId(expectedEasBuildId, 'expectedEasBuildId');
  const validationSourceGitSha = requireSourceSha(
    validation.source?.gitSha,
    'validation.source.gitSha',
  );
  if (validationSourceGitSha !== expectedSourceGitSha) {
    errors.push('The archive evidence source SHA does not match the selected build-source SHA.');
  }

  let reviewedEnvironmentMatched = true;
  const environmentChecks = [
    [
      'toolchain',
      'easBuildImage',
      requireString(reviewedBuildEnvironment.image, 'reviewedBuildEnvironment.image'),
    ],
    [
      'toolchain',
      'xcodeVersion',
      requireString(reviewedBuildEnvironment.xcodeVersion, 'reviewedBuildEnvironment.xcodeVersion'),
    ],
    [
      'toolchain',
      'iosSdkVersion',
      requireString(
        reviewedBuildEnvironment.iosSdkVersion,
        'reviewedBuildEnvironment.iosSdkVersion',
      ),
    ],
    [
      'toolchain',
      'nodeVersion',
      requireString(reviewedBuildEnvironment.nodeVersion, 'reviewedBuildEnvironment.nodeVersion'),
    ],
    [
      'toolchain',
      'cocoaPodsVersion',
      requireString(
        reviewedBuildEnvironment.cocoapodsVersion,
        'reviewedBuildEnvironment.cocoapodsVersion',
      ),
    ],
    ['provenance', 'easBuildId', expectedBuildId],
    ['provenance', 'easGitCommitSha', expectedSourceGitSha],
    [
      'provenance',
      'easCliVersion',
      requireString(
        reviewedBuildEnvironment.easCliVersion,
        'reviewedBuildEnvironment.easCliVersion',
      ),
    ],
    [
      'provenance',
      'macosVersion',
      requireString(reviewedBuildEnvironment.macosVersion, 'reviewedBuildEnvironment.macosVersion'),
    ],
    [
      'provenance',
      'xcodeBuild',
      requireString(reviewedBuildEnvironment.xcodeBuild, 'reviewedBuildEnvironment.xcodeBuild'),
    ],
    [
      'provenance',
      'fastlaneVersion',
      requireString(
        reviewedBuildEnvironment.fastlaneVersion,
        'reviewedBuildEnvironment.fastlaneVersion',
      ),
    ],
  ];
  for (const [recordName, key, expected] of environmentChecks) {
    const actual = requireString(validation[recordName]?.[key], `validation.${recordName}.${key}`);
    if (actual !== expected) {
      reviewedEnvironmentMatched = false;
      errors.push(
        `iOS archive evidence ${recordName} ${key} does not match the reviewed build context.`,
      );
    }
  }

  const manifestChecks = [
    ['Build-source Git SHA', expectedSourceGitSha],
    [
      'iOS EAS build ID',
      requireString(validation.provenance?.easBuildId, 'validation.provenance.easBuildId'),
    ],
    ['iOS app version', requireString(validation.build?.appVersion, 'validation.build.appVersion')],
    [
      'iOS build number',
      requireString(validation.build?.buildNumber, 'validation.build.buildNumber'),
    ],
    [
      'iOS bundle identifier',
      requireString(validation.build?.bundleIdentifier, 'validation.build.bundleIdentifier'),
    ],
    ['EAS channel', 'production'],
  ];
  const manifestMatched = manifestChecks.every(([label, expected]) =>
    exactPacketValue({
      values: tableValues(manifest, label),
      expected,
      label,
      packet: 'RC manifest',
      errors,
    }),
  );

  const storePacketChecks = [
    [
      'EAS build ID',
      requireString(validation.provenance?.easBuildId, 'validation.provenance.easBuildId'),
    ],
    ['iOS app version', requireString(validation.build?.appVersion, 'validation.build.appVersion')],
    [
      'iOS build number',
      requireString(validation.build?.buildNumber, 'validation.build.buildNumber'),
    ],
    [
      'iOS bundle identifier',
      requireString(validation.build?.bundleIdentifier, 'validation.build.bundleIdentifier'),
    ],
    [
      'Archive SHA-256',
      requireSha256(validation.archive?.file?.sha256, 'validation.archive.file.sha256'),
    ],
    [
      'Processing/symbols report SHA-256',
      requireSha256(
        validation.artifacts?.symbolsProcessingReport?.sha256,
        'validation.artifacts.symbolsProcessingReport.sha256',
      ),
    ],
    [
      'App Privacy answers SHA-256',
      requireSha256(
        validation.artifacts?.appPrivacyAnswers?.sha256,
        'validation.artifacts.appPrivacyAnswers.sha256',
      ),
    ],
  ];
  const storePacketMatched = storePacketChecks.every(([label, expected]) =>
    exactPacketValue({
      values: bulletValues(storePacket, label),
      expected,
      label,
      packet: 'RC store packet',
      errors,
    }),
  );

  const privacySignoff = releaseSignoffRow(signoff, 'Security/privacy');
  const releaseSignoff = releaseSignoffRow(signoff, 'Release manager');
  const privacyReview = validation.review?.privacy;
  const releaseReview = validation.review?.release;
  const privacyMatched =
    privacySignoff !== null &&
    reviewerIdentitySha256(privacySignoff.owner) ===
      requireSha256(privacyReview?.identitySha256, 'validation.review.privacy.identitySha256') &&
    privacySignoff.date ===
      requireString(privacyReview?.reviewedAt, 'validation.review.privacy.reviewedAt').slice(0, 10);
  const releaseMatched =
    releaseSignoff !== null &&
    reviewerIdentitySha256(releaseSignoff.owner) ===
      requireSha256(releaseReview?.identitySha256, 'validation.review.release.identitySha256') &&
    releaseSignoff.date ===
      requireString(releaseReview?.reviewedAt, 'validation.review.release.reviewedAt').slice(
        0,
        10,
      ) &&
    releaseSignoff.owner === normalizeNamedSignoff(signedOffBy);
  if (!privacyMatched) {
    errors.push(
      'RC Security/privacy signoff owner/date must match the archive evidence privacy review.',
    );
  }
  if (!releaseMatched) {
    errors.push(
      'RC release-manager signoff owner/date and PHASE9_SIGNED_OFF_BY must match the archive evidence release review.',
    );
  }
  const reviewersMatched = privacyMatched && releaseMatched;
  const validated =
    errors.length === 0 &&
    reviewedEnvironmentMatched &&
    referencePathsConfined &&
    manifestMatched &&
    storePacketMatched &&
    reviewersMatched;

  return deepFreeze({
    schemaVersion: 1,
    kind: 'ios_release_candidate_cross_binding_audit',
    status: validated ? 'pass' : 'invalid',
    validated,
    reviewedEnvironmentMatched,
    referencePathsConfined,
    manifestMatched,
    storePacketMatched,
    reviewersMatched,
    errors,
  });
}
