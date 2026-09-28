import {
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS,
  GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID,
  GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
  GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
} from './governed-evidence-chain.mjs';

export const GOVERNED_GENERATION_COMMAND_BY_UNIT_ID = Object.freeze({
  'docs/e2e/generated/human-e2e-manifest': 'e2e:human:manifest',
  'docs/generated/generated-packet-status-audit': 'docs:generated-packet-status-audit:strict',
  'docs/generated/device-support-policy-audit': 'docs:device-support-policy-audit:strict',
  'docs/generated/performance-readiness-audit': 'docs:performance-readiness-audit:strict',
  'docs/generated/readiness-status-audit': 'docs:readiness-status-audit:strict',
  'docs/generated/source-packet-audit': 'docs:source-packet-audit:strict',
  'docs/generated/tas-todo-audit': 'docs:tas-todo-audit:strict',
  'docs/phase-3/generated/review-packet-manifest': 'phase3:review-packet',
  'docs/phase-3/generated/review-operator-queue': 'phase3:review-operator-queue:strict',
  'docs/phase-3/generated/review-worklist': 'phase3:review-worklist:strict',
  'docs/phase-4/generated/beta-coverage-report': 'phase4:beta-coverage-report:strict',
  'docs/phase-4/generated/catalog-qa-report': 'phase4:qa-report',
  'docs/phase-4/generated/cosing-catalog-qa-report': 'phase4:qa-report-cosing',
  'docs/phase-4/generated/cosing-fixture-import': 'phase4:import-cosing-fixture',
  'docs/phase-4/generated/obf-fixture-import': 'phase4:import-obf-fixture',
  'docs/phase-4/generated/source-worklist': 'phase4:source-worklist:strict',
  'docs/phase-5/generated/device-qa-packet': 'phase5:qa-packet:strict',
  'docs/phase-6/generated/payments-qa-packet': 'phase6:qa-packet:strict',
  'docs/phase-7/generated/core-loop-qa-packet': 'phase7:qa-packet:strict',
  'docs/phase-8/generated/growth-store-qa-packet': 'phase8:qa-packet:strict',
  'docs/phase-9/generated/dependency-inventory': 'phase9:dependency-sbom:strict',
  'docs/phase-9/generated/ios-privacy-source-audit': 'phase9:ios-privacy-source-audit',
  'docs/phase-9/generated/live-catalog-rate-limit': 'phase9:live-catalog-rate-limit:strict',
  'docs/phase-9/generated/live-consent-withdrawal': 'phase9:live-consent-withdrawal:strict',
  'docs/phase-9/generated/live-data-rights': 'phase9:live-data-rights:strict',
  'docs/phase-9/generated/live-edge-auth': 'phase9:live-edge-auth:strict',
  'docs/phase-9/generated/live-order-report-poll': 'phase9:live-order-report-poll:strict',
  'docs/phase-9/generated/live-public-forms': 'phase9:live-public-forms:strict',
  'docs/phase-9/generated/live-revenuecat-webhook': 'phase9:live-revenuecat-webhook:strict',
  'docs/phase-9/generated/live-supabase-adversarial': 'phase9:live-supabase-adversarial:strict',
  'docs/phase-9/generated/release-engineering-qa-packet': 'phase9:qa-packet:strict',
  'docs/phase-9/generated/store-build-inspection': 'phase9:store-build-inspect:write:strict',
  'docs/phase-10/generated/closed-beta-packet': 'phase10:beta-packet:strict',
  'docs/phase-10/generated/support-handoff-packet': 'phase10:support-handoff:strict',
  'docs/phase-11/generated/public-launch-packet': 'phase11:launch-packet:strict',
});

export const GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID = Object.freeze({
  'docs/e2e/generated/human-e2e-manifest': 'e2e:human:manifest:check',
  'docs/generated/generated-packet-status-audit': 'docs:generated-packet-status-audit:check',
  'docs/generated/device-support-policy-audit': 'docs:device-support-policy-audit:check',
  'docs/generated/performance-readiness-audit': 'docs:performance-readiness-audit:check',
  'docs/generated/readiness-status-audit': 'docs:readiness-status-audit:check',
  'docs/generated/source-packet-audit': 'docs:source-packet-audit:check',
  'docs/generated/tas-todo-audit': 'docs:tas-todo-audit:check',
  'docs/phase-3/generated/review-operator-queue': 'phase3:review-operator-queue:check',
  'docs/phase-3/generated/review-worklist': 'phase3:review-worklist:check',
  'docs/phase-4/generated/beta-coverage-report': 'phase4:beta-coverage-report:check',
  'docs/phase-4/generated/source-worklist': 'phase4:source-worklist:check',
  'docs/phase-5/generated/device-qa-packet': 'phase5:qa-packet:check',
  'docs/phase-7/generated/core-loop-qa-packet': 'phase7:qa-packet:check',
  'docs/phase-9/generated/ios-privacy-source-audit': 'phase9:ios-privacy-source-audit:check',
  'docs/phase-9/generated/release-engineering-qa-packet': 'phase9:qa-packet:check',
  'docs/phase-10/generated/support-handoff-packet': 'phase10:support-handoff:check',
});

export const GOVERNED_NON_REPLAY_CHECK_EXCLUSIONS_BY_UNIT_ID = Object.freeze({
  'docs/phase-9/generated/store-build-inspection': Object.freeze({
    command: 'phase9:store-build-inspect:check',
    reason:
      'The command is non-writing current-state inspection only; --check suppresses publication but does not compare the committed JSON output bytes.',
  }),
});

export const GOVERNED_POST_F_COMMANDS = Object.freeze([
  'phase9:governed-publication-coverage:test',
  'docs:performance-readiness-audit:check',
  'docs:source-packet-audit:check',
  'docs:tas-todo-audit:check',
  'phase3:review-worklist:check',
  'phase3:review-operator-queue:check',
  'phase4:source-worklist:check',
  'phase9:ios-privacy-source-audit:check',
  'e2e:human:manifest:contract:test',
  'e2e:human:manifest:check',
  'phase4:beta-coverage-contract:test',
  'phase4:beta-coverage-report:check',
  'docs:device-support-policy-audit:check',
  'phase5:qa-packet:check',
  'phase7:qa-packet:contract:test',
  'phase7:qa-packet:check',
  'phase9:qa-packet:check',
  'phase10:support-handoff:check',
  'docs:generated-packet-status-audit:check',
  'docs:readiness-status-audit:check',
]);

function exactKeySet(left, right) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = [...right].sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((value, index) => value === rightKeys[index])
  );
}

const governedUnitIds = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.map(({ id }) => id);
if (!exactKeySet(GOVERNED_GENERATION_COMMAND_BY_UNIT_ID, governedUnitIds)) {
  throw new Error('governed generation-command coverage is not exact');
}
if (
  Object.keys(GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID).some((id) => !governedUnitIds.includes(id))
) {
  throw new Error('governed deterministic replay coverage names an unknown unit');
}
if (
  Object.keys(GOVERNED_NON_REPLAY_CHECK_EXCLUSIONS_BY_UNIT_ID).some(
    (id) =>
      !governedUnitIds.includes(id) || Object.hasOwn(GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID, id),
  )
) {
  throw new Error('governed non-replay exclusion coverage is invalid');
}

export const GOVERNED_PUBLICATION_COVERAGE_MATRIX = Object.freeze(
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.map((unit) => {
    const deterministicReplayCommand = GOVERNED_DETERMINISTIC_REPLAY_BY_UNIT_ID[unit.id] ?? null;
    const nonReplayCheckExclusion =
      GOVERNED_NON_REPLAY_CHECK_EXCLUSIONS_BY_UNIT_ID[unit.id] ?? null;
    const publicationClass = GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.includes(unit.id)
      ? 'source_snapshot'
      : GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.includes(unit.id)
        ? 'post_e'
        : unit.id === GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID
          ? 'final_readiness'
          : null;
    if (publicationClass === null) {
      throw new Error(`governed publication unit has no lifecycle class: ${unit.id}`);
    }
    return Object.freeze({
      id: unit.id,
      kind: unit.kind,
      paths: unit.paths,
      generationCommand: GOVERNED_GENERATION_COMMAND_BY_UNIT_ID[unit.id],
      publicationClass,
      structuralPublication:
        publicationClass === 'source_snapshot'
          ? 'sha_bound_at_s_immutable_through_f'
          : publicationClass === 'post_e'
            ? 'exactly_one_dag_ordered_commit_after_e'
            : 'unique_final_f_commit',
      verificationLevel:
        deterministicReplayCommand === null
          ? 'structural_only'
          : 'role_specific_deterministic_replay',
      deterministicReplayCommand,
      replayDisposition:
        deterministicReplayCommand !== null
          ? 'deterministic_replay'
          : nonReplayCheckExclusion !== null
            ? 'non_replay_check_excluded'
            : 'no_reviewed_non_writing_check',
      availableNonWritingCheck: nonReplayCheckExclusion?.command ?? null,
      nonReplayExclusionReason: nonReplayCheckExclusion?.reason ?? null,
      provesInitialSemanticAuthenticity: false,
    });
  }),
);

export const GOVERNED_PUBLICATION_COVERAGE_SUMMARY = Object.freeze({
  units: GOVERNED_PUBLICATION_COVERAGE_MATRIX.length,
  jsonMarkdownPairs: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ kind }) => kind === 'json_markdown_pair',
  ).length,
  jsonSingletons: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ kind }) => kind === 'json_singleton',
  ).length,
  sourceSnapshotUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ publicationClass }) => publicationClass === 'source_snapshot',
  ).length,
  postEvidenceUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ publicationClass }) => publicationClass === 'post_e',
  ).length,
  finalReadinessUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ publicationClass }) => publicationClass === 'final_readiness',
  ).length,
  deterministicReplayUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ verificationLevel }) => verificationLevel === 'role_specific_deterministic_replay',
  ).length,
  structuralOnlyUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ verificationLevel }) => verificationLevel === 'structural_only',
  ).length,
  postEvidenceDeterministicReplayUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ publicationClass, verificationLevel }) =>
      publicationClass === 'post_e' && verificationLevel === 'role_specific_deterministic_replay',
  ).length,
  postEvidenceStructuralOnlyUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ publicationClass, verificationLevel }) =>
      publicationClass === 'post_e' && verificationLevel === 'structural_only',
  ).length,
  nonReplayCheckExcludedUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ replayDisposition }) => replayDisposition === 'non_replay_check_excluded',
  ).length,
  noReviewedNonWritingCheckUnits: GOVERNED_PUBLICATION_COVERAGE_MATRIX.filter(
    ({ replayDisposition }) => replayDisposition === 'no_reviewed_non_writing_check',
  ).length,
});
