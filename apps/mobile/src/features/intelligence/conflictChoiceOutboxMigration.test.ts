import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));
const migration = readFileSync(
  `${ROOT_DIR}/supabase/migrations/20260718000051_conflict_choice_outbox_rpc.sql`,
  'utf8',
);

describe('conflict-choice outbox migration contract', () => {
  it('derives the owner and removes direct authenticated DML bypasses', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).toContain('security definer');
    expect(migration).toContain('drop policy if exists "routine_conflicts_insert_own"');
    expect(migration).toContain('revoke insert, update, delete on table public.routine_conflicts');
    expect(migration).toContain(
      'revoke all on function public.apply_conflict_choice_outbox_batch(jsonb)',
    );
    expect(migration).toContain('to authenticated');
  });

  it('binds canonical identity, payload, operation, and revision replay evidence', () => {
    expect(migration).toContain("'layerwell:conflict-choice-identity:v1'");
    expect(migration).toContain("'layerwell:conflict-choice-payload:v1'");
    expect(migration).toContain("'conflict_choice:' || v_operation_id::text");
    expect(migration).toContain('receipt.payload_hash = v_payload_hash');
    expect(migration).toContain('conflict_choice_mirror_versions');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('hashtextextended');
    expect(migration).toContain("order by coalesce(item.value ->> 'entity_id', '')");
    expect(migration).toContain('v_current_revision >= v_client_revision');
    expect(migration).toContain("v_status := 'stale'");
  });

  it('keeps Shelf absence retriable and enforces server-side eligibility', () => {
    expect(migration).toContain('order by product.id');
    expect(migration).toContain('for key share');
    expect(migration).toContain('if v_product_count <> 2 then');
    expect(migration).toContain("v_status := 'retry'");
    expect(migration).toContain("v_error_class := 'dependency'");
    expect(migration).toContain("v_rule_interaction_type in ('safety', 'myth', 'synergy')");
    expect(migration).toContain('v_rule_current_version <> v_rule_version');
    expect(migration).toContain(
      "case when v_user_choice = 'use_together' then 'overridden' else 'accepted' end",
    );
  });
});
