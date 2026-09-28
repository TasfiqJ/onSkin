import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS,
  GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID,
  GOVERNED_LAUNCH_CONTRACT_PATH,
  GOVERNED_POST_E_PUBLICATION_DAG_EDGES,
  GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
  GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
} from './governed-evidence-chain.mjs';

function requiredPostEvidenceOrder() {
  const remaining = new Set(GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS);
  const completed = new Set();
  const ordered = [];
  while (remaining.size > 0) {
    const next = [...remaining]
      .sort()
      .find((unitId) =>
        GOVERNED_POST_E_PUBLICATION_DAG_EDGES.filter(({ after }) => after === unitId).every(
          ({ before }) => completed.has(before),
        ),
      );
    if (!next) throw new Error('governed fixture publication policy contains a cycle');
    ordered.push(next);
    completed.add(next);
    remaining.delete(next);
  }
  return Object.freeze(ordered);
}

export const GOVERNED_REQUIRED_POST_E_FIXTURE_ORDER = requiredPostEvidenceOrder();

export function seedGovernedPublicationSourceFixture({ fixtureRoot, sourceRoot }) {
  const paths = [
    GOVERNED_LAUNCH_CONTRACT_PATH,
    ...GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS.flatMap(
      (unitId) => GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === unitId).paths,
    ),
  ];
  for (const repoPath of paths) {
    const destination = resolve(fixtureRoot, repoPath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(sourceRoot, repoPath), destination);
  }
}

function writeGovernedFixtureUnit(fixtureRoot, unitId) {
  const unit = GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.find(({ id }) => id === unitId);
  if (!unit) throw new Error(`unknown governed fixture publication unit: ${unitId}`);
  for (const repoPath of unit.paths) {
    const destination = resolve(fixtureRoot, repoPath);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      repoPath.endsWith('.json')
        ? `${JSON.stringify({ fixture: true, unitId })}\n`
        : `# Synthetic governed publication: ${unitId}\n`,
    );
  }
  return unit.paths;
}

export function publishGovernedFixtureUnit({ fixtureRoot, unitId }) {
  const paths = writeGovernedFixtureUnit(fixtureRoot, unitId);
  execFileSync('git', ['add', '-f', '--', ...paths], {
    cwd: fixtureRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  execFileSync(
    'git',
    ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', `Publish ${unitId}`],
    {
      cwd: fixtureRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
}

export function publishGovernedFixtureTail({
  fixtureRoot,
  alreadyPublishedUnitIds = [],
  includeFinalReadiness = true,
}) {
  const alreadyPublished = new Set(alreadyPublishedUnitIds);
  if (
    alreadyPublished.size !== alreadyPublishedUnitIds.length ||
    [...alreadyPublished].some(
      (unitId) => !GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.includes(unitId),
    )
  ) {
    throw new Error('governed fixture already-published inventory is invalid');
  }
  for (const { before, after } of GOVERNED_POST_E_PUBLICATION_DAG_EDGES) {
    if (alreadyPublished.has(after) && !alreadyPublished.has(before)) {
      throw new Error(
        `governed fixture already-published inventory reverses ${before} -> ${after}`,
      );
    }
  }
  for (const unitId of GOVERNED_REQUIRED_POST_E_FIXTURE_ORDER) {
    if (!alreadyPublished.has(unitId)) publishGovernedFixtureUnit({ fixtureRoot, unitId });
  }
  if (includeFinalReadiness) {
    publishGovernedFixtureUnit({
      fixtureRoot,
      unitId: GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID,
    });
  }
}
