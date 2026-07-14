#!/usr/bin/env node
import {
  AUTHENTICATED_CATALOG_TABLES,
  OWNER_LINKED_PRIVATE_TABLES,
  PRIVATE_PUBLIC_TABLES,
  SEALED_SERVICE_PRIVATE_TABLES,
  SERVICE_ONLY_PRIVATE_TABLES,
  block,
  evidenceFlagEnabled,
  listFiles,
  printResult,
  read,
  sqlPolicyStatement,
  tableClassificationIssues,
  warn,
} from './lib.mjs';

const errors = [];
const warnings = [];

const migrations = listFiles('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => read(file))
  .join('\n');
const exportRegistrySource = read('supabase/functions/data-export/exportRegistry.ts');
const exportSource = `${read('supabase/functions/data-export/index.ts')}\n${exportRegistrySource}`;
const packageJson = JSON.parse(read('package.json'));
const liveHarness = read('scripts/phase9/live-supabase-adversarial.mjs');
const contractSmoke = read('scripts/phase9/rls-adversarial-smoke.mjs');
const phase2Smoke = read('scripts/phase2/supabase-rls-smoke.mjs');
const anonymousPhotoStorageGuard = read(
  'supabase/migrations/20260713000045_anonymous_photo_storage_guard.sql',
);
const photoMetadataInsertPolicy = sqlPolicyStatement(
  migrations,
  'photos_no_anon_cloud_backup_insert',
);
const photoMetadataUpdatePolicy = sqlPolicyStatement(
  migrations,
  'photos_no_anon_cloud_backup_update',
);
const photoStorageInsertPolicy = sqlPolicyStatement(
  anonymousPhotoStorageGuard,
  'photos_objects_insert_own',
);
const photoStorageUpdatePolicy = sqlPolicyStatement(
  anonymousPhotoStorageGuard,
  'photos_objects_update_own',
);

const createdTables = new Set(
  [...migrations.matchAll(/create table(?: if not exists)? public\.([a-z_]+)/gi)].map(
    (match) => match[1],
  ),
);
const rlsTables = new Set(
  [...migrations.matchAll(/alter table public\.([a-z_]+) enable row level security/gi)].map(
    (match) => match[1],
  ),
);
const dynamicUserTables = new Set();
for (const match of migrations.matchAll(
  /create table(?: if not exists)? public\.([a-z_]+)\s*\(([\s\S]*?)\n\);/gi,
)) {
  if (/references auth\.users/i.test(match[2])) dynamicUserTables.add(match[1]);
}

const tableClassifications = [
  ['owner-linked private', OWNER_LINKED_PRIVATE_TABLES],
  ['service-only private', SERVICE_ONLY_PRIVATE_TABLES],
  ['sealed service-only private', SEALED_SERVICE_PRIVATE_TABLES],
  ['authenticated catalog/editorial', AUTHENTICATED_CATALOG_TABLES],
];

block(
  errors,
  OWNER_LINKED_PRIVATE_TABLES.length === 30,
  `Owner-linked private-table inventory must contain 30 tables; found ${OWNER_LINKED_PRIVATE_TABLES.length}.`,
);
block(
  errors,
  SERVICE_ONLY_PRIVATE_TABLES.length === 10,
  `Service-only private-table inventory must contain 10 tables; found ${SERVICE_ONLY_PRIVATE_TABLES.length}.`,
);
block(
  errors,
  SEALED_SERVICE_PRIVATE_TABLES.length === 6,
  `Sealed service-only private-table inventory must contain 6 tables; found ${SEALED_SERVICE_PRIVATE_TABLES.length}.`,
);
block(
  errors,
  AUTHENTICATED_CATALOG_TABLES.length === 23,
  `Authenticated catalog/editorial inventory must contain 23 tables; found ${AUTHENTICATED_CATALOG_TABLES.length}.`,
);
block(
  errors,
  PRIVATE_PUBLIC_TABLES.length === 46,
  `Combined private-table inventory must contain 46 tables; found ${PRIVATE_PUBLIC_TABLES.length}.`,
);

for (const table of SEALED_SERVICE_PRIVATE_TABLES) {
  block(
    errors,
    new RegExp(`alter table public\\.${table} force row level security`, 'i').test(migrations),
    `Sealed service-only table must force RLS: ${table}.`,
  );
  block(
    errors,
    new RegExp(`revoke all on table public\\.${table}[\\s\\S]{0,160}service_role`, 'i').test(
      migrations,
    ),
    `Sealed service-only table must revoke direct service_role access: ${table}.`,
  );
}

for (const issue of tableClassificationIssues({
  createdTables,
  rlsTables,
  classifications: tableClassifications,
})) {
  if (issue.kind === 'unclassified') {
    errors.push(`Discovered public table without Phase 9 classification: ${issue.table}.`);
  } else if (issue.kind === 'duplicate') {
    errors.push(
      `Public table appears in multiple Phase 9 classifications: ${issue.table} (${issue.classifications.join(', ')}).`,
    );
  } else if (issue.kind === 'stale') {
    errors.push(`Migration missing classified table ${issue.table}.`);
  } else if (issue.kind === 'rls-disabled') {
    errors.push(`RLS is not enabled for ${issue.table}.`);
  }
}

for (const table of dynamicUserTables) {
  block(
    errors,
    OWNER_LINKED_PRIVATE_TABLES.includes(table) || SERVICE_ONLY_PRIVATE_TABLES.includes(table),
    `Discovered auth.users-linked table without Phase 9 RLS classification: ${table}.`,
  );
}

for (const table of OWNER_LINKED_PRIVATE_TABLES) {
  block(
    errors,
    exportSource.includes(table),
    `User-linked table is missing from data-export coverage: ${table}.`,
  );
}

const callerRegistryStart = exportRegistrySource.indexOf('export const CALLER_RLS_EXPORT_TABLES');
const callerRegistryEnd = exportRegistrySource.indexOf(
  'export const SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES',
  callerRegistryStart,
);
const callerRegistryTables = [
  ...exportRegistrySource
    .slice(callerRegistryStart, callerRegistryEnd)
    .matchAll(/table:\s*'([^']+)'/g),
].map((match) => match[1]);
block(
  errors,
  callerRegistryStart >= 0 &&
    callerRegistryEnd > callerRegistryStart &&
    callerRegistryTables.length === OWNER_LINKED_PRIVATE_TABLES.length &&
    JSON.stringify([...new Set(callerRegistryTables)].sort()) ===
      JSON.stringify([...OWNER_LINKED_PRIVATE_TABLES].sort()),
  'Caller-RLS export registry must exactly match the 30 owner-linked private tables without duplicates.',
);
block(
  errors,
  callerRegistryTables.every((table) => !SERVICE_ONLY_PRIVATE_TABLES.includes(table)),
  'Caller-RLS export registry contains a service-only private table.',
);

const serviceOnlyExportExclusions = new Set([
  'catalog_import_batches',
  'catalog_quality_reports',
  'community_moderation_events',
  'waitlist_signups',
  'growth_events',
  'edge_rate_limits',
]);

for (const table of serviceOnlyExportExclusions) {
  block(
    errors,
    SERVICE_ONLY_PRIVATE_TABLES.includes(table),
    `Unknown service-only export exclusion: ${table}.`,
  );
}

for (const table of SERVICE_ONLY_PRIVATE_TABLES) {
  if (serviceOnlyExportExclusions.has(table)) continue;
  block(
    errors,
    exportSource.includes(table),
    `Service-only user-linked table is missing from data-export or exclusion coverage: ${table}.`,
  );
}

block(
  errors,
  /photos_objects_select_own/.test(migrations),
  'Storage RLS policy missing for photos select.',
);
block(
  errors,
  /photos_objects_insert_own/.test(migrations),
  'Storage RLS policy missing for photos insert.',
);
block(
  errors,
  Boolean(photoMetadataInsertPolicy) &&
    /on\s+public\.photos/i.test(photoMetadataInsertPolicy) &&
    /as\s+restrictive/i.test(photoMetadataInsertPolicy) &&
    /for\s+insert/i.test(photoMetadataInsertPolicy) &&
    /to\s+authenticated/i.test(photoMetadataInsertPolicy) &&
    /with\s+check/i.test(photoMetadataInsertPolicy) &&
    /is_anonymous/i.test(photoMetadataInsertPolicy) &&
    Boolean(photoMetadataUpdatePolicy) &&
    /on\s+public\.photos/i.test(photoMetadataUpdatePolicy) &&
    /as\s+restrictive/i.test(photoMetadataUpdatePolicy) &&
    /for\s+update/i.test(photoMetadataUpdatePolicy) &&
    /to\s+authenticated/i.test(photoMetadataUpdatePolicy) &&
    /with\s+check/i.test(photoMetadataUpdatePolicy) &&
    /is_anonymous/i.test(photoMetadataUpdatePolicy),
  'Photo metadata insert and update policies must deny cloud persistence to signed anonymous Auth users.',
);
block(
  errors,
  Boolean(photoStorageInsertPolicy) &&
    /on\s+storage\.objects/i.test(photoStorageInsertPolicy) &&
    /for\s+insert/i.test(photoStorageInsertPolicy) &&
    /to\s+authenticated/i.test(photoStorageInsertPolicy) &&
    /with\s+check/i.test(photoStorageInsertPolicy) &&
    /bucket_id\s*=\s*'photos'/i.test(photoStorageInsertPolicy) &&
    /storage\.foldername\(name\)/i.test(photoStorageInsertPolicy) &&
    /has_current_consent\('photo_cloud_backup'\)/i.test(photoStorageInsertPolicy) &&
    /is_anonymous/i.test(photoStorageInsertPolicy),
  'Photo Storage insert policy must deny signed anonymous Auth users after validating owner prefix and current consent.',
);
block(
  errors,
  Boolean(photoStorageUpdatePolicy) &&
    /on\s+storage\.objects/i.test(photoStorageUpdatePolicy) &&
    /for\s+update/i.test(photoStorageUpdatePolicy) &&
    /to\s+authenticated/i.test(photoStorageUpdatePolicy) &&
    /using\s*\(/i.test(photoStorageUpdatePolicy) &&
    /with\s+check/i.test(photoStorageUpdatePolicy) &&
    /bucket_id\s*=\s*'photos'/i.test(photoStorageUpdatePolicy) &&
    /storage\.foldername\(name\)/i.test(photoStorageUpdatePolicy) &&
    /has_current_consent\('photo_cloud_backup'\)/i.test(photoStorageUpdatePolicy) &&
    /is_anonymous/i.test(photoStorageUpdatePolicy),
  'Photo Storage update policy must deny signed anonymous Auth users after validating owner prefix and current consent.',
);
block(
  errors,
  /photos_objects_delete_own/.test(migrations),
  'Storage RLS policy missing for photos delete.',
);
block(
  errors,
  /add column quality_source text/i.test(migrations) &&
    /photos_quality_source_allowed/i.test(migrations) &&
    /photos_quality_metadata_requires_source/i.test(migrations) &&
    /quality_source = 'post_capture_measurement'/i.test(migrations),
  'Photo quality metadata must require measured provenance.',
);
block(errors, /owns_routine/.test(migrations), 'Child-table routine ownership helper is missing.');
block(errors, /owns_cycle/.test(migrations), 'Child-table cycle ownership helper is missing.');
block(
  errors,
  /ask_turn_audit_select_own/.test(migrations),
  'Ask turn audit parent-owner policy is missing.',
);
block(
  errors,
  /drop policy if exists "routine_steps_insert_own"[\s\S]*create policy "routine_steps_insert_own"[\s\S]*owns_user_product\(user_product_id\)/i.test(
    migrations,
  ),
  'Routine step RLS must block cross-user product references.',
);
block(
  errors,
  /drop policy if exists "cycle_nights_insert_own"[\s\S]*create policy "cycle_nights_insert_own"[\s\S]*owns_user_product\(user_product_id\)/i.test(
    migrations,
  ),
  'Cycle night RLS must block cross-user product references.',
);
block(
  errors,
  /create or replace function public\.owns_ask_turn_audit[\s\S]*drop policy if exists "ask_safety_audit_insert_own"[\s\S]*owns_ask_turn_audit\(turn_audit_id\)/i.test(
    migrations,
  ),
  'Ask safety audit RLS must prove the referenced turn belongs to the caller.',
);
block(
  errors,
  /drop policy if exists "community_reports_insert_own"[\s\S]*moderation_state = 'approved'/i.test(
    migrations,
  ),
  'Community report RLS must block reports against private pending questions.',
);
block(
  errors,
  /create policy "photos_storage_path_owned_insert"[\s\S]*split_part\(storage_path, '\/', 1\) = \(select auth\.uid\(\)\)::text/i.test(
    migrations,
  ),
  'Photo metadata RLS must bind cloud storage_path to the caller prefix.',
);
block(
  errors,
  /create policy "photos_storage_path_owned_update"[\s\S]*local_only = true[\s\S]*storage_path is null[\s\S]*local_only = false/i.test(
    migrations,
  ),
  'Photo metadata RLS must block local-only rows with cloud storage paths.',
);
block(
  errors,
  /drop policy if exists "community_reactions_insert_own"[\s\S]*create policy "community_reactions_insert_own"[\s\S]*note_id is not null[\s\S]*reviewed_by is not null[\s\S]*claim_safety_ok = true/i.test(
    migrations,
  ),
  'Community reactions must target published claim-safe notes.',
);
block(
  errors,
  /create or replace function public\.has_current_consent/i.test(migrations),
  'Current consent helper is missing.',
);
for (const [type, tablePolicy] of [
  ['photo_cloud_backup', 'photos_cloud_backup_consent_insert'],
  ['photo_cloud_backup', 'photos_objects_insert_own'],
  ['data_sharing', 'commerce_click_events_consent_insert'],
  ['photo_trend_insights', 'photo_trend_consent_insert'],
  ['community_participation', 'community_reactions_consent_insert'],
  ['ask_onskin', 'ask_sessions_consent_insert'],
  ['ask_onskin', 'ask_turn_audit_consent_insert'],
  ['ask_onskin', 'ask_safety_audit_consent_insert'],
]) {
  block(
    errors,
    new RegExp(`${tablePolicy}[\\s\\S]*has_current_consent\\('${type}'\\)`, 'i').test(migrations),
    `${tablePolicy} must require current ${type} consent.`,
  );
}
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-supabase-adversarial']),
  'package.json is missing phase9:live-supabase-adversarial.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:rls-adversarial-smoke']),
  'package.json is missing phase9:rls-adversarial-smoke.',
);
block(
  errors,
  /phase9:rls-adversarial-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:rls-adversarial-smoke/.test(packageJson.scripts?.['launch:verify'] ?? ''),
  'Phase 9 and launch verification must execute the RLS adversarial contract smoke.',
);
block(
  errors,
  /tableClassificationIssues/.test(contractSmoke) &&
    /deniedReadOrMutationResult/.test(contractSmoke) &&
    /storageDeniedResult/.test(contractSmoke) &&
    /harnessErrorDetail/.test(contractSmoke),
  'RLS adversarial contract smoke must execute classification, PostgREST, Storage, and evidence-redaction predicates.',
);
block(
  errors,
  /deniedInsertResult/.test(phase2Smoke) &&
    /deniedReadOrMutationResult/.test(phase2Smoke) &&
    /signIn\.data\.user\?\.id === createdUser\.id/.test(phase2Smoke) &&
    /pao_source: 'unknown'/.test(phase2Smoke) &&
    /expiry_source: 'estimated'/.test(phase2Smoke),
  'Phase 2 RLS smoke must share exact denial predicates, verify signed-in identity, and use coherent Shelf fixtures.',
);
block(
  errors,
  /storage\.from\('photos'\)/.test(liveHarness) &&
    /PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL/.test(liveHarness),
  'Live Supabase adversarial harness must test private photo storage and require an explicit run flag.',
);

const staticProbeCounts = new Map();
for (const match of liveHarness.matchAll(/registerPrivateTableProbe\(\s*['"]([a-z_]+)['"]/g)) {
  staticProbeCounts.set(match[1], (staticProbeCounts.get(match[1]) ?? 0) + 1);
}
for (const match of liveHarness.matchAll(
  /registerSealedPrivateTableProbe\(\s*['"]([a-z_]+)['"]/g,
)) {
  staticProbeCounts.set(match[1], (staticProbeCounts.get(match[1]) ?? 0) + 1);
}

for (const table of PRIVATE_PUBLIC_TABLES) {
  const count = staticProbeCounts.get(table) ?? 0;
  block(
    errors,
    count === 1,
    `Live Supabase adversarial harness must register exactly one access-control probe for ${table}; found ${count}.`,
  );
}

for (const table of staticProbeCounts.keys()) {
  block(
    errors,
    PRIVATE_PUBLIC_TABLES.includes(table),
    `Live Supabase adversarial harness registers an unknown private-table probe: ${table}.`,
  );
}

for (const table of SERVICE_ONLY_PRIVATE_TABLES) {
  const cleanupMarker = `trackServiceCleanup('${table}'`;
  const probeMarker = `registerPrivateTableProbe('${table}'`;
  block(
    errors,
    liveHarness.indexOf(cleanupMarker) >= 0 &&
      liveHarness.indexOf(cleanupMarker) < liveHarness.indexOf(probeMarker),
    `Live harness must track ${table} cleanup before its first fallible probe assertion.`,
  );
}

block(
  errors,
  /cleanupUsers\.push\(\{ id: createdUser\.id \}\)[\s\S]*signInWithPassword/.test(liveHarness) &&
    /cleanupUsers\.push\(\{ id: data\.user\.id \}\)[\s\S]*is_anonymous === true/.test(liveHarness),
  'Live harness must track created permanent and signed-anonymous users before post-create assertions.',
);
block(
  errors,
  !/warnings\.push\([^\n]*cleanup/i.test(liveHarness) &&
    /errors\.push\([^\n]*cleanup/i.test(liveHarness) &&
    /getUserById\(user\.id\)/.test(liveHarness) &&
    /authUserMissing\(remaining\)/.test(liveHarness) &&
    /owner-cascade cleanup left a residual row/.test(liveHarness) &&
    /cleanup left a residual row/.test(liveHarness) &&
    /Storage cleanup left a residual object/.test(liveHarness),
  'Live cleanup must block on failures and verify Auth users, private/global rows, and Storage objects are absent.',
);

const requiredLiveHarnessChecks = [
  'all 46 private tables have access-control probes',
  'routine conflict swapped canonical pair',
  'routine conflict duplicate canonical identity',
  'Shelf provenance matrix',
  "for (const paoSource of ['label', 'catalog', 'category_default', 'unknown'])",
  'consent append-only admin update',
  'community moderation event client insert',
  'community question signed-anonymous insert',
  'photo quality metadata without provenance',
  'photo quality metadata with invalid provenance',
  'photo metadata cross-user storage path insert',
  'photo metadata local-only storage path insert',
  'photo metadata cross-user storage path update',
  'community reaction unpublished note insert',
  'community reaction null note insert',
  'photo trend revoked consent insert',
  'commerce click revoked consent insert',
  'community question revoked consent insert',
  'community reaction revoked consent insert',
  'Ask session revoked consent insert',
  'Ask safety revoked consent insert',
  'photo metadata revoked cloud consent insert',
  'photo metadata revoked cloud consent update',
  'photo metadata signed-anonymous cloud insert',
  'photo metadata signed-anonymous cloud update',
  'photo metadata signed-anonymous local-only insert',
  'signed-anonymous local-only photo update returned unexpected state',
  'consenting owner cloud photo metadata update returned unexpected state',
  'storage signed-anonymous cloud upload',
  'storage signed-anonymous cloud update',
  'storage consenting owner cloud update',
  'storage cross-user object update',
  'storage object update after photo_cloud_backup revocation',
  'storage upload after photo_cloud_backup revocation',
];

for (const check of requiredLiveHarnessChecks) {
  block(
    errors,
    liveHarness.includes(check),
    `Live Supabase adversarial harness is missing: ${check}.`,
  );
}

block(
  errors,
  /PRIVATE_PUBLIC_TABLES/.test(liveHarness) && /privateTableProbes/.test(liveHarness),
  'Live Supabase adversarial harness must compare its probe registry with the canonical private-table inventory.',
);
block(
  errors,
  /function expectPostgresCode/.test(liveHarness) &&
    /'23505'/.test(liveHarness) &&
    /'23514'/.test(liveHarness) &&
    /'42501'/.test(liveHarness),
  'Live Supabase adversarial harness must assert stable PostgreSQL codes for constraints and moderation denial.',
);
block(
  errors,
  /function resultError[\s\S]*return harnessErrorDetail\(error\)/.test(liveHarness) &&
    /deniedInsertResult/.test(liveHarness) &&
    /deniedReadOrMutationResult/.test(liveHarness) &&
    /exactPostgresErrorResult/.test(liveHarness) &&
    /storageDeniedResult/.test(liveHarness),
  'Live Supabase adversarial evidence must retain stable assertion/code details without raw provider or database messages.',
);
block(
  errors,
  /const unauthenticated = publicClient\(\)/.test(liveHarness) &&
    !/const anonymous = publicClient\(\)/.test(liveHarness),
  'Publishable-key client must be named unauthenticated, not confused with a signed anonymous Auth user.',
);
block(
  errors,
  /function createSignedAnonymousUser/.test(liveHarness) &&
    /signInAnonymously/.test(liveHarness) &&
    /is_anonymous === true/.test(liveHarness) &&
    /signed-anonymous cross-user read/.test(liveHarness),
  'Live RLS harness must distinguish and exhaustively test a signed anonymous Auth user.',
);
block(
  errors,
  liveHarness.indexOf('photo metadata signed-anonymous local-only insert') >= 0 &&
    liveHarness.indexOf('photo metadata signed-anonymous local-only insert') <
      liveHarness.indexOf(
        "grantConsent(signedAnonymous.client, signedAnonymous.id, 'photo_cloud_backup')",
      ) &&
    liveHarness.indexOf(
      "grantConsent(signedAnonymous.client, signedAnonymous.id, 'photo_cloud_backup')",
    ) < liveHarness.indexOf('photo metadata signed-anonymous cloud update'),
  'Signed-anonymous local photo positives must run without cloud consent before consent-backed cloud denials.',
);

warn(
  warnings,
  evidenceFlagEnabled(process.env.PHASE9_RLS_STAGING_PASS),
  'Missing live staging RLS adversarial evidence: PHASE9_RLS_STAGING_PASS=true.',
);
warn(
  warnings,
  evidenceFlagEnabled(process.env.PHASE9_RLS_PRODUCTION_PASS),
  'Missing live production RLS adversarial evidence: PHASE9_RLS_PRODUCTION_PASS=true.',
);

printResult('Phase 9 RLS adversarial', errors, warnings);
