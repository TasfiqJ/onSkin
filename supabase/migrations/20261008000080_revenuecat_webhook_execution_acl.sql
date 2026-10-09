-- P2A-CI-R1: append-only correction to the installed 0079 webhook routines.
-- P2A-CI-R3: corrected candidate-only boundary on all three exact overloads.
-- Historical 0051 and 0079 are immutable. The actual Deno service-role handler
-- supplies identity-HMAC inputs to the 30-argument guarded v0051 entrypoint.
-- Both 27-argument SECURITY DEFINER functions remain owner-private delegates.
begin;

revoke all on function public.process_revenuecat_webhook_event(
  text, text, text[], text, text, text[], text[], text[],
  text, text, text, text, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, text, boolean, boolean, boolean,
  smallint, text, jsonb, boolean, boolean
) from public, anon, authenticated, service_role;

revoke all on function public.process_revenuecat_webhook_event_guarded(
  text, text, text[], text, text, text[], text[], text[],
  text, text, text, text, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, text, boolean, boolean, boolean,
  smallint, text, jsonb, boolean, boolean
) from public, anon, authenticated, service_role;

revoke all on function public.process_revenuecat_webhook_event_guarded(
  text, text, text[], text, text, text[], text[], text[],
  text, text, text, text, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, text, boolean, boolean, boolean,
  smallint, text, jsonb, boolean, boolean,
  smallint[], text[], text[]
) from public, anon, authenticated, service_role;

-- HMAC/tombstone validation is mandatory for the sole external RPC.
grant execute on function public.process_revenuecat_webhook_event_guarded(
  text, text, text[], text, text, text[], text[], text[],
  text, text, text, text, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, text, boolean, boolean, boolean,
  smallint, text, jsonb, boolean, boolean,
  smallint[], text[], text[]
) to service_role;

commit;
