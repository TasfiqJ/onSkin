import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260718000049_notification_delivery_outbox_rpc.sql',
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

describe('notification delivery outbox migration', () => {
  it('derives the owner and exposes only the authenticated replay-safe RPC', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).not.toContain('p_user_id');
    expect(migration).toContain(
      'create or replace function public.apply_notification_delivery_outbox_batch',
    );
    expect(migration).toContain(
      'revoke all on function public.apply_notification_delivery_outbox_batch(jsonb)',
    );
    expect(migration).toContain(
      'grant execute on function public.apply_notification_delivery_outbox_batch(jsonb)',
    );
    expect(migration).toContain('to authenticated;');
  });

  it('accepts only exact content-free events and enforces every kind-to-tier mapping', () => {
    expect(migration).toContain("'notification_delivery'");
    expect(migration).toMatch(
      /'notification_delivery:' \|\| v_operation_id::text \|\| ':' \|\|\s*v_kind \|\| ':' \|\| \(v_payload ->> 'sent_at'\)/,
    );
    expect(migration).toContain("v_operation ->> 'client_revision' = '1'");
    expect(migration).toContain(
      '(select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 3',
    );
    for (const field of ['kind', 'tier', 'sent_at']) {
      expect(migration).toContain(`'${field}'`);
    }
    for (const [kind, tier] of [
      ['am_reminder', 'utility'],
      ['pm_step', 'utility'],
      ['capture', 'behavioural'],
      ['replenishment', 'behavioural'],
      ['rampup', 'behavioural'],
      ['deescalation', 'behavioural'],
      ['winback', 'promotional'],
    ]) {
      expect(migration).toContain(`when '${kind}' then v_tier = '${tier}'`);
    }
    expect(migration).not.toMatch(
      /v_payload\s*->>?\s*'(?:content|title|body|user_id|device|token|health)'/i,
    );
  });

  it('denies the legacy direct-insert bypass while retaining owner reads', () => {
    expect(migration).toContain(
      'drop policy if exists "notification_log_insert_own" on public.notification_log',
    );
    expect(migration).toContain(
      'revoke insert on table public.notification_log from public, anon, authenticated',
    );
    expect(migration).not.toContain('drop policy if exists "notification_log_select_own"');
  });

  it('inserts the exact event and receipt atomically while dropping stale telemetry', () => {
    expect(migration).toContain("v_sent_at < pg_catalog.now() - interval '30 days'");
    expect(migration).toContain("v_status := 'stale'");
    expect(migration).toContain('insert into public.notification_log');
    expect(migration).toContain('v_entity_id,');
    expect(migration).toContain('insert into public.mobile_outbox_receipts');
    expect(migration).toContain("v_status := 'duplicate'");
    expect(migration).toContain("v_status := 'applied'");
    expect(migration).toContain("v_status := 'permanent'");
    expect(migration).toContain('when unique_violation then');
    expect(migration).toMatch(
      /v_constraint_name not in \(\s*'notification_log_pkey',\s*'mobile_outbox_receipts_pkey'/,
    );
    expect(migration).toContain('receipt.operation_id = v_operation_id');
  });

  it('turns far-future device time into a receipt-backed terminal no-op', () => {
    expect(clockSkewMigration).toContain('public.apply_notification_delivery_outbox_batch(jsonb)');
    expect(clockSkewMigration).toContain(
      "or v_sent_at > pg_catalog.now() + interval ''5 minutes'' then",
    );
    expect(clockSkewMigration).toContain('OUTBOX_CLOCK_SKEW_NOTIFICATION_POSTCONDITION_FAILED');
    expect(clockSkewMigration).toContain('execute v_definition');
    expect(clockSkewMigration).not.toMatch(/then\s+pg_catalog\.now\(\)/);
  });
});
