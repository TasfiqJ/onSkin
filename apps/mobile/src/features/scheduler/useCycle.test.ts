import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import { useCycle } from './useCycle';

const mocks = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  orchestrate: vi.fn(),
  cadenceReady: false,
  recoveryReady: false,
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mocks.config,
    isLoading: false,
    isError: false,
  }),
  useQueryClient: vi.fn(),
}));
vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: () => mocks.cadenceReady,
  canUseRoutineRecovery: () => mocks.recoveryReady,
}));
vi.mock('@/features/routine/sequencing', () => ({
  routinePhasedIntroductionDelayDays: () => (mocks.cadenceReady ? 7 : null),
}));
vi.mock('@/features/routine/useRamp', () => ({
  useRamp: () => ({
    items: [],
    isLoading: false,
    isError: false,
    sourceReady: true,
    isExample: false,
  }),
}));
vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: () => ({
    data: { items: [], conflictChoices: [] },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('@/features/today/useToday', () => ({
  localDateString: () => '2026-07-26',
}));
vi.mock('./cycleStore', () => ({
  assertRoutineCadenceMutationAdmission: vi.fn(),
  endRecovery: vi.fn(),
  loadCycleConfig: vi.fn(),
  overrideStagingProducts: vi.fn(),
  pauseCycle: vi.fn(),
  recoveryProgress: vi.fn(),
  resumeCycle: vi.fn(),
  saveCustomCycleDefinition: vi.fn(),
  skipTonight: vi.fn(),
  startCycleToday: vi.fn(),
  startRecovery: vi.fn(),
  updateCycleConfig: vi.fn(),
}));
vi.mock('./orchestrate', () => ({
  orchestrate: (...args: unknown[]) => mocks.orchestrate(...args),
}));
vi.mock('./profile', () => ({
  useProfileBits: () => ({
    data: {
      source: 'local',
      sensitivity: 'normal',
      pregnancy: false,
      pregnancySafety: null,
      pregnancyStatus: 'none',
      goals: [],
    },
    isLoading: false,
    isError: false,
  }),
}));

let renderer: ReactTestRenderer | null = null;

function CycleProbe({ publish }: { publish: (value: ReturnType<typeof useCycle>) => void }) {
  publish(useCycle());
  return null;
}

describe('useCycle closed-admission publication', () => {
  beforeEach(async () => {
    clearActiveHealthProcessingEpoch();
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: generation });
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.orchestrate.mockReset();
    mocks.cadenceReady = false;
    mocks.recoveryReady = false;
  });

  it('keeps admitted cadence visible while withholding stale event recovery', async () => {
    const storedRaw = JSON.stringify({
      schemaVersion: 1,
      variant: 'auto',
      anchorISO: '2026-07-01',
      pausedFrom: '2026-07-24',
      pauseReason: 'travel',
      recovery: { startISO: '2026-07-25', days: 7, reason: 'procedure' },
      skips: ['2026-07-26'],
      stagingOverrides: [],
      customCycle: null,
    });
    mocks.config = JSON.parse(storedRaw) as Record<string, unknown>;
    mocks.cadenceReady = true;
    mocks.recoveryReady = false;
    mocks.orchestrate.mockReturnValue({
      cycle: null,
      amDaily: [],
      cycleActives: [],
      notes: [],
      conflictChoices: [],
    });
    let result: ReturnType<typeof useCycle> | undefined;

    await act(async () => {
      renderer = create(
        createElement(CycleProbe, {
          publish: (value) => {
            result = value;
          },
        }),
      );
    });

    expect(JSON.stringify(mocks.config)).toBe(storedRaw);
    expect(mocks.orchestrate).toHaveBeenCalledOnce();
    expect(result?.data).toMatchObject({
      recovery: { active: false, day: 0, days: 0, reason: null },
      paused: true,
      skippedTonight: true,
      config: {
        recovery: null,
        pausedFrom: '2026-07-24',
        skips: ['2026-07-26'],
      },
    });
  });

  afterEach(async () => {
    if (renderer) await act(async () => renderer?.unmount());
    renderer = null;
    clearActiveHealthProcessingEpoch();
  });

  it('preserves stale stored recovery, pause, and skip bytes but publishes only neutral state', async () => {
    const storedRaw = JSON.stringify({
      schemaVersion: 1,
      variant: 'custom',
      anchorISO: '2026-07-01',
      pausedFrom: '2026-07-24',
      pauseReason: 'travel',
      recovery: { startISO: '2026-07-25', days: 7, reason: 'procedure' },
      skips: ['2026-07-26'],
      stagingOverrides: ['retinol'],
      customCycle: {
        schemaVersion: 1,
        lengthNights: 2,
        nights: [{ productId: 'retinol' }, { productId: null }],
      },
    });
    mocks.config = JSON.parse(storedRaw) as Record<string, unknown>;
    let result: ReturnType<typeof useCycle> | undefined;

    await act(async () => {
      renderer = create(
        createElement(CycleProbe, {
          publish: (value) => {
            result = value;
          },
        }),
      );
    });

    expect(JSON.stringify(mocks.config)).toBe(storedRaw);
    expect(mocks.orchestrate).not.toHaveBeenCalled();
    expect(result?.data).toMatchObject({
      cycle: null,
      recommendedCycle: null,
      tonight: null,
      weekAhead: [],
      nextAcidNight: null,
      recovery: { active: false, day: 0, days: 0, reason: null },
      paused: false,
      skippedTonight: false,
      stagedActiveIds: [],
      cycleActives: [],
      knownProductIds: [],
      notes: [],
      conflictChoices: [],
      config: {
        variant: 'auto',
        pausedFrom: null,
        pauseReason: null,
        recovery: null,
        skips: [],
        stagingOverrides: [],
        customCycle: null,
      },
    });
  });
});
