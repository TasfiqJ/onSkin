import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('routine cadence direct-entry admission', () => {
  it('keeps the ramp data hook and draft guidance behind the production cadence gate', () => {
    const source = readAppRoute('routine/ramp.tsx');
    const contentStart = source.indexOf('function RampContent(');
    const gateStart = source.indexOf('function RampReviewGate()');
    const wrapper = source.slice(0, contentStart);
    const closedSurface = source.slice(gateStart);

    expect(source).toContain('canUseRoutineCadence,');
    expect(source).toContain('canUseRoutineRecovery');
    expect(source).toContain("from '@/features/routine/reviewGate';");
    expect(contentStart).toBeGreaterThan(-1);
    expect(gateStart).toBeGreaterThan(contentStart);
    expect(wrapper).toContain('const cadenceReady = canUseRoutineCadence();');
    expect(wrapper).toContain('const recoveryReady = canUseRoutineRecovery();');
    expect(wrapper).toContain('!cadenceReady || !recoveryReady || !guidanceCopy');
    expect(wrapper).not.toContain('useRamp();');
    expect(source.indexOf('const { items, isLoading, acceptStepUp } = useRamp();')).toBeGreaterThan(
      contentStart,
    );

    expect(closedSurface).toContain('RAMP GUIDANCE UNAVAILABLE');
    expect(closedSurface).toContain('Ramp settings open after review.');
    expect(closedSurface).toContain(
      'Your existing daily routine is still available and unchanged.',
    );
    expect(closedSurface).toMatch(/all required independent\s+professional review/);
    expect(closedSurface).not.toContain('clinical and cosmetic-chemistry review');
    expect(closedSurface).not.toContain('Nights per week');
    expect(closedSurface).not.toContain('Add a night');

    const handlerGuard = source.indexOf(
      'if (!canUseRoutineCadence() || !canUseRoutineRecovery()) return;',
      contentStart,
    );
    const mutation = source.indexOf('await acceptStepUp(item.productId);', contentStart);
    const successAnalytics = source.indexOf("track('ramp_step_up_accepted'", contentStart);
    expect(handlerGuard).toBeGreaterThan(contentStart);
    expect(mutation).toBeGreaterThan(handlerGuard);
    expect(successAnalytics).toBeGreaterThan(mutation);
  });

  it('keeps tolerance choices and every mutation hook behind the production cadence gate', () => {
    const source = readAppRoute('routine/tolerance.tsx');
    const contentStart = source.indexOf('function ToleranceCheckIn(');
    const gateStart = source.indexOf('function ToleranceReviewGate()');
    const wrapper = source.slice(0, contentStart);
    const closedSurface = source.slice(gateStart);

    expect(source).toContain('canUseRoutineCadence,');
    expect(source).toContain('canUseRoutineRecovery');
    expect(source).toContain("from '@/features/routine/reviewGate';");
    expect(contentStart).toBeGreaterThan(-1);
    expect(gateStart).toBeGreaterThan(contentStart);
    expect(wrapper).toContain('const cadenceReady = canUseRoutineCadence();');
    expect(wrapper).toContain('const recoveryReady = canUseRoutineRecovery();');
    expect(wrapper).toContain('!cadenceReady || !recoveryReady || !cadencePolicy');
    expect(wrapper).not.toContain('useCycleMutations();');
    expect(wrapper).not.toContain('useQueryClient();');
    expect(source.indexOf('const m = useCycleMutations();')).toBeGreaterThan(contentStart);
    expect(source.indexOf('const qc = useQueryClient();')).toBeGreaterThan(contentStart);

    expect(closedSurface).toContain('CHECK-IN UNAVAILABLE');
    expect(closedSurface).toContain('Weekly check-ins open after review.');
    expect(closedSurface).toContain(
      'Your existing daily routine is still available and unchanged.',
    );
    expect(closedSurface).toMatch(/all\s+required\s+independent\s+professional\s+review/);
    expect(closedSurface).not.toContain('clinical and cosmetic-chemistry review');
    expect(closedSurface).not.toContain('Comfortable');
    expect(closedSurface).not.toContain('Irritated');
    expect(closedSurface).not.toContain('Save');

    const handlerGuard = source.indexOf('!canUseRoutineRecovery()', contentStart);
    const recoveryMutation = source.indexOf(
      "await m.beginRecovery(irritationRecoveryDays, 'irritation');",
      contentStart,
    );
    const rampMutation = source.indexOf('await applyToleranceToRamps(selected);', contentStart);
    expect(handlerGuard).toBeGreaterThan(contentStart);
    expect(recoveryMutation).toBeGreaterThan(handlerGuard);
    expect(rampMutation).toBeGreaterThan(recoveryMutation);
  });

  it('hands off from Plan without invoking a closed or absent cycle mutation', () => {
    const source = readAppRoute('routine/plan.tsx');
    const handlerStart = source.indexOf('async function startToday()');
    const admission = source.indexOf(
      'if (canUseRoutineCadence() && canUseRoutineRecovery() && cycleData?.cycle)',
      handlerStart,
    );
    const mutation = source.indexOf('await cycleMutations.start();', handlerStart);
    const handoff = source.indexOf("router.replace('/today');", handlerStart);

    expect(source).toContain('canUseRoutineCadence');
    expect(source).toContain('canUseRoutineRecovery');
    expect(source).toContain('canUseRoutineSequencing');
    expect(handlerStart).toBeGreaterThan(-1);
    expect(admission).toBeGreaterThan(handlerStart);
    expect(mutation).toBeGreaterThan(admission);
    expect(handoff).toBeGreaterThan(mutation);
    expect(source).toContain('canUseRoutineSequencing() && plan');
  });

  it('does not fabricate a cycle length for streak copy or analytics', () => {
    const source = readAppRoute('routine/streak.tsx');

    expect(source).toContain('const cycleLength = cycleData?.cycle?.lengthNights ?? null;');
    expect(source).not.toContain('cycleData?.cycle?.lengthNights ?? 4');
    expect(source).toContain('const milestone = currentMilestone(data?.streak ?? 0, cycleLength);');
  });

  it('uses the complete professional-review requirement on every closed summary', () => {
    for (const path of [
      'cycle/week.tsx',
      'cycle/settings.tsx',
      'routine/ramp.tsx',
      'routine/tolerance.tsx',
    ]) {
      const source = readAppRoute(path);
      expect(source, path).toMatch(/all\s+required\s+independent\s+professional\s+review/);
      expect(source, path).not.toContain('clinical and cosmetic-chemistry review');
      expect(source, path).not.toContain('dermatologist and cosmetic-chemist review');
    }
  });
});
