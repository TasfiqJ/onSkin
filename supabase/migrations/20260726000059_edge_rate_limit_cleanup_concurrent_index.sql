-- Replace the historical blocking-built cleanup index with an equivalent index
-- created and removed through PostgreSQL's concurrent deployment path.
--
-- CREATE/DROP INDEX CONCURRENTLY must remain top-level statements. Do not wrap
-- this migration in an explicit transaction.

do $$
declare
  v_valid boolean;
  v_ready boolean;
begin
  select indexes.indisvalid, indexes.indisready
  into v_valid, v_ready
  from pg_catalog.pg_class as index_relation
  join pg_catalog.pg_namespace as index_namespace
    on index_namespace.oid = index_relation.relnamespace
  join pg_catalog.pg_index as indexes
    on indexes.indexrelid = index_relation.oid
  where index_namespace.nspname = 'public'
    and index_relation.relname = 'edge_rate_limits_window_start_concurrent_idx';

  if found and (v_valid is not true or v_ready is not true) then
    raise exception using
      errcode = '55000',
      message = 'edge_rate_limits_cleanup_index_invalid_or_unready',
      detail = 'public.edge_rate_limits_window_start_concurrent_idx is invalid or not ready',
      hint = 'Run DROP INDEX CONCURRENTLY IF EXISTS public.edge_rate_limits_window_start_concurrent_idx; then retry migration 20260726000059.';
  end if;
end
$$;

create index concurrently if not exists edge_rate_limits_window_start_concurrent_idx
  on public.edge_rate_limits using btree (window_start);

do $$
declare
  v_definition_matches boolean;
begin
  select
    indexes.indisvalid
    and indexes.indisready
    and not indexes.indisunique
    and access_method.amname = 'btree'
    and indexes.indnkeyatts = 1
    and indexes.indnatts = 1
    and indexes.indpred is null
    and indexes.indexprs is null
    and indexes.indkey[0] = window_start.attnum
  into v_definition_matches
  from pg_catalog.pg_class as index_relation
  join pg_catalog.pg_namespace as index_namespace
    on index_namespace.oid = index_relation.relnamespace
  join pg_catalog.pg_index as indexes
    on indexes.indexrelid = index_relation.oid
  join pg_catalog.pg_class as table_relation
    on table_relation.oid = indexes.indrelid
  join pg_catalog.pg_namespace as table_namespace
    on table_namespace.oid = table_relation.relnamespace
  join pg_catalog.pg_am as access_method
    on access_method.oid = index_relation.relam
  join pg_catalog.pg_attribute as window_start
    on window_start.attrelid = table_relation.oid
   and window_start.attname = 'window_start'
   and not window_start.attisdropped
  where index_namespace.nspname = 'public'
    and index_relation.relname = 'edge_rate_limits_window_start_concurrent_idx'
    and table_namespace.nspname = 'public'
    and table_relation.relname = 'edge_rate_limits';

  if not found or v_definition_matches is not true then
    raise exception using
      errcode = '55000',
      message = 'edge_rate_limits_cleanup_index_definition_mismatch',
      detail = 'public.edge_rate_limits_window_start_concurrent_idx must be a valid ready nonunique nonpartial nonexpression B-tree whose sole key is public.edge_rate_limits(window_start)',
      hint = 'Run DROP INDEX CONCURRENTLY IF EXISTS public.edge_rate_limits_window_start_concurrent_idx; then retry migration 20260726000059.';
  end if;
end
$$;

drop index concurrently if exists public.edge_rate_limits_window_start_idx;
