import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260718000048_recommendation_preferences_outbox_rpc.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('recommendation preference outbox migration', () => {
  it('derives the owner and exposes only the authenticated replay-safe RPC', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).not.toContain('p_user_id');
    expect(migration).toContain(
      'create or replace function public.apply_recommendation_preferences_outbox_batch',
    );
    expect(migration).toContain(
      'revoke all on function public.apply_recommendation_preferences_outbox_batch(jsonb)',
    );
    expect(migration).toContain(
      'grant execute on function public.apply_recommendation_preferences_outbox_batch(jsonb)',
    );
    expect(migration).toContain('to authenticated;');
  });

  it('accepts only an exact bounded full snapshot with no commerce or identity fields', () => {
    expect(migration).toContain("'recommendation_preferences'");
    expect(migration).toContain("'recommendation_preferences:' || v_operation_id::text");
    expect(migration).toContain(
      '(select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_payload)) = 3',
    );
    for (const field of ['values_filters', 'budget_band', 'format_prefs']) {
      expect(migration).toContain(`'${field}'`);
    }
    for (const value of [
      'fragrance_free',
      'vegan',
      'cruelty_free',
      'non_comedogenic',
      'sustainable',
      'drugstore',
      'mid',
      'premium',
    ]) {
      expect(migration).toContain(`'${value}'`);
    }
    expect(migration).toContain("pg_catalog.char_length(item.value #>> '{}')");
    expect(migration).toContain("'(^[[:space:]])|([[:space:]]$)'");
    expect(migration).not.toContain("pg_catalog.octet_length(item.value #>> '{}')");
    expect(migration).not.toMatch(/v_payload\s*->>?\s*'(?:commission|affiliate|ranking|user_id)'/i);
  });

  it('commits the owner row and receipt in one per-operation subtransaction', () => {
    expect(migration).toContain('insert into public.recommendation_preferences');
    expect(migration).toContain('on conflict (user_id) do update');
    expect(migration).toContain('insert into public.mobile_outbox_receipts');
    expect(migration).toContain("v_status := 'duplicate'");
    expect(migration).toContain("v_status := 'applied'");
    expect(migration).toContain("v_status := 'permanent'");
    expect(migration).toContain('when unique_violation then');
  });
});
