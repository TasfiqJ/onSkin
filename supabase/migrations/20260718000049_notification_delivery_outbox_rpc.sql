-- Durable content-free notification-delivery event application.
--
-- The authenticated owner is derived from auth.uid(). The payload records only
-- the canonical kind/tier pair and OS-acceptance timestamp, never notification
-- content, health context, device identity, or user identity.

alter table public.mobile_outbox_receipts
  drop constraint if exists mobile_outbox_receipts_entity_type_check,
  add constraint mobile_outbox_receipts_entity_type_check
    check (entity_type in (
      'shelf_product',
      'notification_delivery',
      'notification_preferences',
      'recommendation_preferences'
    ));

-- All client delivery writes now pass through the strict security-definer RPC.
-- Older binaries may still attempt their former optional direct mirror; denial
-- does not affect their local cap ledger or native presentation.
drop policy if exists "notification_log_insert_own" on public.notification_log;
revoke insert on table public.notification_log from public, anon, authenticated;

create or replace function public.apply_notification_delivery_outbox_batch(
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
  v_kind text;
  v_tier text;
  v_sent_at timestamptz;
  v_existing_idempotency_key text;
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
    v_kind := null;
    v_tier := null;
    v_sent_at := null;
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
        and v_operation ->> 'entity_type' = 'notification_delivery'
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
          and pg_catalog.octet_length(v_payload::text) <= 1024
          and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 3
          and v_payload ?& array['kind', 'tier', 'sent_at']
          and pg_catalog.jsonb_typeof(v_payload -> 'kind') = 'string'
          and pg_catalog.jsonb_typeof(v_payload -> 'tier') = 'string'
          and pg_catalog.jsonb_typeof(v_payload -> 'sent_at') = 'string'
          and (v_payload ->> 'sent_at') ~
            '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$';
      end if;

      if v_valid then
        v_kind := v_payload ->> 'kind';
        v_tier := v_payload ->> 'tier';
        v_sent_at := (v_payload ->> 'sent_at')::timestamptz;
        v_valid := case v_kind
          when 'am_reminder' then v_tier = 'utility'
          when 'pm_step' then v_tier = 'utility'
          when 'capture' then v_tier = 'behavioural'
          when 'replenishment' then v_tier = 'behavioural'
          when 'rampup' then v_tier = 'behavioural'
          when 'deescalation' then v_tier = 'behavioural'
          when 'winback' then v_tier = 'promotional'
          else false
        end
          and v_sent_at <= pg_catalog.now() + interval '5 minutes'
          and v_idempotency_key =
            'notification_delivery:' || v_operation_id::text || ':' ||
            v_kind || ':' || (v_payload ->> 'sent_at');
      end if;

      if v_valid then
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
            and v_existing_entity_type = 'notification_delivery'
            and v_existing_entity_id = v_entity_id
            and v_existing_operation_kind = 'upsert'
            and v_existing_client_revision = 1
          then
            v_status := 'duplicate';
            v_error_class := null;
          end if;
        else
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
            if v_existing_entity_type = 'notification_delivery'
              and v_existing_entity_id = v_entity_id
              and v_existing_operation_kind = 'upsert'
              and v_existing_client_revision = 1
            then
              v_status := 'duplicate';
              v_error_class := null;
            end if;
          elsif v_sent_at < pg_catalog.now() - interval '30 days' then
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
              'notification_delivery',
              v_entity_id,
              'upsert',
              1,
              'stale'
            );
            v_status := 'stale';
            v_error_class := null;
          else
            insert into public.notification_log (
              id,
              user_id,
              tier,
              kind,
              sent_at
            ) values (
              v_entity_id,
              v_user_id,
              v_tier,
              v_kind,
              v_sent_at
            );

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
              'notification_delivery',
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
          'notification_log_pkey',
          'mobile_outbox_receipts_pkey',
          'mobile_outbox_receipts_owner_idempotency_key'
        ) then
          raise;
        else
          -- A concurrent replay can first collide on notification_log.id and
          -- only then observe the other transaction's committed receipt. Treat
          -- it as a duplicate only when that exact owner operation is present;
          -- an unrelated event UUID collision remains a permanent row error.
          perform 1
            from public.mobile_outbox_receipts as receipt
           where receipt.user_id = v_user_id
             and (
               receipt.operation_id = v_operation_id
               or receipt.idempotency_key = v_idempotency_key
             )
             and receipt.idempotency_key = v_idempotency_key
             and receipt.entity_type = 'notification_delivery'
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

revoke all on function public.apply_notification_delivery_outbox_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_notification_delivery_outbox_batch(jsonb)
  to authenticated;

comment on function public.apply_notification_delivery_outbox_batch(jsonb) is
  'Applies at most 25 content-free owner-derived notification delivery events with replay safety.';
