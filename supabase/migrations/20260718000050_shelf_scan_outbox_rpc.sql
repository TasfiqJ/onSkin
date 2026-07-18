-- Durable owner-bound Shelf scan intake.
--
-- Raw barcodes remain inside the encrypted client outbox and this exact RPC
-- payload. Receipts retain only a SHA-256 payload commitment. The authenticated
-- owner is always derived from auth.uid().

alter table public.mobile_outbox_receipts
  add column if not exists payload_hash text;

alter table public.mobile_outbox_receipts
  drop constraint if exists mobile_outbox_receipts_payload_hash_check,
  add constraint mobile_outbox_receipts_payload_hash_check
    check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$'),
  drop constraint if exists mobile_outbox_receipts_entity_type_check,
  add constraint mobile_outbox_receipts_entity_type_check
    check (entity_type in (
      'shelf_product',
      'shelf_scan',
      'notification_delivery',
      'notification_preferences',
      'recommendation_preferences'
    ));

-- New clients use only the owner-derived RPC. Older best-effort clients may
-- still attempt a direct INSERT; denial cannot block their visible scan flow.
drop policy if exists "shelf_scans_insert_own" on public.shelf_scans;
drop policy if exists "shelf_scans_update_own" on public.shelf_scans;
revoke insert on table public.shelf_scans from public, anon, authenticated;
revoke update on table public.shelf_scans from public, anon, authenticated;

create or replace function public.apply_shelf_scan_outbox_batch(
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
  v_idempotency_key text;
  v_client_revision bigint;
  v_barcode text;
  v_result text;
  v_matched_product_id uuid;
  v_scanned_at timestamptz;
  v_payload_hash text;
  v_existing_idempotency_key text;
  v_existing_payload_hash text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
  v_existing_operation_kind text;
  v_existing_client_revision bigint;
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
    v_idempotency_key := null;
    v_client_revision := null;
    v_barcode := null;
    v_result := null;
    v_matched_product_id := null;
    v_scanned_at := null;
    v_payload_hash := null;
    v_payload := null;

    begin
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
        and (v_operation ->> 'operation_id') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and v_operation ->> 'entity_type' = 'shelf_scan'
        and pg_catalog.jsonb_typeof(v_operation -> 'entity_type') = 'string'
        and pg_catalog.jsonb_typeof(v_operation -> 'entity_id') = 'string'
        and (v_operation ->> 'entity_id') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and v_operation ->> 'operation_kind' = 'upsert'
        and pg_catalog.jsonb_typeof(v_operation -> 'operation_kind') = 'string'
        and pg_catalog.jsonb_typeof(v_operation -> 'client_revision') = 'number'
        and v_operation ->> 'client_revision' = '1'
        and pg_catalog.jsonb_typeof(v_operation -> 'idempotency_key') = 'string'
        and pg_catalog.octet_length(v_operation ->> 'idempotency_key') between 1 and 256
      then
        v_operation_id := (v_operation ->> 'operation_id')::uuid;
        v_entity_id := (v_operation ->> 'entity_id')::uuid;
        v_client_revision := 1;
        v_idempotency_key := v_operation ->> 'idempotency_key';
        v_payload := v_operation -> 'payload';
        v_valid := true;
      end if;

      if v_valid then
        v_valid := pg_catalog.jsonb_typeof(v_payload) = 'object'
          and pg_catalog.octet_length(v_payload::text) <= 2048
          and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 4
          and v_payload ?& array['barcode', 'result', 'matched_product_id', 'scanned_at']
          and pg_catalog.jsonb_typeof(v_payload -> 'barcode') = 'string'
          and (v_payload ->> 'barcode') ~ '^[0-9]{6,14}$'
          and pg_catalog.jsonb_typeof(v_payload -> 'result') = 'string'
          and v_payload ->> 'result' in (
            'matched', 'no_match', 'ambiguous', 'offline_queued'
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'matched_product_id') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'matched_product_id') = 'string'
              and (v_payload ->> 'matched_product_id') ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            )
          )
          and pg_catalog.jsonb_typeof(v_payload -> 'scanned_at') = 'string'
          and (v_payload ->> 'scanned_at') ~
            '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$';
      end if;

      if v_valid then
        v_barcode := v_payload ->> 'barcode';
        v_result := v_payload ->> 'result';
        v_matched_product_id := case
          when pg_catalog.jsonb_typeof(v_payload -> 'matched_product_id') = 'null' then null
          else (v_payload ->> 'matched_product_id')::uuid
        end;
        v_scanned_at := (v_payload ->> 'scanned_at')::timestamptz;
        v_valid := (v_result = 'matched' or v_matched_product_id is null)
          and v_scanned_at <= pg_catalog.now() + interval '5 minutes';
      end if;

      if v_valid then
        v_payload_hash := pg_catalog.encode(
          extensions.digest(
            pg_catalog.convert_to(
              'onskin:shelf-scan-payload:v1' || E'\n' ||
              v_barcode || E'\n' ||
              v_result || E'\n' ||
              coalesce(v_matched_product_id::text, '-') || E'\n' ||
              (v_payload ->> 'scanned_at'),
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        );
        v_valid := v_idempotency_key =
          'shelf_scan:' || v_operation_id::text || ':' || v_payload_hash;
      end if;

      if v_valid then
        select
          receipt.idempotency_key,
          receipt.payload_hash,
          receipt.entity_type,
          receipt.entity_id,
          receipt.operation_kind,
          receipt.client_revision
        into
          v_existing_idempotency_key,
          v_existing_payload_hash,
          v_existing_entity_type,
          v_existing_entity_id,
          v_existing_operation_kind,
          v_existing_client_revision
        from public.mobile_outbox_receipts as receipt
        where receipt.user_id = v_user_id
          and receipt.operation_id = v_operation_id;

        if found then
          if v_existing_idempotency_key = v_idempotency_key
            and v_existing_payload_hash = v_payload_hash
            and v_existing_entity_type = 'shelf_scan'
            and v_existing_entity_id = v_entity_id
            and v_existing_operation_kind = 'upsert'
            and v_existing_client_revision = 1
          then
            v_status := 'duplicate';
            v_error_class := null;
          end if;
        else
          select
            receipt.payload_hash,
            receipt.entity_type,
            receipt.entity_id,
            receipt.operation_kind,
            receipt.client_revision
          into
            v_existing_payload_hash,
            v_existing_entity_type,
            v_existing_entity_id,
            v_existing_operation_kind,
            v_existing_client_revision
          from public.mobile_outbox_receipts as receipt
          where receipt.user_id = v_user_id
            and receipt.idempotency_key = v_idempotency_key;

          if found then
            if v_existing_payload_hash = v_payload_hash
              and v_existing_entity_type = 'shelf_scan'
              and v_existing_entity_id = v_entity_id
              and v_existing_operation_kind = 'upsert'
              and v_existing_client_revision = 1
            then
              v_status := 'duplicate';
              v_error_class := null;
            end if;
          elsif v_scanned_at < pg_catalog.now() - interval '30 days' then
            insert into public.mobile_outbox_receipts (
              user_id,
              operation_id,
              idempotency_key,
              payload_hash,
              entity_type,
              entity_id,
              operation_kind,
              client_revision,
              result_status
            ) values (
              v_user_id,
              v_operation_id,
              v_idempotency_key,
              v_payload_hash,
              'shelf_scan',
              v_entity_id,
              'upsert',
              1,
              'stale'
            );
            v_status := 'stale';
            v_error_class := null;
          else
            if v_matched_product_id is not null then
              perform 1
                from public.products
               where id = v_matched_product_id
                 for key share;
              if not found then
                v_matched_product_id := null;
              end if;
            end if;

            insert into public.shelf_scans (
              id,
              user_id,
              barcode,
              matched_product_id,
              result,
              contributed_back,
              created_at
            ) values (
              v_entity_id,
              v_user_id,
              v_barcode,
              v_matched_product_id,
              v_result,
              false,
              v_scanned_at
            );

            insert into public.mobile_outbox_receipts (
              user_id,
              operation_id,
              idempotency_key,
              payload_hash,
              entity_type,
              entity_id,
              operation_kind,
              client_revision,
              result_status
            ) values (
              v_user_id,
              v_operation_id,
              v_idempotency_key,
              v_payload_hash,
              'shelf_scan',
              v_entity_id,
              'upsert',
              1,
              'applied'
            );
            v_status := 'applied';
            v_error_class := null;
          end if;
        end if;
      end if;
    exception
      when invalid_text_representation
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
        get stacked diagnostics v_constraint_name = constraint_name;
        if v_constraint_name not in (
          'shelf_scans_pkey',
          'mobile_outbox_receipts_pkey',
          'mobile_outbox_receipts_owner_idempotency_key'
        ) then
          raise;
        else
          perform 1
            from public.mobile_outbox_receipts as receipt
           where receipt.user_id = v_user_id
             and (
               receipt.operation_id = v_operation_id
               or receipt.idempotency_key = v_idempotency_key
             )
             and receipt.idempotency_key = v_idempotency_key
             and receipt.payload_hash = v_payload_hash
             and receipt.entity_type = 'shelf_scan'
             and receipt.entity_id = v_entity_id
             and receipt.operation_kind = 'upsert'
             and receipt.client_revision = 1;
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

revoke all on function public.apply_shelf_scan_outbox_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_shelf_scan_outbox_batch(jsonb)
  to authenticated;

comment on function public.apply_shelf_scan_outbox_batch(jsonb) is
  'Applies at most 25 owner-derived Shelf scan events with payload-bound replay safety.';
