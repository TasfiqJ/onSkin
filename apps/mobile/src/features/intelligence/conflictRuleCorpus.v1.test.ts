import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CONFLICT_RULE_CORPUS,
  CONFLICT_RULE_REVIEW_RECEIPTS,
  CONFLICT_MARKET_SCOPE_POLICY,
  CONFLICT_NON_VARIABLE_SEVERITY_LABEL,
  CONFLICT_PROFILE_CONTEXT_CONTRACT,
  CONFLICT_TRUSTED_REVIEW_AUTHORITIES,
  CONFLICT_TRUST_ROOT_BLOCKER,
  STARTER_RULES,
  admitConflictRuleCorpus,
  canonicalSha256,
  conflictEd25519PublicKeyFingerprint,
  conflictReviewSignedBody,
  hasIndependentConflictReviewAuthorities,
  immutableConflictRuleCorpusSnapshot,
  isConflictRuleCorpusContentValidForAdmission,
  isReviewedRule,
  isValidatedConflictReviewAuthority,
  sha256Hex,
  shippableRules,
  type AdmittedConflictRuleCorpus,
  type ConflictApplicabilityConditions,
  type ConflictConstraint,
  type ConflictParticipantApplicability,
  type ConflictRuleCorpus,
  type ConflictRuleCorpusContent,
  type ConflictRuleReviewReceipt,
  type ConflictTrustedReviewAuthority,
} from './rules';

function markConstraintReviewed<T>(constraint: ConflictConstraint<T>): ConflictConstraint<T> {
  return constraint.status === 'review_required' ? { status: 'not_applicable' } : constraint;
}

function markParticipantReviewed(
  conditions: ConflictParticipantApplicability,
): ConflictParticipantApplicability {
  return {
    moleculeIds: markConstraintReviewed(conditions.moleculeIds),
    finishedProductIds: markConstraintReviewed(conditions.finishedProductIds),
    finishedFormulationIds: markConstraintReviewed(conditions.finishedFormulationIds),
    concentration: markConstraintReviewed(conditions.concentration),
    applicationAmount: markConstraintReviewed(conditions.applicationAmount),
    applicationArea: markConstraintReviewed(conditions.applicationArea),
    frequencyPerWeek: markConstraintReviewed(conditions.frequencyPerWeek),
    durationDays: markConstraintReviewed(conditions.durationDays),
    ph: markConstraintReviewed(conditions.ph),
    vehicle: markConstraintReviewed(conditions.vehicle),
    occlusion: markConstraintReviewed(conditions.occlusion),
    barrierCondition: markConstraintReviewed(conditions.barrierCondition),
    exposure: markConstraintReviewed(conditions.exposure),
  };
}

function markConditionsReviewed(
  conditions: ConflictApplicabilityConditions,
): ConflictApplicabilityConditions {
  return {
    tagA: markParticipantReviewed(conditions.tagA),
    tagB: markParticipantReviewed(conditions.tagB),
    reproductiveContexts: markConstraintReviewed(conditions.reproductiveContexts),
  };
}

function reviewedContent(): ConflictRuleCorpusContent {
  return {
    ...CONFLICT_RULE_CORPUS.content,
    sources: CONFLICT_RULE_CORPUS.content.sources.map((source) => ({
      ...source,
      reviewStatus: 'reviewed',
    })),
    rules: CONFLICT_RULE_CORPUS.content.rules.map((rule) => ({
      ...rule,
      candidateDisposition: 'reviewed',
      applicability: {
        ...rule.applicability,
        reviewStatus: 'reviewed',
        approvedConditions: markConditionsReviewed(rule.applicability.approvedConditions),
      },
    })),
  };
}

function approvedCorpus(): ConflictRuleCorpus {
  const content = reviewedContent();
  return {
    status: 'approved',
    content,
    contentSha256: canonicalSha256(content),
  };
}

const ADMISSION_NOW = new Date('2026-07-26T13:00:00.000Z');

function testAuthority(
  fillByte: number,
  reviewerRole: ConflictTrustedReviewAuthority['reviewerRole'],
  label: string,
): ConflictTrustedReviewAuthority {
  const rawKey = Buffer.alloc(32, fillByte);
  const publicKeyBase64 = rawKey.toString('base64');
  return {
    authorityId: `urn:test-authority:${label}`,
    reviewerRole,
    reviewerIdentityKey: `urn:test-reviewer:${label}`,
    credentialEvidenceRef: `urn:test-credential:${label}`,
    credentialEvidenceSha256: sha256Hex(`credential:${label}`),
    publicKeyAlgorithm: 'Ed25519',
    publicKeyBase64,
    publicKeySha256: createHash('sha256').update(rawKey).digest('hex'),
  };
}

function selfAssertedReceipts(
  corpus: ConflictRuleCorpus,
): [ConflictRuleReviewReceipt, ConflictRuleReviewReceipt, ConflictRuleReviewReceipt] {
  const shared = {
    corpusSha256: corpus.contentSha256,
    sourceRegistrySha256: canonicalSha256(corpus.content.sources),
    exactRuleCount: corpus.content.rules.length,
    targetJurisdictions: corpus.content.targetJurisdictions,
    marketScopePolicyId: corpus.content.marketScopePolicyId,
    marketScopeSha256: corpus.content.marketScopeSha256,
    marketScopeSourceDocumentPath: CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentPath,
    marketScopeSourceDocumentSha256: CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentSha256,
    profileContextStoredValue: corpus.content.profileContextContract.storedValue,
    profileContextSemanticValue: corpus.content.profileContextContract.semanticValue,
    profileContextSourceDocumentPath: corpus.content.profileContextContract.sourceDocumentPath,
    profileContextSourceDocumentSha256: corpus.content.profileContextContract.sourceDocumentSha256,
    decision: 'approve' as const,
    expiresAt: '2027-07-26T12:00:00.000Z',
    signedBodySha256: sha256Hex('placeholder'),
    detachedSignatureBase64: 'A'.repeat(88),
  };
  const unfinished: [
    ConflictRuleReviewReceipt,
    ConflictRuleReviewReceipt,
    ConflictRuleReviewReceipt,
  ] = [
    {
      ...shared,
      receiptId: 'urn:untrusted-review-receipt:dermatology',
      authorityId: 'urn:untrusted-authority:dermatology',
      reviewerRole: 'board_certified_dermatologist',
      reviewScope: 'clinical_safety_evidence_and_user_copy',
      reviewerIdentityKey: 'urn:untrusted-reviewer:dermatology',
      credentialEvidenceRef: 'urn:untrusted-credential:dermatology',
      credentialEvidenceSha256: sha256Hex('dermatology credential evidence bytes'),
      authorityPublicKeySha256: sha256Hex('dermatology authority public key'),
      signedAt: '2026-07-26T12:00:00.000Z',
    },
    {
      ...shared,
      receiptId: 'urn:untrusted-review-receipt:chemistry',
      authorityId: 'urn:untrusted-authority:chemistry',
      reviewerRole: 'cosmetic_chemist',
      reviewScope: 'ingredient_compatibility_formulation_and_user_copy',
      reviewerIdentityKey: 'urn:untrusted-reviewer:chemistry',
      credentialEvidenceRef: 'urn:untrusted-credential:chemistry',
      credentialEvidenceSha256: sha256Hex('chemistry credential evidence bytes'),
      authorityPublicKeySha256: sha256Hex('chemistry authority public key'),
      signedAt: '2026-07-26T12:05:00.000Z',
    },
    {
      ...shared,
      receiptId: 'urn:untrusted-review-receipt:regulatory',
      authorityId: 'urn:untrusted-authority:regulatory',
      reviewerRole: 'regulatory_counsel',
      reviewScope: 'regulatory_claims_and_jurisdiction_clearance',
      reviewerIdentityKey: 'urn:untrusted-reviewer:regulatory',
      credentialEvidenceRef: 'urn:untrusted-credential:regulatory',
      credentialEvidenceSha256: sha256Hex('regulatory credential evidence bytes'),
      authorityPublicKeySha256: sha256Hex('regulatory authority public key'),
      signedAt: '2026-07-26T12:10:00.000Z',
    },
  ];
  return unfinished.map((receipt) => ({
    ...receipt,
    signedBodySha256: canonicalSha256(conflictReviewSignedBody(corpus, receipt)),
  })) as [ConflictRuleReviewReceipt, ConflictRuleReviewReceipt, ConflictRuleReviewReceipt];
}

describe('canonical conflict corpus hashing', () => {
  it('implements deterministic UTF-8 SHA-256', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(canonicalSha256({ b: 'é', a: 1 })).toBe(canonicalSha256({ a: 1, b: 'é' }));
  });

  it('binds every runtime preview rule to the exact corpus and rule content', () => {
    expect(CONFLICT_RULE_CORPUS.contentSha256).toBe(canonicalSha256(CONFLICT_RULE_CORPUS.content));
    for (const rule of STARTER_RULES) {
      expect(rule.corpusSha256).toBe(CONFLICT_RULE_CORPUS.contentSha256);
      const {
        admission: _admission,
        corpusSha256: _corpusSha256,
        ruleContentSha256,
        ...content
      } = rule;
      expect(ruleContentSha256).toBe(canonicalSha256(content));
    }
  });

  it('binds Wave 1 to the current US legal-gate document and excludes future Canada scope', () => {
    expect(CONFLICT_MARKET_SCOPE_POLICY.storefrontJurisdictions).toEqual(['US']);
    expect(CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentPath).toBe(
      'docs/hugeToDo/US_WAVE1_PRIVACY_AND_CONSUMER_HEALTH_LAW_GATE.md',
    );
    expect(CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentSha256).toBe(
      '34ce160c765e9d7bde2e1d5e55de54c63b8c896e5db61de746a1f6a971080bce',
    );
    expect(CONFLICT_RULE_CORPUS.content.targetJurisdictions).toEqual(['US']);
    expect(CONFLICT_RULE_CORPUS.content.marketScopeSha256).toBe(
      canonicalSha256(CONFLICT_MARKET_SCOPE_POLICY),
    );
  });

  it('binds the stored pregnant value to the combined pregnant-or-trying quiz contract', () => {
    expect(CONFLICT_PROFILE_CONTEXT_CONTRACT).toEqual({
      storedValue: 'pregnant',
      semanticValue: 'pregnant_or_trying_combined',
      sourceDocumentPath: 'apps/mobile/src/features/onboarding/quizContract.ts',
      sourceDocumentSha256: '2bbcbe2ab01b444fde4c0ffb132eef721a078a6f1118f044b5c4eb26303b9451',
    });
    expect(CONFLICT_RULE_CORPUS.content.profileContextContract).toEqual(
      CONFLICT_PROFILE_CONTEXT_CONTRACT,
    );
    const quizContractBytes = readFileSync(
      new URL('../onboarding/quizContract.ts', import.meta.url),
    );
    expect(createHash('sha256').update(quizContractBytes).digest('hex')).toBe(
      CONFLICT_PROFILE_CONTEXT_CONTRACT.sourceDocumentSha256,
    );
  });
});

describe('fail-closed professional admission', () => {
  it('keeps production empty with an explicit trust and signature blocker', () => {
    expect(CONFLICT_RULE_CORPUS.status).toBe('draft_blocked');
    expect(CONFLICT_RULE_REVIEW_RECEIPTS).toEqual([]);
    expect(CONFLICT_TRUSTED_REVIEW_AUTHORITIES).toEqual([]);
    expect(CONFLICT_TRUST_ROOT_BLOCKER).toBe(
      'empty_trust_registry_and_detached_signature_verifier_not_implemented',
    );
    expect(admitConflictRuleCorpus(CONFLICT_RULE_CORPUS, CONFLICT_RULE_REVIEW_RECEIPTS)).toBeNull();
    expect(shippableRules()).toEqual([]);
    expect(shippableRules([{ ...STARTER_RULES[0]!, reviewedBy: 'self-asserted-marker' }])).toEqual(
      [],
    );
  });

  it('requires three independently fingerprinted, canonical 32-byte Ed25519 public keys', () => {
    const authorities = [
      testAuthority(1, 'board_certified_dermatologist', 'dermatology'),
      testAuthority(2, 'cosmetic_chemist', 'chemistry'),
      testAuthority(3, 'regulatory_counsel', 'regulatory'),
    ] as const;

    expect(authorities.every(isValidatedConflictReviewAuthority)).toBe(true);
    expect(hasIndependentConflictReviewAuthorities(authorities)).toBe(true);
    for (const authority of authorities) {
      expect(conflictEd25519PublicKeyFingerprint(authority.publicKeyBase64)).toBe(
        authority.publicKeySha256,
      );
    }

    const tamperedKey = {
      ...authorities[0],
      publicKeyBase64: `${authorities[0].publicKeyBase64.slice(0, -2)}A=`,
    };
    expect(isValidatedConflictReviewAuthority(tamperedKey)).toBe(false);

    const tamperedFingerprint = {
      ...authorities[0],
      publicKeySha256: sha256Hex('wrong public key fingerprint'),
    };
    expect(isValidatedConflictReviewAuthority(tamperedFingerprint)).toBe(false);

    const duplicateKey = {
      ...authorities[2],
      publicKeyBase64: authorities[1].publicKeyBase64,
      publicKeySha256: authorities[1].publicKeySha256,
    };
    expect(
      hasIndependentConflictReviewAuthorities([authorities[0], authorities[1], duplicateKey]),
    ).toBe(false);
  });

  it('does not admit three self-asserted authorities, receipts, hashes, or signatures', () => {
    const corpus = approvedCorpus();
    const receipts = selfAssertedReceipts(corpus);

    expect(receipts.map((receipt) => receipt.reviewerRole)).toEqual([
      'board_certified_dermatologist',
      'cosmetic_chemist',
      'regulatory_counsel',
    ]);
    expect(
      receipts.every(
        (receipt) =>
          receipt.signedBodySha256 === canonicalSha256(conflictReviewSignedBody(corpus, receipt)),
      ),
    ).toBe(true);
    expect(admitConflictRuleCorpus(corpus, receipts, ADMISSION_NOW)).toBeNull();
    expect(STARTER_RULES.every(isReviewedRule)).toBe(false);
  });

  it('rejects reproductive-scope widening in safety rules and their severity branches', () => {
    const valid = reviewedContent();
    expect(isConflictRuleCorpusContentValidForAdmission(valid)).toBe(true);

    const safetyRule = valid.rules.find((rule) => rule.interactionType === 'safety')!;
    const withWidenedBase: ConflictRuleCorpusContent = {
      ...valid,
      rules: valid.rules.map((rule) =>
        rule.id === safetyRule.id
          ? {
              ...rule,
              applicability: {
                ...rule.applicability,
                approvedConditions: {
                  ...rule.applicability.approvedConditions,
                  reproductiveContexts: { status: 'not_applicable' },
                },
              },
            }
          : rule,
      ),
    };
    expect(isConflictRuleCorpusContentValidForAdmission(withWidenedBase)).toBe(false);

    const withWidenedBranch: ConflictRuleCorpusContent = {
      ...valid,
      rules: valid.rules.map((rule) =>
        rule.id === safetyRule.id
          ? {
              ...rule,
              copy: {
                ...rule.copy,
                severityLabel: CONFLICT_NON_VARIABLE_SEVERITY_LABEL,
              },
              applicability: {
                ...rule.applicability,
                severityBranches: [
                  {
                    branchId: 'urn:reviewed-clinical-severity-branch',
                    severity: 'moderate',
                    conditions: {
                      ...rule.applicability.approvedConditions,
                      reproductiveContexts: { status: 'not_applicable' },
                    },
                  },
                ],
              },
            }
          : rule,
      ),
    };
    expect(isConflictRuleCorpusContentValidForAdmission(withWidenedBranch)).toBe(false);

    const withWrongExactBranch: ConflictRuleCorpusContent = {
      ...valid,
      rules: valid.rules.map((rule) =>
        rule.id === safetyRule.id
          ? {
              ...rule,
              copy: {
                ...rule.copy,
                severityLabel: CONFLICT_NON_VARIABLE_SEVERITY_LABEL,
              },
              applicability: {
                ...rule.applicability,
                severityBranches: [
                  {
                    branchId: 'urn:reviewed-clinical-severity-branch',
                    severity: 'moderate',
                    conditions: {
                      ...rule.applicability.approvedConditions,
                      reproductiveContexts: {
                        status: 'exact',
                        value: ['breastfeeding'],
                      },
                    },
                  },
                ],
              },
            }
          : rule,
      ),
    };
    expect(isConflictRuleCorpusContentValidForAdmission(withWrongExactBranch)).toBe(false);
  });

  it('requires non-variable signed presentation copy when reviewed severity branches vary', () => {
    const valid = reviewedContent();
    const interaction = valid.rules.find(
      (rule) => rule.interactionType !== 'safety' && rule.baseSeverity === 'mild',
    )!;
    const addVariableBranch = (severityLabel: string): ConflictRuleCorpusContent => ({
      ...valid,
      rules: valid.rules.map((rule) =>
        rule.id === interaction.id
          ? {
              ...rule,
              copy: { ...rule.copy, severityLabel },
              applicability: {
                ...rule.applicability,
                severityBranches: [
                  {
                    branchId: 'urn:reviewed-variable-severity-branch',
                    severity: 'moderate',
                    conditions: rule.applicability.approvedConditions,
                  },
                ],
              },
            }
          : rule,
      ),
    });

    expect(
      isConflictRuleCorpusContentValidForAdmission(
        addVariableBranch(`Severity: ${interaction.baseSeverity}`),
      ),
    ).toBe(false);
    expect(
      isConflictRuleCorpusContentValidForAdmission(
        addVariableBranch(CONFLICT_NON_VARIABLE_SEVERITY_LABEL),
      ),
    ).toBe(true);
  });

  it('rejects a corpus whose signed profile-context contract drifts from the quiz source', () => {
    const valid = reviewedContent();
    expect(
      isConflictRuleCorpusContentValidForAdmission({
        ...valid,
        profileContextContract: {
          ...valid.profileContextContract,
          semanticValue: 'pregnant_only' as never,
        },
      }),
    ).toBe(false);
  });

  it('binds a receipt body to exact sources, rules, jurisdictions, identity, and credentials', () => {
    const corpus = approvedCorpus();
    const receipt = selfAssertedReceipts(corpus)[0];
    const body = conflictReviewSignedBody(corpus, receipt);

    expect(body.corpusSha256).toBe(corpus.contentSha256);
    expect(body.sourceRegistrySha256).toBe(canonicalSha256(corpus.content.sources));
    expect(body.exactRuleCount).toBe(corpus.content.rules.length);
    expect(body.exactRuleHashes).toEqual(
      corpus.content.rules.map((rule) => ({
        ruleId: rule.id,
        ruleVersion: rule.ruleVersion,
        ruleContentSha256: canonicalSha256(rule),
      })),
    );
    expect(body.targetJurisdictions).toEqual(corpus.content.targetJurisdictions);
    expect(body.marketScopePolicyId).toBe(corpus.content.marketScopePolicyId);
    expect(body.marketScopeSha256).toBe(corpus.content.marketScopeSha256);
    expect(body.marketScopeSourceDocumentPath).toBe(
      CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentPath,
    );
    expect(body.marketScopeSourceDocumentSha256).toBe(
      CONFLICT_MARKET_SCOPE_POLICY.sourceDocumentSha256,
    );
    expect(body.profileContextStoredValue).toBe('pregnant');
    expect(body.profileContextSemanticValue).toBe('pregnant_or_trying_combined');
    expect(body.profileContextSourceDocumentPath).toBe(
      'apps/mobile/src/features/onboarding/quizContract.ts',
    );
    expect(body.profileContextSourceDocumentSha256).toBe(
      '2bbcbe2ab01b444fde4c0ffb132eef721a078a6f1118f044b5c4eb26303b9451',
    );
    expect(body.receiptId).toBe(receipt.receiptId);
    expect(body.authorityId).toBe(receipt.authorityId);
    expect(body.reviewerIdentityKey).toBe(receipt.reviewerIdentityKey);
    expect(body.credentialEvidenceRef).toBe(receipt.credentialEvidenceRef);
    expect(body.credentialEvidenceSha256).toBe(receipt.credentialEvidenceSha256);
    expect(body.authorityPublicKeySha256).toBe(receipt.authorityPublicKeySha256);
    expect(
      canonicalSha256(
        conflictReviewSignedBody(corpus, {
          ...receipt,
          authorityPublicKeySha256: sha256Hex('tampered receipt authority key'),
        }),
      ),
    ).not.toBe(receipt.signedBodySha256);
    expect(body.credentialEvidenceSha256).not.toBe(canonicalSha256(receipt.credentialEvidenceRef));
  });

  it('copies and deeply freezes every future admitted runtime structure', () => {
    const mutableCoverage = ['aha|retinoid@routine@unknown'];
    const candidate: AdmittedConflictRuleCorpus = {
      corpusSha256: CONFLICT_RULE_CORPUS.contentSha256,
      rules: [STARTER_RULES[0]!],
      reviewedCompatiblePairs: mutableCoverage,
      receiptIds: ['receipt-a', 'receipt-b', 'receipt-c'],
    };
    const snapshot = immutableConflictRuleCorpusSnapshot(candidate);

    expect(snapshot).not.toBe(candidate);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.rules)).toBe(true);
    expect(Object.isFrozen(snapshot.rules[0])).toBe(true);
    expect(Object.isFrozen(snapshot.rules[0]!.copy)).toBe(true);
    expect(Object.isFrozen(snapshot.reviewedCompatiblePairs)).toBe(true);
    expect(Object.isFrozen(snapshot.receiptIds)).toBe(true);

    expect(() =>
      (snapshot.reviewedCompatiblePairs as string[]).push('fabricated|pair@routine@unknown'),
    ).toThrow();
    expect(() => {
      snapshot.rules[0]!.copy.bannerTitle = 'Mutated guidance';
    }).toThrow();
    expect(snapshot.reviewedCompatiblePairs).toEqual(['aha|retinoid@routine@unknown']);
    expect(snapshot.rules[0]!.copy.bannerTitle).toBe(STARTER_RULES[0]!.copy.bannerTitle);

    mutableCoverage.push('caller|mutation@routine@unknown');
    expect(snapshot.reviewedCompatiblePairs).not.toContain('caller|mutation@routine@unknown');
  });
});

describe('candidate medical constraints', () => {
  it('holds both copper-peptide rows and removes the resistant-skin bypass', () => {
    const copper = STARTER_RULES.filter(
      (rule) => rule.tagA === 'copper_peptide' || rule.tagB === 'copper_peptide',
    );
    expect(copper).toHaveLength(2);
    expect(copper.every((rule) => rule.candidateDisposition === 'held_unreviewed')).toBe(true);

    const retinoidBha = STARTER_RULES.find((rule) => rule.pairKey === 'bha|retinoid')!;
    expect(retinoidBha.applicability.coUseSensitivity).toBeNull();
    expect(retinoidBha.appliesWhen).toBeNull();
  });

  it('keeps candidate applicability review-required across every unreviewed dimension', () => {
    for (const rule of STARTER_RULES) {
      expect(rule.applicability.reviewStatus).toBe('review_required');
      expect(rule.applicability.severityBranches).toEqual([]);
      expect(
        [
          ...Object.values(rule.applicability.approvedConditions.tagA),
          ...Object.values(rule.applicability.approvedConditions.tagB),
        ].some((constraint) => constraint.status === 'review_required'),
      ).toBe(true);
    }
  });

  it('uses exact tretinoin and exact pregnancy contexts without generic compatibility', () => {
    const bpRetinoid = STARTER_RULES.find((rule) => rule.pairKey === 'benzoyl_peroxide|retinoid')!;
    expect(bpRetinoid.applicability.approvedConditions.tagB.moleculeIds).toEqual({
      status: 'exact',
      value: ['tretinoin'],
    });
    expect(bpRetinoid.applicability.ingredientScope.formulationExemptions).toEqual([]);

    const safety = STARTER_RULES.filter((rule) => rule.interactionType === 'safety');
    expect(safety).not.toEqual([]);
    expect(safety.every((rule) => rule.applicability.safetyContexts[0] === 'pregnant')).toBe(true);
    expect(
      safety.every(
        (rule) => rule.applicability.approvedConditions.reproductiveContexts.status === 'exact',
      ),
    ).toBe(true);
    expect(CONFLICT_RULE_CORPUS.content.coverage.reviewedCompatiblePairs).toEqual([]);
  });

  it('uses neutral niacinamide/vitamin-C history without a synergy promise', () => {
    const rule = STARTER_RULES.find((candidate) => candidate.pairKey === 'niacinamide|vitamin_c')!;
    expect(rule.copy.mechanism).toContain('1963');
    expect(rule.copy.mechanism).toContain('nicotinamide and ascorbic acid');
    expect(rule.copy.mechanism).not.toMatch(/\bniacin \(not niacinamide\)|complement|synerg/iu);
    expect(rule.copy.resolution).toBe('This draft rule does not require separation.');
  });
});
