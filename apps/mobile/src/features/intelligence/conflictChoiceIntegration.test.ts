import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('conflict choice integration contracts', () => {
  it('loads choices once at the Shelf boundary and separates detected from unresolved rows', () => {
    const source = readSource('features/shelf/useShelf.ts');

    expect(source).toContain('getConflictChoices()');
    expect(source).toContain(
      'const unresolvedConflicts = filterUnresolvedConflicts(conflicts, conflictChoices);',
    );
    expect(source).toContain('conflictChoices,');
    expect(source).toContain('unresolvedConflicts,');
    expect(source).toContain('unresolvedConflicts.find');
  });

  it('feeds only unresolved conflicts to recommendations and Ask', () => {
    const recommendations = readSource('features/recommendations/useRecommendations.ts');
    const ask = readSource('features/ask/useAsk.ts');

    expect(recommendations).toContain('conflicts: shelf.data.unresolvedConflicts');
    expect(ask).toContain('conflicts: shelf.data?.unresolvedConflicts ?? []');
    expect(recommendations).not.toContain('conflicts: shelf.data.conflicts');
    expect(ask).not.toContain('conflicts: shelf.data?.conflicts ?? []');
  });

  it('passes version-matched choices through Plan and the canonical scheduler', () => {
    const plan = readSource('features/routine/usePlan.ts');
    const cycle = readSource('features/scheduler/useCycle.ts');
    const scheduler = readSource('features/scheduler/orchestrate.ts');

    expect(plan).toContain('shelf.data?.conflictChoices');
    expect(cycle).toContain('conflictChoices: shelf.data.conflictChoices');
    expect(cycle).toContain('subflags: i.engineProduct.subflags');
    expect(scheduler).toContain('choiceForConflict(choices, conflict)');
    expect(scheduler).toContain("conflict.rule.interactionType === 'safety'");
    expect(scheduler).toContain('const cadencePolicy = shippableRoutineCadencePolicy();');
    expect(scheduler).toContain('const guidanceCopy = shippableRoutineGuidanceCopy();');
    expect(scheduler).toContain('if (!cadencePolicy || !guidanceCopy)');
  });

  it('keeps future admitted choices version-matched without hardcoded product-detail guidance', () => {
    const todayProjection = readSource('features/today/routineProjection.ts');
    const week = readSource('app/cycle/week.tsx');
    const whyTonight = readSource('app/cycle/why-tonight.tsx');
    const detail = readSource('app/shelf/[id].tsx');

    expect(todayProjection).toContain('hasUseTogetherChoiceBetween(');
    expect(week).toContain('hasUseTogetherChoiceBetween(');
    expect(whyTonight).toContain('Guided check-offs keep one potent active per night');
    expect(detail).toContain('choiceForConflict(data.conflictChoices, c)');
    expect(detail).toContain('{c.rule.copy.primaryActionLabel}');
    expect(detail).not.toContain('Guided check-offs stay on the reviewed one-active schedule.');
    expect(detail).not.toContain("resolved ? 'Change →' : 'Review →'");
  });

  it('keeps conflict choices local-only and emits no health-data server mirror', () => {
    const route = readSource('app/conflict/[ruleId].tsx');

    expect(route).toContain('local-only');
    expect(route).not.toContain('routine_conflicts');
    expect(route).not.toContain('.upsert(');
    expect(route).not.toContain('onConflict:');
  });

  it('mirrors shelf lifecycle rows under the same UUID used by conflict foreign keys', () => {
    const mutations = readSource('features/shelf/mutations.ts');

    expect(mutations).toContain('id: p.id,');
    expect(mutations).toContain('.upsert(');
    expect(mutations).toContain("{ onConflict: 'id' }");
    expect(mutations).toContain('status: p.status');
    expect(mutations).toContain('finished_at: p.finishedAt');
    expect(mutations).toContain('await mirrorUpsert(product, lease)');
    expect(mutations).toContain('await mirrorDelete(id, lease)');
    expect(mutations).toContain('runHealthDataWriteOperation(expectedOwnerUserId, operation)');
    expect(mutations).toContain('lease.assertCurrent()');
    expect(mutations).toContain('if (error) throw new Error');
  });
});
