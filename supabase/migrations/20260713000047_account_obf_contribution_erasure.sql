-- Keep account-owned Open Beauty Facts contribution payloads inside the same
-- fail-closed erasure boundary as the other service-role-only rows. The legacy
-- SET NULL foreign key could otherwise retain barcode/payload data after Auth
-- hard deletion with no remaining owner link.

begin;

-- Every current write is created from an authenticated catalog correction. A
-- NULL owner therefore represents legacy orphaned account data with no valid
-- contribution workflow purpose and is safer to erase than to retain.
delete from public.obf_contribution_queue
 where user_id is null;

alter table public.obf_contribution_queue
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.obf_contribution_queue'::pg_catalog.regclass
       and conname = 'obf_contribution_queue_user_id_fkey'
       and contype = 'f'
  ) then
    raise exception 'OBF_CONTRIBUTION_USER_FK_MISSING' using errcode = 'P0001';
  end if;
end;
$$;

alter table public.obf_contribution_queue
  drop constraint obf_contribution_queue_user_id_fkey;

alter table public.obf_contribution_queue
  add constraint obf_contribution_queue_user_id_fkey
  foreign key (user_id)
  references auth.users (id)
  on delete cascade
  not valid;

alter table public.obf_contribution_queue
  validate constraint obf_contribution_queue_user_id_fkey;

create index if not exists obf_contribution_queue_user_id_idx
  on public.obf_contribution_queue (user_id);

create or replace function public.scrub_account_service_rows(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id_text text;
  order_rows_scrubbed bigint := 0;
  click_rows_deleted bigint := 0;
  obf_contribution_rows_deleted bigint := 0;
  subscription_rows_deleted bigint := 0;
  subscription_rows_scrubbed bigint := 0;
  residual_order_attributions bigint := 0;
  residual_obf_contributions bigint := 0;
  residual_subscription_identities bigint := 0;
begin
  if p_user_id is null then
    raise exception 'ACCOUNT_SERVICE_SCRUB_INVALID_USER' using errcode = '22004';
  end if;
  v_user_id_text := p_user_id::text;

  update public.order_attributions as attribution
     set click_token = null
   where attribution.click_token is not null
     and exists (
       select 1
         from public.commerce_click_events as click
        where click.user_id = p_user_id
          and click.click_token = attribution.click_token
     );
  get diagnostics order_rows_scrubbed = row_count;

  delete from public.commerce_click_events as click
   where click.user_id = p_user_id;
  get diagnostics click_rows_deleted = row_count;

  delete from public.obf_contribution_queue as contribution
   where contribution.user_id = p_user_id;
  get diagnostics obf_contribution_rows_deleted = row_count;

  -- A RevenueCat event owned only by this account has no post-deletion purpose in
  -- the app database, so remove it rather than retaining transaction/audit handles
  -- with the identity columns blanked. Preserve a row only when another currently
  -- live auth user is explicitly present in one of the seven owner fields.
  delete from public.subscriptions_events as event
   where (
     event.user_id = p_user_id
     or event.resolved_user_id = p_user_id
     or event.app_user_id = v_user_id_text
     or event.original_app_user_id = v_user_id_text
     or event.aliases @> array[v_user_id_text]
     or event.transferred_from @> array[v_user_id_text]
     or event.transferred_to @> array[v_user_id_text]
   )
   and not exists (
     select 1
       from auth.users as other_user
      where other_user.id <> p_user_id
        and (
          event.user_id = other_user.id
          or event.resolved_user_id = other_user.id
          or event.app_user_id = other_user.id::text
          or event.original_app_user_id = other_user.id::text
          or event.aliases @> array[other_user.id::text]
          or event.transferred_from @> array[other_user.id::text]
          or event.transferred_to @> array[other_user.id::text]
        )
   );
  get diagnostics subscription_rows_deleted = row_count;

  -- Rows shared with another live account retain that account and non-identity
  -- audit fields. Remove only the deleting user's scalar/array occurrences.
  update public.subscriptions_events as event
     set user_id = case when event.user_id = p_user_id then null else event.user_id end,
         resolved_user_id = case
           when event.resolved_user_id = p_user_id then null
           else event.resolved_user_id
         end,
         app_user_id = case
           when event.app_user_id = v_user_id_text then null
           else event.app_user_id
         end,
         original_app_user_id = case
           when event.original_app_user_id = v_user_id_text then null
           else event.original_app_user_id
         end,
         aliases = case
           when event.aliases @> array[v_user_id_text]
             then nullif(pg_catalog.array_remove(event.aliases, v_user_id_text), '{}'::text[])
           else event.aliases
         end,
         transferred_from = case
           when event.transferred_from @> array[v_user_id_text]
             then nullif(
               pg_catalog.array_remove(event.transferred_from, v_user_id_text),
               '{}'::text[]
             )
           else event.transferred_from
         end,
         transferred_to = case
           when event.transferred_to @> array[v_user_id_text]
             then nullif(
               pg_catalog.array_remove(event.transferred_to, v_user_id_text),
               '{}'::text[]
             )
           else event.transferred_to
         end
   where event.user_id = p_user_id
      or event.resolved_user_id = p_user_id
      or event.app_user_id = v_user_id_text
      or event.original_app_user_id = v_user_id_text
      or event.aliases @> array[v_user_id_text]
      or event.transferred_from @> array[v_user_id_text]
      or event.transferred_to @> array[v_user_id_text];
  get diagnostics subscription_rows_scrubbed = row_count;

  select count(*)
    into residual_order_attributions
    from public.order_attributions as attribution
    join public.commerce_click_events as click
      on click.click_token = attribution.click_token
   where click.user_id = p_user_id
     and attribution.click_token is not null;

  select count(*)
    into residual_obf_contributions
    from public.obf_contribution_queue as contribution
   where contribution.user_id = p_user_id;

  select count(*)
    into residual_subscription_identities
    from public.subscriptions_events as event
   where event.user_id = p_user_id
      or event.resolved_user_id = p_user_id
      or event.app_user_id = v_user_id_text
      or event.original_app_user_id = v_user_id_text
      or event.aliases @> array[v_user_id_text]
      or event.transferred_from @> array[v_user_id_text]
      or event.transferred_to @> array[v_user_id_text];

  if residual_order_attributions <> 0
    or residual_obf_contributions <> 0
    or residual_subscription_identities <> 0 then
    raise exception 'ACCOUNT_SERVICE_SCRUB_INCOMPLETE' using errcode = 'P0001';
  end if;

  return pg_catalog.jsonb_build_object(
    'complete', true,
    'order_attributions_scrubbed', order_rows_scrubbed,
    'commerce_click_events_deleted', click_rows_deleted,
    'obf_contribution_queue_deleted', obf_contribution_rows_deleted,
    'subscriptions_events_deleted', subscription_rows_deleted,
    'subscriptions_events_scrubbed', subscription_rows_scrubbed,
    'residual_order_attributions', residual_order_attributions,
    'residual_obf_contributions', residual_obf_contributions,
    'residual_subscription_identities', residual_subscription_identities
  );
end;
$$;

revoke all on function public.scrub_account_service_rows(uuid)
  from public, anon, authenticated;
grant execute on function public.scrub_account_service_rows(uuid) to service_role;

comment on function public.scrub_account_service_rows(uuid) is
  'Atomically removes one verified account identity from service-only commerce, OBF contribution, and subscription rows; deletes account-only subscription events; preserves shared owners and audit fields; and raises if matching residue remains.';

commit;
