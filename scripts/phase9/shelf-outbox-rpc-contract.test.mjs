import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../../supabase/migrations/20260718000046_shelf_outbox_rpc.sql',
  import.meta.url,
);

const normalize = (value) => value.toLowerCase().replace(/\s+/g, ' ').trim();

test('Shelf outbox RPC is owner-derived, private, and authenticated-only', async () => {
  const sql = normalize(await readFile(migrationUrl, 'utf8'));

  for (const fragment of [
    'create table public.shelf_mirror_versions',
    'create table public.mobile_outbox_receipts',
    'unique (user_id, idempotency_key)',
    'alter table public.shelf_mirror_versions enable row level security',
    'alter table public.mobile_outbox_receipts enable row level security',
    'create or replace function public.apply_shelf_outbox_batch(p_operations jsonb)',
    'security definer',
    "set search_path = ''",
    'v_user_id uuid := auth.uid()',
    'jsonb_array_length(p_operations) > 25',
    'grant execute on function public.apply_shelf_outbox_batch(jsonb) to authenticated',
  ]) {
    assert(sql.includes(fragment), `missing owner/RPC contract: ${fragment}`);
  }

  assert(
    !sql.includes('create policy') &&
      !sql.includes('grant execute on function public.apply_shelf_outbox_batch(jsonb) to anon') &&
      !sql.includes(
        'grant execute on function public.apply_shelf_outbox_batch(jsonb) to service_role',
      ),
    'coordination tables must have no direct policies and the RPC must be authenticated-only',
  );
});

test('Shelf outbox RPC enforces exact wire/payload contracts and owner-only writes', async () => {
  const sql = normalize(await readFile(migrationUrl, 'utf8'));

  for (const fragment of [
    'jsonb_object_keys(v_operation)) = 7',
    'jsonb_object_keys(v_payload)) = 17',
    "v_operation ->> 'entity_type' = 'shelf_product'",
    "v_idempotency_key = 'shelf_product:' || v_entity_id::text || ':' || v_client_revision::text",
    'where product.id = v_entity_id and product.user_id = v_user_id',
    'where public.user_products.user_id = v_user_id',
    "v_payload ->> 'catalog_match_quality' in",
    "v_payload ->> 'pao_source' in",
    "v_payload ->> 'expiry_source' in",
  ]) {
    assert(sql.includes(fragment), `missing strict Shelf contract: ${fragment}`);
  }

  assert(
    !/v_operation\s*->>\s*'user_id'/.test(sql) && !/v_payload\s*->>\s*'user_id'/.test(sql),
    'the wire contract must never accept a raw owner ID',
  );
});

test('Shelf outbox RPC serializes revisions and isolates expected poison rows', async () => {
  const sql = normalize(await readFile(migrationUrl, 'utf8'));

  for (const fragment of [
    'for update',
    'if v_client_revision <= v_current_revision then',
    "v_status := 'stale'",
    "v_status := 'duplicate'",
    "v_status := 'applied'",
    "v_status := 'permanent'",
    "v_error_class := 'validation'",
    'when unique_violation then',
    'get stacked diagnostics v_constraint_name = constraint_name',
    "v_constraint_name not in ( 'mobile_outbox_receipts_pkey', 'mobile_outbox_receipts_owner_idempotency_key' )",
    'when invalid_text_representation or invalid_datetime_format or datetime_field_overflow',
  ]) {
    assert(sql.includes(fragment), `missing replay/isolation contract: ${fragment}`);
  }

  assert(
    !sql.includes('when others'),
    'unexpected/transient database errors must abort the batch instead of becoming poison rows',
  );
});
