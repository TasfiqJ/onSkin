import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));

function readRepo(path: string): string {
  return readFileSync(`${REPO_DIR}/${path}`, 'utf8');
}

describe('subscription server contracts', () => {
  it('retries RevenueCat entitlement mirroring atomically when a prior event row failed', () => {
    const edgeFunction = readRepo('supabase/functions/revenuecat-webhook/index.ts');
    const core = readRepo('supabase/functions/revenuecat-webhook/webhookCore.ts');
    const migration = readRepo(
      'supabase/migrations/20260713000041_revenuecat_webhook_atomic_projection.sql',
    );
    const liveHarness = readRepo('scripts/phase9/live-revenuecat-webhook.mjs');

    expect(edgeFunction).toContain('persistRevenueCatEvent(supabase, atomicArgs)');
    expect(edgeFunction).not.toContain(".from('subscriptions_events')");
    expect(edgeFunction).not.toContain(".from('entitlements')");
    expect(core).toContain("'process_revenuecat_webhook_event'");
    expect(core).toContain("row.processing_status === 'error'");
    expect(migration).toContain(
      "coalesce(v_existing.processing_status, '') not in ('error', 'unresolved_user')",
    );
    expect(migration).toContain("processing_status = 'processing'");
    expect(migration).toContain('processed_at = null');
    expect(migration).toContain("processing_status = 'error'");
    expect(migration).toContain(
      "where event_audit.processing_status in ('processing', 'error', 'unresolved_user')",
    );

    expect(liveHarness).toContain(
      'revenuecat-webhook retries entitlement mirroring after a failed event row',
    );
    expect(liveHarness).toContain("processing_status: 'error'");
    expect(liveHarness).toContain('eventIds.retryAfterError');
  });

  it('keeps app-granted reverse trial audit and entitlement writes atomic', () => {
    const migration = readRepo(
      'supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql',
    );
    const edgeFunction = readRepo('supabase/functions/subscription-grants/index.ts');
    const policyLint = readRepo('scripts/phase9/supabase-policy-lint.mjs');

    expect(migration).toContain(
      'create or replace function public.grant_app_granted_reverse_trial',
    );
    expect(migration).toContain('returns setof public.entitlements');
    expect(migration).toContain('insert into public.reverse_trial_grants');
    expect(migration).toContain('on conflict (user_id) do nothing');
    expect(migration).toContain("raise exception 'REVERSE_TRIAL_ALREADY_USED'");
    expect(migration).toContain("raise exception 'ACTIVE_SUBSCRIPTION_EXISTS'");
    expect(migration).toContain('insert into public.entitlements');
    expect(migration).toContain(
      'revoke all on function public.grant_app_granted_reverse_trial(uuid, timestamptz, text, text)',
    );
    expect(migration).toContain(
      'grant execute on function public.grant_app_granted_reverse_trial(uuid, timestamptz, text, text) to service_role',
    );

    expect(edgeFunction).toContain("supabase.rpc('grant_app_granted_reverse_trial'");
    expect(edgeFunction).toContain("message.includes('ACTIVE_SUBSCRIPTION_EXISTS')");
    expect(edgeFunction).toContain("message.includes('REVERSE_TRIAL_ALREADY_USED')");
    expect(edgeFunction).not.toContain(".from('reverse_trial_grants').insert");
    expect(edgeFunction).not.toContain(".from('entitlements').upsert");

    expect(policyLint).toContain(
      "'grant_app_granted_reverse_trial(uuid, timestamptz, text, text)'",
    );
  });
});
