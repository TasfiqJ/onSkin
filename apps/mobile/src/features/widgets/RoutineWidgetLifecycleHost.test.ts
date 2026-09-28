import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoutineWidgetLifecycleSlot } from './RoutineWidgetLifecycleHost';

const mocks = vi.hoisted(() => ({
  appState: 'active' as 'active' | 'background',
  appStateListener: null as ((state: 'active' | 'background') => void) | null,
  mount: vi.fn(),
  releases: [] as (ReturnType<typeof vi.fn> & { refresh?: ReturnType<typeof vi.fn> })[],
  invalidateQueries: vi.fn(),
  useQuery: vi.fn(),
  plan: {
    data: { plan: {}, isExample: false },
    isLoading: false,
    isError: false,
    sourceReady: true,
    isExample: false,
  },
  cycle: {
    data: {},
    isLoading: false,
    isError: false,
    sourceReady: true,
    isExample: false,
  },
  entitlement: { data: { isPro: true }, isLoading: false, isError: false },
  preferences: {
    data: { liveActivityEnabled: true },
    isLoading: false,
    isError: false,
  },
  project: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mocks.appState;
    },
    addEventListener: (_event: string, listener: typeof mocks.appStateListener) => {
      mocks.appStateListener = listener;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mocks.useQuery(options),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('./lifecycleRuntime', () => ({
  mountRoutineWidgetLifecycle: (input: unknown, publication: unknown) =>
    mocks.mount(input, publication),
}));
vi.mock('@/features/routine/usePlan', () => ({ usePlan: () => mocks.plan }));
vi.mock('@/features/scheduler/useCycle', () => ({ useCycle: () => mocks.cycle }));
vi.mock('@/features/subscription/useEntitlement', () => ({
  useEntitlement: () => mocks.entitlement,
}));
vi.mock('@/features/notifications/useNotifications', () => ({
  useNotifPrefs: () => mocks.preferences,
}));
vi.mock('@/features/today/completionsStore', () => ({ getCompletedSteps: vi.fn() }));
vi.mock('@/features/today/routineProjection', () => ({
  projectTodayRoutine: (input: unknown) => mocks.project(input),
}));
vi.mock('@/features/today/useToday', () => ({
  currentRoutineType: () => 'AM',
  localDateString: () => '2026-07-16',
}));

let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.appState = 'active';
  mocks.appStateListener = null;
  mocks.mount.mockReset();
  mocks.releases = [];
  mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
  mocks.useQuery.mockReset().mockReturnValue({
    data: new Set(['AM:cleanser']),
    isLoading: false,
    isError: false,
  });
  mocks.plan.data = { plan: {}, isExample: false };
  mocks.plan.isLoading = false;
  mocks.plan.isError = false;
  mocks.plan.sourceReady = true;
  mocks.plan.isExample = false;
  mocks.cycle.data = {};
  mocks.cycle.isLoading = false;
  mocks.cycle.isError = false;
  mocks.cycle.sourceReady = true;
  mocks.cycle.isExample = false;
  mocks.entitlement.data = { isPro: true };
  mocks.entitlement.isLoading = false;
  mocks.entitlement.isError = false;
  mocks.preferences.data = { liveActivityEnabled: true };
  mocks.preferences.isLoading = false;
  mocks.preferences.isError = false;
  mocks.project.mockReset().mockReturnValue({
    am: {
      stepKeys: ['AM:cleanser', 'AM:spf'],
      completedCount: 1,
    },
    pm: {
      stepKeys: ['PM:cleanser'],
      completedCount: 0,
    },
  });
  mocks.mount.mockImplementation(() => {
    const release = vi.fn() as ReturnType<typeof vi.fn> & {
      refresh?: ReturnType<typeof vi.fn>;
    };
    release.refresh = vi.fn().mockResolvedValue(undefined);
    mocks.releases.push(release);
    return release;
  });
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('routine widget lifecycle host', () => {
  it('mounts only released authority and releases before changing owner', async () => {
    await act(async () => {
      renderer = create(createElement(RoutineWidgetLifecycleSlot, { authority: null }));
    });
    expect(mocks.mount).not.toHaveBeenCalled();

    await act(async () => {
      renderer!.update(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    expect(mocks.mount).toHaveBeenCalledOnce();
    expect(mocks.mount.mock.calls[0]?.[0]).toEqual({
      ownerUserId: 'owner-a',
      processingEpoch: 7,
    });
    expect(mocks.releases[0]?.refresh).toHaveBeenCalledOnce();

    await act(async () => {
      renderer!.update(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    expect(mocks.mount).toHaveBeenCalledOnce();
    expect(mocks.releases[0]).not.toHaveBeenCalled();

    await act(async () => {
      renderer!.update(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-b', processingEpoch: 8 },
        }),
      );
    });
    expect(mocks.releases[0]).toHaveBeenCalledOnce();
    expect(mocks.mount.mock.calls[1]?.[0]).toEqual({
      ownerUserId: 'owner-b',
      processingEpoch: 8,
    });

    await act(async () => {
      renderer!.update(createElement(RoutineWidgetLifecycleSlot, { authority: null }));
    });
    expect(mocks.releases[1]).toHaveBeenCalledOnce();
  });

  it('publishes only canonical counts and remaining opaque step keys for an eligible Pro owner', async () => {
    await act(async () => {
      renderer = create(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });

    const publication = mocks.mount.mock.calls[0]?.[1] as {
      readSnapshot: () => unknown;
      onCanonicalMutation: () => Promise<void>;
    };
    expect(publication.readSnapshot()).toEqual({
      enabled: true,
      completedCount: 1,
      liveActivityEnabled: true,
      localDate: '2026-07-16',
      phase: 'AM',
      remainingStepKeys: ['AM:spf'],
      totalCount: 2,
    });

    await publication.onCanonicalMutation();
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['completions'] });
  });

  it('remounts into a hard disabled snapshot on confirmed entitlement loss', async () => {
    await act(async () => {
      renderer = create(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    mocks.entitlement.data = { isPro: false };
    await act(async () => {
      renderer!.update(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    expect(mocks.releases[0]).toHaveBeenCalledOnce();
    expect(mocks.mount).toHaveBeenCalledTimes(2);
    const disabledPublication = mocks.mount.mock.calls[1]?.[1] as {
      readSnapshot: () => unknown;
    };
    expect(disabledPublication.readSnapshot()).toEqual({ enabled: false });

    await act(async () => mocks.appStateListener?.('background'));
    expect(disabledPublication.readSnapshot()).toEqual({ enabled: false });
  });

  it('withholds eligible publication while backgrounded', async () => {
    await act(async () => {
      renderer = create(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    const publication = mocks.mount.mock.calls[0]?.[1] as { readSnapshot: () => unknown };

    await act(async () => mocks.appStateListener?.('background'));
    expect(publication.readSnapshot()).toBeNull();
  });

  it('withholds publication without requesting destructive cleanup while canonical data reloads', async () => {
    await act(async () => {
      renderer = create(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    const publication = mocks.mount.mock.calls[0]?.[1] as { readSnapshot: () => unknown };

    mocks.useQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    await act(async () => {
      renderer!.update(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });

    expect(publication.readSnapshot()).toBeNull();
    expect(mocks.releases[0]).not.toHaveBeenCalled();
  });

  it.each([
    ['plan query error', () => (mocks.plan.isError = true)],
    ['cycle query error', () => (mocks.cycle.isError = true)],
    ['plan source unavailable', () => (mocks.plan.sourceReady = false)],
    ['cycle source unavailable', () => (mocks.cycle.sourceReady = false)],
    [
      'Maya plan fallback',
      () => {
        mocks.plan.isExample = true;
        mocks.plan.data = { plan: {}, isExample: true };
      },
    ],
    ['example-derived cycle', () => (mocks.cycle.isExample = true)],
  ])('never publishes cached or example routine data after a %s', async (_label, failSource) => {
    await act(async () => {
      renderer = create(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    const publication = mocks.mount.mock.calls[0]?.[1] as { readSnapshot: () => unknown };
    expect(publication.readSnapshot()).toMatchObject({ enabled: true });

    failSource();
    await act(async () => {
      renderer!.update(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });

    expect(publication.readSnapshot()).toBeNull();
    expect(mocks.releases[0]).not.toHaveBeenCalled();
  });

  it('remounts the lifecycle on a confirmed Free to Pro transition but retains it for null loading', async () => {
    mocks.entitlement.data = { isPro: false };
    await act(async () => {
      renderer = create(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    expect(mocks.mount).toHaveBeenCalledOnce();
    const disabledPublication = mocks.mount.mock.calls[0]?.[1] as {
      readSnapshot: () => unknown;
    };
    expect(disabledPublication.readSnapshot()).toEqual({ enabled: false });

    mocks.entitlement.data = { isPro: true };
    mocks.entitlement.isLoading = true;
    await act(async () => {
      renderer!.update(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    expect(mocks.releases[0]).toHaveBeenCalledOnce();
    expect(mocks.mount).toHaveBeenCalledTimes(2);
    const proPublication = mocks.mount.mock.calls[1]?.[1] as { readSnapshot: () => unknown };
    expect(proPublication.readSnapshot()).toBeNull();

    mocks.entitlement.isLoading = false;
    await act(async () => {
      renderer!.update(
        createElement(RoutineWidgetLifecycleSlot, {
          authority: { ownerUserId: 'owner-a', processingEpoch: 7 },
        }),
      );
    });
    expect(mocks.mount).toHaveBeenCalledTimes(2);
    expect(mocks.releases[1]).not.toHaveBeenCalled();
    expect(proPublication.readSnapshot()).toEqual({
      enabled: true,
      completedCount: 1,
      liveActivityEnabled: true,
      localDate: '2026-07-16',
      phase: 'AM',
      remainingStepKeys: ['AM:spf'],
      totalCount: 2,
    });
  });
});
