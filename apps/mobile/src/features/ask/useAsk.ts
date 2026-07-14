import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { goalConcern } from '@/features/recommendations/copy';
import { hasReplenishmentSignal } from '@/features/recommendations/replenishment';
import { useRecommendations } from '@/features/recommendations/useRecommendations';
import { usePlan } from '@/features/routine/usePlan';
import { useProfileBits } from '@/features/scheduler/profile';
import { useShelf } from '@/features/shelf/useShelf';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { track } from '@/lib/analytics/track';
import { phase7Flags } from '@/lib/launch/phase7';
import { useLocalDateBoundary } from '@/lib/query/localDateBoundaryStore';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import {
  answerPrompt,
  answerQuestion,
  pickFitRec,
  safetyRefusal,
  type AskAnswer,
  type AskContext,
} from './answer';
import {
  askGate,
  groundedReasonForCloudReadiness,
  requiresTrialGroundedQuota,
} from './gate';
import { blockUnreservedGroundedAnswer } from './groundedDelivery';
import { groundedTurnsQueryOptions } from './groundedTurnsQuery';
import { guardClaim } from './guard';
import { deriveAskReadiness } from './readiness';

// The Ask data layer (docs/13). Assembles the deterministic AskContext from the user's
// REAL state. The live shelf + its launch-gated conflicts (useShelf), tonight's plan
// (usePlan), the top genuine recommendation (useRecommendations), the shared profile/goal
// (useProfileBits). And the grounded-turn gate (entitlement + the per-period counter).
// Everything is local-first and offline-safe (B-SUPABASE); the deterministic advisor runs
// fully on-device at $0. The orchestration runs every answer through the runtime claim-
// safety guard and records CONTENT-FREE telemetry. *** No commercial input anywhere. ***

export function useAsk() {
  const quotaFixtureEnabled =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    Boolean(process.env.EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE?.trim());
  const cloudGateEnabled = phase7Flags.cloudAsk || quotaFixtureEnabled;
  const shelf = useShelf();
  const plan = usePlan();
  const recs = useRecommendations();
  const profile = useProfileBits();
  const entitlement = useEntitlement({ enabled: cloudGateEnabled });
  const { data: ent } = entitlement;
  const ownerScope = useOwnerQueryScope();
  const boundary = useLocalDateBoundary();
  const period = boundary.localDate.slice(0, 7);
  const trialQuotaRequired =
    quotaFixtureEnabled ||
    (cloudGateEnabled &&
      entitlement.isSuccess &&
      ent !== undefined &&
      requiresTrialGroundedQuota(ent));
  const turnsOptions = useMemo(
    () => groundedTurnsQueryOptions(ownerScope, period, trialQuotaRequired),
    [ownerScope, period, trialQuotaRequired],
  );
  const turns = useQuery(turnsOptions);
  const readiness = deriveAskReadiness({
    local: [shelf, plan, recs, profile],
    quotaFixtureEnabled,
    turns,
  });
  const { isSuccess, isError } = readiness;
  const cloudGroundingReady =
    cloudGateEnabled &&
    entitlement.isSuccess &&
    (!trialQuotaRequired || turns.isSuccess);

  const ctx = useMemo<AskContext>(() => {
    const gate = askGate({
      isPro: ent?.isPro ?? false,
      inTrial: ent?.inTrial ?? false,
      inReverseTrial: ent?.inReverseTrial ?? false,
      groundedTurnsUsed: turns.data ?? 0,
    });
    const goal = profile.data?.goals[0] ?? null;
    return {
      conflicts: shelf.data?.unresolvedConflicts ?? [],
      hasShelfProducts: (shelf.data?.items.length ?? 0) > 0,
      pmSteps: (plan.data?.plan.pm ?? []).map((s) => ({ name: s.name, role: String(s.role) })),
      isExamplePlan: plan.data?.isExample ?? false,
      hasReplenish: hasReplenishmentSignal(shelf.data),
      topRec: pickFitRec(recs.result.recommendations),
      youreSet: recs.result.youreSet,
      goalConcernText: goal ? goalConcern(goal) : null,
      groundedAllowed: cloudGroundingReady && gate.groundedAllowed,
      groundedReason: groundedReasonForCloudReadiness(
        gate.reason,
        cloudGateEnabled,
        cloudGroundingReady,
      ),
    };
  }, [
    shelf.data,
    plan.data,
    recs.result,
    profile.data,
    ent,
    turns.data,
    cloudGateEnabled,
    cloudGroundingReady,
  ]);

  // Run a question through the deterministic engine, the runtime guard, and telemetry.
  const finalise = useCallback(
    (answer: AskAnswer): AskAnswer => {
      const guard = guardClaim(answer.claim);
      const guarded = guard.ok ? answer : safetyRefusal(answer.intent);
      // No shipped provider can reserve a grounded turn before delivery. Refuse any
      // unexpected grounded result until that provider keeps reservation, request,
      // cache publication, and delivery inside runGroundedTurnForOwner; post-answer
      // fire-and-forget accounting would permit quota and account-boundary races.
      const final = blockUnreservedGroundedAnswer(guarded);
      track('ask_turn', {
        kind: final.kind,
        grounded: false,
        refused: final.kind === 'refuse',
      });
      if (final.kind === 'escalate') track('ask_escalated_to_clinician');
      // The grounded (cloud) layer was gated. The Pro / trial-cap upsell funnel (docs/13 §15).
      if (final.kind === 'refuse' && final.intent === 'concern_q' && ctx.groundedReason) {
        track('ask_grounded_gated', { reason: ctx.groundedReason });
      }
      return final;
    },
    [ctx.groundedReason],
  );

  const ask = useCallback(
    (question: string): AskAnswer => {
      if (question.trim().length === 0) return safetyRefusal('out_of_scope');
      if (!isSuccess) return safetyRefusal('out_of_scope');
      return finalise(answerQuestion(question, ctx));
    },
    [ctx, finalise, isSuccess],
  );

  const askSuggested = useCallback(
    (prompt: 'conflict' | 'tonight' | 'fit'): AskAnswer =>
      isSuccess ? finalise(answerPrompt(prompt, ctx)) : safetyRefusal('out_of_scope'),
    [ctx, finalise, isSuccess],
  );

  async function retry(): Promise<{ isError: boolean }> {
    const results = await Promise.all([
      shelf.isError ? shelf.refetch() : Promise.resolve(),
      plan.isError ? plan.retry() : Promise.resolve(),
      recs.isError ? recs.retry() : Promise.resolve(),
      profile.isError ? profile.refetch() : Promise.resolve(),
      quotaFixtureEnabled && turns.isError ? turns.refetch() : Promise.resolve(),
    ]);
    return {
      isError: results.some(
        (result) => result && typeof result === 'object' && 'isError' in result && result.isError,
      ),
    };
  }

  return {
    ctx,
    ask,
    askSuggested,
    // Whether the user has any products on their shelf, so the screen can lead
    // proactively only when there is something real to answer about (docs/13 §14).
    hasShelf: isSuccess && ctx.hasShelfProducts,
    isLoading: readiness.isLoading,
    isError,
    isFetching: readiness.isFetching,
    isSuccess,
    retry,
  };
}
