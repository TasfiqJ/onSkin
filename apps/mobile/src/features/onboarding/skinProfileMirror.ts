import type { GoalId } from '@onskin/types';

import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import {
  captureAuthenticatedAccountOwner,
  type AuthenticatedAccountOwner,
} from '@/lib/auth/authenticatedAccountOwner';
import { hasLatestExactConsentGrantWithLease } from '@/lib/consent/consent';
import { runSerializedConsentWorkflow } from '@/lib/consent/workflow';
import { runRequestWithLease, supabaseRequestFailure } from '@/lib/network/requestPolicy';
import { supabase } from '@/lib/supabase/client';

import { HEALTH_DATA_CONSENT } from './consentCopy';
import type { SkinProfileResult } from './quiz';

export type SkinProfileMirrorInput = Readonly<{
  result: SkinProfileResult;
  goals: readonly GoalId[];
  completedAt: string;
}>;

type SkinProfileMirrorDeps = Readonly<{
  captureOwner: (lease: AccountGenerationLease) => Promise<AuthenticatedAccountOwner | null>;
  hasExactGrant: typeof hasLatestExactConsentGrantWithLease;
  publish: (
    lease: AccountGenerationLease,
    owner: AuthenticatedAccountOwner,
    input: SkinProfileMirrorInput,
  ) => Promise<void>;
}>;

const defaultDeps: SkinProfileMirrorDeps = {
  captureOwner: captureAuthenticatedAccountOwner,
  hasExactGrant: hasLatestExactConsentGrantWithLease,
  async publish(lease, owner, input) {
    lease.assertCurrent();
    const { result, goals, completedAt } = input;
    await runRequestWithLease(
      lease,
      {
        endpoint: 'skin_profile_publication',
        deadlineMs: 8_000,
        idempotent: false,
        maxAttempts: 1,
        maxResponseBytes: 16 * 1024,
      },
      async ({ signal }) => {
        const response = await supabase
          .from('skin_profiles')
          .insert({
            user_id: owner.userId,
            oily_dry: result.axisScores.oily_dry,
            sensitive_resistant: result.axisScores.sensitive_resistant,
            pigmented_non: result.axisScores.pigmented_non,
            wrinkled_tight: result.axisScores.wrinkled_tight,
            fitzpatrick: result.fitzpatrick,
            monk_tone: result.monkTone,
            sensitivities: result.sensitivities,
            pregnancy_status: result.pregnancyStatus,
            goals: [...goals],
            completed_at: completedAt,
            version: 1,
          })
          .abortSignal(signal);
        if (response.error) {
          throw supabaseRequestFailure(response.error, response.status);
        }
        return null;
      },
    );
    lease.assertCurrent();
  },
};

/**
 * Best-effort cloud mirror for the device-authoritative profile.
 *
 * Publication is allowed only while the same owner lease remains current and
 * the newest server ledger row proves the exact health-consent copy. Ordinary
 * auth, ledger, or mirror failures keep onboarding local-first. An account
 * boundary still rejects instead of being flattened into a benign skip.
 */
export async function mirrorSkinProfileWithExactConsent(
  lease: AccountGenerationLease,
  input: SkinProfileMirrorInput,
  deps: SkinProfileMirrorDeps = defaultDeps,
): Promise<boolean> {
  return runSerializedConsentWorkflow(lease, () =>
    mirrorSkinProfileWithExactConsentInsideWorkflow(lease, input, deps),
  );
}

/**
 * Non-reentrant body for callers that already own the shared consent workflow.
 * Do not call this variant without first entering that queue.
 */
export async function mirrorSkinProfileWithExactConsentInsideWorkflow(
  lease: AccountGenerationLease,
  input: SkinProfileMirrorInput,
  deps: SkinProfileMirrorDeps = defaultDeps,
): Promise<boolean> {
  lease.assertCurrent();

  let owner: AuthenticatedAccountOwner | null;
  try {
    owner = await deps.captureOwner(lease);
  } catch {
    lease.assertCurrent();
    return false;
  }
  lease.assertCurrent();
  if (!owner) return false;

  let hasExactGrant: boolean;
  try {
    hasExactGrant = await deps.hasExactGrant(lease, {
      type: 'health_data_collection',
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
  } catch {
    lease.assertCurrent();
    return false;
  }
  lease.assertCurrent();
  if (!hasExactGrant) return false;

  try {
    await deps.publish(lease, owner, input);
    lease.assertCurrent();
    return true;
  } catch {
    lease.assertCurrent();
    return false;
  }
}
