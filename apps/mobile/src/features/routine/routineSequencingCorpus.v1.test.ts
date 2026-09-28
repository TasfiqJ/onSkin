import { afterEach, describe, expect, it } from 'vitest';

import { canonicalSha256 } from '@/features/intelligence/conflictRuleCorpus.v1';

import {
  admitRoutineSequencingCorpus,
  isRoutineSequencingCorpusContentValidForAdmission,
  isRuntimeAdmittedRoutineSequencingCorpus,
  ROUTINE_SEQUENCING_REVIEW_RECEIPTS,
  ROUTINE_SEQUENCING_TRUSTED_AUTHORITIES,
} from './routineSequencingCorpus.v1';
import {
  ROUTINE_SEQUENCING_CORPUS,
  ROUTINE_SEQUENCING_CORPUS_CONTENT,
  SEQUENCING_RULES,
  shippableSequencingRules,
} from './sequencing';

afterEach(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
  delete process.env.EXPO_PUBLIC_E2E_ROUTINE_SEQUENCING_REVIEW_GATE;
});

describe('CORE-03 routine sequencing corpus admission', () => {
  it('binds the current candidate content to its exact canonical hash', () => {
    expect(ROUTINE_SEQUENCING_CORPUS.content).toBe(ROUTINE_SEQUENCING_CORPUS_CONTENT);
    expect(ROUTINE_SEQUENCING_CORPUS.contentSha256).toBe(
      canonicalSha256(ROUTINE_SEQUENCING_CORPUS_CONTENT),
    );
  });

  it('keeps the candidate draft-blocked with no trust roots or receipts', () => {
    expect(ROUTINE_SEQUENCING_CORPUS.status).toBe('draft_blocked');
    expect(ROUTINE_SEQUENCING_CORPUS_CONTENT.rules).toHaveLength(10);
    expect(
      ROUTINE_SEQUENCING_CORPUS_CONTENT.rules.every(
        (rule) => rule.candidateDisposition === 'draft_blocked' && rule.reviewedBy === null,
      ),
    ).toBe(true);
    expect(ROUTINE_SEQUENCING_CORPUS_CONTENT.cadencePolicy.candidateDisposition).toBe(
      'draft_blocked',
    );
    expect(ROUTINE_SEQUENCING_CORPUS_CONTENT.cadencePolicy.stopRefer).toEqual({
      status: 'unavailable_pending_review',
      thresholds: [],
    });
    expect(
      ROUTINE_SEQUENCING_CORPUS_CONTENT.sources.every(
        (source) =>
          source.retainedArtifactId === null &&
          source.retainedArtifactRef === null &&
          source.retainedArtifactSha256 === null,
      ),
    ).toBe(true);
    expect(
      ROUTINE_SEQUENCING_CORPUS_CONTENT.claimMappings.every(
        (mapping) => mapping.sourceIds.length === 0 && mapping.propositionIds.length === 0,
      ),
    ).toBe(true);
    expect(ROUTINE_SEQUENCING_TRUSTED_AUTHORITIES).toEqual([]);
    expect(ROUTINE_SEQUENCING_REVIEW_RECEIPTS).toEqual([]);
    expect(
      isRoutineSequencingCorpusContentValidForAdmission(ROUTINE_SEQUENCING_CORPUS_CONTENT),
    ).toBe(false);
    expect(
      admitRoutineSequencingCorpus(ROUTINE_SEQUENCING_CORPUS, ROUTINE_SEQUENCING_REVIEW_RECEIPTS),
    ).toBeNull();
  });

  it('does not runtime-brand a structurally forged admitted object', () => {
    const forged = {
      corpusSha256: ROUTINE_SEQUENCING_CORPUS.contentSha256,
      rules: ROUTINE_SEQUENCING_CORPUS_CONTENT.rules,
      cadencePolicy: ROUTINE_SEQUENCING_CORPUS_CONTENT.cadencePolicy,
      copy: ROUTINE_SEQUENCING_CORPUS_CONTENT.copy,
      receiptIds: ['derm', 'chemist', 'counsel'] as [string, string, string],
    };
    expect(isRuntimeAdmittedRoutineSequencingCorpus(forged)).toBe(false);
  });

  it('ignores caller-injected free-text review metadata outside development', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const forgedCleanser = {
      ...SEQUENCING_RULES.cleanser,
      reviewedBy: 'self-asserted-reviewer',
    };

    expect(shippableSequencingRules({ cleanser: forgedCleanser })).toEqual({});
  });

  it('keeps explicit development fixtures separate and closable for E2E', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    expect(Object.keys(shippableSequencingRules())).toHaveLength(10);

    process.env.EXPO_PUBLIC_E2E_ROUTINE_SEQUENCING_REVIEW_GATE = 'closed';
    expect(shippableSequencingRules()).toEqual({});
  });
});
