import type { SkinAxis } from '@layerwell/types';
import { describe, expect, it, vi } from 'vitest';

import { QUIZ_AXIS_ORDER, QUIZ_SCORING_PROVENANCE } from './quizContract';
import {
  applyCurrentServerSkinProfileFilters,
  CURRENT_SERVER_SKIN_PROFILE_FILTERS,
  CURRENT_SERVER_SKIN_PROFILE_PROVENANCE,
  CURRENT_SERVER_SKIN_PROFILE_SELECT,
  isServerSkinProfileFallbackPermitted,
  parseCurrentServerSkinProfile,
} from './serverSkinProfile';

const RAW_COLUMNS = {
  oily_dry: 'oily_dry',
  sensitive_resistant: 'sensitive_resistant',
  pigmented_non: 'pigmented_non',
  wrinkled_tight: 'wrinkled_tight',
} as const satisfies Record<SkinAxis, string>;

const BASIS_COLUMNS = {
  oily_dry: 'oily_dry_basis_points',
  sensitive_resistant: 'sensitive_resistant_basis_points',
  pigmented_non: 'pigmented_non_basis_points',
  wrinkled_tight: 'wrinkled_tight_basis_points',
} as const satisfies Record<SkinAxis, string>;

function validRow(): Record<string, unknown> {
  return {
    oily_dry: 3,
    sensitive_resistant: -1,
    pigmented_non: 0,
    wrinkled_tight: -4,
    dspt: 'ORPT',
    oily_dry_basis_points: 8750,
    sensitive_resistant_basis_points: 3750,
    pigmented_non_basis_points: 5000,
    wrinkled_tight_basis_points: 0,
    fitzpatrick: 3,
    monk_tone: 6,
    sensitivities: ['fragrance', 'alcohol'],
    pregnancy_status: 'none',
    goals: ['hydration', 'barrier_repair'],
    completed_at: '2026-07-26T12:34:56.123456+00:00',
    ...CURRENT_SERVER_SKIN_PROFILE_PROVENANCE,
  };
}

describe('current server skin-profile contract', () => {
  it('binds the exact version-2 tuple to the immutable quiz provenance', () => {
    expect(CURRENT_SERVER_SKIN_PROFILE_PROVENANCE).toEqual({
      version: 2,
      quiz_contract_id: QUIZ_SCORING_PROVENANCE.contractId,
      quiz_content_version: QUIZ_SCORING_PROVENANCE.contentVersion,
      quiz_scoring_version: QUIZ_SCORING_PROVENANCE.scoringVersion,
      quiz_output_schema_version: QUIZ_SCORING_PROVENANCE.outputSchemaVersion,
      quiz_content_sha256: QUIZ_SCORING_PROVENANCE.contentSha256,
      quiz_scoring_sha256: QUIZ_SCORING_PROVENANCE.scoringSha256,
      quiz_contract_sha256: QUIZ_SCORING_PROVENANCE.contractSha256,
      quiz_review_status: QUIZ_SCORING_PROVENANCE.reviewStatus,
      quiz_pole_tie_rule: QUIZ_SCORING_PROVENANCE.poleTieRule,
    });
    expect(CURRENT_SERVER_SKIN_PROFILE_SELECT).not.toMatch(/answers|answer_hash/u);
  });

  it('permits a server fallback only for truly missing local state', () => {
    expect(isServerSkinProfileFallbackPermitted('missing')).toBe(true);
    for (const status of [
      'available',
      'legacy',
      'contract_mismatch',
      'invalid',
      'unsupported_version',
      'unavailable',
      'future',
    ]) {
      expect(isServerSkinProfileFallbackPermitted(status), status).toBe(false);
    }
  });

  it('applies every current tuple discriminator to a server query', () => {
    type TestFilterQuery = {
      eq(column: string, value: string | number): TestFilterQuery;
    };
    const eq = vi.fn<(column: string, value: string | number) => TestFilterQuery>();
    const query: TestFilterQuery = { eq };
    eq.mockImplementation(() => query);

    expect(applyCurrentServerSkinProfileFilters(query)).toBe(query);
    expect(eq.mock.calls).toEqual(
      CURRENT_SERVER_SKIN_PROFILE_FILTERS.map(([column, value]) => [column, value]),
    );
  });

  it('accepts a complete exact row with mathematically consistent outputs', () => {
    expect(parseCurrentServerSkinProfile(validRow())).toEqual(validRow());
  });

  it.each([
    ['legacy version', { version: 1 }],
    ['future version', { version: 3 }],
    ['content mismatch', { quiz_content_sha256: '0'.repeat(64) }],
    ['scoring mismatch', { quiz_scoring_version: 'draft-other' }],
    ['review mismatch', { quiz_review_status: 'approved' }],
    ['tie mismatch', { quiz_pole_tie_rule: 'raw_score_greater_than_zero_uses_positive_pole' }],
    ['missing provenance', { quiz_contract_sha256: undefined }],
  ])('rejects %s', (_label, changes) => {
    const row: Record<string, unknown> = { ...validRow(), ...changes };
    if (Object.prototype.hasOwnProperty.call(changes, 'quiz_contract_sha256')) {
      delete row.quiz_contract_sha256;
    }
    expect(parseCurrentServerSkinProfile(row)).toBeNull();
  });

  it('keeps exact historical client tuples outside the current server fallback', () => {
    const oldHashes = {
      quiz_content_version: 'draft-2026-07-04',
      quiz_scoring_version: 'draft-1',
      quiz_content_sha256: 'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
      quiz_scoring_sha256: 'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
      quiz_contract_sha256: '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16',
    };
    expect(
      parseCurrentServerSkinProfile({
        ...validRow(),
        quiz_contract_id: 'urn:routinekind:onboarding:skin-profile',
        ...oldHashes,
      }),
    ).toBeNull();
    expect(
      parseCurrentServerSkinProfile({
        ...validRow(),
        quiz_content_version: 'draft-2026-07-04',
        quiz_scoring_version: 'draft-1',
        quiz_content_sha256: '8398b025f7ebfa8cd823c180ba6d98475554b82651970b569c736d662c7c7f2f',
        quiz_scoring_sha256: 'be3a05c5c9494d0976868c4d4e34c4c71fd01b8be19f9207e0198b930e1b982a',
        quiz_contract_sha256: 'c434e4f031d2d9d18218a0ccddcecf3fff182e8208367375aee16c574c814007',
      }),
    ).toBeNull();
  });

  it('rejects missing and extra selected columns', () => {
    const missing = validRow();
    delete missing.completed_at;
    expect(parseCurrentServerSkinProfile(missing)).toBeNull();
    expect(parseCurrentServerSkinProfile({ ...validRow(), raw_answers: {} })).toBeNull();
  });

  it.each(QUIZ_AXIS_ORDER)('rejects invalid or inconsistent %s outputs', (axis) => {
    const impossibleRaw = validRow();
    impossibleRaw[RAW_COLUMNS[axis]] = -3;
    expect(parseCurrentServerSkinProfile(impossibleRaw)).toBeNull();

    const mismatchedBasis = validRow();
    mismatchedBasis[BASIS_COLUMNS[axis]] =
      mismatchedBasis[BASIS_COLUMNS[axis]] === 5000 ? 6250 : 5000;
    expect(parseCurrentServerSkinProfile(mismatchedBasis)).toBeNull();
  });

  it('enforces the documented non-negative tie pole in DSPT', () => {
    expect(parseCurrentServerSkinProfile({ ...validRow(), dspt: 'ORPT' })).not.toBeNull();
    expect(parseCurrentServerSkinProfile({ ...validRow(), dspt: 'ORNT' })).toBeNull();
  });

  it.each([
    { fitzpatrick: null },
    { monk_tone: 11 },
    { sensitivities: ['alcohol', 'fragrance'] },
    { sensitivities: ['none'] },
    { pregnancy_status: 'unknown' },
    { goals: [] },
    { goals: 'hydration' },
    { goals: ['hydration', 'hydration'] },
    { goals: ['hydration', 'barrier_repair', 'anti_aging'] },
    { goals: ['not_a_goal'] },
    { completed_at: 'not-a-timestamp' },
  ])('rejects an invalid required current output %#', (changes) => {
    expect(parseCurrentServerSkinProfile({ ...validRow(), ...changes })).toBeNull();
  });
});
