import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  APPROVAL_SIGNATURE_ENVELOPE,
  CATALOG_TRANSFORMED_PAYLOAD_CONTRACT,
  RELEASE_BUILD_EVIDENCE_SIGNATURE_ENVELOPE,
  TRUST_REGISTRY_SIGNATURE_ENVELOPE,
  approvalSigningPayload,
  assertCatalogBuildSourceCommit,
  assertSafeOutputPath,
  canonicalizeCatalogGtin,
  catalogGtinChecksumIsValid,
  catalogReleaseIdentityFromRepository,
  catalogTransformedPayloadSha256,
  canonicalJson,
  loadCatalogReleaseBuildEvidence,
  loadCatalogReleaseScope,
  loadCatalogSourcePolicy,
  loadCatalogSourceTrustRegistry,
  isCanonicalCatalogGtin,
  normalizeCatalogCosingKey,
  parseCatalogControlJson,
  parseImportArgs,
  releaseBuildEvidenceSigningPayload,
  sha256,
  trustRegistrySigningPayload,
  validateCatalogReleaseScope,
  validateCatalogReleaseBuildEvidence,
  validateCatalogSourcePolicy,
  validateCatalogSourceTrustRegistry,
  validateProductionApproval,
  writeTextFilesAtomically,
  writeTextAtomically,
} from './source-policy.mjs';

const policyBundle = loadCatalogSourcePolicy();
const { policy } = policyBundle;
const now = new Date('2026-07-16T13:00:00.000Z');
const digest = 'a'.repeat(64);
const evidenceDigest = 'e'.repeat(64);

test('CosIng authority normalization shares exact NFKC whitespace and uppercase semantics', () => {
  assert.equal(normalizeCatalogCosingKey(' A\u00a0\u2009B\ufeff '), 'A B');
  assert.equal(
    normalizeCatalogCosingKey('\uff27\uff2c\uff39\uff23\uff25\uff32\uff29\uff2e'),
    'GLYCERIN',
  );
  assert.equal(normalizeCatalogCosingKey('A\u030a'), normalizeCatalogCosingKey('\u00c5'));
  assert.equal(normalizeCatalogCosingKey('ß'), 'SS');
  assert.throws(() => normalizeCatalogCosingKey(null), /requires text/u);
});

test('catalog GTIN authority requires exact checksums and one canonical padded identity', () => {
  for (const value of ['96385074', '036000291452', '4006381333931', '10012345000017']) {
    assert.equal(catalogGtinChecksumIsValid(value), true, value);
    assert.equal(isCanonicalCatalogGtin(value), true, value);
  }
  for (const value of [null, '', '96385075', '036000291453', '4006381333932', '10012345000018']) {
    assert.equal(catalogGtinChecksumIsValid(value), false, String(value));
    assert.equal(isCanonicalCatalogGtin(value), false, String(value));
  }
  assert.equal(canonicalizeCatalogGtin('0036000291452'), '036000291452');
  assert.equal(isCanonicalCatalogGtin('0036000291452'), false);
  for (const [padded, canonical] of [
    ['00000096385074', '96385074'],
    ['00012345678905', '012345678905'],
    ['04006381333931', '4006381333931'],
  ]) {
    assert.equal(catalogGtinChecksumIsValid(padded), true, padded);
    assert.equal(canonicalizeCatalogGtin(padded), canonical, padded);
    assert.equal(isCanonicalCatalogGtin(padded), false, padded);
  }
  assert.equal(canonicalizeCatalogGtin('0360 0029 1452'), null);
});

function evidence(recordId) {
  return {
    recordId,
    uri: `https://evidence.layerwell.app/catalog/${recordId}`,
    sha256: evidenceDigest,
  };
}

function trustedReviewer(role, name, qualification) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyBytes = publicKey.export({ format: 'der', type: 'spki' });
  return {
    privateKey,
    record: {
      keyId: `${role}-reviewer-key-2026`,
      reviewerId: `${role}-reviewer-2026`,
      independenceGroup: `${role}-independent-group`,
      role,
      status: 'active',
      name,
      qualification,
      jurisdictions: ['US'],
      validFrom: '2026-07-01T00:00:00.000Z',
      validUntil: '2027-07-31T00:00:00.000Z',
      publicKeySpkiBase64: publicKeyBytes.toString('base64'),
      publicKeySha256: sha256(publicKeyBytes),
      evidence: evidence(`${role}-qualification-record`),
    },
  };
}

const legal = trustedReviewer(
  'legal',
  'Alex Counsel',
  'Licensed United States technology and database counsel',
);
const engineering = trustedReviewer(
  'engineering',
  'Morgan Engineer',
  'Catalog release and data-provenance engineering owner',
);
const rootKeyPair = generateKeyPairSync('ed25519');
const rootPublicKeyBytes = rootKeyPair.publicKey.export({ format: 'der', type: 'spki' });
const trustedRoot = {
  keyId: 'catalog-root-key-2026',
  publicKeySpkiBase64: rootPublicKeyBytes.toString('base64'),
};
const trustRegistry = {
  schemaVersion: 1,
  registryId: 'catalog-source-trust-v1',
  policyId: policy.policyId,
  epoch: 1,
  status: 'active',
  updatedAt: '2026-07-15T00:00:00.000Z',
  reviewers: [legal.record, engineering.record],
};
trustRegistry.rootSignature = {
  envelopeVersion: TRUST_REGISTRY_SIGNATURE_ENVELOPE,
  algorithm: 'Ed25519',
  keyId: trustedRoot.keyId,
  publicKeySha256: sha256(rootPublicKeyBytes),
  signedAt: trustRegistry.updatedAt,
  valueBase64: sign(
    null,
    trustRegistrySigningPayload(trustRegistry),
    rootKeyPair.privateKey,
  ).toString('base64'),
};
const trustRegistrySha256 = sha256(Buffer.from(canonicalJson(trustRegistry)));
trustedRoot.registryEpoch = trustRegistry.epoch;
trustedRoot.registrySha256 = trustRegistrySha256;

function resignRegistry(registry, root = trustedRoot, privateKey = rootKeyPair.privateKey) {
  registry.rootSignature = {
    envelopeVersion: TRUST_REGISTRY_SIGNATURE_ENVELOPE,
    algorithm: 'Ed25519',
    keyId: root.keyId,
    publicKeySha256: sha256(Buffer.from(root.publicKeySpkiBase64, 'base64')),
    signedAt: registry.updatedAt,
    valueBase64: sign(null, trustRegistrySigningPayload(registry), privateKey).toString('base64'),
  };
  return registry;
}

const releaseScope = {
  schemaVersion: 1,
  scopeId: 'catalog-release-scope-v1',
  status: 'approved',
  appIdentity: {
    displayName: 'Layerwell',
    bundleId: 'com.layerwell.app',
    version: '0.1.0',
    build: '1',
    publicHost: 'layerwell.app',
    supportEmail: 'catalog@layerwell.app',
  },
  territories: ['US'],
  attribution: { publicUrl: 'https://layerwell.app/catalog-sources' },
  approvedAt: '2026-07-15T11:00:00.000Z',
  expiresAt: '2027-07-15T11:00:00.000Z',
  evidence: {
    identity: evidence('identity-clearance-record'),
    territory: evidence('territory-clearance-record'),
    attributionSurface: evidence('attribution-surface-record'),
  },
};
const releaseScopeSha256 = sha256(Buffer.from(canonicalJson(releaseScope)));

function signedReleaseBuildEvidence(overrides = {}) {
  const buildEvidence = {
    schemaVersion: 1,
    evidenceId: 'catalog-release-build-evidence-v1',
    status: 'verified',
    releaseScope: { scopeId: releaseScope.scopeId, sha256: releaseScopeSha256 },
    trustRegistry: {
      registryId: trustRegistry.registryId,
      epoch: trustRegistry.epoch,
      sha256: trustRegistrySha256,
    },
    easBuild: {
      buildId: 'f51831f0-ea30-406a-8c5f-f8e1cc57d39c',
      profile: 'production',
      platform: 'ios',
      gitCommitSha: 'a'.repeat(40),
      resolvedExpoConfigSha256: 'b'.repeat(64),
    },
    archive: {
      bundleId: releaseScope.appIdentity.bundleId,
      shortVersion: releaseScope.appIdentity.version,
      buildNumber: releaseScope.appIdentity.build,
      ipaSha256: 'c'.repeat(64),
      infoPlistSha256: 'd'.repeat(64),
      inspectedAt: '2026-07-16T12:15:00.000Z',
    },
    territories: ['US'],
    appStoreRelease: {
      appId: '1234567890',
      bundleId: releaseScope.appIdentity.bundleId,
      version: releaseScope.appIdentity.version,
      buildNumber: releaseScope.appIdentity.build,
      territories: ['US'],
      observedAt: '2026-07-16T12:20:00.000Z',
    },
    evidence: {
      resolvedExpoConfig: evidence('resolved-expo-config'),
      easBuildMetadata: evidence('eas-build-metadata'),
      archiveInspection: evidence('archive-inspection'),
      appStoreRelease: evidence('app-store-release'),
    },
    verifiedAt: '2026-07-16T12:30:00.000Z',
    verifier: {
      keyId: engineering.record.keyId,
      reviewerId: engineering.record.reviewerId,
      publicKeySha256: engineering.record.publicKeySha256,
    },
    ...overrides,
  };
  buildEvidence.signature = {
    envelopeVersion: RELEASE_BUILD_EVIDENCE_SIGNATURE_ENVELOPE,
    algorithm: 'Ed25519',
    keyId: engineering.record.keyId,
    valueBase64: sign(
      null,
      releaseBuildEvidenceSigningPayload(buildEvidence),
      engineering.privateKey,
    ).toString('base64'),
  };
  return buildEvidence;
}

const transformers = {
  open_beauty_facts: {
    path: 'scripts/phase4/import-obf-snapshot.mjs',
    parserVersion: 'phase4-obf-transform-v2',
    sha256: 'b'.repeat(64),
  },
  cosing: {
    path: 'scripts/phase4/import-cosing-dictionary.mjs',
    parserVersion: 'phase4-cosing-transform-v2',
    sha256: 'c'.repeat(64),
  },
};

function signedApproval(sourceKey, overrides = {}) {
  const source = policy.sources[sourceKey];
  const noticeText =
    sourceKey === 'open_beauty_facts'
      ? 'Product database facts are derived from Open Beauty Facts under ODbL 1.0; source limitations and changes are disclosed here.'
      : 'Ingredient reference names are derived from the European Commission CosIng database; this is informative and is not approval or safety advice.';
  const approval = {
    schemaVersion: 1,
    signatureEnvelopeVersion: APPROVAL_SIGNATURE_ENVELOPE,
    policyId: policy.policyId,
    policySha256: policyBundle.sha256,
    trustRegistry: {
      registryId: trustRegistry.registryId,
      sha256: trustRegistrySha256,
    },
    releaseScope: {
      scopeId: releaseScope.scopeId,
      sha256: releaseScopeSha256,
    },
    transformer: { ...transformers[sourceKey] },
    sourceKey,
    decision: 'approved',
    reviewId: `catalog-source-${sourceKey}-review-2026-07`,
    decisionEvidence: evidence(`${sourceKey}-signed-decision`),
    reviewedAt: '2026-07-15T12:10:00.000Z',
    expiresAt: '2027-07-15T10:00:00.000Z',
    artifact: {
      sha256: digest,
      bytes: 123,
      snapshotDate: '2026-07-14',
      sourceUrl:
        sourceKey === 'open_beauty_facts'
          ? 'https://static.openfoodfacts.org/data/openbeautyfacts-products.jsonl.gz'
          : 'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en',
      upstreamSha256: 'd'.repeat(64),
      acquisitionEvidenceUri: `https://evidence.layerwell.app/catalog/${sourceKey}-acquisition`,
      acquisitionEvidenceSha256: evidenceDigest,
      transformationRecordContractId: CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.contractId,
      transformationRecordSha256: 'f'.repeat(64),
    },
    termsSnapshot: {
      capturedAt: '2026-07-15T10:00:00.000Z',
      sourceUrls: [...source.requiredTermsUrls],
      evidence: evidence(`${sourceKey}-terms-snapshot`),
    },
    attribution: {
      publicUrl: releaseScope.attribution.publicUrl,
      copyApproved: true,
      noticeLocale: 'en-US',
      noticeText,
      noticeSha256: sha256(noticeText),
      publicSurfaceArtifactSha256: '1'.repeat(64),
      publicSurfaceEvidenceUri: 'https://evidence.layerwell.app/catalog/attribution-render',
      sourceDatabaseUrl: source.sourceUrl,
      ...(sourceKey === 'open_beauty_facts'
        ? {
            machineReadableDelivery: {
              status: 'deployed_before_production_promotion',
              publicUrl: 'https://layerwell.app/catalog-sources/open-beauty-facts-data',
              owner: 'Catalog source compliance owner',
              artifactSha256: '2'.repeat(64),
              evidence: evidence('obf-machine-readable-delivery'),
            },
          }
        : {}),
    },
    scope: {
      appIdentity: { ...releaseScope.appIdentity },
      territories: [...releaseScope.territories],
      fields: [...source.allowedFields],
    },
    determinations: {
      ...source.requiredDeterminations,
      ...(sourceKey === 'open_beauty_facts'
        ? {
            databaseClassification: 'derivative_database',
            shareAlikeImplementation: 'entire_derivative_or_alterations_machine_readable',
          }
        : {}),
    },
    operations: {
      sourceObligationOwner: 'Catalog source compliance owner',
      correctionOwner: 'Catalog corrections owner',
      correctionSlaDays: 7,
      sourceObligationEvidence: evidence(`${sourceKey}-obligation-runbook`),
      correctionRunbookEvidence: evidence(`${sourceKey}-correction-runbook`),
    },
    controls: {
      offlineImportOnly: true,
      imagesIncluded: false,
      runtimeRequests: false,
      contributionBack: false,
      databaseComponentId: source.componentId,
    },
    allowedUses: [...source.requiredProductionUses],
    forbiddenUses: [...source.forbiddenProductionUses],
    reviewers: {
      legal: {
        keyId: legal.record.keyId,
        reviewerId: legal.record.reviewerId,
        independenceGroup: legal.record.independenceGroup,
        publicKeySha256: legal.record.publicKeySha256,
        name: legal.record.name,
        qualification: legal.record.qualification,
        approvedAt: '2026-07-15T12:00:00.000Z',
      },
      engineering: {
        keyId: engineering.record.keyId,
        reviewerId: engineering.record.reviewerId,
        independenceGroup: engineering.record.independenceGroup,
        publicKeySha256: engineering.record.publicKeySha256,
        name: engineering.record.name,
        qualification: engineering.record.qualification,
        approvedAt: '2026-07-15T12:05:00.000Z',
      },
    },
    ...overrides,
  };
  approval.signatures = {
    legal: {
      algorithm: 'Ed25519',
      keyId: legal.record.keyId,
      valueBase64: sign(null, approvalSigningPayload(approval), legal.privateKey).toString(
        'base64',
      ),
    },
    engineering: {
      algorithm: 'Ed25519',
      keyId: engineering.record.keyId,
      valueBase64: sign(null, approvalSigningPayload(approval), engineering.privateKey).toString(
        'base64',
      ),
    },
  };
  return approval;
}

function validationArgs(sourceKey, approval) {
  return {
    approval,
    artifactSha256: digest,
    artifactBytes: 123,
    policy,
    policySha256: policyBundle.sha256,
    releaseScope,
    releaseRuntimeIdentity: releaseScope.appIdentity,
    releaseScopeSha256,
    sourceKey,
    transformer: transformers[sourceKey],
    transformedPayloadSha256: 'f'.repeat(64),
    trustRegistry,
    trustRegistrySha256,
    trustRoot: trustedRoot,
    now,
  };
}

test('checked-in policy is fail-closed and fixed release/trust files remain pending', () => {
  assert.deepEqual(validateCatalogSourcePolicy(policy), []);
  assert.equal(policy.globalControls.runtimeThirdPartyCatalogRequestsAllowed, false);
  assert.deepEqual(policy.globalControls.permittedLaunchTerritories, ['US']);
  assert.equal(policy.sources.open_beauty_facts.licenses.images.allowed, false);
  assert.equal(loadCatalogSourceTrustRegistry().registry.status, 'pending_external_reviewer_keys');
  assert.equal(
    loadCatalogReleaseScope().scope.status,
    'pending_external_identity_and_territory_approval',
  );
});

test('mock trust registry and release scope satisfy the strict contracts', () => {
  assert.deepEqual(
    validateCatalogSourceTrustRegistry(trustRegistry, {
      now,
      registrySha256: trustRegistrySha256,
      trustedRoot,
    }),
    [],
  );
  assert.deepEqual(validateCatalogReleaseScope(releaseScope, { policy, now }), []);
  for (const invalidBuild of ['0', '01', '1'.repeat(19)]) {
    const invalidScope = structuredClone(releaseScope);
    invalidScope.appIdentity.build = invalidBuild;
    assert.ok(
      validateCatalogReleaseScope(invalidScope, { policy, now }).some((error) =>
        error.includes('1-18 digit positive decimal'),
      ),
    );
  }
  const placeholderSupportScope = structuredClone(releaseScope);
  placeholderSupportScope.appIdentity.supportEmail = 'pending@example.com';
  assert.ok(
    validateCatalogReleaseScope(placeholderSupportScope, { policy, now }).some((error) =>
      error.includes('supportEmail'),
    ),
  );
});

test('release identity is derived from production Expo/EAS inputs and repository version', () => {
  const gitHead = execFileSync(
    'git',
    ['-c', `safe.directory=${process.cwd()}`, 'rev-parse', 'HEAD'],
    { encoding: 'utf8' },
  ).trim();
  const env = {
    APP_VARIANT: 'production',
    EXPO_PUBLIC_APP_ENV: 'production',
    APP_DISPLAY_NAME: releaseScope.appIdentity.displayName,
    APP_IOS_BUNDLE_IDENTIFIER: releaseScope.appIdentity.bundleId,
    CATALOG_RELEASE_IOS_BUILD_NUMBER: releaseScope.appIdentity.build,
    EXPO_PUBLIC_FINAL_BRAND_DOMAIN: `https://${releaseScope.appIdentity.publicHost}`,
    EXPO_PUBLIC_SUPPORT_EMAIL: releaseScope.appIdentity.supportEmail,
    CATALOG_RELEASE_TERRITORIES: 'US',
    EAS_BUILD_PROFILE: 'production',
    EAS_BUILD_PLATFORM: 'ios',
    EAS_BUILD_ID: 'f51831f0-ea30-406a-8c5f-f8e1cc57d39c',
    EAS_BUILD_GIT_COMMIT_HASH: gitHead,
  };
  const resolvedExpoConfig = {
    name: releaseScope.appIdentity.displayName,
    version: releaseScope.appIdentity.version,
    ios: {
      bundleIdentifier: releaseScope.appIdentity.bundleId,
      buildNumber: releaseScope.appIdentity.build,
    },
    extra: {
      appVariant: 'production',
      appEnvironment: 'production',
      publicLinkDomain: releaseScope.appIdentity.publicHost,
      supportEmail: releaseScope.appIdentity.supportEmail,
    },
  };
  assert.deepEqual(
    catalogReleaseIdentityFromRepository(process.cwd(), env, { resolvedExpoConfig }),
    releaseScope.appIdentity,
  );
  assert.deepEqual(
    catalogReleaseIdentityFromRepository(
      process.cwd(),
      { ...env, EXPO_PUBLIC_FINAL_BRAND_DOMAIN: releaseScope.appIdentity.publicHost },
      { resolvedExpoConfig },
    ),
    releaseScope.appIdentity,
  );
  const releaseWithEvidence = catalogReleaseIdentityFromRepository(process.cwd(), env, {
    includeEvidence: true,
    resolvedExpoConfig,
  });
  assert.deepEqual(releaseWithEvidence.easBuild, {
    buildId: env.EAS_BUILD_ID,
    profile: 'production',
    platform: 'ios',
    gitCommitSha: gitHead,
    resolvedExpoConfigSha256: releaseWithEvidence.resolvedExpoConfigSha256,
  });
  assert.throws(
    () =>
      catalogReleaseIdentityFromRepository(
        process.cwd(),
        { ...env, APP_VARIANT: 'staging' },
        { resolvedExpoConfig },
      ),
    /production Expo\/EAS variant/,
  );
  for (const invalidEnv of [
    { EAS_BUILD_ID: 'not-a-uuid' },
    { EAS_BUILD_ID: env.EAS_BUILD_ID.toUpperCase() },
    { EAS_BUILD_GIT_COMMIT_HASH: gitHead.toUpperCase() },
  ]) {
    assert.throws(
      () =>
        catalogReleaseIdentityFromRepository(
          process.cwd(),
          { ...env, ...invalidEnv },
          { resolvedExpoConfig },
        ),
      /exact EAS iOS production build ID\/profile\/commit metadata/,
    );
  }
  assert.throws(
    () =>
      catalogReleaseIdentityFromRepository(
        process.cwd(),
        {
          ...env,
          EXPO_PUBLIC_FINAL_BRAND_DOMAIN: `http://${releaseScope.appIdentity.publicHost}`,
        },
        { resolvedExpoConfig },
      ),
    /does not match the exact catalog release identity/,
  );
});

test('release build evidence binds signed EAS, archive, and App Store territory proof', () => {
  const buildEvidence = signedReleaseBuildEvidence();
  assert.deepEqual(
    validateCatalogReleaseBuildEvidence(buildEvidence, {
      releaseScope,
      releaseScopeSha256,
      trustRegistry,
      trustRegistrySha256,
      now,
    }),
    [],
  );
  buildEvidence.archive.buildNumber = '999';
  const errors = validateCatalogReleaseBuildEvidence(buildEvidence, {
    releaseScope,
    releaseScopeSha256,
    trustRegistry,
    trustRegistrySha256,
    now,
  });
  assert.ok(errors.some((error) => error.includes('archive identity/hash')));
  assert.ok(errors.some((error) => error.includes('signature is invalid')));

  const wrongAppStoreRecord = signedReleaseBuildEvidence();
  wrongAppStoreRecord.appStoreRelease.bundleId = 'com.unrelated.app';
  const appStoreErrors = validateCatalogReleaseBuildEvidence(wrongAppStoreRecord, {
    releaseScope,
    releaseScopeSha256,
    trustRegistry,
    trustRegistrySha256,
    now,
  });
  assert.ok(appStoreErrors.some((error) => error.includes('app identity is invalid')));
  assert.ok(appStoreErrors.some((error) => error.includes('signature is invalid')));

  const malformedCases = [
    signedReleaseBuildEvidence({
      easBuild: {
        ...signedReleaseBuildEvidence().easBuild,
        buildId: 'not-a-uuid',
      },
    }),
    signedReleaseBuildEvidence({
      easBuild: {
        ...signedReleaseBuildEvidence().easBuild,
        gitCommitSha: 'A'.repeat(40),
      },
    }),
    signedReleaseBuildEvidence({
      archive: {
        ...signedReleaseBuildEvidence().archive,
        buildNumber: '01',
      },
    }),
    signedReleaseBuildEvidence({
      appStoreRelease: {
        ...signedReleaseBuildEvidence().appStoreRelease,
        appId: '0123456789',
      },
    }),
  ];
  for (const malformed of malformedCases) {
    assert.notDeepEqual(
      validateCatalogReleaseBuildEvidence(malformed, {
        releaseScope,
        releaseScopeSha256,
        trustRegistry,
        trustRegistrySha256,
        now,
      }),
      [],
    );
  }
  const contradictoryExtra = signedReleaseBuildEvidence({
    appStoreRelease: {
      ...signedReleaseBuildEvidence().appStoreRelease,
      available: false,
    },
  });
  assert.ok(
    validateCatalogReleaseBuildEvidence(contradictoryExtra, {
      releaseScope,
      releaseScopeSha256,
      trustRegistry,
      trustRegistrySha256,
      now,
    }).some((error) => error.includes('appStoreRelease contains missing or unsupported fields')),
  );
});

test('release build verification cannot predate its fixed release authority', () => {
  const lateReleaseScope = structuredClone(releaseScope);
  lateReleaseScope.approvedAt = '2026-07-16T12:45:00.000Z';
  const lateReleaseScopeSha256 = sha256(Buffer.from(canonicalJson(lateReleaseScope)));
  const buildEvidence = signedReleaseBuildEvidence({
    releaseScope: {
      scopeId: lateReleaseScope.scopeId,
      sha256: lateReleaseScopeSha256,
    },
  });
  const errors = validateCatalogReleaseBuildEvidence(buildEvidence, {
    releaseScope: lateReleaseScope,
    releaseScopeSha256: lateReleaseScopeSha256,
    trustRegistry,
    trustRegistrySha256,
    now,
  });
  assert.ok(errors.some((error) => error.includes('predates its release-scope')));
  assert.ok(!errors.some((error) => error.includes('signature is invalid')));
});

test('verified release build evidence loads with its exact release and trust bindings', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'catalog-release-build-loader-'));
  try {
    mkdirSync(join(tempRoot, 'docs', 'phase-4'), { recursive: true });
    writeFileSync(
      join(tempRoot, 'docs', 'phase-4', 'catalog-release-build-evidence.json'),
      `${JSON.stringify(signedReleaseBuildEvidence(), null, 2)}\n`,
    );
    const bundle = loadCatalogReleaseBuildEvidence(tempRoot, {
      releaseScope,
      releaseScopeSha256,
      requireVerified: true,
      trustRegistry,
      trustRegistrySha256,
      now,
    });
    assert.equal(bundle.evidence.status, 'verified');
    assert.match(bundle.sha256, /^[0-9a-f]{64}$/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('build-source commit permits only the fixed post-build evidence descendants', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'catalog-build-source-'));
  const git = (...args) =>
    execFileSync('git', ['-c', `safe.directory=${tempRoot}`, ...args], {
      cwd: tempRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('init');
    git('config', 'user.email', 'catalog-test@layerwell.app');
    git('config', 'user.name', 'Catalog Test');
    mkdirSync(join(tempRoot, 'docs', 'phase-4'), { recursive: true });
    writeFileSync(join(tempRoot, 'source.txt'), 'build source\n');
    writeFileSync(
      join(tempRoot, 'docs', 'phase-4', 'catalog-release-build-evidence.json'),
      '{"status":"pending"}\n',
    );
    git('add', '.');
    git('commit', '-m', 'build source');
    const sourceCommitSha = git('rev-parse', 'HEAD');

    writeFileSync(
      join(tempRoot, 'docs', 'phase-4', 'catalog-release-build-evidence.json'),
      '{"status":"verified"}\n',
    );
    git('add', 'docs/phase-4/catalog-release-build-evidence.json');
    git('commit', '-m', 'build evidence');
    assert.deepEqual(assertCatalogBuildSourceCommit(tempRoot, sourceCommitSha).changedPaths, [
      'docs/phase-4/catalog-release-build-evidence.json',
    ]);

    writeFileSync(join(tempRoot, 'source.txt'), 'changed after build\n');
    git('add', 'source.txt');
    git('commit', '-m', 'disallowed source change');
    writeFileSync(join(tempRoot, 'source.txt'), 'build source\n');
    git('add', 'source.txt');
    git('commit', '-m', 'revert disallowed source change');
    assert.throws(
      () => assertCatalogBuildSourceCommit(tempRoot, sourceCommitSha),
      /non-evidence descendants:[\s\S]*source\.txt/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('build-source commit cannot hide a source deletion as an evidence-path rename', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'catalog-build-rename-'));
  const git = (...args) =>
    execFileSync('git', ['-c', `safe.directory=${tempRoot}`, ...args], {
      cwd: tempRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('init');
    git('config', 'user.email', 'catalog-test@layerwell.app');
    git('config', 'user.name', 'Catalog Test');
    mkdirSync(join(tempRoot, 'docs', 'phase-4', 'generated'), { recursive: true });
    writeFileSync(join(tempRoot, 'source.txt'), 'build source\n');
    git('add', '.');
    git('commit', '-m', 'build source');
    const sourceCommitSha = git('rev-parse', 'HEAD');

    git('mv', 'source.txt', 'docs/phase-4/generated/catalog-qa-report.md');
    git('commit', '-m', 'rename source into evidence path');
    assert.throws(
      () => assertCatalogBuildSourceCommit(tempRoot, sourceCommitSha),
      /non-evidence descendants:[\s\S]*source\.txt/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('control JSON rejects duplicate security keys before JSON.parse canonicalization', () => {
  assert.throws(
    () =>
      parseCatalogControlJson(
        Buffer.from('{"decision":"pending","decision":"approved"}'),
        'duplicate-key test',
      ),
    /duplicate JSON key decision/,
  );
  assert.throws(
    () =>
      parseCatalogControlJson(
        Buffer.from(String.raw`{"decision":"pending","\u0064ecision":"approved"}`),
        'escaped duplicate-key test',
      ),
    /duplicate JSON key decision/,
  );
});

test('transformed payload contract versions pre-snapshot records and rejects ambiguous enrichment', () => {
  assert.equal(CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.contractId, 'catalog-transformed-payload-v1');
  assert.deepEqual(CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.excludedRecordFields, [
    'sourceSnapshotDate',
  ]);
  assert.equal(
    CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.sourceSnapshotDateBinding.signedApprovalPath,
    'artifact.snapshotDate',
  );
  const payload = {
    controls: { runtimeRequests: false },
    inputSha256: digest,
    parserVersion: 'test-parser-v1',
    projectedFields: ['code'],
    records: [{ barcode: '12345678' }],
    sourceComponentId: policy.sources.open_beauty_facts.componentId,
    sourceIsolationMode: policy.sources.open_beauty_facts.sourceIsolationMode,
    sourceKey: 'open_beauty_facts',
  };
  assert.match(catalogTransformedPayloadSha256(payload), /^[0-9a-f]{64}$/);
  assert.throws(
    () =>
      catalogTransformedPayloadSha256({
        ...payload,
        records: [{ ...payload.records[0], sourceSnapshotDate: '2026-07-16' }],
      }),
    /hashed before sourceSnapshotDate enrichment/,
  );
});

test('source policy rejects broadened hosts, paths, fields, limits, and legal invariants', () => {
  const mutated = structuredClone(policy);
  mutated.sources.open_beauty_facts.allowedSnapshotPathPrefixes = ['/'];
  mutated.sources.open_beauty_facts.requiredDeterminations = {};
  mutated.sources.cosing.allowedFields.push('unreviewed_claim');
  mutated.sources.cosing.transformLimits.maxArtifactBytes = Number.MAX_SAFE_INTEGER;
  const errors = validateCatalogSourcePolicy(mutated);
  assert.ok(errors.some((error) => error.includes('allowedSnapshotPathPrefixes')));
  assert.ok(errors.some((error) => error.includes('requiredDeterminations')));
  assert.ok(errors.some((error) => error.includes('allowedFields')));
  assert.ok(errors.some((error) => error.includes('maxArtifactBytes')));
});

test('active trust registry rejects absent root anchoring and unsigned mutation', () => {
  assert.ok(
    validateCatalogSourceTrustRegistry(trustRegistry, { now }).some((error) =>
      error.includes('externally supplied trust-root'),
    ),
  );
  const tampered = structuredClone(trustRegistry);
  tampered.reviewers[0].qualification = 'Attacker-edited qualification';
  assert.ok(
    validateCatalogSourceTrustRegistry(tampered, { now, trustedRoot }).some((error) =>
      error.includes('root signature is invalid'),
    ),
  );
});

test('externally pinned registry epoch/hash rejects replay of an older valid root signature', () => {
  const replayed = structuredClone(trustRegistry);
  replayed.epoch = 1;
  replayed.updatedAt = '2026-07-14T00:00:00.000Z';
  resignRegistry(replayed);
  const replayedSha256 = sha256(Buffer.from(canonicalJson(replayed)));
  assert.ok(
    validateCatalogSourceTrustRegistry(replayed, {
      now,
      registrySha256: replayedSha256,
      trustedRoot,
    }).some((error) => error.includes('externally pinned current epoch/hash')),
  );
});

test('trust registry enforces real Ed25519 keys, minimal DER, and role independence', () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const rsaBytes = rsa.publicKey.export({ format: 'der', type: 'spki' });
  const rsaRegistry = structuredClone(trustRegistry);
  rsaRegistry.reviewers[1].publicKeySpkiBase64 = rsaBytes.toString('base64');
  rsaRegistry.reviewers[1].publicKeySha256 = sha256(rsaBytes);
  resignRegistry(rsaRegistry);
  assert.ok(
    validateCatalogSourceTrustRegistry(rsaRegistry, { now, trustedRoot }).some((error) =>
      error.includes('not valid Ed25519'),
    ),
  );

  const trailingDer = Buffer.concat([
    Buffer.from(engineering.record.publicKeySpkiBase64, 'base64'),
    Buffer.from([0]),
  ]);
  const trailingRegistry = structuredClone(trustRegistry);
  trailingRegistry.reviewers[1].publicKeySpkiBase64 = trailingDer.toString('base64');
  trailingRegistry.reviewers[1].publicKeySha256 = sha256(trailingDer);
  resignRegistry(trailingRegistry);
  assert.ok(
    validateCatalogSourceTrustRegistry(trailingRegistry, { now, trustedRoot }).some((error) =>
      error.includes('not valid Ed25519'),
    ),
  );

  const aliased = structuredClone(trustRegistry);
  aliased.reviewers[1].publicKeySpkiBase64 = aliased.reviewers[0].publicKeySpkiBase64;
  aliased.reviewers[1].publicKeySha256 = aliased.reviewers[0].publicKeySha256;
  aliased.reviewers[1].independenceGroup = aliased.reviewers[0].independenceGroup;
  resignRegistry(aliased);
  const aliasErrors = validateCatalogSourceTrustRegistry(aliased, { now, trustedRoot });
  assert.ok(aliasErrors.some((error) => error.includes('fingerprint is duplicated')));
  assert.ok(aliasErrors.some((error) => error.includes('independent reviewer groups')));
});

test('trust registry rejects stale/future attestations and non-current reviewer keys', () => {
  const stale = structuredClone(trustRegistry);
  stale.updatedAt = '2024-07-01T00:00:00.000Z';
  resignRegistry(stale);
  assert.ok(
    validateCatalogSourceTrustRegistry(stale, { now, trustedRoot }).some((error) =>
      error.includes('older than 366 days'),
    ),
  );

  const future = structuredClone(trustRegistry);
  future.updatedAt = '2027-07-01T00:00:00.000Z';
  resignRegistry(future);
  assert.ok(
    validateCatalogSourceTrustRegistry(future, { now, trustedRoot }).some((error) =>
      error.includes('future-dated'),
    ),
  );

  const expiredKey = structuredClone(trustRegistry);
  expiredKey.reviewers[0].validUntil = '2026-07-16T12:59:59.000Z';
  resignRegistry(expiredKey);
  assert.ok(
    validateCatalogSourceTrustRegistry(expiredKey, { now, trustedRoot }).some((error) =>
      error.includes('active key is not currently valid'),
    ),
  );
});

test('checked-in fixture hashes are exactly denied by the production policy', () => {
  assert.equal(
    sha256(readFileSync('scripts/phase4/fixtures/obf-sample.jsonl')),
    policy.sources.open_beauty_facts.forbiddenProductionArtifactSha256[0],
  );
  assert.equal(
    sha256(readFileSync('scripts/phase4/fixtures/cosing-sample.csv')),
    policy.sources.cosing.forbiddenProductionArtifactSha256[0],
  );
});

for (const sourceKey of ['open_beauty_facts', 'cosing']) {
  test(`${sourceKey} accepts an exact-scope approval signed by distinct trusted keys`, () => {
    const approval = signedApproval(sourceKey);
    assert.deepEqual(validateProductionApproval(validationArgs(sourceKey, approval)), []);
  });

  test(`${sourceKey} rejects content tampering after signatures are issued`, () => {
    const approval = signedApproval(sourceKey);
    approval.controls.imagesIncluded = true;
    approval.scope.appIdentity.bundleId = 'com.unrelated.app';
    const errors = validateProductionApproval(validationArgs(sourceKey, approval));
    assert.ok(errors.some((error) => error.includes('imagesIncluded')));
    assert.ok(errors.some((error) => error.includes('fixed release scope')));
    assert.ok(errors.some((error) => error.includes('signature is invalid')));
  });
}

test('approval rejects transformed-output drift, stale-at-import snapshots, and bad chronology', () => {
  const sourceKey = 'open_beauty_facts';
  const valid = signedApproval(sourceKey);
  const payloadErrors = validateProductionApproval({
    ...validationArgs(sourceKey, valid),
    transformedPayloadSha256: '0'.repeat(64),
  });
  assert.ok(payloadErrors.some((error) => error.includes('exact transformed payload')));

  const wrongContract = signedApproval(sourceKey);
  wrongContract.artifact.transformationRecordContractId = 'catalog-transformed-payload-v0';
  const contractErrors = validateProductionApproval(validationArgs(sourceKey, wrongContract));
  assert.ok(contractErrors.some((error) => error.includes('transformed-payload contract')));
  assert.ok(contractErrors.some((error) => error.includes('signature is invalid')));

  const staleBase = signedApproval(sourceKey);
  const stale = signedApproval(sourceKey, {
    artifact: { ...staleBase.artifact, snapshotDate: '2026-05-01' },
  });
  assert.ok(
    validateProductionApproval(validationArgs(sourceKey, stale)).some((error) =>
      error.includes('too stale'),
    ),
  );

  const tooLong = signedApproval(sourceKey, { expiresAt: '2027-08-01T10:00:00.000Z' });
  const chronologyErrors = validateProductionApproval(validationArgs(sourceKey, tooLong));
  assert.ok(chronologyErrors.some((error) => error.includes('release-scope validity')));
  assert.ok(chronologyErrors.some((error) => error.includes('reviewer key validity')));
});

test('production approval rejects known fixture bytes even if a trusted envelope names them', () => {
  const sourceKey = 'open_beauty_facts';
  const fixtureHash = policy.sources[sourceKey].forbiddenProductionArtifactSha256[0];
  const approval = signedApproval(sourceKey, {
    artifact: {
      ...signedApproval(sourceKey).artifact,
      sha256: fixtureHash,
    },
  });
  const errors = validateProductionApproval({
    ...validationArgs(sourceKey, approval),
    artifactSha256: fixtureHash,
  });
  assert.ok(errors.some((error) => error.includes('fixture bytes')));
});

test('revocation and policy/transform drift invalidate an existing signed approval', () => {
  const sourceKey = 'open_beauty_facts';
  const approval = signedApproval(sourceKey);
  const revokedRegistry = structuredClone(trustRegistry);
  revokedRegistry.reviewers[0].status = 'revoked';
  const errors = validateProductionApproval({
    ...validationArgs(sourceKey, approval),
    policySha256: '9'.repeat(64),
    transformer: { ...transformers[sourceKey], sha256: '8'.repeat(64) },
    trustRegistry: revokedRegistry,
  });
  assert.ok(errors.some((error) => error.includes('policy identity/hash')));
  assert.ok(errors.some((error) => error.includes('transformer/parser')));
  assert.ok(errors.some((error) => error.includes('active trusted legal key')));
});

test('evidence outputs reject junction escapes and atomically refuse clobber races', (context) => {
  const artifactRoot = resolve('artifacts/phase4');
  mkdirSync(artifactRoot, { recursive: true });
  const outDir = mkdtempSync(join(artifactRoot, 'source-policy-test-'));
  const outside = mkdtempSync(join(tmpdir(), 'source-policy-outside-'));
  const inputPath = resolve(outDir, 'input.jsonl');
  const outputPath = resolve(outDir, 'output.json');
  writeFileSync(inputPath, '{}\n', { flag: 'wx' });
  try {
    const safeOutput = assertSafeOutputPath({
      inputPath,
      mode: 'production',
      outputPath,
      root: process.cwd(),
    });
    writeTextAtomically(safeOutput, 'first\n');
    assert.throws(() => writeTextAtomically(safeOutput, 'second\n'), /EEXIST|exist/i);

    const pairFirst = resolve(outDir, 'pair-first.json');
    const pairSecond = resolve(outDir, 'pair-second.md');
    writeFileSync(pairSecond, 'pre-existing\n', { flag: 'wx' });
    assert.throws(
      () =>
        writeTextFilesAtomically([
          { path: pairFirst, content: 'first\n' },
          { path: pairSecond, content: 'second\n' },
        ]),
      /EEXIST|exist/i,
    );
    assert.equal(existsSync(pairFirst), false);
    assert.equal(readFileSync(pairSecond, 'utf8'), 'pre-existing\n');

    const junction = resolve(outDir, 'escape-junction');
    try {
      symlinkSync(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (error?.code === 'EPERM' || error?.code === 'EACCES') {
        context.diagnostic('junction creation unavailable; escape assertion skipped by platform');
        return;
      }
      throw error;
    }
    assert.throws(
      () =>
        assertSafeOutputPath({
          inputPath,
          mode: 'production',
          outputPath: resolve(junction, 'escaped.json'),
          root: process.cwd(),
        }),
      /real directory|outside the canonical workspace root/,
    );
  } finally {
    rmSync(outDir, { force: true, recursive: true });
    rmSync(outside, { force: true, recursive: true });
  }
});

test('import CLI requires one explicit mode and explicit production paths', () => {
  assert.throws(() => parseImportArgs([], { input: 'in', output: 'out' }), /Choose/);
  assert.throws(
    () => parseImportArgs(['--fixture', '--fixture'], { input: 'in', output: 'out' }),
    /exactly once/,
  );
  assert.throws(
    () => parseImportArgs(['--production', 'input.jsonl'], { input: 'in', output: 'out' }),
    /explicit input and output/,
  );
  assert.equal(
    parseImportArgs(['--fixture', 'input.jsonl', 'output.json'], {
      input: 'in',
      output: 'out',
    }).mode,
    'fixture',
  );
});
