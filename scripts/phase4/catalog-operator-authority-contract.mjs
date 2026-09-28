const SOURCE_KEYS = Object.freeze([
  'migration',
  'authorityRepair',
  'databaseTest',
  'raceRehearsal',
  'edge',
  'edgeTests',
  'console',
  'consoleTests',
  'runbook',
  'correctionPolicy',
  'packageJson',
]);

const RPC_SIGNATURES = Object.freeze({
  catalog_operator_session: 'uuid, text, text, text, bigint, text',
  catalog_operator_queue: 'uuid, text, text, text, bigint, text, timestamptz, uuid, integer',
  catalog_operator_detail: 'uuid, text, text, text, bigint, text, uuid, uuid, bigint',
  catalog_operator_claim: 'uuid, text, text, text, bigint, uuid, text, uuid, bigint',
  catalog_operator_transition:
    'uuid, text, text, text, bigint, uuid, text, uuid, uuid, bigint, text, text, text',
  catalog_operator_release_hold:
    'uuid, text, text, text, bigint, uuid, uuid, uuid, bigint, uuid, text',
});

const AUTHORITY_TABLES = Object.freeze([
  'catalog_operator_audit_events',
  'catalog_operator_capability_bindings',
  'catalog_operator_claims',
  'catalog_operator_grant_attestations',
  'catalog_operator_grant_revocations',
  'catalog_operator_grants',
  'catalog_operator_hold_events',
  'catalog_operator_operation_receipts',
  'catalog_operator_product_holds',
  'catalog_operator_rate_buckets',
  'catalog_operator_repair_authority_receipts',
  'catalog_operator_runtime_control',
  'catalog_operator_runtime_control_history',
  'catalog_operator_sessions',
  'catalog_operator_work_states',
]);

const CAPABILITIES = Object.freeze([
  'catalog_hold_release',
  'catalog_repair_attest',
  'catalog_hold_claim',
  'correction_claim',
  'correction_disposition',
  'correction_queue_read',
  'correction_triage',
  'source_claim',
  'source_queue_read',
  'source_review_record',
]);

function requireSources(sources) {
  if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) {
    throw new TypeError('CAT-08 sources must be an object.');
  }
  const actual = Object.keys(sources).sort();
  const expected = [...SOURCE_KEYS].sort();
  if (
    actual.length !== expected.length ||
    !actual.every((key, index) => key === expected[index]) ||
    SOURCE_KEYS.some((key) => typeof sources[key] !== 'string' || sources[key].length === 0)
  ) {
    throw new TypeError('CAT-08 sources must contain the exact nonempty source set.');
  }
}

// Remove comments while preserving quoted values. This keeps policy checks from
// being satisfied by explanatory comments and still lets the contract inspect
// allowlisted SQL/TypeScript string literals.
function withoutComments(input) {
  let output = '';
  let mode = 'code';
  let quote = '';
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (mode === 'line') {
      if (character === '\n') {
        output += '\n';
        mode = 'code';
      } else {
        output += ' ';
      }
      continue;
    }
    if (mode === 'block') {
      if (character === '*' && next === '/') {
        output += '  ';
        index += 1;
        mode = 'code';
      } else {
        output += character === '\n' ? '\n' : ' ';
      }
      continue;
    }
    if (mode === 'quote') {
      output += character;
      if (character === '\\') {
        if (next !== undefined) {
          output += next;
          index += 1;
        }
      } else if (character === quote) {
        if (quote === "'" && next === "'") {
          output += next;
          index += 1;
        } else {
          mode = 'code';
          quote = '';
        }
      }
      continue;
    }
    if (character === '/' && next === '/') {
      output += '  ';
      index += 1;
      mode = 'line';
      continue;
    }
    if (character === '-' && next === '-') {
      output += '  ';
      index += 1;
      mode = 'line';
      continue;
    }
    if (character === '/' && next === '*' && input.indexOf('*/', index + 2) >= 0) {
      output += '  ';
      index += 1;
      mode = 'block';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      mode = 'quote';
    }
    output += character;
  }
  return output;
}

function collapsed(value) {
  return value.replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();
}

function exactSet(actual, expected) {
  const left = [...new Set(actual)].sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function quotedValues(value) {
  return [...value.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function includesAll(value, needles) {
  return needles.every((needle) => value.includes(needle));
}

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`create or replace function ${name}`);
  if (start < 0) return '';
  const next = nextName ? source.indexOf(`create or replace function ${nextName}`, start + 1) : -1;
  return source.slice(start, next < 0 ? source.length : next);
}

function auditMigration(migration, errors) {
  const compact = collapsed(migration).replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  const rpcNames = [
    ...migration.matchAll(
      /create\s+or\s+replace\s+function\s+catalog_operator_gateway\.(catalog_operator_[a-z_]+)\s*\(/g,
    ),
  ].map((match) => match[1]);
  add(
    errors,
    exactSet(rpcNames, Object.keys(RPC_SIGNATURES)),
    'Migration must expose exactly the six reviewed catalog-operator gateway functions.',
  );

  for (const [name, signature] of Object.entries(RPC_SIGNATURES)) {
    const rendered = `catalog_operator_gateway.${name}(${signature})`;
    add(
      errors,
      compact.includes(
        `revoke all on function ${rendered} from public, anon, authenticated, service_role, catalog_operator_edge;`,
      ) && compact.includes(`grant execute on function ${rendered} to catalog_operator_edge;`),
      `Migration ACL is not dedicated-gateway-role-only for ${name}.`,
    );
  }
  const operatorGrants = [
    ...compact.matchAll(
      /grant execute on function catalog_operator_gateway\.(catalog_operator_[a-z_]+)\([^;]*?\) to ([^;]+);/g,
    ),
  ];
  add(
    errors,
    operatorGrants.length === 6 &&
      operatorGrants.every((match) => match[2] === 'catalog_operator_edge'),
    'Migration grants an operator RPC to an unreviewed role.',
  );

  const currentAuth = functionBlock(
    migration,
    'private.catalog_operator_current_auth',
    'private.assert_catalog_operator',
  );
  add(
    errors,
    includesAll(currentAuth, [
      'p_auth_session_id uuid',
      'select auth_session.user_id',
      "auth_session.aal::text = 'aal2'",
      'join auth.users as operator_user',
      'from auth.sessions as auth_session',
      'join auth.mfa_factors as factor',
      "factor.status::text = 'verified'",
      'auth_session.factor_id',
      "factor.factor_type::text = 'totp'",
      'where auth_session.id = p_auth_session_id',
      'operator_user.email_confirmed_at is not null',
      'public.account_write_allowed(v_actor)',
      'CATALOG_OPERATOR_ACCOUNT_ACCESS_DENIED',
      'pg_catalog.lower(pg_catalog.btrim(operator_user.email))',
      'CATALOG_OPERATOR_VERIFIED_TOTP_SESSION_REQUIRED',
    ]),
    'Migration does not bind authority to a nonanonymous live AAL2 session and verified MFA factor.',
  );
  add(
    errors,
    includesAll(compact, [
      'create role catalog_operator_edge',
      'login',
      'nosuperuser',
      'noinherit',
      'nobypassrls',
      'connection limit 8',
      'pg_catalog.pg_auth_members',
      'pg_catalog.pg_shdepend',
      "'CATALOG_OPERATOR_EDGE_ROLE_MEMBERSHIP_DRIFT'",
      "'CATALOG_OPERATOR_EDGE_ROLE_OWNERSHIP_DRIFT'",
      "'CATALOG_OPERATOR_EDGE_ROLE_SUPERUSER_DRIFT'",
      "'CATALOG_OPERATOR_EDGE_AUTH_SCHEMA_DRIFT'",
      "alter role catalog_operator_edge set search_path = '';",
      "alter role catalog_operator_edge set statement_timeout = '15s';",
      'create schema if not exists catalog_operator_gateway;',
      'grant usage on schema catalog_operator_gateway to catalog_operator_edge;',
      'create table private.catalog_operator_runtime_control (',
      "admission_state in ('frozen', 'open')",
      "edge_deployment_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$'",
      "'initial_fail_closed'",
      "'CATALOG_OPERATOR_RUNTIME_FROZEN_OR_MISMATCH'",
      'for share',
      'catalog_operator_runtime_control_history',
      'catalog_operator_runtime_history_immutable',
    ]),
    'Migration does not establish the constrained gateway login and frozen, receipt-bound runtime control.',
  );

  const capabilityBlock = migration.match(
    /create table private\.catalog_operator_capability_bindings[\s\S]*?capability\s+text\s+not null check \(capability in \(([\s\S]*?)\)\),/,
  )?.[1];
  add(
    errors,
    typeof capabilityBlock === 'string' && exactSet(quotedValues(capabilityBlock), CAPABILITIES),
    'Migration capability vocabulary is not the exact ten-capability separation contract.',
  );
  add(
    errors,
    includesAll(migration, [
      "check (expires_at > established_at and expires_at <= established_at + interval '10 minutes')",
      "check (expires_at > claimed_at and expires_at <= claimed_at + interval '5 minutes')",
      'catalog_operator_grant_revocations',
      'CATALOG_OPERATOR_CAPABILITY_DENIED',
      'operator_session.capability_set_sha256',
      'binding.binding_sha256',
      'create table private.catalog_operator_rate_buckets',
      "'all', 'session', 'queue', 'detail', 'claim', 'transition', 'release'",
      'private.consume_catalog_operator_rate_budget(',
      "'preflight'",
      "raise exception 'CATALOG_OPERATOR_RATE_LIMITED'",
      'create or replace function private.normalize_catalog_operator_revocation_time()',
      'new.revoked_at := pg_catalog.clock_timestamp()',
      'catalog_operator_revocations_immediate',
      'create or replace function private.serialize_catalog_operator_grant_insert()',
      "'catalog-operator-session:' || new.operator_user_id::text",
      'catalog_operator_grants_serialize_insert',
    ]),
    'Migration does not revalidate grants/capabilities or enforce bounded work-session, lease, and server rate budgets.',
  );
  const assertionBlock = functionBlock(
    migration,
    'private.assert_catalog_operator',
    'catalog_operator_gateway.catalog_operator_session',
  );
  const sessionBlock = functionBlock(
    migration,
    'catalog_operator_gateway.catalog_operator_session',
    'private.catalog_operator_item_snapshot',
  );
  add(
    errors,
    (migration.match(/perform private\.consume_catalog_operator_rate_budget\(/g) ?? []).length ===
      7 &&
      includesAll(sessionBlock, [
        "if p_budget_class = 'preflight' then",
        "'preflight'",
        'true',
        'return;',
        "'session'",
        'false',
        'for update',
        'v_authority_now := pg_catalog.clock_timestamp()',
      ]) &&
      includesAll(assertionBlock, [
        "'catalog-operator-session:'",
        'pg_catalog.pg_advisory_xact_lock(',
        'pg_catalog.unnest(',
        'for update',
        'v_authority_now := pg_catalog.clock_timestamp()',
      ]) &&
      !assertionBlock.includes('revocation.revoked_at <=') &&
      !sessionBlock.includes('revocation.revoked_at <='),
    'Migration does not apply a rate budget to every gateway action.',
  );

  const tables = [
    ...migration.matchAll(/create\s+table\s+private\.(catalog_operator_[a-z_]+)\s*\(/g),
  ].map((match) => match[1]);
  add(
    errors,
    exactSet(tables, AUTHORITY_TABLES),
    'Migration private authority relation inventory is not exact.',
  );
  add(
    errors,
    includesAll(compact, [
      "'alter table private.%I enable row level security'",
      "'alter table private.%I force row level security'",
      "'revoke all on table private.%I from public, anon, authenticated, service_role'",
      'revoke all on schema private from public, anon, authenticated, service_role;',
      'revoke all privileges on all tables in schema public from catalog_operator_edge;',
      'revoke all privileges on all sequences in schema private from catalog_operator_edge;',
      'revoke all privileges on all functions in schema public from catalog_operator_edge;',
      'revoke all privileges on all functions in schema private from catalog_operator_edge;',
      'revoke execute on all functions in schema public from public;',
      'alter default privileges in schema catalog_operator_gateway revoke execute on functions from public;',
      'revoke select on table public.catalog_corrections from service_role;',
      'revoke execute on function public.review_catalog_correction(',
      'alter table public.catalog_corrections force row level security;',
    ]),
    'Migration leaves a raw API-role or legacy shared correction-review lane.',
  );

  add(
    errors,
    includesAll(migration, [
      'create or replace function private.guard_catalog_operator_immutable()',
      'catalog_operator_operation_receipts_immutable',
      'catalog_operator_audit_events_immutable',
      'catalog_operator_hold_events_immutable',
      'catalog_operator_repair_receipts_immutable',
      'before update or delete',
      'previous_event_sha256',
      'event_sha256',
    ]),
    'Migration does not make receipts and audit/hold chains append-only and hash-linked.',
  );

  const holdStart = migration.indexOf('create table private.catalog_operator_product_holds');
  const holdEnd = migration.indexOf(
    'create unique index catalog_operator_product_holds_active_uidx',
  );
  const holdBlock =
    holdStart >= 0 && holdEnd > holdStart ? migration.slice(holdStart, holdEnd) : '';
  add(
    errors,
    holdBlock.length > 0 &&
      includesAll(holdBlock, [
        'product_id',
        "disposition in ('accepted', 'rejected')",
        'disposition_by_user_id <> triaged_by_user_id',
        "state = 'active'",
        "state = 'repair_attested'",
        "state = 'released'",
      ]) &&
      !/reporter|account_id|correction_id|report_id|barcode|description|free_text|event_payload/i.test(
        holdBlock,
      ),
    'Independent product holds are not reporter-free, disposition-separated serving authority.',
  );

  const transition = functionBlock(
    migration,
    'catalog_operator_gateway.catalog_operator_transition',
    'catalog_operator_gateway.catalog_operator_release_hold',
  );
  add(
    errors,
    includesAll(transition, [
      "p_decision = 'accept'",
      "p_decision = 'reject'",
      "set disposition = 'accepted'",
      "else 'rejected'",
      "'hold_accepted'",
      "'hold_rejected'",
      "p_decision = 'recommend_promotion'",
      "p_decision = 'recommend_rollback'",
      'if p_evidence_sha256 is not null then v_allowed := false; end if;',
      "p_decision = 'attest_repair'",
      "p_reason_code = 'cat02_cat03_repair_verified'",
      'private.catalog_operator_hold_lifecycle_actor_ids(v_hold.id)',
      'v_auth.actor_user_id = any(v_hold_lifecycle_actor_ids)',
    ]),
    'Transition RPC does not preserve distinct dispositions, recommendation-only source review, evidence scoping, and repair separation.',
  );

  const release = functionBlock(
    migration,
    'catalog_operator_gateway.catalog_operator_release_hold',
    null,
  );
  add(
    errors,
    includesAll(release, [
      "p_reason_code <> 'repair_verified_current'",
      'private.catalog_operator_hold_lifecycle_actor_ids(v_hold.id)',
      'v_auth.actor_user_id = any(v_hold_lifecycle_actor_ids)',
      'v_auth.actor_user_id = v_receipt.attested_by_user_id',
      'v_receipt.valid_until <= pg_catalog.now()',
      "product.import_projection_status = 'active'",
      "batch.status = 'promoted'",
      'batch.verification_evidence_sha256 =',
      'record.served_state_mutation_root_sha256 =',
      'private.catalog_launch_current_served_state_mutation_root_sha256(',
      'campaign.review_valid_until > pg_catalog.now()',
      'private.catalog_launch_curation_record_is_structurally_valid(record.id)',
      'CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED',
      "set state = 'released'",
    ]),
    'Release RPC does not require current CAT-02/staged-CAT-03 authority and a fourth distinct person.',
  );

  const cleanup = functionBlock(
    migration,
    'private.cleanup_catalog_operator_correction_work',
    null,
  );
  add(
    errors,
    includesAll(cleanup, [
      'delete from private.catalog_operator_claims',
      'delete from private.catalog_operator_work_states',
      'before delete on public.catalog_corrections',
    ]) &&
      !cleanup.includes('delete from private.catalog_operator_product_holds') &&
      !cleanup.includes('delete from private.catalog_operator_audit_events') &&
      !cleanup.includes('delete from private.catalog_operator_hold_events'),
    'Reporter erasure cleanup does not preserve independent holds and immutable audit evidence.',
  );

  const uuidV4Guards = migration.match(/\[0-9a-f\]\{4\}-4\[0-9a-f\]\{3\}/g) ?? [];
  add(
    errors,
    uuidV4Guards.length >= 3 &&
      includesAll(migration, [
        'pg_catalog.pg_advisory_xact_lock(',
        'private.catalog_operator_operation_receipts',
        'CATALOG_OPERATOR_OPERATION_CONFLICT',
        'CATALOG_OPERATOR_VERSION_CONFLICT',
        'CATALOG_OPERATOR_LEASE_INVALID',
        'where hold.id = p_hold_id and hold.version = p_expected_version',
      ]),
    'Mutation RPCs are not UUIDv4-idempotent, serialized, lease-bound, and version-CAS protected.',
  );

  add(
    errors,
    !/grant\s+execute\s+on\s+function\s+(?:private\.)?(?:complete_catalog|promote_catalog|rollback_catalog|activate_catalog|retire_catalog)/i.test(
      migration,
    ),
    'Migration delegates CAT-02/CAT-03 owner mutation authority to operators.',
  );
  add(errors, /commit;\s*$/.test(migration), 'Migration is not a complete committed transaction.');
}

function auditAuthorityRepair(authorityRepair, errors) {
  const compact = collapsed(authorityRepair);
  add(
    errors,
    includesAll(compact, [
      'begin;',
      "set local lock_timeout = '5s';",
      'revoke execute on all functions in schema public, private from public, catalog_operator_edge;',
      'alter default privileges for role postgres revoke execute on functions from public;',
      'alter default privileges for role postgres in schema public revoke execute on functions from public;',
      'alter default privileges for role postgres in schema private revoke execute on functions from public;',
      'commit;',
    ]),
    'CAT-08 forward repair does not close current and future PUBLIC function execution for the dedicated login.',
  );
}

function auditDatabaseTest(databaseTest, errors) {
  add(
    errors,
    includesAll(databaseTest, Object.keys(RPC_SIGNATURES)),
    'Database test does not exercise all six gateway functions.',
  );
  add(
    errors,
    includesAll(databaseTest, [
      'has_function_privilege',
      'is_empty',
      'pg_get_function_identity_arguments',
      'the dedicated login has no ambient public/private function lane',
      'the dedicated login has no ambient public/private/Auth relation lane',
      'the dedicated login has no ambient public/private/Auth sequence lane',
      'future migration-owner functions default closed to PUBLIC',
      'authenticated',
      'service_role',
      'catalog_operator_edge',
      'catalog_operator_gateway',
      'catalog_operator_product_holds',
      'catalog_operator_audit_events',
      'permission denied for schema catalog_operator_gateway',
      'CATALOG_OPERATOR_RUNTIME_FROZEN_OR_MISMATCH',
      "'frozen'",
      "'local_cat08_test'",
      "auth_session.aal::text = ''aal2''",
      'FROM auth.sessions',
      'auth[.]mfa_factors',
      'is_anonymous',
      'CATALOG_OPERATOR_AAL2_SESSION_REQUIRED',
    ]),
    'Database test does not prove RPC ACLs and fail-closed MFA/session/grant authority.',
  );
  add(
    errors,
    includesAll(databaseTest, [
      'CATALOG_OPERATOR_OPERATION_CONFLICT',
      'CATALOG_OPERATOR_VERSION_CONFLICT',
      'CATALOG_OPERATOR_LEASE_INVALID',
      'catalog_operator_rate_buckets',
      'CATALOG_OPERATOR_RATE_LIMITED',
      'catalog_operator_claims',
      'catalog_operator_operation_receipts',
    ]),
    'Database test does not prove lease, CAS, and idempotency conflict behavior.',
  );
  add(
    errors,
    includesAll(databaseTest, [
      "'accepted'",
      "'rejected'",
      "'hold_rejected'",
      'delete from public.catalog_corrections',
      'catalog_operator_product_holds',
      'CATALOG_OPERATOR_REPAIR_ATTESTATION_SEPARATION_REQUIRED',
      'CATALOG_OPERATOR_THIRD_PERSON_RELEASE_REQUIRED',
      'CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED',
    ]) &&
      (databaseTest.match(/CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED/g) ?? [])
        .length >= 2,
    'Database test does not prove disposition, erasure survival, separated repair/release, and stale-proof denial.',
  );
}

function auditRaceRehearsal(raceRehearsal, errors) {
  add(
    errors,
    includesAll(raceRehearsal, [
      'select plan(10)',
      'extensions.dblink_connect(',
      'catalog_operator_gateway.catalog_operator_session(',
      'catalog_operator_gateway.catalog_operator_queue(',
      'cat08_queue_then_latch',
      'cat08_session_then_latch',
      'cat08_revoke_then_latch',
      "'cat08_race_b',",
      "'Lock'",
      "'cat08_race_a',",
      'pg_catalog.pg_advisory_lock(820801)',
      'pg_catalog.pg_advisory_lock(820802)',
      "'advisory'",
      "'transactionid'",
      'pg_catalog.pg_blocking_pids(activity.pid)',
      'p_latch_key is not null',
      '42501:CATALOG_OPERATOR_CAPABILITY_DENIED',
      '42501:CATALOG_OPERATOR_GRANT_REQUIRED',
      "'the real session request waits behind the uncommitted revocation'",
      "extensions.dblink_disconnect('cat08_race_a')",
      "extensions.dblink_disconnect('cat08_race_b')",
    ]) &&
      !raceRehearsal.includes('p_sleep_seconds') &&
      !raceRehearsal.includes('hosted_verification_passed') &&
      (raceRehearsal.match(/'transactionid'/g) ?? []).length === 2 &&
      (raceRehearsal.match(/pg_catalog\.pg_advisory_xact_lock\(p_latch_key\)/g) ?? []).length ===
        3 &&
      (raceRehearsal.match(/extensions\.dblink_send_query\(/g) ?? []).length === 4 &&
      (raceRehearsal.match(/pg_temp\.cat08_wait_for_activity\(/g) ?? []).length === 5,
    'Two-connection rehearsal does not prove action-first and session-revocation-first commit order against the real gateway.',
  );
}

function auditEdge(edge, edgeTests, errors) {
  add(
    errors,
    includesAll(edge, Object.values(RPC_SIGNATURES).length ? Object.keys(RPC_SIGNATURES) : []),
    'Edge contract does not bind the exact six RPC names.',
  );
  add(
    errors,
    includesAll(edge, [
      'case "session"',
      'case "queue"',
      'case "detail"',
      'case "claim"',
      'case "transition"',
      'case "release_hold"',
      'hasExactKeys(',
      'RANDOM_UUID_PATTERN',
      'SHA256_PATTERN',
      'CATALOG_OPERATOR_MAX_QUEUE_LIMIT = 50',
      '(body.limit as number) < 1',
      'Object.hasOwn(body, "evidenceSha256")',
      'body.decision !== "attest_repair"',
      'body.reasonCode !== "cat02_cat03_repair_verified"',
      'body.reasonCode === "repair_verified_current"',
    ]) && (edge.match(/Object\.hasOwn\(body, "evidenceSha256"\)/g) ?? []).length === 2,
    'Edge request contract is not exact, bounded, UUIDv4-bound, or correctly evidence-scoped.',
  );
  add(
    errors,
    includesAll(edge, [
      'CATALOG_OPERATOR_ALLOWED_ORIGINS',
      'new Set(["local", "development", "test"])',
      'parsed.protocol !== "https:"',
      'request.method !== "POST"',
      'contentLengthTooLarge(',
      'readLimitedJson(',
      'bearerAuthorizationHeader(request)',
      'caller.auth.getUser(presentedToken)',
      'caller.auth.getClaims(presentedToken)',
      'verifiedCatalogOperatorAuth(',
      'claims.iss !== expectedIssuer',
      '`${supabaseUrl}/auth/v1`',
      'readSupabasePublishableKey()',
      'postgres(',
      'ssl: appEnvironment === "development" ? false : "verify-full"',
      'readCatalogOperatorDatabaseUrl(appEnvironment, supabaseUrl)',
      'createCatalogOperatorDatabaseGateway(',
      '"preflight"',
      'username === `catalog_operator_edge.${expectedProjectRef}`',
      'CATALOG_OPERATOR_DATABASE_URL',
      'catalog_operator_edge',
      'HOSTED_OPERATOR_USERNAME_PATTERN.test(username)',
      'HOSTED_POOLER_PATTERN.test(url.hostname)',
      'DENO_DEPLOYMENT_ID',
      'CATALOG_OPERATOR_SOURCE_REVISION',
      'CATALOG_OPERATOR_CONTROL_GENERATION',
      'databaseAuthority',
      'operatorGateway(',
      'p_auth_session_id',
      'p_edge_environment',
      'p_source_revision',
      'p_edge_deployment_id',
      'p_control_generation',
      'catalog_operator_gateway.catalog_operator_session(',
      'persistSession: false',
      'normalizeCatalogOperatorResponse(',
      '"Cache-Control": "no-store, max-age=0"',
    ]) &&
      (edge.match(/parsed\.protocol !== "https:"/g) ?? []).length === 3 &&
      !/Deno\.env\.get\(["']SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY["']\)/.test(edge) &&
      !/readSupabaseSecretKey/.test(edge) &&
      !/operatorBackend\.rpc/.test(edge) &&
      !/public\.catalog_operator_/.test(edge) &&
      !/\.from\s*\(/.test(edge) &&
      !/console\.(?:log|info|warn|error)\s*\(/.test(edge),
    'Edge boundary does not enforce allowlisted origin, signed-AAL2 publishable-key admission, frozen runtime binding, and the dedicated transaction-pooler gateway path.',
  );
  add(
    errors,
    includesAll(edge, [
      'CATALOG_OPERATOR_AAL2_SESSION_REQUIRED',
      'CATALOG_OPERATOR_NONANONYMOUS_REQUIRED',
      'CATALOG_OPERATOR_AUTH_SESSION_NOT_LIVE',
      'CATALOG_OPERATOR_ACCOUNT_ACCESS_DENIED',
      'CATALOG_OPERATOR_VERIFIED_TOTP_SESSION_REQUIRED',
      'CATALOG_OPERATOR_CAPABILITY_INVALID',
      'CATALOG_OPERATOR_CAPABILITY_DENIED',
      'CATALOG_OPERATOR_VERSION_CONFLICT',
      'CATALOG_OPERATOR_LEASE_INVALID',
      'CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED',
    ]),
    'Edge error projection is not aligned with the database authority failures.',
  );
  add(
    errors,
    (edgeTests.match(/Deno\.test\s*\(/g) ?? []).length >= 18 &&
      includesAll(edgeTests, [
        'evidenceSha256',
        'repair_verified_current',
        'CATALOG_OPERATOR_AAL2_SESSION_REQUIRED',
        'CATALOG_OPERATOR_CAPABILITY_INVALID',
        'CATALOG_OPERATOR_VERSION_CONFLICT',
        'raw database',
        'gateway-schema-qualified',
        'six preflight-and-action pairs dispatched',
        'CATALOG_OPERATOR_DATABASE_URL',
        'invalid runtime context rejected',
        'unconfigured origin',
        'unknown',
        'payload',
      ]),
    'Edge tests do not cover exact payloads, auth/error mapping, CORS, bounds, and raw-response rejection.',
  );
}

function auditConsole(consoleSource, consoleTests, rawConsoleSource, errors) {
  add(
    errors,
    includesAll(consoleSource, [
      'PUBLISHABLE_KEY_PATTERN',
      "payload.role !== 'anon'",
      "value.startsWith('sb_')",
      'persistSession: false',
      'detectSessionInUrl: false',
      'shouldCreateUser: false',
      "factor.status === 'verified'",
      "currentLevel: 'aal1' | 'aal2' | null",
      'this.#client.auth.mfa.challenge(',
      'this.#client.auth.mfa.verify(',
    ]),
    'Console auth does not enforce publishable/anon keys, no account creation, in-memory auth, and verified TOTP/AAL state.',
  );
  add(
    errors,
    includesAll(consoleSource, [
      "new URL('/functions/v1/catalog-operator', supabaseUrl)",
      "method: 'POST'",
      'Authorization: `Bearer ${accessToken}`',
      "cache: 'no-store'",
      "credentials: 'omit'",
      "redirect: 'error'",
      'SAFE_PROJECTION_KEYS',
      'OPERATOR_IDLE_TIMEOUT_MS = 15 * 60 * 1000',
      'OPERATOR_ABSOLUTE_SESSION_MS = 60 * 60 * 1000',
      'operatorSession.operatorEmail',
      'operatorSession.environment',
      'operatorSession.sourceRevision',
      'operatorSession.edgeDeploymentId',
      'operatorSession.controlGeneration',
      "operatorSession.capabilities.join(', ')",
      'SessionWorkEpoch',
      'sessionWorkEpoch.invalidate()',
      'sessionWorkIsCurrent(epoch)',
      'retiredClient.auth.stopAutoRefresh()',
      'this.#client = this.#clientFactory(this.#environment)',
      'sourcemap: false',
      "'invalid_request'",
    ]) &&
      includesAll(rawConsoleSource, [
        "Content-Security-Policy: default-src 'self'",
        'Strict-Transport-Security:',
        'X-Robots-Tag: noindex',
      ]) &&
      !/(?:client|caller|supabase)\.from\s*\(/i.test(consoleSource) &&
      !/\.rpc\s*\(/.test(consoleSource) &&
      !/\b(?:localStorage|sessionStorage|indexedDB)\b|document\.cookie/.test(consoleSource) &&
      !/console\.(?:log|info|warn|error)\s*\(/.test(consoleSource),
    'Console is not an Edge-only, no-persistence, no-store, timer-bounded, hardened internal surface.',
  );
  add(
    errors,
    (consoleTests.match(/\bit\s*\(/g) ?? []).length >= 12 &&
      includesAll(consoleTests, [
        "legacyKey('anon')",
        "legacyKey('service_role')",
        'bounded correction review projection without reporter identity',
        'allowlisted errors',
        'capability',
        'release',
        'idle',
        'absolute',
        'invalidates every captured operation',
        'still destroys the token-bearing client',
      ]),
    'Console tests do not cover key rejection, MFA/workflow capability gates, release, and local session expiry.',
  );
}

function auditDocsAndWiring(sources, errors) {
  const runbook = collapsed(sources.runbook);
  add(
    errors,
    includesAll(runbook, [
      'Status: `in_progress` source candidate',
      'not deployed or E2E-proven',
      'five-minute',
      'ten-minute database operator work session',
      '15 minutes of inactivity',
      'one hour absolute',
      '`accepted` nor `rejected`',
      'non-reporter-derived',
      '`CATALOG_OPERATOR_ALLOWED_ORIGINS`',
      '`cat02_cat03_repair_verified`',
      '`repair_verified_current`',
      'signed staged CAT-03 successor',
      'A fourth authorized person',
      'fresh post-release record/campaign',
      'human-simulated E2E',
      'privacy/security/legal review',
      'does not establish legal compliance',
      'App Store acceptance',
    ]),
    'Runbook is missing the honest authority, erasure, separation, hosted-E2E, or professional-review boundary.',
  );
  add(
    errors,
    includesAll(runbook, [
      '`evidenceSha256` is required as an exact lowercase SHA-256 only for a `product_hold`',
      'it is omitted and rejected for correction, source, and import transitions',
    ]),
    'Runbook does not document the exact transition evidence contract.',
  );
  add(
    errors,
    includesAll(sources.correctionPolicy, [
      'independent product hold',
      'Reporter withdrawal/erasure',
      '`accepted` and `rejected`',
      'third',
      'fourth',
      'CAT-02 projection',
      'CAT-03 successor',
      'post-release',
      'separately deployed internal',
      'human-simulated E2E',
    ]),
    'Correction hold policy is not aligned with independent holds and the staged-successor/four-person release contract.',
  );

  let packageRecord;
  try {
    packageRecord = JSON.parse(sources.packageJson);
  } catch {
    packageRecord = null;
  }
  const scripts = packageRecord?.scripts ?? {};
  add(
    errors,
    scripts['phase4:operator-authority-contract:test'] ===
      'node --test scripts/phase4/catalog-operator-authority-contract.test.mjs scripts/e2e/catalog-operator-console-fixture-server.test.mjs' &&
      typeof scripts['phase4:catalog-operator-edge:test'] === 'string' &&
      typeof scripts['phase4:catalog-operator-edge:format:check'] === 'string' &&
      typeof scripts['phase4:catalog-operator-console:verify'] === 'string' &&
      scripts['phase4:verify']?.includes('phase4:operator-authority-contract:test') &&
      scripts['phase4:verify']?.includes('phase4:catalog-operator-edge:test') &&
      scripts['phase4:verify']?.includes('phase4:catalog-operator-edge:format:check') &&
      scripts['phase4:verify']?.includes('phase4:catalog-operator-console:verify') &&
      scripts['launch:verify']?.includes('phase4:operator-authority-contract:test') &&
      scripts['launch:verify']?.includes('phase4:catalog-operator-edge:test') &&
      scripts['launch:verify']?.includes('phase4:catalog-operator-edge:format:check') &&
      scripts['launch:verify']?.includes('phase4:catalog-operator-console:verify'),
    'Package verification does not wire the CAT-08 source and adversarial fixture contracts, Edge tests/format, and console verification into Phase 4 and launch gates.',
  );
}

export function auditCatalogOperatorAuthorityContract(sources) {
  requireSources(sources);
  const active = Object.fromEntries(
    SOURCE_KEYS.map((key) => [key, withoutComments(sources[key]).replace(/\r\n?/g, '\n')]),
  );
  const errors = [];
  auditMigration(active.migration, errors);
  auditAuthorityRepair(active.authorityRepair, errors);
  auditDatabaseTest(active.databaseTest, errors);
  auditRaceRehearsal(active.raceRehearsal, errors);
  auditEdge(active.edge, active.edgeTests, errors);
  auditConsole(active.console, active.consoleTests, sources.console, errors);
  auditDocsAndWiring(sources, errors);
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}

export const CATALOG_OPERATOR_AUTHORITY_SOURCE_KEYS = SOURCE_KEYS;
