-- Durable notification-preference outbox application.
--
-- Preference snapshots preserve the existing last-arrival-wins mirror policy.
-- Operation identity, rather than a resettable local revision, provides replay
-- safety across cleanup/reinstall. The client serializes one dependency stream;
-- the authenticated owner is always derived from auth.uid() here.

alter table public.mobile_outbox_receipts
  drop constraint if exists mobile_outbox_receipts_entity_type_check,
  add constraint mobile_outbox_receipts_entity_type_check
    check (entity_type in ('shelf_product', 'notification_preferences'));

create or replace function public.apply_notification_preferences_outbox_batch(
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
        and v_operation ->> 'entity_type' = 'notification_preferences'
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
        v_idempotency_key := v_operation ->> 'idempotency_key';
        v_payload := v_operation -> 'payload';
        v_valid := v_idempotency_key =
          'notification_preferences:' || v_operation_id::text;
      end if;

      if v_valid then
        v_valid := pg_catalog.jsonb_typeof(v_payload) = 'object'
          and pg_catalog.octet_length(v_payload::text) <= 8192
          and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 13
          and v_payload ?& array[
            'am_reminder_time',
            'pm_reminder_time',
            'am_reminder_enabled',
            'pm_reminder_enabled',
            'streak_nudges',
            'replenishment_alerts',
            'capture_reminders',
            'quiet_hours_start',
            'quiet_hours_end',
            'timezone',
            'live_activity_enabled',
            'promotional_opt_in',
            'lockscreen_discreet'
          ]
          and pg_catalog.jsonb_typeof(v_payload -> 'am_reminder_time') = 'string'
          and (v_payload ->> 'am_reminder_time') ~
            '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          and pg_catalog.jsonb_typeof(v_payload -> 'pm_reminder_time') = 'string'
          and (v_payload ->> 'pm_reminder_time') ~
            '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          and pg_catalog.jsonb_typeof(v_payload -> 'am_reminder_enabled') = 'boolean'
          and pg_catalog.jsonb_typeof(v_payload -> 'pm_reminder_enabled') = 'boolean'
          and pg_catalog.jsonb_typeof(v_payload -> 'streak_nudges') = 'boolean'
          and pg_catalog.jsonb_typeof(v_payload -> 'replenishment_alerts') = 'boolean'
          and pg_catalog.jsonb_typeof(v_payload -> 'capture_reminders') = 'boolean'
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'quiet_hours_start') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'quiet_hours_start') = 'string'
              and (v_payload ->> 'quiet_hours_start') ~
                '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            )
          )
          and (
            pg_catalog.jsonb_typeof(v_payload -> 'quiet_hours_end') = 'null'
            or (
              pg_catalog.jsonb_typeof(v_payload -> 'quiet_hours_end') = 'string'
              and (v_payload ->> 'quiet_hours_end') ~
                '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            )
          )
          and pg_catalog.jsonb_typeof(v_payload -> 'timezone') = 'string'
          and pg_catalog.octet_length(v_payload ->> 'timezone') between 1 and 128
          and (v_payload ->> 'timezone') ~ '^[A-Za-z0-9_+./-]+$'
          and pg_catalog.jsonb_typeof(v_payload -> 'live_activity_enabled') = 'boolean'
          and pg_catalog.jsonb_typeof(v_payload -> 'promotional_opt_in') = 'boolean'
          and pg_catalog.jsonb_typeof(v_payload -> 'lockscreen_discreet') = 'boolean'
          and (v_payload ->> 'lockscreen_discreet')::boolean = true;
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
            and v_existing_entity_type = 'notification_preferences'
            and v_existing_entity_id = v_entity_id
            and v_existing_operation_kind = 'upsert'
            and v_existing_client_revision = v_client_revision
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
            if v_existing_entity_type = 'notification_preferences'
              and v_existing_entity_id = v_entity_id
              and v_existing_operation_kind = 'upsert'
              and v_existing_client_revision = v_client_revision
            then
              v_status := 'duplicate';
              v_error_class := null;
            end if;
          else
            insert into public.notification_preferences (
              user_id,
              am_reminder_time,
              pm_reminder_time,
              am_reminder_enabled,
              pm_reminder_enabled,
              streak_nudges,
              replenishment_alerts,
              capture_reminders,
              quiet_hours_start,
              quiet_hours_end,
              timezone,
              live_activity_enabled,
              promotional_opt_in,
              lockscreen_discreet
            ) values (
              v_user_id,
              (v_payload ->> 'am_reminder_time')::time,
              (v_payload ->> 'pm_reminder_time')::time,
              (v_payload ->> 'am_reminder_enabled')::boolean,
              (v_payload ->> 'pm_reminder_enabled')::boolean,
              (v_payload ->> 'streak_nudges')::boolean,
              (v_payload ->> 'replenishment_alerts')::boolean,
              (v_payload ->> 'capture_reminders')::boolean,
              case when pg_catalog.jsonb_typeof(v_payload -> 'quiet_hours_start') = 'null'
                then null else (v_payload ->> 'quiet_hours_start')::time end,
              case when pg_catalog.jsonb_typeof(v_payload -> 'quiet_hours_end') = 'null'
                then null else (v_payload ->> 'quiet_hours_end')::time end,
              v_payload ->> 'timezone',
              (v_payload ->> 'live_activity_enabled')::boolean,
              (v_payload ->> 'promotional_opt_in')::boolean,
              true
            )
            on conflict (user_id) do update
              set am_reminder_time = excluded.am_reminder_time,
                  pm_reminder_time = excluded.pm_reminder_time,
                  am_reminder_enabled = excluded.am_reminder_enabled,
                  pm_reminder_enabled = excluded.pm_reminder_enabled,
                  streak_nudges = excluded.streak_nudges,
                  replenishment_alerts = excluded.replenishment_alerts,
                  capture_reminders = excluded.capture_reminders,
                  quiet_hours_start = excluded.quiet_hours_start,
                  quiet_hours_end = excluded.quiet_hours_end,
                  timezone = excluded.timezone,
                  live_activity_enabled = excluded.live_activity_enabled,
                  promotional_opt_in = excluded.promotional_opt_in,
                  lockscreen_discreet = true;

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
              'notification_preferences',
              v_entity_id,
              'upsert',
              v_client_revision,
              'applied'
            );
            v_status := 'applied';
            v_error_class := null;
          end if;
        end if;
      end if;
    exception
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
           and receipt.entity_type = 'notification_preferences'
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

revoke all on function public.apply_notification_preferences_outbox_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_notification_preferences_outbox_batch(jsonb)
  to authenticated;

comment on function public.apply_notification_preferences_outbox_batch(jsonb) is
  'Applies at most 25 owner-derived notification preference snapshots with operation replay safety.';
