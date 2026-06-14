import type { PregnancyStatus, SkinAxis } from '@onskin/types';

/**
 * Skin-quiz ENGINE (production-ready) + PLACEHOLDER content.
 *
 * BLOCKED: B-QUIZ-COPY. The validated Baumann BSTI questionnaire is patented +
 * copyrighted (docs/01 §2). The 4-axis CONCEPT (Oily/Dry, Sensitive/Resistant,
 * Pigmented/Non, Wrinkled/Tight) is implementable, but the actual questions +
 * scoring need original authoring and a mandatory patent/trademark attorney
 * review. Everything in PLACEHOLDER_QUIZ below is throwaway scaffolding to
 * exercise the engine. DO NOT SHIP. The scoring math is real and reusable.
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
  eyebrow: string; // mono label e.g. "OIL & MOISTURE"
  prompt: string;
  options: QuizOption[];
  multiSelect?: boolean;
};

// ---------------------------------------------------------------------------
// PLACEHOLDER QUIZ. Throwaway. Replace wholesale once B-QUIZ-COPY clears.
// Wording is intentionally generic and labelled so it can never be mistaken for
// final, attorney-reviewed copy.
// ---------------------------------------------------------------------------
export const PLACEHOLDER_QUIZ: QuizQuestion[] = [
  {
    id: 'q_oil',
    kind: 'oily_dry',
    eyebrow: 'PLACEHOLDER · OIL & MOISTURE',
    prompt: '[Placeholder] How does your skin feel a few hours after cleansing?',
    options: [
      { id: 'a', label: '[Placeholder] Tight or flaky', score: { oily_dry: -2 } },
      { id: 'b', label: '[Placeholder] Comfortable', score: { oily_dry: 0 } },
      { id: 'c', label: '[Placeholder] Shiny in places', score: { oily_dry: 1 } },
      { id: 'd', label: '[Placeholder] Oily all over', score: { oily_dry: 2 } },
    ],
  },
  {
    id: 'q_hydration',
    kind: 'oily_dry',
    eyebrow: 'PLACEHOLDER · OIL & MOISTURE',
    prompt: '[Placeholder] How often does your skin need extra moisture?',
    options: [
      { id: 'a', label: '[Placeholder] Constantly', score: { oily_dry: -2 } },
      { id: 'b', label: '[Placeholder] Sometimes', score: { oily_dry: 0 } },
      { id: 'c', label: '[Placeholder] Rarely', score: { oily_dry: 1 } },
    ],
  },
  {
    id: 'q_react',
    kind: 'sensitive_resistant',
    eyebrow: 'PLACEHOLDER · SENSITIVITY',
    prompt: '[Placeholder] How does your skin respond to new products?',
    options: [
      { id: 'a', label: '[Placeholder] Often stings or reddens', score: { sensitive_resistant: 2 } },
      { id: 'b', label: '[Placeholder] Occasionally', score: { sensitive_resistant: 1 } },
      { id: 'c', label: '[Placeholder] Almost never', score: { sensitive_resistant: -2 } },
    ],
  },
  {
    id: 'q_redness',
    kind: 'sensitive_resistant',
    eyebrow: 'PLACEHOLDER · SENSITIVITY',
    prompt: '[Placeholder] Do you experience redness or flushing?',
    options: [
      { id: 'a', label: '[Placeholder] Frequently', score: { sensitive_resistant: 2 } },
      { id: 'b', label: '[Placeholder] Sometimes', score: { sensitive_resistant: 0 } },
      { id: 'c', label: '[Placeholder] No', score: { sensitive_resistant: -2 } },
    ],
  },
  {
    id: 'q_tone',
    kind: 'pigmented_non',
    eyebrow: 'PLACEHOLDER · TONE',
    prompt: '[Placeholder] Do you notice dark spots or uneven tone?',
    options: [
      { id: 'a', label: '[Placeholder] Yes, noticeably', score: { pigmented_non: 2 } },
      { id: 'b', label: '[Placeholder] A little', score: { pigmented_non: 1 } },
      { id: 'c', label: '[Placeholder] Not really', score: { pigmented_non: -2 } },
    ],
  },
  {
    id: 'q_marks',
    kind: 'pigmented_non',
    eyebrow: 'PLACEHOLDER · TONE',
    prompt: '[Placeholder] Do marks linger after a breakout?',
    options: [
      { id: 'a', label: '[Placeholder] For a long time', score: { pigmented_non: 2 } },
      { id: 'b', label: '[Placeholder] Briefly', score: { pigmented_non: 0 } },
      { id: 'c', label: '[Placeholder] Rarely', score: { pigmented_non: -2 } },
    ],
  },
  {
    id: 'q_lines',
    kind: 'wrinkled_tight',
    eyebrow: 'PLACEHOLDER · FIRMNESS',
    prompt: '[Placeholder] Do you see fine lines or loss of firmness?',
    options: [
      { id: 'a', label: '[Placeholder] Yes', score: { wrinkled_tight: 2 } },
      { id: 'b', label: '[Placeholder] Starting to', score: { wrinkled_tight: 1 } },
      { id: 'c', label: '[Placeholder] Not yet', score: { wrinkled_tight: -2 } },
    ],
  },
  {
    id: 'q_sun',
    kind: 'wrinkled_tight',
    eyebrow: 'PLACEHOLDER · FIRMNESS',
    prompt: '[Placeholder] How much lifetime sun exposure have you had?',
    options: [
      { id: 'a', label: '[Placeholder] A lot', score: { wrinkled_tight: 2 } },
      { id: 'b', label: '[Placeholder] Moderate', score: { wrinkled_tight: 0 } },
      { id: 'c', label: '[Placeholder] Minimal', score: { wrinkled_tight: -2 } },
    ],
  },
  {
    id: 'q_phototype',
    kind: 'phototype',
    eyebrow: 'PLACEHOLDER · SUN RESPONSE',
    prompt: '[Placeholder] How does your skin react to sun? (paired with a tone selector for inclusivity)',
    options: [
      { id: '1', label: '[Placeholder] Always burns', value: 1 },
      { id: '2', label: '[Placeholder] Usually burns', value: 2 },
      { id: '3', label: '[Placeholder] Sometimes burns', value: 3 },
      { id: '4', label: '[Placeholder] Rarely burns', value: 4 },
      { id: '5', label: '[Placeholder] Very rarely burns', value: 5 },
      { id: '6', label: '[Placeholder] Never burns', value: 6 },
    ],
  },
  {
    id: 'q_monk',
    kind: 'monk',
    eyebrow: 'PLACEHOLDER · SKIN TONE',
    prompt: '[Placeholder] Choose the tone closest to yours (Monk 10-shade scale).',
    options: Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      label: `[Placeholder] Tone ${i + 1}`,
      value: i + 1,
    })),
  },
  {
    id: 'q_sensitivities',
    kind: 'sensitivities',
    eyebrow: 'PLACEHOLDER · SENSITIVITIES',
    prompt: '[Placeholder] Any known sensitivities or allergies? (select all)',
    multiSelect: true,
    options: [
      { id: 'fragrance', label: '[Placeholder] Fragrance' },
      { id: 'essential_oils', label: '[Placeholder] Essential oils' },
      { id: 'alcohol', label: '[Placeholder] Drying alcohols' },
      { id: 'none', label: '[Placeholder] None that I know of' },
    ],
  },
  {
    id: 'q_pregnancy',
    kind: 'pregnancy',
    eyebrow: 'PLACEHOLDER · SAFETY',
    prompt: '[Placeholder] Are you pregnant or breastfeeding? (affects retinoid safety)',
    options: [
      { id: 'none', label: '[Placeholder] No' },
      { id: 'pregnant', label: '[Placeholder] Pregnant' },
      { id: 'breastfeeding', label: '[Placeholder] Breastfeeding' },
      { id: 'prefer_not', label: '[Placeholder] Prefer not to say' },
    ],
  },
];

export type QuizAnswers = Record<string, string | string[]>; // questionId -> optionId(s)

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
export function scoreQuiz(answers: QuizAnswers, quiz: QuizQuestion[] = PLACEHOLDER_QUIZ): SkinProfileResult {
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
    // axis question. Accumulate score and track the max possible magnitude.
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
