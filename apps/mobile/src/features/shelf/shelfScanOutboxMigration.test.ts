import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260718000050_shelf_scan_outbox_rpc.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);
const clockSkewMigration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260726000055_immutable_event_clock_skew.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('Shelf scan outbox migration', () => {
  it('derives the owner and exposes only the authenticated replay-safe RPC', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).not.toContain('p_user_id');
    expect(migration).toContain('create or replace function public.apply_shelf_scan_outbox_batch');
    expect(migration).toContain(
      'revoke all on function public.apply_shelf_scan_outbox_batch(jsonb)',
    );
    expect(migration).toContain(
      'grant execute on function public.apply_shelf_scan_outbox_batch(jsonb)',
    );
    expect(migration).toContain('to authenticated;');
  });

  it('accepts only the exact bounded four-field event and a revision-one operation', () => {
    expect(migration).toContain("v_operation ->> 'entity_type' = 'shelf_scan'");
    expect(migration).toContain("v_operation ->> 'client_revision' = '1'");
    expect(migration).toContain(
      '(select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 4',
    );
    for (const field of ['barcode', 'result', 'matched_product_id', 'scanned_at']) {
      expect(migration).toContain(`'${field}'`);
    }
    for (const result of ['matched', 'no_match', 'ambiguous', 'offline_queued']) {
      expect(migration).toContain(`'${result}'`);
    }
    expect(migration).toContain("(v_payload ->> 'barcode') ~ '^[0-9]{6,14}$'");
    expect(migration).not.toMatch(
      /v_payload\s*->>?\s*'(?:user_id|owner|label|ingredients|notes|contributed_back)'/i,
    );
  });

  it('binds replay identity to the canonical payload without retaining raw barcode receipts', () => {
    expect(migration).toContain('add column if not exists payload_hash text');
    expect(migration).toContain('extensions.digest(');
    expect(migration).toContain("'onskin:shelf-scan-payload:v1'");
    expect(migration).toMatch(
      /'shelf_scan:' \|\| v_operation_id::text \|\| ':' \|\| v_payload_hash/,
    );
    expect(migration).toContain('receipt.payload_hash = v_payload_hash');
    expect(migration).not.toMatch(
      /insert into public\.mobile_outbox_receipts[\s\S]{0,800}\bbarcode\b/i,
    );
  });

  it('denies direct inserts and atomically applies or stales the exact event', () => {
    expect(migration).toContain(
      'drop policy if exists "shelf_scans_insert_own" on public.shelf_scans',
    );
    expect(migration).toContain(
      'revoke insert on table public.shelf_scans from public, anon, authenticated',
    );
    expect(migration).toContain(
      'drop policy if exists "shelf_scans_update_own" on public.shelf_scans',
    );
    expect(migration).toContain(
      'revoke update on table public.shelf_scans from public, anon, authenticated',
    );
    expect(migration).toContain("v_scanned_at < pg_catalog.now() - interval '30 days'");
    expect(migration).toContain("v_status := 'stale'");
    expect(migration).toContain('insert into public.shelf_scans');
    expect(migration).toContain('insert into public.mobile_outbox_receipts');
    expect(migration).toContain('contributed_back,');
    expect(migration).toContain("v_status := 'duplicate'");
    expect(migration).toContain("v_status := 'applied'");
    expect(migration).toContain("v_status := 'permanent'");
  });

  it('locks or nulls the catalog reference so deletion cannot poison telemetry replay', () => {
    expect(migration).toMatch(
      /v_matched_product_id is not null[\s\S]*?from public\.products[\s\S]*?for key share/,
    );
    expect(migration).toContain('if not found then');
    expect(migration).toContain('v_matched_product_id := null');
    expect(migration).toContain("v_result = 'matched' or v_matched_product_id is null");
  });

  it('turns far-future device time into a payload-bound terminal no-op', () => {
    expect(clockSkewMigration).toContain('public.apply_shelf_scan_outbox_batch(jsonb)');
    expect(clockSkewMigration).toContain(
      "or v_scanned_at > pg_catalog.now() + interval ''5 minutes'' then",
    );
    expect(clockSkewMigration).toContain('OUTBOX_CLOCK_SKEW_SHELF_SCAN_POSTCONDITION_FAILED');
    expect(clockSkewMigration).toContain('execute v_definition');
    expect(clockSkewMigration).not.toMatch(/then\s+pg_catalog\.now\(\)/);
  });
});
