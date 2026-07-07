import { track } from '@/lib/analytics/track';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

const KEY = 'onskin.routineActivation.v1';

type ActivationFlags = {
  firstRoutineCreated: boolean;
  firstUsefulInsight: boolean;
};

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

export async function recordRoutinePlanAnalytics({
  insightCount,
  isExample,
  source,
}: {
  insightCount: number;
  isExample: boolean;
  source: 'example' | 'routine_plan';
}): Promise<void> {
  track('routine_created', { source });

  if (isExample) return;

  const flags = await loadFlags();
  let changed = false;

  if (!flags.firstRoutineCreated) {
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
