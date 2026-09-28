import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  GOVERNED_DOWNSTREAM_GENERATED_PATHS,
  GOVERNED_POST_E_PUBLICATION_DAG_EDGES,
} from './governed-evidence-chain.mjs';
import {
  GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID,
  GOVERNED_GENERATION_COMMAND_BY_UNIT_ID,
  GOVERNED_NON_REPLAY_CHECK_EXCLUSIONS_BY_UNIT_ID,
  GOVERNED_POST_F_COMMANDS,
  GOVERNED_PUBLICATION_COVERAGE_MATRIX,
  GOVERNED_PUBLICATION_COVERAGE_SUMMARY,
} from './governed-publication-coverage.mjs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

function referencedNpmScripts(scriptName) {
  return String(packageJson.scripts?.[scriptName] ?? '')
    .split(' && ')
    .map((command) => /^npm run (\S+)$/.exec(command)?.[1] ?? null)
    .filter(Boolean);
}

test('exports exact structural and deterministic coverage for all 35 units', () => {
  assert.deepEqual(GOVERNED_PUBLICATION_COVERAGE_SUMMARY, {
    units: 35,
    jsonMarkdownPairs: 32,
    jsonSingletons: 3,
    sourceSnapshotUnits: 12,
    postEvidenceUnits: 22,
    finalReadinessUnits: 1,
    deterministicReplayUnits: 16,
    structuralOnlyUnits: 19,
    postEvidenceDeterministicReplayUnits: 8,
    postEvidenceStructuralOnlyUnits: 14,
    nonReplayCheckExcludedUnits: 1,
    noReviewedNonWritingCheckUnits: 18,
  });
  const paths = GOVERNED_PUBLICATION_COVERAGE_MATRIX.flatMap(({ paths: unitPaths }) => unitPaths);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(paths, GOVERNED_DOWNSTREAM_GENERATED_PATHS);
  const lifecycleContracts = {
    source_snapshot: 'sha_bound_at_s_immutable_through_f',
    post_e: 'exactly_one_dag_ordered_commit_after_e',
    final_readiness: 'unique_final_f_commit',
  };
  for (const row of GOVERNED_PUBLICATION_COVERAGE_MATRIX) {
    assert.equal(row.structuralPublication, lifecycleContracts[row.publicationClass], row.id);
    assert.equal(row.provesInitialSemanticAuthenticity, false, row.id);
  }
});

test('every unit maps to a real strict release writer when one exists', () => {
  const reviewedBaseWriterAliases = new Set([
    'e2e:human:manifest',
    'phase3:review-packet',
    'phase4:qa-report',
    'phase4:qa-report-cosing',
    'phase4:import-cosing-fixture',
    'phase4:import-obf-fixture',
    'phase9:ios-privacy-source-audit',
  ]);

  for (const row of GOVERNED_PUBLICATION_COVERAGE_MATRIX) {
    assert.equal(typeof packageJson.scripts[row.generationCommand], 'string', row.id);
    assert.equal(
      row.generationCommand.endsWith(':strict') ||
        reviewedBaseWriterAliases.has(row.generationCommand),
      true,
      row.id,
    );
  }
  assert.equal(
    GOVERNED_GENERATION_COMMAND_BY_UNIT_ID['docs/phase-9/generated/store-build-inspection'],
    'phase9:store-build-inspect:write:strict',
  );
  assert.equal(
    packageJson.scripts['phase9:store-build-inspect:write:strict'],
    'node scripts/phase9/store-build-inspect.mjs --strict',
  );
  assert.equal(
    packageJson.scripts['phase9:store-build-inspect:strict'],
    'node scripts/phase9/store-build-inspect.mjs --check --strict',
  );
});

test('deterministic replay inventory is exact and every command is real', () => {
  assert.deepEqual(Object.keys(GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID).sort(), [
    'docs/e2e/generated/human-e2e-manifest',
    'docs/generated/device-support-policy-audit',
    'docs/generated/generated-packet-status-audit',
    'docs/generated/performance-readiness-audit',
    'docs/generated/readiness-status-audit',
    'docs/generated/source-packet-audit',
    'docs/generated/tas-todo-audit',
    'docs/phase-10/generated/support-handoff-packet',
    'docs/phase-3/generated/review-operator-queue',
    'docs/phase-3/generated/review-worklist',
    'docs/phase-4/generated/beta-coverage-report',
    'docs/phase-4/generated/source-worklist',
    'docs/phase-5/generated/device-qa-packet',
    'docs/phase-7/generated/core-loop-qa-packet',
    'docs/phase-9/generated/ios-privacy-source-audit',
    'docs/phase-9/generated/release-engineering-qa-packet',
  ]);
  for (const [id, command] of Object.entries(GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID)) {
    const row = GOVERNED_PUBLICATION_COVERAGE_MATRIX.find((candidate) => candidate.id === id);
    assert.equal(typeof packageJson.scripts[command], 'string', id);
    assert.equal(row?.verificationLevel, 'role_specific_deterministic_replay', id);
    assert.equal(row?.deterministicReplayCommand, command, id);
  }
});

test('post-F aggregate contains every deterministic replay once in dependency order', () => {
  assert.equal(GOVERNED_POST_F_COMMANDS.length, 20);
  assert.equal(
    packageJson.scripts['release:governed-packets:check'],
    GOVERNED_POST_F_COMMANDS.map((command) => `npm run ${command}`).join(' && '),
  );

  const commandIndexes = new Map(
    GOVERNED_POST_F_COMMANDS.map((command, index) => [command, index]),
  );
  for (const [id, command] of Object.entries(GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID)) {
    assert.equal(
      GOVERNED_POST_F_COMMANDS.filter((candidate) => candidate === command).length,
      1,
      id,
    );
  }
  for (const { before, after } of GOVERNED_POST_E_PUBLICATION_DAG_EDGES) {
    const beforeCommand = GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID[before];
    const afterCommand = GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID[after];
    if (!beforeCommand || !afterCommand) continue;
    assert.ok(
      commandIndexes.get(beforeCommand) < commandIndexes.get(afterCommand),
      `${before} -> ${after}`,
    );
  }

  const generationCommands = new Set(Object.values(GOVERNED_GENERATION_COMMAND_BY_UNIT_ID));
  assert.equal(
    GOVERNED_POST_F_COMMANDS.some((command) => generationCommands.has(command)),
    false,
  );
  assert.equal(
    GOVERNED_POST_F_COMMANDS.some((command) => command.includes(':live-')),
    false,
  );
  assert.equal(GOVERNED_POST_F_COMMANDS.includes('phase9:store-build-inspect:check'), false);
});

test('store inspection is labeled non-replay and Phase 10/11 packet limits stay truthful', () => {
  assert.deepEqual(Object.keys(GOVERNED_NON_REPLAY_CHECK_EXCLUSIONS_BY_UNIT_ID), [
    'docs/phase-9/generated/store-build-inspection',
  ]);
  const store = GOVERNED_PUBLICATION_COVERAGE_MATRIX.find(
    ({ id }) => id === 'docs/phase-9/generated/store-build-inspection',
  );
  assert.equal(store?.replayDisposition, 'non_replay_check_excluded');
  assert.equal(store?.availableNonWritingCheck, 'phase9:store-build-inspect:check');

  for (const id of [
    'docs/phase-10/generated/closed-beta-packet',
    'docs/phase-11/generated/public-launch-packet',
  ]) {
    const row = GOVERNED_PUBLICATION_COVERAGE_MATRIX.find((candidate) => candidate.id === id);
    assert.equal(row?.verificationLevel, 'structural_only');
    assert.equal(row?.deterministicReplayCommand, null);
    assert.equal(row?.provesInitialSemanticAuthenticity, false);
  }
  const support = GOVERNED_PUBLICATION_COVERAGE_MATRIX.find(
    ({ id }) => id === 'docs/phase-10/generated/support-handoff-packet',
  );
  assert.equal(support?.verificationLevel, 'role_specific_deterministic_replay');
  assert.equal(support?.deterministicReplayCommand, 'phase10:support-handoff:check');
});

test('Phase 10/11 verification is source-only and cannot hide a batch writer chain', () => {
  for (const removedAlias of ['phase10:refresh', 'phase11:refresh', 'phase10-11:refresh']) {
    assert.equal(packageJson.scripts?.[removedAlias], undefined, removedAlias);
  }
  assert.deepEqual(referencedNpmScripts('phase10-11:verify'), ['phase10:verify', 'phase11:verify']);

  const writerCommands = new Set(Object.values(GOVERNED_GENERATION_COMMAND_BY_UNIT_ID));
  const visited = new Set();
  const pending = ['phase10:verify', 'phase11:verify', 'phase10-11:verify'];
  while (pending.length > 0) {
    const scriptName = pending.pop();
    if (visited.has(scriptName)) continue;
    visited.add(scriptName);
    for (const referencedScript of referencedNpmScripts(scriptName)) {
      assert.equal(
        writerCommands.has(referencedScript),
        false,
        `${scriptName} -> ${referencedScript}`,
      );
      if (Object.hasOwn(packageJson.scripts ?? {}, referencedScript))
        pending.push(referencedScript);
    }
  }
});
