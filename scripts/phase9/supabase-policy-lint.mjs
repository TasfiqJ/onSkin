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
  'account_write_allowed()',
  'begin_health_data_consent_withdrawal(bigint, text, text, text)',
  'decline_initial_health_data_consent(bigint, text, text)',
  'export_catalog_corrections_for_subject(uuid, timestamptz, uuid, integer)',
  'get_health_data_consent_status()',
  'get_health_dependent_consent_status(text)',
  'get_account_access_state()',
  'grant_health_data_consent(bigint, text, text)',
  'has_current_consent(text)',
  'owns_ask_turn_audit(uuid)',
  'owns_consent(uuid)',
  'owns_cycle(uuid)',
  'owns_photo(uuid)',
  'owns_routine(uuid)',
  'owns_user_product(uuid)',
  'read_entitlement_projections()',
  'refresh_routine_adherence()',
  'record_health_dependent_consent(bigint, bigint, text, text, text, text)',
  'set_routine_adherence_timezone(text)',
  'begin_health_dependent_consent_withdrawal(bigint, bigint, text, text, text, text)',
]);
const serviceCallableDefiners = new Set([
  'account_write_allowed(uuid)',
  'activate_account_publication_lease(uuid, uuid, text)',
  'apply_apple_auth_server_event(text, text, text[], text[], text, text, text, timestamptz, text)',
  'begin_account_deletion(uuid, uuid, text, text, timestamptz, bytea, bytea, bytea)',
  'begin_apple_auth_capture(uuid, uuid, uuid, text, text[], text[], text, text)',
  'begin_catalog_import(text, text, text, date, text, text, text, text, jsonb, text, text, text, text, text, text, text, integer, integer, integer, text)',
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
  'search_catalog_products(text, integer)',
  'stage_catalog_import_chunk(uuid, text, integer, integer, jsonb)',
  'submit_catalog_correction(uuid, bigint, uuid, uuid, text, text, text, jsonb, jsonb)',
  'record_catalog_lookup_event(uuid, bigint, text, text, integer, integer)',
  'mark_apple_auth_capture_exchange_started(uuid, uuid, uuid)',
  'update_account_deletion_step_payload(uuid, text, text, bytea)',
  'verify_catalog_import(uuid, text, text, text)',
]);

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
    block(
      errors,
      !grant.roles.includes('public') && !grant.roles.includes('anon'),
      `${key} must not grant execute to public or anon.`,
    );
  }

  const { effectiveGrantRoles } = fn;

  if (effectiveGrantRoles.has('authenticated')) {
    block(
      errors,
      clientCallableDefiners.has(key),
      `${key} grants execute to authenticated but is not an approved client RPC/helper.`,
    );
  }
  if (effectiveGrantRoles.has('service_role')) {
    block(
      errors,
      serviceCallableDefiners.has(key),
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

for (const match of combined.matchAll(
  /create\s+policy\s+"([^"]+)"\s+on\s+(public|storage)\.([a-z0-9_]+)([\s\S]*?);/gi,
)) {
  const [, policyName, schema, table, body] = match;
  const allowsAllRead = /using\s*\(\s*true\s*\)/i.test(body);
  const allowsAllWrite = /with\s+check\s*\(\s*true\s*\)/i.test(body);
  if (!allowsAllRead && !allowsAllWrite) continue;

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
