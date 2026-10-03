import * as React from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CycleSettingsScreen from '@/app/cycle/settings';
import WeekScreen from '@/app/cycle/week';
import WhyTonightScreen from '@/app/cycle/why-tonight';
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

const RAMP_KEY = ['c07a-cycle-route-readiness-ramp'] as const;

const mocks = vi.hoisted(() => ({
  shelfRead: vi.fn(),
  profileRead: vi.fn(),
  rampRead: vi.fn(),
  configRead: vi.fn(),
  setVariant: vi.fn(),
  saveCustom: vi.fn(),
  start: vi.fn(),
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
  Modal: 'Modal',
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));

vi.mock('expo-router', () => ({
  router: { push: mocks.push, replace: mocks.replace },
  useLocalSearchParams: () => ({}),
}));

vi.mock('expo-router/react-navigation', () => ({
  usePreventRemove: vi.fn(),
}));

vi.mock('@/components/ui', () => ({
  Button: 'Button',
  RouteIconButton: 'RouteIconButton',
  Screen: 'Screen',
  Sheet: 'Sheet',
  StateNotice: 'StateNotice',
  Text: 'Text',
}));

vi.mock('@/features/subscription/ProGate', () => ({
  withProGate: (_feature: string, Component: React.ComponentType) => Component,
}));

vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: () => mocks.cadence,
  canUseRoutineRecovery: () => mocks.recovery,
  canUseRoutineExplainabilityCopy: () => mocks.explainability,
}));

vi.mock('@/features/routine/sequencing', () => ({
  routinePhasedIntroductionDelayDays: () => (mocks.cadence ? 7 : null),
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
  endRecovery: vi.fn(),
  overrideStagingProducts: vi.fn(),
  pauseCycle: vi.fn(),
  resumeCycle: vi.fn(),
  saveCustomCycleDefinition: () => mocks.saveCustom(),
  skipTonight: vi.fn(),
  startCycleToday: () => mocks.start(),
  startRecovery: vi.fn(),
  updateCycleConfig: () => mocks.setVariant(),
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

vi.mock('@/features/scheduler/classes', () => ({
  classLabel: () => 'Retinoid',
}));

vi.mock('@/features/scheduler/CycleMutationError', () => ({
  CycleMutationError: 'CycleMutationError',
}));

vi.mock('@/lib/accessibility/useReduceMotionPreference', () => ({
  motionAwareModalAnimation: () => 'none',
  useReduceMotionPreference: () => true,
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
vi.mock('@/theme/tokens', () => ({
  colors: {
    clayBright: '#000',
    clayDeep: '#000',
    cream: '#000',
    hairline: '#000',
    ink: '#000',
    muted: '#000',
    nightSurface: '#000',
    paper: '#000',
  },
}));
vi.mock('@/theme/systemBarPolicy', () => ({
  statusBarStyleForSurface: () => 'light',
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

function rampPayload(): RampPayload {
  return {
    items: [{ productId: 'retinol', state: { freqPerWeek: 1 } }],
  };
}

function shelf(withActive = true) {
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
            product: { createdAt: '2026-01-01' },
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
        staged: false,
        maxFrequencyPerWeek: 4,
      },
    ],
    notes: [],
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
let Route: React.ComponentType = WeekScreen;

function element() {
  return React.createElement(QueryClientProvider, { client }, React.createElement(Route));
}

async function flush(operation: () => void = () => undefined) {
  await act(async () => {
    operation();
  });
  for (let i = 0; i < 6; i += 1) {
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

async function show(route: React.ComponentType) {
  Route = route;
  await flush(() => {
    renderer?.update(element());
  });
}

function expectWeekCurrent() {
  expect(renderedText()).toContain('Current retinol');
  expect(renderedText()).toContain('classic, 2 nights');
}

function expectSettingsCurrent() {
  expect(button('Save cycle')).toBeDefined();
  expect(renderedText()).toContain('Classic');
}

function expectWhyCurrent() {
  expect(renderedText()).toContain('Tonight is retinoid night.');
  expect(renderedText()).toContain('WHY THIS, TONIGHT?');
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
  Route = WeekScreen;

  for (const mock of [
    mocks.shelfRead,
    mocks.profileRead,
    mocks.rampRead,
    mocks.configRead,
    mocks.setVariant,
    mocks.saveCustom,
    mocks.start,
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
  mocks.setVariant.mockResolvedValue(storedConfig());
  mocks.saveCustom.mockResolvedValue(storedConfig());
  mocks.start.mockResolvedValue(storedConfig());

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

describe('C-07A read-only cycle route readiness', () => {
  it('withholds all owned routes during initial loading', async () => {
    const pending = deferred<ReturnType<typeof shelf>>();
    mocks.shelfRead.mockReturnValueOnce(pending.promise);

    await mount();
    expect(loadingNotice()).toHaveLength(1);
    expect(renderedText()).not.toContain('simple daily');
    expect(renderedText()).not.toContain('No actives to cycle yet.');

    await show(CycleSettingsScreen);
    expect(loadingNotice()).toHaveLength(1);
    expect(
      nodes((node) => (node.type as unknown) === 'Button' && node.props.label === 'Save cycle'),
    ).toHaveLength(0);

    await show(WhyTonightScreen);
    expect(loadingNotice()).toHaveLength(1);
    expect(renderedText()).not.toContain('No cycle is running yet');

    pending.resolve(shelf());
    await flush();
    expectWhyCurrent();
  });

  it('rejects retained data after an error on Week, Settings, and Why Tonight', async () => {
    await mount();
    expectWeekCurrent();

    const retained = client.getQueryData(configKey());
    mocks.configRead.mockRejectedValueOnce(new Error('CONFIG_READ_FAILED'));
    await act(async () => {
      await client.refetchQueries({ queryKey: configKey(), exact: true });
    });
    await flush();

    expect(client.getQueryData(configKey())).toBe(retained);
    expect(button('Try again')).toBeDefined();
    expect(renderedText()).not.toContain('Current retinol');
    expect(renderedText()).not.toContain('No actives to cycle yet.');

    await show(CycleSettingsScreen);
    expect(button('Try again')).toBeDefined();
    expect(
      nodes((node) => (node.type as unknown) === 'Button' && node.props.label === 'Save cycle'),
    ).toHaveLength(0);

    await show(WhyTonightScreen);
    expect(button('Try again')).toBeDefined();
    expect(renderedText()).not.toContain('No cycle is running yet');
    expect(renderedText()).not.toContain('Tonight is retinoid night.');
  });

  it('withholds retained data while a refresh is in flight', async () => {
    await mount();
    const pending = deferred<CycleConfig>();
    mocks.configRead.mockReturnValueOnce(pending.promise);

    await act(async () => {
      void client.refetchQueries({ queryKey: configKey(), exact: true });
      await Promise.resolve();
    });
    await flush();

    expect(loadingNotice()).toHaveLength(1);
    expect(renderedText()).not.toContain('Current retinol');

    await show(CycleSettingsScreen);
    expect(loadingNotice()).toHaveLength(1);
    expect(
      nodes((node) => (node.type as unknown) === 'Button' && node.props.label === 'Save cycle'),
    ).toHaveLength(0);

    await show(WhyTonightScreen);
    expect(loadingNotice()).toHaveLength(1);
    expect(renderedText()).not.toContain('No cycle is running yet');

    pending.resolve(storedConfig());
    await flush();
    expectWhyCurrent();
  });

  it('fails closed on currentness loss and captured Week actions cannot publish stale navigation', async () => {
    await mount();
    expectWeekCurrent();

    const settingsAction = nodes(
      (node) =>
        (node.type as unknown) === 'Pressable' &&
        node.props.accessibilityLabel === 'Cycle settings',
    )[0]?.props.onPress as (() => void) | undefined;
    const projectedAction = nodes(
      (node) =>
        (node.type as unknown) === 'Pressable' &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.includes('cycle night 1 of 2'),
    )[0]?.props.onPress as (() => void) | undefined;

    expect(settingsAction).toBeDefined();
    expect(projectedAction).toBeDefined();

    await act(async () => {
      await client.invalidateQueries({
        queryKey: configKey(),
        exact: true,
        refetchType: 'none',
      });
    });

    expect(button('Try again')).toBeDefined();
    expect(renderedText()).not.toContain('Current retinol');

    await flush(() => {
      settingsAction?.();
      projectedAction?.();
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it('keeps retry pending fail-closed and restores only after real useCycle retry is current', async () => {
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
    expect(renderedText()).not.toContain('Current retinol');
    expect(mocks.configRead.mock.calls.length).toBe(configReadsBefore);

    ramp.resolve(rampPayload());
    await flush();
    expect(loadingNotice()).toHaveLength(1);
    expect(renderedText()).not.toContain('Current retinol');
    expect(mocks.configRead.mock.calls.length).toBe(configReadsBefore + 1);

    config.resolve(storedConfig());
    await flush();
    expectWeekCurrent();
  });

  it('treats authoritative current cycle:null as a legitimate no-cycle state', async () => {
    mocks.shelfRead.mockResolvedValueOnce(shelf(false));
    await mount();

    expect(renderedText()).toContain('simple daily');
    expect(renderedText()).toContain('No actives to cycle yet.');
    expect(
      nodes((node) => (node.type as unknown) === 'Button' && node.props.label === 'Try again'),
    ).toHaveLength(0);

    await show(WhyTonightScreen);
    expect(renderedText()).toContain('No cycle is running yet. Add an active to get started.');
    expect(
      nodes((node) => (node.type as unknown) === 'Button' && node.props.label === 'Try again'),
    ).toHaveLength(0);

    await show(CycleSettingsScreen);
    expectSettingsCurrent();
    expect(renderedText()).toContain('Add a reviewed night active to build a cycle.');
  });

  it('renders the normal current cycle on all owned routes', async () => {
    await mount();
    expectWeekCurrent();

    await show(CycleSettingsScreen);
    expectSettingsCurrent();

    await show(WhyTonightScreen);
    expectWhyCurrent();
    expect(mocks.track).toHaveBeenCalledWith('why_tonight_viewed');
  });

  it('leaves cadence and explainability professional-review gates authoritative', async () => {
    mocks.cadence = false;
    await mount();

    expect(renderedText()).toContain('Your cycle · review gate');
    expect(mocks.shelfRead).not.toHaveBeenCalled();
    expect(mocks.configRead).not.toHaveBeenCalled();

    await show(CycleSettingsScreen);
    expect(renderedText()).toContain('Cycle settings open after review.');
    expect(mocks.shelfRead).not.toHaveBeenCalled();

    mocks.cadence = true;
    mocks.explainability = false;
    await show(WhyTonightScreen);
    expect(renderedText()).toContain(
      'Cycle guidance is unavailable until its exact rules and copy complete required professional review.',
    );
    expect(mocks.shelfRead).not.toHaveBeenCalled();
  });
});
