import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { anyBehaviouralTriggerEnabled, BehaviouralTriggers } from './BehaviouralTriggers';

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  useNotifPrefs: vi.fn(),
  useProgress: vi.fn(),
  useRamp: vi.fn(),
  useShelf: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: { addEventListener: mocks.addEventListener },
}));
vi.mock('./useNotifications', () => ({ useNotifPrefs: mocks.useNotifPrefs }));
vi.mock('./deliver', () => ({ notifyBehavioural: vi.fn(), nowHHMM: vi.fn(() => '12:00') }));
vi.mock('@/features/recommendations/replenishment', () => ({
  hasReplenishmentSignal: vi.fn(() => false),
}));
vi.mock('@/features/routine/useProgress', () => ({ useProgress: mocks.useProgress }));
vi.mock('@/features/routine/useRamp', () => ({ useRamp: mocks.useRamp }));
vi.mock('@/features/shelf/useShelf', () => ({ useShelf: mocks.useShelf }));

describe('behavioural trigger preference gate', () => {
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
    expect(inner).toContain("AppState.addEventListener('change'");
    expect(outer).toContain('useNotifPrefs().data');
    expect(outer).toContain('<EnabledBehaviouralTriggers enabled={enabled} />');
    expect(outer).not.toContain('useShelf()');
    expect(outer).not.toContain('useRamp()');
    expect(outer).not.toContain('useProgress()');
    expect(outer).not.toContain('AppState.addEventListener');
  });
});
