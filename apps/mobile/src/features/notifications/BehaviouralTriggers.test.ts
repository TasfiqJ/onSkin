import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  anyBehaviouralTriggerEnabled,
  BehaviouralTriggers,
  createBehaviouralEvaluationCoordinator,
  EnabledBehaviouralTriggers,
} from './BehaviouralTriggers';

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  notifyBehavioural: vi.fn(),
  readSnapshot: vi.fn(),
  useEffect: vi.fn((effect: () => void | (() => void)) => {
    effect();
  }),
  useNotifPrefs: vi.fn(),
  useOwnerQueryScope: vi.fn(),
}));

vi.mock('react', () => ({ useEffect: mocks.useEffect }));
vi.mock('react-native', () => ({
  AppState: { addEventListener: mocks.addEventListener },
}));
vi.mock('./useNotifications', () => ({ useNotifPrefs: mocks.useNotifPrefs }));
vi.mock('./deliver', () => ({ notifyBehavioural: mocks.notifyBehavioural }));
vi.mock('./behaviouralSnapshot', () => ({
  readBehaviouralTriggerSnapshot: mocks.readSnapshot,
}));
vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: mocks.useOwnerQueryScope,
}));

describe('behavioural trigger lifecycle gate', () => {
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
    expect(operation).toHaveBeenCalledOnce();

    await expect(coordinator.evaluate(scope, operation)).resolves.toBe(false);
    now += 60_000;
    await expect(coordinator.evaluate(scope, async () => undefined)).resolves.toBe(true);
  });

  it('treats only notification preferences with behavioural work as enabled', () => {
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

  it.each([
    { isError: true, isSuccess: false, data: undefined },
    { isError: false, isSuccess: true, data: { status: 'absent', prefs: {} } },
    {
      isError: false,
      isSuccess: true,
      data: { status: 'corrupt', prefs: null, reason: 'invalid_payload' },
    },
    {
      isError: false,
      isSuccess: true,
      data: {
        status: 'available',
        prefs: {
          promotionalOptIn: false,
          replenishmentAlerts: false,
          streakNudges: false,
        },
      },
    },
  ])('mounts no lifecycle or domain work for non-authoritative/disabled prefs', (query) => {
    mocks.addEventListener.mockReset();
    mocks.useNotifPrefs.mockReturnValue(query);

    expect(BehaviouralTriggers()).toBeNull();
    expect(mocks.addEventListener).not.toHaveBeenCalled();
  });

  it('reads once only on background and sends only the highest-priority signal', async () => {
    mocks.addEventListener.mockReset();
    mocks.notifyBehavioural.mockReset();
    mocks.readSnapshot.mockReset();
    const ownerScope = createOwnerQueryScope();
    mocks.useOwnerQueryScope.mockReturnValue(ownerScope);
    mocks.readSnapshot.mockResolvedValue({
      replenishment: true,
      ramp: true,
      promotional: true,
    });
    let listener!: (state: string) => void;
    mocks.addEventListener.mockImplementation((_event, nextListener) => {
      listener = nextListener;
      return { remove: vi.fn() };
    });

    EnabledBehaviouralTriggers({
      enabled: { promotional: true, ramp: true, replenishment: true },
    });
    expect(mocks.readSnapshot).not.toHaveBeenCalled();

    listener('active');
    expect(mocks.readSnapshot).not.toHaveBeenCalled();
    listener('background');
    await vi.waitFor(() => expect(mocks.notifyBehavioural).toHaveBeenCalledOnce());

    expect(mocks.readSnapshot).toHaveBeenCalledOnce();
    expect(mocks.notifyBehavioural).toHaveBeenCalledWith('replenishment');
  });

  it('contains no continuously mounted Shelf, Ramp, or Progress query hook', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./BehaviouralTriggers.tsx', import.meta.url)),
      'utf8',
    );

    expect(source).not.toContain('useShelf');
    expect(source).not.toContain('useRamp');
    expect(source).not.toContain('useProgress');
    expect(source).toContain("if (state !== 'background') return;");
    expect(source).toContain("await import('./behaviouralSnapshot')");
    expect(source).toContain('readBehaviouralTriggerSnapshot(lease, currentEnabled)');
    expect(source.match(/notifyBehavioural\('/g)).toHaveLength(3);
  });
});
