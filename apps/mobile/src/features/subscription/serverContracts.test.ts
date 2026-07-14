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
    expect(core).toMatch(/\.rpc\(['"]process_revenuecat_webhook_event_guarded['"]/);
    expect(core).not.toMatch(/\.rpc\(['"]process_revenuecat_webhook_event['"]/);
    expect(core).toMatch(/row\.processing_status === ['"]error['"]/);
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
    const noStoreIdentityMigration = readRepo(
      'supabase/migrations/20260713000044_reverse_trial_no_store_identity.sql',
    );
    const edgeFunction = readRepo('supabase/functions/subscription-grants/index.ts');
    const grantErrors = readRepo('supabase/functions/subscription-grants/grantErrors.ts');
    const policyLint = readRepo('scripts/phase9/supabase-policy-lint.mjs');
    const entitlementStore = readRepo('apps/mobile/src/features/subscription/store.ts');
    const entitlementHook = readRepo('apps/mobile/src/features/subscription/useEntitlement.ts');
    const compatibilityBody = noStoreIdentityMigration.match(
      /create or replace function public\.grant_app_granted_reverse_trial\(\s*p_user_id uuid,\s*p_expires_at timestamptz,\s*p_environment text,\s*p_product_id text\s*\)[\s\S]*?language sql[\s\S]*?as \$\$([\s\S]*?)\$\$;/,
    )?.[1];

    expect(migration).toContain(
      'create or replace function public.grant_app_granted_reverse_trial',
    );
    expect(migration).toContain('returns setof public.entitlements');
    expect(migration).toContain('insert into public.reverse_trial_grants');
    expect(migration).toContain('on conflict (user_id) do nothing');
    expect(migration).toContain("raise exception 'REVERSE_TRIAL_ALREADY_USED'");
    expect(migration).toContain("raise exception 'ACTIVE_SUBSCRIPTION_EXISTS'");
    expect(migration).toContain('insert into public.entitlements');
    expect(noStoreIdentityMigration).toContain(
      'create or replace function public.grant_app_granted_reverse_trial(',
    );
    expect(compatibilityBody).toBeDefined();
    expect(compatibilityBody).not.toContain('p_product_id');
    expect(compatibilityBody).toMatch(
      /from public\.grant_app_granted_reverse_trial\(\s*p_user_id,\s*p_expires_at,\s*p_environment\s*\);/,
    );
    expect(noStoreIdentityMigration).toMatch(/true,\s+null,\s+p_expires_at,/);
    expect(noStoreIdentityMigration).toMatch(
      /revoke all on function public\.grant_app_granted_reverse_trial\(\s*uuid,\s*timestamptz,\s*text\s*\) from public, anon, authenticated;/,
    );
    expect(noStoreIdentityMigration).toMatch(
      /grant execute on function public\.grant_app_granted_reverse_trial\(\s*uuid,\s*timestamptz,\s*text\s*\) to service_role;/,
    );
    expect(noStoreIdentityMigration).toMatch(
      /revoke all on function public\.grant_app_granted_reverse_trial\(\s*uuid,\s*timestamptz,\s*text,\s*text\s*\) from public, anon, authenticated;/,
    );
    expect(noStoreIdentityMigration).toMatch(
      /grant execute on function public\.grant_app_granted_reverse_trial\(\s*uuid,\s*timestamptz,\s*text,\s*text\s*\) to service_role;/,
    );

    expect(edgeFunction).toContain("supabase.rpc('grant_app_granted_reverse_trial'");
    expect(edgeFunction).not.toContain('p_product_id');
    expect(edgeFunction).toContain('reverseTrialGrantErrorCode(error)');
    expect(grantErrors).toContain("message.includes('ACCOUNT_DELETION_IN_PROGRESS')");
    expect(grantErrors).toContain("message.includes('ACTIVE_SUBSCRIPTION_EXISTS')");
    expect(grantErrors).toContain("message.includes('REVERSE_TRIAL_ALREADY_USED')");
    expect(grantErrors).toContain("code === 'account_deletion_in_progress'");
    expect(edgeFunction).not.toContain(".from('reverse_trial_grants').insert");
    expect(edgeFunction).not.toContain(".from('entitlements').upsert");
    expect(entitlementStore).not.toContain('revenueCatReverseTrialProductId');
    expect(entitlementHook).not.toContain('routinekind_pro_reverse_trial_local');

    expect(policyLint).toContain("'grant_app_granted_reverse_trial(uuid, timestamptz, text)'");
    expect(policyLint).toContain(
      "'grant_app_granted_reverse_trial(uuid, timestamptz, text, text)'",
    );
    expect(policyLint).toContain('latestFunctions.delete(key)');
  });
});
