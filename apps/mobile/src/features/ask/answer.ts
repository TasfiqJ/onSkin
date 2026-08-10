import type {
  AskAnswerKind,
  AskIntent,
  ConflictSeverity,
  EvidenceLabel,
  RecommendationTrigger,
} from '@layerwell/types';
import type { Href } from 'expo-router';

import {
  isReassuring,
  isAdmittedDetectedConflict,
  type ConflictEvaluationStatus,
  type DetectedConflict,
} from '@/features/intelligence/engine';
import { evidenceChip, severityLabel } from '@/features/intelligence/presentation';

import { ASK_COPY } from './copy';
import { classifyIntent } from './intent';

// The pure, deterministic, TEMPLATE-BOUNDED answer engine (docs/13 §4, D-057). Every
// substantive claim is filled from the deterministic engine output + already-claim-safe
// copy. The model never free-generates a health claim. The `claim` field is the
// guard-scanned substantive sentence; `note` is a DATA line (product/plan names, which
// may carry a "7%") rendered separately and never scanned. Pure + unit-tested.

export type AskCitation = { label: string; evidence: string };

export type AskAnswer = {
  intent: AskIntent;
  kind: AskAnswerKind;
  /** The mono status badge (e.g. "answered by your conflict engine · $0"). */
  badge: string | null;
  /** The topic/pair title. Built from TAG labels, so always %-free. */
  headline: string | null;
  /** The substantive, claim-safe, template-bounded sentence (guard-scanned). */
  claim: string;
  why: string | null;
  how: string | null;
  citation: AskCitation | null;
  severity: ConflictSeverity | null;
  severityText: string | null;
  /** A non-claim DATA line (product/plan names. May contain "7%"; NOT guard-scanned). */
  note: string | null;
  recommendationNote: boolean;
  claimSafeNote: boolean;
  cta: { label: string; route: Href } | null;
  footnote: string | null;
};

export type AskRecSummary = {
  what: string;
  example: string | null;
  evidenceLabel: EvidenceLabel | null;
};

export type AskShelfProduct = {
  id: string;
  name: string;
};

export type AskContext = {
  /** The launch-gated conflicts for the user's real shelf (useShelf().data.conflicts). */
  conflicts: DetectedConflict[];
  /** Stable identifiers + display names used to bind typed conflict questions to one exact pair. */
  shelfProducts: readonly AskShelfProduct[];
  /** Empty conflict lists can mean "nothing clashes" or "nothing was available to check". */
  hasShelfProducts: boolean;
  /** Exact active shelf count, used to reject an impossible no-pair coverage state. */
  shelfProductCount: number;
  conflictCoverageStatus?: ConflictEvaluationStatus;
  /** Tonight's PM steps in order, from the generated plan (usePlan). */
  pmSteps: { name: string; role: string }[];
  isExamplePlan: boolean;
  /** Whether the shelf has a tracked freshness or finished-product replacement signal. */
  hasReplenish: boolean;
  /** The top genuine recommendation, for the deterministic product-fit answer. */
  topRec: AskRecSummary | null;
  youreSet: boolean;
  /** The user's first goal as a cosmetic-appearance phrase (e.g. "a more even-looking tone"). */
  goalConcernText: string | null;
  /** From askGate. Whether a cloud-grounded turn is permitted, and why not. */
  groundedAllowed: boolean;
  groundedReason: 'free_locked' | 'cap_reached' | null;
};

const BLANK = {
  badge: null,
  headline: null,
  why: null,
  how: null,
  citation: null,
  severity: null,
  severityText: null,
  note: null,
  recommendationNote: false,
  claimSafeNote: false,
  cta: null,
  footnote: null,
} as const;

/** A tag-based pair title. Never a raw product name, so always %-free and guard-clean. */
function shelfNote(c: DetectedConflict): string | null {
  if (c.productAName && c.productBName) return `Your ${c.productAName} and ${c.productBName}`;
  return null;
}

function escalate(intent: AskIntent): AskAnswer {
  // VERBAL escalation only. No CTA. There is no in-app dermatologist finder yet, and a
  // medical escalation must never route to a non-clinician surface (docs/13 §9).
  return {
    ...BLANK,
    intent,
    kind: 'escalate',
    badge: ASK_COPY.escalate.eyebrow,
    claim: ASK_COPY.escalate.body,
    footnote: ASK_COPY.escalate.footnote,
  };
}

function refuse(intent: AskIntent, claim: string): AskAnswer {
  return { ...BLANK, intent, kind: 'refuse', claim };
}

function normalisePairText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

/**
 * Resolve exactly two shelf rows from their complete normalized display names.
 * Partial aliases, duplicate names, and questions naming any other number of rows
 * deliberately fail closed: they cannot identify one exact product pair.
 */
export function resolveRequestedShelfPair(
  question: string,
  shelfProducts: readonly AskShelfProduct[],
): [string, string] | null {
  const normalizedQuestion = ` ${normalisePairText(question)} `;
  if (normalizedQuestion.trim().length === 0) return null;

  const matchedIds: string[] = [];
  const seenIds = new Set<string>();
  const idsByNormalizedName = new Map<string, Set<string>>();

  for (const product of shelfProducts) {
    const normalizedName = normalisePairText(product.name);
    if (!normalizedName) continue;
    const ids = idsByNormalizedName.get(normalizedName) ?? new Set<string>();
    ids.add(product.id);
    idsByNormalizedName.set(normalizedName, ids);
  }

  for (const [normalizedName, ids] of idsByNormalizedName) {
    if (!normalizedQuestion.includes(` ${normalizedName} `)) continue;
    // Identical display names cannot identify a specific stored product.
    if (ids.size !== 1) return null;
    const [id] = ids;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      matchedIds.push(id);
    }
  }

  if (matchedIds.length !== 2) return null;
  return matchedIds.sort((a, b) => a.localeCompare(b)) as [string, string];
}

function conflictMatchesPair(conflict: DetectedConflict, pair: readonly [string, string]): boolean {
  if (!conflict.productAId || !conflict.productBId) return false;
  const conflictPair = [conflict.productAId, conflict.productBId].sort((a, b) =>
    a.localeCompare(b),
  );
  return conflictPair[0] === pair[0] && conflictPair[1] === pair[1];
}

function conflictAnswer(intent: AskIntent, ctx: AskContext): AskAnswer {
  const admittedConflicts = ctx.conflicts.filter(isAdmittedDetectedConflict);
  // SAFETY conflicts (e.g. a pregnancy contraindication) are NEVER "you're set". They must
  // route to a calm clinician-caution answer BEFORE the top/reassurance/noConflicts logic,
  // so a contraindication is never silently dropped and contradicted (docs/13 §4 escalate).
  const safety = admittedConflicts.find((c) => c.rule.interactionType === 'safety');
  if (safety) {
    return {
      ...BLANK,
      intent,
      kind: 'escalate',
      badge: safety.rule.copy.interactionLabel,
      headline: safety.rule.copy.askHeadline,
      claim: safety.rule.copy.askClaim,
      why: safety.rule.copy.mechanism,
      how: safety.rule.copy.resolution,
      citation: {
        label: safety.rule.copy.sourceSummary,
        evidence: safety.rule.copy.evidenceLabel,
      },
      severity: safety.computedSeverity,
      severityText: safety.rule.copy.severityLabel,
      note: shelfNote(safety),
    };
  }
  const top = admittedConflicts.find(
    (c) => !isReassuring(c) && c.rule.interactionType !== 'safety' && c.computedSeverity !== 'none',
  );
  if (top) {
    return {
      ...BLANK,
      intent,
      kind: 'deterministic',
      badge: ASK_COPY.badges.deterministic,
      headline: top.rule.copy.askHeadline,
      claim: top.rule.copy.askClaim,
      why: top.rule.copy.mechanism,
      how: top.rule.copy.resolution,
      citation: { label: top.rule.copy.sourceSummary, evidence: evidenceChip(top) },
      severity: top.computedSeverity,
      severityText: severityLabel(top),
      note: shelfNote(top),
      recommendationNote: true,
    };
  }
  const reassurance = admittedConflicts.find(isReassuring);
  if (reassurance) {
    return {
      ...BLANK,
      intent,
      kind: 'deterministic',
      badge: ASK_COPY.badges.deterministic,
      headline: reassurance.rule.copy.askHeadline,
      claim: reassurance.rule.copy.askClaim,
      why: reassurance.rule.copy.mechanism,
      how: reassurance.rule.copy.resolution,
      citation: {
        label: reassurance.rule.copy.sourceSummary,
        evidence: evidenceChip(reassurance),
      },
    };
  }
  if (!ctx.hasShelfProducts) {
    return {
      ...BLANK,
      intent,
      kind: 'deterministic',
      badge: ASK_COPY.badges.deterministic,
      claim: ASK_COPY.emptyShelfConflict,
    };
  }
  if (ctx.conflictCoverageStatus === 'not_applicable') {
    if (ctx.shelfProductCount >= 2) {
      return {
        ...BLANK,
        intent,
        kind: 'refuse',
        claim: ASK_COPY.conflictCoverageUnavailable,
      };
    }
    return {
      ...BLANK,
      intent,
      kind: 'deterministic',
      badge: ASK_COPY.badges.deterministic,
      claim: ASK_COPY.noConflictPair,
    };
  }
  if (ctx.conflictCoverageStatus !== 'compatible') {
    return {
      ...BLANK,
      intent,
      kind: 'refuse',
      claim: ASK_COPY.conflictCoverageUnavailable,
    };
  }
  return {
    ...BLANK,
    intent,
    kind: 'deterministic',
    badge: ASK_COPY.badges.deterministic,
    claim: ASK_COPY.noConflicts,
  };
}

function conflictQuestionAnswer(question: string, ctx: AskContext): AskAnswer {
  const requestedPair = resolveRequestedShelfPair(question, ctx.shelfProducts);
  if (!requestedPair) return refuse('conflict_q', ASK_COPY.refuse.outOfScope);

  return conflictAnswer('conflict_q', {
    ...ctx,
    conflicts: ctx.conflicts.filter((conflict) => conflictMatchesPair(conflict, requestedPair)),
  });
}

function routineAnswer(intent: AskIntent, ctx: AskContext): AskAnswer {
  if (ctx.pmSteps.length === 0) {
    return {
      ...BLANK,
      intent,
      kind: 'deterministic',
      badge: ASK_COPY.badges.deterministic,
      claim: ASK_COPY.tonight.empty,
    };
  }
  return {
    ...BLANK,
    intent,
    kind: 'deterministic',
    badge: ASK_COPY.badges.deterministic,
    claim: ctx.isExamplePlan ? ASK_COPY.tonight.exampleLead : ASK_COPY.tonight.lead,
    how: ASK_COPY.triad.howPlan,
    note: ctx.pmSteps.map((s) => s.name).join(' → '),
    cta: { label: ASK_COPY.tonight.cta, route: ASK_COPY.tonight.route },
  };
}

function replenishAnswer(intent: AskIntent, ctx: AskContext): AskAnswer {
  if (!ctx.hasReplenish) {
    return {
      ...BLANK,
      intent,
      kind: 'deterministic',
      badge: ASK_COPY.badges.deterministic,
      claim: ASK_COPY.replenish.none,
    };
  }
  return {
    ...BLANK,
    intent,
    kind: 'deterministic',
    badge: ASK_COPY.badges.deterministic,
    claim: ASK_COPY.replenish.lead,
    cta: { label: ASK_COPY.replenish.cta, route: ASK_COPY.replenish.route },
  };
}

function fitAnswer(intent: AskIntent, ctx: AskContext): AskAnswer {
  if (!ctx.topRec) {
    // A filtered-out recommendation is not evidence that the routine is complete.
    // Likewise, open conflict coverage cannot support a reassuring fit conclusion.
    // Reuse the canonical refuse-over-guess response until the fit engine positively
    // reports "you're set" and interaction coverage is positively compatible.
    // A missing, not-applicable, or interaction-bearing state is not compatibility.
    if (!ctx.youreSet || ctx.conflictCoverageStatus !== 'compatible') {
      return refuse(intent, ASK_COPY.refuse.outOfScope);
    }
    return {
      ...BLANK,
      intent,
      kind: 'deterministic',
      badge: ASK_COPY.badges.fitEngine,
      claim: ASK_COPY.fit.youreSet,
      how: ASK_COPY.triad.howFit,
      footnote: ASK_COPY.fit.deeperNote,
    };
  }
  const rec = ctx.topRec;
  const claim = ctx.goalConcernText
    ? ASK_COPY.fit.leadGoal(ctx.goalConcernText, rec.what)
    : ASK_COPY.fit.leadGeneric(rec.what);
  return {
    ...BLANK,
    intent,
    kind: 'deterministic',
    badge: ASK_COPY.badges.fitEngine,
    claim,
    why: ASK_COPY.triad.whyShelf,
    how: ASK_COPY.triad.howFit,
    // A bare evidence grade does not identify the source, reviewed claim, or
    // scope it substantiates. Keep the deterministic fit result neutral until
    // an exact, independently reviewed citation contract is available.
    citation: null,
    note: rec.example,
    claimSafeNote: true,
    footnote: ASK_COPY.fit.deeperNote,
  };
}

function concernAnswer(intent: AskIntent, ctx: AskContext): AskAnswer {
  // The genuinely corpus-grounded path. The cloud layer is gated (Pro) and currently
  // blocked (B-AI-ASSISTANT-VENDOR), so degrade honestly. Never free-generate.
  const claim =
    ctx.groundedReason === 'free_locked'
      ? ASK_COPY.refuse.groundedLocked
      : ASK_COPY.refuse.groundedSetup;
  return { ...BLANK, intent, kind: 'refuse', claim };
}

/** Route a question to a template-bounded, claim-safe answer (docs/13 §4). */
export function answerQuestion(question: string, ctx: AskContext): AskAnswer {
  const intent = classifyIntent(question);
  switch (intent) {
    case 'medical':
      return escalate(intent);
    case 'conflict_q':
      return conflictQuestionAnswer(question, ctx);
    case 'routine_q':
      return routineAnswer(intent, ctx);
    case 'replenish_q':
      return replenishAnswer(intent, ctx);
    case 'product_fit_q':
      return fitAnswer(intent, ctx);
    case 'concern_q':
      return concernAnswer(intent, ctx);
    case 'unsupported':
      return refuse(intent, ASK_COPY.refuse.unsupported);
    case 'out_of_scope':
      return refuse(intent, ASK_COPY.refuse.outOfScope);
  }
  // Unreachable (the switch is exhaustive over AskIntent). Refuse-over-guess by default.
  return refuse('out_of_scope', ASK_COPY.refuse.outOfScope);
}

/** Answer one of the three home suggested-prompts directly (deterministic, $0). */
export function answerPrompt(prompt: 'conflict' | 'tonight' | 'fit', ctx: AskContext): AskAnswer {
  if (prompt === 'conflict') return conflictAnswer('conflict_q', ctx);
  if (prompt === 'tonight') return routineAnswer('routine_q', ctx);
  return fitAnswer('product_fit_q', ctx);
}

/** The refuse-over-guess fallback (docs/13 §4): used when the runtime guard flags an
 *  answer (a regression. Template-bounded claims should never flag) or input is empty. */
export function safetyRefusal(intent: AskIntent): AskAnswer {
  return refuse(intent, ASK_COPY.refuse.outOfScope);
}

// FIT-appropriate triggers: catalog-backed, type-first recommendations whose `what` is a
// clean TYPE name ("A vitamin C serum"). The shelf-anchored replacement/conflict triggers
// embed RAW product names (e.g. "Your Glycolic 7% Toner reached its freshness date"), whose "7%" would
// false-trip the runtime dosage guard and silently refuse a valid fit answer (docs/13 §4).
const FIT_TRIGGERS = new Set<RecommendationTrigger>([
  'gap',
  'routine_completion',
  'better_fit',
  'goal',
]);

/** Pick the product-fit recommendation: the top catalog-backed, %-free option, or null.
 *  The caller must use the engine's separate `youreSet` result before making a complete-
 *  routine claim. Keeps raw product-name DATA out of the scanned claim. */
export function pickFitRec(
  recs: {
    trigger: RecommendationTrigger;
    what: string;
    example: string | null;
    evidenceLabel: EvidenceLabel | null;
  }[],
): AskRecSummary | null {
  const r = recs.find((x) => FIT_TRIGGERS.has(x.trigger));
  return r ? { what: r.what, example: r.example, evidenceLabel: r.evidenceLabel } : null;
}
