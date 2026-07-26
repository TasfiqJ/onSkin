import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260726000058_photo_delete_outbox_rpc.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('photo-delete outbox migration contract', () => {
  it('derives the owner and exposes only the authenticated replay-safe RPC', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).not.toContain('p_user_id');
    expect(migration).toContain(
      'create or replace function public.apply_photo_delete_outbox_batch',
    );
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      'revoke all on function public.apply_photo_delete_outbox_batch(jsonb)',
    );
    expect(migration).toContain(
      'grant execute on function public.apply_photo_delete_outbox_batch(jsonb)',
    );
    expect(migration).toContain('to authenticated;');
  });

  it('takes the account-deletion lock even when the target row is absent', () => {
    expect(migration).toMatch(
      /if not public\.account_deletion_write_allowed\(\) then[\s\S]*account_deletion_in_progress/,
    );
    expect(migration.indexOf('account_deletion_write_allowed()')).toBeLessThan(
      migration.indexOf('for v_operation in'),
    );
    expect(migration.indexOf('account_deletion_write_allowed()')).toBeLessThan(
      migration.indexOf('delete from public.photos'),
    );
  });

  it('accepts only an exact bounded delete tombstone with operation-bound identity', () => {
    expect(migration).toContain(
      '(select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_operation)) = 7',
    );
    for (const field of [
      'operation_id',
      'entity_type',
      'entity_id',
      'operation_kind',
      'payload',
      'client_revision',
      'idempotency_key',
    ]) {
      expect(migration).toContain(`'${field}'`);
    }
    expect(migration).toContain("v_operation ->> 'entity_type' = 'photo_delete'");
    expect(migration).toContain("v_operation ->> 'operation_kind' = 'delete'");
    expect(migration).toContain("pg_catalog.jsonb_typeof(v_operation -> 'payload') = 'null'");
    expect(migration).toContain("v_idempotency_key = 'photo_delete:' || v_operation_id::text");
    expect(migration).toContain('pg_catalog.jsonb_array_length(p_operations) > 25');
    expect(migration).toContain('pg_catalog.octet_length(p_operations::text) > 2097152');
    expect(migration).not.toMatch(
      /v_operation\s*->>?\s*'(?:user_id|owner|local_uri|notes|image|storage_path)'/i,
    );
  });

  it('removes the direct authenticated bypass and scopes deletion by auth owner', () => {
    expect(migration).toContain('drop policy if exists "photos_delete_own" on public.photos');
    expect(migration).toContain(
      'revoke delete on table public.photos from public, anon, authenticated',
    );
    expect(migration).toMatch(
      /delete from public\.photos\s+where user_id = v_user_id\s+and id = v_entity_id/,
    );
    expect(migration).toContain('insert into public.mobile_outbox_receipts');
    expect(migration).toContain("'photo_delete'");
    expect(migration).toContain("'delete'");
    expect(migration).toContain("'applied'");
    expect(migration).toContain("v_status := 'duplicate'");
    expect(migration).toContain("v_status := 'permanent'");
  });

  it('serializes stale metadata inserts behind a terminal owner/photo tombstone', () => {
    expect(migration).toContain(
      'create index if not exists mobile_outbox_receipts_photo_delete_tombstone_idx',
    );
    expect(migration).toMatch(
      /on public\.mobile_outbox_receipts \(user_id, entity_id\)[\s\S]*where entity_type = 'photo_delete' and result_status = 'applied'/,
    );
    expect(migration).toContain('create or replace function public.photo_outbox_insert_allowed');
    expect(migration).toContain("'photo-delete:' || v_user_id::text || ':' || p_entity_id::text");
    expect(migration).toContain("'photo-delete:' || v_user_id::text || ':' || v_entity_id::text");
    expect(migration).toContain(
      'create policy "photos_no_outbox_delete_reinsert" on public.photos',
    );
    expect(migration).toContain('with check (public.photo_outbox_insert_allowed(id))');
    expect(migration).toContain('create policy "photos_no_outbox_delete_rewrite" on public.photos');
    expect(migration).toMatch(
      /photos_no_outbox_delete_rewrite[\s\S]*as restrictive for update to authenticated[\s\S]*using \(true\)[\s\S]*with check \(public\.photo_outbox_insert_allowed\(id\)\)/,
    );
    expect(migration).toMatch(
      /receipt\.entity_type = 'photo_delete'[\s\S]*receipt\.entity_id = p_entity_id[\s\S]*receipt\.result_status = 'applied'/,
    );
  });

  it('extends the exact receipt registry without weakening prior entity admission', () => {
    for (const entity of [
      'shelf_product',
      'shelf_scan',
      'conflict_choice',
      'notification_delivery',
      'notification_preferences',
      'recommendation_preferences',
      'photo_delete',
    ]) {
      expect(migration).toContain(`'${entity}'`);
    }
    expect(migration).toContain(
      'drop constraint if exists mobile_outbox_receipts_entity_type_check',
    );
    expect(migration).toContain('add constraint mobile_outbox_receipts_entity_type_check');
  });
});
