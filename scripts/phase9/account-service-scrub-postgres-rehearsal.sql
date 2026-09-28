\set ON_ERROR_STOP on

-- Disposable PostgreSQL rehearsal for migrations 0046 and 0047. Run only in an
-- empty throwaway database; this script creates the minimum pre-migration
-- schema, applies the real migrations, and exercises legacy/current A/B
-- fixtures through both the RPC and a direct Auth hard deletion.

create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit;

create schema auth;
create table auth.users (
  id uuid primary key
);

create table public.commerce_click_events (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  click_token text not null
);

create table public.order_attributions (
  id text primary key,
  click_token text
);

create table public.obf_contribution_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  barcode text not null,
  payload jsonb not null
);

create table public.subscriptions_events (
  id uuid primary key default gen_random_uuid(),
  fixture_label text not null unique,
  rc_event_id text unique,
  user_id uuid,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now(),
  app_user_id text,
  original_app_user_id text,
  aliases text[],
  resolved_user_id uuid,
  environment text,
  store text,
  product_id text,
  processed_at timestamptz,
  processing_status text,
  error text,
  signature_verified boolean,
  auth_verified boolean,
  provider_event_at timestamptz,
  original_transaction_id text,
  transaction_id text,
  transferred_from text[],
  transferred_to text[],
  projection_priority smallint,
  projection_applied boolean not null default false,
  processing_attempts integer not null default 0
);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4');

insert into public.commerce_click_events (id, user_id, click_token) values
  ('click-a', '00000000-0000-4000-8000-000000000001', 'token-a'),
  ('click-b', '00000000-0000-4000-8000-000000000002', 'token-b');

insert into public.order_attributions (id, click_token) values
  ('order-a', 'token-a'),
  ('order-b', 'token-b'),
  ('order-unknown', 'unknown-token');

insert into public.obf_contribution_queue (id, user_id, barcode, payload) values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'obf-a',
    '{"fixture":"delete-through-scrub","private_note":"account-a"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'obf-b',
    '{"fixture":"retain-byte-identical","private_note":"account-b"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    'obf-c',
    '{"fixture":"delete-through-auth-cascade","private_note":"account-c"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    null,
    'obf-legacy-orphan',
    '{"fixture":"legacy-null-owner","private_note":"orphaned"}'::jsonb
  );

insert into public.subscriptions_events (
  fixture_label,
  rc_event_id,
  user_id,
  event_type,
  payload,
  app_user_id,
  original_app_user_id,
  aliases,
  resolved_user_id,
  transferred_from,
  transferred_to
) values
  (
    'nested-shared',
    'nested-shared',
    '00000000-0000-4000-8000-000000000001',
    'TRANSFER',
    '{
      "event": {
        "id": "nested-shared",
        "type": "TRANSFER",
        "app_user_id": "00000000-0000-4000-8000-000000000001",
        "aliases": [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000002"
        ],
        "entitlement_ids": ["pro"],
        "subscriber_attributes": {
          "email": "private@example.invalid",
          "owner": "00000000-0000-4000-8000-000000000001"
        }
      }
    }'::jsonb,
    '00000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null,
    null
  ),
  (
    'root-shared',
    'root-shared',
    '00000000-0000-4000-8000-000000000001',
    'TRANSFER',
    '{
      "id": "root-shared",
      "type": "TRANSFER",
      "app_user_id": "00000000-0000-4000-8000-000000000001",
      "transferred_to": ["00000000-0000-4000-8000-000000000002"],
      "custom": {"owner": "00000000-0000-4000-8000-000000000001"}
    }'::jsonb,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'scalar-conflict-shared',
    'scalar-conflict-shared',
    null,
    'TRANSFER',
    '{
      "event": {
        "id": "scalar-conflict-shared",
        "type": "TRANSFER",
        "app_user_id": "00000000-0000-4000-8000-000000000002"
      }
    }'::jsonb,
    '00000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null,
    null
  ),
  (
    'legacy-a-only',
    'legacy-a-only',
    '00000000-0000-4000-8000-000000000001',
    'RENEWAL',
    '{
      "event": {
        "id": "legacy-a-only",
        "type": "RENEWAL",
        "app_user_id": "00000000-0000-4000-8000-000000000001"
      }
    }'::jsonb,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'repeated-shared',
    'repeated-shared',
    '00000000-0000-4000-8000-000000000001',
    'TRANSFER',
    '{"event":{"id":"repeated-shared","type":"TRANSFER"}}'::jsonb,
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    array[
      '00000000-0000-4000-8000-000000000001',
      'retained-alias',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002'
    ],
    '00000000-0000-4000-8000-000000000002',
    array[
      '00000000-0000-4000-8000-000000000001',
      'retained-from',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001'
    ],
    array[
      'retained-to',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002'
    ]
  ),
  (
    'malformed-shared',
    'malformed-shared',
    '00000000-0000-4000-8000-000000000001',
    'TRANSFER',
    '{
      "event": {
        "id": "malformed-shared",
        "type": "TRANSFER",
        "aliases": [
          "00000000-0000-4000-8000-000000000001",
          null,
          9,
          "00000000-0000-4000-8000-000000000002"
        ],
        "entitlement_ids": ["pro", null, 8, "pro_plus"]
      }
    }'::jsonb,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'b-only',
    'b-only',
    '00000000-0000-4000-8000-000000000002',
    'RENEWAL',
    '{
      "event": {
        "id": "b-only",
        "type": "RENEWAL",
        "product_id": "pro_annual",
        "entitlement_ids": ["pro"],
        "is_sandbox": true
      }
    }'::jsonb,
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    array[
      'b-before',
      '00000000-0000-4000-8000-000000000002',
      '  b-whitespace-significant  ',
      '00000000-0000-4000-8000-000000000002',
      'b-after'
    ],
    '00000000-0000-4000-8000-000000000002',
    array['00000000-0000-4000-8000-000000000002', 'b-from'],
    array['b-to', '00000000-0000-4000-8000-000000000002']
  ),
  (
    'deleted-payload-shared',
    'deleted-payload-shared',
    null,
    'TRANSFER',
    '{
      "event": {
        "id": "deleted-payload-shared",
        "type": "TRANSFER",
        "app_user_id": "00000000-0000-4000-8000-000000000003",
        "aliases": [
          "00000000-0000-4000-8000-000000000003",
          "00000000-0000-4000-8000-000000000002"
        ],
        "subscriber_attributes": {
          "owner": "00000000-0000-4000-8000-000000000003"
        }
      }
    }'::jsonb,
    null,
    null,
    null,
    null,
    '{}'::text[],
    '[3:4]={opaque-one,opaque-two}'::text[]
  ),
  (
    'deleted-transfer-only',
    'deleted-transfer-only',
    null,
    'TRANSFER',
    '{"event":{"id":"deleted-transfer-only","type":"TRANSFER"}}'::jsonb,
    null,
    null,
    null,
    null,
    array['00000000-0000-4000-8000-000000000003'],
    null
  ),
  (
    'deleted-c-hash-audit',
    'account_deletion_mTIktP6FmQ32TbkmylwD_1700000000000',
    null,
    'CUSTOMER_DELETION_REQUESTED',
    '{"provider":"revenuecat"}'::jsonb,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'active-a-hash-audit',
    'account_deletion_EeWU9IGVjBDjAV0L8ER6_1700000000001',
    null,
    'CUSTOMER_DELETION_REQUESTED',
    '{"provider":"revenuecat"}'::jsonb,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'legacy-null-event-id',
    null,
    '00000000-0000-4000-8000-000000000002',
    'RENEWAL',
    '{"event":{"id":"legacy-null-event-id","type":"RENEWAL"}}'::jsonb,
    '00000000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    null,
    null
  ),
  (
    'legacy-blank-event-id',
    '   ',
    '00000000-0000-4000-8000-000000000002',
    'RENEWAL',
    '{"event":{"id":"legacy-blank-event-id","type":"RENEWAL"}}'::jsonb,
    '00000000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    null,
    null
  ),
  (
    'uppercase-payload-shared',
    'uppercase-payload-shared',
    '00000000-0000-4000-8000-000000000001',
    'TRANSFER',
    '{
      "event": {
        "id": "uppercase-payload-shared",
        "type": "TRANSFER",
        "aliases": ["\tAAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA4\n"]
      }
    }'::jsonb,
    '00000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    null,
    null
  ),
  (
    'uppercase-structured-shared',
    'uppercase-structured-shared',
    '00000000-0000-4000-8000-000000000001',
    'TRANSFER',
    '{"event":{"id":"uppercase-structured-shared","type":"TRANSFER"}}'::jsonb,
    E'\t00000000-0000-4000-8000-000000000001\n',
    null,
    array[E'\tAAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA4\r'],
    null,
    '{}'::text[],
    array[E'\n00000000-0000-4000-8000-000000000001\t', 'opaque-unaffected']
  );

-- Migration 0041 installed this constraint as NOT VALID. Existing bad rows are
-- allowed to predate it, but any later update must satisfy it. These two rows
-- prove migration 0046 repairs both historical NULL and blank ids first.
alter table public.subscriptions_events
  add constraint subscriptions_events_rc_event_id_nonempty
  check (rc_event_id is not null and length(btrim(rc_event_id)) > 0) not valid;

create temporary table b_only_snapshot as
select pg_catalog.to_jsonb(events) as row_snapshot
  from public.subscriptions_events as events
 where fixture_label = 'b-only';

create temporary table b_obf_snapshot as
select pg_catalog.to_jsonb(contribution) as row_snapshot
  from public.obf_contribution_queue as contribution
 where barcode = 'obf-b';

create temporary table b_only_update_count (
  updates integer not null default 0
);
insert into b_only_update_count default values;

create function pg_temp.rehearsal_count_b_only_update()
returns trigger
language plpgsql
as $$
begin
  if old.fixture_label = 'b-only' then
    update b_only_update_count set updates = updates + 1;
  end if;
  return new;
end;
$$;

create trigger rehearsal_count_b_only_update
before update on public.subscriptions_events
for each row execute function pg_temp.rehearsal_count_b_only_update();

\ir ../../supabase/migrations/20260713000046_account_service_row_scrub.sql
\ir ../../supabase/migrations/20260713000047_account_obf_contribution_erasure.sql

do $$
begin
  if exists (
    select 1
      from public.obf_contribution_queue
     where barcode = 'obf-legacy-orphan'
  ) then
    raise exception 'REHEARSAL_LEGACY_OBF_ORPHAN_RETAINED';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_attribute
     where attrelid = 'public.obf_contribution_queue'::pg_catalog.regclass
       and attname = 'user_id'
       and not attnotnull
       and not attisdropped
  ) or not exists (
    select 1
      from pg_catalog.pg_attribute
     where attrelid = 'public.obf_contribution_queue'::pg_catalog.regclass
       and attname = 'user_id'
       and attnotnull
       and not attisdropped
  ) then
    raise exception 'REHEARSAL_OBF_OWNER_NOT_REQUIRED';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.obf_contribution_queue'::pg_catalog.regclass
       and conname = 'obf_contribution_queue_user_id_fkey'
       and contype = 'f'
       and confdeltype = 'c'
       and convalidated
  ) then
    raise exception 'REHEARSAL_OBF_AUTH_CASCADE_NOT_VALIDATED';
  end if;

  if pg_catalog.to_regclass('public.obf_contribution_queue_user_id_idx') is null then
    raise exception 'REHEARSAL_OBF_OWNER_INDEX_MISSING';
  end if;
end;
$$;

-- Exercise the trigger under the same non-owner role used by Edge Functions.
-- The canonical helper is intentionally not executable by service_role; the
-- fixed-search-path SECURITY DEFINER trigger must mediate both writes.
grant select, insert, update on public.subscriptions_events to service_role;
set role service_role;
insert into public.subscriptions_events (
  fixture_label,
  rc_event_id,
  event_type,
  app_user_id,
  aliases
) values (
  'service-role-trigger-write',
  'service-role-trigger-write',
  'RENEWAL',
  E'\t00000000-0000-4000-8000-000000000002\n',
  array[E' AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA4\r']::text[]
);
update public.subscriptions_events
   set original_app_user_id = E'\n00000000-0000-4000-8000-000000000002\t'
 where fixture_label = 'service-role-trigger-write';
reset role;

do $$
begin
  if (
    select rc_event_id
      from public.subscriptions_events
     where fixture_label = 'legacy-null-event-id'
  ) is distinct from (
    select 'legacy_missing_rc_event_id_' || id::text
      from public.subscriptions_events
     where fixture_label = 'legacy-null-event-id'
  ) then
    raise exception 'REHEARSAL_NULL_EVENT_ID_NOT_REPAIRED';
  end if;

  if (
    select rc_event_id
      from public.subscriptions_events
     where fixture_label = 'legacy-blank-event-id'
  ) is distinct from (
    select 'legacy_missing_rc_event_id_' || id::text
      from public.subscriptions_events
     where fixture_label = 'legacy-blank-event-id'
  ) then
    raise exception 'REHEARSAL_BLANK_EVENT_ID_NOT_REPAIRED';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.subscriptions_events'::regclass
       and conname = 'subscriptions_events_rc_event_id_nonempty'
       and convalidated
  ) then
    raise exception 'REHEARSAL_EVENT_ID_CONSTRAINT_NOT_VALIDATED';
  end if;

  if (select updates from b_only_update_count) <> 0 then
    raise exception 'REHEARSAL_UNRELATED_B_ROW_UPDATED';
  end if;

  if not exists (
    select 1
      from public.subscriptions_events
     where fixture_label = 'service-role-trigger-write'
       and app_user_id = '00000000-0000-4000-8000-000000000002'
       and original_app_user_id = '00000000-0000-4000-8000-000000000002'
       and aliases = array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::text[]
  ) then
    raise exception 'REHEARSAL_SERVICE_ROLE_TRIGGER_WRITE_FAILED';
  end if;

  if (
    select aliases
      from public.subscriptions_events
     where fixture_label = 'uppercase-payload-shared'
  ) is distinct from array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::text[] then
    raise exception 'REHEARSAL_UPPERCASE_PAYLOAD_OWNER_NOT_CANONICALIZED';
  end if;

  if not exists (
    select 1
      from public.subscriptions_events
     where fixture_label = 'uppercase-structured-shared'
       and app_user_id = '00000000-0000-4000-8000-000000000001'
       and aliases = array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::text[]
       and transferred_from = '{}'::text[]
       and transferred_to = array[
         '00000000-0000-4000-8000-000000000001',
         'opaque-unaffected'
       ]::text[]
  ) then
    raise exception 'REHEARSAL_STRUCTURED_OWNER_NOT_CANONICALIZED';
  end if;

  if exists (
    select 1
      from public.subscriptions_events
     where fixture_label in ('deleted-c-hash-audit', 'active-a-hash-audit')
  ) then
    raise exception 'REHEARSAL_LEGACY_HASH_NOT_PURGED';
  end if;

  if not exists (
    select 1 from public.subscriptions_events where fixture_label = 'legacy-a-only'
  ) then
    raise exception 'REHEARSAL_ACTIVE_MARKER_ERASED_LIVE_ACCOUNT';
  end if;

  if exists (
    select 1 from public.subscriptions_events where fixture_label = 'deleted-transfer-only'
  ) then
    raise exception 'REHEARSAL_LEGACY_DELETED_TRANSFER_ROW_RETAINED';
  end if;

  if (
    select aliases
      from public.subscriptions_events
     where fixture_label = 'deleted-payload-shared'
  ) is distinct from array['00000000-0000-4000-8000-000000000002']::text[] then
    raise exception 'REHEARSAL_LEGACY_DELETED_PAYLOAD_IDENTITY_RETAINED';
  end if;

  if not exists (
    select 1
      from public.subscriptions_events
     where fixture_label = 'deleted-payload-shared'
       and transferred_from = '{}'::text[]
       and transferred_from is not null
       and transferred_to = '[3:4]={opaque-one,opaque-two}'::text[]
       and pg_catalog.array_lower(transferred_to, 1) = 3
  ) then
    raise exception 'REHEARSAL_LEGACY_UNAFFECTED_ARRAY_CHANGED';
  end if;

  if (
    select payload
      from public.subscriptions_events
     where fixture_label = 'deleted-payload-shared'
  ) is distinct from '{
    "event": {
      "id": "deleted-payload-shared",
      "type": "TRANSFER"
    }
  }'::jsonb then
    raise exception 'REHEARSAL_LEGACY_DELETED_PAYLOAD_NOT_SANITIZED';
  end if;

  if (
    select aliases from public.subscriptions_events where fixture_label = 'nested-shared'
  ) is distinct from array[
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
  ]::text[] then
    raise exception 'REHEARSAL_NESTED_OWNER_BACKFILL_FAILED';
  end if;

  if (
    select payload from public.subscriptions_events where fixture_label = 'nested-shared'
  ) is distinct from '{
    "event": {
      "id": "nested-shared",
      "type": "TRANSFER",
      "entitlement_ids": ["pro"]
    }
  }'::jsonb then
    raise exception 'REHEARSAL_NESTED_PAYLOAD_SANITIZE_FAILED';
  end if;

  if (
    select aliases from public.subscriptions_events where fixture_label = 'root-shared'
  ) is distinct from array[
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
  ]::text[] then
    raise exception 'REHEARSAL_ROOT_OWNER_BACKFILL_FAILED';
  end if;

  if (
    select aliases
      from public.subscriptions_events
     where fixture_label = 'scalar-conflict-shared'
  ) is distinct from array['00000000-0000-4000-8000-000000000002']::text[] then
    raise exception 'REHEARSAL_CONFLICTING_SCALAR_BACKFILL_FAILED';
  end if;

  if (
    select payload from public.subscriptions_events where fixture_label = 'malformed-shared'
  ) is distinct from '{
    "event": {
      "id": "malformed-shared",
      "type": "TRANSFER",
      "entitlement_ids": ["pro", "pro_plus"]
    }
  }'::jsonb then
    raise exception 'REHEARSAL_MIXED_ARRAY_SANITIZE_FAILED';
  end if;

  if to_regprocedure('public._migration_0046_sanitized_payload(jsonb)') is not null then
    raise exception 'REHEARSAL_TEMPORARY_HELPER_RETAINED';
  end if;
end;
$$;

create temporary table account_scrub_results (
  attempt text primary key,
  result jsonb not null
);
grant insert on table account_scrub_results to service_role;

set role service_role;
insert into account_scrub_results (attempt, result)
values (
  'first',
  public.scrub_account_service_rows('00000000-0000-4000-8000-000000000001')
);
insert into account_scrub_results (attempt, result)
values (
  'idempotent-retry',
  public.scrub_account_service_rows('00000000-0000-4000-8000-000000000001')
);
reset role;

do $$
declare
  deleting_user constant text := '00000000-0000-4000-8000-000000000001';
  retained_user constant text := '00000000-0000-4000-8000-000000000002';
  retained record;
begin
  if exists (
    select 1 from public.commerce_click_events
     where user_id = deleting_user::uuid
  ) then
    raise exception 'REHEARSAL_A_CLICK_RETAINED';
  end if;
  if not exists (
    select 1 from public.commerce_click_events
     where user_id = retained_user::uuid and click_token = 'token-b'
  ) then
    raise exception 'REHEARSAL_B_CLICK_CHANGED';
  end if;
  if exists (
    select 1 from public.obf_contribution_queue
     where user_id = deleting_user::uuid
  ) then
    raise exception 'REHEARSAL_A_OBF_CONTRIBUTION_RETAINED';
  end if;
  if (
    select pg_catalog.to_jsonb(contribution)
      from public.obf_contribution_queue as contribution
     where barcode = 'obf-b'
  ) is distinct from (
    select row_snapshot from b_obf_snapshot
  ) then
    raise exception 'REHEARSAL_B_OBF_CONTRIBUTION_CHANGED';
  end if;
  if (
    select result
      from account_scrub_results
     where attempt = 'first'
  ) ->> 'obf_contribution_queue_deleted' is distinct from '1' then
    raise exception 'REHEARSAL_OBF_DELETE_COUNT_NOT_ATTESTED';
  end if;
  if (
    select result
      from account_scrub_results
     where attempt = 'first'
  ) ->> 'residual_obf_contributions' is distinct from '0' then
    raise exception 'REHEARSAL_OBF_ZERO_RESIDUE_NOT_ATTESTED';
  end if;
  if (
    select result
      from account_scrub_results
     where attempt = 'idempotent-retry'
  ) ->> 'obf_contribution_queue_deleted' is distinct from '0' then
    raise exception 'REHEARSAL_OBF_RETRY_NOT_IDEMPOTENT';
  end if;
  if (select click_token from public.order_attributions where id = 'order-a') is not null then
    raise exception 'REHEARSAL_A_ORDER_NOT_DETACHED';
  end if;
  if (select click_token from public.order_attributions where id = 'order-b') <> 'token-b' then
    raise exception 'REHEARSAL_B_ORDER_CHANGED';
  end if;
  if (select click_token from public.order_attributions where id = 'order-unknown') is not null then
    raise exception 'REHEARSAL_UNKNOWN_ORDER_NOT_DETACHED';
  end if;
  if exists (
    select 1 from public.subscriptions_events where fixture_label = 'legacy-a-only'
  ) then
    raise exception 'REHEARSAL_A_ONLY_EVENT_RETAINED';
  end if;

  if not exists (
    select 1
      from public.subscriptions_events
     where fixture_label = 'uppercase-payload-shared'
       and aliases = array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::text[]
       and user_id is null
       and app_user_id is null
  ) then
    raise exception 'REHEARSAL_UPPERCASE_PAYLOAD_SHARED_OWNER_LOST';
  end if;

  if not exists (
    select 1
      from public.subscriptions_events
     where fixture_label = 'uppercase-structured-shared'
       and aliases = array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4']::text[]
       and transferred_from = '{}'::text[]
       and transferred_from is not null
       and transferred_to = array['opaque-unaffected']::text[]
       and user_id is null
       and app_user_id is null
  ) then
    raise exception 'REHEARSAL_UPPERCASE_STRUCTURED_SHARED_OWNER_LOST';
  end if;

  if not exists (
    select 1
      from public.subscriptions_events
     where fixture_label = 'deleted-payload-shared'
       and transferred_from = '{}'::text[]
       and transferred_from is not null
       and transferred_to = '[3:4]={opaque-one,opaque-two}'::text[]
       and pg_catalog.array_lower(transferred_to, 1) = 3
  ) then
    raise exception 'REHEARSAL_RUNTIME_UNAFFECTED_ARRAY_CHANGED';
  end if;

  for retained in
    select *
      from public.subscriptions_events
     where fixture_label in (
       'nested-shared',
       'root-shared',
       'scalar-conflict-shared',
       'repeated-shared',
       'malformed-shared',
       'deleted-payload-shared'
     )
  loop
    if retained.user_id = deleting_user::uuid
       or retained.resolved_user_id = deleting_user::uuid
       or retained.app_user_id = deleting_user
       or retained.original_app_user_id = deleting_user
       or coalesce(retained.aliases @> array[deleting_user], false)
       or coalesce(retained.transferred_from @> array[deleting_user], false)
       or coalesce(retained.transferred_to @> array[deleting_user], false) then
      raise exception 'REHEARSAL_A_IDENTITY_RETAINED:%', retained.fixture_label;
    end if;
    if not (
      retained.user_id = retained_user::uuid
      or retained.resolved_user_id = retained_user::uuid
      or retained.app_user_id = retained_user
      or retained.original_app_user_id = retained_user
      or coalesce(retained.aliases @> array[retained_user], false)
      or coalesce(retained.transferred_from @> array[retained_user], false)
      or coalesce(retained.transferred_to @> array[retained_user], false)
    ) then
      raise exception 'REHEARSAL_B_OWNER_LOST:%', retained.fixture_label;
    end if;
  end loop;

  if (
    select aliases from public.subscriptions_events where fixture_label = 'repeated-shared'
  ) is distinct from array[
    'retained-alias',
    retained_user
  ]::text[] then
    raise exception 'REHEARSAL_REPEATED_ALIAS_ORDER_CHANGED';
  end if;
  if (
    select transferred_from
      from public.subscriptions_events
     where fixture_label = 'repeated-shared'
  ) is distinct from array[
    'retained-from',
    retained_user
  ]::text[] then
    raise exception 'REHEARSAL_REPEATED_FROM_ORDER_CHANGED';
  end if;
  if (
    select transferred_to
      from public.subscriptions_events
     where fixture_label = 'repeated-shared'
  ) is distinct from array[
    'retained-to',
    retained_user
  ]::text[] then
    raise exception 'REHEARSAL_REPEATED_TO_ORDER_CHANGED';
  end if;

  if (
    select pg_catalog.to_jsonb(events)
      from public.subscriptions_events as events
     where fixture_label = 'b-only'
  ) is distinct from (
    select row_snapshot from b_only_snapshot
  ) then
    raise exception 'REHEARSAL_B_ONLY_ROW_CHANGED';
  end if;
end;
$$;

delete from auth.users
 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';

do $$
begin
  if exists (
    select 1
      from public.obf_contribution_queue
     where barcode = 'obf-c'
  ) then
    raise exception 'REHEARSAL_DIRECT_AUTH_DELETE_LEFT_OBF_PAYLOAD';
  end if;
end;
$$;

select 'account-service-scrub-postgres-rehearsal: pass' as result;
