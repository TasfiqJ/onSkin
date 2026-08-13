-- Preserve immutable event identity under device/server clock skew. Structurally
-- valid events beyond the five-minute future allowance are terminal no-ops with
-- durable receipts, not permanent poison rows. Exact replay therefore converges
-- without fabricating a clamped event time or consuming the client retry budget.
--
-- This forward migration rewrites only two exact, fail-closed fragments in the
-- already-installed security-definer functions. pg_get_functiondef preserves
-- their complete validation, ordering, exception isolation, configuration, and
-- body; CREATE OR REPLACE preserves ownership and grants.

do $migration$
declare
  v_definition text;
  v_old_validation constant text :=
    E'and v_sent_at <= pg_catalog.now() + interval ''5 minutes''\n          and v_idempotency_key =';
  v_new_validation constant text := E'and v_idempotency_key =';
  v_old_stale constant text :=
    E'elsif v_sent_at < pg_catalog.now() - interval ''30 days'' then';
  v_new_stale constant text :=
    E'elsif v_sent_at < pg_catalog.now() - interval ''30 days''\n            or v_sent_at > pg_catalog.now() + interval ''5 minutes'' then';
begin
  select pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure('public.apply_notification_delivery_outbox_batch(jsonb)')
  )
    into v_definition;

  if v_definition is null then
    raise exception using
      errcode = '55000',
      message = 'OUTBOX_CLOCK_SKEW_NOTIFICATION_FUNCTION_MISSING';
  end if;

  if pg_catalog.strpos(v_definition, v_old_validation) > 0 then
    if (
      pg_catalog.length(v_definition) -
      pg_catalog.length(pg_catalog.replace(v_definition, v_old_validation, ''))
    ) / pg_catalog.length(v_old_validation) <> 1
      or (
        pg_catalog.length(v_definition) -
        pg_catalog.length(pg_catalog.replace(v_definition, v_old_stale, ''))
      ) / pg_catalog.length(v_old_stale) <> 1
      or (
        pg_catalog.length(v_definition) -
        pg_catalog.length(pg_catalog.replace(v_definition, v_new_stale, ''))
      ) / pg_catalog.length(v_new_stale) <> 0
    then
      raise exception using
        errcode = '55000',
        message = 'OUTBOX_CLOCK_SKEW_NOTIFICATION_CONTRACT_AMBIGUOUS';
    end if;

    v_definition := pg_catalog.replace(
      v_definition,
      v_old_validation,
      v_new_validation
    );
    v_definition := pg_catalog.replace(v_definition, v_old_stale, v_new_stale);
    execute v_definition;
  elsif (
    pg_catalog.length(v_definition) -
    pg_catalog.length(pg_catalog.replace(v_definition, v_new_stale, ''))
  ) / pg_catalog.length(v_new_stale) <> 1
  then
    raise exception using
      errcode = '55000',
      message = 'OUTBOX_CLOCK_SKEW_NOTIFICATION_CONTRACT_UNKNOWN';
  end if;

  select pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure('public.apply_notification_delivery_outbox_batch(jsonb)')
  )
    into v_definition;
  if pg_catalog.strpos(v_definition, v_old_validation) <> 0
    or (
      pg_catalog.length(v_definition) -
      pg_catalog.length(pg_catalog.replace(v_definition, v_new_stale, ''))
    ) / pg_catalog.length(v_new_stale) <> 1
  then
    raise exception using
      errcode = '55000',
      message = 'OUTBOX_CLOCK_SKEW_NOTIFICATION_POSTCONDITION_FAILED';
  end if;
end
$migration$;

do $migration$
declare
  v_definition text;
  v_old_validation constant text :=
    E'v_valid := (v_result = ''matched'' or v_matched_product_id is null)\n          and v_scanned_at <= pg_catalog.now() + interval ''5 minutes'';';
  v_new_validation constant text :=
    E'v_valid := (v_result = ''matched'' or v_matched_product_id is null);';
  v_old_stale constant text :=
    E'elsif v_scanned_at < pg_catalog.now() - interval ''30 days'' then';
  v_new_stale constant text :=
    E'elsif v_scanned_at < pg_catalog.now() - interval ''30 days''\n            or v_scanned_at > pg_catalog.now() + interval ''5 minutes'' then';
begin
  select pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure('public.apply_shelf_scan_outbox_batch(jsonb)')
  )
    into v_definition;

  if v_definition is null then
    raise exception using
      errcode = '55000',
      message = 'OUTBOX_CLOCK_SKEW_SHELF_SCAN_FUNCTION_MISSING';
  end if;

  if pg_catalog.strpos(v_definition, v_old_validation) > 0 then
    if (
      pg_catalog.length(v_definition) -
      pg_catalog.length(pg_catalog.replace(v_definition, v_old_validation, ''))
    ) / pg_catalog.length(v_old_validation) <> 1
      or (
        pg_catalog.length(v_definition) -
        pg_catalog.length(pg_catalog.replace(v_definition, v_old_stale, ''))
      ) / pg_catalog.length(v_old_stale) <> 1
      or (
        pg_catalog.length(v_definition) -
        pg_catalog.length(pg_catalog.replace(v_definition, v_new_stale, ''))
      ) / pg_catalog.length(v_new_stale) <> 0
    then
      raise exception using
        errcode = '55000',
        message = 'OUTBOX_CLOCK_SKEW_SHELF_SCAN_CONTRACT_AMBIGUOUS';
    end if;

    v_definition := pg_catalog.replace(
      v_definition,
      v_old_validation,
      v_new_validation
    );
    v_definition := pg_catalog.replace(v_definition, v_old_stale, v_new_stale);
    execute v_definition;
  elsif (
    pg_catalog.length(v_definition) -
    pg_catalog.length(pg_catalog.replace(v_definition, v_new_stale, ''))
  ) / pg_catalog.length(v_new_stale) <> 1
  then
    raise exception using
      errcode = '55000',
      message = 'OUTBOX_CLOCK_SKEW_SHELF_SCAN_CONTRACT_UNKNOWN';
  end if;

  select pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure('public.apply_shelf_scan_outbox_batch(jsonb)')
  )
    into v_definition;
  if pg_catalog.strpos(v_definition, v_old_validation) <> 0
    or (
      pg_catalog.length(v_definition) -
      pg_catalog.length(pg_catalog.replace(v_definition, v_new_stale, ''))
    ) / pg_catalog.length(v_new_stale) <> 1
  then
    raise exception using
      errcode = '55000',
      message = 'OUTBOX_CLOCK_SKEW_SHELF_SCAN_POSTCONDITION_FAILED';
  end if;
end
$migration$;
