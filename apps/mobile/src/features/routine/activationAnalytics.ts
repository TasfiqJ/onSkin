import { track } from '@/lib/analytics/track';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

const KEY = 'routinekind.routineActivation.v1';

type ActivationFlags = {
  firstRoutineCreated: boolean;
  firstUsefulInsight: boolean;
};

type FirstInsightSource = 'routine_plan' | 'reveal';

const EMPTY_FLAGS: ActivationFlags = {
  firstRoutineCreated: false,
  firstUsefulInsight: false,
};

function normalizeFlags(value: unknown): ActivationFlags | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const input = value as Partial<Record<keyof ActivationFlags, unknown>>;
  return {
    firstRoutineCreated: input.firstRoutineCreated === true,
    firstUsefulInsight: input.firstUsefulInsight === true,
  };
}

async function loadFlags(): Promise<ActivationFlags> {
  let raw: string | null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return { ...EMPTY_FLAGS };
  }
  if (!raw) return { ...EMPTY_FLAGS };

  try {
    const normalized = normalizeFlags(JSON.parse(raw) as unknown);
    if (normalized) return normalized;
  } catch {
    /* malformed local analytics marker */
  }

  await removePrivateItem(KEY).catch(() => undefined);
  return { ...EMPTY_FLAGS };
}

async function saveFlags(flags: ActivationFlags): Promise<void> {
  await setPrivateItem(KEY, JSON.stringify(flags));
}

export async function recordFirstUsefulInsightAnalytics({
  insightCount,
  isExample,
  source,
}: {
  insightCount: number;
  isExample: boolean;
  source: FirstInsightSource;
}): Promise<void> {
  if (isExample || insightCount <= 0) return;

  const flags = await loadFlags();
  if (flags.firstUsefulInsight) return;

  track('first_useful_insight', { count: insightCount, source });
  flags.firstUsefulInsight = true;
  await saveFlags(flags).catch(() => undefined);
}

export async function recordRoutinePlanAnalytics({
  routineStepCount,
  insightCount,
  isExample,
  source,
}: {
  routineStepCount: number;
  insightCount: number;
  isExample: boolean;
  source: 'example' | 'routine_plan';
}): Promise<void> {
  track('routine_plan_viewed', { source });

  if (isExample) return;

  const hasRoutineSteps = routineStepCount > 0;
  if (hasRoutineSteps) {
    track('routine_created', { source });
  }

  const flags = await loadFlags();
  let changed = false;

  if (hasRoutineSteps && !flags.firstRoutineCreated) {
    track('first_routine_created', { source });
    flags.firstRoutineCreated = true;
    changed = true;
  }

  if (insightCount > 0 && !flags.firstUsefulInsight) {
    track('first_useful_insight', { count: insightCount, source });
    flags.firstUsefulInsight = true;
    changed = true;
  }

  if (changed) await saveFlags(flags).catch(() => undefined);
}

export async function clearRoutineActivationAnalytics(): Promise<void> {
  await removePrivateItem(KEY);
}
