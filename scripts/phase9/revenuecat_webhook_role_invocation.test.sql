-- CI-R3 native service-role overload invocation test. Execute in disposable DB.
-- Requires all 96 migrations; rollback prevents durable synthetic writes.
-- psql -X -v ON_ERROR_STOP=1 "$DISPOSABLE_DB_URL" -f scripts/phase9/revenuecat_webhook_role_invocation.test.sql
begin;
set local role service_role;
do $test$
declare
  blocked boolean;
  guard30_reached boolean := false;
begin
  blocked := false;
  begin
    perform * from public.process_revenuecat_webhook_event(
    null::text,
    null::text,
    null::text[],
    null::text,
    null::text,
    null::text[],
    null::text[],
    null::text[],
    null::text,
    null::text,
    null::text,
    null::text,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::text,
    null::text,
    null::text,
    null::boolean,
    null::boolean,
    null::boolean,
    null::smallint,
    null::text,
    null::jsonb,
    null::boolean,
    null::boolean
  );
  exception
    when insufficient_privilege then blocked := true;
    when others then
      raise exception 'raw27 executed past the private EXECUTE boundary (SQLSTATE %)', sqlstate;
  end;
  if not blocked then raise exception 'raw27 unexpectedly accessible to service_role'; end if;
  blocked := false;
  begin
    perform * from public.process_revenuecat_webhook_event_guarded(
    null::text,
    null::text,
    null::text[],
    null::text,
    null::text,
    null::text[],
    null::text[],
    null::text[],
    null::text,
    null::text,
    null::text,
    null::text,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::text,
    null::text,
    null::text,
    null::boolean,
    null::boolean,
    null::boolean,
    null::smallint,
    null::text,
    null::jsonb,
    null::boolean,
    null::boolean
  );
  exception
    when insufficient_privilege then blocked := true;
    when others then
      raise exception 'guarded27 executed past the private EXECUTE boundary (SQLSTATE %)', sqlstate;
  end;
  if not blocked then raise exception 'guarded27 unexpectedly accessible to service_role'; end if;
  begin
    perform * from public.process_revenuecat_webhook_event_guarded(
    null::text,
    null::text,
    null::text[],
    'fixture-owner'::text,
    null::text,
    null::text[],
    null::text[],
    null::text[],
    null::text,
    null::text,
    null::text,
    null::text,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::text,
    null::text,
    null::text,
    null::boolean,
    null::boolean,
    null::boolean,
    null::smallint,
    null::text,
    null::jsonb,
    null::boolean,
    null::boolean,
    '{}'::smallint[],
    '{}'::text[],
    '{}'::text[]
  );
    raise exception 'guarded30 unexpectedly accepted an incomplete identity-HMAC lookup';
  exception
    when insufficient_privilege then
      raise exception 'guarded30 denied service_role EXECUTE';
    when sqlstate '22023' then
      guard30_reached := true;
    when others then
      raise exception 'guarded30 did not reject malformed HMAC tuple with 22023: %',sqlstate;
  end;
  if not guard30_reached then raise exception 'guarded30 HMAC guard did not execute'; end if;
  raise notice 'PASS: service_role denied raw27 and guarded27, admitted guarded30 HMAC validation';
end;
$test$;
rollback;
