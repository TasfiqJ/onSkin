-- Durable owner-derived routine-conflict choice projection.
-- Local encrypted choices remain authoritative. This RPC accepts only the
-- bounded identifiers and reviewed choice metadata required by the server
-- cache; missing Shelf dependencies are explicitly retriable.

alter table public.mobile_outbox_receipts
  drop constraint if exists mobile_outbox_receipts_entity_type_check,
  add constraint mobile_outbox_receipts_entity_type_check
    check (entity_type in (
      'shelf_product',
      'shelf_scan',
      'conflict_choice',
      'notification_delivery',
      'notification_preferences',
      'recommendation_preferences'
    ));

create table if not exists public.conflict_choice_mirror_versions (
  user_id         uuid not null references auth.users (id) on delete cascade,
  entity_id       uuid not null,
  rule_id         uuid not null references public.conflict_rules (id),
  product_a_id    uuid not null,
  product_b_id    uuid not null,
  client_revision bigint not null check (client_revision > 0),
  operation_id    uuid not null,
  payload_hash    text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  updated_at      timestamptz not null default pg_catalog.now(),
  primary key (user_id, entity_id),
  unique (user_id, rule_id, product_a_id, product_b_id),
  check (product_a_id::text < product_b_id::text)
);

alter table public.conflict_choice_mirror_versions enable row level security;
revoke all on table public.conflict_choice_mirror_versions
  from public, anon, authenticated;

-- New binaries use only the owner-derived RPC. Old binaries still preserve
-- the local choice when their swallowed best-effort direct mirror is denied.
drop policy if exists "routine_conflicts_insert_own" on public.routine_conflicts;
drop policy if exists "routine_conflicts_update_own" on public.routine_conflicts;
drop policy if exists "routine_conflicts_delete_own" on public.routine_conflicts;
revoke insert, update, delete on table public.routine_conflicts
  from public, anon, authenticated;

create or replace function public.apply_conflict_choice_outbox_batch(
  p_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation jsonb;
  v_payload jsonb;
  v_results jsonb := '[]'::jsonb;
  v_operation_id uuid;
  v_entity_id uuid;
  v_rule_id uuid;
  v_product_a_id uuid;
  v_product_b_id uuid;
  v_computed_severity text;
  v_user_choice text;
  v_rule_version integer;
  v_client_revision bigint;
  v_idempotency_key text;
  v_identity_hash text;
  v_payload_hash text;
  v_expected_entity_id uuid;
  v_existing_idempotency_key text;
  v_existing_payload_hash text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
  v_existing_operation_kind text;
  v_existing_client_revision bigint;
  v_current_revision bigint;
  v_rule_interaction_type text;
  v_rule_current_version integer;
  v_product_count integer;
  v_status text;
  v_error_class text;
  v_constraint_name text;
  v_valid boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_operations is null
    or pg_catalog.jsonb_typeof(p_operations) <> 'array'
    or pg_catalog.jsonb_array_length(p_operations) > 25
    or pg_catalog.octet_length(p_operations::text) > 2097152
  then
    raise exception 'invalid_outbox_batch' using errcode = '22023';
  end if;

  for v_operation in
    select item.value
      from pg_catalog.jsonb_array_elements(p_operations) as item(value)
     order by coalesce(item.value ->> 'entity_id', ''),
              coalesce(item.value ->> 'operation_id', '')
  loop
    v_status := 'permanent';
    v_error_class := 'validation';
    v_valid := false;
    v_operation_id := null;
    v_entity_id := null;
    v_rule_id := null;
    v_product_a_id := null;
    v_product_b_id := null;
    v_client_revision := null;
    v_idempotency_key := null;
    v_payload := null;

    begin
      if pg_catalog.jsonb_typeof(v_operation) = 'object'
        and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_operation)) = 7
        and v_operation ?& array[
          'operation_id', 'entity_type', 'entity_id', 'operation_kind',
          'payload', 'client_revision', 'idempotency_key'
        ]
        and pg_catalog.jsonb_typeof(v_operation -> 'operation_id') = 'string'
        and (v_operation ->> 'operation_id') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and v_operation ->> 'entity_type' = 'conflict_choice'
        and pg_catalog.jsonb_typeof(v_operation -> 'entity_type') = 'string'
        and pg_catalog.jsonb_typeof(v_operation -> 'entity_id') = 'string'
        and (v_operation ->> 'entity_id') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and v_operation ->> 'operation_kind' = 'upsert'
        and pg_catalog.jsonb_typeof(v_operation -> 'operation_kind') = 'string'
        and pg_catalog.jsonb_typeof(v_operation -> 'client_revision') = 'number'
        and (v_operation ->> 'client_revision') ~ '^[1-9][0-9]{0,15}$'
        and (v_operation ->> 'client_revision')::numeric <= 9007199254740991
        and pg_catalog.jsonb_typeof(v_operation -> 'idempotency_key') = 'string'
        and pg_catalog.octet_length(v_operation ->> 'idempotency_key') between 1 and 256
      then
        v_operation_id := (v_operation ->> 'operation_id')::uuid;
        v_entity_id := (v_operation ->> 'entity_id')::uuid;
        v_client_revision := (v_operation ->> 'client_revision')::bigint;
        v_idempotency_key := pg_catalog.lower(v_operation ->> 'idempotency_key');
        v_payload := v_operation -> 'payload';
        v_valid := true;
      end if;

      if v_valid then
        v_valid := pg_catalog.jsonb_typeof(v_payload) = 'object'
          and pg_catalog.octet_length(v_payload::text) <= 2048
          and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 6
          and v_payload ?& array[
            'rule_id', 'product_a_id', 'product_b_id', 'computed_severity',
            'user_choice', 'rule_version'
          ]
          and pg_catalog.jsonb_typeof(v_payload -> 'rule_id') = 'string'
          and (v_payload ->> 'rule_id') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and pg_catalog.jsonb_typeof(v_payload -> 'product_a_id') = 'string'
          and (v_payload ->> 'product_a_id') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and pg_catalog.jsonb_typeof(v_payload -> 'product_b_id') = 'string'
          and (v_payload ->> 'product_b_id') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and pg_catalog.jsonb_typeof(v_payload -> 'computed_severity') = 'string'
          and v_payload ->> 'computed_severity' in ('none', 'mild', 'moderate', 'high')
          and pg_catalog.jsonb_typeof(v_payload -> 'user_choice') = 'string'
          and v_payload ->> 'user_choice' in ('accept_suggested_timing', 'use_together')
          and pg_catalog.jsonb_typeof(v_payload -> 'rule_version') = 'number'
          and (v_payload ->> 'rule_version') ~ '^[1-9][0-9]{0,9}$'
          and (v_payload ->> 'rule_version')::numeric <= 2147483647;
      end if;

      if v_valid then
        v_rule_id := (v_payload ->> 'rule_id')::uuid;
        v_product_a_id := (v_payload ->> 'product_a_id')::uuid;
        v_product_b_id := (v_payload ->> 'product_b_id')::uuid;
        v_computed_severity := v_payload ->> 'computed_severity';
        v_user_choice := v_payload ->> 'user_choice';
        v_rule_version := (v_payload ->> 'rule_version')::integer;
        v_valid := v_product_a_id::text < v_product_b_id::text;
      end if;

      if v_valid then
        v_identity_hash := pg_catalog.encode(
          extensions.digest(
            pg_catalog.convert_to(
              'onskin:conflict-choice-identity:v1' || E'\n' ||
              v_rule_id::text || E'\n' || v_product_a_id::text || E'\n' ||
              v_product_b_id::text,
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        );
        v_expected_entity_id := (
          pg_catalog.substr(v_identity_hash, 1, 8) || '-' ||
          pg_catalog.substr(v_identity_hash, 9, 4) || '-4' ||
          pg_catalog.substr(v_identity_hash, 14, 3) || '-8' ||
          pg_catalog.substr(v_identity_hash, 18, 3) || '-' ||
          pg_catalog.substr(v_identity_hash, 21, 12)
        )::uuid;
        v_payload_hash := pg_catalog.encode(
          extensions.digest(
            pg_catalog.convert_to(
              'onskin:conflict-choice-payload:v1' || E'\n' ||
              v_rule_id::text || E'\n' || v_product_a_id::text || E'\n' ||
              v_product_b_id::text || E'\n' || v_computed_severity || E'\n' ||
              v_user_choice || E'\n' || v_rule_version::text,
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        );
        v_valid := v_entity_id = v_expected_entity_id
          and v_idempotency_key =
            'conflict_choice:' || v_operation_id::text || ':' ||
            v_identity_hash || ':' || v_payload_hash;
      end if;

      if v_valid then
        select
          receipt.idempotency_key, receipt.payload_hash, receipt.entity_type,
          receipt.entity_id, receipt.operation_kind, receipt.client_revision
        into
          v_existing_idempotency_key, v_existing_payload_hash, v_existing_entity_type,
          v_existing_entity_id, v_existing_operation_kind, v_existing_client_revision
        from public.mobile_outbox_receipts as receipt
        where receipt.user_id = v_user_id
          and receipt.operation_id = v_operation_id;

        if found then
          if v_existing_idempotency_key = v_idempotency_key
            and v_existing_payload_hash = v_payload_hash
            and v_existing_entity_type = 'conflict_choice'
            and v_existing_entity_id = v_entity_id
            and v_existing_operation_kind = 'upsert'
            and v_existing_client_revision = v_client_revision
          then
            v_status := 'duplicate';
            v_error_class := null;
          end if;
        else
          select
            receipt.payload_hash, receipt.entity_type, receipt.entity_id,
            receipt.operation_kind, receipt.client_revision
          into
            v_existing_payload_hash, v_existing_entity_type, v_existing_entity_id,
            v_existing_operation_kind, v_existing_client_revision
          from public.mobile_outbox_receipts as receipt
          where receipt.user_id = v_user_id
            and receipt.idempotency_key = v_idempotency_key;

          if found then
            if v_existing_payload_hash = v_payload_hash
              and v_existing_entity_type = 'conflict_choice'
              and v_existing_entity_id = v_entity_id
              and v_existing_operation_kind = 'upsert'
              and v_existing_client_revision = v_client_revision
            then
              v_status := 'duplicate';
              v_error_class := null;
            end if;
          else
            -- The version row does not exist for a first projection, so a row
            -- lock alone cannot serialize two workers racing to create it.
            perform pg_catalog.pg_advisory_xact_lock(
              pg_catalog.hashtextextended(
                v_user_id::text || ':' || v_entity_id::text,
                0
              )
            );
            select version.client_revision
              into v_current_revision
              from public.conflict_choice_mirror_versions as version
             where version.user_id = v_user_id
               and version.entity_id = v_entity_id
             for update;

            if found and v_current_revision >= v_client_revision then
              insert into public.mobile_outbox_receipts (
                user_id, operation_id, idempotency_key, payload_hash, entity_type,
                entity_id, operation_kind, client_revision, result_status
              ) values (
                v_user_id, v_operation_id, v_idempotency_key, v_payload_hash,
                'conflict_choice', v_entity_id, 'upsert', v_client_revision, 'stale'
              );
              v_status := 'stale';
              v_error_class := null;
            else
              select rule.interaction_type, rule.rule_version
                into v_rule_interaction_type, v_rule_current_version
                from public.conflict_rules as rule
               where rule.id = v_rule_id
               for key share;

              if not found
                or v_rule_interaction_type in ('safety', 'myth', 'synergy')
                or v_rule_current_version <> v_rule_version
              then
                v_status := 'permanent';
                v_error_class := 'validation';
              else
                perform product.id
                  from public.user_products as product
                 where product.user_id = v_user_id
                   and product.id in (v_product_a_id, v_product_b_id)
                 order by product.id
                 for key share;
                get diagnostics v_product_count = row_count;

                if v_product_count <> 2 then
                  v_status := 'retry';
                  v_error_class := 'dependency';
                else
                  insert into public.routine_conflicts (
                    user_id, rule_id, product_a_id, product_b_id,
                    computed_severity, status, user_choice, rule_version
                  ) values (
                    v_user_id, v_rule_id, v_product_a_id, v_product_b_id,
                    v_computed_severity,
                    case when v_user_choice = 'use_together' then 'overridden' else 'accepted' end,
                    v_user_choice, v_rule_version
                  )
                  on conflict (user_id, rule_id, product_a_id, product_b_id)
                  do update set
                    computed_severity = excluded.computed_severity,
                    status = excluded.status,
                    user_choice = excluded.user_choice,
                    rule_version = excluded.rule_version;

                  insert into public.conflict_choice_mirror_versions (
                    user_id, entity_id, rule_id, product_a_id, product_b_id,
                    client_revision, operation_id, payload_hash, updated_at
                  ) values (
                    v_user_id, v_entity_id, v_rule_id, v_product_a_id, v_product_b_id,
                    v_client_revision, v_operation_id, v_payload_hash, pg_catalog.now()
                  )
                  on conflict (user_id, entity_id) do update set
                    rule_id = excluded.rule_id,
                    product_a_id = excluded.product_a_id,
                    product_b_id = excluded.product_b_id,
                    client_revision = excluded.client_revision,
                    operation_id = excluded.operation_id,
                    payload_hash = excluded.payload_hash,
                    updated_at = excluded.updated_at;

                  insert into public.mobile_outbox_receipts (
                    user_id, operation_id, idempotency_key, payload_hash, entity_type,
                    entity_id, operation_kind, client_revision, result_status
                  ) values (
                    v_user_id, v_operation_id, v_idempotency_key, v_payload_hash,
                    'conflict_choice', v_entity_id, 'upsert', v_client_revision, 'applied'
                  );
                  v_status := 'applied';
                  v_error_class := null;
                end if;
              end if;
            end if;
          end if;
        end if;
      end if;
    exception
      when invalid_text_representation
        or datetime_field_overflow
        or numeric_value_out_of_range
        or string_data_right_truncation
        or not_null_violation
        or check_violation
      then
        v_status := 'permanent';
        v_error_class := 'validation';
      when foreign_key_violation then
        v_status := 'retry';
        v_error_class := 'dependency';
      when unique_violation then
        get stacked diagnostics v_constraint_name = constraint_name;
        if v_constraint_name not in (
          'mobile_outbox_receipts_pkey',
          'mobile_outbox_receipts_owner_idempotency_key'
        ) then
          raise;
        else
          perform 1
            from public.mobile_outbox_receipts as receipt
           where receipt.user_id = v_user_id
             and (receipt.operation_id = v_operation_id
               or receipt.idempotency_key = v_idempotency_key)
             and receipt.idempotency_key = v_idempotency_key
             and receipt.payload_hash = v_payload_hash
             and receipt.entity_type = 'conflict_choice'
             and receipt.entity_id = v_entity_id
             and receipt.operation_kind = 'upsert'
             and receipt.client_revision = v_client_revision;
          if found then
            v_status := 'duplicate';
            v_error_class := null;
          else
            v_status := 'permanent';
            v_error_class := 'validation';
          end if;
        end if;
    end;

    v_results := v_results || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'operation_id', v_operation ->> 'operation_id',
        'status', v_status,
        'error_class', v_error_class
      )
    );
  end loop;

  return v_results;
end;
$$;

revoke all on function public.apply_conflict_choice_outbox_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_conflict_choice_outbox_batch(jsonb)
  to authenticated;

comment on function public.apply_conflict_choice_outbox_batch(jsonb) is
  'Applies at most 25 owner-derived conflict-choice state mirrors with retriable Shelf dependencies.';
