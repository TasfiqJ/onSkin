#!/usr/bin/env node
import { block, listFiles, printResult, read } from './lib.mjs';

const errors = [];
const warnings = [];

const migrationFiles = listFiles('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

const combined = migrationFiles.map((file) => `\n-- FILE: ${file}\n${read(file)}\n`).join('\n');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSql = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const splitArgs = (args) =>
  String(args ?? '')
    .split(',')
    .map((arg) => arg.trim())
    .filter(Boolean);
const normalizeArg = (arg) => {
  const withoutDefault = arg.replace(/\s+default\s+[\s\S]+$/i, '').trim();
  if (!withoutDefault) return '';
  const tokens = withoutDefault.split(/\s+/).filter(Boolean);
  if (/^(in|out|inout|variadic)$/i.test(tokens[0] ?? '')) tokens.shift();
  if (tokens.length <= 1) return normalizeSql(tokens.join(' '));
  return normalizeSql(tokens.slice(1).join(' '));
};
const normalizeArgs = (args) => splitArgs(args).map(normalizeArg).join(', ');
const functionKey = (name, args) => `${name}(${normalizeArgs(args)})`;

const latestFunctions = new Map();
for (const match of combined.matchAll(
  /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)([\s\S]*?)\$\$;/gi,
)) {
  const [source, name, args, definition] = match;
  latestFunctions.set(functionKey(name, args), {
    name,
    args,
    normalizedArgs: normalizeArgs(args),
    source,
    definition,
    index: match.index ?? 0,
  });
}
for (const match of combined.matchAll(
  /drop\s+function\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)\s*\(([^)]*)\)\s*;/gi,
)) {
  const [, name, args] = match;
  const key = functionKey(name, args);
  const existing = latestFunctions.get(key);
  if (existing && (match.index ?? 0) > existing.index) latestFunctions.delete(key);
}

const clientCallableDefiners = new Set([
  'account_write_allowed()',
  'has_current_consent(text)',
  'owns_ask_turn_audit(uuid)',
  'owns_consent(uuid)',
  'owns_cycle(uuid)',
  'owns_photo(uuid)',
  'owns_routine(uuid)',
  'owns_user_product(uuid)',
]);
const serviceCallableDefiners = new Set([
  'account_write_allowed(uuid)',
  'begin_account_deletion(uuid, text, text, timestamptz, bytea, bytea, bytea)',
  'claim_account_deletion_step(uuid, text, integer)',
  'claim_next_account_deletion_step(text, integer)',
  'count_account_photo_storage_objects(uuid)',
  'consume_edge_rate_limit(text, text, integer, integer)',
  'consume_edge_rate_limit(text, text, integer, integer, uuid)',
  'enqueue_obf_contribution_for_correction(uuid)',
  'establish_revenuecat_deletion_identity_barrier(uuid, text, smallint, text[], text[], timestamptz)',
  'expire_app_granted_reverse_trials()',
  'finalize_account_deletion(uuid, text, smallint, timestamptz)',
  'get_account_deletion_barrier_state(uuid)',
  'get_account_deletion_receipt(text, smallint)',
  'get_account_deletion_status(text)',
  'grant_app_granted_reverse_trial(uuid, timestamptz, text)',
  'grant_app_granted_reverse_trial(uuid, timestamptz, text, text)',
  'list_account_deletions_ready_to_finalize(integer)',
  'list_account_photo_storage_objects(uuid, text, integer)',
  'mark_account_deletion_step_request_started(uuid, text, text)',
  'process_revenuecat_webhook_event_guarded(text, text, text[], text, text, text[], text[], text[], text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text, boolean, boolean, boolean, smallint, text, jsonb, boolean, boolean, smallint[], text[], text[])',
  'purge_expired_account_deletion_artifacts(integer)',
  'purge_expired_edge_rate_limits(integer)',
  'purge_expired_revenuecat_identity_tombstones(integer)',
  'record_account_deletion_step(uuid, text, text, text, text, timestamptz)',
  'recover_account_deletion_step(uuid, text, text, text, text)',
  'scrub_account_service_rows(uuid)',
  'update_account_deletion_step_payload(uuid, text, text, bytea)',
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

const revokePattern = (name) =>
  new RegExp(
    `revoke\\s+all\\s+on\\s+function\\s+public\\.${escapeRegExp(name)}\\s*\\(([^)]*)\\)\\s+from\\s+([^;]+);`,
    'gi',
  );
const grantPattern = (name) =>
  new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${escapeRegExp(name)}\\s*\\(([^)]*)\\)\\s+to\\s+([^;]+);`,
    'gi',
  );

for (const fn of latestFunctions.values()) {
  if (!/security\s+definer/i.test(fn.definition)) continue;
  const key = functionKey(fn.name, fn.args);
  const afterDefinition = combined.slice(fn.index + fn.source.length);
  block(
    errors,
    /set\s+search_path\s*=\s*''/i.test(fn.definition),
    `${key} must pin SECURITY DEFINER search_path to ''.`,
  );

  const revokeMatches = [...afterDefinition.matchAll(revokePattern(fn.name))].filter(
    (match) => normalizeArgs(match[1]) === fn.normalizedArgs,
  );
  block(
    errors,
    revokeMatches.some((match) => /\bpublic\b/i.test(match[2])),
    `${key} must explicitly revoke default PUBLIC function execute privileges.`,
  );

  const grantMatches = [...afterDefinition.matchAll(grantPattern(fn.name))].filter(
    (match) => normalizeArgs(match[1]) === fn.normalizedArgs,
  );
  for (const grant of grantMatches) {
    const roles = grant[2]
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
    block(
      errors,
      !roles.includes('public') && !roles.includes('anon'),
      `${key} must not grant execute to public or anon.`,
    );
  }

  // CREATE OR REPLACE preserves a function's ACL. Model every later explicit
  // GRANT/REVOKE in migration order so a retired RPC is not kept on the active
  // allowlist merely because an older migration once granted it execution.
  const effectiveGrantRoles = new Set();
  const privilegeEvents = [
    ...revokeMatches.map((match) => ({
      index: match.index ?? 0,
      kind: 'revoke',
      roles: match[2]
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean),
    })),
    ...grantMatches.map((match) => ({
      index: match.index ?? 0,
      kind: 'grant',
      roles: match[2]
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean),
    })),
  ].sort((a, b) => a.index - b.index);
  for (const event of privilegeEvents) {
    for (const role of event.roles) {
      if (event.kind === 'grant') effectiveGrantRoles.add(role);
      else effectiveGrantRoles.delete(role);
    }
  }

  if (effectiveGrantRoles.has('authenticated')) {
    block(
      errors,
      clientCallableDefiners.has(key),
      `${key} grants execute to authenticated but is not an approved RLS helper.`,
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
      `${key} RLS helper must grant execute to authenticated.`,
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

const publicCatalogTables = new Set([
  'affiliate_links',
  'brands',
  'catalog_sources',
  'conflict_rules',
  'creator_stack_items',
  'creator_stacks',
  'ingredient_pao_defaults',
  'ingredient_synonyms',
  'ingredient_tag_assignments',
  'ingredient_tag_definitions',
  'ingredient_tags',
  'ingredients',
  'product_active_bands',
  'product_barcodes',
  'product_categories',
  'product_ingredient_lists',
  'product_ingredient_tokens',
  'product_ingredients',
  'product_pao_expiry',
  'products',
  'sequencing_rules',
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
    schema === 'public' && publicCatalogTables.has(table),
    `${policyName} on ${schema}.${table} uses using (true) outside the public catalog allowlist.`,
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
  const afterDefinition = combined.slice(
    revenueCatAtomicFunction.index + revenueCatAtomicFunction.source.length,
  );
  const matchingRevokes = [
    ...afterDefinition.matchAll(revokePattern(revenueCatAtomicFunction.name)),
  ].filter((match) => normalizeArgs(match[1]) === revenueCatAtomicFunction.normalizedArgs);
  block(
    errors,
    matchingRevokes.some((match) => {
      const roles = new Set(
        match[2]
          .split(',')
          .map((role) => role.trim().toLowerCase())
          .filter(Boolean),
      );
      return roles.has('public') && roles.has('anon') && roles.has('authenticated');
    }),
    `${revenueCatAtomicKey} must revoke execute from public, anon, and authenticated.`,
  );

  const matchingGrants = [
    ...afterDefinition.matchAll(grantPattern(revenueCatAtomicFunction.name)),
  ].filter((match) => normalizeArgs(match[1]) === revenueCatAtomicFunction.normalizedArgs);
  block(
    errors,
    matchingGrants.length === 1 && matchingGrants[0][2].trim().toLowerCase() === 'service_role',
    `${revenueCatAtomicKey} must grant execute to service_role only.`,
  );
}

printResult('Phase 9 Supabase policy lint', errors, warnings);
