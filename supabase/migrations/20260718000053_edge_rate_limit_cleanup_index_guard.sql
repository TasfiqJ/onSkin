-- Reject a same-named but incompatible cleanup index. Migration 40 uses
-- IF NOT EXISTS, so name presence alone is not sufficient deployment proof.

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
    and index_relation.relname = 'edge_rate_limits_window_start_idx'
    and table_namespace.nspname = 'public'
    and table_relation.relname = 'edge_rate_limits';

  if not found or v_definition_matches is not true then
    raise exception
      'edge_rate_limits_window_start_idx is missing or does not exactly index public.edge_rate_limits(window_start)';
  end if;
end
$$;
