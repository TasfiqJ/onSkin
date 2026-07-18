import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MOBILE_SRC = fileURLToPath(new URL('../../', import.meta.url));

function read(path: string): string {
  return readFileSync(`${MOBILE_SRC}/${path}`, 'utf8');
}

describe('ramp availability contract', () => {
  it('never publishes a higher-cap cycle from missing authoritative ramp input', () => {
    const useRamp = read('features/routine/useRamp.ts');
    const useCycle = read('features/scheduler/useCycle.ts');
    const guardIndex = useCycle.indexOf('!ramp.isSuccess');
    const orchestrateIndex = useCycle.indexOf('} = orchestrate(actives');

    expect(useRamp).toContain('const planRamps = planData?.isExample ? []');
    expect(useRamp).toContain('const hasRampInputs = planQuery.isSuccess && planRamps.length > 0;');
    expect(useRamp).toContain('enabled: hasRampInputs');
    expect(useRamp).toContain('retry: false');
    expect(useRamp).toContain("query.state.status !== 'error'");
    expect(useRamp).toContain('items: q.isSuccess ? (q.data ?? []) : []');
    expect(useRamp).toContain('isSuccess: planQuery.isSuccess && (!hasRampInputs || q.isSuccess)');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(orchestrateIndex).toBeGreaterThan(guardIndex);
    expect(useCycle).toContain('!shelf.isSuccess');
    expect(useCycle).toContain('!cfg.isSuccess');
    expect(useCycle).toContain('!profile.isSuccess');
    expect(useCycle).toContain('return undefined;');
    expect(useCycle).toContain('data !== undefined');
  });

  it('gates cycle routes and gives every core consumer an explicit recovery state', () => {
    const layout = read('app/cycle/_layout.tsx');
    const gate = read('features/scheduler/CycleDataAvailabilityGate.tsx');
    const notice = read('features/scheduler/ActiveScheduleUnavailableNotice.tsx');
    const stateNotice = read('components/ui/StateNotice.tsx');
    const today = read('app/(tabs)/today.tsx');
    const plan = read('app/routine/plan.tsx');
    const ramp = read('app/routine/ramp.tsx');
    const streak = read('app/routine/streak.tsx');
    const detail = read('app/shelf/[id].tsx');
    const triggers = read('features/notifications/BehaviouralTriggers.tsx');
    const triggerSnapshot = read('features/notifications/behaviouralSnapshot.ts');

    expect(layout).toContain('<CycleDataAvailabilityGate>');
    expect(gate).toContain('if (!query.isLoading && !query.isError) return children;');
    expect(gate).toContain('<ActiveScheduleUnavailableNotice');
    expect(notice).toContain('Active schedule unavailable');
    expect(notice).toContain("Your saved cadence wasn't reset");
    expect(notice).toContain('kind="unavailable"');
    expect(stateNotice).toContain("alert ? 'alert' : undefined");
    expect(notice).toContain('Retry loading active schedule');

    expect(today).toContain('plan?.cycle != null && canUseRoutineCadence() && cycleQuery.isError');
    expect(today).toContain('<ActiveScheduleUnavailableNotice');
    expect(plan).toContain('scheduleUnavailable ? (');
    expect(plan).toContain('disabled={starting || scheduleUnavailable || !planQuery.isSuccess}');
    expect(plan).toContain("? 'Schedule unavailable'");
    expect(ramp).toContain('!item && !isLoading && !isError');
    expect(ramp).toContain('Ramp progress unavailable');
    expect(ramp).toContain('await acceptStepUp(item.productId);');
    expect(ramp.indexOf("track('ramp_step_up_accepted'")).toBeGreaterThan(
      ramp.indexOf('await acceptStepUp(item.productId);'),
    );
    expect(streak).toContain('cycleQuery.isSuccess');
    expect(streak).toContain('Number.POSITIVE_INFINITY');
    expect(detail).toContain('Active-night timing is unavailable right now.');
    expect(triggers).toContain("await import('./behaviouralSnapshot')");
    expect(triggerSnapshot).toContain('enabled.ramp && input.ramps');
    expect(triggerSnapshot).toContain('activeProductIds.has(productId)');
    expect(triggerSnapshot).toContain('shouldOfferStepUp({ ...state, today })');
  });

  it('keeps the typed read non-destructive and step-up retries desired-state idempotent', () => {
    const store = read('features/routine/rampStore.ts');
    const acceptIndex = store.indexOf('export async function stepUpRamp');
    const nextMutationIndex = store.indexOf('export async function applyToleranceToRamps');
    const stepUp = store.slice(acceptIndex, nextMutationIndex);

    expect(store).toContain('export type RampStateRead =');
    expect(store).toContain('export async function readStoredRamps()');
    expect(store).toContain('await readPrivateItem(KEY)');
    expect(store).toContain("status: 'unsupported_version', ramps: null");
    expect(store).toContain('throw new Error(RAMP_STATE_UNAVAILABLE)');
    expect(store).toContain('EXPO_PUBLIC_E2E_RAMP_STORAGE_FAILURE');

    expect(stepUp).toContain('desiredFreqPerWeek');
    expect(stepUp).toContain("ramp.toleranceState === 'paused_irritation'");
    expect(stepUp).toContain('if (ramp.freqPerWeek >= desiredFreqPerWeek) return current;');
    expect(stepUp).toContain('throw new Error(RAMP_STATE_STALE)');
    expect(stepUp).toContain('await updatePrivateItem(KEY');
    expect(stepUp).not.toContain('removePrivateItem');
  });
});
