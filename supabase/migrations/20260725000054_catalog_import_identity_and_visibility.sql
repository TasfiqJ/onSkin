-- =============================================================================
-- 0054 · Bind catalog revisions and keep inactive products out of intake
-- =============================================================================
-- A source revision is an immutable identity for one artifact and one importer
-- version. Retired/blocked rows remain available for historical Shelf foreign
-- keys, but new search and barcode intake may expose active products only.
--
-- The index statements are deliberately concurrent. Apply this migration
-- through the repository's non-transactional Supabase CLI db-push path.

do $$
begin
  if exists (
    select 1
    from public.catalog_import_versions
    group by source_id, source_revision
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'CATALOG_IMPORT_REVISION_IDENTITY_CONFLICT',
      hint = 'Reconcile the conflicting historical revisions manually; never merge import identities automatically.';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_index as index_state
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_state.indexrelid
    join pg_catalog.pg_namespace as index_namespace
      on index_namespace.oid = index_relation.relnamespace
    where index_namespace.nspname = 'public'
      and index_relation.relname = 'catalog_import_versions_source_revision_uidx'
      and (not index_state.indisvalid or not index_state.indisready)
  ) then
    raise exception using
      errcode = '55000',
      message = 'CATALOG_IMPORT_REVISION_INVALID_CONCURRENT_INDEX',
      hint = 'Drop only the named INVALID index concurrently, then rerun the unapplied migration.';
  end if;
end;
$$;

create unique index concurrently if not exists catalog_import_versions_source_revision_uidx
  on public.catalog_import_versions (source_id, source_revision);

do $$
declare
  v_definition text;
  v_keys integer;
  v_unique boolean;
begin
  select
    lower(regexp_replace(pg_catalog.pg_get_indexdef(index_state.indexrelid), '[[:space:]]+', ' ', 'g')),
    index_state.indnkeyatts,
    index_state.indisunique
  into v_definition, v_keys, v_unique
  from pg_catalog.pg_index as index_state
  join pg_catalog.pg_class as index_relation
    on index_relation.oid = index_state.indexrelid
  join pg_catalog.pg_namespace as index_namespace
    on index_namespace.oid = index_relation.relnamespace
  where index_namespace.nspname = 'public'
    and index_relation.relname = 'catalog_import_versions_source_revision_uidx'
    and index_state.indisvalid
    and index_state.indisready;

  if v_definition is null
    or v_keys <> 2
    or not v_unique
    or position('(source_id, source_revision)' in v_definition) = 0
  then
    raise exception using
      errcode = '55000',
      message = 'CATALOG_IMPORT_REVISION_INDEX_DEFINITION_MISMATCH',
      hint = 'Inspect and replace only the named revision index concurrently before rerunning the unapplied migration.';
  end if;
end;
$$;

create or replace function public.begin_catalog_import(
  p_source_key text,
  p_source_revision text,
  p_artifact_uri text,
  p_artifact_sha256 text,
  p_importer_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_source_revision text;
  v_importer_version text;
  v_import public.catalog_import_versions%rowtype;
begin
  v_source_revision := trim(p_source_revision);
  v_importer_version := trim(p_importer_version);

  if p_source_revision is null or length(v_source_revision) not between 1 and 160 then
    raise exception 'CATALOG_IMPORT_REVISION_INVALID';
  end if;
  if p_artifact_sha256 is null or p_artifact_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'CATALOG_IMPORT_SHA256_INVALID';
  end if;
  if p_importer_version is null or length(v_importer_version) not between 1 and 80 then
    raise exception 'CATALOG_IMPORTER_VERSION_INVALID';
  end if;

  select id into v_source_id
  from public.catalog_sources
  where source_key = p_source_key;
  if v_source_id is null then raise exception 'CATALOG_IMPORT_SOURCE_UNKNOWN'; end if;

  -- The unique pair is also protected by an advisory lock so competing first
  -- calls cannot race with different artifact identities.
  perform pg_advisory_xact_lock(
    hashtext('catalog-import-begin:' || v_source_id::text || ':' || v_source_revision)
  );

  select * into v_import
  from public.catalog_import_versions
  where source_id = v_source_id
    and source_revision = v_source_revision
  for update;

  if found then
    if v_import.artifact_sha256 <> p_artifact_sha256 then
      raise exception 'CATALOG_IMPORT_REVISION_ARTIFACT_MISMATCH';
    end if;
    if v_import.importer_version <> v_importer_version then
      raise exception 'CATALOG_IMPORT_REVISION_IMPORTER_MISMATCH';
    end if;

    update public.catalog_import_versions
    set artifact_uri = coalesce(nullif(trim(p_artifact_uri), ''), artifact_uri),
        status = case when status = 'failed' then 'running' else status end,
        finished_at = case when status = 'failed' then null else finished_at end
    where id = v_import.id
    returning * into v_import;
  else
    insert into public.catalog_import_versions (
      source_id, source_revision, artifact_uri, artifact_sha256, importer_version
    ) values (
      v_source_id, v_source_revision, nullif(trim(p_artifact_uri), ''),
      p_artifact_sha256, v_importer_version
    )
    returning * into v_import;
  end if;

  return jsonb_build_object(
    'importId', v_import.id,
    'status', v_import.status,
    'checkpointLine', v_import.checkpoint_line,
    'acceptedRecords', v_import.accepted_record_count,
    'rejectedRecords', v_import.rejected_record_count,
    'stagedProducts', v_import.staged_product_count
  );
end;
$$;

revoke all on function public.begin_catalog_import(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.begin_catalog_import(text, text, text, text, text)
  to service_role;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_index as index_state
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_state.indexrelid
    join pg_catalog.pg_namespace as index_namespace
      on index_namespace.oid = index_relation.relnamespace
    where index_namespace.nspname = 'public'
      and index_relation.relname in (
        'products_catalog_active_name_trgm_idx',
        'products_catalog_active_brand_trgm_idx',
        'products_catalog_active_bigram_idx',
        'products_catalog_active_rank_idx'
      )
      and (not index_state.indisvalid or not index_state.indisready)
  ) then
    raise exception using
      errcode = '55000',
      message = 'CATALOG_ACTIVE_SEARCH_INVALID_CONCURRENT_INDEX',
      hint = 'Drop only the named INVALID active catalog index concurrently, then rerun the unapplied migration.';
  end if;
end;
$$;

create index concurrently if not exists products_catalog_active_name_trgm_idx
  on public.products using gin (lower(name) extensions.gin_trgm_ops)
  where status = 'active';

create index concurrently if not exists products_catalog_active_brand_trgm_idx
  on public.products using gin (lower(coalesce(brand, '')) extensions.gin_trgm_ops)
  where status = 'active';

create index concurrently if not exists products_catalog_active_bigram_idx
  on public.products using gin ((
    public.catalog_search_bigram_tokens(name) ||
    public.catalog_search_bigram_tokens(coalesce(brand, ''))
  ))
  where status = 'active';

create index concurrently if not exists products_catalog_active_rank_idx
  on public.products (
    data_quality_score desc,
    lower(name),
    id
  )
  where status = 'active';

do $$
declare
  v_index record;
  v_index_count integer := 0;
begin
  for v_index in
    select
      index_relation.relname as name,
      access_method.amname as access_method,
      index_state.indnkeyatts as key_count,
      index_state.indisunique as is_unique,
      lower(
        regexp_replace(
          pg_catalog.pg_get_indexdef(index_state.indexrelid),
          '[[:space:]]+',
          ' ',
          'g'
        )
      ) as definition
    from pg_catalog.pg_index as index_state
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_state.indexrelid
    join pg_catalog.pg_namespace as index_namespace
      on index_namespace.oid = index_relation.relnamespace
    join pg_catalog.pg_am as access_method
      on access_method.oid = index_relation.relam
    where index_namespace.nspname = 'public'
      and index_relation.relname in (
        'products_catalog_active_name_trgm_idx',
        'products_catalog_active_brand_trgm_idx',
        'products_catalog_active_bigram_idx',
        'products_catalog_active_rank_idx'
      )
      and index_state.indisvalid
      and index_state.indisready
  loop
    v_index_count := v_index_count + 1;
    if v_index.is_unique
      or position('where (status = ''active''::text)' in v_index.definition) = 0
    then
      raise exception 'CATALOG_ACTIVE_SEARCH_INDEX_DEFINITION_MISMATCH';
    end if;

    case v_index.name
      when 'products_catalog_active_name_trgm_idx' then
        if v_index.access_method <> 'gin'
          or v_index.key_count <> 1
          or position('lower(name) extensions.gin_trgm_ops' in v_index.definition) = 0
        then
          raise exception 'CATALOG_ACTIVE_SEARCH_INDEX_DEFINITION_MISMATCH';
        end if;
      when 'products_catalog_active_brand_trgm_idx' then
        if v_index.access_method <> 'gin'
          or v_index.key_count <> 1
          or position('lower(coalesce(brand' in v_index.definition) = 0
          or position('extensions.gin_trgm_ops' in v_index.definition) = 0
        then
          raise exception 'CATALOG_ACTIVE_SEARCH_INDEX_DEFINITION_MISMATCH';
        end if;
      when 'products_catalog_active_bigram_idx' then
        if v_index.access_method <> 'gin'
          or v_index.key_count <> 1
          or position('catalog_search_bigram_tokens(name)' in v_index.definition) = 0
          or position('catalog_search_bigram_tokens(coalesce(brand' in v_index.definition) = 0
        then
          raise exception 'CATALOG_ACTIVE_SEARCH_INDEX_DEFINITION_MISMATCH';
        end if;
      when 'products_catalog_active_rank_idx' then
        if v_index.access_method <> 'btree'
          or v_index.key_count <> 3
          or position(
            '(data_quality_score desc, lower(name), id)'
            in v_index.definition
          ) = 0
        then
          raise exception 'CATALOG_ACTIVE_SEARCH_INDEX_DEFINITION_MISMATCH';
        end if;
      else
        raise exception 'CATALOG_ACTIVE_SEARCH_INDEX_DEFINITION_MISMATCH';
    end case;
  end loop;

  if v_index_count <> 4 then
    raise exception 'CATALOG_ACTIVE_SEARCH_INDEX_SET_INCOMPLETE';
  end if;
end;
$$;

do $$
declare
  v_definition text;
  v_replacement text;
  v_old_predicate_count integer;
  v_active_predicate_count integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.search_catalog_products(text,integer)'::regprocedure
  ) into v_definition;

  v_old_predicate_count :=
    (length(v_definition) - length(replace(v_definition, 'status <> ''blocked''', '')))
    / length('status <> ''blocked''');
  v_active_predicate_count :=
    (length(v_definition) - length(replace(v_definition, 'status = ''active''', '')))
    / length('status = ''active''');

  if v_old_predicate_count = 3 and v_active_predicate_count = 0 then
    v_replacement := replace(
      v_definition,
      'status <> ''blocked''',
      'status = ''active'''
    );
    execute v_replacement;
  elsif v_old_predicate_count = 0 and v_active_predicate_count = 3 then
    null;
  else
    raise exception using
      errcode = '55000',
      message = 'CATALOG_SEARCH_FUNCTION_DEFINITION_UNEXPECTED',
      hint = 'Inspect the latest search function before changing its visibility predicate.';
  end if;
end;
$$;

comment on function public.search_catalog_products(text, integer) is
  'Service-only indexed active-product substring search for authenticated catalog intake.';

drop index concurrently if exists public.products_catalog_name_trgm_idx;
drop index concurrently if exists public.products_catalog_brand_trgm_idx;
drop index concurrently if exists public.products_catalog_bigram_idx;
drop index concurrently if exists public.products_catalog_rank_idx;
