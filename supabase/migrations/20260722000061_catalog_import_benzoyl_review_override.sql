begin;

-- Forward-only CAT-02 storage compatibility correction. The offline v2 stage
-- builder is responsible for validating both independent signatures, retained
-- category evidence, and the post-override candidate digest before service-role
-- staging. This RPC admits the resulting benzoyl_peroxide category value but
-- grants no review, regulatory, recommendation, or CAT-03 serving authority.
create or replace function public.stage_catalog_import_chunk(
  p_batch_id uuid,
  p_operation_key text,
  p_chunk_ordinal integer,
  p_first_record_ordinal integer,
  p_records jsonb
)
returns table (
  batch_id uuid,
  chunk_ordinal integer,
  staged_record_count integer,
  chunk_sha256 text,
  record_receipts jsonb,
  replayed boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_source_key text;
  v_request_sha256 text;
  v_receipt private.catalog_import_chunk_receipts%rowtype;
  v_record jsonb;
  v_normalized jsonb;
  v_kind text;
  v_natural_key text;
  v_record_sha256 text;
  v_record_count integer;
  v_existing_chunk_count integer;
  v_synonyms jsonb;
  v_chunk_sha256 text;
  v_record_receipts jsonb;
  v_canonical_records text;
  v_index integer := 0;
begin
  if p_batch_id is null
     or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_chunk_ordinal is null or p_chunk_ordinal < 1
     or p_first_record_ordinal is null or p_first_record_ordinal < 1
     or pg_catalog.jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'CATALOG_IMPORT_CHUNK_INPUT_INVALID' using errcode = '22023';
  end if;

  v_canonical_records := private.catalog_import_canonical_json(p_records);
  if pg_catalog.octet_length(v_canonical_records) > 8388608 then
    raise exception 'CATALOG_IMPORT_CHUNK_INPUT_INVALID' using errcode = '22023';
  end if;

  v_record_count := pg_catalog.jsonb_array_length(p_records);
  if v_record_count not between 1 and 500 then
    raise exception 'CATALOG_IMPORT_CHUNK_SIZE_INVALID' using errcode = '22023';
  end if;
  v_chunk_sha256 := private.catalog_import_sha256_text(p_records::text);
  v_request_sha256 := private.catalog_import_sha256_text(
    pg_catalog.jsonb_build_object(
      'batchId', p_batch_id,
      'operationKey', p_operation_key,
      'chunkOrdinal', p_chunk_ordinal,
      'firstRecordOrdinal', p_first_record_ordinal,
      'records', p_records
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-batch:' || p_batch_id::text, 0)
  );
  select batches.* into v_batch
    from public.catalog_import_batches as batches
   where batches.id = p_batch_id
   for update;
  if not found then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_FOUND' using errcode = '22023';
  end if;

  select receipts.* into v_receipt
    from private.catalog_import_chunk_receipts as receipts
   where (receipts.batch_id = p_batch_id
       and receipts.chunk_ordinal = p_chunk_ordinal)
      or receipts.operation_key = p_operation_key
   for update;
  if found then
    if v_receipt.batch_id <> p_batch_id
       or v_receipt.chunk_ordinal <> p_chunk_ordinal
       or v_receipt.operation_key <> p_operation_key
       or v_receipt.request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_IMPORT_CHUNK_REPLAY_CHANGED' using errcode = '22023';
    end if;
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'recordOrdinal', records.record_ordinal,
      'recordSha256', records.record_sha256,
      'recordKind', records.record_kind,
      'canonicalKey', records.natural_key,
      'sourcePayload', records.source_payload,
      'normalizedPayload', records.normalized_payload,
      'disposition', 'pending'
    ) order by records.record_ordinal) into v_record_receipts
    from private.catalog_import_staged_records as records
    where records.batch_id = p_batch_id
      and records.record_ordinal between v_receipt.first_record_ordinal
        and v_receipt.first_record_ordinal + v_receipt.record_count - 1;
    return query
      select p_batch_id, p_chunk_ordinal,
        v_receipt.first_record_ordinal + v_receipt.record_count - 1,
        v_receipt.chunk_sha256, v_record_receipts, true;
    return;
  end if;

  if v_batch.status <> 'running'
     or v_batch.artifact_kind <> 'production'
     or v_batch.territory <> 'US'
     or v_batch.qa_blocker_count <> 0
     or v_batch.qa_warning_count <> 0 then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_STAGEABLE' using errcode = '55000';
  end if;
  select count(*)::integer into v_existing_chunk_count
    from private.catalog_import_chunk_receipts as receipts
   where receipts.batch_id = p_batch_id;
  if p_chunk_ordinal <> v_existing_chunk_count + 1
     or p_first_record_ordinal <> v_batch.staged_record_count + 1
     or v_batch.staged_record_count + v_record_count > v_batch.expected_record_count then
    raise exception 'CATALOG_IMPORT_CHUNK_SEQUENCE_INVALID' using errcode = '22023';
  end if;

  select sources.source_key into v_source_key
    from public.catalog_sources as sources
   where sources.id = v_batch.source_id;

  for v_record in
    select records.value from pg_catalog.jsonb_array_elements(p_records) as records(value)
  loop
    v_index := v_index + 1;
    if pg_catalog.jsonb_typeof(v_record) is distinct from 'object' then
      raise exception 'CATALOG_IMPORT_RECORD_INVALID' using errcode = '22023';
    end if;
    perform private.catalog_import_canonical_json(v_record);
    v_kind := v_record ->> 'recordKind';

    if v_kind = 'product' then
      if v_source_key <> 'open_beauty_facts'
         or v_batch.batch_type <> 'obf_export'
         or (select count(*) from pg_catalog.jsonb_object_keys(v_record)) <> 17
         or not (v_record ?& array[
           'recordKind', 'canonicalKey', 'barcode', 'name', 'brand', 'category',
           'ingredientsText', 'source', 'sourceComponentId', 'sourceRef',
           'sourceUrl', 'sourceRecordModifiedDate', 'sourceArtifactSha256',
           'qualityGrade', 'reviewStatus', 'sourceSnapshotDate', 'region'
         ])
         or exists (
           select 1 from pg_catalog.jsonb_each(v_record) as fields(key, value)
           where fields.key = any(array[
             'recordKind', 'canonicalKey', 'barcode', 'name', 'source',
             'sourceComponentId', 'sourceRef', 'sourceUrl',
             'sourceRecordModifiedDate', 'sourceArtifactSha256',
             'qualityGrade', 'reviewStatus', 'sourceSnapshotDate', 'region'
           ])
             and pg_catalog.jsonb_typeof(fields.value) is distinct from 'string'
         )
         or exists (
           select 1 from pg_catalog.jsonb_each(v_record) as fields(key, value)
           where fields.key = any(array['brand', 'category', 'ingredientsText'])
             and pg_catalog.jsonb_typeof(fields.value) not in ('string', 'null')
         )
         or v_record ->> 'source' is distinct from v_source_key
         or v_record ->> 'sourceComponentId' is distinct from 'obf_odbl_component'
         or v_record ->> 'sourceArtifactSha256' is distinct from v_batch.artifact_sha256
         or v_record ->> 'sourceSnapshotDate' is distinct from v_batch.snapshot_date::text
         or v_record ->> 'region' is distinct from 'US'
         or v_record ->> 'barcode' !~ '^[0-9]{8,14}$'
         or v_record ->> 'canonicalKey' is distinct from v_record ->> 'barcode'
         or v_record ->> 'sourceRef' is distinct from v_record ->> 'barcode'
         or not private.catalog_import_text_is_bounded(v_record ->> 'name', 200)
         or (v_record ->> 'brand' is not null
           and not private.catalog_import_text_is_bounded(v_record ->> 'brand', 300))
         or (v_record ->> 'category' is not null
           and not private.catalog_import_text_is_bounded(v_record ->> 'category', 100))
         or (v_record ->> 'category' is not null
           and v_record ->> 'category' not in (
             'benzoyl_peroxide', 'cleanser', 'toner', 'serum',
             'moisturiser_tube', 'spf'
           ))
         or (v_record ->> 'ingredientsText' is not null
           and not private.catalog_import_text_is_bounded(v_record ->> 'ingredientsText', 20000))
         or nullif(pg_catalog.btrim(v_record ->> 'sourceRef'), '') is null
         or pg_catalog.length(pg_catalog.btrim(v_record ->> 'sourceRef')) > 14
         or v_record ->> 'sourceUrl' is distinct from
           'https://world.openbeautyfacts.org/product/' || (v_record ->> 'barcode')
         or pg_catalog.length(v_record ->> 'sourceUrl') > 2000
         or not private.catalog_import_date_is_valid(
           v_record ->> 'sourceRecordModifiedDate', v_batch.snapshot_date
         )
         or v_record ->> 'qualityGrade' not in ('limited', 'unverified')
         or v_record ->> 'reviewStatus' is distinct from 'unreviewed'
         or pg_catalog.length(coalesce(v_record ->> 'ingredientsText', '')) > 20000 then
        raise exception 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID' using errcode = '22023';
      end if;
      v_natural_key := v_record ->> 'barcode';
      v_normalized := pg_catalog.jsonb_build_object(
        'recordKind', 'product',
        'canonicalKey', v_natural_key,
        'barcode', v_natural_key,
        'name', pg_catalog.btrim(v_record ->> 'name'),
        'brand', nullif(pg_catalog.btrim(v_record ->> 'brand'), ''),
        -- Category is a frozen ASCII enum emitted by the approved transformer;
        -- retaining it verbatim avoids any ICU lower-case version dependency.
        'category', v_record -> 'category',
        'ingredientsText', nullif(pg_catalog.btrim(v_record ->> 'ingredientsText'), ''),
        'source', v_source_key,
        'sourceRef', pg_catalog.btrim(v_record ->> 'sourceRef'),
        'sourceUrl', pg_catalog.btrim(v_record ->> 'sourceUrl'),
        'sourceRecordModifiedDate', v_record ->> 'sourceRecordModifiedDate',
        'sourceArtifactSha256', v_batch.artifact_sha256,
        'sourceSnapshotDate', v_batch.snapshot_date::text,
        'region', 'US',
        'qualityGrade', v_record ->> 'qualityGrade',
        'reviewStatus', v_record ->> 'reviewStatus'
      );
    elsif v_kind = 'ingredient' then
      if v_source_key <> 'cosing'
         or v_batch.batch_type <> 'cosing_dictionary'
         or (select count(*) from pg_catalog.jsonb_object_keys(v_record)) <> 17
         or not (v_record ?& array[
           'recordKind', 'canonicalKey', 'inciName', 'displayName', 'casNumber', 'ecNumber',
           'annexStatus', 'sourceRef', 'sourceRecordStatus',
           'glossaryDecision', 'source', 'sourceComponentId', 'sourceUrl',
           'sourceArtifactSha256', 'reviewStatus', 'synonyms',
           'sourceSnapshotDate'
         ])
         or exists (
           select 1 from pg_catalog.jsonb_each(v_record) as fields(key, value)
           where fields.key = any(array[
             'recordKind', 'canonicalKey', 'inciName', 'displayName',
             'sourceRef', 'sourceRecordStatus', 'glossaryDecision', 'source',
             'sourceComponentId', 'sourceUrl', 'sourceArtifactSha256',
             'reviewStatus', 'sourceSnapshotDate'
           ])
             and pg_catalog.jsonb_typeof(fields.value) is distinct from 'string'
         )
         or exists (
           select 1 from pg_catalog.jsonb_each(v_record) as fields(key, value)
           where fields.key = any(array['casNumber', 'ecNumber', 'annexStatus'])
             and pg_catalog.jsonb_typeof(fields.value) not in ('string', 'null')
         )
         or v_record ->> 'source' is distinct from v_source_key
         or v_record ->> 'sourceComponentId' is distinct from 'cosing_reference_component'
         or v_record ->> 'sourceArtifactSha256' is distinct from v_batch.artifact_sha256
         or v_record ->> 'sourceSnapshotDate' is distinct from v_batch.snapshot_date::text
         or not private.catalog_import_text_is_bounded(v_record ->> 'inciName', 300)
         or not private.catalog_import_text_is_bounded(v_record ->> 'displayName', 300)
         or v_record ->> 'canonicalKey' is distinct from
           private.catalog_import_normalize_key(v_record ->> 'inciName')
         or nullif(pg_catalog.btrim(v_record ->> 'sourceRef'), '') is null
         or pg_catalog.length(pg_catalog.btrim(v_record ->> 'sourceRef')) > 500
         or v_record ->> 'sourceRef' !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
         or (v_record ->> 'casNumber' is not null
           and v_record ->> 'casNumber' !~ '^[0-9]{2,7}-[0-9]{2}-[0-9]$')
         or (v_record ->> 'ecNumber' is not null
           and v_record ->> 'ecNumber' !~ '^[0-9]{3}-[0-9]{3}-[0-9]$')
         or (pg_catalog.jsonb_typeof(v_record -> 'annexStatus') = 'string'
           and not private.catalog_import_text_is_bounded(v_record ->> 'annexStatus', 500))
         or not private.catalog_import_text_is_bounded(v_record ->> 'sourceUrl', 2000)
         or v_record ->> 'sourceUrl' !~ '^https://([A-Za-z0-9-]+[.])*((ec[.]europa[.]eu)|(europa[.]eu))/[^[:space:]]+$'
         or pg_catalog.length(v_record ->> 'sourceUrl') > 2000
         or v_record ->> 'sourceRecordStatus' is distinct from 'active'
         or v_record ->> 'glossaryDecision' is distinct from 'EU_2025_1175'
         or v_record ->> 'reviewStatus' is distinct from 'unreviewed'
         or pg_catalog.jsonb_typeof(v_record -> 'synonyms') is distinct from 'array'
         or exists (
           select 1 from pg_catalog.jsonb_array_elements(v_record -> 'synonyms') as synonyms(value)
           where pg_catalog.jsonb_typeof(synonyms.value) is distinct from 'string'
         )
         or pg_catalog.length(coalesce(v_record ->> 'annexStatus', '')) > 500 then
        raise exception 'CATALOG_IMPORT_INGREDIENT_RECORD_INVALID' using errcode = '22023';
      end if;
      v_natural_key := private.catalog_import_normalize_key(v_record ->> 'inciName');
      if exists (
           select 1 from pg_catalog.jsonb_array_elements_text(v_record -> 'synonyms') as items(value)
           where not private.catalog_import_text_is_bounded(items.value, 300)
             or nullif(private.catalog_import_normalize_key(items.value), '') is null
             or private.catalog_import_normalize_key(items.value) = v_natural_key
         )
         or (
           select count(*) from pg_catalog.jsonb_array_elements_text(v_record -> 'synonyms')
         ) <> (
           select count(distinct private.catalog_import_normalize_key(items.value))
           from pg_catalog.jsonb_array_elements_text(v_record -> 'synonyms') as items(value)
         ) then
        raise exception 'CATALOG_IMPORT_INGREDIENT_SYNONYMS_INVALID' using errcode = '22023';
      end if;
      select coalesce(pg_catalog.jsonb_agg(
        synonyms.value order by synonyms.value collate pg_catalog."C"
      ), '[]'::jsonb)
        into v_synonyms
        from (
          select private.catalog_import_normalize_key(items.value) as value
          from pg_catalog.jsonb_array_elements_text(
            v_record -> 'synonyms'
          ) as items(value)
        ) as synonyms;
      if pg_catalog.jsonb_array_length(v_synonyms) > 50 then
        raise exception 'CATALOG_IMPORT_INGREDIENT_SYNONYMS_INVALID' using errcode = '22023';
      end if;
      v_normalized := pg_catalog.jsonb_build_object(
        'recordKind', 'ingredient',
        'canonicalKey', v_natural_key,
        'inciName', pg_catalog.btrim(v_record ->> 'inciName'),
        'normalizedInciName', v_natural_key,
        'displayName', nullif(pg_catalog.btrim(v_record ->> 'displayName'), ''),
        'casNumber', nullif(pg_catalog.btrim(v_record ->> 'casNumber'), ''),
        'ecNumber', nullif(pg_catalog.btrim(v_record ->> 'ecNumber'), ''),
        'annexStatus', nullif(pg_catalog.btrim(v_record ->> 'annexStatus'), ''),
        'source', v_source_key,
        'sourceRef', pg_catalog.btrim(v_record ->> 'sourceRef'),
        'sourceUrl', pg_catalog.btrim(v_record ->> 'sourceUrl'),
        'sourceRecordStatus', v_record ->> 'sourceRecordStatus',
        'glossaryDecision', v_record ->> 'glossaryDecision',
        'sourceArtifactSha256', v_batch.artifact_sha256,
        'sourceSnapshotDate', v_batch.snapshot_date::text,
        'reviewStatus', v_record ->> 'reviewStatus',
        'synonyms', v_synonyms
      );
    else
      raise exception 'CATALOG_IMPORT_RECORD_KIND_INVALID' using errcode = '22023';
    end if;

    -- Explicit migration-0057 SQL/JavaScript receipt contract: SHA-256 over
    -- UTF-8 recursive canonical JSON of the exact normalized payload. The
    -- offline completion tool independently derives and checks these bytes.
    v_record_sha256 := private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(v_normalized)
    );
    insert into private.catalog_import_staged_records (
      batch_id, record_ordinal, record_kind, natural_key, source_payload,
      normalized_payload, record_sha256
    ) values (
      p_batch_id, p_first_record_ordinal + v_index - 1, v_kind,
      v_natural_key, v_record, v_normalized, v_record_sha256
    );
  end loop;

  insert into private.catalog_import_chunk_receipts (
    batch_id, operation_key, request_sha256, chunk_ordinal,
    first_record_ordinal, record_count, chunk_sha256
  ) values (
    p_batch_id, p_operation_key, v_request_sha256, p_chunk_ordinal,
    p_first_record_ordinal, v_record_count, v_chunk_sha256
  );
  update public.catalog_import_batches as batches
     set staged_record_count = batches.staged_record_count + v_record_count
   where batches.id = p_batch_id;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'recordOrdinal', records.record_ordinal,
    'recordSha256', records.record_sha256,
    'recordKind', records.record_kind,
    'canonicalKey', records.natural_key,
    'sourcePayload', records.source_payload,
    'normalizedPayload', records.normalized_payload,
    'disposition', 'pending'
  ) order by records.record_ordinal) into v_record_receipts
  from private.catalog_import_staged_records as records
  where records.batch_id = p_batch_id
    and records.record_ordinal between p_first_record_ordinal
      and p_first_record_ordinal + v_record_count - 1;

  return query
    select p_batch_id, p_chunk_ordinal,
      v_batch.staged_record_count + v_record_count, v_chunk_sha256,
      v_record_receipts, false;
end;
$$;

comment on function public.stage_catalog_import_chunk(uuid, text, integer, integer, jsonb)
  is 'Service-only contiguous deterministic catalog staging with exact chunk replay.';
revoke all on function public.stage_catalog_import_chunk(uuid, text, integer, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.stage_catalog_import_chunk(uuid, text, integer, integer, jsonb)
  to service_role;

-- Converge upgraded databases with clean installs: migration 0060 could create
-- this shared trigger function but its user_products branch referenced columns
-- that do not exist on every table using the trigger. JSON projection keeps the
-- narrowly-scoped parent-detach exception table-safe without weakening the
-- owner/epoch guard.
create or replace function public._guard_direct_health_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_owner uuid;
  v_old_owner uuid;
begin
  if tg_table_schema = 'public'
     and tg_table_name = 'community_reports'
     and tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and nullif(pg_catalog.to_jsonb(old) ->> 'question_id', '') is not null
     and nullif(pg_catalog.to_jsonb(new) ->> 'question_id', '') is null
     and (pg_catalog.to_jsonb(old) - 'question_id')
       = (pg_catalog.to_jsonb(new) - 'question_id') then
    return new;
  end if;

  if tg_table_schema = 'public'
     and tg_table_name = 'catalog_corrections'
     and tg_name = 'trg_catalog_corrections_health_write'
     and tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and pg_catalog.array_length(tg_argv, 1) = 1
     and tg_argv[0] = 'user_id'
     and nullif(pg_catalog.to_jsonb(old) ->> 'product_id', '') is not null
     and nullif(pg_catalog.to_jsonb(new) ->> 'product_id', '') is null
     and (pg_catalog.to_jsonb(old) - 'product_id')
       = (pg_catalog.to_jsonb(new) - 'product_id')
     and not exists (
       select 1
       from public.products as parent_product
       where parent_product.id = (
         nullif(pg_catalog.to_jsonb(old) ->> 'product_id', '')
       )::uuid
     ) then
    return new;
  end if;

  if tg_table_schema = 'public'
     and tg_table_name = 'user_products'
     and tg_name = 'trg_user_products_health_write'
     and tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and pg_catalog.array_length(tg_argv, 1) = 1
     and tg_argv[0] = 'user_id'
     and (
       (
         nullif(pg_catalog.to_jsonb(old) ->> 'catalog_product_id', '') is not null
         and nullif(pg_catalog.to_jsonb(new) ->> 'catalog_product_id', '') is null
         and nullif(pg_catalog.to_jsonb(new) ->> 'catalog_source_id', '')
           is not distinct from nullif(
             pg_catalog.to_jsonb(old) ->> 'catalog_source_id',
             ''
           )
         and not exists (
           select 1 from public.products as parent_product
           where parent_product.id = (
             nullif(pg_catalog.to_jsonb(old) ->> 'catalog_product_id', '')
           )::uuid
         )
       )
       or (
         nullif(pg_catalog.to_jsonb(old) ->> 'catalog_source_id', '') is not null
         and nullif(pg_catalog.to_jsonb(new) ->> 'catalog_source_id', '') is null
         and nullif(pg_catalog.to_jsonb(new) ->> 'catalog_product_id', '')
           is not distinct from nullif(
             pg_catalog.to_jsonb(old) ->> 'catalog_product_id',
             ''
           )
         and not exists (
           select 1 from public.catalog_sources as parent_source
           where parent_source.id = (
             nullif(pg_catalog.to_jsonb(old) ->> 'catalog_source_id', '')
           )::uuid
         )
       )
     )
     and (
       pg_catalog.to_jsonb(old)
         - 'catalog_product_id'
         - 'catalog_source_id'
         - 'pao_months'
         - 'pao_source'
         - 'expiry_source'
         - 'expiry_computed'
         - 'catalog_pao_evidence_id'
         - 'catalog_pao_source_id'
         - 'catalog_pao_region'
         - 'catalog_pao_recorded_at'
     ) = (
       pg_catalog.to_jsonb(new)
         - 'catalog_product_id'
         - 'catalog_source_id'
         - 'pao_months'
         - 'pao_source'
         - 'expiry_source'
         - 'expiry_computed'
         - 'catalog_pao_evidence_id'
         - 'catalog_pao_source_id'
         - 'catalog_pao_region'
         - 'catalog_pao_recorded_at'
     ) then
    return new;
  end if;

  if pg_catalog.array_length(tg_argv, 1) not in (1, 2) then
    raise exception 'HEALTH_GUARD_CONFIGURATION_INVALID' using errcode = '55000';
  end if;

  begin
    v_new_owner := nullif(pg_catalog.to_jsonb(new) ->> tg_argv[0], '')::uuid;
    if tg_op = 'UPDATE' then
      v_old_owner := nullif(pg_catalog.to_jsonb(old) ->> tg_argv[0], '')::uuid;
    end if;
  exception when others then
    raise exception 'HEALTH_PROCESSING_OWNER_INVALID' using errcode = '22023';
  end;

  if tg_op = 'UPDATE' and v_old_owner is distinct from v_new_owner then
    raise exception 'HEALTH_PROCESSING_OWNER_IMMUTABLE' using errcode = '22023';
  end if;

  if pg_catalog.array_length(tg_argv, 1) = 2 then
    if not public._health_consent_type_protected(tg_argv[1]) then
      raise exception 'HEALTH_GUARD_CONFIGURATION_INVALID' using errcode = '55000';
    end if;
    perform public._assert_health_dependent_active_locked(v_new_owner, tg_argv[1]);
  else
    perform public._assert_health_processing_active_locked(v_new_owner);
  end if;
  return new;
end;
$$;

revoke all on function public._guard_direct_health_write()
  from public, anon, authenticated, service_role;

-- Freshness evidence is product-source evidence, not merely evidence from any
-- independently approved catalog source. Keep the bounded service projection
-- and direct authenticated RLS lane on the same exact parent source UUID.
create or replace view public.catalog_servable_products
with (security_invoker = true)
as
select
  products.id,
  products.barcode,
  products.name,
  products.brand,
  products.category,
  products.region,
  products.default_pao_months,
  products.source,
  products.source_id as catalog_source_id,
  products.source_ref,
  products.source_url,
  products.source_snapshot_date,
  products.quality_grade,
  products.review_status,
  products.data_quality_score,
  products.ingredient_parse_status,
  products.ingredient_parse_confidence,
  pg_catalog.jsonb_build_object(
    'id', sources.id,
    'display_name', sources.display_name,
    'source_key', sources.source_key,
    'attribution_text', sources.attribution_text,
    'attribution_url', sources.attribution_url
  ) as catalog_sources,
  coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'pao_months', freshness.pao_months,
        'pao_source', freshness.pao_source,
        'expiry_date', freshness.expiry_date,
        'expiry_source', freshness.expiry_source,
        'region', freshness.region,
        'source_id', freshness.source_id,
        'review_status', freshness.review_status,
        'created_at', freshness.created_at
      ) order by freshness.created_at desc, freshness.id
    )
    from public.product_pao_expiry as freshness
    where freshness.product_id = products.id
      and freshness.source_id = products.source_id
      and freshness.review_status = 'reviewed'
      and nullif(pg_catalog.btrim(freshness.reviewed_by), '') is not null
      and freshness.pao_source in ('label', 'brand_label', 'catalog')
      and freshness.pao_months between 1 and 120
      and freshness.region = products.region
      and private.catalog_source_is_production_approved(freshness.source_id)
  ), '[]'::jsonb) as product_pao_expiry
from public.products as products
join public.catalog_sources as sources on sources.id = products.source_id
where private.catalog_product_is_servable(products.id);

comment on view public.catalog_servable_products is
  'Service-only CAT-03 boundary with exact parent-source freshness provenance.';
revoke all on public.catalog_servable_products
  from public, anon, authenticated, service_role;

drop policy if exists "product_pao_expiry_read_servable"
  on public.product_pao_expiry;
create policy "product_pao_expiry_read_servable"
  on public.product_pao_expiry
  for select to authenticated using (
    review_status = 'reviewed'
    and nullif(pg_catalog.btrim(reviewed_by), '') is not null
    and pao_source in ('label', 'brand_label', 'catalog')
    and pao_months between 1 and 120
    and region = 'US'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_product_is_servable(product_id)
    and exists (
      select 1
      from public.products as parent_product
      where parent_product.id = product_pao_expiry.product_id
        and parent_product.source_id = product_pao_expiry.source_id
    )
  );

-- Historical policy names varied across migration paths. Sealed raw scan and
-- correction relations must have no residual RLS policy, regardless of name.
do $$
declare
  v_relation text;
  v_policy record;
begin
  foreach v_relation in array array['shelf_scans', 'catalog_corrections']
  loop
    for v_policy in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = v_relation
    loop
      execute pg_catalog.format(
        'drop policy %I on public.%I',
        v_policy.policyname,
        v_relation
      );
    end loop;
  end loop;
end;
$$;

alter table public.shelf_scans enable row level security;
alter table public.shelf_scans force row level security;
revoke all on table public.shelf_scans
  from public, anon, authenticated, service_role;

alter table public.catalog_corrections enable row level security;
alter table public.catalog_corrections force row level security;
revoke all on table public.catalog_corrections
  from public, anon, authenticated, service_role;
grant select on table public.catalog_corrections to service_role;

commit;
