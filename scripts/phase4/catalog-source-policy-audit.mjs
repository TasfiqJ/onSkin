#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  loadCatalogReleaseBuildEvidence,
  loadCatalogReleaseScope,
  loadCatalogSourcePolicy,
  loadCatalogSourceTrustRegistry,
  sha256,
  validateCatalogReleaseBuildEvidence,
  validateCatalogReleaseScope,
  validateCatalogSourcePolicy,
  validateCatalogSourceTrustRegistry,
  validateProductionApproval,
} from './source-policy.mjs';

const root = process.cwd();
const policyBundle = loadCatalogSourcePolicy(root);
const trustBundle = loadCatalogSourceTrustRegistry(root);
const releaseBundle = loadCatalogReleaseScope(root);
const releaseBuildBundle = loadCatalogReleaseBuildEvidence(root, {
  releaseScope: releaseBundle.scope,
  releaseScopeSha256: releaseBundle.sha256,
  trustRegistry: trustBundle.registry,
  trustRegistrySha256: trustBundle.sha256,
});
const { policy } = policyBundle;
const errors = [];

const baselineControlState =
  trustBundle.registry.status === 'pending_external_reviewer_keys' &&
  releaseBundle.scope.status === 'pending_external_identity_and_territory_approval' &&
  releaseBuildBundle.evidence.status === 'pending_eas_archive_and_app_store_evidence';
const buildCandidateControlState =
  trustBundle.registry.status === 'active' &&
  releaseBundle.scope.status === 'approved' &&
  releaseBuildBundle.evidence.status === 'pending_eas_archive_and_app_store_evidence';
const releaseControlState =
  trustBundle.registry.status === 'active' &&
  releaseBundle.scope.status === 'approved' &&
  releaseBuildBundle.evidence.status === 'verified';
const approvedSourceControlState = buildCandidateControlState || releaseControlState;
const controlMode = baselineControlState
  ? 'baseline'
  : buildCandidateControlState
    ? 'build-candidate'
    : releaseControlState
      ? 'release'
      : 'invalid';

function source(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(path, pattern, message) {
  if (!pattern.test(source(path))) errors.push(`${path}: ${message}`);
}

function forbidText(path, pattern, message) {
  if (pattern.test(source(path))) errors.push(`${path}: ${message}`);
}

function requireEmpty(label, validationErrors) {
  for (const error of validationErrors) errors.push(`${label}: ${error}`);
}

requireEmpty('catalog source policy', validateCatalogSourcePolicy(policy));
requireEmpty(
  'catalog source trust registry',
  validateCatalogSourceTrustRegistry(trustBundle.registry, {
    registrySha256: trustBundle.sha256,
    requireActive: approvedSourceControlState,
    trustedRoot: trustBundle.trustedRoot,
  }),
);
requireEmpty(
  'catalog release scope',
  validateCatalogReleaseScope(releaseBundle.scope, {
    policy,
    requireApproved: approvedSourceControlState,
  }),
);
requireEmpty(
  'catalog release build evidence',
  validateCatalogReleaseBuildEvidence(releaseBuildBundle.evidence, {
    releaseScope: releaseBundle.scope,
    releaseScopeSha256: releaseBundle.sha256,
    requireVerified: releaseControlState,
    trustRegistry: trustBundle.registry,
    trustRegistrySha256: trustBundle.sha256,
  }),
);

if (controlMode === 'invalid') {
  errors.push(
    'catalog controls must be exactly pending/pending/pending, active/approved/pending for the build candidate, or active/approved/verified for release.',
  );
}

if (
  policy.globalControls.runtimeThirdPartyCatalogRequestsAllowed !== false ||
  policy.globalControls.contributionBackAllowed !== false ||
  policy.globalControls.externalProductImagesAllowed !== false ||
  JSON.stringify(policy.globalControls.permittedLaunchTerritories) !== JSON.stringify(['US'])
) {
  errors.push('global source controls must remain offline-only, image-disabled, and US-scoped.');
}
if (
  releaseBuildBundle.evidence.status === 'pending_eas_archive_and_app_store_evidence' &&
  (releaseBuildBundle.evidence.archive !== null ||
    releaseBuildBundle.evidence.appStoreRelease !== null ||
    releaseBuildBundle.evidence.signature !== null)
) {
  errors.push('pending release build evidence must not contain invented archive/App Store proof.');
}
if (
  policy.sources.open_beauty_facts.sourceIsolationMode !==
  'separate_source_component_pending_legal_classification'
) {
  errors.push('OBF source isolation must remain neutral pending counsel classification.');
}
if (policy.sources.open_beauty_facts.productionApproved !== false) {
  errors.push('OBF policy cannot self-assert production approval.');
}
if (policy.sources.cosing.productionApproved !== false) {
  errors.push('CosIng policy cannot self-assert production approval.');
}

if (baselineControlState && trustBundle.registry.reviewers.length !== 0) {
  errors.push('pending trust registry must contain no self-issued reviewer keys.');
}
if (
  baselineControlState &&
  (releaseBundle.scope.appIdentity !== null || releaseBundle.scope.attribution !== null)
) {
  errors.push('pending release scope must not assert identity/attribution.');
}

const migration = 'supabase/migrations/20260614000026_phase4_catalog.sql';
requireText(
  migration,
  /'open_beauty_facts'[\s\S]{0,900}?true,\s*true,\s*false,\s*false,\s*'pending'/,
  'OBF seed must require attribution/share-alike and keep images/production disabled.',
);
requireText(
  migration,
  /'cosing'[\s\S]{0,800}?true,\s*false,\s*false,\s*false,\s*'pending'/,
  'CosIng seed must require attribution and keep images/production disabled.',
);

for (const path of [
  'supabase/functions/catalog-lookup/index.ts',
  'supabase/functions/catalog-search/index.ts',
]) {
  forbidText(
    path,
    /openbeautyfacts|openfoodfacts|OBF_API_ENABLED|OBF_API_URL/i,
    'runtime catalog lookup/search must not contain an OBF transport path.',
  );
}

requireText(
  'package.json',
  /"phase4:import-obf-fixture":\s*"node scripts\/phase4\/import-obf-snapshot\.mjs --fixture"/,
  'OBF fixture script must opt into fixture mode explicitly.',
);
for (const path of [
  'scripts/phase4/import-obf-snapshot.mjs',
  'scripts/phase4/import-cosing-dictionary.mjs',
]) {
  requireText(
    path,
    /loadAndValidateProductionApproval/,
    'production transforms must validate an exact-scope signed approval.',
  );
  requireText(path, /writeJsonAtomically/, 'import evidence must be written atomically.');
}
forbidText(
  'docs/phase-4/odbl-compliance-memo.md',
  /Use exact barcode API lookup only for scan-time checks/i,
  'memo must not authorize request-time OBF barcode disclosure.',
);

const transformerBySource = {
  open_beauty_facts: {
    path: 'scripts/phase4/import-obf-snapshot.mjs',
    parserVersion: 'phase4-obf-transform-v2',
  },
  cosing: {
    path: 'scripts/phase4/import-cosing-dictionary.mjs',
    parserVersion: 'phase4-cosing-transform-v2',
  },
};

for (const [sourceKey, path] of [
  ['open_beauty_facts', 'docs/phase-4/obf-source-approval.template.json'],
  ['cosing', 'docs/phase-4/cosing-source-approval.template.json'],
]) {
  const template = JSON.parse(source(path));
  const transformer = transformerBySource[sourceKey];
  const templateErrors = validateProductionApproval({
    approval: template,
    artifactSha256: 'a'.repeat(64),
    artifactBytes: 1,
    policy,
    policySha256: policyBundle.sha256,
    releaseScope: releaseBundle.scope,
    releaseScopeSha256: releaseBundle.sha256,
    sourceKey,
    transformer: {
      ...transformer,
      sha256: sha256(readFileSync(resolve(root, transformer.path))),
    },
    trustRegistry: trustBundle.registry,
    trustRegistrySha256: trustBundle.sha256,
    now: new Date(),
  });
  if (
    template.decision !== 'pending' ||
    templateErrors.length === 0 ||
    (baselineControlState &&
      !templateErrors.some((error) => error.includes('trust registry is not active'))) ||
    !templateErrors.some((error) => error.includes('source/decision is invalid')) ||
    !templateErrors.some((error) => error.includes('signature'))
  ) {
    errors.push(`${path}: checked-in template must remain pending and cryptographically invalid.`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exit(1);
}

console.log(`OK catalog source policy ${policy.policyId} (${policyBundle.sha256})`);
console.log(`OK fixed trust registry ${trustBundle.registry.registryId} (${trustBundle.sha256})`);
console.log(`OK fixed release scope ${releaseBundle.scope.scopeId} (${releaseBundle.sha256})`);
console.log(
  `OK ${controlMode} release build evidence ${releaseBuildBundle.evidence.evidenceId} (${releaseBuildBundle.sha256})`,
);
console.log(
  `OK ${controlMode} production source authorization is offline-only, exact-byte bound, and fail-closed.`,
);
