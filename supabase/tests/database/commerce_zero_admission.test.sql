begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(23);

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260729000072'::text,
  'migration history reaches COM-01A commerce zero admission'
);

select has_table(
  'private',
  'commerce_admission_control',
  'the private commerce admission singleton exists'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'rows', count(*),
      'closedRows', count(*) filter (
        where control.singleton
          and control.admission_state = 'closed'
          and control.checkpoint = 'com01a_zero_admission'
          and control.reason_code = 'approved_rail_not_admitted'
      )
    )
      from private.commerce_admission_control as control
  ),
  '{"rows":1,"closedRows":1}'::jsonb,
  'the control is exactly one constrained closed checkpoint'
);

select ok(
  (
    select relations.relrowsecurity and relations.relforcerowsecurity
      from pg_catalog.pg_class as relations
     where relations.oid = 'private.commerce_admission_control'::regclass
  )
    and not exists (
      select 1
        from pg_catalog.pg_policies as policies
       where policies.schemaname = 'private'
         and policies.tablename = 'commerce_admission_control'
    )
    and not exists (
      select 1
        from pg_catalog.unnest(
          array['anon', 'authenticated', 'service_role']
        ) as roles(name)
       where pg_catalog.has_table_privilege(
               roles.name,
               'private.commerce_admission_control',
               'SELECT'
             )
          or pg_catalog.has_table_privilege(
               roles.name,
               'private.commerce_admission_control',
               'INSERT'
             )
          or pg_catalog.has_table_privilege(
               roles.name,
               'private.commerce_admission_control',
               'UPDATE'
             )
          or pg_catalog.has_table_privilege(
               roles.name,
               'private.commerce_admission_control',
               'DELETE'
             )
    ),
  'the closed control has forced RLS, no policy, and no runtime privilege'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as triggers
     where triggers.tgrelid = 'private.commerce_admission_control'::regclass
       and triggers.tgname = 'commerce_admission_control_immutable'
       and not triggers.tgisinternal
       and triggers.tgenabled = 'O'
  ),
  'the closed singleton cannot be updated, deleted, or truncated in place'
);

select ok(
  not exists (
    select 1
      from pg_catalog.pg_policies as policies
     where policies.schemaname = 'public'
       and policies.tablename in (
         'affiliate_links',
         'creator_stacks',
         'creator_stack_items'
       )
       and policies.cmd in ('SELECT', 'ALL')
  ),
  'commerce publication tables expose no RLS read policy'
);

select ok(
  not exists (
    select 1
      from pg_catalog.unnest(
        array['public', 'anon', 'authenticated']
      ) as roles(name)
      cross join pg_catalog.unnest(
        array[
          'public.affiliate_links',
          'public.creator_stacks',
          'public.creator_stack_items'
        ]
      ) as relations(name)
     where pg_catalog.has_table_privilege(
       roles.name,
       relations.name,
       'SELECT'
     )
  ),
  'public, anon, and authenticated cannot read commerce publication tables'
);

select ok(
  not exists (
    select 1
      from pg_catalog.unnest(
        array[
          'public.affiliate_links',
          'public.creator_stacks',
          'public.creator_stack_items'
        ]
      ) as relations(name)
      cross join pg_catalog.unnest(
        array[
          'SELECT',
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE',
          'REFERENCES',
          'TRIGGER'
        ]
      ) as privileges(name)
     where pg_catalog.has_table_privilege(
       'service_role',
       relations.name,
       privileges.name
     )
  ),
  'service role has no direct catalog or creator-stack publication authority'
);

select ok(
  not exists (
    select 1
      from pg_catalog.pg_policies as policies
     where policies.schemaname = 'public'
       and policies.tablename = 'commerce_click_events'
       and (
         policies.policyname in (
           'commerce_click_events_insert_own',
           'commerce_click_events_consent_insert'
         )
         or (
           policies.permissive = 'PERMISSIVE'
           and policies.cmd in ('INSERT', 'UPDATE', 'ALL')
         )
       )
  )
    and exists (
      select 1
        from pg_catalog.pg_policies as policies
       where policies.schemaname = 'public'
         and policies.tablename = 'commerce_click_events'
         and policies.policyname = 'commerce_click_events_select_own'
         and policies.cmd = 'SELECT'
    )
    and exists (
      select 1
        from pg_catalog.pg_policies as policies
       where policies.schemaname = 'public'
         and policies.tablename = 'commerce_click_events'
         and policies.policyname = 'commerce_click_events_delete_own'
         and policies.cmd = 'DELETE'
    ),
  'click publication policies are removed while owner read/delete policies remain'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.commerce_click_events',
    'INSERT'
  )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.commerce_click_events',
      'UPDATE'
    )
    and pg_catalog.has_table_privilege(
      'authenticated',
      'public.commerce_click_events',
      'SELECT'
    )
    and pg_catalog.has_table_privilege(
      'authenticated',
      'public.commerce_click_events',
      'DELETE'
    ),
  'authenticated clients retain only owner read and deletion privileges'
);

select ok(
  pg_catalog.has_table_privilege(
    'service_role',
    'public.commerce_click_events',
    'SELECT'
  )
    and pg_catalog.has_table_privilege(
      'service_role',
      'public.commerce_click_events',
      'DELETE'
    )
    and not exists (
      select 1
        from pg_catalog.unnest(
          array['INSERT', 'UPDATE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
        ) as privileges(name)
       where pg_catalog.has_table_privilege(
         'service_role',
         'public.commerce_click_events',
         privileges.name
       )
    )
    and pg_catalog.has_table_privilege(
      'service_role',
      'public.order_attributions',
      'SELECT'
    )
    and pg_catalog.has_table_privilege(
      'service_role',
      'public.order_attributions',
      'DELETE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.order_attributions',
      'INSERT'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.order_attributions',
      'UPDATE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.order_attributions',
      'TRUNCATE'
    )
    and pg_catalog.has_column_privilege(
      'service_role',
      'public.order_attributions',
      'click_token',
      'UPDATE'
    )
    and not pg_catalog.has_column_privilege(
      'service_role',
      'public.order_attributions',
      'commission_cents',
      'UPDATE'
    ),
  'service data-rights deletion and attribution detachment remain available with no publication DML'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as triggers
     where triggers.tgrelid = 'public.commerce_click_events'::regclass
       and triggers.tgname = 'commerce_click_events_admission_closed'
       and not triggers.tgisinternal
       and triggers.tgenabled = 'O'
  )
    and (
      select functions.prosecdef
        and functions.proconfig @> array['search_path=""']::text[]
        from pg_catalog.pg_proc as functions
       where functions.oid =
         'private.guard_commerce_click_publication()'::regprocedure
    )
    and pg_catalog.pg_get_functiondef(
      'private.guard_commerce_click_publication()'::regprocedure
    ) ilike '%COMMERCE_ADMISSION_CLOSED%',
  'a search-path-sealed trigger rejects every click insert or update'
);

select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as triggers
     where triggers.tgrelid = 'public.order_attributions'::regclass
       and triggers.tgname = 'order_attributions_admission_closed'
       and not triggers.tgisinternal
       and triggers.tgenabled = 'O'
  )
    and (
      select functions.prosecdef
        and functions.proconfig @> array['search_path=""']::text[]
        from pg_catalog.pg_proc as functions
       where functions.oid =
         'private.guard_order_attribution_publication()'::regprocedure
    )
    and pg_catalog.pg_get_functiondef(
      'private.guard_order_attribution_publication()'::regprocedure
    ) ilike '%COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED%'
    and pg_catalog.pg_get_functiondef(
      'private.guard_order_attribution_publication()'::regprocedure
    ) ilike '%to_jsonb(new)%click_token%to_jsonb(old)%',
  'a search-path-sealed trigger limits attribution writes to exact legacy token detachment'
);

select throws_ok(
  $$update private.commerce_admission_control
       set established_at = pg_catalog.clock_timestamp()$$,
  '55000',
  'COMMERCE_ADMISSION_CONTROL_MIGRATION_OWNED',
  'even the database owner cannot mutate the closed singleton in place'
);

select throws_ok(
  $$insert into public.commerce_click_events (
      user_id,
      click_token,
      product_type,
      source,
      consented
    ) values (
      '72000000-0000-4000-8000-000000000001',
      'closed-commerce-click',
      'spf',
      'none',
      true
    )$$,
  '55000',
  'COMMERCE_ADMISSION_CLOSED',
  'even a privileged publisher cannot mint a click while commerce is closed'
);

insert into auth.users (id)
values ('72000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

alter table public.commerce_click_events disable trigger user;
insert into public.commerce_click_events (
  id,
  user_id,
  click_token,
  product_type,
  source,
  consented,
  health_processing_epoch,
  data_sharing_generation
) values (
  '72000000-0000-4000-8000-000000000030',
  '72000000-0000-4000-8000-000000000001',
  'legacy-click-token',
  'spf',
  'none',
  true,
  1,
  1
);
alter table public.commerce_click_events enable trigger user;

alter table public.order_attributions disable trigger user;
insert into public.order_attributions (
  id,
  external_order_id,
  click_token,
  order_amount_cents,
  commission_cents,
  currency,
  status
) values (
  '72000000-0000-4000-8000-000000000040',
  'legacy-order-attribution',
  'legacy-click-token',
  1299,
  123,
  'USD',
  'pending'
);
alter table public.order_attributions enable trigger user;

select throws_ok(
  $$insert into public.order_attributions (
      external_order_id,
      click_token,
      order_amount_cents,
      commission_cents,
      currency,
      status
    ) values (
      'closed-order-attribution',
      null,
      1299,
      123,
      'USD',
      'pending'
    )$$,
  '55000',
  'COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED',
  'even a privileged stale poller cannot publish a new order attribution'
);

select throws_ok(
  $$update public.order_attributions
       set commission_cents = 999
     where id = '72000000-0000-4000-8000-000000000040'$$,
  '55000',
  'COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED',
  'even a privileged stale poller cannot update attribution business fields'
);

select throws_ok(
  $$update public.order_attributions
       set click_token = null,
           commission_cents = 999
     where id = '72000000-0000-4000-8000-000000000040'$$,
  '55000',
  'COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED',
  'token detachment cannot camouflage a business-field update'
);

select lives_ok(
  $$update public.order_attributions
       set click_token = null
     where id = '72000000-0000-4000-8000-000000000040'$$,
  'exact installed-base click-token detachment remains available'
);

select is(
  (
    select attribution.click_token
      from public.order_attributions as attribution
     where attribution.id = '72000000-0000-4000-8000-000000000040'
  ),
  null::text,
  'the legacy attribution is detached without changing the retained order row'
);

select lives_ok(
  $$delete from public.order_attributions
      where id = '72000000-0000-4000-8000-000000000040'$$,
  'installed-base attribution deletion remains available'
);

select is(
  (
    select count(*)
      from public.order_attributions as attribution
     where attribution.id = '72000000-0000-4000-8000-000000000040'
  ),
  0::bigint,
  'the installed-base attribution is actually deleted'
);

delete from public.commerce_click_events
 where id = '72000000-0000-4000-8000-000000000030';
delete from auth.users
 where id = '72000000-0000-4000-8000-000000000001';

select ok(
  not pg_catalog.has_table_privilege(
    'anon',
    'public.order_attributions',
    'SELECT'
  )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.order_attributions',
      'SELECT'
    )
    and not exists (
      select 1
        from pg_catalog.pg_policies as policies
       where policies.schemaname = 'public'
         and policies.tablename = 'order_attributions'
    ),
  'commission/order storage remains service-only'
);

select * from finish();
rollback;
