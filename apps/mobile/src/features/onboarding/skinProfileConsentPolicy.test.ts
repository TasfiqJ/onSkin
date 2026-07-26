import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { HEALTH_DATA_CONSENT } from './consentCopy';

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const MIGRATION = readFileSync(
  `${ROOT}/supabase/migrations/20260726000057_skin_profile_consent_gate.sql`,
  'utf8',
);
const MIRROR = readFileSync(
  fileURLToPath(new URL('./skinProfileMirror.ts', import.meta.url)),
  'utf8',
);
const PERSISTENCE = readFileSync(
  fileURLToPath(new URL('./skinProfilePersistence.ts', import.meta.url)),
  'utf8',
);
const CONTEXT = readFileSync(
  fileURLToPath(new URL('./OnboardingContext.tsx', import.meta.url)),
  'utf8',
);

describe('skin-profile exact consent publication policy', () => {
  it('binds the restrictive insert policy to the exact current copy', () => {
    const consentHash = createHash('sha256').update(HEALTH_DATA_CONSENT.fullText).digest('hex');

    expect(MIGRATION).toContain('create policy "skin_profiles_insert_current_health_consent"');
    expect(MIGRATION).toMatch(
      /create policy "skin_profiles_insert_current_health_consent"[\s\S]*?as restrictive[\s\S]*?for insert[\s\S]*?to authenticated/,
    );
    expect(MIGRATION).toContain('(select auth.uid()) = user_id');
    expect(MIGRATION).toContain('public.has_current_exact_consent(');
    expect(MIGRATION).toContain(`'${HEALTH_DATA_CONSENT.version}'`);
    expect(MIGRATION).toContain(`'${consentHash}'`);
  });

  it('server-orders authenticated consent rows and shares one health lock with RLS', () => {
    expect(MIGRATION).toContain("if current_user = 'authenticated' then");
    expect(MIGRATION).toContain('new.granted_at := pg_catalog.clock_timestamp()');
    expect(MIGRATION).toContain("new.consent_type = 'health_data_collection'");
    expect(MIGRATION.match(/'health-consent:' \|\|/g)).toHaveLength(2);
    expect(MIGRATION).toContain('pg_catalog.pg_advisory_xact_lock(');
    expect(MIGRATION).toContain('create trigger trg_consents_health_consent_ordering');
    expect('trg_consents_account_deletion_freeze' < 'trg_consents_health_consent_ordering').toBe(
      true,
    );
    expect(MIGRATION).toMatch(
      /create or replace function public\.has_current_exact_consent[\s\S]*?language plpgsql[\s\S]*?security definer/,
    );
    expect(MIGRATION).toContain('future.granted_at > pg_catalog.now()');
    expect(MIGRATION).toContain('order by c.granted_at desc, c.granted asc');
  });

  it('removes the unused authenticated update surface without changing select or delete', () => {
    expect(MIGRATION).toContain(
      'drop policy if exists "skin_profiles_update_own" on public.skin_profiles',
    );
    expect(MIGRATION).toContain(
      'revoke update on table public.skin_profiles from public, anon, authenticated',
    );
    expect(MIGRATION).not.toMatch(/drop policy.*skin_profiles_select_own/);
    expect(MIGRATION).not.toMatch(/drop policy.*skin_profiles_delete_own/);
    expect(MIGRATION).not.toMatch(/grant .*update.*skin_profiles/i);
  });

  it('keeps reapplication safe and uses one non-reentrant full workflow', () => {
    expect(MIGRATION).toContain(
      'drop trigger if exists trg_consents_health_consent_ordering on public.consents',
    );
    expect(MIGRATION).toContain(
      'drop policy if exists "skin_profiles_insert_current_health_consent"',
    );

    expect(CONTEXT).toContain('persistSkinProfileWithConsentWorkflow(ownerLease, {');
    expect(CONTEXT).not.toContain('runSerializedConsentWorkflow');
    expect(PERSISTENCE).toContain('return runSerializedConsentWorkflow(lease, async () => {');
    expect(PERSISTENCE).toContain('deps.mirrorInsideWorkflow(lease, {');
    expect(MIRROR).toContain(
      'export async function mirrorSkinProfileWithExactConsentInsideWorkflow',
    );
    expect(MIRROR).toContain("endpoint: 'skin_profile_publication'");
    expect(MIRROR).toContain('deadlineMs: 8_000');
    expect(MIRROR).toContain('idempotent: false');
    expect(MIRROR).toContain('maxAttempts: 1');
    expect(MIRROR).toContain('.abortSignal(signal)');
  });
});
