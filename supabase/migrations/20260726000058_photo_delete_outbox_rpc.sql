-- Durable owner-derived photo metadata deletion.
--
-- Image bytes remain device-local under the current product contract. This
-- RPC removes only the optional owner-scoped cloud metadata row. The client
-- commits the encrypted local deletion journal and this outbox tombstone in
-- one private-KV transaction before it starts deleting local files.

alter table public.mobile_outbox_receipts
  drop constraint if exists mobile_outbox_receipts_entity_type_check,
  add constraint mobile_outbox_receipts_entity_type_check
    check (entity_type in (
      'shelf_product',
      'shelf_scan',
      'conflict_choice',
      'notification_delivery',
      'notification_preferences',
      'recommendation_preferences',
      'photo_delete'
    ));

create index if not exists mobile_outbox_receipts_photo_delete_tombstone_idx
  on public.mobile_outbox_receipts (user_id, entity_id)
  where entity_type = 'photo_delete' and result_status = 'applied';

-- New clients use only the owner-derived, receipt-backed RPC. Older clients
-- already treat their direct mirror deletion as best-effort, so denial cannot
-- prevent local photo deletion.
drop policy if exists "photos_delete_own" on public.photos;
revoke delete on table public.photos from public, anon, authenticated;

-- A receipt is also a terminal metadata tombstone for this owner/photo UUID.
-- The helper takes locks in the same account-then-photo order as the RPC, so a
-- stale insert either commits first and is then deleted, or waits and is
-- rejected after the delete receipt commits.
create or replace function public.photo_outbox_insert_allowed(
  p_entity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
    or p_entity_id is null
    or not public.account_deletion_write_allowed()
  then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'photo-delete:' || v_user_id::text || ':' || p_entity_id::text,
      0
    )
  );
  return not exists (
    select 1
      from public.mobile_outbox_receipts as receipt
     where receipt.user_id = v_user_id
       and receipt.entity_type = 'photo_delete'
       and receipt.entity_id = p_entity_id
       and receipt.result_status = 'applied'
  );
end;
$$;

revoke all on function public.photo_outbox_insert_allowed(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.photo_outbox_insert_allowed(uuid)
  to authenticated;

drop policy if exists "photos_no_outbox_delete_reinsert" on public.photos;
create policy "photos_no_outbox_delete_reinsert" on public.photos
  as restrictive for insert to authenticated
  with check (public.photo_outbox_insert_allowed(id));

-- The existing owner UPDATE policy permits changing a primary-key value. Run
-- the same tombstone check on the proposed row so a fresh UUID cannot be
-- renamed to a deleted UUID and bypass the INSERT gate.
drop policy if exists "photos_no_outbox_delete_rewrite" on public.photos;
create policy "photos_no_outbox_delete_rewrite" on public.photos
  as restrictive for update to authenticated
  using (true)
  with check (public.photo_outbox_insert_allowed(id));

create or replace function public.apply_photo_delete_outbox_batch(
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
  v_results jsonb := '[]'::jsonb;
  v_operation_id uuid;
  v_entity_id uuid;
  v_client_revision bigint;
  v_idempotency_key text;
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

  -- Take the same owner advisory lock as account-deletion claiming before
  -- inspecting any photo. This is deliberately outside the row loop: an empty
  -- or already-absent photo must not let a receipt race past account deletion.
  if not public.account_deletion_write_allowed() then
    raise exception 'account_deletion_in_progress' using errcode = '55000';
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
    v_client_revision := null;
    v_idempotency_key := null;
    v_existing_idempotency_key := null;
    v_existing_entity_type := null;
    v_existing_entity_id := null;
    v_existing_operation_kind := null;
    v_existing_client_revision := null;

    begin
      -- The wire object is exact and content-free: no owner identifier, local
      -- URI, note, image bytes, or future unreviewed field may be accepted.
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
        and pg_catalog.jsonb_typeof(v_operation -> 'entity_type') = 'string'
        and v_operation ->> 'entity_type' = 'photo_delete'
        and pg_catalog.jsonb_typeof(v_operation -> 'entity_id') = 'string'
        and (v_operation ->> 'entity_id') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and pg_catalog.jsonb_typeof(v_operation -> 'operation_kind') = 'string'
        and v_operation ->> 'operation_kind' = 'delete'
        and pg_catalog.jsonb_typeof(v_operation -> 'payload') = 'null'
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
        v_valid := v_idempotency_key = 'photo_delete:' || v_operation_id::text;
      end if;

      if v_valid then
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'photo-delete:' || v_user_id::text || ':' || v_entity_id::text,
            0
          )
        );

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
            and v_existing_entity_type = 'photo_delete'
            and v_existing_entity_id = v_entity_id
            and v_existing_operation_kind = 'delete'
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
            if v_existing_entity_type = 'photo_delete'
              and v_existing_entity_id = v_entity_id
              and v_existing_operation_kind = 'delete'
              and v_existing_client_revision = v_client_revision
            then
              v_status := 'duplicate';
              v_error_class := null;
            end if;
          else
            delete from public.photos
             where user_id = v_user_id
               and id = v_entity_id;

            -- Absence is success: the metadata may never have been mirrored,
            -- another device may already have deleted it, or this may be a
            -- response-loss replay. The receipt makes every case converge.
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
              'photo_delete',
              v_entity_id,
              'delete',
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
        or numeric_value_out_of_range
        or string_data_right_truncation
        or not_null_violation
        or check_violation
      then
        v_status := 'permanent';
        v_error_class := 'validation';
      when foreign_key_violation then
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
           and receipt.entity_type = 'photo_delete'
           and receipt.entity_id = v_entity_id
           and receipt.operation_kind = 'delete'
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

revoke all on function public.apply_photo_delete_outbox_batch(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_photo_delete_outbox_batch(jsonb)
  to authenticated;

comment on function public.apply_photo_delete_outbox_batch(jsonb) is
  'Applies at most 25 owner-derived, receipt-backed photo metadata deletions.';

comment on function public.photo_outbox_insert_allowed(uuid) is
  'Rejects owner photo metadata reinsertion after a terminal photo-delete outbox receipt.';
