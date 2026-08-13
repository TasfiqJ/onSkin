import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260718000047_notification_preferences_outbox_rpc.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('notification preference outbox migration', () => {
  it('derives the owner and exposes only the authenticated replay-safe RPC', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).not.toContain('p_user_id');
    expect(migration).toContain(
      'create or replace function public.apply_notification_preferences_outbox_batch',
    );
    expect(migration).toContain(
      'revoke all on function public.apply_notification_preferences_outbox_batch(jsonb)',
    );
    expect(migration).toContain(
      'grant execute on function public.apply_notification_preferences_outbox_batch(jsonb)',
    );
    expect(migration).toContain('to authenticated;');
  });

  it('accepts only an exact content-free full snapshot and preserves push-token state', () => {
    expect(migration).toContain(
      "check (entity_type in ('shelf_product', 'notification_preferences'))",
    );
    expect(migration).toContain("'notification_preferences:' || v_operation_id::text");
    expect(migration).toContain(
      '(select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 13',
    );
    for (const field of [
      'am_reminder_time',
      'pm_reminder_time',
      'am_reminder_enabled',
      'pm_reminder_enabled',
      'streak_nudges',
      'replenishment_alerts',
      'capture_reminders',
      'quiet_hours_start',
      'quiet_hours_end',
      'timezone',
      'live_activity_enabled',
      'promotional_opt_in',
      'lockscreen_discreet',
    ]) {
      expect(migration).toContain(`'${field}'`);
    }
    expect(migration).not.toContain('push_token');
    expect(migration).not.toContain('notification content');
  });

  it('commits the owner row and receipt in one per-operation subtransaction', () => {
    expect(migration).toContain('insert into public.notification_preferences');
    expect(migration).toContain('on conflict (user_id) do update');
    expect(migration).toContain('insert into public.mobile_outbox_receipts');
    expect(migration).toContain("v_status := 'duplicate'");
    expect(migration).toContain("v_status := 'applied'");
    expect(migration).toContain("v_status := 'permanent'");
    expect(migration).toContain('when unique_violation then');
  });
});
