begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

-- Forward-only 0071 -> 0072 rehearsal. The local verifier withholds 0072,
-- resets through 0071, installs representative legacy commerce publication
-- state, and replaces the marker with the exact checked-in migration bytes.
select plan(21);

insert into auth.users (id)
values ('72000000-0000-4000-8000-000000000001');

insert into public.affiliate_links (
  id,
  product_type,
  retailer,
  label,
  url,
  source,
  is_active
) values (
  '72000000-0000-4000-8000-000000000010',
  'spf',
  'Legacy retailer',
  'Legacy paid-link row',
  'https://retailer.invalid/product',
  'none',
  true
);

insert into public.creator_stacks (
  id,
  slug,
  title,
  curator,
  curator_kind,
  reviewed_by,
  is_active
) values (
  '72000000-0000-4000-8000-000000000020',
  'legacy-commerce-stack',
  'Legacy commerce stack',
  'Legacy editorial',
  'editorial',
  null,
  true
);

insert into public.creator_stack_items (
  id,
  stack_id,
  position,
  product_type,
  role_label
) values (
  '72000000-0000-4000-8000-000000000021',
  '72000000-0000-4000-8000-000000000020',
  1,
  'spf',
  'Protect'
);

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

select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20260726000071'::text,
  'the upgrade fixture starts on exact migration 0071'
);

select ok(
  pg_catalog.has_table_privilege(
    'authenticated',
    'public.affiliate_links',
    'SELECT'
  ),
  '0071 can still expose active affiliate rows to authenticated clients'
);

select ok(
  pg_catalog.has_table_privilege(
    'authenticated',
    'public.commerce_click_events',
    'INSERT'
  ),
  '0071 can still grant authenticated click insertion'
);

-- @@INCLUDE_EXACT_0072_MIGRATION@@

select is(
  (
    select admission_state
      from private.commerce_admission_control
     where singleton
  ),
  'closed'::text,
  '0072 installs exactly one closed commerce admission control'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'checkpoint', control.checkpoint,
      'reasonCode', control.reason_code
    )
      from private.commerce_admission_control as control
     where control.singleton
  ),
  '{"checkpoint":"com01a_zero_admission","reasonCode":"approved_rail_not_admitted"}'::jsonb,
  'the control records only the exact COM-01A refusal'
);

select is(
  (
    select count(*)
      from public.affiliate_links
     where id = '72000000-0000-4000-8000-000000000010'
  ),
  1::bigint,
  '0072 retains the legacy affiliate row without publishing it'
);

select is(
  (
    select count(*)
      from public.creator_stacks
     where id = '72000000-0000-4000-8000-000000000020'
  ),
  1::bigint,
  '0072 retains legacy stack source for future review'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.affiliate_links',
    'SELECT'
  )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.creator_stacks',
      'SELECT'
    )
    and not pg_catalog.has_table_privilege(
      'authenticated',
      'public.creator_stack_items',
      'SELECT'
    ),
  '0072 revokes every authenticated commerce publication read'
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
      'DELETE'
    ),
  '0072 removes click publication while retaining owner deletion'
);

select throws_ok(
  $$insert into public.commerce_click_events (
      user_id,
      click_token,
      source,
      consented
    ) values (
      '72000000-0000-4000-8000-000000000001',
      'post-upgrade-click-token',
      'none',
      true
    )$$,
  '55000',
  'COMMERCE_ADMISSION_CLOSED',
  'the database owner cannot bypass the post-upgrade click guard'
);

select throws_ok(
  $$insert into public.order_attributions (
      external_order_id,
      click_token,
      order_amount_cents,
      commission_cents,
      currency,
      status
    ) values (
      'post-upgrade-order-attribution',
      null,
      1299,
      123,
      'USD',
      'pending'
    )$$,
  '55000',
  'COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED',
  'the database owner cannot bypass the post-upgrade attribution insert guard'
);

select throws_ok(
  $$update public.order_attributions
       set commission_cents = 999
     where id = '72000000-0000-4000-8000-000000000040'$$,
  '55000',
  'COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED',
  'the database owner cannot bypass the post-upgrade attribution business-update guard'
);

select throws_ok(
  $$update public.order_attributions
       set click_token = null,
           commission_cents = 999
     where id = '72000000-0000-4000-8000-000000000040'$$,
  '55000',
  'COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED',
  'the post-upgrade cleanup transition cannot camouflage a business update'
);

select lives_ok(
  $$update public.order_attributions
       set click_token = null
     where id = '72000000-0000-4000-8000-000000000040'$$,
  '0072 preserves exact installed-base attribution detachment'
);

select is(
  (
    select attribution.click_token
      from public.order_attributions as attribution
     where attribution.id = '72000000-0000-4000-8000-000000000040'
  ),
  null::text,
  '0072 detaches the legacy token without deleting the retained order'
);

select lives_ok(
  $$delete from public.order_attributions
      where id = '72000000-0000-4000-8000-000000000040'$$,
  '0072 preserves installed-base attribution deletion'
);

select is(
  (
    select count(*)
      from public.order_attributions as attribution
     where attribution.id = '72000000-0000-4000-8000-000000000040'
  ),
  0::bigint,
  '0072 actually removes the installed-base attribution'
);

select lives_ok(
  $$delete from public.commerce_click_events
      where id = '72000000-0000-4000-8000-000000000030'$$,
  '0072 preserves deletion of an installed-base click'
);

select is(
  (
    select count(*)
      from public.commerce_click_events
     where id = '72000000-0000-4000-8000-000000000030'
  ),
  0::bigint,
  'the installed-base click is actually removed'
);

select ok(
  pg_catalog.has_table_privilege(
    'service_role',
    'public.affiliate_links',
    'SELECT'
  )
    and pg_catalog.has_table_privilege(
      'service_role',
      'public.commerce_click_events',
      'DELETE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.order_attributions',
      'UPDATE'
    )
    and not pg_catalog.has_table_privilege(
      'service_role',
      'public.order_attributions',
      'INSERT'
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
  'service migration inspection and exact data-rights cleanup remain available without publication DML'
);

select ok(
  not exists (
    select 1
      from pg_catalog.pg_policies as policies
     where policies.schemaname = 'public'
       and (
         (
           policies.tablename in (
             'affiliate_links',
             'creator_stacks',
             'creator_stack_items'
           )
           and policies.cmd in ('SELECT', 'ALL')
         )
         or (
           policies.tablename = 'commerce_click_events'
           and policies.permissive = 'PERMISSIVE'
           and policies.cmd in ('INSERT', 'UPDATE', 'ALL')
         )
       )
  ),
  '0072 leaves no permissive commerce publication policy'
);

select * from finish();
rollback;
