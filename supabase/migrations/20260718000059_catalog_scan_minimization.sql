begin;

-- CAT-04 privacy minimization: the historical shelf_scans table was described
-- as both analytics and a lookup/contribution queue, but no runtime consumer
-- reconciled it. Retaining an authenticated user's raw barcode history for
-- generic funnel measurement is unnecessary. Purge existing rows and seal the
-- legacy relation; result-only funnel analytics remain content-free, while any
-- reconnect lookup must use the encrypted, consent-bound local recovery queue.
lock table public.shelf_scans in access exclusive mode;
delete from public.shelf_scans;

drop policy if exists "shelf_scans_select_own" on public.shelf_scans;
drop policy if exists "shelf_scans_insert_own" on public.shelf_scans;
drop policy if exists "shelf_scans_update_own" on public.shelf_scans;
drop policy if exists "health_processing_read_fence" on public.shelf_scans;

alter table public.shelf_scans enable row level security;
alter table public.shelf_scans force row level security;
revoke all on table public.shelf_scans from public, anon, authenticated, service_role;

comment on table public.shelf_scans is
  'Deprecated and sealed by CAT-04. Raw account-linked barcode history is neither analytics nor a reconnect queue.';
comment on column public.shelf_scans.contributed_back is
  'Legacy field retained only for migration compatibility; no API role can read or mutate this sealed table.';

-- External contribution is outside the launch recipient graph. The legacy
-- queue and its service-role definer RPC otherwise remain a dormant write
-- authority even though the Edge handler no longer calls them. Purge and seal
-- the table under one exclusive lock, retain it only so existing account
-- erasure/cascade code stays compatible, and replace the enqueue body with an
-- owner-only inert result before revoking every runtime role.
lock table public.obf_contribution_queue in access exclusive mode;
delete from public.obf_contribution_queue;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policy.policyname
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'obf_contribution_queue'
  loop
    execute pg_catalog.format(
      'drop policy %I on public.obf_contribution_queue',
      v_policy.policyname
    );
  end loop;
end;
$$;

alter table public.obf_contribution_queue enable row level security;
alter table public.obf_contribution_queue force row level security;
revoke all on table public.obf_contribution_queue
  from public, anon, authenticated, service_role;

create or replace function public.enqueue_obf_contribution_for_correction(
  p_correction_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'outcome', 'contribution_lane_disabled',
    'enqueued', false
  )
$$;

revoke all on function public.enqueue_obf_contribution_for_correction(uuid)
  from public, anon, authenticated, service_role;

comment on table public.obf_contribution_queue is
  'Deprecated, empty, and sealed by CAT-04. Retained only for compatible account-erasure and Auth-cascade code; no runtime contribution recipient exists.';
comment on function public.enqueue_obf_contribution_for_correction(uuid) is
  'Inert compatibility stub. No runtime role can execute it and it never creates contribution work.';

-- Keep only the two bounded funnel dimensions used by the operational
-- dashboard. A barcode, search phrase, matched product, source, or quality
-- grade is not needed to calculate match/no-match rates and can reveal the
-- account holder's products or concerns.
--
-- The health-write trigger intentionally rejects maintenance UPDATEs that do
-- not carry a live request epoch. Take an exclusive lock and remove/recreate
-- that exact trigger transactionally so a deployment with legacy rows cannot
-- race an Edge write or fail halfway through the minimization pass.
lock table public.catalog_lookup_events in access exclusive mode;

drop trigger if exists trg_catalog_lookup_events_health_write
  on public.catalog_lookup_events;

-- Legacy API roles could write arbitrary timestamps. Drop invalid/future
-- telemetry rather than letting an infinity timestamp exhaust the bounded
-- outcome intake forever.
delete from public.catalog_lookup_events
where not pg_catalog.isfinite(created_at)
   or created_at > pg_catalog.now();

update public.catalog_lookup_events
set query = null,
    barcode = null,
    matched_product_id = null,
    source_key = null,
    quality_grade = null
where query is not null
   or barcode is not null
   or matched_product_id is not null
   or source_key is not null
   or quality_grade is not null;

create trigger trg_catalog_lookup_events_health_write
  before insert or update on public.catalog_lookup_events
  for each row execute function public._guard_direct_health_write('user_id');

alter table public.catalog_lookup_events
  drop constraint if exists catalog_lookup_events_minimized_identity,
  add constraint catalog_lookup_events_minimized_identity check (
    query is null
    and barcode is null
    and matched_product_id is null
    and source_key is null
    and quality_grade is null
  ),
  drop constraint if exists catalog_lookup_events_created_at_finite,
  add constraint catalog_lookup_events_created_at_finite check (
    pg_catalog.isfinite(created_at)
  );

comment on table public.catalog_lookup_events is
  'Owner-linked, health-fenced lookup funnel outcomes only. Raw search, barcode, product, source, and quality identity are prohibited.';

-- Outcome logging is an Edge responsibility, not a writable client table.
-- Seal direct mutations and expose only a narrow service-only RPC that fixes
-- the owner, validates the exact consent epoch, and applies a combined
-- per-account ceiling beneath the two Edge endpoint limits.
drop policy if exists "catalog_lookup_events_insert_own" on public.catalog_lookup_events;
drop policy if exists "catalog_lookup_events_update_own" on public.catalog_lookup_events;
drop policy if exists "catalog_lookup_events_delete_own" on public.catalog_lookup_events;
revoke all on table public.catalog_lookup_events
  from public, anon, authenticated, service_role;
grant select on table public.catalog_lookup_events to authenticated, service_role;

create or replace function public.record_catalog_lookup_event(
  p_user_id uuid,
  p_expected_health_epoch bigint,
  p_lookup_type text,
  p_result text,
  p_rate_limit integer,
  p_window_seconds integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_id uuid;
begin
  if p_user_id is null
     or p_expected_health_epoch is null
     or p_expected_health_epoch < 1
     or p_expected_health_epoch is distinct from public._request_health_processing_epoch()
     or not public.account_write_allowed(p_user_id)
     or p_lookup_type not in ('barcode', 'search')
     or p_result not in ('matched', 'no_match')
     or p_rate_limit is null
     or p_rate_limit not between 1 and 2000
     or p_window_seconds is null
     or p_window_seconds not between 60 and 86400 then
    raise exception 'CATALOG_LOOKUP_EVENT_AUTHORITY_INVALID' using errcode = '42501';
  end if;

  perform public._assert_health_processing_epoch_locked(
    p_user_id,
    p_expected_health_epoch
  );

  -- The health assertion holds the account advisory lock, so concurrent Edge
  -- calls cannot race this count. The service supplies twice the already
  -- bounded per-endpoint runtime limit and the same validated window.
  if (
    select count(*)
    from public.catalog_lookup_events as event
    where event.user_id = p_user_id
      and event.created_at >= v_now - pg_catalog.make_interval(secs => p_window_seconds)
      and event.created_at <= v_now
  ) >= p_rate_limit then
    raise exception 'CATALOG_LOOKUP_EVENT_RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.catalog_lookup_events (
    user_id,
    lookup_type,
    result,
    query,
    barcode,
    matched_product_id,
    source_key,
    quality_grade,
    created_at
  ) values (
    p_user_id,
    p_lookup_type,
    p_result,
    null,
    null,
    null,
    null,
    null,
    v_now
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_catalog_lookup_event(uuid, bigint, text, text, integer, integer) is
  'Service-only, exact-health-epoch-bound, identity-free catalog lookup outcome intake.';

revoke all on function public.record_catalog_lookup_event(uuid, bigint, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.record_catalog_lookup_event(uuid, bigint, text, text, integer, integer)
  to service_role;

-- A correction reporter must not read internal assignment, reviewer aliases,
-- or operator notes directly. Data portability remains available through the
-- service-filtered export allowlist, which exposes only reporter-facing fields.
create or replace function private.catalog_gtin_is_valid(p_value text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_length integer := pg_catalog.length(p_value);
  v_index integer;
  v_sum integer := 0;
begin
  if p_value !~ '^[0-9]+$' or v_length not in (8, 12, 13, 14) then
    return false;
  end if;
  for v_index in 1..v_length loop
    v_sum := v_sum
      + pg_catalog.substring(p_value, v_index, 1)::integer
        * case when (v_length - v_index) % 2 = 0 then 1 else 3 end;
  end loop;
  return v_sum % 10 = 0;
end;
$$;

revoke all on function private.catalog_gtin_is_valid(text)
  from public, anon, authenticated, service_role;

-- The catalog uses the shortest supported package symbol shape as its natural
-- key. A leading-zero GTIN-13 is the iOS EAN representation of a UPC-A, while
-- a leading-zero GTIN-14 is a padded GTIN-13/12/8 rather than a distinct
-- package identity. Keep checksum validity separate from this canonical-shape
-- rule so upgrade remediation can distinguish invalid identifiers from padded
-- equivalents.
create or replace function private.catalog_gtin_is_canonical(p_value text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select private.catalog_gtin_is_valid(p_value)
    and not (
      pg_catalog.length(p_value) in (13, 14)
      and p_value like '0%'
    )
$$;

revoke all on function private.catalog_gtin_is_canonical(text)
  from public, anon, authenticated, service_role;

-- Serving identity must use exactly one checksum-valid canonical GTIN shape.
-- Preserve historical/import rows for audit, but fail closed by blocking any
-- formerly reviewed row that cannot satisfy the new publication invariant.
-- These locks also block lookup/search reads until commit. Existing CAT-03
-- served-state mutation triggers remain enabled, so every remediation appends
-- the normal mutation evidence and invalidates any affected curation head.
lock table public.products in access exclusive mode;
lock table public.product_barcodes in access exclusive mode;

update public.product_barcodes
set review_status = 'blocked'
where review_status = 'reviewed'
  and not private.catalog_gtin_is_canonical(barcode);

update public.products
set status = 'blocked',
    review_status = 'blocked',
    quality_grade = 'blocked',
    recommendation_eligible = false
where status = 'active'
  and review_status = 'reviewed'
  and (
    barcode is null
    or not private.catalog_gtin_is_canonical(barcode)
  );

alter table public.product_barcodes
  drop constraint if exists product_barcodes_reviewed_barcode_gtin,
  add constraint product_barcodes_reviewed_barcode_gtin check (
    review_status <> 'reviewed'
    or private.catalog_gtin_is_canonical(barcode)
  );

alter table public.products
  drop constraint if exists products_reviewed_active_barcode_gtin,
  add constraint products_reviewed_active_barcode_gtin check (
    status <> 'active'
    or review_status <> 'reviewed'
    or (
      barcode is not null
      and private.catalog_gtin_is_canonical(barcode)
    )
  );

comment on constraint product_barcodes_reviewed_barcode_gtin on public.product_barcodes is
  'Only checksum-valid canonical GTIN-8/12/13/14 mappings can enter the reviewed serving lane.';
comment on constraint products_reviewed_active_barcode_gtin on public.products is
  'Every active reviewed product must expose one checksum-valid canonical GTIN-8/12/13/14 identity.';

-- Legacy table owners could persist arbitrary, deeply nested JSON before the
-- sealed intake existed. Do not recursively walk that untrusted history during
-- upgrade: PostgreSQL's server stack is finite, and a recursive PL/pgSQL call
-- per JSON level can abort the transaction. Instead, retain only top-level
-- allowlisted scalar fields. Nested values (including any case-folded barcode
-- key), arrays, unknown keys, oversized input, and unsafe text fail closed.
create or replace function private.catalog_report_safe_text(
  p_key text,
  p_value text
)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_value text;
  v_limit integer := case
    when p_key = 'description' then 500
    when p_key = 'ingredientsText' then 1500
    when p_key = 'sourceUrl' then 300
    else 200
  end;
begin
  -- Check bytes before whitespace normalization so an unbounded legacy text
  -- value cannot force a comparably large replacement allocation during the
  -- upgrade. Four bytes per retained character preserves valid UTF-8 text;
  -- whitespace-heavy legacy text beyond that conservative budget is dropped.
  if pg_catalog.octet_length(p_value) > v_limit * 4 then
    return null;
  end if;

  v_value := pg_catalog.regexp_replace(
    pg_catalog.btrim(p_value),
    '[[:space:]]+',
    ' ',
    'g'
  );

  if v_value = ''
     or pg_catalog.length(v_value) > v_limit
     or pg_catalog.strpos(v_value, pg_catalog.chr(92)) > 0 then
    return null;
  end if;

  if p_key = 'sourceUrl' then
    if v_value !~* '^https?://[^/@?#[:space:]]+(/[^@?#[:space:]]*)?$'
       or v_value ~* '(access[_ -]?token|refresh[_ -]?token|authorization|bearer|jwt|signed[_ -]?url|local[_ -]?uri|file:|/data/|/var/mobile/|[.](heic|jpe?g|png)([[:space:]]|$))' then
      return null;
    end if;
  elsif p_key in (
    'productName', 'brand', 'category', 'ingredientsText', 'sourceName'
  ) then
    if v_value ~* '(access[_ -]?token|refresh[_ -]?token|authorization|bearer|jwt|signed[_ -]?url|local[_ -]?uri|file:|/data/|/var/mobile/|[.](heic|jpe?g|png)([[:space:]]|$))'
       or pg_catalog.lower(v_value) ~ '^[a-z]:'
       or v_value ~* '[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}'
       or v_value ~ '(\+[0-9]{7,15}|\(?[0-9]{3}\)?[ .-][0-9]{3}[ .-][0-9]{4})' then
      return null;
    end if;
  elsif v_value ~* '(access[_ -]?token|refresh[_ -]?token|authorization|bearer|jwt|signed[_ -]?url|local[_ -]?uri|file:|/data/|/var/mobile/|photo|image|email|phone|address|user[_ -]?id|app[_ -]?user[_ -]?id|pregnan|diagnos|medical|medication|prescription|allerg|free[_ -]?text|message|ask prompt)'
     or pg_catalog.lower(v_value) ~ '^[a-z]:' then
    return null;
  end if;

  return v_value;
end;
$$;

revoke all on function private.catalog_report_safe_text(text, text)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_sanitize_report_object(
  p_value jsonb,
  p_kind text
)
returns jsonb
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_key text;
  v_child jsonb;
  v_type text;
  v_text text;
  v_result jsonb := '{}'::jsonb;
begin
  if p_kind not in ('proposed', 'context')
     or pg_catalog.jsonb_typeof(p_value) is distinct from 'object'
     or pg_catalog.pg_column_size(p_value) > 4096 then
    return '{}'::jsonb;
  end if;

  for v_key, v_child in
    select entry.key, entry.value
    from pg_catalog.jsonb_each(p_value) as entry(key, value)
  loop
    if (
      p_kind = 'proposed'
      and v_key not in (
        'productName', 'brand', 'category', 'ingredientsText', 'sourceUrl',
        'sourceName', 'defaultPaoMonths', 'qualityIssue',
        'suggestedCorrection'
      )
    ) or (
      p_kind = 'context'
      and v_key not in (
        'addedVia', 'quality', 'source', 'platform', 'appVersion',
        'buildNumber', 'route'
      )
    ) then
      continue;
    end if;

    v_type := pg_catalog.jsonb_typeof(v_child);
    if v_type = 'null' then
      v_result := v_result || pg_catalog.jsonb_build_object(v_key, v_child);
      continue;
    end if;

    if v_type in ('boolean', 'number')
       and v_key not in (
         'productName', 'brand', 'category', 'ingredientsText', 'sourceUrl',
         'sourceName'
       ) then
      v_result := v_result || pg_catalog.jsonb_build_object(v_key, v_child);
      continue;
    end if;

    if v_type = 'string' then
      v_text := private.catalog_report_safe_text(
        v_key,
        v_child #>> '{}'::text[]
      );
      if v_text is not null then
        v_result := v_result || pg_catalog.jsonb_build_object(v_key, v_text);
      end if;
    end if;
  end loop;

  if pg_catalog.length(v_result::text) > 3000
     or pg_catalog.pg_column_size(v_result) > 4096 then
    return '{}'::jsonb;
  end if;
  return v_result;
end;
$$;

revoke all on function private.catalog_sanitize_report_object(jsonb, text)
  from public, anon, authenticated, service_role;

lock table public.catalog_corrections in access exclusive mode;
drop trigger if exists trg_catalog_corrections_health_write
  on public.catalog_corrections;

-- Retain the audit row while repairing impossible timestamps, normalizing a
-- safe description, and reducing both legacy payloads to the reporter-facing
-- scalar allowlists used by the current intake.
update public.catalog_corrections
set created_at = case
      when not pg_catalog.isfinite(created_at) or created_at > pg_catalog.now()
        then pg_catalog.now()
      else created_at
    end,
    updated_at = case
      when not pg_catalog.isfinite(updated_at) or updated_at > pg_catalog.now()
        then pg_catalog.now()
      else updated_at
    end,
    description = private.catalog_report_safe_text('description', description),
    proposed_payload = private.catalog_sanitize_report_object(
      proposed_payload,
      'proposed'
    ),
    client_context = private.catalog_sanitize_report_object(
      client_context,
      'context'
    )
where not pg_catalog.isfinite(created_at)
   or created_at > pg_catalog.now()
   or not pg_catalog.isfinite(updated_at)
   or updated_at > pg_catalog.now()
   or description is distinct from private.catalog_report_safe_text(
        'description', description
      )
   or proposed_payload is distinct from private.catalog_sanitize_report_object(
        proposed_payload, 'proposed'
      )
   or client_context is distinct from private.catalog_sanitize_report_object(
        client_context, 'context'
      );

-- Pre-launch rows created under the former length-only rule may contain lot or
-- serial numbers. Remove only that invalid identifier; preserve the report and
-- its audit lifecycle for review/export/deletion duties.
update public.catalog_corrections
set barcode = null
where barcode is not null
  and not private.catalog_gtin_is_valid(barcode);

-- Collapse a fixed-width GTIN-14 alias to the supported package-symbol key:
-- six filler zeroes for GTIN-8, two for UPC-A/GTIN-12, or one for EAN-13.
-- Test the longest filler prefix first because the canonical GTIN itself may
-- legitimately begin with zero.
update public.catalog_corrections
set barcode = case
      when barcode like '000000%' then pg_catalog.substring(barcode, 7)
      when barcode like '00%' then pg_catalog.substring(barcode, 3)
      else pg_catalog.substring(barcode, 2)
    end
where pg_catalog.length(barcode) = 14
  and barcode like '0%'
  and private.catalog_gtin_is_valid(barcode);

update public.catalog_corrections
set barcode = pg_catalog.substring(barcode, 2)
where pg_catalog.length(barcode) = 13
  and barcode like '0%'
  and private.catalog_gtin_is_valid(barcode);

alter table public.catalog_corrections
  drop constraint if exists catalog_corrections_barcode_gtin,
  add constraint catalog_corrections_barcode_gtin check (
    barcode is null
    or private.catalog_gtin_is_canonical(barcode)
  ),
  drop constraint if exists catalog_corrections_proposed_payload_no_barcode,
  drop constraint if exists catalog_corrections_payloads_no_barcode,
  add constraint catalog_corrections_payloads_no_barcode check (
    proposed_payload = private.catalog_sanitize_report_object(
      proposed_payload, 'proposed'
    )
    and client_context = private.catalog_sanitize_report_object(
      client_context, 'context'
    )
  ),
  drop constraint if exists catalog_corrections_description_sanitized,
  add constraint catalog_corrections_description_sanitized check (
    description is null
    or description = private.catalog_report_safe_text(
      'description', description
    )
  ),
  drop constraint if exists catalog_corrections_created_at_finite,
  add constraint catalog_corrections_created_at_finite check (
    pg_catalog.isfinite(created_at)
  ),
  drop constraint if exists catalog_corrections_updated_at_finite,
  add constraint catalog_corrections_updated_at_finite check (
    pg_catalog.isfinite(updated_at)
  );

-- A response can be suppressed after the write commits when the account or
-- health authority changes while Edge is buffering the response. Bind one
-- random request ID to the exact owner, processing epoch, and sanitized body
-- so a user retry returns the committed receipt instead of creating a second
-- operator report. Legacy rows intentionally retain a null intake tuple.
alter table public.catalog_corrections
  add column if not exists intake_request_id uuid,
  add column if not exists intake_health_epoch bigint,
  add column if not exists intake_request_digest text,
  drop constraint if exists catalog_corrections_intake_idempotency,
  add constraint catalog_corrections_intake_idempotency check (
    pg_catalog.num_nonnulls(
      intake_request_id,
      intake_health_epoch,
      intake_request_digest
    ) in (0, 3)
    and (
      intake_request_id is null
      or intake_request_id::text ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    and (intake_health_epoch is null or intake_health_epoch > 0)
    and (
      intake_request_digest is null
      or intake_request_digest ~ '^[0-9a-f]{64}$'
    )
  );

-- Rebuild the named index while this migration already holds the table lock;
-- `if not exists` would silently preserve a drifted non-unique definition.
drop index if exists public.catalog_corrections_owner_request_uidx;
create unique index catalog_corrections_owner_request_uidx
  on public.catalog_corrections (user_id, intake_request_id)
  where intake_request_id is not null;

create or replace function private.catalog_report_request_digest(
  p_product_id uuid,
  p_barcode text,
  p_correction_type text,
  p_description text,
  p_proposed_payload jsonb,
  p_client_context jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        'layerwell-catalog-report-request:v1:' ||
        pg_catalog.jsonb_build_object(
          'productId', p_product_id,
          'barcode', p_barcode,
          'correctionType', p_correction_type,
          'description', p_description,
          'proposedPayload', p_proposed_payload,
          'clientContext', p_client_context
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

revoke all on function private.catalog_report_request_digest(
  uuid, text, text, text, jsonb, jsonb
) from public, anon, authenticated, service_role;

comment on column public.catalog_corrections.intake_request_id is
  'Internal content-free random retry identity. Excluded from reporter exports and deleted with the owner row.';
comment on column public.catalog_corrections.intake_health_epoch is
  'Internal health-processing epoch bound to the accepted report request. Excluded from reporter exports.';
comment on column public.catalog_corrections.intake_request_digest is
  'Internal SHA-256 binding of the sanitized intake body used only to reject conflicting request-ID reuse.';

-- Replace the service intake so the top-level canonical GTIN is the only
-- barcode lane, report identity is actionable, response-loss retries are
-- idempotent, and legacy/future timestamps cannot create an unbounded
-- rate-limit denial. Retire the old non-idempotent signature atomically; an
-- old Edge deployment fails closed until the compatible function is live.
drop function if exists public.submit_catalog_correction(
  uuid, bigint, uuid, text, text, text, jsonb, jsonb
);

create or replace function public.submit_catalog_correction(
  p_user_id uuid,
  p_expected_health_epoch bigint,
  p_report_request_id uuid,
  p_product_id uuid,
  p_barcode text,
  p_correction_type text,
  p_description text,
  p_proposed_payload jsonb,
  p_client_context jsonb
)
returns table (
  id uuid,
  status text,
  created_at timestamptz,
  created boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_id uuid;
  v_created_at timestamptz;
  v_request_digest text;
  v_existing public.catalog_corrections%rowtype;
  v_product_name text := nullif(
    pg_catalog.btrim(p_proposed_payload ->> 'productName'),
    ''
  );
begin
  if p_user_id is null
     or p_expected_health_epoch is null
     or p_expected_health_epoch < 1
     or p_expected_health_epoch is distinct from public._request_health_processing_epoch()
     or not public.account_write_allowed(p_user_id) then
    raise exception 'CATALOG_REPORT_AUTHORITY_INVALID' using errcode = '42501';
  end if;

  perform public._assert_health_processing_epoch_locked(
    p_user_id,
    p_expected_health_epoch
  );

  if (
       p_report_request_id is null
       or p_report_request_id::text !~
         '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (
       p_barcode is not null
       and not private.catalog_gtin_is_canonical(p_barcode)
     )
     or p_correction_type is null
     or p_correction_type not in (
       'wrong_match',
       'missing_product',
       'ingredient_issue',
       'duplicate',
       'source_issue',
       'expiry_issue',
       'category_issue'
     )
     or (
       p_description is not null
       and p_description is distinct from private.catalog_report_safe_text(
         'description', p_description
       )
     )
     or pg_catalog.jsonb_typeof(p_proposed_payload) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_client_context) is distinct from 'object'
     or pg_catalog.pg_column_size(p_proposed_payload) > 4096
     or pg_catalog.pg_column_size(p_client_context) > 4096
     or p_proposed_payload is distinct from
       private.catalog_sanitize_report_object(p_proposed_payload, 'proposed')
     or p_client_context is distinct from
       private.catalog_sanitize_report_object(p_client_context, 'context')
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_proposed_payload) as key(value)
       where key.value not in (
         'productName',
         'brand',
         'category',
         'ingredientsText',
         'sourceUrl',
         'sourceName',
         'defaultPaoMonths',
         'qualityIssue',
         'suggestedCorrection'
       )
     )
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_client_context) as key(value)
       where key.value not in (
         'addedVia',
         'quality',
         'source',
         'platform',
         'appVersion',
         'buildNumber',
         'route'
       )
     )
     or (
       p_proposed_payload ? 'productName'
       and (
         pg_catalog.jsonb_typeof(p_proposed_payload -> 'productName') is distinct from 'string'
         or v_product_name is null
         or pg_catalog.length(v_product_name) > 200
       )
     )
     or (
       p_correction_type = 'missing_product'
       and p_barcode is null
       and v_product_name is null
     )
     or (
       p_correction_type = 'wrong_match'
       and (
         p_product_id is null
         or (p_barcode is null and v_product_name is null)
       )
     )
     ) then
    raise exception 'CATALOG_REPORT_INPUT_INVALID' using errcode = '22023';
  end if;

  v_request_digest := private.catalog_report_request_digest(
    p_product_id,
    p_barcode,
    p_correction_type,
    p_description,
    p_proposed_payload,
    p_client_context
  );

  select correction.*
    into v_existing
  from public.catalog_corrections as correction
  where correction.user_id = p_user_id
    and correction.intake_request_id = p_report_request_id
  for update;

  if found then
    if v_existing.intake_health_epoch is distinct from p_expected_health_epoch
       or v_existing.intake_request_digest is distinct from v_request_digest then
      raise exception 'CATALOG_REPORT_IDEMPOTENCY_CONFLICT' using errcode = '55000';
    end if;

    return query
      select v_existing.id,
             v_existing.status,
             v_existing.created_at,
             false;
    return;
  end if;

  if p_product_id is not null
     and not exists (
       select 1 from public.products as product where product.id = p_product_id
     ) then
    raise exception 'CATALOG_REPORT_PRODUCT_INVALID' using errcode = '22023';
  end if;

  insert into public.catalog_corrections as correction (
    user_id,
    product_id,
    barcode,
    correction_type,
    status,
    description,
    proposed_payload,
    client_context,
    intake_request_id,
    intake_health_epoch,
    intake_request_digest,
    assigned_to,
    resolved_by,
    resolution_note,
    source_id,
    operator_reviewed_at,
    operator_reviewed_by,
    operator_review_note
  )
  select
    p_user_id,
    p_product_id,
    p_barcode,
    p_correction_type,
    'open',
    p_description,
    p_proposed_payload,
    p_client_context,
    p_report_request_id,
    p_expected_health_epoch,
    v_request_digest,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  where (
    select count(*)
    from public.catalog_corrections as recent
    where recent.user_id = p_user_id
      and recent.created_at >= v_now - interval '15 minutes'
      and recent.created_at <= v_now
  ) < 20
  on conflict (user_id, intake_request_id)
    where intake_request_id is not null
    do nothing
  returning correction.id, correction.created_at
    into v_id, v_created_at;

  if v_id is not null then
    return query select v_id, 'open'::text, v_created_at, true;
    return;
  end if;

  -- A competing first write may have committed after the optimistic lookup.
  -- The unique owner/request index makes ON CONFLICT wait for that decision;
  -- fetch and verify its immutable request binding before returning a receipt.
  select correction.*
    into v_existing
  from public.catalog_corrections as correction
  where correction.user_id = p_user_id
    and correction.intake_request_id = p_report_request_id
  for update;

  if found then
    if v_existing.intake_health_epoch is distinct from p_expected_health_epoch
       or v_existing.intake_request_digest is distinct from v_request_digest then
      raise exception 'CATALOG_REPORT_IDEMPOTENCY_CONFLICT' using errcode = '55000';
    end if;
    return query
      select v_existing.id,
             v_existing.status,
             v_existing.created_at,
             false;
    return;
  end if;

  raise exception 'CATALOG_REPORT_RATE_LIMITED' using errcode = 'P0001';
end;
$$;

comment on function public.submit_catalog_correction(
  uuid, bigint, uuid, uuid, text, text, text, jsonb, jsonb
) is
  'Service-only, exact-owner/health-epoch correction intake with canonical GTIN identity, bounded reporter payload, and response-loss-safe replay receipts.';

revoke all on function public.submit_catalog_correction(
  uuid, bigint, uuid, uuid, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.submit_catalog_correction(
  uuid, bigint, uuid, uuid, text, text, text, jsonb, jsonb
) to service_role;

create trigger trg_catalog_corrections_health_write
  before insert or update on public.catalog_corrections
  for each row execute function public._guard_direct_health_write('user_id');

drop policy if exists "catalog_corrections_select_own" on public.catalog_corrections;
drop policy if exists "health_processing_read_fence" on public.catalog_corrections;
alter table public.catalog_corrections force row level security;
revoke all on table public.catalog_corrections
  from public, anon, authenticated, service_role;
grant select on table public.catalog_corrections to service_role;

comment on table public.catalog_corrections is
  'Sealed catalog report intake and operator workflow. Reporter-facing fields are available only through the sanitized account export.';
comment on column public.catalog_corrections.barcode is
  'Optional checksum-valid canonical GTIN-8, UPC-A/GTIN-12, non-zero-padded EAN-13, or non-zero-padded GTIN-14 identity supplied through the sealed report RPC.';

commit;
