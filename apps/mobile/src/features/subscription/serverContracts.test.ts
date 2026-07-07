import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));

function readRepo(path: string): string {
  return readFileSync(`${REPO_DIR}/${path}`, 'utf8');
}

describe('subscription server contracts', () => {
  it('keeps app-granted reverse trial audit and entitlement writes atomic', () => {
    const migration = readRepo(
      'supabase/migrations/20260707000035_phase6_reverse_trial_atomic_grant.sql',
    );
    const edgeFunction = readRepo('supabase/functions/subscription-grants/index.ts');
    const policyLint = readRepo('scripts/phase9/supabase-policy-lint.mjs');

    expect(migration).toContain('create or replace function public.grant_app_granted_reverse_trial');
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
