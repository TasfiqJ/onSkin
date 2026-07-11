import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const ROOT_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));

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
    expect(scheduler).toContain('if (!canUseRoutineCadence())');
  });

  it('suppresses repeat separation copy for use-together while keeping the guided schedule firm', () => {
    const today = readSource('app/(tabs)/today.tsx');
    const week = readSource('app/cycle/week.tsx');
    const whyTonight = readSource('app/cycle/why-tonight.tsx');
    const detail = readSource('app/shelf/[id].tsx');

    expect(today).toContain('hasUseTogetherChoiceBetween(');
    expect(week).toContain('hasUseTogetherChoiceBetween(');
    expect(whyTonight).toContain('Guided check-offs keep one potent active per night');
    expect(detail).toContain('Guided check-offs stay on the reviewed one-active schedule.');
    expect(detail).toContain("resolved ? 'Change →' : 'Review →'");
  });

  it('gives the server mirror one canonical idempotent identity', () => {
    const migration = readFileSync(
      `${ROOT_DIR}/supabase/migrations/20260710000037_routine_conflict_choice_identity.sql`,
      'utf8',
    );
    const route = readSource('app/conflict/[ruleId].tsx');

    expect(migration).toContain('routine_conflicts_choice_pair_canonical');
    expect(migration).toContain("status in ('accepted', 'overridden')");
    expect(migration).toContain("'accept_suggested_timing'");
    expect(migration).toContain('first_value(id) over');
    expect(migration).toContain('from pg_constraint');
    expect(migration).toContain('product_a_id::text < product_b_id::text');
    expect(migration).toContain('create unique index if not exists');
    expect(migration).toContain('(user_id, rule_id, product_a_id, product_b_id)');
    expect(route).toContain("onConflict: 'user_id,rule_id,product_a_id,product_b_id'");
  });

  it('mirrors shelf lifecycle rows under the same UUID used by conflict foreign keys', () => {
    const mutations = readSource('features/shelf/mutations.ts');

    expect(mutations).toContain('id: p.id,');
    expect(mutations).toContain('.upsert(');
    expect(mutations).toContain("{ onConflict: 'id' }");
    expect(mutations).toContain('status: p.status');
    expect(mutations).toContain('finished_at: p.finishedAt');
    expect(mutations).toContain('void mirrorUpsert(product)');
    expect(mutations).toContain('void mirrorDelete(id)');
    expect(mutations).toContain('if (error) throw new Error');
  });
});
