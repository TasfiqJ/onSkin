import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { goalConcern } from '@/features/recommendations/copy';
import { useRecommendations } from '@/features/recommendations/useRecommendations';
import { usePlan } from '@/features/routine/usePlan';
import { useProfileBits } from '@/features/scheduler/profile';
import { useShelf } from '@/features/shelf/useShelf';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';

import { answerPrompt, answerQuestion, pickFitRec, safetyRefusal, type AskAnswer, type AskContext } from './answer';
import { askGate } from './gate';
import { guardClaim } from './guard';
import { getGroundedTurns } from './store';

// The Ask data layer (docs/13). Assembles the deterministic AskContext from the user's
// REAL state. The live shelf + its launch-gated conflicts (useShelf), tonight's plan
// (usePlan), the top genuine recommendation (useRecommendations), the shared profile/goal
// (useProfileBits). And the grounded-turn gate (entitlement + the per-period counter).
// Everything is local-first and offline-safe (B-SUPABASE); the deterministic advisor runs
// fully on-device at $0. The orchestration runs every answer through the runtime claim-
// safety guard and records CONTENT-FREE telemetry. *** No commercial input anywhere. ***

function billingPeriod(): string {
  return localDateString().slice(0, 7); // 'YYYY-MM'
}

export function useAsk() {
  const shelf = useShelf();
  const plan = usePlan();
  const recs = useRecommendations();
  const profile = useProfileBits();
  const { data: ent } = useEntitlement();
  const period = billingPeriod();
  const turns = useQuery({ queryKey: ['askGroundedTurns', period], queryFn: () => getGroundedTurns(period), retry: 0 });

  const ctx = useMemo<AskContext>(() => {
    const gate = askGate({
      isPro: ent?.isPro ?? false,
      inTrial: ent?.inTrial ?? false,
      inReverseTrial: ent?.inReverseTrial ?? false,
      groundedTurnsUsed: turns.data ?? 0,
    });
    const goal = profile.data?.goals[0] ?? null;
    return {
      conflicts: shelf.data?.conflicts ?? [],
      pmSteps: (plan.data?.plan.pm ?? []).map((s) => ({ name: s.name, role: String(s.role) })),
      isExamplePlan: plan.data?.isExample ?? false,
      hasReplenish: (shelf.data?.items ?? []).some(
        (i) => i.badge.kind === 'countdown' || i.badge.kind === 'expired',
      ),
      topRec: pickFitRec(recs.result.recommendations),
      youreSet: recs.result.youreSet,
      goalConcernText: goal ? goalConcern(goal) : null,
      groundedAllowed: gate.groundedAllowed,
      groundedReason: gate.reason,
    };
  }, [shelf.data, plan.data, recs.result, profile.data, ent, turns.data]);

  // Run a question through the deterministic engine, the runtime guard, and telemetry.
  const finalise = useCallback(
    (answer: AskAnswer): AskAnswer => {
      const guard = guardClaim(answer.claim);
      const final = guard.ok ? answer : safetyRefusal(answer.intent);
      track('ask_turn', {
        intent: final.intent,
        kind: final.kind,
        grounded: final.kind === 'grounded',
        refused: final.kind === 'refuse',
        escalated: final.kind === 'escalate',
      });
      if (final.kind === 'escalate') track('ask_escalated_to_clinician', { intent: final.intent });
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
      return finalise(answerQuestion(question, ctx));
    },
    [ctx, finalise],
  );

  const askSuggested = useCallback(
    (prompt: 'conflict' | 'tonight' | 'fit'): AskAnswer => finalise(answerPrompt(prompt, ctx)),
    [ctx, finalise],
  );

  return {
    ctx,
    ask,
    askSuggested,
    isLoading: shelf.isLoading || plan.isLoading || recs.isLoading,
  };
}
