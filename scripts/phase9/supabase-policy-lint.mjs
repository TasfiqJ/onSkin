#!/usr/bin/env node
import {
  SEALED_CATALOG_AUTHORITY_TABLES,
  SEALED_GLOBAL_CONTENT_TABLES,
  block,
  listFiles,
  printResult,
  read,
} from './lib.mjs';
import { publicFunctionCatalog, publicFunctionKey } from './supabase-function-acl.mjs';

const errors = [];
const warnings = [];

const migrationFiles = listFiles('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

const combined = migrationFiles.map((file) => `\n-- FILE: ${file}\n${read(file)}\n`).join('\n');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const globalContentPolicyNames = new Map([
  ['conflict_rules', 'conflict_rules_read_active'],
  ['sequencing_rules', 'sequencing_rules_read_active'],
  ['creator_stacks', 'creator_stacks_select_active'],
  ['creator_stack_items', 'creator_stack_items_select_all'],
]);

const tablePrivileges = [
  'select',
  'insert',
  'update',
  'delete',
  'truncate',
  'references',
  'trigger',
];
const legacyClinicalContentTables = ['conflict_rules', 'sequencing_rules'];
const tablePrivilegeAclEvents = [
  ...combined.matchAll(
    /\b(grant|revoke)\s+(all(?:\s+privileges)?|(?:(?:select|insert|update|delete|truncate|references|trigger)(?:\s*,\s*)?)+)\s+on(?:\s+table)?\s+([\s\S]*?)\s+(?:to|from)\s+([^;]+);/gi,
  ),
]
  .map((event) => ({
    index: event.index,
    kind: event[1].toLowerCase(),
    privileges: /^all(?:\s+privileges)?$/i.test(event[2].trim())
      ? tablePrivileges
      : [...event[2].matchAll(/select|insert|update|delete|truncate|references|trigger/gi)].map(
          (match) => match[0].toLowerCase(),
        ),
    objects: event[3],
    roles: event[4].split(',').map((candidate) => candidate.trim().toLowerCase()),
  }))
  .sort((left, right) => left.index - right.index);

function statementListsTable(objects, table) {
  return new RegExp(`(?:^|[,\\s])public\\.${escapeRegExp(table)}(?:$|[,\\s])`, 'i').test(objects);
}

for (const table of SEALED_GLOBAL_CONTENT_TABLES) {
  const policyName = globalContentPolicyNames.get(table);
  const policyEvents = [
    ...combined.matchAll(
      new RegExp(
        `\\b(create|drop)\\s+policy(?:\\s+if\\s+exists)?\\s+"${escapeRegExp(policyName)}"\\s+on\\s+public\\.${escapeRegExp(table)}`,
        'gi',
      ),
    ),
  ];
  block(
    errors,
    policyEvents.at(-1)?.[1].toLowerCase() === 'drop',
    `${policyName} on public.${table} must remain effectively dropped.`,
  );
}

for (const table of [...SEALED_GLOBAL_CONTENT_TABLES, ...SEALED_CATALOG_AUTHORITY_TABLES]) {
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    const roleEvents = tablePrivilegeAclEvents.filter(
      (event) =>
        event.privileges.includes('select') &&
        statementListsTable(event.objects, table) &&
        event.roles.includes(role),
    );
    block(
      errors,
      roleEvents.at(-1)?.kind === 'revoke',
      `public.${table} SELECT must remain revoked from ${role}.`,
    );
  }
}

for (const table of legacyClinicalContentTables) {
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    for (const privilege of tablePrivileges) {
      const roleEvents = tablePrivilegeAclEvents.filter(
        (event) =>
          event.privileges.includes(privilege) &&
          statementListsTable(event.objects, table) &&
          event.roles.includes(role),
      );
      block(
        errors,
        roleEvents.at(-1)?.kind === 'revoke',
        `public.${table} ${privilege.toUpperCase()} must remain revoked from ${role}.`,
      );
    }
  }
}

const {
  functions: latestFunctions,
  unresolvedPrivilegeEvents,
  unresolvedRenameEvents,
} = publicFunctionCatalog(combined);
block(
  errors,
  unresolvedPrivilegeEvents.length === 0,
  `function ACL parser left ${unresolvedPrivilegeEvents.length} GRANT/REVOKE event(s) unresolved.`,
);
block(
  errors,
  unresolvedRenameEvents.length === 0,
  `function ACL parser left ${unresolvedRenameEvents.length} ALTER FUNCTION RENAME event(s) unresolved.`,
);

const clientCallableDefiners = new Set([
  'account_access_allowed()',
  'account_deletion_write_allowed()',
  'account_write_allowed()',
  'apply_conflict_choice_outbox_batch(jsonb)',
  'apply_notification_delivery_outbox_batch(jsonb)',
  'apply_notification_preferences_outbox_batch(jsonb)',
  'apply_photo_delete_outbox_batch(jsonb)',
  'apply_recommendation_preferences_outbox_batch(jsonb)',
  'apply_shelf_outbox_batch(jsonb)',
  'apply_shelf_scan_outbox_batch(jsonb)',
  'begin_health_data_consent_withdrawal(bigint, text, text, text)',
  'decline_initial_health_data_consent(bigint, text, text)',
  'export_catalog_corrections_for_subject(uuid, timestamptz, uuid, integer)',
  'export_routine_completion_sync_receipts_for_subject(timestamptz, uuid, integer)',
  'export_shelf_product_identities_for_subject(timestamptz, uuid, integer)',
  'export_shelf_sync_receipts_for_subject(timestamptz, uuid, integer)',
  'get_health_data_consent_status()',
  'get_health_dependent_consent_status(text)',
  'get_account_access_state()',
  'grant_health_data_consent(bigint, text, text)',
  'has_current_consent(text)',
  'has_current_exact_consent(text, text, text)',
  'owns_ask_turn_audit(uuid)',
  'owns_consent(uuid)',
  'owns_cycle(uuid)',
  'owns_photo(uuid)',
  'owns_routine(uuid)',
  'owns_user_product(uuid)',
  'photo_outbox_insert_allowed(uuid)',
  'read_entitlement_projections()',
  'record_routine_completion(text, text, text, text, text, integer, text, text, text)',
  'refresh_routine_adherence()',
  'record_health_dependent_consent(bigint, bigint, text, text, text, text)',
  'set_recommendation_preferences(text[], text, text[])',
  'set_routine_adherence_timezone(text)',
  'sync_shelf_product(text, text, text, text, jsonb)',
  'begin_health_dependent_consent_withdrawal(bigint, bigint, text, text, text, text)',
]);
const serviceCallableDefiners = new Set([
  'account_deletion_begin_apple_attempt(uuid, uuid, uuid)',
  'account_deletion_checkpoint(uuid, uuid, uuid, text, text)',
  'account_deletion_claim(uuid, text, boolean, uuid, uuid, text)',
  'account_deletion_preflight(uuid, text)',
  'account_deletion_record_failure(uuid, uuid, uuid, text, text)',
  'account_write_allowed(uuid)',
  'activate_account_publication_lease(uuid, uuid, text)',
  'apply_apple_auth_server_event(text, text, text[], text[], text, text, text, timestamptz, text)',
  'begin_account_deletion(uuid, uuid, text, text, timestamptz, bytea, bytea, bytea)',
  'begin_apple_auth_capture(uuid, uuid, uuid, text, text[], text[], text, text)',
  'begin_catalog_import(text, text, text, date, text, text, text, text, jsonb, text, text, text, text, text, text, text, integer, integer, integer, text)',
  'begin_catalog_import(text, text, text, text, text)',
  'claim_due_health_consent_withdrawals(text, integer)',
  'claim_due_health_dependent_consent_withdrawals(text, integer)',
  'claim_health_consent_withdrawal_for_owner(uuid, uuid, text)',
  'claim_account_deletion_step(uuid, text, integer)',
  'claim_next_account_deletion_step(text, integer)',
  'claim_due_apple_auth_validations(text, integer)',
  'count_account_photo_storage_objects(uuid)',
  'consume_edge_rate_limit(text, text, integer, integer)',
  'consume_edge_rate_limit(text, text, integer, integer, uuid)',
  'consume_edge_rate_limit(text, text, integer, integer, uuid, uuid)',
  'consume_revenuecat_account_deletion_budget(text, text)',
  'complete_health_data_consent_withdrawal(uuid, text)',
  'complete_health_dependent_consent_withdrawal(uuid)',
  'complete_apple_auth_capture(uuid, uuid, uuid, bytea, text)',
  'complete_apple_auth_validation(uuid, bigint, text, text, text, bytea, text)',
  'defer_health_consent_withdrawal(uuid, text, text, integer)',
  'defer_health_dependent_consent_withdrawal(uuid, text, text, integer)',
  'defer_apple_auth_validation(uuid, bigint, text, text, integer)',
  'defer_account_deletion_revenuecat_provider_capacity(uuid, text, text, timestamptz)',
  'erase_account_database_state(uuid, uuid, uuid)',
  'establish_revenuecat_deletion_identity_barrier(uuid, text, smallint, text[], text[], timestamptz)',
  'expire_app_granted_reverse_trials()',
  'finalize_account_deletion(uuid, text, smallint, timestamptz)',
  'finalize_catalog_import(uuid, text, integer)',
  'fail_apple_auth_capture(uuid, uuid, text)',
  'get_account_deletion_barrier_state(uuid, uuid)',
  'get_account_deletion_receipt(text, smallint)',
  'get_account_deletion_status(text)',
  'get_apple_auth_deletion_vault(uuid, uuid)',
  'grant_app_granted_reverse_trial(uuid, timestamptz, text)',
  'grant_app_granted_reverse_trial(uuid, timestamptz, text, text)',
  'list_account_deletions_ready_to_finalize(integer)',
  'list_account_photo_storage_objects(uuid, text, integer)',
  'list_health_consent_storage_work(uuid, integer, text)',
  'list_health_dependent_consent_storage_work(uuid, integer, text)',
  'lookup_catalog_product_by_barcode(text)',
  'invalidate_apple_auth_for_session(uuid, uuid, text, text)',
  'invalidate_apple_auth_lifecycle(uuid, bigint, text, text)',
  'mark_health_dependent_consent_withdrawal_action_required(uuid, text, text)',
  'mark_account_deletion_step_request_started(uuid, text, text)',
  'process_revenuecat_webhook_event_guarded(text, text, text[], text, text, text[], text[], text[], text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text, boolean, boolean, boolean, smallint, text, jsonb, boolean, boolean, smallint[], text[], text[])',
  'purge_expired_account_deletion_artifacts(integer)',
  'purge_expired_apple_auth_artifacts(integer)',
  'purge_expired_edge_rate_limits(integer)',
  'purge_expired_revenuecat_identity_tombstones(integer)',
  'prepare_health_data_consent_withdrawal(uuid, text)',
  'reconcile_revenuecat_entitlement_snapshot(uuid, timestamptz, text, boolean, text, timestamptz, text, text, boolean, timestamptz, text, text, text, text)',
  'reap_expired_account_publication_leases(integer)',
  'record_account_deletion_step(uuid, text, text, text, text, timestamptz)',
  'record_account_deletion_revenuecat_absence_observation(uuid, text, text)',
  'recover_account_deletion_step(uuid, text, text, text, text)',
  'release_account_publication_lease(text)',
  'renew_account_publication_lease(uuid, uuid, text)',
  'reserve_account_publication_lease(uuid, uuid, text)',
  'reset_account_deletion_revenuecat_absence_observations(uuid, text, text)',
  'scrub_account_service_rows(uuid)',
  'ready_catalog_import(uuid, text, bigint, bigint, bigint, jsonb)',
  'stage_catalog_import_batch(uuid, bigint, bigint, jsonb, int, text)',
  'stage_catalog_import_chunk(uuid, text, integer, integer, jsonb)',
  'submit_catalog_correction(uuid, bigint, uuid, uuid, text, text, text, jsonb, jsonb)',
  'record_catalog_lookup_event(uuid, bigint, text, text, integer, integer)',
  'search_catalog_products(text, integer)',
  'mark_apple_auth_capture_exchange_started(uuid, uuid, uuid)',
  'update_account_deletion_step_payload(uuid, text, text, bytea)',
  'verify_catalog_import(uuid, text, text, text)',
]);

const terminalCompletionCapability = 'account_deletion_completion_status(text)';

block(
  errors,
  !latestFunctions.has('promote_catalog_import(uuid)'),
  'the unreviewed one-argument catalog promotion RPC must remain retired.',
);
const finalSearch = latestFunctions.get('search_catalog_products(text, integer)');
if (finalSearch) {
  block(
    errors,
    /\bfrom\s+public\.catalog_servable_products\b/i.test(finalSearch.definition) &&
      !/\bfrom\s+public\.products\b/i.test(finalSearch.definition),
    'catalog search must read the exact current CAT-03 servable projection, not raw products.',
  );
}

for (const [allowlistName, allowlist] of [
  ['client SECURITY DEFINER', clientCallableDefiners],
  ['service SECURITY DEFINER', serviceCallableDefiners],
]) {
  for (const key of allowlist) {
    const fn = latestFunctions.get(key);
    block(errors, Boolean(fn), `${allowlistName} allowlist entry ${key} must exist.`);
    if (fn) {
      block(
        errors,
        /security\s+definer/i.test(fn.definition),
        `${allowlistName} allowlist entry ${key} must remain SECURITY DEFINER.`,
      );
    }
  }
}

const completionFunction = latestFunctions.get(terminalCompletionCapability);
block(
  errors,
  Boolean(completionFunction),
  `${terminalCompletionCapability} must remain installed as the reviewed terminal capability.`,
);
if (completionFunction) {
  block(
    errors,
    /security\s+definer/i.test(completionFunction.definition),
    `${terminalCompletionCapability} must remain SECURITY DEFINER.`,
  );
  block(
    errors,
    /p_completion_token_hash\s*!~\s*'\^t_\[0-9a-f\]\{64\}\$'/i.test(
      completionFunction.definition,
    ) &&
      /where\s+deletion\.completion_token_hash\s*=\s*p_completion_token_hash\s+and\s+deletion\.next_step\s*=\s*'complete'\s*;/i.test(
        completionFunction.definition,
      ),
    `${terminalCompletionCapability} must validate a high-entropy capability and reveal complete receipts only.`,
  );
  block(
    errors,
    ['anon', 'authenticated', 'service_role'].every((role) =>
      completionFunction.effectiveGrantRoles.has(role),
    ) && !completionFunction.effectiveGrantRoles.has('public'),
    `${terminalCompletionCapability} must grant execute exactly to anon, authenticated, and service_role.`,
  );
  block(
    errors,
    completionFunction.privilegeEventsAfterDefinition.some(
      (event) =>
        event.kind === 'revoke' &&
        ['public', 'anon', 'authenticated'].every((role) => event.roles.includes(role)),
    ),
    `${terminalCompletionCapability} must revoke execute from public, anon, and authenticated before its narrow grant.`,
  );
}

for (const fn of latestFunctions.values()) {
  if (!/security\s+definer/i.test(fn.definition)) continue;
  const key = publicFunctionKey(fn.name, fn.args);
  const revokeEvents = fn.privilegeEventsAfterDefinition.filter((event) => event.kind === 'revoke');
  const grantEvents = fn.privilegeEventsAfterDefinition.filter((event) => event.kind === 'grant');
  block(
    errors,
    /set\s+search_path\s*=\s*''/i.test(fn.definition),
    `${key} must pin SECURITY DEFINER search_path to ''.`,
  );

  block(
    errors,
    revokeEvents.some((event) => event.roles.includes('public')),
    `${key} must explicitly revoke default PUBLIC function execute privileges.`,
  );

  for (const grant of grantEvents) {
    block(errors, !grant.roles.includes('public'), `${key} must not grant execute to public.`);
    block(
      errors,
      !grant.roles.includes('anon') || key === terminalCompletionCapability,
      `${key} must not grant execute to anon unless it is an approved capability RPC.`,
    );
  }

  const { effectiveGrantRoles } = fn;

  if (effectiveGrantRoles.has('authenticated')) {
    block(
      errors,
      clientCallableDefiners.has(key) || key === terminalCompletionCapability,
      `${key} grants execute to authenticated but is not an approved client RPC/helper.`,
    );
  }
  if (effectiveGrantRoles.has('service_role')) {
    block(
      errors,
      serviceCallableDefiners.has(key) || key === terminalCompletionCapability,
      `${key} grants execute to service_role but is not an approved service RPC.`,
    );
  }

  if (clientCallableDefiners.has(key)) {
    block(
      errors,
      effectiveGrantRoles.has('authenticated'),
      `${key} client RPC/helper must grant execute to authenticated.`,
    );
  }
  if (serviceCallableDefiners.has(key)) {
    block(
      errors,
      effectiveGrantRoles.has('service_role'),
      `${key} service RPC must grant execute to service_role.`,
    );
    block(
      errors,
      !effectiveGrantRoles.has('authenticated'),
      `${key} service RPC must not grant execute to authenticated.`,
    );
  }
}

const disabledContributionEnqueue = latestFunctions.get(
  'enqueue_obf_contribution_for_correction(uuid)',
);
block(
  errors,
  Boolean(disabledContributionEnqueue),
  'the deprecated contribution enqueue compatibility stub must remain installed.',
);
if (disabledContributionEnqueue) {
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    block(
      errors,
      !disabledContributionEnqueue.effectiveGrantRoles.has(role),
      `deprecated contribution enqueue must remain revoked from ${role}.`,
    );
  }
  block(
    errors,
    /contribution_lane_disabled/.test(disabledContributionEnqueue.definition) &&
      !/insert\s+into\s+public\.obf_contribution_queue/i.test(
        disabledContributionEnqueue.definition,
      ),
    'deprecated contribution enqueue must remain an inert, non-writing compatibility stub.',
  );
}

const fencedEntitlementProjection = latestFunctions.get('read_entitlement_projections()');
const unfencedEntitlementProjection = latestFunctions.get(
  '_read_entitlement_projections_v0053_unfenced()',
);
block(
  errors,
  Boolean(fencedEntitlementProjection),
  'the plain-CREATE read_entitlement_projections() wrapper must remain installed.',
);
block(
  errors,
  fencedEntitlementProjection?.definition.includes('public.account_access_allowed()'),
  'read_entitlement_projections() must remain behind the account-access fence.',
);
block(
  errors,
  Boolean(unfencedEntitlementProjection),
  'the renamed entitlement implementation must remain visible to the ACL model.',
);
block(
  errors,
  unfencedEntitlementProjection !== undefined &&
    !['public', 'anon', 'authenticated', 'service_role'].some((role) =>
      unfencedEntitlementProjection.effectiveGrantRoles.has(role),
    ),
  'the renamed unfenced entitlement implementation must be executable by no API role.',
);

const publicCatalogTables = new Set([
  'affiliate_links',
  'brands',
  'catalog_sources',
  'ingredient_synonyms',
  'ingredient_tag_assignments',
  'ingredients',
  'product_active_bands',
  'product_barcodes',
  'product_ingredient_lists',
  'product_ingredient_tokens',
  'product_ingredients',
  'product_pao_expiry',
  'products',
]);

const photoOwnerUpdateEvents = [
  ...combined.matchAll(
    /(create|drop)\s+policy(?:\s+if\s+exists)?\s+"photos_update_own"\s+on\s+public\.photos([\s\S]*?);/gi,
  ),
];
const latestPhotoOwnerUpdate = photoOwnerUpdateEvents.at(-1);
const photoOwnerUpdateRemainsScoped =
  latestPhotoOwnerUpdate?.[1].toLowerCase() === 'create' &&
  /for\s+update\s+to\s+authenticated\s+using\s*\(\s*\(select\s+auth\.uid\(\)\)\s*=\s*user_id\s*\)\s+with\s+check\s*\(\s*\(select\s+auth\.uid\(\)\)\s*=\s*user_id\s*\)/i.test(
    latestPhotoOwnerUpdate[2] ?? '',
  );

for (const match of combined.matchAll(
  /create\s+policy\s+"([^"]+)"\s+on\s+(public|storage)\.([a-z0-9_]+)([\s\S]*?);/gi,
)) {
  const [, policyName, schema, table, body] = match;
  const allowsAllRead = /using\s*\(\s*true\s*\)/i.test(body);
  const allowsAllWrite = /with\s+check\s*\(\s*true\s*\)/i.test(body);
  if (!allowsAllRead && !allowsAllWrite) continue;

  const reviewedPhotoRewrite =
    policyName === 'photos_no_outbox_delete_rewrite' &&
    schema === 'public' &&
    table === 'photos' &&
    /^\s+as\s+restrictive\s+for\s+update\s+to\s+authenticated\s+using\s*\(\s*true\s*\)\s+with\s+check\s*\(\s*public\.photo_outbox_insert_allowed\(id\)\s*\)\s*$/i.test(
      body,
    );
  if (reviewedPhotoRewrite) {
    block(
      errors,
      photoOwnerUpdateRemainsScoped,
      'photos_no_outbox_delete_rewrite requires the owner-scoped photos_update_own policy.',
    );
    continue;
  }

  block(
    errors,
    !allowsAllWrite,
    `${policyName} on ${schema}.${table} must not use with check (true).`,
  );
  block(
    errors,
    schema === 'public' &&
      (publicCatalogTables.has(table) ||
        SEALED_GLOBAL_CONTENT_TABLES.includes(table) ||
        SEALED_CATALOG_AUTHORITY_TABLES.includes(table)),
    `${policyName} on ${schema}.${table} uses using (true) outside the catalog/history allowlist.`,
  );
  block(
    errors,
    /for\s+select\s+to\s+authenticated/i.test(body),
    `${policyName} using (true) must be select-only for authenticated users.`,
  );
}

for (const view of combined.matchAll(
  /create\s+or\s+replace\s+view\s+public\.([a-z0-9_]+)([\s\S]*?);/gi,
)) {
  const [, viewName, body] = view;
  const grantSelect = new RegExp(
    `grant\\s+select\\s+on\\s+public\\.${escapeRegExp(viewName)}\\s+to\\s+authenticated`,
    'i',
  ).test(combined);
  block(
    errors,
    /security_invoker\s*=\s*true/i.test(body),
    `public view ${viewName} must use security_invoker = true.`,
  );
  if (grantSelect) {
    block(
      errors,
      /security_invoker\s*=\s*true/i.test(body),
      `authenticated public view ${viewName} must not bypass underlying RLS.`,
    );
  }
}

block(
  errors,
  /revoke\s+all\s+on\s+function\s+public\.expire_app_granted_reverse_trials\(\)\s+from\s+public,\s*anon,\s*authenticated/i.test(
    combined,
  ),
  'expire_app_granted_reverse_trials() must be revoked from public, anon, and authenticated.',
);
block(
  errors,
  /grant\s+execute\s+on\s+function\s+public\.expire_app_granted_reverse_trials\(\)\s+to\s+service_role/i.test(
    combined,
  ),
  'expire_app_granted_reverse_trials() must be executable only by service_role.',
);

const revenueCatAtomicKey =
  'process_revenuecat_webhook_event(text, text, text[], text, text, text[], text[], text[], text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text, boolean, boolean, boolean, smallint, text, jsonb, boolean, boolean)';
const revenueCatAtomicFunction = latestFunctions.get(revenueCatAtomicKey);
block(
  errors,
  Boolean(revenueCatAtomicFunction),
  `${revenueCatAtomicKey} must exist with the reviewed signature.`,
);
if (revenueCatAtomicFunction) {
  const matchingRevokes = revenueCatAtomicFunction.privilegeEventsAfterDefinition.filter(
    (event) => event.kind === 'revoke',
  );
  block(
    errors,
    matchingRevokes.some(
      (event) =>
        event.roles.includes('public') &&
        event.roles.includes('anon') &&
        event.roles.includes('authenticated'),
    ),
    `${revenueCatAtomicKey} must revoke execute from public, anon, and authenticated.`,
  );

  const matchingGrants = revenueCatAtomicFunction.privilegeEventsAfterDefinition.filter(
    (event) => event.kind === 'grant',
  );
  block(
    errors,
    matchingGrants.length === 1 &&
      matchingGrants[0].roles.length === 1 &&
      matchingGrants[0].roles[0] === 'service_role',
    `${revenueCatAtomicKey} must grant execute to service_role only.`,
  );
}

printResult('Phase 9 Supabase policy lint', errors, warnings);
