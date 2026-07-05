#!/usr/bin/env node
import { block, listFiles, printResult, read } from './lib.mjs';

const errors = [];
const warnings = [];

const migrationFiles = listFiles('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

const combined = migrationFiles.map((file) => `\n-- FILE: ${file}\n${read(file)}\n`).join('\n');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSql = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
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
for (const match of combined.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)([\s\S]*?)\$\$;/gi)) {
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

const clientCallableDefiners = new Set([
  'has_current_consent(text)',
  'owns_ask_turn_audit(uuid)',
  'owns_consent(uuid)',
  'owns_cycle(uuid)',
  'owns_photo(uuid)',
  'owns_routine(uuid)',
  'owns_user_product(uuid)',
]);
const serviceCallableDefiners = new Set([
  'consume_edge_rate_limit(text, text, integer, integer)',
  'expire_app_granted_reverse_trials()',
]);

const revokePattern = (name) => new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${escapeRegExp(name)}\\s*\\(([^)]*)\\)\\s+from\\s+([^;]+);`, 'gi');
const grantPattern = (name) => new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${escapeRegExp(name)}\\s*\\(([^)]*)\\)\\s+to\\s+([^;]+);`, 'gi');

for (const fn of latestFunctions.values()) {
  if (!/security\s+definer/i.test(fn.definition)) continue;
  const key = functionKey(fn.name, fn.args);
  const afterDefinition = combined.slice(fn.index + fn.source.length);
  block(errors, /set\s+search_path\s*=\s*''/i.test(fn.definition), `${key} must pin SECURITY DEFINER search_path to ''.`);

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
    block(errors, !roles.includes('public') && !roles.includes('anon'), `${key} must not grant execute to public or anon.`);
    if (roles.includes('authenticated')) {
      block(errors, clientCallableDefiners.has(key), `${key} grants execute to authenticated but is not an approved RLS helper.`);
    }
    if (roles.includes('service_role')) {
      block(errors, serviceCallableDefiners.has(key), `${key} grants execute to service_role but is not an approved service RPC.`);
    }
  }

  if (clientCallableDefiners.has(key)) {
    block(errors, grantMatches.some((grant) => /\bauthenticated\b/i.test(grant[2])), `${key} RLS helper must grant execute to authenticated.`);
  }
  if (serviceCallableDefiners.has(key)) {
    block(errors, grantMatches.some((grant) => /\bservice_role\b/i.test(grant[2])), `${key} service RPC must grant execute to service_role.`);
    block(errors, !grantMatches.some((grant) => /\bauthenticated\b/i.test(grant[2])), `${key} service RPC must not grant execute to authenticated.`);
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

for (const match of combined.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+(public|storage)\.([a-z0-9_]+)([\s\S]*?);/gi)) {
  const [, policyName, schema, table, body] = match;
  const allowsAllRead = /using\s*\(\s*true\s*\)/i.test(body);
  const allowsAllWrite = /with\s+check\s*\(\s*true\s*\)/i.test(body);
  if (!allowsAllRead && !allowsAllWrite) continue;

  block(errors, !allowsAllWrite, `${policyName} on ${schema}.${table} must not use with check (true).`);
  block(errors, schema === 'public' && publicCatalogTables.has(table), `${policyName} on ${schema}.${table} uses using (true) outside the public catalog allowlist.`);
  block(errors, /for\s+select\s+to\s+authenticated/i.test(body), `${policyName} using (true) must be select-only for authenticated users.`);
}

for (const view of combined.matchAll(/create\s+or\s+replace\s+view\s+public\.([a-z0-9_]+)([\s\S]*?);/gi)) {
  const [, viewName, body] = view;
  const grantSelect = new RegExp(`grant\\s+select\\s+on\\s+public\\.${escapeRegExp(viewName)}\\s+to\\s+authenticated`, 'i').test(combined);
  block(errors, /security_invoker\s*=\s*true/i.test(body), `public view ${viewName} must use security_invoker = true.`);
  if (grantSelect) {
    block(errors, /security_invoker\s*=\s*true/i.test(body), `authenticated public view ${viewName} must not bypass underlying RLS.`);
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
  /grant\s+execute\s+on\s+function\s+public\.expire_app_granted_reverse_trials\(\)\s+to\s+service_role/i.test(combined),
  'expire_app_granted_reverse_trials() must be executable only by service_role.',
);

printResult('Phase 9 Supabase policy lint', errors, warnings);
