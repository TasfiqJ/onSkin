import * as React from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DisruptionScreen from '@/app/cycle/disruption';
import PhasedIntroScreen from '@/app/cycle/phased-intro';
import ProcedureScreen from '@/app/cycle/procedure';
import RecoveryScreen from '@/app/cycle/recovery';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import { cycleConfigAuthoritySnapshot, cycleConfigQueryKey } from './cycleConfigAuthority';
import type { CycleConfig } from './cycleStore';
import type { Cycle, SchedulerActive } from './orchestrate';

type RampPayload = {
  items: {
    productId: string;
    state: { freqPerWeek: number };
  }[];
};

const RAMP_KEY = ['c07b-cycle-route-readiness-ramp'] as const;

const mocks = vi.hoisted(() => ({
  shelfRead: vi.fn(),
  profileRead: vi.fn(),
  rampRead: vi.fn(),
  configRead: vi.fn(),
  skip: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  overrideStaging: vi.fn(),
  beginRecovery: vi.fn(),
  finishRecovery: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  haptic: vi.fn(),
  track: vi.fn(),
  cadence: true,
  recovery: true,
  explainability: true,
}));

vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

vi.mock('expo-router', () => ({
  router: { push: mocks.push, replace: mocks.replace },
}));

vi.mock('@/components/ui', () => ({
  Button: 'Button',
  RouteIconButton: 'RouteIconButton',
  Screen: 'Screen',
  Sheet: 'Sheet',
  StateNotice: 'StateNotice',
  Text: 'Text',
}));

vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: () => mocks.cadence,
  canUseRoutineRecovery: () => mocks.recovery,
  canUseRoutineExplainabilityCopy: () => mocks.explainability,
}));

vi.mock('@/features/routine/sequencing', () => ({
  routinePhasedIntroductionDelayDays: () => (mocks.cadence ? 7 : null),
  shippableRoutineGuidanceCopy: () =>
    mocks.recovery
      ? {
          recoveryIrritationExplanation: 'Reviewed irritation recovery copy.',
          recoveryProcedureExplanation: 'Reviewed procedure recovery copy.',
        }
      : null,
  shippableRoutineCadencePolicy: () =>
    mocks.recovery
      ? {
          recoveryWindows: {
            defaultProcedureDays: 5,
            procedureChoicesDays: [3, 5, 7],
          },
        }
      : null,
}));

vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: () =>
    useQuery({
      queryKey: ['shelf'],
      queryFn: () => mocks.shelfRead(),
      retry: false,
      networkMode: 'always',
    }),
}));

vi.mock('./profile', () => ({
  useProfileBits: () =>
    useQuery({
      queryKey: ['skinProfileBits'],
      queryFn: () => mocks.profileRead(),
      retry: false,
      networkMode: 'always',
    }),
}));

vi.mock('@/features/routine/useRamp', () => ({
  useRamp: () => {
    const queryClient = useQueryClient();
    const query = useQuery({
      queryKey: RAMP_KEY,
      queryFn: () => mocks.rampRead(),
      retry: false,
      networkMode: 'always',
    });
    const sourceReady =
      !query.isLoading && !query.isError && !query.isFetching && query.data !== undefined;

    return {
      items: query.data?.items ?? [],
      isLoading: query.isLoading,
      isError: query.isError,
      isRefreshing: query.isFetching,
      sourceReady,
      isExample: false,
      isSourceCurrent: () => {
        const state = queryClient.getQueryState(RAMP_KEY);
        return Boolean(
          sourceReady &&
          state?.status === 'success' &&
          state.fetchStatus === 'idle' &&
          !state.isInvalidated &&
          state.data === query.data,
        );
      },
      retry: async () => {
        await query.refetch({ cancelRefetch: false, throwOnError: true });
      },
    };
  },
}));

vi.mock('@/features/today/useToday', () => ({
  localDateString: () => '2026-10-03',
}));

vi.mock('./cycleStore', () => ({
  loadCycleConfig: () => mocks.configRead(),
  assertRoutineCadenceMutationAdmission: () => {
    if (!mocks.cadence) throw new Error('CADENCE_CLOSED');
  },
  assertRoutineRecoveryAvailable: () => {
    if (!mocks.recovery) throw new Error('RECOVERY_CLOSED');
  },
  recoveryProgress: (recovery: CycleConfig['recovery']) =>
    recovery ? { active: true, day: 2, days: recovery.days } : { active: false, day: 0, days: 0 },
  endRecovery: () => mocks.finishRecovery(),
  overrideStagingProducts: (productIds: readonly string[]) => mocks.overrideStaging(productIds),
  pauseCycle: (reason: string) => mocks.pause(reason),
  resumeCycle: () => mocks.resume(),
  saveCustomCycleDefinition: vi.fn(),
  skipTonight: () => mocks.skip(),
  startCycleToday: vi.fn(),
  startRecovery: (days: number, reason: string) => mocks.beginRecovery(days, reason),
  updateCycleConfig: vi.fn(),
}));

vi.mock('./customCycle', () => ({
  applyCustomCycleDefinition: vi.fn(),
}));

vi.mock('./orchestrate', () => ({
  orchestrate: (actives: SchedulerActive[]) => fixtureCycle(actives),
}));

vi.mock('./projection', () => ({
  nightIndex: () => 0,
  nightFor: (cycle: Cycle) => cycle.nights[0],
  weekAhead: (cycle: Cycle) =>
    cycle.nights.map((night, index) => ({
      dateISO: index === 0 ? '2026-10-03' : '2026-10-04',
      weekday: index === 0 ? 'Friday' : 'Saturday',
      night,
    })),
  nextSlotDate: () => null,
  friendlyWeekday: () => 'Saturday',
  slotLabel: (slot: string) => (slot === 'retinoid' ? 'Retinoid' : 'Recovery'),
}));

vi.mock('@/features/scheduler/CycleMutationError', () => ({
  CycleMutationError: 'CycleMutationError',
}));

vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));
vi.mock('@/lib/navigation/safeBack', () => ({
  APP_HOME_ROUTE: '/today',
  backOrReplace: mocks.back,
}));
vi.mock('@/lib/cn', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));
vi.mock('@/theme/haptics', () => ({
  haptics: { select: mocks.haptic, success: vi.fn() },
}));

function storedConfig(overrides: Partial<CycleConfig> = {}): CycleConfig {
  return {
    schemaVersion: 1,
    variant: 'auto',
    anchorISO: '2026-10-01',
    pausedFrom: null,
    pauseReason: null,
    recovery: null,
    skips: [],
    stagingOverrides: [],
    customCycle: null,
    ...overrides,
  };
}

function recoveryConfig(): CycleConfig {
  return storedConfig({
    recovery: {
      startISO: '2026-10-02',
      days: 5,
      reason: 'procedure',
    },
  });
}

function rampPayload(): RampPayload {
  return {
    items: [{ productId: 'retinol', state: { freqPerWeek: 1 } }],
  };
}

function shelf(withActive = true, staged = false) {
  return {
    items: withActive
      ? [
          {
            id: 'retinol',
            category: 'retinoid_serum',
            engineProduct: {
              id: 'retinol',
              name: 'Current retinol',
              tags: ['retinoid'],
              subflags: [],
              concentration: null,
            },
            product: { createdAt: staged ? '2099-01-01' : '2026-01-01' },
          },
        ]
      : [],
    conflictChoices: [],
  };
}

function fixtureCycle(actives: SchedulerActive[]) {
  const active = actives[0];
  if (!active) {
    return {
      cycle: null,
      amDaily: [],
      cycleActives: [],
      notes: [],
      conflictChoices: [],
    };
  }

  const nights = [
    {
      index: 0,
      slot: 'retinoid' as const,
      productId: active.id,
      productName: active.name,
      className: 'retinoid' as const,
    },
    {
      index: 1,
      slot: 'recover' as const,
      productId: null,
      productName: null,
      className: null,
    },
  ];
  const cycle: Cycle = {
    variant: 'classic',
    lengthNights: 2,
    nights,
    amDaily: [],
    notes: [],
  };

  return {
    cycle,
    amDaily: [],
    cycleActives: [
      {
        id: active.id,
        name: active.name,
        className: 'retinoid',
        eligible: true,
        staged: Boolean(active.isNew),
        maxFrequencyPerWeek: 4,
      },
    ],
    notes: active.isNew
      ? ["We'll add your Current retinol next week, once your routine settles."]
      : [],
    conflictChoices: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let renderer: ReactTestRenderer | null = null;
let client: QueryClient;
let Route: React.ComponentType = DisruptionScreen;

function element() {
  return React.createElement(QueryClientProvider, { client }, React.createElement(Route));
}

async function flush(operation: () => void = () => undefined) {
  await act(async () => {
    operation();
  });
  for (let i = 0; i < 7; i += 1) {
    await act(async () => {
      await new Promise<void>((done) => setTimeout(done, 0));
    });
  }
}

async function mount() {
  await flush(() => {
    renderer = create(element());
  });
}

async function show(route: React.ComponentType) {
  Route = route;
  await flush(() => {
    renderer?.update(element());
  });
}

function nodes(predicate: (node: ReactTestInstance) => boolean) {
  return renderer?.root.findAll(predicate) ?? [];
}

function text(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => text(child as ReactTestInstance | string)).join(' ');
}

function renderedText() {
  return renderer ? text(renderer.root) : '';
}

function button(label: string) {
  const found = nodes((node) => (node.type as unknown) === 'Button' && node.props.label === label);
  expect(found).toHaveLength(1);
  return found[0]!;
}

function pressableLabel(prefix: string) {
  const found = nodes(
    (node) =>
      (node.type as unknown) === 'Pressable' &&
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.startsWith(prefix),
  );
  expect(found).toHaveLength(1);
  return found[0]!;
}

function pressableText(value: string) {
  const found = nodes(
    (node) => (node.type as unknown) === 'Pressable' && text(node).includes(value),
  );
  expect(found).toHaveLength(1);
  return found[0]!;
}

function loadingNotice() {
  return nodes(
    (node) =>
      (node.type as unknown) === 'StateNotice' &&
      node.props.title === 'Checking your active schedule...',
  );
}

function configKey() {
  const authority = cycleConfigAuthoritySnapshot();
  if (!authority) throw new Error('missing test cycle authority');
  return cycleConfigQueryKey(authority, '2026-10-03');
}

async function invalidateConfig() {
  await act(async () => {
    await client.invalidateQueries({
      queryKey: configKey(),
      exact: true,
      refetchType: 'none',
    });
  });
}

function expectNoMutationControls() {
  expect(
    nodes(
      (node) =>
        (node.type as unknown) === 'Button' &&
        ['Start recovery', 'End recovery'].includes(String(node.props.label)),
    ),
  ).toHaveLength(0);
  expect(
    nodes(
      (node) =>
        (node.type as unknown) === 'Pressable' &&
        typeof node.props.accessibilityLabel === 'string' &&
        /^(Skip tonight|Pause my routine|Travel mode|I had a facial or peel)/.test(
          node.props.accessibilityLabel,
        ),
    ),
  ).toHaveLength(0);
  expect(renderedText()).not.toContain('ONE AT A TIME');
  expect(renderedText()).not.toContain('No recovery in progress');
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const generation = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, {
    ownerUserId: 'user-a',
    accountGeneration: generation,
  });

  mocks.cadence = true;
  mocks.recovery = true;
  mocks.explainability = true;
  Route = DisruptionScreen;

  for (const mock of [
    mocks.shelfRead,
    mocks.profileRead,
    mocks.rampRead,
    mocks.configRead,
    mocks.skip,
    mocks.pause,
    mocks.resume,
    mocks.overrideStaging,
    mocks.beginRecovery,
    mocks.finishRecovery,
    mocks.push,
    mocks.replace,
    mocks.back,
    mocks.haptic,
    mocks.track,
  ]) {
    mock.mockReset();
  }

  mocks.shelfRead.mockResolvedValue(shelf());
  mocks.profileRead.mockResolvedValue({
    source: 'local',
    sensitivity: 'normal',
    pregnancy: false,
    pregnancySafety: null,
    pregnancyStatus: 'none',
    goals: [],
  });
  mocks.rampRead.mockResolvedValue(rampPayload());
  mocks.configRead.mockResolvedValue(storedConfig());

  mocks.skip.mockResolvedValue(storedConfig({ skips: ['2026-10-03'] }));
  mocks.pause.mockImplementation(async (reason: string) =>
    storedConfig({
      pausedFrom: '2026-10-03',
      pauseReason: reason as CycleConfig['pauseReason'],
    }),
  );
  mocks.resume.mockResolvedValue(storedConfig());
  mocks.overrideStaging.mockImplementation(async (productIds: readonly string[]) =>
    storedConfig({ stagingOverrides: [...productIds] }),
  );
  mocks.beginRecovery.mockImplementation(async (days: number, reason: string) =>
    storedConfig({
      recovery: {
        startISO: '2026-10-03',
        days,
        reason: reason as NonNullable<CycleConfig['recovery']>['reason'],
      },
    }),
  );
  mocks.finishRecovery.mockResolvedValue(storedConfig());

  client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
        refetchOnMount: false,
      },
    },
  });
});

afterEach(async () => {
  if (renderer) {
    await flush(() => {
      renderer?.unmount();
    });
  }
  renderer = null;
  client.clear();
  clearActiveHealthProcessingEpoch();
});

describe('C-07B mutation route readiness', () => {
  it('withholds all mutation routes during initial loading', async () => {
    const pending = deferred<ReturnType<typeof shelf>>();
    mocks.shelfRead.mockReturnValueOnce(pending.promise);

    await mount();
    expect(loadingNotice()).toHaveLength(1);
    expectNoMutationControls();

    await show(ProcedureScreen);
    expect(loadingNotice()).toHaveLength(1);
    expectNoMutationControls();

    await show(RecoveryScreen);
    expect(loadingNotice()).toHaveLength(1);
    expectNoMutationControls();

    await show(PhasedIntroScreen);
    expect(loadingNotice()).toHaveLength(1);
    expectNoMutationControls();

    pending.resolve(shelf());
    await flush();
    expect(renderedText()).toContain('ONE AT A TIME');
  });

  it('rejects retained cycle data after a source error on every mutation route', async () => {
    await mount();
    expect(pressableLabel('Skip tonight')).toBeDefined();

    const retained = client.getQueryData(configKey());
    mocks.configRead.mockRejectedValueOnce(new Error('CONFIG_READ_FAILED'));
    await act(async () => {
      await client.refetchQueries({ queryKey: configKey(), exact: true });
    });
    await flush();

    expect(client.getQueryData(configKey())).toBe(retained);
    expect(button('Try again')).toBeDefined();
    expectNoMutationControls();

    for (const route of [ProcedureScreen, RecoveryScreen, PhasedIntroScreen]) {
      await show(route);
      expect(button('Try again')).toBeDefined();
      expectNoMutationControls();
    }
  });

  it('withholds retained data while refresh is in flight on every mutation route', async () => {
    await mount();
    const pending = deferred<CycleConfig>();
    mocks.configRead.mockReturnValueOnce(pending.promise);

    await act(async () => {
      void client.refetchQueries({ queryKey: configKey(), exact: true });
      await Promise.resolve();
    });
    await flush();

    expect(loadingNotice()).toHaveLength(1);
    expectNoMutationControls();

    for (const route of [ProcedureScreen, RecoveryScreen, PhasedIntroScreen]) {
      await show(route);
      expect(loadingNotice()).toHaveLength(1);
      expectNoMutationControls();
    }

    pending.resolve(storedConfig());
    await flush();
    expect(renderedText()).toContain('ONE AT A TIME');
  });

  it('fails closed immediately when currentness is lost', async () => {
    await mount();
    expect(pressableLabel('Skip tonight')).toBeDefined();

    await invalidateConfig();

    expect(button('Try again')).toBeDefined();
    expectNoMutationControls();

    for (const route of [ProcedureScreen, RecoveryScreen, PhasedIntroScreen]) {
      await show(route);
      expect(button('Try again')).toBeDefined();
      expectNoMutationControls();
    }
  });

  it('stale captured Disruption mutations and procedure navigation do nothing', async () => {
    await mount();

    const skip = pressableLabel('Skip tonight').props.onPress as () => void;
    const pause = pressableLabel('Pause my routine').props.onPress as () => void;
    const travel = pressableLabel('Travel mode').props.onPress as () => void;
    const procedure = pressableLabel('I had a facial or peel').props.onPress as () => void;

    await invalidateConfig();
    await flush(() => {
      skip();
      pause();
      travel();
      procedure();
    });

    expect(mocks.skip).not.toHaveBeenCalled();
    expect(mocks.pause).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.back).not.toHaveBeenCalled();
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it('stale captured Recovery End Recovery does not mutate or navigate', async () => {
    Route = RecoveryScreen;
    mocks.configRead.mockResolvedValueOnce(recoveryConfig());
    await mount();

    const end = button('End recovery').props.onPress as () => void;
    await invalidateConfig();
    await flush(end);

    expect(mocks.finishRecovery).not.toHaveBeenCalled();
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it('stale captured Procedure Start Recovery does not mutate or navigate', async () => {
    Route = ProcedureScreen;
    await mount();

    const start = button('Start recovery').props.onPress as () => void;
    await invalidateConfig();
    await flush(start);

    expect(mocks.beginRecovery).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('stale captured Phased Intro staging override does not mutate or navigate', async () => {
    Route = PhasedIntroScreen;
    mocks.shelfRead.mockResolvedValueOnce(shelf(true, true));
    await mount();

    const add = pressableText('Add it now anyway').props.onPress as () => void;
    await invalidateConfig();
    await flush(add);

    expect(mocks.overrideStaging).not.toHaveBeenCalled();
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it('real useCycle retry stays withheld while pending and restores mutation UI when current', async () => {
    await mount();

    mocks.rampRead.mockRejectedValueOnce(new Error('RAMP_READ_FAILED'));
    await act(async () => {
      await client.refetchQueries({ queryKey: RAMP_KEY, exact: true });
    });
    await flush();
    expect(button('Try again')).toBeDefined();

    const ramp = deferred<RampPayload>();
    const config = deferred<CycleConfig>();
    mocks.rampRead.mockReturnValueOnce(ramp.promise);
    mocks.configRead.mockReturnValueOnce(config.promise);
    const configReadsBefore = mocks.configRead.mock.calls.length;

    await flush(() => {
      button('Try again').props.onPress();
    });
    expect(loadingNotice()).toHaveLength(1);
    expectNoMutationControls();
    expect(mocks.configRead.mock.calls.length).toBe(configReadsBefore);

    ramp.resolve(rampPayload());
    await flush();
    expect(loadingNotice()).toHaveLength(1);
    expect(mocks.configRead.mock.calls.length).toBe(configReadsBefore + 1);

    config.resolve(storedConfig());
    await flush();
    expect(pressableLabel('Skip tonight')).toBeDefined();
  });

  for (const [name, label, expectedReason] of [
    ['skip', 'Skip tonight', null],
    ['pause', 'Pause my routine', 'break'],
    ['travel', 'Travel mode', 'travel'],
  ] as const) {
    it(`current Disruption ${name} mutation persists and navigates`, async () => {
      await mount();

      await flush(() => {
        pressableLabel(label).props.onPress();
      });

      if (name === 'skip') expect(mocks.skip).toHaveBeenCalledOnce();
      else expect(mocks.pause).toHaveBeenCalledWith(expectedReason);
      expect(mocks.back).toHaveBeenCalledOnce();
      expect(mocks.haptic).toHaveBeenCalledOnce();
    });
  }

  it('current Disruption procedure navigation is allowed without mutation', async () => {
    await mount();

    await flush(() => {
      pressableLabel('I had a facial or peel').props.onPress();
    });

    expect(mocks.replace).toHaveBeenCalledWith('/cycle/procedure');
    expect(mocks.beginRecovery).not.toHaveBeenCalled();
    expect(mocks.haptic).toHaveBeenCalledOnce();
  });

  it('current Recovery can end recovery and navigate after the committed config', async () => {
    Route = RecoveryScreen;
    mocks.configRead.mockResolvedValueOnce(recoveryConfig());
    await mount();

    await flush(() => {
      button('End recovery').props.onPress();
    });

    expect(mocks.finishRecovery).toHaveBeenCalledOnce();
    expect(mocks.back).toHaveBeenCalledOnce();
  });

  it('current Procedure can start recovery and navigate after the committed config', async () => {
    Route = ProcedureScreen;
    await mount();

    await flush(() => {
      button('Start recovery').props.onPress();
    });

    expect(mocks.beginRecovery).toHaveBeenCalledWith(5, 'procedure');
    expect(mocks.replace).toHaveBeenCalledWith('/cycle/recovery');
  });

  it('current Phased Intro can persist staging overrides and navigate', async () => {
    Route = PhasedIntroScreen;
    mocks.shelfRead.mockResolvedValueOnce(shelf(true, true));
    await mount();

    await flush(() => {
      pressableText('Add it now anyway').props.onPress();
    });

    expect(mocks.overrideStaging).toHaveBeenCalledWith(['retinol']);
    expect(mocks.back).toHaveBeenCalledOnce();
  });

  it('does not navigate if source currentness is lost while a mutation is in flight', async () => {
    Route = ProcedureScreen;
    const pending = deferred<CycleConfig>();
    mocks.beginRecovery.mockReturnValueOnce(pending.promise);
    await mount();

    await flush(() => {
      button('Start recovery').props.onPress();
    });
    expect(mocks.beginRecovery).toHaveBeenCalledOnce();

    await act(async () => {
      await client.invalidateQueries({
        queryKey: RAMP_KEY,
        exact: true,
        refetchType: 'none',
      });
    });
    pending.resolve(
      storedConfig({
        recovery: {
          startISO: '2026-10-03',
          days: 5,
          reason: 'procedure',
        },
      }),
    );
    await flush();

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('preserves mutation failure and local retry behavior after source recovery', async () => {
    Route = ProcedureScreen;
    mocks.beginRecovery.mockRejectedValueOnce(new Error('WRITE_FAILED'));
    await mount();

    await flush(() => {
      button('Start recovery').props.onPress();
    });

    expect(mocks.beginRecovery).toHaveBeenCalledOnce();
    expect(button('Try again')).toBeDefined();
    expect(nodes((node) => (node.type as unknown) === 'CycleMutationError')).toHaveLength(1);
    expect(mocks.replace).not.toHaveBeenCalled();

    await flush(() => {
      button('Try again').props.onPress();
    });

    expect(mocks.beginRecovery).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledWith('/cycle/recovery');
  });

  it('accepts authoritative current cycle:null where the existing route semantics allow it', async () => {
    mocks.shelfRead.mockResolvedValueOnce(shelf(false));
    await mount();

    expect(pressableLabel('Skip tonight')).toBeDefined();

    await show(ProcedureScreen);
    expect(button('Start recovery')).toBeDefined();

    await show(RecoveryScreen);
    expect(renderedText()).toContain('No recovery in progress. Your cycle is running normally.');

    await show(PhasedIntroScreen);
    expect(renderedText()).toContain('ONE AT A TIME');
    expect(pressableText('Add it now anyway')).toBeDefined();
  });

  it('keeps all existing professional-review mutation gates in control', async () => {
    mocks.cadence = false;
    await mount();

    expect(renderedText()).toContain('Cycle controls are unavailable.');
    expect(mocks.shelfRead).not.toHaveBeenCalled();
    expect(mocks.configRead).not.toHaveBeenCalled();

    await show(ProcedureScreen);
    expect(renderedText()).toContain('Cycle recovery controls are unavailable.');
    expect(mocks.shelfRead).not.toHaveBeenCalled();

    await show(RecoveryScreen);
    expect(renderedText()).toContain('Cycle recovery guidance is unavailable.');
    expect(mocks.shelfRead).not.toHaveBeenCalled();

    mocks.cadence = true;
    mocks.explainability = false;
    await show(PhasedIntroScreen);
    expect(renderedText()).toContain('Cycle introduction guidance is unavailable.');
    expect(mocks.shelfRead).not.toHaveBeenCalled();

    expect(mocks.skip).not.toHaveBeenCalled();
    expect(mocks.pause).not.toHaveBeenCalled();
    expect(mocks.beginRecovery).not.toHaveBeenCalled();
    expect(mocks.finishRecovery).not.toHaveBeenCalled();
    expect(mocks.overrideStaging).not.toHaveBeenCalled();
  });
});
