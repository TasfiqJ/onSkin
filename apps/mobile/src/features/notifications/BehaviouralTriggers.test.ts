import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  anyBehaviouralTriggerEnabled,
  BehaviouralTriggers,
  createBehaviouralEvaluationCoordinator,
  notifyReplenishmentFromFreshShelf,
} from './BehaviouralTriggers';

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  hasReplenishmentSignal: vi.fn(),
  notifyBehavioural: vi.fn(),
  useCallback: vi.fn((callback: unknown) => callback),
  useEffect: vi.fn((effect: () => void | (() => void)) => {
    effect();
  }),
  useNotifPrefs: vi.fn(),
  useProgress: vi.fn(),
  useRamp: vi.fn(),
  useShelf: vi.fn(),
}));

vi.mock('react', () => ({
  useCallback: mocks.useCallback,
  useEffect: mocks.useEffect,
  useRef: vi.fn((value: unknown) => ({ current: value })),
}));
vi.mock('react-native', () => ({
  AppState: { addEventListener: mocks.addEventListener },
}));
vi.mock('./useNotifications', () => ({ useNotifPrefs: mocks.useNotifPrefs }));
vi.mock('./deliver', () => ({
  notifyBehavioural: mocks.notifyBehavioural,
}));
vi.mock('@/features/recommendations/replenishment', () => ({
  hasReplenishmentSignal: mocks.hasReplenishmentSignal,
}));
vi.mock('@/features/routine/useProgress', () => ({ useProgress: mocks.useProgress }));
vi.mock('@/features/routine/useRamp', () => ({ useRamp: mocks.useRamp }));
vi.mock('@/features/shelf/useShelf', () => ({ useShelf: mocks.useShelf }));

describe('behavioural trigger preference gate', () => {
  let boundaryActive = false;

  afterEach(() => {
    if (boundaryActive) {
      endAccountGenerationBoundary();
      boundaryActive = false;
    }
  });

  it('single-flights evaluations and applies a per-owner cooldown', async () => {
    let now = 1_000;
    const coordinator = createBehaviouralEvaluationCoordinator(60_000, () => now);
    const scope = createOwnerQueryScope();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operation = vi.fn(async () => gate);

    const first = coordinator.evaluate(scope, operation);
    const duplicate = coordinator.evaluate(scope, operation);
    expect(duplicate).toBe(first);
    release();
    await expect(first).resolves.toBe(true);
    expect(operation).toHaveBeenCalledTimes(1);

    await expect(coordinator.evaluate(scope, operation)).resolves.toBe(false);
    now += 60_000;
    await expect(coordinator.evaluate(scope, async () => undefined)).resolves.toBe(true);
  });

  it('does not carry the evaluation cooldown across account generations', async () => {
    const coordinator = createBehaviouralEvaluationCoordinator(60_000, () => 1_000);
    const firstScope = createOwnerQueryScope();
    const operation = vi.fn(async () => undefined);

    await coordinator.evaluate(firstScope, operation);
    beginAccountGenerationBoundary();
    boundaryActive = true;
    endAccountGenerationBoundary();
    boundaryActive = false;
    await coordinator.evaluate(createOwnerQueryScope(), operation);

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('requires a fresh successful Shelf read before scheduling replenishment', async () => {
    mocks.hasReplenishmentSignal.mockReset();
    mocks.hasReplenishmentSignal.mockReturnValue(true);
    mocks.notifyBehavioural.mockReset();
    const retainedData = { items: [], archive: [] };

    await expect(
      notifyReplenishmentFromFreshShelf(
        createOwnerQueryScope(),
        async () => ({ isSuccess: false, data: retainedData }),
        '12:00',
      ),
    ).resolves.toBe(false);
    expect(mocks.hasReplenishmentSignal).not.toHaveBeenCalled();
    expect(mocks.notifyBehavioural).not.toHaveBeenCalled();

    await expect(
      notifyReplenishmentFromFreshShelf(
        createOwnerQueryScope(),
        async () => ({ isSuccess: true, data: retainedData }),
        '12:00',
      ),
    ).resolves.toBe(true);
    expect(mocks.notifyBehavioural).toHaveBeenCalledWith('replenishment', '12:00');
  });

  it.each(['resolve', 'reject'] as const)(
    'detaches an owner-A Shelf refetch and contains its late %s without sending',
    async (lateOutcome) => {
      mocks.hasReplenishmentSignal.mockReset();
      mocks.hasReplenishmentSignal.mockReturnValue(true);
      mocks.notifyBehavioural.mockReset();
      const ownerA = createOwnerQueryScope();
      let resolveRead!: (result: {
        isSuccess: boolean;
        data: { items: never[]; archive: never[] };
      }) => void;
      let rejectRead!: (error: Error) => void;
      let markReadStarted!: () => void;
      const readStarted = new Promise<void>((resolve) => {
        markReadStarted = resolve;
      });
      const decision = notifyReplenishmentFromFreshShelf(
        ownerA,
        () => {
          markReadStarted();
          return new Promise((resolve, reject) => {
            resolveRead = resolve;
            rejectRead = reject;
          });
        },
        '12:00',
      );
      await readStarted;

      beginAccountGenerationBoundary();
      boundaryActive = true;

      await waitForAccountGenerationOperationsToSettle();
      await expect(decision).resolves.toBe(false);
      expect(mocks.hasReplenishmentSignal).not.toHaveBeenCalled();
      expect(mocks.notifyBehavioural).not.toHaveBeenCalled();

      if (lateOutcome === 'resolve') {
        resolveRead({ isSuccess: true, data: { items: [], archive: [] } });
      } else {
        rejectRead(new Error('late Shelf failure'));
      }
      await Promise.resolve();
      expect(mocks.hasReplenishmentSignal).not.toHaveBeenCalled();
      expect(mocks.notifyBehavioural).not.toHaveBeenCalled();
    },
  );

  it('treats only the preferences used by mounted background triggers as relevant', () => {
    expect(anyBehaviouralTriggerEnabled(undefined)).toBe(false);
    expect(
      anyBehaviouralTriggerEnabled({ promotional: false, ramp: false, replenishment: false }),
    ).toBe(false);
    expect(
      anyBehaviouralTriggerEnabled({ promotional: true, ramp: false, replenishment: false }),
    ).toBe(true);
    expect(
      anyBehaviouralTriggerEnabled({ promotional: false, ramp: true, replenishment: false }),
    ).toBe(true);
    expect(
      anyBehaviouralTriggerEnabled({ promotional: false, ramp: false, replenishment: true }),
    ).toBe(true);
  });

  it('mounts no Shelf, ramp, Progress, or AppState work while all relevant preferences are off', () => {
    mocks.useNotifPrefs.mockReturnValue({
      isError: false,
      isLoading: false,
      isSuccess: true,
      data: {
        status: 'available',
        format: 'current',
        prefs: {
          amEnabled: true,
          pmEnabled: true,
          captureReminders: true,
          promotionalOptIn: false,
          replenishmentAlerts: false,
          streakNudges: false,
        },
      },
    });

    expect(BehaviouralTriggers()).toBeNull();
    expect(mocks.useShelf).not.toHaveBeenCalled();
    expect(mocks.useRamp).not.toHaveBeenCalled();
    expect(mocks.useProgress).not.toHaveBeenCalled();
    expect(mocks.addEventListener).not.toHaveBeenCalled();
  });

  it.each([
    { isError: true, isLoading: false, isSuccess: false, data: undefined },
    {
      isError: false,
      isLoading: false,
      isSuccess: true,
      data: { status: 'absent', prefs: {} },
    },
    {
      isError: false,
      isLoading: false,
      isSuccess: true,
      data: { status: 'corrupt', prefs: null, reason: 'invalid_payload' },
    },
  ])('mounts no trigger work for non-authoritative prefs', (query) => {
    mocks.useNotifPrefs.mockReturnValue(query);

    expect(BehaviouralTriggers()).toBeNull();

    expect(mocks.useShelf).not.toHaveBeenCalled();
    expect(mocks.useRamp).not.toHaveBeenCalled();
    expect(mocks.useProgress).not.toHaveBeenCalled();
  });

  it('keeps expensive hooks behind the enabled boundary and sends only the highest-priority current-owner trigger', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./BehaviouralTriggers.tsx', import.meta.url)),
      'utf8',
    );
    const innerStart = source.indexOf('function EnabledBehaviouralTriggers');
    const outerStart = source.indexOf('export function BehaviouralTriggers()');
    const inner = source.slice(innerStart, outerStart);
    const outer = source.slice(outerStart);

    expect(innerStart).toBeGreaterThan(-1);
    expect(outerStart).toBeGreaterThan(innerStart);
    expect(source).toContain('function ReplenishmentTrigger');
    expect(source).toContain('function RampTrigger');
    expect(source).toContain('function PromotionalTrigger');
    expect(source).toContain('const shelf = useShelf()');
    expect(source).toContain('const ramp = useRamp()');
    expect(source).toContain('const progress = useProgress()');
    expect(inner).toContain(
      'notifyReplenishmentFromFreshShelf(',
    );
    expect(source).toContain('ramp.isSuccess && ramp.items.some');
    expect(source).toContain('progress.isSuccess && progress.data?.lapsed === true');
    expect(inner).toContain("AppState.addEventListener('change'");
    expect(inner).toContain('runOwnerQueryOperation(latest.ownerScope');
    expect(inner).toContain('const generation = latest.ownerScope.generation;');
    expect(inner).toContain('latest.replenishment?.generation === generation');
    expect(inner).toContain('latest.ramp?.generation === generation');
    expect(inner).toContain('latest.promotional?.generation === generation');
    expect(inner.match(/generation: ownerScope\.generation/g)).toHaveLength(3);
    expect(inner.match(/} else if \(/g)).toHaveLength(2);

    const replenishmentSend = inner.indexOf('await notifyReplenishmentFromFreshShelf(');
    const rampSend = inner.indexOf("await notifyBehavioural('rampup')");
    const promotionalSend = inner.indexOf("await notifyBehavioural('winback')");

    expect(replenishmentSend).toBeGreaterThan(-1);
    expect(rampSend).toBeGreaterThan(replenishmentSend);
    expect(promotionalSend).toBeGreaterThan(rampSend);
    expect(inner).toContain('lease.assertCurrent();');
    expect(outer).toContain('const query = useNotifPrefs()');
    expect(outer).toContain('<EnabledBehaviouralTriggers enabled={enabled} />');
    expect(outer).not.toContain('useShelf()');
    expect(outer).not.toContain('useRamp()');
    expect(outer).not.toContain('useProgress()');
    expect(outer).not.toContain('AppState.addEventListener');
  });
});
