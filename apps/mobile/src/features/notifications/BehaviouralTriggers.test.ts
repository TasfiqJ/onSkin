import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  anyBehaviouralTriggerEnabled,
  BehaviouralTriggers,
  notifyReplenishmentFromFreshShelf,
} from './BehaviouralTriggers';

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  hasReplenishmentSignal: vi.fn(),
  notifyBehavioural: vi.fn(),
  useNotifPrefs: vi.fn(),
  useProgress: vi.fn(),
  useRamp: vi.fn(),
  useShelf: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: { addEventListener: mocks.addEventListener },
}));
vi.mock('./useNotifications', () => ({ useNotifPrefs: mocks.useNotifPrefs }));
vi.mock('./deliver', () => ({
  notifyBehavioural: mocks.notifyBehavioural,
  nowHHMM: vi.fn(() => '12:00'),
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

  it('drops an owner-A replenishment decision when the account changes during the fresh read', async () => {
    mocks.hasReplenishmentSignal.mockReset();
    mocks.hasReplenishmentSignal.mockReturnValue(true);
    mocks.notifyBehavioural.mockReset();
    const ownerA = createOwnerQueryScope();
    let releaseRead!: (result: {
      isSuccess: boolean;
      data: { items: never[]; archive: never[] };
    }) => void;
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    const decision = notifyReplenishmentFromFreshShelf(
      ownerA,
      () => {
        markReadStarted();
        return new Promise((resolve) => {
          releaseRead = resolve;
        });
      },
      '12:00',
    );
    await readStarted;

    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseRead({ isSuccess: true, data: { items: [], archive: [] } });

    await expect(decision).resolves.toBe(false);
    expect(mocks.hasReplenishmentSignal).not.toHaveBeenCalled();
    expect(mocks.notifyBehavioural).not.toHaveBeenCalled();
  });

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
      data: {
        amEnabled: true,
        pmEnabled: true,
        captureReminders: true,
        promotionalOptIn: false,
        replenishmentAlerts: false,
        streakNudges: false,
      },
    });

    expect(BehaviouralTriggers()).toBeNull();
    expect(mocks.useShelf).not.toHaveBeenCalled();
    expect(mocks.useRamp).not.toHaveBeenCalled();
    expect(mocks.useProgress).not.toHaveBeenCalled();
    expect(mocks.addEventListener).not.toHaveBeenCalled();
  });

  it('keeps expensive hooks and the lifecycle subscription behind the enabled child boundary', () => {
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
    expect(inner).toContain('useShelf()');
    expect(inner).toContain('useRamp()');
    expect(inner).toContain('useProgress()');
    expect(inner).toContain(
      'notifyReplenishmentFromFreshShelf(latest.ownerScope, latest.refetchShelf, now)',
    );
    expect(inner).toContain('ramp.isSuccess && ramp.items.some');
    expect(inner).toContain('progress.isSuccess && progress.data?.lapsed === true');
    expect(inner).toContain("AppState.addEventListener('change'");
    expect(outer).toContain('useNotifPrefs().data');
    expect(outer).toContain('<EnabledBehaviouralTriggers enabled={enabled} />');
    expect(outer).not.toContain('useShelf()');
    expect(outer).not.toContain('useRamp()');
    expect(outer).not.toContain('useProgress()');
    expect(outer).not.toContain('AppState.addEventListener');
  });
});
