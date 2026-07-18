-- Transactional, owner-bound Shelf outbox application.
--
-- The client supplies opaque operation identity and Shelf state only. The
-- authenticated owner is always derived from auth.uid() inside this function.

create table public.shelf_mirror_versions (
  user_id           uuid not null references auth.users (id) on delete cascade,
  entity_id         uuid not null,
  client_revision   bigint not null default 0 check (client_revision >= 0),
  tombstone         boolean not null default true,
  last_operation_id uuid,
  updated_at        timestamptz not null default now(),
  primary key (user_id, entity_id)
);

create table public.mobile_outbox_receipts (
  user_id          uuid not null references auth.users (id) on delete cascade,
  operation_id     uuid not null,
  idempotency_key  text not null check (
    pg_catalog.octet_length(idempotency_key) between 1 and 256
  ),
  entity_type      text not null check (entity_type = 'shelf_product'),
  entity_id        uuid not null,
  operation_kind   text not null check (operation_kind in ('upsert', 'delete')),
  client_revision  bigint not null check (client_revision > 0),
  result_status    text not null check (result_status in ('applied', 'stale')),
  applied_at       timestamptz not null default now(),
  primary key (user_id, operation_id),
  constraint mobile_outbox_receipts_owner_idempotency_key
    unique (user_id, idempotency_key)
);

create index mobile_outbox_receipts_owner_applied_idx
  on public.mobile_outbox_receipts (user_id, applied_at desc);

alter table public.shelf_mirror_versions enable row level security;
alter table public.mobile_outbox_receipts enable row level security;

-- These internal coordination tables are reachable only through the RPC. No
-- direct authenticated policies are intentionally created.
revoke all on table public.shelf_mirror_versions
  from public, anon, authenticated, service_role;
revoke all on table public.mobile_outbox_receipts
  from public, anon, authenticated, service_role;

create or replace function public.apply_shelf_outbox_batch(p_operations jsonb)
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
  v_operation_kind text;
  v_idempotency_key text;
  v_client_revision bigint;
  v_current_revision bigint;
  v_existing_idempotency_key text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
  v_existing_operation_kind text;
  v_existing_client_revision bigint;
  v_applied_id uuid;
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
  loop
    v_status := 'permanent';
    v_error_class := 'validation';
    v_valid := false;
    v_operation_id := null;
    v_entity_id := null;
    v_operation_kind := null;
    v_idempotency_key := null;
    v_client_revision := null;
    v_payload := null;

    begin
      -- The seven-field wire object is intentionally exact. Unknown fields are
      -- rejected instead of silently accepting future/raw identity material.
      if pg_catalog.jsonb_typeof(v_operation) = 'object'
        and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_operation)) = 7
        and v_operation ?& array[
          'operation_id',
          'entity_type',
          'entity_id',
          'operation_kind',
          'payload',
          'client_revision',
          'idempotency_key'
        ]
        and pg_catalog.jsonb_typeof(v_operation -> 'operation_id') = 'string'
        and (v_operation ->> 'operation_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and v_operation ->> 'entity_type' = 'shelf_product'
        and pg_catalog.jsonb_typeof(v_operation -> 'entity_type') = 'string'
        and pg_catalog.jsonb_typeof(v_operation -> 'entity_id') = 'string'
        and (v_operation ->> 'entity_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and pg_catalog.jsonb_typeof(v_operation -> 'operation_kind') = 'string'
        and v_operation ->> 'operation_kind' in ('upsert', 'delete')
        and pg_catalog.jsonb_typeof(v_operation -> 'client_revision') = 'number'
        and (v_operation ->> 'client_revision') ~ '^[1-9][0-9]{0,15}$'
        and (v_operation ->> 'client_revision')::numeric <= 9007199254740991
        and pg_catalog.jsonb_typeof(v_operation -> 'idempotency_key') = 'string'
        and pg_catalog.octet_length(v_operation ->> 'idempotency_key') between 1 and 256
      then
        v_operation_id := (v_operation ->> 'operation_id')::uuid;
        v_entity_id := (v_operation ->> 'entity_id')::uuid;
        v_operation_kind := v_operation ->> 'operation_kind';
        v_client_revision := (v_operation ->> 'client_revision')::bigint;
        v_idempotency_key := v_operation ->> 'idempotency_key';
        v_payload := v_operation -> 'payload';
        v_valid := v_idempotency_key =
          'shelf_product:' || v_entity_id::text || ':' || v_client_revision::text;
      end if;

      if v_valid and v_operation_kind = 'delete' then
        v_valid := pg_catalog.jsonb_typeof(v_payload) = 'null';
      elsif v_valid and v_operation_kind = 'upsert' then
        -- The Shelf mirror payload is exact, bounded, and excludes owner IDs,
        -- credentials, local paths, ingredients, notes, and analytics fields.
        v_valid := pg_catalog.jsonb_typeof(v_payload) = 'object'
          and pg_catalog.octet_length(v_payload::text) <= 65536
          and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 17
          and v_payload ?& array[
            'catalog_product_id',
            'catalog_source_id',
            'catalog_match_quality',
            'catalog_source_snapshot_date',
            'manual_name',
            'manual_brand',
            'barcode',
            'opened_at',
            'pao_months',
            'expiry_date',
            'is_opened',
            'pao_source',
            'expiry_source',
            'added_via',
            'source_disclosure_ack_at',
            'status',
            'finished_at'
          ]
          and pg_catalog.jsonb_typeof(v_payload -> 'manual_name') = 'string'
          and pg_catalog.octet_length(v_payload ->> 'manual_name') between 1 and 512
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'manual_brand') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'manual_brand') = 'string'
              and pg_catalog.octet_length(v_payload ->> 'manual_brand') between 1 and 512
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'barcode') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'barcode') = 'string'
              and pg_catalog.octet_length(v_payload ->> 'barcode') between 1 and 128
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'catalog_product_id') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'catalog_product_id') = 'string'
              and (v_payload ->> 'catalog_product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'catalog_source_id') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'catalog_source_id') = 'string'
              and (v_payload ->> 'catalog_source_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'catalog_match_quality') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'catalog_match_quality') = 'string'
              and v_payload ->> 'catalog_match_quality' in (
                'verified', 'usable', 'limited', 'unverified', 'blocked', 'manual'
              )
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'catalog_source_snapshot_date') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'catalog_source_snapshot_date') = 'string'
              and (v_payload ->> 'catalog_source_snapshot_date') ~ '^\d{4}-\d{2}-\d{2}$'
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'opened_at') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'opened_at') = 'string'
              and (v_payload ->> 'opened_at') ~ '^\d{4}-\d{2}-\d{2}$'
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'pao_months') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'pao_months') = 'number'
              and (v_payload ->> 'pao_months') ~ '^[1-9][0-9]{0,3}$'
              and (v_payload ->> 'pao_months')::integer <= 1200
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'expiry_date') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'expiry_date') = 'string'
              and (v_payload ->> 'expiry_date') ~ '^\d{4}-\d{2}-\d{2}$'
            )
          )
          and pg_catalog.jsonb_typeof(v_payload -> 'is_opened') = 'boolean'
          and pg_catalog.jsonb_typeof(v_payload -> 'pao_source') = 'string'
          and v_payload ->> 'pao_source' in ('label', 'catalog', 'category_default', 'unknown')
          and pg_catalog.jsonb_typeof(v_payload -> 'expiry_source') = 'string'
          and v_payload ->> 'expiry_source' in (
            'printed', 'pao_computed', 'estimated', 'unknown'
          )
          and pg_catalog.jsonb_typeof(v_payload -> 'added_via') = 'string'
          and v_payload ->> 'added_via' in (
            'barcode', 'search', 'ocr', 'manual', 'onboarding'
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'source_disclosure_ack_at') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'source_disclosure_ack_at') = 'string'
              and pg_catalog.octet_length(v_payload ->> 'source_disclosure_ack_at') between 20 and 64
            )
          )
          and pg_catalog.jsonb_typeof(v_payload -> 'status') = 'string'
          and v_payload ->> 'status' in ('active', 'finished', 'discarded')
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'finished_at') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'finished_at') = 'string'
              and (v_payload ->> 'finished_at') ~ '^\d{4}-\d{2}-\d{2}$'
            )
          );
      end if;

      if v_valid then
        -- Same operation UUID is always replay-safe. It is a permanent
        -- validation error if a UUID is reused for different intent.
        select
          receipt.idempotency_key,
          receipt.entity_type,
          receipt.entity_id,
          receipt.operation_kind,
          receipt.client_revision
        into
          v_existing_idempotency_key,
          v_existing_entity_type,
          v_existing_entity_id,
          v_existing_operation_kind,
          v_existing_client_revision
        from public.mobile_outbox_receipts as receipt
        where receipt.user_id = v_user_id
          and receipt.operation_id = v_operation_id;

        if found then
          if v_existing_idempotency_key = v_idempotency_key
            and v_existing_entity_type = 'shelf_product'
            and v_existing_entity_id = v_entity_id
            and v_existing_operation_kind = v_operation_kind
            and v_existing_client_revision = v_client_revision
          then
            v_status := 'duplicate';
            v_error_class := null;
          end if;
        else
          -- A regenerated operation UUID may still safely replay the same
          -- owner/entity/revision through the unique idempotency key.
          select
            receipt.entity_type,
            receipt.entity_id,
            receipt.operation_kind,
            receipt.client_revision
          into
            v_existing_entity_type,
            v_existing_entity_id,
            v_existing_operation_kind,
            v_existing_client_revision
          from public.mobile_outbox_receipts as receipt
          where receipt.user_id = v_user_id
            and receipt.idempotency_key = v_idempotency_key;

          if found then
            if v_existing_entity_type = 'shelf_product'
              and v_existing_entity_id = v_entity_id
              and v_existing_operation_kind = v_operation_kind
              and v_existing_client_revision = v_client_revision
            then
              v_status := 'duplicate';
              v_error_class := null;
            end if;
          else
            insert into public.shelf_mirror_versions (
              user_id,
              entity_id,
              client_revision,
              tombstone,
              last_operation_id
            ) values (
              v_user_id,
              v_entity_id,
              0,
              true,
              null
            )
            on conflict (user_id, entity_id) do nothing;

            select version.client_revision
              into v_current_revision
              from public.shelf_mirror_versions as version
             where version.user_id = v_user_id
               and version.entity_id = v_entity_id
             for update;

            if v_client_revision <= v_current_revision then
              insert into public.mobile_outbox_receipts (
                user_id,
                operation_id,
                idempotency_key,
                entity_type,
                entity_id,
                operation_kind,
                client_revision,
                result_status
              ) values (
                v_user_id,
                v_operation_id,
                v_idempotency_key,
                'shelf_product',
                v_entity_id,
                v_operation_kind,
                v_client_revision,
                'stale'
              );
              v_status := 'stale';
              v_error_class := null;
            elsif v_operation_kind = 'delete' then
              delete from public.user_products as product
               where product.id = v_entity_id
                 and product.user_id = v_user_id;

              update public.shelf_mirror_versions as version
                 set client_revision = v_client_revision,
                     tombstone = true,
                     last_operation_id = v_operation_id,
                     updated_at = now()
               where version.user_id = v_user_id
                 and version.entity_id = v_entity_id;

              insert into public.mobile_outbox_receipts (
                user_id,
                operation_id,
                idempotency_key,
                entity_type,
                entity_id,
                operation_kind,
                client_revision,
                result_status
              ) values (
                v_user_id,
                v_operation_id,
                v_idempotency_key,
                'shelf_product',
                v_entity_id,
                v_operation_kind,
                v_client_revision,
                'applied'
              );
              v_status := 'applied';
              v_error_class := null;
            else
              v_applied_id := null;
              insert into public.user_products (
                id,
                user_id,
                catalog_product_id,
                catalog_source_id,
                catalog_match_quality,
                catalog_source_snapshot_date,
                manual_name,
                manual_brand,
                barcode,
                opened_at,
                pao_months,
                expiry_date,
                is_opened,
                pao_source,
                expiry_source,
                added_via,
                source_disclosure_ack_at,
                status,
                finished_at
              ) values (
                v_entity_id,
                v_user_id,
                case when pg_catalog.jsonb_typeof(v_payload -> 'catalog_product_id') = 'null'
                  then null else (v_payload ->> 'catalog_product_id')::uuid end,
                case when pg_catalog.jsonb_typeof(v_payload -> 'catalog_source_id') = 'null'
                  then null else (v_payload ->> 'catalog_source_id')::uuid end,
                case when pg_catalog.jsonb_typeof(v_payload -> 'catalog_match_quality') = 'null'
                  then null else v_payload ->> 'catalog_match_quality' end,
                case when pg_catalog.jsonb_typeof(v_payload -> 'catalog_source_snapshot_date') = 'null'
                  then null else (v_payload ->> 'catalog_source_snapshot_date')::date end,
                v_payload ->> 'manual_name',
                case when pg_catalog.jsonb_typeof(v_payload -> 'manual_brand') = 'null'
                  then null else v_payload ->> 'manual_brand' end,
                case when pg_catalog.jsonb_typeof(v_payload -> 'barcode') = 'null'
                  then null else v_payload ->> 'barcode' end,
                case when pg_catalog.jsonb_typeof(v_payload -> 'opened_at') = 'null'
                  then null else (v_payload ->> 'opened_at')::date end,
                case when pg_catalog.jsonb_typeof(v_payload -> 'pao_months') = 'null'
                  then null else (v_payload ->> 'pao_months')::integer end,
                case when pg_catalog.jsonb_typeof(v_payload -> 'expiry_date') = 'null'
                  then null else (v_payload ->> 'expiry_date')::date end,
                (v_payload ->> 'is_opened')::boolean,
                v_payload ->> 'pao_source',
                v_payload ->> 'expiry_source',
                v_payload ->> 'added_via',
                case when pg_catalog.jsonb_typeof(v_payload -> 'source_disclosure_ack_at') = 'null'
                  then null else (v_payload ->> 'source_disclosure_ack_at')::timestamptz end,
                v_payload ->> 'status',
                case when pg_catalog.jsonb_typeof(v_payload -> 'finished_at') = 'null'
                  then null else (v_payload ->> 'finished_at')::date end
              )
              on conflict (id) do update
                set catalog_product_id = excluded.catalog_product_id,
                    catalog_source_id = excluded.catalog_source_id,
                    catalog_match_quality = excluded.catalog_match_quality,
                    catalog_source_snapshot_date = excluded.catalog_source_snapshot_date,
                    manual_name = excluded.manual_name,
                    manual_brand = excluded.manual_brand,
                    barcode = excluded.barcode,
                    opened_at = excluded.opened_at,
                    pao_months = excluded.pao_months,
                    expiry_date = excluded.expiry_date,
                    is_opened = excluded.is_opened,
                    pao_source = excluded.pao_source,
                    expiry_source = excluded.expiry_source,
                    added_via = excluded.added_via,
                    source_disclosure_ack_at = excluded.source_disclosure_ack_at,
                    status = excluded.status,
                    finished_at = excluded.finished_at
              where public.user_products.user_id = v_user_id
              returning public.user_products.id into v_applied_id;

              if v_applied_id is not null then
                update public.shelf_mirror_versions as version
                   set client_revision = v_client_revision,
                       tombstone = false,
                       last_operation_id = v_operation_id,
                       updated_at = now()
                 where version.user_id = v_user_id
                   and version.entity_id = v_entity_id;

                insert into public.mobile_outbox_receipts (
                  user_id,
                  operation_id,
                  idempotency_key,
                  entity_type,
                  entity_id,
                  operation_kind,
                  client_revision,
                  result_status
                ) values (
                  v_user_id,
                  v_operation_id,
                  v_idempotency_key,
                  'shelf_product',
                  v_entity_id,
                  v_operation_kind,
                  v_client_revision,
                  'applied'
                );
                v_status := 'applied';
                v_error_class := null;
              end if;
            end if;
          end if;
        end if;
      end if;
    exception
      -- Expected client/data-shape failures are isolated to this operation.
      when invalid_text_representation
        or invalid_datetime_format
        or datetime_field_overflow
        or numeric_value_out_of_range
        or string_data_right_truncation
        or not_null_violation
        or foreign_key_violation
        or check_violation
      then
        v_status := 'permanent';
        v_error_class := 'validation';
      when unique_violation then
        -- A concurrent worker can win either receipt uniqueness constraint.
        -- The nested subtransaction has rolled back this row's state change, so
        -- only an exact committed receipt is accepted as a duplicate.
        get stacked diagnostics v_constraint_name = constraint_name;
        if v_constraint_name not in (
          'mobile_outbox_receipts_pkey',
          'mobile_outbox_receipts_owner_idempotency_key'
        ) then
          raise;
        end if;
        perform 1
          from public.mobile_outbox_receipts as receipt
         where receipt.user_id = v_user_id
           and (
             receipt.operation_id = v_operation_id
             or receipt.idempotency_key = v_idempotency_key
           )
           and receipt.idempotency_key = v_idempotency_key
           and receipt.entity_type = 'shelf_product'
           and receipt.entity_id = v_entity_id
           and receipt.operation_kind = v_operation_kind
           and receipt.client_revision = v_client_revision;
        if found then
          v_status := 'duplicate';
          v_error_class := null;
        else
          v_status := 'permanent';
          v_error_class := 'validation';
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

revoke all on function public.apply_shelf_outbox_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_shelf_outbox_batch(jsonb) to authenticated;

comment on function public.apply_shelf_outbox_batch(jsonb) is
  'Applies at most 25 owner-derived, revisioned Shelf mutations with per-operation idempotency.';
