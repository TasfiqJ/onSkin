import type { SkinAxis } from '@onskin/types';

/**
 * The current content and scoring rules remain blocked by B-QUIZ-COPY.
 *
 * These manifests make the exact draft deterministic and reviewable. They are
 * not evidence of legal, clinical, or IP approval, and the review status must
 * remain launch-blocked until the repository's professional-review gate is
 * satisfied against the pinned hashes.
 */
export const QUIZ_CONTRACT_REVIEW_STATUS = 'launch-blocked' as const;
export const QUIZ_CONTRACT_ID = 'urn:routinekind:onboarding:skin-profile' as const;
export const QUIZ_CONTENT_VERSION = 'draft-2026-07-04' as const;
export const QUIZ_SCORING_VERSION = 'draft-1' as const;
export const QUIZ_OUTPUT_SCHEMA_VERSION = 1 as const;

export const QUIZ_AXIS_ORDER = [
  'oily_dry',
  'sensitive_resistant',
  'pigmented_non',
  'wrinkled_tight',
] as const satisfies readonly SkinAxis[];

export const QUIZ_AXIS_POLES = {
  oily_dry: { positive: 'O', negative: 'D', posLabel: 'Oily', negLabel: 'Dry' },
  sensitive_resistant: {
    positive: 'S',
    negative: 'R',
    posLabel: 'Sensitive',
    negLabel: 'Resistant',
  },
  pigmented_non: {
    positive: 'P',
    negative: 'N',
    posLabel: 'Uneven tone',
    negLabel: 'Even',
  },
  wrinkled_tight: {
    positive: 'W',
    negative: 'T',
    posLabel: 'Lined',
    negLabel: 'Firm',
  },
} as const satisfies Record<
  SkinAxis,
  { positive: string; negative: string; posLabel: string; negLabel: string }
>;

export type QuizOptionScore = Partial<Record<SkinAxis, number>>;

export type QuizOption = {
  id: string;
  label: string;
  subtitle?: string;
  /** Axis contribution(s) in the range roughly -2..+2 (axis questions). */
  score?: QuizOptionScore;
  /** Discrete value for phototype (1-6) / monk tone (1-10). */
  value?: number;
};

export type QuizQuestion = {
  id: string;
  /** Which axis/dimension this question informs. */
  kind: SkinAxis | 'phototype' | 'monk' | 'sensitivities' | 'pregnancy';
  eyebrow: string;
  prompt: string;
  options: readonly QuizOption[];
  multiSelect?: boolean;
};

const DRAFT_QUIZ: readonly QuizQuestion[] = [
  {
    id: 'q_oil',
    kind: 'oily_dry',
    eyebrow: 'OIL + MOISTURE',
    prompt: 'A few hours after cleansing, how does your skin usually feel?',
    options: [
      { id: 'a', label: 'Tight or flaky', score: { oily_dry: -2 } },
      { id: 'b', label: 'Comfortable', score: { oily_dry: 0 } },
      { id: 'c', label: 'Shiny in places', score: { oily_dry: 1 } },
      { id: 'd', label: 'Oily all over', score: { oily_dry: 2 } },
    ],
  },
  {
    id: 'q_hydration',
    kind: 'oily_dry',
    eyebrow: 'OIL + MOISTURE',
    prompt: 'How often does your skin ask for more moisture during the day?',
    options: [
      { id: 'a', label: 'Most days', score: { oily_dry: -2 } },
      { id: 'b', label: 'Some days', score: { oily_dry: 0 } },
      { id: 'c', label: 'Rarely', score: { oily_dry: 1 } },
    ],
  },
  {
    id: 'q_react',
    kind: 'sensitive_resistant',
    eyebrow: 'SENSITIVITY',
    prompt: 'When you try a new product, how often does your skin react?',
    options: [
      { id: 'a', label: 'Often stings, burns, or reddens', score: { sensitive_resistant: 2 } },
      { id: 'b', label: 'Occasionally reacts', score: { sensitive_resistant: 1 } },
      { id: 'c', label: 'Almost never reacts', score: { sensitive_resistant: -2 } },
    ],
  },
  {
    id: 'q_redness',
    kind: 'sensitive_resistant',
    eyebrow: 'SENSITIVITY',
    prompt: 'How often do you notice redness, flushing, or a hot-feeling face?',
    options: [
      { id: 'a', label: 'Frequently', score: { sensitive_resistant: 2 } },
      { id: 'b', label: 'Sometimes', score: { sensitive_resistant: 0 } },
      { id: 'c', label: 'Rarely or never', score: { sensitive_resistant: -2 } },
    ],
  },
  {
    id: 'q_tone',
    kind: 'pigmented_non',
    eyebrow: 'TONE',
    prompt: 'Do you notice dark spots, uneven tone, or areas that look more pigmented?',
    options: [
      { id: 'a', label: 'Yes, noticeably', score: { pigmented_non: 2 } },
      { id: 'b', label: 'A little', score: { pigmented_non: 1 } },
      { id: 'c', label: 'Not really', score: { pigmented_non: -2 } },
    ],
  },
  {
    id: 'q_marks',
    kind: 'pigmented_non',
    eyebrow: 'TONE',
    prompt: 'After a breakout or irritation, how long do marks tend to linger?',
    options: [
      { id: 'a', label: 'Weeks or longer', score: { pigmented_non: 2 } },
      { id: 'b', label: 'A short while', score: { pigmented_non: 0 } },
      { id: 'c', label: 'Rarely leaves a mark', score: { pigmented_non: -2 } },
    ],
  },
  {
    id: 'q_lines',
    kind: 'wrinkled_tight',
    eyebrow: 'FIRMNESS',
    prompt: 'Which best describes fine lines or firmness right now?',
    options: [
      {
        id: 'a',
        label: 'Fine lines or firmness changes are visible',
        score: { wrinkled_tight: 2 },
      },
      { id: 'b', label: 'I am starting to notice small changes', score: { wrinkled_tight: 1 } },
      { id: 'c', label: 'Not something I notice right now', score: { wrinkled_tight: -2 } },
    ],
  },
  {
    id: 'q_sun',
    kind: 'wrinkled_tight',
    eyebrow: 'FIRMNESS',
    prompt: 'Thinking about your usual outdoor time, how much sun exposure has your skin had?',
    options: [
      { id: 'a', label: 'A lot over time', score: { wrinkled_tight: 2 } },
      { id: 'b', label: 'A moderate amount', score: { wrinkled_tight: 0 } },
      { id: 'c', label: 'Not much', score: { wrinkled_tight: -2 } },
    ],
  },
  {
    id: 'q_phototype',
    kind: 'phototype',
    eyebrow: 'SUN RESPONSE',
    prompt: 'Without sunscreen, how does your skin usually respond to strong sun?',
    options: [
      { id: '1', label: 'Always burns', value: 1 },
      { id: '2', label: 'Usually burns', value: 2 },
      { id: '3', label: 'Sometimes burns', value: 3 },
      { id: '4', label: 'Rarely burns', value: 4 },
      { id: '5', label: 'Very rarely burns', value: 5 },
      { id: '6', label: 'Does not burn', value: 6 },
    ],
  },
  {
    id: 'q_monk',
    kind: 'monk',
    eyebrow: 'SKIN TONE',
    prompt: 'Choose the skin tone range closest to yours.',
    options: Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      label: `Tone ${i + 1}`,
      value: i + 1,
    })),
  },
  {
    id: 'q_sensitivities',
    kind: 'sensitivities',
    eyebrow: 'SENSITIVITIES',
    prompt: 'Any known sensitivities or ingredients you try to avoid? Select all that apply.',
    multiSelect: true,
    options: [
      { id: 'fragrance', label: 'Fragrance' },
      { id: 'essential_oils', label: 'Essential oils' },
      { id: 'alcohol', label: 'Drying alcohols' },
      { id: 'none', label: 'None that I know of' },
    ],
  },
  {
    id: 'q_pregnancy',
    kind: 'pregnancy',
    eyebrow: 'SAFETY',
    prompt: 'Are you pregnant, trying to become pregnant, or breastfeeding?',
    options: [
      { id: 'none', label: 'No' },
      { id: 'pregnant', label: 'Pregnant or trying' },
      { id: 'breastfeeding', label: 'Breastfeeding' },
      { id: 'prefer_not', label: 'Prefer not to say' },
    ],
  },
];

function freezeQuiz(quiz: readonly QuizQuestion[]): readonly QuizQuestion[] {
  return Object.freeze(
    quiz.map((question) =>
      Object.freeze({
        ...question,
        options: Object.freeze(
          question.options.map((option) =>
            Object.freeze({
              ...option,
              ...(option.score ? { score: Object.freeze({ ...option.score }) } : {}),
            }),
          ),
        ),
      }),
    ),
  );
}

/** The only quiz definition the production scorer is permitted to evaluate. */
export const ONBOARDING_QUIZ = freezeQuiz(DRAFT_QUIZ);

export type CanonicalSemanticValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalSemanticValue[]
  | { readonly [key: string]: CanonicalSemanticValue };

/**
 * Serialize semantic data for hashing. Object keys are lexical; array order is
 * significant. Undefined values, non-finite numbers, and unsupported runtime
 * objects are rejected rather than silently normalized.
 */
export function canonicalSemanticJson(value: CanonicalSemanticValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('QUIZ_CONTRACT_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSemanticJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as { readonly [key: string]: CanonicalSemanticValue };
    return `{${Object.keys(record)
      .sort()
      .map((key) => {
        const child = record[key];
        if (child === undefined) throw new Error('QUIZ_CONTRACT_UNDEFINED_VALUE');
        return `${JSON.stringify(key)}:${canonicalSemanticJson(child)}`;
      })
      .join(',')}}`;
  }
  throw new Error('QUIZ_CONTRACT_UNSUPPORTED_VALUE');
}

export const QUIZ_CONTENT_MANIFEST = {
  manifestSchemaVersion: 1,
  contractId: QUIZ_CONTRACT_ID,
  contentVersion: QUIZ_CONTENT_VERSION,
  questions: ONBOARDING_QUIZ.map((question) => ({
    id: question.id,
    kind: question.kind,
    eyebrow: question.eyebrow,
    prompt: question.prompt,
    multiSelect: question.multiSelect === true,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      subtitle: option.subtitle ?? null,
    })),
  })),
} as const satisfies CanonicalSemanticValue;

export const QUIZ_SCORING_MANIFEST = {
  manifestSchemaVersion: 1,
  contractId: QUIZ_CONTRACT_ID,
  scoringVersion: QUIZ_SCORING_VERSION,
  outputSchemaVersion: QUIZ_OUTPUT_SCHEMA_VERSION,
  axisOrder: QUIZ_AXIS_ORDER,
  axisPoles: QUIZ_AXIS_POLES,
  rules: {
    answerKeySet: 'exact_current_question_ids',
    invalidAnswer: 'reject',
    multiSelectOrder: 'canonical_question_option_order',
    multiSelectDuplicates: 'reject',
    noneOption: 'exclusive_and_omitted_from_sensitivities',
    rawAxisScore: 'signed_integer_sum',
    axisMaximum: 'sum_question_maximum_absolute_contribution',
    basisPointsMinimum: 0,
    basisPointsMaximum: 10000,
    basisPointsFormula: '((rawScore + axisMaximum) * 10000) / (2 * axisMaximum)',
    basisPointsDivision: 'must_be_exact_integer',
    poleTieRule: 'raw_score_greater_than_or_equal_to_zero_uses_positive_pole',
  },
  questions: ONBOARDING_QUIZ.map((question) => ({
    id: question.id,
    kind: question.kind,
    multiSelect: question.multiSelect === true,
    options: question.options.map((option) => ({
      id: option.id,
      value: option.value ?? null,
      score: Object.fromEntries(
        QUIZ_AXIS_ORDER.filter((axis) => option.score?.[axis] !== undefined).map((axis) => [
          axis,
          option.score![axis]!,
        ]),
      ),
    })),
  })),
} as const satisfies CanonicalSemanticValue;

export const QUIZ_COMBINED_MANIFEST = {
  manifestSchemaVersion: 1,
  contractId: QUIZ_CONTRACT_ID,
  outputSchemaVersion: QUIZ_OUTPUT_SCHEMA_VERSION,
  content: QUIZ_CONTENT_MANIFEST,
  scoring: QUIZ_SCORING_MANIFEST,
} as const satisfies CanonicalSemanticValue;

// Pinned by quizContract.test.ts. Changing any reviewed semantic byte requires
// an explicit version/hash update and a fresh professional review.
export const QUIZ_CONTENT_SHA256 =
  'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb' as const;
export const QUIZ_SCORING_SHA256 =
  'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893' as const;
export const QUIZ_CONTRACT_SHA256 =
  '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16' as const;

export const QUIZ_SCORING_PROVENANCE = Object.freeze({
  contractId: QUIZ_CONTRACT_ID,
  contentVersion: QUIZ_CONTENT_VERSION,
  scoringVersion: QUIZ_SCORING_VERSION,
  outputSchemaVersion: QUIZ_OUTPUT_SCHEMA_VERSION,
  contentSha256: QUIZ_CONTENT_SHA256,
  scoringSha256: QUIZ_SCORING_SHA256,
  contractSha256: QUIZ_CONTRACT_SHA256,
  reviewStatus: QUIZ_CONTRACT_REVIEW_STATUS,
  derivedFields: Object.freeze([
    'axisScores',
    'axesBasisPoints',
    'dspt',
    'fitzpatrick',
    'monkTone',
    'sensitivities',
  ] as const),
  poleTieRule: 'raw_score_greater_than_or_equal_to_zero_uses_positive_pole',
});

export type QuizScoringProvenance = typeof QUIZ_SCORING_PROVENANCE;
