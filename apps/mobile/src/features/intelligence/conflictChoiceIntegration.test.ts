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

    expect(source).toContain('loadConflictChoices()');
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

    expect(plan).toContain('shelf.data.conflictChoices');
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

  it('gives the durable server projection one canonical owner-derived identity', () => {
    const migration = readFileSync(
      `${ROOT_DIR}/supabase/migrations/20260718000051_conflict_choice_outbox_rpc.sql`,
      'utf8',
    );
    const route = readSource('app/conflict/[ruleId].tsx');
    const choices = readSource('features/intelligence/overrides.ts');

    expect(migration).toContain('apply_conflict_choice_outbox_batch');
    expect(migration).toContain('conflict_choice_mirror_versions');
    expect(migration).toContain("v_status := 'retry'");
    expect(migration).toContain("v_error_class := 'dependency'");
    expect(migration).toContain("v_rule_interaction_type in ('safety', 'myth', 'synergy')");
    expect(migration).toContain('for key share');
    expect(migration).toContain('auth.uid()');
    expect(route).not.toContain('mirrorConflictChoiceForOwner');
    expect(choices).toContain(
      'updatePrivateItemsTransactionally(\n      [KEY, SHELF_STORAGE_KEY, OUTBOX_STORAGE_KEY]',
    );
    expect(choices).toContain('enqueueShelfOutboxOperation(outbox, {');
    expect(choices).toContain('enqueueConflictChoiceOutboxOperation(outbox, {');
  });

  it('queues shelf lifecycle rows under the same UUID used by conflict foreign keys', () => {
    const mutations = readSource('features/shelf/mutations.ts');
    const store = readSource('features/shelf/store.ts');

    expect(store).toContain('entityId: product.id');
    expect(store).toContain("operationKind: 'upsert'");
    expect(store).toContain('status: product.status');
    expect(store).toContain('finished_at: product.finishedAt');
    expect(store).toContain('enqueueShelfOutboxOperation(outbox, {');
    expect(store).toContain('updatePrivateItemsTransactionally([KEY, OUTBOX_STORAGE_KEY]');
    expect(mutations).toContain('scheduleOutboxFlush()');
    expect(mutations).not.toContain('mirrorShelfUpsertForOwner');
    expect(mutations).not.toContain('mirrorShelfDeleteForOwner');
  });
});
