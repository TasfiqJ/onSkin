import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { summarizeDatabaseTypes } from './database-types-contract-lib.mjs';

export const DB06_EVIDENCE_SCHEMA_VERSION = 1;
export const DB06_RETENTION_CLASS = 'release-qa';
export const DB06_CURRENT_SOURCE_CONTRACT = Object.freeze({
  migrationCount: 97,
  latestMigrationId: '20261010000081',
  functionCount: 18,
  // Historical 0072 replay only; do not treat this as a verified 0078 count.
  publicTableCount: 82,
  storageBucketCount: 1,
});
export const DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS = 12 * 60 * 60_000;
export const DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS = 7 * 60 * 60_000;

export const SCHEMA_INVENTORY_FIELDS = Object.freeze([
  ['public_tables', 'publicTableCount'],
  ['public_rls_tables', 'publicRlsTableCount'],
  ['public_views', 'publicViewCount'],
  ['public_materialized_views', 'publicMaterializedViewCount'],
  ['public_functions', 'publicFunctionCount'],
  ['public_indexes', 'publicIndexCount'],
  ['public_triggers', 'publicTriggerCount'],
  ['public_policies', 'publicPolicyCount'],
  ['public_enums', 'publicEnumCount'],
  ['public_other_objects', 'publicOtherObjectCount'],
  ['auth_users', 'authUserCount'],
  ['auth_identities', 'authIdentityCount'],
  ['apple_identities', 'appleIdentityCount'],
  ['auth_sessions', 'authSessionCount'],
  ['storage_buckets', 'storageBucketCount'],
  ['storage_objects', 'storageObjectCount'],
]);

export const CRON_INVENTORY_FIELDS = Object.freeze([
  ['account_deletion_cron_jobs', 'accountDeletionCronJobCount'],
  ['health_consent_cron_jobs', 'healthConsentCronJobCount'],
  ['apple_auth_cron_jobs', 'appleAuthCronJobCount'],
  ['relevant_cron_jobs', 'relevantCronJobCount'],
  ['all_cron_jobs', 'allCronJobCount'],
]);

export const PROTECTED_MIGRATION_BOUNDARIES = Object.freeze([
  ['20260713000048', 'accountDeletion'],
  ['20260713000052', 'publicationFence'],
  ['20260714000053', 'entitlementAuthority'],
  ['20260715000054', 'healthConsent'],
  ['20260715000055', 'appleAuth'],
]);

const SAFE_ROLE = /^[a-z][a-z0-9-]{2,63}$/u;
const SAFE_EVIDENCE_ID = /^db06-staging-\d{8}T\d{6}Z-[0-9a-f]{7,12}(?:-[a-z0-9-]{1,24})?$/u;
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/u;
const SAFE_LOCAL_EVIDENCE_REFERENCE =
  /^(?:artifact|change|checkpoint|evidence|review|ticket)-[A-Za-z0-9][A-Za-z0-9._/-]{5,151}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_SHA = /^[0-9a-f]{40}$/u;
const PROJECT_REF_SUFFIX = /^[a-z0-9]{4}$/u;
const MIGRATION_ID = /^\d{14}$/u;
const MIGRATION_FILE = /^(\d{14})_[a-z0-9_]+\.sql$/u;
const SECRET_NAME = /^[A-Z][A-Z0-9_]{1,127}$/u;
const AUTH_EXTERNAL_ENABLED_FIELDS = Object.freeze([
  'external_anonymous_users_enabled',
  'external_apple_enabled',
  'external_azure_enabled',
  'external_bitbucket_enabled',
  'external_discord_enabled',
  'external_email_enabled',
  'external_facebook_enabled',
  'external_figma_enabled',
  'external_github_enabled',
  'external_gitlab_enabled',
  'external_google_enabled',
  'external_kakao_enabled',
  'external_keycloak_enabled',
  'external_linkedin_oidc_enabled',
  'external_notion_enabled',
  'external_phone_enabled',
  'external_slack_enabled',
  'external_slack_oidc_enabled',
  'external_spotify_enabled',
  'external_twitch_enabled',
  'external_twitter_enabled',
  'external_web3_ethereum_enabled',
  'external_web3_solana_enabled',
  'external_workos_enabled',
  'external_x_enabled',
  'external_zoom_enabled',
]);
const AUTH_HOOK_ENABLED_FIELDS = Object.freeze([
  'hook_after_user_created_enabled',
  'hook_before_user_created_enabled',
  'hook_custom_access_token_enabled',
  'hook_mfa_verification_attempt_enabled',
  'hook_password_verification_attempt_enabled',
  'hook_send_email_enabled',
  'hook_send_sms_enabled',
]);
const REQUIRED_CUTOVER_ATTESTATION_ROLES = Object.freeze([
  'privacy-reviewer',
  'release-owner',
  'rollback-owner',
  'security-reviewer',
]);
const DB06_FEATURE_IDS = Object.freeze([
  'F-01',
  'F-02',
  'F-03',
  'F-04',
  'F-05',
  'F-06',
  'F-07',
  'F-08',
  'F-09',
  'F-10',
  'F-11',
  'F-12',
  'F-13',
  'F-14',
  'F-15',
  'F-16',
  'F-17',
  'F-18',
  'F-20',
]);
const CUTOVER_BOUNDARY_FILES = Object.freeze({
  accountDeletion: 'account-deletion.json',
  publicationFence: 'publication-fence.json',
  entitlementAuthority: 'entitlement-authority.json',
  healthConsent: 'health-consent.json',
  appleAuth: 'apple-auth.json',
});
const ZERO_COHORT_COUNT_FIELDS = Object.freeze([
  'authUsers',
  'authIdentities',
  'appleIdentities',
  'authSessions',
  'storageBuckets',
  'storageObjects',
  'relevantCronJobs',
  'allCronJobs',
]);
const TRAFFIC_FREEZE_FILE = 'traffic-provider-freeze.json';
const TRAFFIC_FREEZE_CONTROL_FIELDS = Object.freeze([
  'mobileClientsTargetingStaging',
  'webClientsTargetingStaging',
  'otaChannelsTargetingStaging',
  'projectApiKeysExternallyDistributed',
  'authSignupEnabled',
  'authAnonymousSignupEnabled',
  'authExternalProviderCount',
  'authAdminCreationAutomationEnabled',
  'edgeTrafficAdmission',
  'signInWithAppleNotificationsTargetingStaging',
  'appStoreServerNotificationsTargetingStaging',
  'revenueCatWebhooksTargetingStaging',
  'revenueCatPendingRetriesTargetingStaging',
  'otherProviderCallbacksTargetingStaging',
  'scheduledIngressConfigured',
]);
const TRAFFIC_FREEZE_EVIDENCE_FIELDS = Object.freeze([
  'releaseChannels',
  'supabaseAuth',
  'supabaseEdge',
  'apple',
  'revenueCat',
  'scheduledIngress',
]);
const DEPLOYMENT_INPUT_PATHS = Object.freeze([
  'package.json',
  'package-lock.json',
  'supabase/config.toml',
  'scripts/phase2/deploy-supabase-staging.ps1',
  'scripts/phase2/deploy-supabase-staging.mjs',
  'scripts/phase2/staging-deployment-evidence-lib.mjs',
  'scripts/phase2/contained-command.mjs',
  'scripts/phase2/process-tree.mjs',
  'scripts/phase2/windows-job-runner.cs',
  'scripts/phase2/build-windows-job-runner.ps1',
  'scripts/phase2/read-edge-app-environment.ts',
  'scripts/phase2/local-supabase-reset.mjs',
  'scripts/phase2/local-supabase-signal-cleanup.mjs',
  'scripts/phase2/local-supabase-target-guard.mjs',
  'scripts/phase2/staging-schema-inventory.sql',
  'scripts/phase2/staging-cron-table-exists.sql',
  'scripts/phase2/staging-cron-job-inventory.sql',
  'scripts/phase2/staging-migration-history-exists.sql',
  'scripts/phase2/staging-migration-inventory.sql',
  'scripts/phase2/staging-traffic-freeze-canary.mjs',
  'scripts/phase2/bounded-response-body.mjs',
  'scripts/phase2/schema-diff-evidence.mjs',
  'scripts/phase2/prepare-staging-cutover.mjs',
  'scripts/phase9/edge-function-manifest-check.mjs',
  'scripts/phase9/edge-function-manifest-lib.mjs',
  'docs/phase-2/staging-cutover-attestation.template.json',
  'docs/phase-2/staging-zero-cohort-boundary-attestation.template.json',
  'docs/phase-2/staging-traffic-provider-freeze-attestation.template.json',
  'docs/hugeToDo/evidence-governance.json',
  'docs/hugeToDo/feature-inventory.json',
]);

// Independently reviewed G=473bad3a7d7d434383b44fc102cd2666a79c06a0,
// tree=39ca1dbab5b3136c66844af1b9a05643a082867b. Authority R1 ZIP SHA-256:
// 4f17dfe17db76672f4405008ab6f1dc4f2e84ecf4eafe4958bcb14c2e0b3a8e4.
// These immutable source witnesses are not approval of this library or its tests.
// External BRAIN review must bind all three postimages and the complete candidate tree.
const REVIEWED_SOURCE = Object.freeze({
  "migrations": "5ee03b2032781512fe2ab893e46a3f28daf68ea55ba7b800393265256898c3d6",
  "functions": "e4ef03705c00ef1f9a40874805fc5072d17fd5b6b8a37b6fbd2859dbecfb9e4e",
  "stableDeploymentInputs": "e1b4c90c52f74b57db3849f769f9c0a3f752732adcb56d283bab6ac5fc4d7ccc",
  "sourceInputs": "4cd778934c7c0c0b00910ef6c96e60cbba7e708a9e4330add1810cdabf95abe9",
  "functionPaths": "06e15290b71c41c8d0d39ba5bfd3f580fd6320069e662ee99ee39ebaafe93b2c",
  "hostedGroupsSha256": "f0968ed3b6a14caed8eebfff7b26235fb8bfd0b298c0e24f221127be4221303e",
  "functionManifestSha256": "a9caa4b14860750febfb46efbf63f7e7d2ce03ad7beb83e3bda11acbfef5d816",
  "denoLockSha256": "b5f517baf0e4dc911925ec80d45b534367a3ed1e8c982cd89998da7e614d93b7"
});
const SELF_INPUT_PATH = 'scripts/phase2/staging-deployment-evidence-lib.mjs';
const SUPPLEMENTAL_INPUT_PATHS = Object.freeze([
  'scripts/phase2/database-types-contract-lib.mjs',
  'scripts/phase2/local-supabase-reset-retry.mjs',
  'supabase/seed.sql',
  'supabase/templates/email_change.html',
]);
const SOURCE_INPUT_PATHS = Object.freeze([
  "packages/types/src/client-database.types.contract.ts",
  "packages/types/src/client-database.types.ts",
  "packages/types/src/database.types.ts",
  "supabase/config.toml",
  "supabase/functions/deno.lock",
  "supabase/functions/manifest.json"
]);

const PLATFORM_INJECTED_NAMES = new Set([
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEYS',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PUBLISHABLE_KEYS',
  'SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
]);

export class Db06EvidenceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'Db06EvidenceError';
    this.code = code;
  }
}

function fail(code) {
  throw new Db06EvidenceError(code);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, sortJson(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortJson(value));
}

export function parseGitTreeInventory(raw, objectFormat) {
  if (!['sha1', 'sha256'].includes(objectFormat)) fail('DB06_GIT_OBJECT_FORMAT_INVALID');
  const entries = String(raw)
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const match = record.match(/^(100644|100755) blob ([0-9a-f]+)\t([^\0]+)$/u);
      if (!match) fail('DB06_GIT_TREE_UNSAFE');
      const [, mode, objectId, path] = match;
      const components = path.split('/');
      if (
        objectId.length !== (objectFormat === 'sha1' ? 40 : 64) ||
        /^[./\\]/u.test(path) ||
        /[\u0000-\u001f\u007f]/u.test(path) ||
        components.some((component) => !component || component === '.' || component === '..')
      ) {
        fail('DB06_GIT_TREE_UNSAFE');
      }
      return { path, mode, objectId };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  if (entries.length === 0 || new Set(entries.map(({ path }) => path)).size !== entries.length) {
    fail('DB06_GIT_TREE_UNSAFE');
  }
  return entries;
}

function walkSnapshot(root, current, files, runtimeFiles) {
  for (const name of readdirSync(current)) {
    const absolutePath = join(current, name);
    const relativePath = relative(root, absolutePath).split(sep).join('/');
    const metadata = lstatSync(absolutePath);
    if (metadata.isSymbolicLink()) fail('DB06_SNAPSHOT_INTEGRITY_FAILED');
    if (metadata.isDirectory()) {
      walkSnapshot(root, absolutePath, files, runtimeFiles);
    } else if (metadata.isFile()) {
      if (relativePath.startsWith('supabase/.temp/')) runtimeFiles.push(relativePath);
      else files.push(relativePath);
    } else {
      fail('DB06_SNAPSHOT_INTEGRITY_FAILED');
    }
  }
}

export function validateGitSnapshot(
  snapshotRoot,
  gitEntries,
  objectFormat,
  { allowSupabaseTemp = false } = {},
) {
  if (!['sha1', 'sha256'].includes(objectFormat)) fail('DB06_GIT_OBJECT_FORMAT_INVALID');
  const root = resolve(snapshotRoot);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    fail('DB06_SNAPSHOT_INTEGRITY_FAILED');
  }
  const files = [];
  const runtimeFiles = [];
  walkSnapshot(root, root, files, runtimeFiles);
  files.sort((left, right) => left.localeCompare(right));
  runtimeFiles.sort((left, right) => left.localeCompare(right));
  if (runtimeFiles.length > 0 && !allowSupabaseTemp) {
    fail('DB06_SNAPSHOT_INTEGRITY_FAILED');
  }
  const expected = [...gitEntries].sort((left, right) => left.path.localeCompare(right.path));
  if (
    files.length !== expected.length ||
    files.some((path, index) => path !== expected[index].path)
  ) {
    fail('DB06_SNAPSHOT_INTEGRITY_FAILED');
  }
  const inventory = expected.map((entry) => {
    const bytes = readFileSync(join(root, ...entry.path.split('/')));
    const objectId = createHash(objectFormat)
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest('hex');
    if (objectId !== entry.objectId) fail('DB06_SNAPSHOT_INTEGRITY_FAILED');
    return {
      path: entry.path,
      mode: entry.mode,
      byteCount: bytes.length,
      sha256: sha256(bytes),
    };
  });
  return {
    trackedFileCount: inventory.length,
    trackedFileSetSha256: sha256(canonicalJson(inventory)),
    allowedRuntimeFileCount: runtimeFiles.length,
    runtimePathsSha256: sha256(canonicalJson(runtimeFiles)),
  };
}

function parseJsonArray(raw, failureCode) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    fail(failureCode);
  }
  if (!Array.isArray(parsed)) fail(failureCode);
  return parsed;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const wanted = [...expected].sort((left, right) => left.localeCompare(right));
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function integer(value, failureCode) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || String(value).trim() !== String(parsed)) {
    fail(failureCode);
  }
  return parsed;
}

function timestamp(value, failureCode) {
  const parsed = Date.parse(String(value ?? ''));
  if (!Number.isFinite(parsed)) fail(failureCode);
  return parsed;
}

function assertSafeRole(value, failureCode) {
  if (
    !SAFE_ROLE.test(String(value ?? '')) ||
    /(?:todo|tbd|unknown|placeholder|example)/u.test(value)
  ) {
    fail(failureCode);
  }
  return value;
}

export function validateOperatorRole(value) {
  return assertSafeRole(value, 'DB06_OPERATOR_ROLE_INVALID');
}

export function validateRollbackRef(value) {
  const text = String(value ?? '');
  if (
    !SAFE_REFERENCE.test(text) ||
    text.includes('://') ||
    text.includes('@') ||
    /(?:todo|tbd|unknown|placeholder|example|password|secret|token|private[-_]?key)/iu.test(text)
  ) {
    fail('DB06_ROLLBACK_REF_INVALID');
  }
  return text;
}

function isSafeLocalEvidenceReference(value) {
  const text = String(value ?? '');
  return (
    SAFE_LOCAL_EVIDENCE_REFERENCE.test(text) &&
    !text.includes(':') &&
    !text.includes('@') &&
    !/(?:todo|tbd|unknown|placeholder|example|password|secret|token|private[-_]?key)/iu.test(text)
  );
}

export function validateEvidenceId(value) {
  const text = String(value ?? '');
  if (!SAFE_EVIDENCE_ID.test(text)) fail('DB06_EVIDENCE_ID_INVALID');
  return text;
}

// Reject links in every path component, including junctions and the supplied root.
function sourceBytes(root, path) {
  const parts = path.split('/');
  if (!path || isAbsolute(path) || path.includes('\\') ||
      parts.some((part) => !part || part === '.' || part === '..') ||
      !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) {
    fail('DB06_SOURCE_PATH_UNSAFE');
  }
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const metadata = lstatSync(current, { throwIfNoEntry: false });
    if (!metadata || metadata.isSymbolicLink() ||
        (index < parts.length - 1 ? !metadata.isDirectory() : !metadata.isFile())) {
      fail('DB06_SOURCE_PATH_UNSAFE');
    }
  }
  if (statSync(current).size > 16 * 1024 * 1024) fail('DB06_SOURCE_PATH_UNSAFE');
  return readFileSync(current);
}

function inputRows(root, paths) {
  return paths.map((path) => {
    const bytes = sourceBytes(root, path);
    return { path, byteCount: bytes.length, sha256: sha256(bytes) };
  });
}

function functionPathInventory(root, current = root) {
  const paths = [];
  for (const name of readdirSync(current)) {
    const target = join(current, name);
    const path = relative(root, target).split(sep).join('/');
    const metadata = lstatSync(target);
    if (metadata.isSymbolicLink()) fail('DB06_SOURCE_PATH_UNSAFE');
    if (metadata.isDirectory()) {
      paths.push(`${path}/`, ...functionPathInventory(root, target));
    } else if (metadata.isFile()) paths.push(path);
    else fail('DB06_SOURCE_PATH_UNSAFE');
  }
  return paths.sort();
}

function resolveImport(sourcePath, specifier, functionsRoot) {
  const cleanSpecifier = specifier.split(/[?#]/u, 1)[0];
  const base = resolve(dirname(sourcePath), cleanSpecifier);
  const candidates = extname(base)
    ? [base]
    : [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.mjs`,
        `${base}.json`,
        join(base, 'index.ts'),
      ];
  const target = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  if (!target) fail('DB06_FUNCTION_IMPORT_UNRESOLVED');
  const rel = relative(functionsRoot, target);
  if (!rel || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    fail('DB06_FUNCTION_IMPORT_ESCAPES_ROOT');
  return target;
}

function sourceImports(source) {
  const imports = [];
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(pattern)) {
    if (match[1].startsWith('.')) imports.push(match[1]);
  }
  return imports;
}

function transitiveFunctionSources(entrypoint, functionsRoot) {
  const pending = [entrypoint];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    const source = sourceBytes(functionsRoot, relative(functionsRoot, current).split(sep).join('/')).toString('utf8');
    for (const specifier of sourceImports(source)) {
      pending.push(resolveImport(current, specifier, functionsRoot));
    }
  }
  return [...visited]
    .map((file) => ({
      path: relative(functionsRoot, file).split(sep).join('/'),
      sha256: sha256(sourceBytes(functionsRoot, relative(functionsRoot, file).split(sep).join('/'))),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function migrationInventory(repoRoot) {
  const migrationRoot = join(repoRoot, 'supabase', 'migrations');
  const files = readdirSync(migrationRoot).sort((left, right) => left.localeCompare(right));
  if (files.some((name) => !MIGRATION_FILE.test(name))) fail('DB06_SOURCE_MIGRATIONS_INVALID');
  const migrations = files.map((file) => {
    const match = file.match(MIGRATION_FILE);
    return {
      id: match[1],
      file,
      sha256: sha256(sourceBytes(repoRoot, `supabase/migrations/${file}`)),
    };
  });
  if (
    migrations.length === 0 ||
    new Set(migrations.map(({ id }) => id)).size !== migrations.length ||
    migrations.some(({ id }, index) => index > 0 && id <= migrations[index - 1].id)
  ) {
    fail('DB06_SOURCE_MIGRATIONS_INVALID');
  }
  return migrations;
}

function deploymentInputInventory(repoRoot) {
  return inputRows(repoRoot, DEPLOYMENT_INPUT_PATHS);
}

function hostedSecretGroups(functions) {
  const groups = [];
  for (const definition of functions) {
    for (const [kind, sourceGroups] of [
      ['environment', definition.requiredEnvironment],
      ['secret', definition.requiredSecrets],
    ]) {
      for (const [index, names] of sourceGroups.entries()) {
        if (
          names.some(
            (name) =>
              PLATFORM_INJECTED_NAMES.has(name) ||
              name === 'APP_ENV' ||
              name === 'DB06_TRAFFIC_FREEZE',
          )
        ) {
          continue;
        }
        groups.push({
          id: `${definition.slug}:${kind}:${index + 1}`,
          names: [...names].sort((left, right) => left.localeCompare(right)),
        });
      }
    }
  }
  return groups.sort((left, right) => left.id.localeCompare(right.id));
}

export function buildSourceInventory(repoRoot) {
  const root = resolve(repoRoot);
  const functionsRoot = join(root, 'supabase', 'functions');
  const sourceInputs = inputRows(root, SOURCE_INPUT_PATHS);
  // Check raw full manifest/config/lock/types before interpreting metadata or imports.
  if (sha256(canonicalJson(sourceInputs)) !== REVIEWED_SOURCE.sourceInputs) {
    fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
  }
  const functionPaths = functionPathInventory(functionsRoot);
  if (sha256(canonicalJson(functionPaths)) !== REVIEWED_SOURCE.functionPaths) {
    fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
  }
  const functionSources = {};
  let manifest;
  try {
    manifest = JSON.parse(sourceBytes(root, 'supabase/functions/manifest.json').toString('utf8'));
  } catch {
    fail('DB06_FUNCTION_MANIFEST_INVALID');
  }
  if (
    manifest?.schemaVersion !== 1 ||
    !manifest.functions ||
    typeof manifest.functions !== 'object'
  ) {
    fail('DB06_FUNCTION_MANIFEST_INVALID');
  }
  let featureInventory;
  try {
    featureInventory = JSON.parse(
      sourceBytes(root, 'docs/hugeToDo/feature-inventory.json').toString('utf8'),
    );
  } catch {
    fail('DB06_FEATURE_SCOPE_INVALID');
  }
  const canonicalFeatureIds = new Set((featureInventory?.features ?? []).map(({ id }) => id));
  if (!DB06_FEATURE_IDS.every((id) => canonicalFeatureIds.has(id))) {
    fail('DB06_FEATURE_SCOPE_INVALID');
  }

  const functions = Object.entries(manifest.functions)
    .filter(([, definition]) => definition.deployByDefault === true)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([slug, definition]) => {
      if (
        !Array.isArray(definition.requiredEnvironment) ||
        !Array.isArray(definition.requiredSecrets) ||
        typeof definition.verifyJwt !== 'boolean'
      ) {
        fail('DB06_FUNCTION_MANIFEST_INVALID');
      }
      const entrypoint = resolve(root, definition.entrypoint);
      const rel = relative(functionsRoot, entrypoint);
      if (!existsSync(entrypoint) || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
        fail('DB06_FUNCTION_ENTRYPOINT_INVALID');
      }
      const sourceFiles = transitiveFunctionSources(entrypoint, functionsRoot);
      functionSources[slug] = sourceFiles;
      const entrypointBytes = sourceBytes(root, definition.entrypoint);
      const entrypointSource = entrypointBytes.toString('utf8');
      const fenceCallIndex = entrypointSource.indexOf('stagingTrafficFreezeResponse()');
      const serveIndex = entrypointSource.indexOf('Deno.serve');
      if (
        !sourceFiles.some(({ path }) => path === '_shared/stagingTrafficFreeze.ts') ||
        fenceCallIndex < 0 ||
        serveIndex < 0 ||
        fenceCallIndex < serveIndex
      ) {
        fail('DB06_FUNCTION_TRAFFIC_FREEZE_MISSING');
      }
      return {
        slug,
        entrypoint: relative(root, entrypoint).split(sep).join('/'),
        verifyJwt: definition.verifyJwt,
        sourceFileCount: sourceFiles.length,
        entrypointSha256: sha256(entrypointBytes),
        sourceSetSha256: sha256(canonicalJson(sourceFiles)),
        requiredEnvironment: definition.requiredEnvironment,
        requiredSecrets: definition.requiredSecrets,
      };
    });
  if (
    functions.length === 0 ||
    new Set(functions.map(({ slug }) => slug)).size !== functions.length
  ) {
    fail('DB06_FUNCTION_MANIFEST_INVALID');
  }

  const migrations = migrationInventory(root);
  const deploymentInputs = deploymentInputInventory(root);
  const stableDeploymentInputs = inputRows(root, [
    ...DEPLOYMENT_INPUT_PATHS.filter((path) => path !== SELF_INPUT_PATH),
    ...SUPPLEMENTAL_INPUT_PATHS,
  ].sort((left, right) => left.localeCompare(right)));
  const expandedDeploymentInputs = [...stableDeploymentInputs,
    deploymentInputs.find(({ path }) => path === SELF_INPUT_PATH),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const safeFunctions = functions.map(
    ({ requiredEnvironment: _requiredEnvironment, requiredSecrets: _requiredSecrets, ...value }) =>
      value,
  );
  return {
    schemaVersion: DB06_EVIDENCE_SCHEMA_VERSION,
    migrationCount: migrations.length,
    latestMigrationId: migrations.at(-1).id,
    migrations,
    migrationSetSha256: sha256(canonicalJson(migrations)),
    functionCount: safeFunctions.length,
    functions: safeFunctions,
    functionSetSha256: sha256(canonicalJson(safeFunctions)),
    functionManifestSha256: sha256(sourceBytes(root, 'supabase/functions/manifest.json')),
    denoLockSha256: sha256(sourceBytes(root, 'supabase/functions/deno.lock')),
    functionSources,
    functionPaths,
    sourceInputs,
    stableDeploymentInputs,
    expandedDeploymentInputs,
    expandedDeploymentInputSetSha256: sha256(canonicalJson(expandedDeploymentInputs)),
    deploymentInputs,
    deploymentInputSetSha256: sha256(canonicalJson(deploymentInputs)),
    featureIds: [...DB06_FEATURE_IDS],
    gatedSurfaceIds: [],
    hostedSecretGroups: hostedSecretGroups(functions),
  };
}

function reviewedRows(rows, keys, hash, pathKey = 'path') {
  if (!Array.isArray(rows) || rows.length === 0 ||
      rows.some((row) => !exactKeys(row, keys) ||
        typeof row[pathKey] !== 'string' || !row[pathKey] ||
        (keys.includes('sha256') && !SHA256.test(row.sha256)) ||
        (keys.includes('byteCount') && (!Number.isSafeInteger(row.byteCount) || row.byteCount < 0))) ||
      new Set(rows.map((row) => row[pathKey])).size !== rows.length ||
      sha256(canonicalJson(rows)) !== hash) {
    fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
  }
}

export function assertCurrentSourceContract(sourceInventory) {
  const source = sourceInventory;
  if (!exactKeys(source, [
    'schemaVersion', 'migrationCount', 'latestMigrationId', 'migrations', 'migrationSetSha256',
    'functionCount', 'functions', 'functionSetSha256', 'functionManifestSha256', 'denoLockSha256',
    'functionSources', 'functionPaths', 'sourceInputs', 'stableDeploymentInputs',
    'expandedDeploymentInputs', 'expandedDeploymentInputSetSha256',
    'deploymentInputs', 'deploymentInputSetSha256', 'featureIds', 'gatedSurfaceIds', 'hostedSecretGroups',
  ]) || source.schemaVersion !== DB06_EVIDENCE_SCHEMA_VERSION ||
      !Array.isArray(source.migrations) || !Array.isArray(source.functions) ||
      !Array.isArray(source.functionPaths) || !Array.isArray(source.hostedSecretGroups) ||
      source.migrationCount !== source.migrations?.length ||
      source.latestMigrationId !== source.migrations?.at(-1)?.id ||
      source.functionCount !== source.functions?.length ||
      source.functionManifestSha256 !== REVIEWED_SOURCE.functionManifestSha256 ||
      source.denoLockSha256 !== REVIEWED_SOURCE.denoLockSha256 ||
      !exactArray(source.featureIds, DB06_FEATURE_IDS) || !exactArray(source.gatedSurfaceIds, []) ||
      sha256(canonicalJson(source.hostedSecretGroups)) !== REVIEWED_SOURCE.hostedGroupsSha256 ||
      sha256(canonicalJson(source.functionPaths)) !== REVIEWED_SOURCE.functionPaths) {
    fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
  }
  reviewedRows(source.migrations, ['id', 'file', 'sha256'], REVIEWED_SOURCE.migrations, 'id');
  reviewedRows(source.functions, ['slug', 'entrypoint', 'verifyJwt', 'sourceFileCount',
    'entrypointSha256', 'sourceSetSha256'], REVIEWED_SOURCE.functions, 'slug');
  if (!exactKeys(source.functionSources, source.functions.map(({ slug }) => slug))) {
    fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
  }
  for (const definition of source.functions) {
    const rows = source.functionSources[definition.slug];
    reviewedRows(rows, ['path', 'sha256'], definition.sourceSetSha256);
    if (rows.length !== definition.sourceFileCount ||
        rows.find(({ path }) => `supabase/functions/${path}` === definition.entrypoint)?.sha256 !==
          definition.entrypointSha256) fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
  }
  const leafKeys = ['path', 'byteCount', 'sha256'];
  reviewedRows(source.sourceInputs, leafKeys, REVIEWED_SOURCE.sourceInputs);
  reviewedRows(source.stableDeploymentInputs, leafKeys, REVIEWED_SOURCE.stableDeploymentInputs);
  // The original 30-input observation includes this mutable library. It is not a frozen pin.
  // Bind its other 29 leaves to G; final self bytes and full 34-input digest need external review.
  reviewedRows(source.deploymentInputs, leafKeys, source.deploymentInputSetSha256);
  if (!exactArray(source.deploymentInputs.map(({ path }) => path), DEPLOYMENT_INPUT_PATHS)) {
    fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
  }
  for (const row of source.deploymentInputs.filter(({ path }) => path !== SELF_INPUT_PATH)) {
    if (canonicalJson(row) !== canonicalJson(source.stableDeploymentInputs.find(({ path }) => path === row.path))) {
      fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
    }
  }
  const expanded = [...source.stableDeploymentInputs,
    source.deploymentInputs.find(({ path }) => path === SELF_INPUT_PATH),
  ].sort((left, right) => left.path.localeCompare(right.path));
  reviewedRows(source.expandedDeploymentInputs, leafKeys, sha256(canonicalJson(expanded)));
  if (source.migrationSetSha256 !== REVIEWED_SOURCE.migrations ||
      source.functionSetSha256 !== REVIEWED_SOURCE.functions ||
      source.expandedDeploymentInputSetSha256 !== sha256(canonicalJson(expanded))) {
    fail('DB06_SOURCE_CONTRACT_REVIEW_REQUIRED');
  }
  return true;
}

// This CLI version is a local DB05 replay trial, not a staging approval.
// The exact 94-migration schema count and repository types are not yet bound
// to a clean current-chain PostgreSQL replay. Do not link or mutate staging
// until that evidence is reviewed and this gate is explicitly replaced.
export function assertPinnedMigrationRunnerCompatibility(_repoRoot, cliVersion) {
  if (cliVersion !== '2.117.0') fail('DB06_CLI_PIN_INVALID');
  fail('DB06_CURRENT_CHAIN_REPLAY_REQUIRED');
}

export function parseSchemaInventory(raw) {
  const rows = parseJsonArray(raw, 'DB06_SCHEMA_INVENTORY_MALFORMED');
  const rawKeys = SCHEMA_INVENTORY_FIELDS.map(([key]) => key);
  if (rows.length !== 1 || !exactKeys(rows[0], rawKeys)) {
    fail('DB06_SCHEMA_INVENTORY_MALFORMED');
  }
  return Object.fromEntries(
    SCHEMA_INVENTORY_FIELDS.map(([rawKey, outputKey]) => [
      outputKey,
      integer(rows[0][rawKey], 'DB06_SCHEMA_INVENTORY_MALFORMED'),
    ]),
  );
}

function parseBooleanProbe(raw, key, failureCode) {
  const rows = parseJsonArray(raw, failureCode);
  if (rows.length !== 1 || !exactKeys(rows[0], [key])) fail(failureCode);
  const value = rows[0][key];
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  fail(failureCode);
}

export function parseCronTableExists(raw) {
  return parseBooleanProbe(raw, 'cron_job_table_exists', 'DB06_CRON_TABLE_PROBE_MALFORMED');
}

export function emptyCronInventory() {
  return Object.fromEntries(CRON_INVENTORY_FIELDS.map(([, outputKey]) => [outputKey, 0]));
}

export function parseCronInventory(raw) {
  const rows = parseJsonArray(raw, 'DB06_CRON_INVENTORY_MALFORMED');
  const rawKeys = CRON_INVENTORY_FIELDS.map(([key]) => key);
  if (rows.length !== 1 || !exactKeys(rows[0], rawKeys)) {
    fail('DB06_CRON_INVENTORY_MALFORMED');
  }
  const parsed = Object.fromEntries(
    CRON_INVENTORY_FIELDS.map(([rawKey, outputKey]) => [
      outputKey,
      integer(rows[0][rawKey], 'DB06_CRON_INVENTORY_MALFORMED'),
    ]),
  );
  if (
    parsed.relevantCronJobCount !==
      parsed.accountDeletionCronJobCount +
        parsed.healthConsentCronJobCount +
        parsed.appleAuthCronJobCount ||
    parsed.relevantCronJobCount > parsed.allCronJobCount
  ) {
    fail('DB06_CRON_INVENTORY_MALFORMED');
  }
  return parsed;
}

export function parseMigrationHistoryExists(raw) {
  return parseBooleanProbe(
    raw,
    'migration_history_exists',
    'DB06_MIGRATION_HISTORY_PROBE_MALFORMED',
  );
}

export function parseMigrationInventory(raw) {
  const rows = parseJsonArray(raw, 'DB06_MIGRATION_INVENTORY_MALFORMED');
  const ids = rows.map((row) => {
    if (!exactKeys(row, ['migration_id']) || !MIGRATION_ID.test(String(row.migration_id ?? ''))) {
      fail('DB06_MIGRATION_INVENTORY_MALFORMED');
    }
    return String(row.migration_id);
  });
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id, index) => index > 0 && id <= ids[index - 1])
  ) {
    fail('DB06_MIGRATION_INVENTORY_MALFORMED');
  }
  return ids;
}

function expectedFunctionMap(sourceInventory) {
  return new Map(sourceInventory.functions.map((definition) => [definition.slug, definition]));
}

export function parseFunctionInventory(raw, sourceInventory, { requireComplete = false } = {}) {
  const rows = parseJsonArray(raw, 'DB06_FUNCTION_INVENTORY_MALFORMED');
  const expected = expectedFunctionMap(sourceInventory);
  const seen = new Set();
  const functions = rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      fail('DB06_FUNCTION_INVENTORY_MALFORMED');
    }
    const slug = String(row.slug ?? '');
    const definition = expected.get(slug);
    if (!definition || seen.has(slug)) fail('DB06_FUNCTION_INVENTORY_UNEXPECTED');
    seen.add(slug);
    if (
      row.status !== 'ACTIVE' ||
      !Number.isSafeInteger(row.version) ||
      row.version < 1 ||
      row.verify_jwt !== definition.verifyJwt ||
      !SHA256.test(String(row.ezbr_sha256 ?? '').toLowerCase())
    ) {
      fail('DB06_FUNCTION_INVENTORY_MALFORMED');
    }
    const updatedAtValue = integer(row.updated_at, 'DB06_FUNCTION_INVENTORY_MALFORMED');
    if (updatedAtValue < 1) fail('DB06_FUNCTION_INVENTORY_MALFORMED');
    return {
      slug,
      status: 'ACTIVE',
      version: row.version,
      verifyJwt: row.verify_jwt,
      hostedBundleSha256: String(row.ezbr_sha256).toLowerCase(),
      updatedAt: new Date(updatedAtValue).toISOString(),
      reviewedSourceSetSha256: definition.sourceSetSha256,
    };
  });
  functions.sort((left, right) => left.slug.localeCompare(right.slug));
  if (requireComplete && functions.length !== sourceInventory.functions.length) {
    fail('DB06_FUNCTION_INVENTORY_INCOMPLETE');
  }
  return functions;
}

export function parseSecretInventory(raw, sourceInventory) {
  const rows = parseJsonArray(raw, 'DB06_SECRET_INVENTORY_MALFORMED');
  const configured = new Set();
  for (const row of rows) {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      !SECRET_NAME.test(String(row.name ?? ''))
    ) {
      fail('DB06_SECRET_INVENTORY_MALFORMED');
    }
    configured.add(String(row.name));
  }
  const missingGroupIds = sourceInventory.hostedSecretGroups
    .filter(({ names }) => !names.some((name) => configured.has(name)))
    .map(({ id }) => id);
  return {
    configuredNameCount: configured.size,
    requiredGroupCount: sourceInventory.hostedSecretGroups.length,
    satisfiedGroupCount: sourceInventory.hostedSecretGroups.length - missingGroupIds.length,
    missingGroupIds,
    appEnvironmentNamesPresent: configured.has('APP_ENV') && configured.has('EXPO_PUBLIC_APP_ENV'),
    trafficFreezeNamePresent: configured.has('DB06_TRAFFIC_FREEZE'),
  };
}

export function parseAuthIngressFreeze(raw) {
  let value;
  try {
    value = JSON.parse(String(raw));
  } catch {
    fail('DB06_AUTH_INGRESS_FREEZE_MALFORMED');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('DB06_AUTH_INGRESS_FREEZE_MALFORMED');
  }
  if (typeof value.disable_signup !== 'boolean') {
    fail('DB06_AUTH_INGRESS_FREEZE_MALFORMED');
  }
  if (value.disable_signup !== true) {
    fail('DB06_AUTH_INGRESS_NOT_FROZEN');
  }
  const reviewedDynamicFields = new Set([
    ...AUTH_EXTERNAL_ENABLED_FIELDS,
    ...AUTH_HOOK_ENABLED_FIELDS,
  ]);
  for (const field of Object.keys(value).filter(
    (name) =>
      /^external_[a-z0-9_]+_enabled$/u.test(name) || /^hook_[a-z0-9_]+_enabled$/u.test(name),
  )) {
    if (!reviewedDynamicFields.has(field)) {
      fail('DB06_AUTH_INGRESS_FREEZE_REVIEW_REQUIRED');
    }
  }
  for (const field of AUTH_EXTERNAL_ENABLED_FIELDS) {
    if (!Object.hasOwn(value, field) || ![true, false, null].includes(value[field])) {
      fail('DB06_AUTH_INGRESS_FREEZE_MALFORMED');
    }
    if (value[field] === true) fail('DB06_AUTH_INGRESS_NOT_FROZEN');
  }
  if (value.external_anonymous_users_enabled !== false) {
    fail('DB06_AUTH_INGRESS_NOT_FROZEN');
  }
  for (const field of AUTH_HOOK_ENABLED_FIELDS) {
    if (!Object.hasOwn(value, field) || ![true, false, null].includes(value[field])) {
      fail('DB06_AUTH_INGRESS_FREEZE_MALFORMED');
    }
    if (value[field] === true) fail('DB06_AUTH_INGRESS_NOT_FROZEN');
  }
  for (const field of ['saml_enabled', 'oauth_server_enabled', 'custom_oauth_enabled']) {
    if (!Object.hasOwn(value, field) || ![true, false, null].includes(value[field])) {
      fail('DB06_AUTH_INGRESS_FREEZE_MALFORMED');
    }
    if (value[field] === true) fail('DB06_AUTH_INGRESS_NOT_FROZEN');
  }
  return {
    newUserSignupDisabled: true,
    anonymousSignupDisabled: true,
    reviewedExternalEnabledFieldCount: AUTH_EXTERNAL_ENABLED_FIELDS.length,
    enabledExternalProviderCount: 0,
    reviewedAuthHookFieldCount: AUTH_HOOK_ENABLED_FIELDS.length,
    enabledAuthHookCount: 0,
    samlEnabled: false,
    oauthServerEnabled: false,
    customOAuthEnabled: false,
  };
}

export function parseSsoProviderFreeze(raw) {
  let value;
  try {
    value = JSON.parse(String(raw));
  } catch {
    fail('DB06_AUTH_SSO_INVENTORY_MALFORMED');
  }
  if (!value || !exactKeys(value, ['items']) || !Array.isArray(value.items)) {
    fail('DB06_AUTH_SSO_INVENTORY_MALFORMED');
  }
  if (value.items.length !== 0) fail('DB06_AUTH_INGRESS_NOT_FROZEN');
  return { ssoProviderCount: 0 };
}

export function parseThirdPartyAuthFreeze(raw) {
  let value;
  try {
    value = JSON.parse(String(raw));
  } catch {
    fail('DB06_AUTH_THIRD_PARTY_INVENTORY_MALFORMED');
  }
  if (!Array.isArray(value)) {
    fail('DB06_AUTH_THIRD_PARTY_INVENTORY_MALFORMED');
  }
  if (value.length !== 0) fail('DB06_AUTH_INGRESS_NOT_FROZEN');
  return { thirdPartyAuthIntegrationCount: 0 };
}

export function assertRemoteMigrationPrefix(sourceInventory, remoteMigrationIds) {
  const sourceIds = sourceInventory.migrations.map(({ id }) => id);
  if (
    remoteMigrationIds.length > sourceIds.length ||
    remoteMigrationIds.some((id, index) => id !== sourceIds[index])
  ) {
    fail('DB06_REMOTE_MIGRATION_HISTORY_DIVERGED');
  }
  return sourceIds.slice(remoteMigrationIds.length);
}

export function assertFreshStagingTarget({ schema, migrationIds, functions }) {
  if (
    migrationIds.length !== 0 ||
    Object.values(schema).some((count) => count !== 0) ||
    functions.length !== 0
  ) {
    fail('DB06_TARGET_NOT_EMPTY_FRESH_STAGING');
  }
  return true;
}

export function assertFreshStagingBoundary({ schema, migrationIds }) {
  if (migrationIds.length !== 0 || Object.values(schema).some((count) => count !== 0)) {
    fail('DB06_TARGET_CHANGED_BEFORE_MIGRATION');
  }
  return true;
}

export function parseLocalTypeSummary(raw) {
  const matches = [
    ...String(raw).matchAll(
      /\[db05-local\] temporary types: PASS \((\d+) lines, sha256 ([0-9a-f]{64})\)/gu,
    ),
  ];
  if (matches.length !== 1) fail('DB06_LOCAL_TYPE_SUMMARY_MALFORMED');
  const lineCount = integer(matches[0][1], 'DB06_LOCAL_TYPE_SUMMARY_MALFORMED');
  if (lineCount < 100) fail('DB06_LOCAL_TYPE_SUMMARY_MALFORMED');
  return { lineCount, sha256: matches[0][2] };
}

export function summarizeGeneratedTypes(raw) {
  try {
    const { lineCount, sha256: generatedSha256 } = summarizeDatabaseTypes(raw, {
      failureCode: 'DB06_LINKED_TYPES_INVALID',
    });
    return { lineCount, sha256: generatedSha256 };
  } catch (error) {
    if (error?.code === 'DB06_LINKED_TYPES_INVALID') fail('DB06_LINKED_TYPES_INVALID');
    throw error;
  }
}

function exactArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

export function requiredCutoverBoundaries(pendingMigrationIds) {
  return PROTECTED_MIGRATION_BOUNDARIES.filter(([id]) => pendingMigrationIds.includes(id)).map(
    ([, boundary]) => boundary,
  );
}

export function validateCutoverRecord({
  record,
  pendingMigrationIds,
  projectRefLast4,
  projectRefFingerprint,
  gitCommit,
  rollbackRef,
  operatorRole,
  evidenceDirectory,
  rawProjectRef,
  now = new Date(),
  requireFreshObservations = true,
  minimumCompletionBudgetMs = 0,
}) {
  if (
    typeof requireFreshObservations !== 'boolean' ||
    !Number.isSafeInteger(minimumCompletionBudgetMs) ||
    minimumCompletionBudgetMs < 0 ||
    minimumCompletionBudgetMs > 24 * 60 * 60_000 ||
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime())
  ) {
    fail('DB06_CUTOVER_RECORD_INVALID');
  }
  const requiredBoundaries = requiredCutoverBoundaries(pendingMigrationIds);
  if (requiredBoundaries.length === 0 && record == null) return null;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    fail('DB06_CUTOVER_RECORD_REQUIRED');
  }
  if (
    !exactKeys(record, [
      'schemaVersion',
      'environment',
      'projectRefLast4',
      'projectRefFingerprint',
      'sourceGitCommit',
      'rollbackRef',
      'reviewedAt',
      'validUntil',
      'retentionReviewAt',
      'migrationPlanSha256',
      'noDashboardSchemaMutation',
      'rollbackPointOperatorAttested',
      'attestationRoles',
      'trafficProviderFreeze',
      'boundaries',
    ])
  ) {
    fail('DB06_CUTOVER_RECORD_INVALID');
  }
  if (
    record.schemaVersion !== 2 ||
    record.environment !== 'staging' ||
    record.projectRefLast4 !== projectRefLast4 ||
    record.projectRefFingerprint !== projectRefFingerprint ||
    record.sourceGitCommit !== gitCommit ||
    record.rollbackRef !== rollbackRef ||
    record.noDashboardSchemaMutation !== true ||
    record.rollbackPointOperatorAttested !== true ||
    record.migrationPlanSha256 !== sha256(canonicalJson(pendingMigrationIds))
  ) {
    fail('DB06_CUTOVER_RECORD_INVALID');
  }
  const reviewedAt = timestamp(record.reviewedAt, 'DB06_CUTOVER_RECORD_INVALID');
  const validUntil = timestamp(record.validUntil, 'DB06_CUTOVER_RECORD_INVALID');
  const retentionReviewAt = timestamp(record.retentionReviewAt, 'DB06_CUTOVER_RECORD_INVALID');
  const nowValue = now.getTime();
  if (
    reviewedAt > nowValue ||
    validUntil <= nowValue ||
    validUntil - reviewedAt > 7 * 86400_000 ||
    retentionReviewAt <= validUntil
  ) {
    fail('DB06_CUTOVER_RECORD_EXPIRED');
  }
  if (validUntil - nowValue < minimumCompletionBudgetMs) {
    fail('DB06_CUTOVER_COMPLETION_BUDGET_INSUFFICIENT');
  }
  if (
    !Array.isArray(record.attestationRoles) ||
    record.attestationRoles.length < REQUIRED_CUTOVER_ATTESTATION_ROLES.length ||
    new Set(record.attestationRoles).size !== record.attestationRoles.length
  ) {
    fail('DB06_CUTOVER_RECORD_INVALID');
  }
  for (const role of record.attestationRoles) {
    assertSafeRole(role, 'DB06_CUTOVER_RECORD_INVALID');
  }
  if (!REQUIRED_CUTOVER_ATTESTATION_ROLES.every((role) => record.attestationRoles.includes(role))) {
    fail('DB06_CUTOVER_RECORD_INVALID');
  }
  if (
    !record.boundaries ||
    typeof record.boundaries !== 'object' ||
    Array.isArray(record.boundaries)
  ) {
    fail('DB06_CUTOVER_RECORD_INVALID');
  }
  if (!exactKeys(record.boundaries, requiredBoundaries)) fail('DB06_CUTOVER_RECORD_INVALID');
  const artifactRoot = resolve(String(evidenceDirectory ?? ''));
  if (!evidenceDirectory || !existsSync(artifactRoot) || !statSync(artifactRoot).isDirectory()) {
    fail('DB06_CUTOVER_EVIDENCE_DIRECTORY_INVALID');
  }
  assertEvidenceSafe(record, rawProjectRef);
  const retainedArtifacts = {
    'cutover-attestation.json': `${JSON.stringify(record, null, 2)}\n`,
  };
  const trafficFreezeReference = record.trafficProviderFreeze;
  if (
    !trafficFreezeReference ||
    !exactKeys(trafficFreezeReference, ['mode', 'evidenceFile', 'evidenceSha256']) ||
    trafficFreezeReference.mode !== 'closed-ingress-zero-cohort' ||
    trafficFreezeReference.evidenceFile !== TRAFFIC_FREEZE_FILE ||
    !SHA256.test(String(trafficFreezeReference.evidenceSha256 ?? ''))
  ) {
    fail('DB06_CUTOVER_RECORD_INVALID');
  }
  const trafficFreezePath = join(artifactRoot, TRAFFIC_FREEZE_FILE);
  if (
    dirname(resolve(trafficFreezePath)) !== artifactRoot ||
    !existsSync(trafficFreezePath) ||
    !statSync(trafficFreezePath).isFile() ||
    statSync(trafficFreezePath).size > 1024 * 1024
  ) {
    fail('DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID');
  }
  let trafficFreeze;
  let trafficFreezeText;
  try {
    trafficFreezeText = readFileSync(trafficFreezePath, 'utf8');
    if (trafficFreezeText.includes('\uFFFD')) {
      fail('DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID');
    }
    trafficFreeze = JSON.parse(trafficFreezeText);
  } catch {
    fail('DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID');
  }
  if (sha256(trafficFreezeText) !== trafficFreezeReference.evidenceSha256) {
    fail('DB06_TRAFFIC_FREEZE_EVIDENCE_HASH_MISMATCH');
  }
  if (
    !exactKeys(trafficFreeze, [
      'schemaVersion',
      'environment',
      'mode',
      'projectRefFingerprint',
      'sourceGitCommit',
      'migrationPlanSha256',
      'rollbackRef',
      'operatorRole',
      'changeLockRef',
      'activatedAt',
      'observedAt',
      'holdUntil',
      'releaseCondition',
      'assertion',
      'controls',
      'evidenceRefs',
    ]) ||
    trafficFreeze.schemaVersion !== 1 ||
    trafficFreeze.environment !== 'staging' ||
    trafficFreeze.mode !== 'closed-ingress-zero-cohort' ||
    trafficFreeze.projectRefFingerprint !== projectRefFingerprint ||
    trafficFreeze.sourceGitCommit !== gitCommit ||
    trafficFreeze.migrationPlanSha256 !== record.migrationPlanSha256 ||
    trafficFreeze.rollbackRef !== rollbackRef ||
    trafficFreeze.operatorRole !== operatorRole ||
    trafficFreeze.releaseCondition !==
      'db06-pass-and-separately-recorded-downstream-live-gate-release' ||
    trafficFreeze.assertion !==
      'operator-attests-all-listed-ingress-remains-closed-through-hold-until' ||
    !isSafeLocalEvidenceReference(trafficFreeze.changeLockRef) ||
    !trafficFreeze.controls ||
    !exactKeys(trafficFreeze.controls, TRAFFIC_FREEZE_CONTROL_FIELDS) ||
    !trafficFreeze.evidenceRefs ||
    !exactKeys(trafficFreeze.evidenceRefs, TRAFFIC_FREEZE_EVIDENCE_FIELDS)
  ) {
    fail('DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID');
  }
  for (const field of TRAFFIC_FREEZE_CONTROL_FIELDS) {
    const expected =
      field === 'authExternalProviderCount'
        ? 0
        : field === 'edgeTrafficAdmission'
          ? 'frozen'
          : false;
    if (trafficFreeze.controls[field] !== expected) {
      fail('DB06_TRAFFIC_FREEZE_NOT_CLOSED');
    }
  }
  for (const field of TRAFFIC_FREEZE_EVIDENCE_FIELDS) {
    if (!isSafeLocalEvidenceReference(trafficFreeze.evidenceRefs[field])) {
      fail('DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID');
    }
  }
  validateOperatorRole(trafficFreeze.operatorRole);
  const freezeActivatedAt = timestamp(
    trafficFreeze.activatedAt,
    'DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID',
  );
  const freezeObservedAt = timestamp(
    trafficFreeze.observedAt,
    'DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID',
  );
  const freezeHoldUntil = timestamp(
    trafficFreeze.holdUntil,
    'DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID',
  );
  if (freezeHoldUntil - nowValue < minimumCompletionBudgetMs) {
    fail('DB06_CUTOVER_COMPLETION_BUDGET_INSUFFICIENT');
  }
  if (
    freezeActivatedAt > freezeObservedAt ||
    freezeObservedAt > reviewedAt ||
    (requireFreshObservations && nowValue - freezeObservedAt > 30 * 60_000) ||
    freezeHoldUntil - freezeActivatedAt > 24 * 60 * 60_000 ||
    freezeHoldUntil < validUntil ||
    freezeHoldUntil - nowValue < 60 * 60_000
  ) {
    fail('DB06_TRAFFIC_FREEZE_EVIDENCE_EXPIRED');
  }
  assertEvidenceSafe(trafficFreeze, rawProjectRef);
  const retainedTrafficFreezeName = 'cutover-traffic-provider-freeze.json';
  retainedArtifacts[retainedTrafficFreezeName] = trafficFreezeText;
  const trafficProviderFreezeSummary = {
    mode: 'closed-ingress-zero-cohort',
    activatedAt: new Date(freezeActivatedAt).toISOString(),
    observedAt: new Date(freezeObservedAt).toISOString(),
    holdUntil: new Date(freezeHoldUntil).toISOString(),
    changeLockRefSha256: sha256(trafficFreeze.changeLockRef),
    evidenceRefsSha256: sha256(canonicalJson(trafficFreeze.evidenceRefs)),
    retainedArtifact: retainedTrafficFreezeName,
    retainedArtifactSha256: sha256(trafficFreezeText),
    allIngressClosedOperatorAttested: true,
    edgeInvocationIngressDisabledOperatorAttested: true,
    releaseRequiresSeparateRecordedGate: true,
    operatorAttestationOnly: true,
  };
  const boundarySummaries = {};
  for (const boundary of requiredBoundaries) {
    const value = record.boundaries[boundary];
    const expectedEvidenceFile = CUTOVER_BOUNDARY_FILES[boundary];
    if (
      !value ||
      !exactKeys(value, ['mode', 'evidenceFile', 'evidenceSha256']) ||
      value.mode !== 'zero-cohort' ||
      value.evidenceFile !== expectedEvidenceFile ||
      !SHA256.test(String(value.evidenceSha256 ?? ''))
    ) {
      fail('DB06_CUTOVER_RECORD_INVALID');
    }
    const evidencePath = join(artifactRoot, expectedEvidenceFile);
    if (
      dirname(resolve(evidencePath)) !== artifactRoot ||
      !existsSync(evidencePath) ||
      !statSync(evidencePath).isFile() ||
      statSync(evidencePath).size > 1024 * 1024
    ) {
      fail('DB06_CUTOVER_EVIDENCE_INVALID');
    }
    let artifact;
    let artifactText;
    try {
      artifactText = readFileSync(evidencePath, 'utf8');
      if (artifactText.includes('\uFFFD')) fail('DB06_CUTOVER_EVIDENCE_INVALID');
      artifact = JSON.parse(artifactText);
    } catch {
      fail('DB06_CUTOVER_EVIDENCE_INVALID');
    }
    if (
      !exactKeys(artifact, [
        'schemaVersion',
        'environment',
        'boundary',
        'mode',
        'projectRefFingerprint',
        'sourceGitCommit',
        'observedAt',
        'operatorRole',
        'assertion',
        'counts',
      ]) ||
      artifact.schemaVersion !== 2 ||
      artifact.environment !== 'staging' ||
      artifact.boundary !== boundary ||
      artifact.mode !== 'zero-cohort' ||
      artifact.projectRefFingerprint !== projectRefFingerprint ||
      artifact.sourceGitCommit !== gitCommit ||
      artifact.operatorRole !== operatorRole ||
      artifact.assertion !== 'operator-attests-no-preexisting-user-cohort' ||
      !exactKeys(artifact.counts, ZERO_COHORT_COUNT_FIELDS) ||
      ZERO_COHORT_COUNT_FIELDS.some((field) => artifact.counts[field] !== 0)
    ) {
      fail('DB06_CUTOVER_EVIDENCE_INVALID');
    }
    validateOperatorRole(artifact.operatorRole);
    const observedAt = timestamp(artifact.observedAt, 'DB06_CUTOVER_EVIDENCE_INVALID');
    if (
      observedAt > reviewedAt ||
      observedAt > nowValue ||
      (requireFreshObservations && nowValue - observedAt > 30 * 60_000)
    ) {
      fail('DB06_CUTOVER_EVIDENCE_INVALID');
    }
    assertEvidenceSafe(artifact, rawProjectRef);
    const retainedName = `cutover-boundary-${expectedEvidenceFile}`;
    const retainedText = artifactText;
    const retainedSha256 = sha256(retainedText);
    if (value.evidenceSha256 !== retainedSha256) {
      fail('DB06_CUTOVER_EVIDENCE_HASH_MISMATCH');
    }
    retainedArtifacts[retainedName] = retainedText;
    boundarySummaries[boundary] = {
      mode: 'zero-cohort',
      retainedArtifact: retainedName,
      retainedArtifactSha256: retainedSha256,
      operatorAttestationOnly: true,
    };
  }
  const retainedRecordText = retainedArtifacts['cutover-attestation.json'];
  return {
    completionWindow: {
      validatedAt: now.toISOString(),
      minimumCompletionBudgetMs,
      validityRemainingMs: validUntil - nowValue,
      holdRemainingMs: freezeHoldUntil - nowValue,
    },
    summary: {
      recordSha256: sha256(retainedRecordText),
      reviewedAt: new Date(reviewedAt).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
      retentionReviewAt: new Date(retentionReviewAt).toISOString(),
      attestationRoles: [...record.attestationRoles].sort((left, right) =>
        left.localeCompare(right),
      ),
      boundaries: boundarySummaries,
      migrationPlanSha256: record.migrationPlanSha256,
      noDashboardSchemaMutationOperatorAttested: true,
      rollbackPointOperatorAttested: true,
      trafficProviderFreeze: trafficProviderFreezeSummary,
      attestationScope:
        'operator-supplied procedural context; live aggregate queries remain authoritative',
    },
    retainedArtifacts,
  };
}

function functionVersionsBySlug(functions) {
  return new Map(functions.map((value) => [value.slug, value.version]));
}

export function validateCompletedDeployment({
  sourceInventory,
  beforeMigrationIds,
  preMigrationFunctions,
  afterMigrationIds,
  afterFunctions,
  afterSchema,
  afterSecrets,
  localTypes,
  linkedTypes,
  repositoryTypes,
}) {
  assertRemoteMigrationPrefix(sourceInventory, beforeMigrationIds);
  const sourceIds = sourceInventory.migrations.map(({ id }) => id);
  if (!exactArray(afterMigrationIds, sourceIds)) fail('DB06_AFTER_MIGRATION_HISTORY_INCOMPLETE');
  if (
    preMigrationFunctions.length !== sourceInventory.functionCount ||
    afterFunctions.length !== sourceInventory.functionCount
  ) {
    fail('DB06_AFTER_FUNCTION_INVENTORY_INCOMPLETE');
  }
  const preVersions = functionVersionsBySlug(preMigrationFunctions);
  for (const value of afterFunctions) {
    if (!preVersions.has(value.slug) || value.version < preVersions.get(value.slug)) {
      fail('DB06_AFTER_FUNCTION_VERSION_REGRESSED');
    }
  }
  if (
    afterSchema.publicTableCount !== DB06_CURRENT_SOURCE_CONTRACT.publicTableCount ||
    afterSchema.publicRlsTableCount !== afterSchema.publicTableCount ||
    afterSchema.storageBucketCount !== DB06_CURRENT_SOURCE_CONTRACT.storageBucketCount ||
    afterSchema.authUserCount !== 0 ||
    afterSchema.authIdentityCount !== 0 ||
    afterSchema.appleIdentityCount !== 0 ||
    afterSchema.authSessionCount !== 0 ||
    afterSchema.storageObjectCount !== 0 ||
    afterSchema.relevantCronJobCount !== 0 ||
    afterSchema.allCronJobCount !== 0
  ) {
    fail('DB06_AFTER_SCHEMA_COUNTS_INVALID');
  }
  if (
    afterSecrets.missingGroupIds.length > 0 ||
    !afterSecrets.appEnvironmentNamesPresent ||
    !afterSecrets.trafficFreezeNamePresent
  ) {
    fail('DB06_REQUIRED_HOSTED_CONFIGURATION_MISSING');
  }
  if (localTypes.sha256 !== linkedTypes.sha256) fail('DB06_LOCAL_LINKED_TYPES_DIVERGED');
  if (repositoryTypes?.sha256 !== localTypes.sha256) {
    fail('DB08_REPOSITORY_TYPES_DIVERGED');
  }
  return true;
}

export function reserveEvidenceDirectory(outputRoot, evidenceId, reservation) {
  validateEvidenceId(evidenceId);
  const parent = resolve(outputRoot);
  const target = join(parent, evidenceId);
  mkdirSync(parent, { recursive: true });
  try {
    mkdirSync(target, { recursive: false });
    writeFileSync(join(target, 'reservation.json'), `${JSON.stringify(reservation, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch {
    fail('DB06_EVIDENCE_DIRECTORY_EXISTS');
  }
  return target;
}

function passAuthFreezeComplete(value) {
  return (
    value &&
    value.newUserSignupDisabled === true &&
    value.anonymousSignupDisabled === true &&
    value.reviewedExternalEnabledFieldCount === AUTH_EXTERNAL_ENABLED_FIELDS.length &&
    value.enabledExternalProviderCount === 0 &&
    value.reviewedAuthHookFieldCount === AUTH_HOOK_ENABLED_FIELDS.length &&
    value.enabledAuthHookCount === 0 &&
    value.samlEnabled === false &&
    value.oauthServerEnabled === false &&
    value.customOAuthEnabled === false &&
    value.ssoProviderCount === 0 &&
    value.thirdPartyAuthIntegrationCount === 0 &&
    typeof value.observedAt === 'string' &&
    value.source === 'supabase-management-api-v1-read-only'
  );
}

function passTrafficFreezeCanaryComplete(value, expectedSlugs) {
  return (
    value &&
    value.checkedFunctionCount === expectedSlugs.length &&
    value.allReturnedFrozenNoStore === true &&
    Array.isArray(value.functions) &&
    value.functions.length === expectedSlugs.length &&
    value.functions.every(
      (entry, index) =>
        entry.slug === expectedSlugs[index] &&
        entry.status === 503 &&
        entry.errorCode === 'DB06_STAGING_TRAFFIC_FROZEN',
    )
  );
}

function passFunctionInventoryComplete(value, sourceInventory) {
  if (!Array.isArray(value) || value.length !== sourceInventory.functionCount) {
    return false;
  }
  const expected = [...sourceInventory.functions].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  );
  return value.every((entry, index) => {
    const definition = expected[index];
    return (
      exactKeys(entry, [
        'slug',
        'status',
        'version',
        'verifyJwt',
        'hostedBundleSha256',
        'updatedAt',
        'reviewedSourceSetSha256',
      ]) &&
      entry.slug === definition.slug &&
      entry.status === 'ACTIVE' &&
      Number.isSafeInteger(entry.version) &&
      entry.version >= 1 &&
      entry.verifyJwt === definition.verifyJwt &&
      SHA256.test(String(entry.hostedBundleSha256 ?? '')) &&
      Number.isFinite(Date.parse(String(entry.updatedAt ?? ''))) &&
      entry.reviewedSourceSetSha256 === definition.sourceSetSha256
    );
  });
}

function passSchemaShape(value) {
  const fields = [
    ...SCHEMA_INVENTORY_FIELDS.map(([, output]) => output),
    ...CRON_INVENTORY_FIELDS.map(([, output]) => output),
  ];
  return (
    value &&
    exactKeys(value, fields) &&
    fields.every((field) => Number.isSafeInteger(value[field]) && value[field] >= 0)
  );
}

function passDeploymentStateComplete({ sourceInventory, before, preMigration, after, types }) {
  if (
    !passSchemaShape(before?.schema) ||
    Object.values(before.schema).some((count) => count !== 0) ||
    before.migrationCount !== 0 ||
    !Array.isArray(before.migrationIds) ||
    before.migrationIds.length !== 0 ||
    !Array.isArray(before.functions) ||
    before.functions.length !== 0 ||
    !passFunctionInventoryComplete(preMigration?.functions, sourceInventory) ||
    !passFunctionInventoryComplete(after?.functions, sourceInventory) ||
    !passSchemaShape(after?.schema) ||
    !types?.localGenerated ||
    !types?.linkedGenerated ||
    !types?.repositoryGenerated
  ) {
    return false;
  }
  try {
    return validateCompletedDeployment({
      sourceInventory,
      beforeMigrationIds: before.migrationIds,
      preMigrationFunctions: preMigration.functions,
      afterMigrationIds: after.migrationIds,
      afterFunctions: after.functions,
      afterSchema: after.schema,
      afterSecrets: after.secretConfiguration,
      localTypes: types.localGenerated,
      linkedTypes: types.linkedGenerated,
      repositoryTypes: types.repositoryGenerated,
    });
  } catch {
    return false;
  }
}

function passImmediateTargetComplete(value, sourceInventory) {
  const schemaFields = [
    ...SCHEMA_INVENTORY_FIELDS.map(([, output]) => output),
    ...CRON_INVENTORY_FIELDS.map(([, output]) => output),
  ];
  return (
    value &&
    typeof value.capturedAt === 'string' &&
    value.schema &&
    exactKeys(value.schema, schemaFields) &&
    schemaFields.every((field) => value.schema[field] === 0) &&
    value.migrationCount === 0 &&
    Array.isArray(value.migrationIds) &&
    value.migrationIds.length === 0 &&
    passFunctionInventoryComplete(value.functions, sourceInventory) &&
    passAuthFreezeComplete(value.authIngressFreeze)
  );
}

function assertPassEvidenceComplete({
  sourceInventory,
  steps,
  cutover,
  before,
  preMigration,
  after,
  types,
  completedAtValue,
}) {
  const publicSlugs = sourceInventory.functions
    .filter(({ verifyJwt }) => verifyJwt === false)
    .map(({ slug }) => slug)
    .sort((left, right) => left.localeCompare(right));
  const immediate = preMigration?.immediateTargetRevalidation;
  const initialCutover = cutover?.initialPreMutationValidation;
  const immediateCutover = preMigration?.immediateCutoverRevalidation;
  const finalCutover = after?.finalCutoverRevalidation;
  const initialCutoverValidatedAt = Date.parse(String(initialCutover?.validatedAt ?? ''));
  const cutoverValidUntil = Date.parse(String(cutover?.validUntil ?? ''));
  const cutoverHoldUntil = Date.parse(String(cutover?.trafficProviderFreeze?.holdUntil ?? ''));
  const immediateCutoverValidatedAt = Date.parse(String(immediateCutover?.validatedAt ?? ''));
  const immediateValidUntil = Date.parse(String(immediateCutover?.validUntil ?? ''));
  const immediateHoldUntil = Date.parse(String(immediateCutover?.holdUntil ?? ''));
  const finalCutoverValidatedAt = Date.parse(String(finalCutover?.validatedAt ?? ''));
  const finalValidUntil = Date.parse(String(finalCutover?.validUntil ?? ''));
  const finalHoldUntil = Date.parse(String(finalCutover?.holdUntil ?? ''));
  if (
    !before ||
    !preMigration ||
    !after ||
    !types ||
    !passDeploymentStateComplete({ sourceInventory, before, preMigration, after, types }) ||
    !cutover?.trafficProviderFreeze?.allIngressClosedOperatorAttested ||
    !initialCutover ||
    typeof initialCutover.validatedAt !== 'string' ||
    initialCutover.freshObservations !== true ||
    initialCutover.minimumCompletionBudgetMs !== DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS ||
    !Number.isSafeInteger(initialCutover.validityRemainingMs) ||
    !Number.isSafeInteger(initialCutover.holdRemainingMs) ||
    !Number.isFinite(initialCutoverValidatedAt) ||
    !Number.isFinite(cutoverValidUntil) ||
    !Number.isFinite(cutoverHoldUntil) ||
    initialCutover.validityRemainingMs !== cutoverValidUntil - initialCutoverValidatedAt ||
    initialCutover.holdRemainingMs !== cutoverHoldUntil - initialCutoverValidatedAt ||
    initialCutover.validityRemainingMs < DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS ||
    initialCutover.holdRemainingMs < DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS ||
    !passAuthFreezeComplete(before.authIngressFreeze) ||
    preMigration.trafficFreezeState !== 'frozen-and-retained-through-downstream-release-gate' ||
    !passTrafficFreezeCanaryComplete(preMigration.trafficFreezeCanary, publicSlugs) ||
    !passImmediateTargetComplete(immediate, sourceInventory) ||
    !immediateCutover ||
    typeof immediateCutover.validatedAt !== 'string' ||
    immediateCutover.freshObservations !== false ||
    immediateCutover.observationFreshnessBasis !== 'initial-pre-mutation' ||
    immediateCutover.currentValidityAndHold !== true ||
    immediateCutover.minimumCompletionBudgetMs !== DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS ||
    !Number.isSafeInteger(immediateCutover.validityRemainingMs) ||
    !Number.isSafeInteger(immediateCutover.holdRemainingMs) ||
    immediateCutover.recordSha256 !== cutover.recordSha256 ||
    immediateCutover.retainedArtifactsSha256 !== cutover.retainedArtifactsSha256 ||
    immediateCutover.validUntil !== cutover.validUntil ||
    immediateCutover.holdUntil !== cutover.trafficProviderFreeze.holdUntil ||
    !Number.isFinite(immediateCutoverValidatedAt) ||
    !Number.isFinite(immediateValidUntil) ||
    !Number.isFinite(immediateHoldUntil) ||
    immediateCutover.validityRemainingMs !== immediateValidUntil - immediateCutoverValidatedAt ||
    immediateCutover.holdRemainingMs !== immediateHoldUntil - immediateCutoverValidatedAt ||
    immediateCutover.validityRemainingMs < DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS ||
    immediateCutover.holdRemainingMs < DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS ||
    immediateValidUntil <= immediateCutoverValidatedAt ||
    immediateHoldUntil < immediateValidUntil ||
    !passTrafficFreezeCanaryComplete(immediate.trafficFreezeCanary, publicSlugs) ||
    canonicalJson(immediate.functions) !== canonicalJson(preMigration.functions) ||
    after.trafficFreezeState !== 'frozen-and-retained-through-downstream-release-gate' ||
    !passAuthFreezeComplete(after.authIngressFreeze) ||
    !passTrafficFreezeCanaryComplete(after.trafficFreezeCanary, publicSlugs) ||
    after.schema?.allCronJobCount !== 0 ||
    after.secretConfiguration?.trafficFreezeNamePresent !== true ||
    !finalCutover ||
    typeof finalCutover.validatedAt !== 'string' ||
    finalCutover.validAtCompletion !== true ||
    finalCutover.observationRecencyValidatedAtInitialGate !== true ||
    finalCutover.finalGateRevalidatedCurrentValidityAndHold !== true ||
    finalCutover.minimumCompletionBudgetMs !== 0 ||
    !Number.isSafeInteger(finalCutover.validityRemainingMs) ||
    !Number.isSafeInteger(finalCutover.holdRemainingMs) ||
    finalCutover.recordSha256 !== cutover.recordSha256 ||
    finalCutover.retainedArtifactsSha256 !== cutover.retainedArtifactsSha256 ||
    finalCutover.observationFreshnessBasis !== 'initial-pre-mutation' ||
    finalCutover.validUntil !== cutover.validUntil ||
    finalCutover.holdUntil !== cutover.trafficProviderFreeze.holdUntil ||
    !Number.isFinite(finalValidUntil) ||
    !Number.isFinite(finalHoldUntil) ||
    !Number.isFinite(finalCutoverValidatedAt) ||
    finalCutover.validityRemainingMs !== finalValidUntil - finalCutoverValidatedAt ||
    finalCutover.holdRemainingMs !== finalHoldUntil - finalCutoverValidatedAt ||
    finalValidUntil <= completedAtValue ||
    finalHoldUntil < finalValidUntil ||
    finalHoldUntil - completedAtValue < 60 * 60_000 ||
    steps.some(
      (step) =>
        step.result !== 'pass' ||
        step.completedAt == null ||
        ['pending', 'unconfirmed'].includes(step.processContainment),
    )
  ) {
    fail('DB06_PASS_EVIDENCE_INCOMPLETE');
  }
}

export function buildEvidenceManifest({
  evidenceId,
  result,
  gitCommit,
  startedAt,
  completedAt,
  operatorRole,
  projectRefLast4,
  projectRefFingerprint,
  rollbackRef,
  sourceInventory,
  sourceSnapshot,
  runtime,
  steps,
  cutover,
  before,
  preMigration,
  after,
  types,
  retentionReviewAt,
  retainedArtifactNames,
  failureReadback = null,
  remoteMutationStarted = false,
  failureCode = null,
}) {
  validateEvidenceId(evidenceId);
  validateOperatorRole(operatorRole);
  validateRollbackRef(rollbackRef);
  if (
    !['pass', 'fail'].includes(result) ||
    !GIT_SHA.test(gitCommit) ||
    !PROJECT_REF_SUFFIX.test(projectRefLast4) ||
    !SHA256.test(projectRefFingerprint)
  ) {
    fail('DB06_EVIDENCE_MANIFEST_INVALID');
  }
  timestamp(startedAt, 'DB06_EVIDENCE_MANIFEST_INVALID');
  const completedAtValue = timestamp(completedAt, 'DB06_EVIDENCE_MANIFEST_INVALID');
  const retentionReviewAtValue = timestamp(retentionReviewAt, 'DB06_EVIDENCE_MANIFEST_INVALID');
  if (retentionReviewAtValue <= completedAtValue) fail('DB06_EVIDENCE_MANIFEST_INVALID');
  if (!Array.isArray(steps) || steps.length === 0) fail('DB06_EVIDENCE_MANIFEST_INVALID');
  if (
    !sourceSnapshot ||
    !Number.isSafeInteger(sourceSnapshot.trackedFileCount) ||
    sourceSnapshot.trackedFileCount < 1 ||
    !SHA256.test(String(sourceSnapshot.trackedFileSetSha256 ?? '')) ||
    !Array.isArray(retainedArtifactNames) ||
    retainedArtifactNames.length < 2 ||
    new Set(retainedArtifactNames).size !== retainedArtifactNames.length ||
    !retainedArtifactNames.includes('manifest.json') ||
    !retainedArtifactNames.includes('deployment-log.jsonl')
  ) {
    fail('DB06_EVIDENCE_MANIFEST_INVALID');
  }
  if (
    result === 'pass' &&
    (!before || !preMigration || !after || !types || !cutover || failureCode)
  ) {
    fail('DB06_PASS_EVIDENCE_INCOMPLETE');
  }
  if (result === 'pass') {
    assertPassEvidenceComplete({
      sourceInventory,
      steps,
      cutover,
      before,
      preMigration,
      after,
      types,
      completedAtValue,
    });
  }
  if (result === 'fail' && !/^[A-Z0-9_:-]{4,160}$/u.test(String(failureCode ?? ''))) {
    fail('DB06_FAILURE_CODE_INVALID');
  }
  return {
    schemaVersion: DB06_EVIDENCE_SCHEMA_VERSION,
    evidenceId,
    workItemIds: ['DB-06'],
    featureIds: sourceInventory.featureIds,
    gatedSurfaceIds: sourceInventory.gatedSurfaceIds,
    environment: 'staging',
    appVersion: 'not-applicable-db-deployment',
    buildNumber: 'not-applicable-db-deployment',
    gitCommit,
    sourceControl: {
      branchAtSnapshot: 'main',
      cleanAtSnapshot: true,
      exactOriginMainAtSnapshot: true,
    },
    sourceHashes: {
      migrations: sourceInventory.migrationSetSha256,
      functionManifest: sourceInventory.functionManifestSha256,
      functions: sourceInventory.functionSetSha256,
      denoLock: sourceInventory.denoLockSha256,
      deploymentInputs: sourceInventory.deploymentInputSetSha256,
    },
    sourceSnapshot,
    startedAt,
    completedAt,
    operatorRole,
    deviceOrRuntime: runtime,
    commandsOrProcedure: steps.map(({ commandId }) => commandId),
    result,
    findings:
      result === 'pass'
        ? []
        : [
            {
              code: failureCode,
              disposition: remoteMutationStarted
                ? 'unknown-remote-state-requires-containment-and-readback'
                : 'failed-before-remote-mutation',
            },
          ],
    redactionsApplied: [
      'retained only the last four characters of the non-secret project reference',
      'discarded raw CLI stdout and stderr after structured validation',
      'retained hosted secret names only as aggregate group satisfaction; discarded digests and values',
      'excluded credentials, user identifiers, row data, provider payloads, and personal operator identity',
    ],
    retentionClass: DB06_RETENTION_CLASS,
    deleteOrReviewAt: new Date(retentionReviewAtValue).toISOString(),
    rollbackRef,
    target: { environment: 'staging', projectRefLast4, projectRefFingerprint },
    sourceInventory: {
      featureIds: sourceInventory.featureIds,
      gatedSurfaceIds: sourceInventory.gatedSurfaceIds,
      migrationCount: sourceInventory.migrationCount,
      latestMigrationId: sourceInventory.latestMigrationId,
      migrations: sourceInventory.migrations,
      functionCount: sourceInventory.functionCount,
      functions: sourceInventory.functions,
      deploymentInputs: sourceInventory.deploymentInputs,
    },
    cutover,
    deployment: {
      before: before ?? null,
      preMigration: preMigration ?? null,
      after: after ?? null,
      types: types ?? null,
    },
    operationState: {
      remoteMutationStarted,
      remoteState:
        result === 'pass'
          ? 'verified-complete'
          : remoteMutationStarted
            ? 'unknown-requires-containment-and-readback'
            : 'not-mutated-by-this-run',
      lastCompletedCommandId:
        [...steps].reverse().find(({ result: stepResult }) => stepResult === 'pass')?.commandId ??
        null,
      failureReadback,
    },
    integrity: {
      retainedArtifacts: [...retainedArtifactNames].sort((left, right) =>
        left.localeCompare(right),
      ),
      checksumFile: 'checksums.sha256',
      hashSemantics: 'SHA-256 covers only retained redacted artifacts.',
    },
  };
}

export function assertEvidenceSafe(value, rawProjectRef) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const forbidden = [
    /\bsbp_[A-Za-z0-9_-]+\b/gu,
    /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gu,
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu,
    /postgres(?:ql)?:\/\//giu,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  ];
  if (
    (rawProjectRef && text.includes(rawProjectRef)) ||
    forbidden.some((pattern) => pattern.test(text))
  ) {
    fail('DB06_EVIDENCE_REDACTION_FAILED');
  }
  return true;
}

export function finalizeEvidenceDirectory(
  target,
  manifest,
  steps,
  rawProjectRef,
  { linkedTypes = null, additionalArtifacts = {} } = {},
) {
  if (!existsSync(join(target, 'reservation.json'))) fail('DB06_EVIDENCE_RESERVATION_MISSING');
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const logText = `${steps.map((step) => JSON.stringify(step)).join('\n')}\n`;
  const typesText = linkedTypes == null ? null : String(linkedTypes);
  if (
    !additionalArtifacts ||
    typeof additionalArtifacts !== 'object' ||
    Array.isArray(additionalArtifacts)
  ) {
    fail('DB06_EVIDENCE_FINALIZATION_FAILED');
  }
  for (const [name, text] of Object.entries(additionalArtifacts)) {
    if (
      !/^[a-z0-9][a-z0-9.-]{1,126}[a-z0-9]$/u.test(name) ||
      [
        'manifest.json',
        'checksums.sha256',
        'reservation.json',
        'deployment-log.jsonl',
        'database.types.linked.ts',
      ].includes(name) ||
      name.endsWith('.pending') ||
      typeof text !== 'string'
    ) {
      fail('DB06_EVIDENCE_FINALIZATION_FAILED');
    }
  }
  const artifacts = {
    'deployment-log.jsonl': logText,
    ...additionalArtifacts,
  };
  if (typesText != null) artifacts['database.types.linked.ts'] = typesText;
  const retained = { 'manifest.json': manifestText, ...artifacts };
  const retainedNames = Object.keys(retained).sort((left, right) => left.localeCompare(right));
  const declaredNames = [...(manifest.integrity?.retainedArtifacts ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );
  if (!exactArray(retainedNames, declaredNames)) fail('DB06_EVIDENCE_FINALIZATION_FAILED');
  for (const text of Object.values(retained)) assertEvidenceSafe(text, rawProjectRef);
  const checksumText = `${retainedNames
    .map((name) => `${sha256(retained[name])}  ${name}`)
    .join('\n')}\n`;
  assertEvidenceSafe(checksumText, rawProjectRef);

  function writeFinalFile(name, text) {
    const finalPath = join(target, name);
    const pendingPath = join(target, `${name}.pending`);
    if (existsSync(finalPath)) {
      if (readFileSync(finalPath, 'utf8') !== text) fail('DB06_EVIDENCE_FINALIZATION_FAILED');
      rmSync(pendingPath, { force: true });
      return;
    }
    rmSync(pendingPath, { force: true });
    writeFileSync(pendingPath, text, { encoding: 'utf8', flag: 'wx' });
    renameSync(pendingPath, finalPath);
  }

  try {
    for (const name of Object.keys(artifacts).sort((left, right) => left.localeCompare(right))) {
      writeFinalFile(name, artifacts[name]);
    }
    writeFinalFile('checksums.sha256', checksumText);
    writeFinalFile('manifest.json', manifestText);
    rmSync(join(target, 'reservation.json'));
  } catch {
    fail('DB06_EVIDENCE_FINALIZATION_FAILED');
  }
}
