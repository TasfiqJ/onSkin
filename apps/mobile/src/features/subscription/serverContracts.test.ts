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

  it('keeps store and app-granted entitlement authorities independent', () => {
    const laneMigration = readRepo(
      'supabase/migrations/20260714000053_entitlement_authority_lanes.sql',
    );
    const edgeFunction = readRepo('supabase/functions/subscription-grants/index.ts');
    const grantErrors = readRepo('supabase/functions/subscription-grants/grantErrors.ts');
    const policyLint = readRepo('scripts/phase9/supabase-policy-lint.mjs');
    const functionAcl = readRepo('scripts/phase9/supabase-function-acl.mjs');
    const entitlementStore = readRepo('apps/mobile/src/features/subscription/store.ts');
    const entitlementHook = readRepo('apps/mobile/src/features/subscription/useEntitlement.ts');
    const grantBody = laneMigration.match(
      /create or replace function public\.grant_app_granted_reverse_trial\(\s*p_user_id uuid,\s*p_expires_at timestamptz,\s*p_environment text\s*\)[\s\S]*?language plpgsql[\s\S]*?as \$\$([\s\S]*?)\$\$;/,
    )?.[1];
    const compatibilityBody = laneMigration.match(
      /create or replace function public\.grant_app_granted_reverse_trial\(\s*p_user_id uuid,\s*p_expires_at timestamptz,\s*p_environment text,\s*p_product_id text\s*\)[\s\S]*?language sql[\s\S]*?as \$\$([\s\S]*?)\$\$;/,
    )?.[1];

    expect(laneMigration).toContain(
      'create or replace function public.grant_app_granted_reverse_trial',
    );
    expect(laneMigration).toContain('returns setof public.entitlements');
    expect(grantBody).toBeDefined();
    expect(grantBody).toContain('insert into public.reverse_trial_grants');
    expect(grantBody).toContain('on conflict (user_id) do nothing');
    expect(grantBody).toContain("raise exception 'REVERSE_TRIAL_ALREADY_USED'");
    expect(grantBody).toContain("raise exception 'ACTIVE_SUBSCRIPTION_EXISTS'");
    expect(grantBody).toContain("raise exception 'STORE_ENTITLEMENT_RECONCILIATION_REQUIRED'");
    expect(grantBody).not.toContain('insert into public.entitlements');
    expect(grantBody).not.toContain('update public.entitlements');
    expect(grantBody).not.toContain('delete from public.entitlements');
    expect(compatibilityBody).toBeDefined();
    expect(compatibilityBody).not.toContain('p_product_id');
    expect(compatibilityBody).toMatch(
      /from public\.grant_app_granted_reverse_trial\(\s*p_user_id,\s*p_expires_at,\s*p_environment\s*\);/,
    );
    expect(laneMigration).toMatch(
      /revoke all on function public\.grant_app_granted_reverse_trial\(\s*uuid,\s*timestamptz,\s*text\s*\) from public, anon, authenticated, service_role;/,
    );
    expect(laneMigration).toMatch(
      /grant execute on function public\.grant_app_granted_reverse_trial\(\s*uuid,\s*timestamptz,\s*text\s*\) to service_role;/,
    );
    expect(laneMigration).toMatch(
      /revoke all on function public\.grant_app_granted_reverse_trial\(\s*uuid,\s*timestamptz,\s*text,\s*text\s*\) from public, anon, authenticated, service_role;/,
    );
    expect(laneMigration).toMatch(
      /grant execute on function public\.grant_app_granted_reverse_trial\(\s*uuid,\s*timestamptz,\s*text,\s*text\s*\) to service_role;/,
    );

    expect(laneMigration).toContain(
      'create or replace function public.read_entitlement_projections()',
    );
    expect(laneMigration).toContain('v_user_id uuid := (select auth.uid())');
    expect(laneMigration).toContain("'store_projection'");
    expect(laneMigration).toContain("'app_grant_projection'");
    expect(laneMigration).toMatch(
      /grant execute on function public\.read_entitlement_projections\(\)\s+to authenticated;/,
    );

    expect(edgeFunction).toContain("supabase.rpc('grant_app_granted_reverse_trial'");
    expect(edgeFunction).not.toContain('p_product_id');
    expect(edgeFunction).toContain('reverseTrialGrantErrorCode(error)');
    expect(grantErrors).toContain("message.includes('ACCOUNT_DELETION_IN_PROGRESS')");
    expect(grantErrors).toContain("message.includes('ACTIVE_SUBSCRIPTION_EXISTS')");
    expect(grantErrors).toContain("message.includes('STORE_ENTITLEMENT_RECONCILIATION_REQUIRED')");
    expect(grantErrors).toContain("message.includes('REVERSE_TRIAL_ALREADY_USED')");
    expect(grantErrors).toContain("code === 'account_deletion_in_progress'");
    expect(edgeFunction).not.toContain(".from('reverse_trial_grants').insert");
    expect(edgeFunction).not.toContain(".from('entitlements').upsert");
    expect(edgeFunction).not.toContain("supabase.rpc('expire_app_granted_reverse_trials')");
    expect(entitlementStore).not.toContain('revenueCatReverseTrialProductId');
    expect(entitlementHook).not.toContain('routinekind_pro_reverse_trial_local');

    expect(policyLint).toContain("'grant_app_granted_reverse_trial(uuid, timestamptz, text)'");
    expect(policyLint).toContain(
      "'grant_app_granted_reverse_trial(uuid, timestamptz, text, text)'",
    );
    expect(policyLint).toContain("'read_entitlement_projections()'");
    expect(policyLint).toContain('publicFunctionCatalog(combined)');
    expect(functionAcl).toContain('functions.delete(key)');
  });
});
