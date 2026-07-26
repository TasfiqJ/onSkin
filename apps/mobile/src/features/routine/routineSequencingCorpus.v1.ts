import type { RoutinePhase, SequencingRole } from '@onskin/types';

import {
  canonicalJson,
  canonicalSha256,
  conflictEd25519PublicKeyFingerprint,
} from '@/features/intelligence/conflictRuleCorpus.v1';

export type RoutineSequencingCandidateRule = {
  role: SequencingRole;
  basePriority: number;
  amEligible: boolean;
  pmEligible: boolean;
  defaultPhase: RoutinePhase;
  notes: string;
  ruleVersion: number;
  /** Legacy metadata only. It is never publication authority. */
  reviewedBy: string | null;
  candidateDisposition: 'draft_blocked' | 'approved';
};

export type RoutineSequencingSourceRecord = {
  sourceId: string;
  title: string;
  sourceUrl: string;
  snapshotDate: string;
  /**
   * A URL and access date are not retained evidence. Admission requires all
   * three fields to identify the exact immutable artifact reviewed by the
   * signers. Candidate sources deliberately leave them null until that
   * artifact exists.
   */
  retainedArtifactId: string | null;
  retainedArtifactRef: string | null;
  retainedArtifactSha256: string | null;
  propositions: readonly {
    propositionId: string;
    statement: string;
  }[];
  reviewStatus: 'candidate_unreviewed' | 'reviewed';
};

export type RoutineGuidanceClaimId =
  | `sequencing.${SequencingRole}`
  | 'cadence.frequency_caps'
  | 'cadence.cycle_recovery_nights'
  | 'cadence.ramp'
  | 'cadence.phased_introduction'
  | 'cadence.recovery_windows'
  | 'copy.daily_am_instruction'
  | 'copy.phased_introduction_note'
  | 'copy.recovery_irritation'
  | 'copy.recovery_procedure'
  | 'copy.ramp_irritation';

export type RoutineGuidanceClaimMapping = {
  claimId: RoutineGuidanceClaimId;
  /** Sources that substantiate this exact runtime claim, not a topic generally. */
  sourceIds: readonly string[];
  /** Propositions must exist on one of the referenced source records. */
  propositionIds: readonly string[];
};

export type RoutineStopReferThreshold = {
  thresholdId: string;
  trigger: string;
  userCopy: string;
  action: 'stop_and_seek_professional_care';
  sourceIds: readonly string[];
  propositionIds: readonly string[];
};

export type RoutineStopReferPolicy =
  | {
      status: 'unavailable_pending_review';
      thresholds: readonly [];
    }
  | {
      status: 'approved';
      thresholds: readonly RoutineStopReferThreshold[];
    };

export type RoutineCadencePolicy = {
  candidateDisposition: 'draft_blocked' | 'approved';
  frequencyCapsPerWeek: {
    aha: { sensitive: number; normal: number; resistant: number };
    bha: { sensitive: number; normal: number; resistant: number };
    retinoid: { sensitive: number; normal: number; resistant: number };
  };
  cycleRecoveryNights: {
    classic: { betweenPushes: number; trailing: number };
    gentle: { betweenPushes: number; trailing: number };
    advanced: { betweenPushes: number; trailing: number };
    custom: { betweenPushes: number; trailing: number };
  };
  minimumBetweenRepeatedPotentSlotNights: number;
  minimumRecoveryNightsPerCycle: number;
  ramp: {
    sensitiveOrNormalStartPerWeek: number;
    sensitiveOrNormalTargetPerWeek: number;
    resistantStartPerWeek: number;
    resistantTargetPerWeek: number;
    otherActivePerWeek: number;
    minimumPerWeek: number;
    maximumPerWeek: number;
    stepUpIncrementPerWeek: number;
    irritationStepDownPerWeek: number;
    minimumStableDaysBeforeOffer: number;
  };
  phasedIntroductionDelayDays: number;
  recoveryWindows: {
    procedureChoicesDays: readonly number[];
    defaultProcedureDays: number;
    irritationDays: number;
  };
  stopRefer: RoutineStopReferPolicy;
};

export type RoutineGuidanceCopy = {
  dailyAmInstruction: string;
  phasedIntroductionNoteTemplate: string;
  recoveryIrritationExplanation: string;
  recoveryProcedureExplanation: string;
  rampIrritationExplanation: string;
};

export type RoutineSequencingCorpusContent = {
  schemaVersion: 1;
  policyId: string;
  policyVersion: number;
  targetJurisdictions: readonly string[];
  marketScopePolicyId: string;
  marketScopeSha256: string;
  sources: readonly RoutineSequencingSourceRecord[];
  claimMappings: readonly RoutineGuidanceClaimMapping[];
  rules: readonly RoutineSequencingCandidateRule[];
  cadencePolicy: RoutineCadencePolicy;
  copy: RoutineGuidanceCopy;
};

export type RoutineSequencingCorpus = {
  status: 'draft_blocked' | 'approved';
  content: RoutineSequencingCorpusContent;
  contentSha256: string;
};

export type RoutineSequencingReviewRole =
  | 'board_certified_dermatologist'
  | 'cosmetic_chemist'
  | 'regulatory_counsel';

export type RoutineSequencingReviewScope =
  | 'clinical_order_eligibility_and_user_copy'
  | 'formulation_order_and_application_copy'
  | 'claims_jurisdiction_and_market_clearance';

export type RoutineSequencingTrustedAuthority = {
  authorityId: string;
  reviewerRole: RoutineSequencingReviewRole;
  reviewerIdentityKey: string;
  credentialEvidenceRef: string;
  credentialEvidenceSha256: string;
  publicKeyBase64: string;
  publicKeySha256: string;
};

export type RoutineSequencingReviewReceipt = {
  receiptId: string;
  authorityId: string;
  reviewerRole: RoutineSequencingReviewRole;
  reviewScope: RoutineSequencingReviewScope;
  reviewerIdentityKey: string;
  credentialEvidenceRef: string;
  credentialEvidenceSha256: string;
  authorityPublicKeySha256: string;
  corpusSha256: string;
  sourceRegistrySha256: string;
  exactRuleCount: number;
  exactRuleHashes: readonly {
    role: SequencingRole;
    ruleVersion: number;
    ruleContentSha256: string;
  }[];
  targetJurisdictions: readonly string[];
  marketScopePolicyId: string;
  marketScopeSha256: string;
  decision: 'approve' | 'reject';
  signedAt: string;
  expiresAt: string;
  signedBodySha256: string;
  detachedSignatureBase64: string;
};

export type AdmittedRoutineSequencingCorpus = {
  corpusSha256: string;
  rules: readonly RoutineSequencingCandidateRule[];
  cadencePolicy: RoutineCadencePolicy;
  copy: RoutineGuidanceCopy;
  receiptIds: readonly [string, string, string];
};

export const ROUTINE_SEQUENCING_MARKET_SCOPE_POLICY = {
  policyId: 'routinekind-us-wave1-routine-guidance-market-gate-v1',
  targetJurisdictions: ['US'],
  sourceDocumentPath: 'docs/hugeToDo/CORE-03-ROUTINE-GUIDANCE-SOURCE-CHECKPOINT-2026-07-26.md',
  excludedMarkets: ['CA', 'CA-QC'],
  rule: 'Routine sequencing guidance remains unavailable outside the exact independently reviewed U.S. wave-1 scope.',
} as const;

// A reviewer identity string or receipt cannot create a trust root. Adding a
// trusted key requires a separately reviewed source change.
export const ROUTINE_SEQUENCING_TRUSTED_AUTHORITIES: readonly RoutineSequencingTrustedAuthority[] =
  [];
export const ROUTINE_SEQUENCING_REVIEW_RECEIPTS: readonly RoutineSequencingReviewReceipt[] = [];
export const ROUTINE_SEQUENCING_TRUST_ROOT_BLOCKER =
  'empty_trust_registry_and_detached_signature_verifier_not_implemented' as const;
export const ROUTINE_STOP_REFER_EVALUATOR_BLOCKER =
  'exact_stop_refer_threshold_evaluator_not_implemented' as const;
export const ROUTINE_EXPLAINABILITY_COPY_BINDING_BLOCKER =
  'why_tonight_and_phased_intro_exact_copy_not_corpus_bound' as const;

/**
 * An approved policy is data, not executable triage. This remains a separate
 * fail-closed boundary until code can evaluate every exact threshold and emit
 * its signed copy without fallback or reinterpretation.
 */
export function isRoutineStopReferEvaluatorImplemented(
  _policy: Extract<RoutineStopReferPolicy, { status: 'approved' }>,
): boolean {
  return false;
}

/** Claim-bearing explainability screens remain closed until every production
 * branch renders exact corpus-bound copy instead of local JSX literals. */
export function isRoutineExplainabilityCopyBindingImplemented(): boolean {
  return false;
}

const EXPECTED_ROLES: readonly SequencingRole[] = [
  'cleanser',
  'toner',
  'antioxidant',
  'hydrating_serum',
  'treatment',
  'exfoliant',
  'eye',
  'moisturiser',
  'oil',
  'spf',
];

const EXPECTED_CLAIM_IDS: readonly RoutineGuidanceClaimId[] = [
  ...EXPECTED_ROLES.map((role) => `sequencing.${role}` as RoutineGuidanceClaimId),
  'cadence.frequency_caps',
  'cadence.cycle_recovery_nights',
  'cadence.ramp',
  'cadence.phased_introduction',
  'cadence.recovery_windows',
  'copy.daily_am_instruction',
  'copy.phased_introduction_note',
  'copy.recovery_irritation',
  'copy.recovery_procedure',
  'copy.ramp_irritation',
];

function hasSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function hasEvidenceReference(value: string): boolean {
  return value.trim().length >= 3 && !/^(?:todo|tbd|unknown|null)$/iu.test(value.trim());
}

function hasTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function expectedScope(role: RoutineSequencingReviewRole): RoutineSequencingReviewScope {
  if (role === 'board_certified_dermatologist') {
    return 'clinical_order_eligibility_and_user_copy';
  }
  if (role === 'cosmetic_chemist') {
    return 'formulation_order_and_application_copy';
  }
  return 'claims_jurisdiction_and_market_clearance';
}

export function isRoutineSequencingCorpusContentValidForAdmission(
  content: RoutineSequencingCorpusContent,
): boolean {
  if (
    content.schemaVersion !== 1 ||
    !hasEvidenceReference(content.policyId) ||
    !Number.isInteger(content.policyVersion) ||
    content.policyVersion < 1 ||
    canonicalJson(content.targetJurisdictions) !== canonicalJson(['US']) ||
    content.marketScopePolicyId !== ROUTINE_SEQUENCING_MARKET_SCOPE_POLICY.policyId ||
    content.marketScopeSha256 !== canonicalSha256(ROUTINE_SEQUENCING_MARKET_SCOPE_POLICY) ||
    content.sources.length === 0 ||
    new Set(content.sources.map((source) => source.sourceId)).size !== content.sources.length ||
    content.sources.some(
      (source) =>
        !hasEvidenceReference(source.sourceId) ||
        !hasEvidenceReference(source.title) ||
        !/^https:\/\//u.test(source.sourceUrl) ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(source.snapshotDate) ||
        source.retainedArtifactId === null ||
        !hasEvidenceReference(source.retainedArtifactId) ||
        source.retainedArtifactRef === null ||
        !hasEvidenceReference(source.retainedArtifactRef) ||
        source.retainedArtifactSha256 === null ||
        !hasSha256(source.retainedArtifactSha256) ||
        source.propositions.length === 0 ||
        source.propositions.some(
          (proposition) =>
            !hasEvidenceReference(proposition.propositionId) ||
            !hasEvidenceReference(proposition.statement),
        ) ||
        source.reviewStatus !== 'reviewed',
    ) ||
    content.claimMappings.length !== EXPECTED_CLAIM_IDS.length ||
    content.rules.length !== EXPECTED_ROLES.length ||
    content.cadencePolicy.candidateDisposition !== 'approved' ||
    content.cadencePolicy.stopRefer.status !== 'approved' ||
    content.cadencePolicy.stopRefer.thresholds.length === 0 ||
    !Number.isSafeInteger(content.cadencePolicy.phasedIntroductionDelayDays) ||
    content.cadencePolicy.phasedIntroductionDelayDays < 1 ||
    !Number.isSafeInteger(content.cadencePolicy.ramp.minimumStableDaysBeforeOffer) ||
    content.cadencePolicy.ramp.minimumStableDaysBeforeOffer < 1 ||
    !hasEvidenceReference(content.copy.dailyAmInstruction) ||
    !hasEvidenceReference(content.copy.phasedIntroductionNoteTemplate) ||
    !content.copy.phasedIntroductionNoteTemplate.includes('{productNames}') ||
    !hasEvidenceReference(content.copy.recoveryIrritationExplanation) ||
    !hasEvidenceReference(content.copy.recoveryProcedureExplanation) ||
    !hasEvidenceReference(content.copy.rampIrritationExplanation)
  ) {
    return false;
  }

  const sourceIds = new Set(content.sources.map((source) => source.sourceId));
  const propositionOwners = new Map<string, string>();
  for (const source of content.sources) {
    if (
      source.propositions.some((proposition) => propositionOwners.has(proposition.propositionId))
    ) {
      return false;
    }
    for (const proposition of source.propositions) {
      propositionOwners.set(proposition.propositionId, source.sourceId);
    }
  }
  const seenClaimIds = new Set<RoutineGuidanceClaimId>();
  for (const mapping of content.claimMappings) {
    if (
      !EXPECTED_CLAIM_IDS.includes(mapping.claimId) ||
      seenClaimIds.has(mapping.claimId) ||
      mapping.sourceIds.length === 0 ||
      mapping.propositionIds.length === 0 ||
      new Set(mapping.sourceIds).size !== mapping.sourceIds.length ||
      new Set(mapping.propositionIds).size !== mapping.propositionIds.length ||
      mapping.sourceIds.some((sourceId) => !sourceIds.has(sourceId)) ||
      mapping.propositionIds.some((propositionId) => {
        const owner = propositionOwners.get(propositionId);
        return owner === undefined || !mapping.sourceIds.includes(owner);
      })
    ) {
      return false;
    }
    seenClaimIds.add(mapping.claimId);
  }
  if (!EXPECTED_CLAIM_IDS.every((claimId) => seenClaimIds.has(claimId))) {
    return false;
  }

  const numericCadenceValues = [
    ...Object.values(content.cadencePolicy.frequencyCapsPerWeek).flatMap((caps) =>
      Object.values(caps),
    ),
    ...Object.values(content.cadencePolicy.cycleRecoveryNights).flatMap((recovery) =>
      Object.values(recovery),
    ),
    content.cadencePolicy.minimumBetweenRepeatedPotentSlotNights,
    content.cadencePolicy.minimumRecoveryNightsPerCycle,
    content.cadencePolicy.ramp.sensitiveOrNormalStartPerWeek,
    content.cadencePolicy.ramp.sensitiveOrNormalTargetPerWeek,
    content.cadencePolicy.ramp.resistantStartPerWeek,
    content.cadencePolicy.ramp.resistantTargetPerWeek,
    content.cadencePolicy.ramp.otherActivePerWeek,
    content.cadencePolicy.ramp.minimumPerWeek,
    content.cadencePolicy.ramp.maximumPerWeek,
    content.cadencePolicy.ramp.stepUpIncrementPerWeek,
    content.cadencePolicy.ramp.irritationStepDownPerWeek,
    ...content.cadencePolicy.recoveryWindows.procedureChoicesDays,
    content.cadencePolicy.recoveryWindows.defaultProcedureDays,
    content.cadencePolicy.recoveryWindows.irritationDays,
    content.cadencePolicy.minimumBetweenRepeatedPotentSlotNights,
    content.cadencePolicy.minimumRecoveryNightsPerCycle,
  ];
  const positiveCadenceValues = [
    ...Object.values(content.cadencePolicy.frequencyCapsPerWeek).flatMap((caps) =>
      Object.values(caps),
    ),
    content.cadencePolicy.ramp.sensitiveOrNormalStartPerWeek,
    content.cadencePolicy.ramp.sensitiveOrNormalTargetPerWeek,
    content.cadencePolicy.ramp.resistantStartPerWeek,
    content.cadencePolicy.ramp.resistantTargetPerWeek,
    content.cadencePolicy.ramp.otherActivePerWeek,
    content.cadencePolicy.ramp.minimumPerWeek,
    content.cadencePolicy.ramp.maximumPerWeek,
    content.cadencePolicy.ramp.stepUpIncrementPerWeek,
    content.cadencePolicy.ramp.irritationStepDownPerWeek,
    ...content.cadencePolicy.recoveryWindows.procedureChoicesDays,
    content.cadencePolicy.recoveryWindows.defaultProcedureDays,
    content.cadencePolicy.recoveryWindows.irritationDays,
  ];
  if (
    numericCadenceValues.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    positiveCadenceValues.some((value) => value < 1) ||
    content.cadencePolicy.ramp.sensitiveOrNormalStartPerWeek >
      content.cadencePolicy.ramp.sensitiveOrNormalTargetPerWeek ||
    content.cadencePolicy.ramp.resistantStartPerWeek >
      content.cadencePolicy.ramp.resistantTargetPerWeek ||
    content.cadencePolicy.ramp.minimumPerWeek >
      content.cadencePolicy.ramp.sensitiveOrNormalStartPerWeek ||
    content.cadencePolicy.ramp.minimumPerWeek > content.cadencePolicy.ramp.resistantStartPerWeek ||
    content.cadencePolicy.ramp.maximumPerWeek <
      content.cadencePolicy.ramp.sensitiveOrNormalTargetPerWeek ||
    content.cadencePolicy.ramp.maximumPerWeek < content.cadencePolicy.ramp.resistantTargetPerWeek ||
    content.cadencePolicy.ramp.otherActivePerWeek < content.cadencePolicy.ramp.minimumPerWeek ||
    content.cadencePolicy.ramp.otherActivePerWeek > content.cadencePolicy.ramp.maximumPerWeek ||
    Object.values(content.cadencePolicy.frequencyCapsPerWeek).some((caps) =>
      Object.values(caps).some((value) => value > content.cadencePolicy.ramp.maximumPerWeek),
    ) ||
    content.cadencePolicy.ramp.stepUpIncrementPerWeek >
      content.cadencePolicy.ramp.maximumPerWeek - content.cadencePolicy.ramp.minimumPerWeek ||
    content.cadencePolicy.ramp.irritationStepDownPerWeek >
      content.cadencePolicy.ramp.maximumPerWeek - content.cadencePolicy.ramp.minimumPerWeek ||
    !content.cadencePolicy.recoveryWindows.procedureChoicesDays.includes(
      content.cadencePolicy.recoveryWindows.defaultProcedureDays,
    ) ||
    new Set(content.cadencePolicy.recoveryWindows.procedureChoicesDays).size !==
      content.cadencePolicy.recoveryWindows.procedureChoicesDays.length ||
    Object.values(content.cadencePolicy.cycleRecoveryNights).some(
      (recovery) => recovery.betweenPushes + recovery.trailing < 1,
    )
  ) {
    return false;
  }

  if (
    new Set(content.cadencePolicy.stopRefer.thresholds.map((threshold) => threshold.thresholdId))
      .size !== content.cadencePolicy.stopRefer.thresholds.length ||
    content.cadencePolicy.stopRefer.thresholds.some(
      (threshold) =>
        !hasEvidenceReference(threshold.thresholdId) ||
        !hasEvidenceReference(threshold.trigger) ||
        !hasEvidenceReference(threshold.userCopy) ||
        threshold.action !== 'stop_and_seek_professional_care' ||
        threshold.sourceIds.length === 0 ||
        threshold.propositionIds.length === 0 ||
        threshold.sourceIds.some((sourceId) => !sourceIds.has(sourceId)) ||
        threshold.propositionIds.some((propositionId) => {
          const owner = propositionOwners.get(propositionId);
          return owner === undefined || !threshold.sourceIds.includes(owner);
        }),
    )
  ) {
    return false;
  }

  const seenRoles = new Set<SequencingRole>();
  for (const rule of content.rules) {
    if (
      !EXPECTED_ROLES.includes(rule.role) ||
      seenRoles.has(rule.role) ||
      !Number.isInteger(rule.basePriority) ||
      rule.basePriority < 0 ||
      rule.basePriority > 10_000 ||
      !Number.isInteger(rule.ruleVersion) ||
      rule.ruleVersion < 1 ||
      !['am', 'pm', 'either'].includes(rule.defaultPhase) ||
      !hasEvidenceReference(rule.notes) ||
      rule.reviewedBy !== null ||
      rule.candidateDisposition !== 'approved'
    ) {
      return false;
    }
    seenRoles.add(rule.role);
  }

  return (
    EXPECTED_ROLES.every((role) => seenRoles.has(role)) &&
    content.rules.some((rule) => rule.amEligible) &&
    content.rules.some((rule) => rule.pmEligible)
  );
}

export type RoutineSequencingReviewSignedBody = Omit<
  RoutineSequencingReviewReceipt,
  'signedBodySha256' | 'detachedSignatureBase64'
>;

export function routineSequencingReviewSignedBody(
  receipt: RoutineSequencingReviewReceipt,
): RoutineSequencingReviewSignedBody {
  const {
    signedBodySha256: _signedBodySha256,
    detachedSignatureBase64: _signature,
    ...body
  } = receipt;
  return body;
}

function validReceiptMetadata(
  receipt: RoutineSequencingReviewReceipt,
  corpus: RoutineSequencingCorpus,
  now: Date,
): boolean {
  const signedAt = Date.parse(receipt.signedAt);
  const expiresAt = Date.parse(receipt.expiresAt);
  const exactRuleHashes = corpus.content.rules.map((rule) => ({
    role: rule.role,
    ruleVersion: rule.ruleVersion,
    ruleContentSha256: canonicalSha256(rule),
  }));

  return (
    receipt.corpusSha256 === corpus.contentSha256 &&
    receipt.sourceRegistrySha256 === canonicalSha256(corpus.content.sources) &&
    receipt.exactRuleCount === corpus.content.rules.length &&
    canonicalJson(receipt.exactRuleHashes) === canonicalJson(exactRuleHashes) &&
    canonicalJson(receipt.targetJurisdictions) ===
      canonicalJson(corpus.content.targetJurisdictions) &&
    receipt.marketScopePolicyId === corpus.content.marketScopePolicyId &&
    receipt.marketScopeSha256 === corpus.content.marketScopeSha256 &&
    receipt.reviewScope === expectedScope(receipt.reviewerRole) &&
    receipt.decision === 'approve' &&
    hasEvidenceReference(receipt.receiptId) &&
    hasEvidenceReference(receipt.authorityId) &&
    hasEvidenceReference(receipt.reviewerIdentityKey) &&
    hasEvidenceReference(receipt.credentialEvidenceRef) &&
    hasSha256(receipt.credentialEvidenceSha256) &&
    hasSha256(receipt.authorityPublicKeySha256) &&
    receipt.signedBodySha256 === canonicalSha256(routineSequencingReviewSignedBody(receipt)) &&
    hasSha256(receipt.signedBodySha256) &&
    receipt.detachedSignatureBase64.trim().length >= 40 &&
    hasTimestamp(receipt.signedAt) &&
    hasTimestamp(receipt.expiresAt) &&
    signedAt <= now.getTime() &&
    expiresAt > now.getTime() &&
    expiresAt > signedAt
  );
}

export function isValidatedRoutineSequencingAuthority(
  authority: RoutineSequencingTrustedAuthority,
): boolean {
  return (
    hasEvidenceReference(authority.authorityId) &&
    hasEvidenceReference(authority.reviewerIdentityKey) &&
    hasEvidenceReference(authority.credentialEvidenceRef) &&
    hasSha256(authority.credentialEvidenceSha256) &&
    hasSha256(authority.publicKeySha256) &&
    conflictEd25519PublicKeyFingerprint(authority.publicKeyBase64) === authority.publicKeySha256
  );
}

function verifyDetachedReceiptSignature(
  _receipt: RoutineSequencingReviewReceipt,
  _corpus: RoutineSequencingCorpus,
  _authority: RoutineSequencingTrustedAuthority,
): boolean {
  // The current Hermes dependency boundary has no reviewed detached Ed25519
  // verifier. Refusing every signature is the only sound launch posture.
  return false;
}

function immutableCopy<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => immutableCopy(item))) as T;
  }
  if (value && typeof value === 'object') {
    const copy = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, immutableCopy(item)]),
    );
    return Object.freeze(copy) as T;
  }
  return value;
}

const admittedCorpusInstances = new WeakSet<AdmittedRoutineSequencingCorpus>();

export function isRuntimeAdmittedRoutineSequencingCorpus(
  corpus: AdmittedRoutineSequencingCorpus | null | undefined,
): corpus is AdmittedRoutineSequencingCorpus {
  return Boolean(corpus && admittedCorpusInstances.has(corpus));
}

export function admitRoutineSequencingCorpus(
  corpus: RoutineSequencingCorpus,
  receipts: readonly RoutineSequencingReviewReceipt[],
  now: Date = new Date(),
): AdmittedRoutineSequencingCorpus | null {
  if (
    corpus.status !== 'approved' ||
    canonicalSha256(corpus.content) !== corpus.contentSha256 ||
    !isRoutineSequencingCorpusContentValidForAdmission(corpus.content) ||
    receipts.length !== 3 ||
    ROUTINE_SEQUENCING_TRUSTED_AUTHORITIES.length < 3 ||
    receipts.some((receipt) => !validReceiptMetadata(receipt, corpus, now))
  ) {
    return null;
  }

  const orderedRoles: readonly RoutineSequencingReviewRole[] = [
    'board_certified_dermatologist',
    'cosmetic_chemist',
    'regulatory_counsel',
  ];
  const orderedReceipts = orderedRoles.map((role) =>
    receipts.find((receipt) => receipt.reviewerRole === role),
  );
  if (
    orderedReceipts.some((receipt) => !receipt) ||
    new Set(receipts.map((receipt) => receipt.receiptId)).size !== 3 ||
    new Set(receipts.map((receipt) => receipt.authorityId)).size !== 3 ||
    new Set(receipts.map((receipt) => receipt.reviewerIdentityKey)).size !== 3
  ) {
    return null;
  }

  const completeReceipts = orderedReceipts as [
    RoutineSequencingReviewReceipt,
    RoutineSequencingReviewReceipt,
    RoutineSequencingReviewReceipt,
  ];
  const authorities = completeReceipts.map((receipt) =>
    ROUTINE_SEQUENCING_TRUSTED_AUTHORITIES.find(
      (authority) =>
        authority.authorityId === receipt.authorityId &&
        authority.reviewerRole === receipt.reviewerRole &&
        authority.reviewerIdentityKey === receipt.reviewerIdentityKey &&
        authority.credentialEvidenceRef === receipt.credentialEvidenceRef &&
        authority.credentialEvidenceSha256 === receipt.credentialEvidenceSha256 &&
        authority.publicKeySha256 === receipt.authorityPublicKeySha256 &&
        isValidatedRoutineSequencingAuthority(authority),
    ),
  );
  if (
    authorities.some((authority) => !authority) ||
    completeReceipts.some(
      (receipt, index) =>
        !verifyDetachedReceiptSignature(
          receipt,
          corpus,
          authorities[index] as RoutineSequencingTrustedAuthority,
        ),
    )
  ) {
    return null;
  }

  const admitted = immutableCopy<AdmittedRoutineSequencingCorpus>({
    corpusSha256: corpus.contentSha256,
    rules: corpus.content.rules,
    cadencePolicy: corpus.content.cadencePolicy,
    copy: corpus.content.copy,
    receiptIds: completeReceipts.map((receipt) => receipt.receiptId) as [string, string, string],
  });
  admittedCorpusInstances.add(admitted);
  return admitted;
}
