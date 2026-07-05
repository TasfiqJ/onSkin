import type { PregnancyStatus, SkinAxis } from '@onskin/types';

/**
 * Skin-quiz engine + original draft content.
 *
 * BLOCKED: B-QUIZ-COPY. The validated Baumann BSTI questionnaire is patented
 * and copyrighted (docs/01 section 2). The 4-axis concept is implementable, but
 * the exact questions and scoring still need patent/trademark attorney review.
 * The copy below is original OnSkin draft wording, not final legally reviewed
 * quiz copy.
 */

// Per axis: a positive option score leans toward the first pole letter.
const AXIS_POLES: Record<SkinAxis, { positive: string; negative: string; posLabel: string; negLabel: string }> = {
  oily_dry: { positive: 'O', negative: 'D', posLabel: 'Oily', negLabel: 'Dry' },
  sensitive_resistant: { positive: 'S', negative: 'R', posLabel: 'Sensitive', negLabel: 'Resistant' },
  pigmented_non: { positive: 'P', negative: 'N', posLabel: 'Uneven tone', negLabel: 'Even' },
  wrinkled_tight: { positive: 'W', negative: 'T', posLabel: 'Lined', negLabel: 'Firm' },
};

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
  options: QuizOption[];
  multiSelect?: boolean;
};

export const ONBOARDING_QUIZ: QuizQuestion[] = [
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
      { id: 'a', label: 'Fine lines or firmness changes are visible', score: { wrinkled_tight: 2 } },
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

export type QuizAnswers = Record<string, string | string[]>; // questionId -> optionId(s)

export type QuizCompletionState = {
  answeredCount: number;
  total: number;
  complete: boolean;
  missingQuestionIds: string[];
};

export function isQuizQuestionAnswered(
  question: QuizQuestion,
  answer: string | string[] | undefined,
): boolean {
  const optionIds = new Set(question.options.map((option) => option.id));
  if (question.multiSelect === true) {
    return (
      Array.isArray(answer) &&
      answer.length > 0 &&
      answer.every((optionId) => optionIds.has(optionId))
    );
  }
  return typeof answer === 'string' && optionIds.has(answer);
}

export function getQuizCompletionState(
  answers: QuizAnswers,
  quiz: QuizQuestion[] = ONBOARDING_QUIZ,
): QuizCompletionState {
  const missingQuestionIds: string[] = [];
  for (const question of quiz) {
    if (!isQuizQuestionAnswered(question, answers[question.id])) {
      missingQuestionIds.push(question.id);
    }
  }
  return {
    answeredCount: quiz.length - missingQuestionIds.length,
    total: quiz.length,
    complete: missingQuestionIds.length === 0,
    missingQuestionIds,
  };
}

export function toggleExclusiveNoneSelection(
  current: readonly string[],
  optionId: string,
  noneOptionId = 'none',
): string[] {
  if (current.includes(optionId)) return current.filter((id) => id !== optionId);
  if (optionId === noneOptionId) return [noneOptionId];
  return [...current.filter((id) => id !== noneOptionId), optionId];
}

export type SkinProfileResult = {
  axes: Record<SkinAxis, number>; // normalized 0..1 (0 = negative pole, 1 = positive pole)
  axisScores: Record<SkinAxis, number>; // raw signed sums
  dspt: string; // 4-letter type, e.g. "DSNT"
  fitzpatrick: number | null;
  monkTone: number | null;
  sensitivities: string[];
  pregnancyStatus: PregnancyStatus;
};

const AXES: SkinAxis[] = ['oily_dry', 'sensitive_resistant', 'pigmented_non', 'wrinkled_tight'];

/** Pure scoring. Sum signed axis contributions, derive poles + a 0..1 slider position. */
export function scoreQuiz(answers: QuizAnswers, quiz: QuizQuestion[] = ONBOARDING_QUIZ): SkinProfileResult {
  const axisScores: Record<SkinAxis, number> = {
    oily_dry: 0,
    sensitive_resistant: 0,
    pigmented_non: 0,
    wrinkled_tight: 0,
  };
  const axisMax: Record<SkinAxis, number> = {
    oily_dry: 0,
    sensitive_resistant: 0,
    pigmented_non: 0,
    wrinkled_tight: 0,
  };
  let fitzpatrick: number | null = null;
  let monkTone: number | null = null;
  let sensitivities: string[] = [];
  let pregnancyStatus: PregnancyStatus = 'prefer_not';

  for (const q of quiz) {
    const answer = answers[q.id];
    if (q.kind === 'sensitivities') {
      sensitivities = Array.isArray(answer) ? answer.filter((a) => a !== 'none') : [];
      continue;
    }
    if (q.kind === 'pregnancy') {
      const v = typeof answer === 'string' ? answer : 'prefer_not';
      pregnancyStatus = (['none', 'pregnant', 'breastfeeding', 'prefer_not'] as const).includes(
        v as PregnancyStatus,
      )
        ? (v as PregnancyStatus)
        : 'prefer_not';
      continue;
    }
    const chosen = q.options.find((o) => o.id === answer);
    if (!chosen) continue;
    if (q.kind === 'phototype') {
      fitzpatrick = chosen.value ?? null;
      continue;
    }
    if (q.kind === 'monk') {
      monkTone = chosen.value ?? null;
      continue;
    }
    // Axis question. Accumulate score and track the max possible magnitude.
    for (const axis of AXES) {
      const contribution = chosen.score?.[axis];
      if (contribution !== undefined) axisScores[axis] += contribution;
      const maxForOption = Math.max(...q.options.map((o) => Math.abs(o.score?.[axis] ?? 0)));
      if (q.kind === axis) axisMax[axis] += maxForOption;
    }
  }

  const axes = {} as Record<SkinAxis, number>;
  let dspt = '';
  for (const axis of AXES) {
    const max = axisMax[axis] || 1;
    // Map signed [-max, +max] to [0,1].
    const normalized = Math.min(1, Math.max(0, (axisScores[axis] + max) / (2 * max)));
    axes[axis] = normalized;
    dspt += normalized >= 0.5 ? AXIS_POLES[axis].positive : AXIS_POLES[axis].negative;
  }

  return { axes, axisScores, dspt, fitzpatrick, monkTone, sensitivities, pregnancyStatus };
}

export const AXIS_LABELS = AXIS_POLES;
