#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertWorklistUsable,
  createSignoffTemplate,
  parseArgs,
  resolveSafeOutputPath,
  suggestedSignoffPath,
  writeSignoffTemplate,
} from './create-review-signoff-template.mjs';

const require = createRequire(import.meta.url);
const {
  REVIEW_WORKLIST_SCHEMA_VERSION,
  computeReviewSnapshotSha256,
  validateReviewSignoff,
} = require('../../apps/mobile/phase3-review-evidence');

function itemFixture(overrides = {}) {
  const item = {
    id: 'clinical:conflict-and-synergy-rules',
    domain: 'clinical',
    area: 'Conflict and synergy rules',
    requiredReviewer: 'board-certified dermatologist or equivalent qualified clinician',
    sourceText: '`apps/mobile/src/features/intelligence/rules.ts`',
    currentBehavior: 'Unreviewed rules hidden in production.',
    notes: 'Reviewer must inspect rule severity, resolution, and source posture.',
    status: 'Not cleared',
    statusBucket: 'notCleared',
    signoff: null,
    sourcePaths: [
      {
        path: 'apps/mobile/src/features/intelligence/rules.ts',
        exists: true,
        bytes: 123,
        sha256: 'a'.repeat(64),
      },
    ],
    ...overrides,
  };
  item.reviewSnapshotSha256 = overrides.reviewSnapshotSha256 ?? computeReviewSnapshotSha256(item);
  return item;
}

function worklistFixture(item = itemFixture()) {
  return {
    schemaVersion: REVIEW_WORKLIST_SCHEMA_VERSION,
    gitStatus: '',
    summary: {
      blockerCount: 0,
      missingSourcePathCount: 0,
      warningCount: 0,
    },
    items: [item],
    blockers: [],
    warnings: [],
  };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrows(run, pattern, message) {
  try {
    run();
  } catch (error) {
    if (pattern.test(error instanceof Error ? error.message : String(error))) return;
    throw error;
  }
  throw new Error(message);
}

const cases = [
  {
    name: 'prefills immutable approved evidence without inventing attestor data',
    run() {
      const item = itemFixture();
      const template = createSignoffTemplate(item, 'approved');
      expect(template.itemId === item.id, 'item ID was not preserved');
      expect(
        template.reviewSnapshotSha256 === item.reviewSnapshotSha256,
        'snapshot digest was not preserved',
      );
      expect(template.decision.disposition === 'approved', 'approved disposition missing');
      expect(
        /REPLACE_WITH/.test(template.decision.conditions[0]),
        'condition placeholder is missing',
      );
      expect(
        /REPLACE_WITH/.test(template.decision.conditionsSatisfied),
        'condition satisfaction placeholder is missing',
      );
      expect(template.productionGate === null, 'approved draft must have a null gate');
      expect(/REPLACE_WITH/.test(template.attestor.name), 'attestor placeholder is missing');
      const draftErrors = validateReviewSignoff(
        {
          ...item,
          statusBucket: 'approved',
          reviewer: template.attestor.name,
          date: template.reviewDate,
          signoff: {
            file: {
              path: suggestedSignoffPath(item.id),
              exists: true,
            },
            record: template,
          },
        },
        { verifyHashes: false },
      ).join(' ');
      expect(/no named attestor/.test(draftErrors), 'draft attestor placeholder was accepted');
      expect(/condition 1 is blank or a placeholder/.test(draftErrors), 'draft condition passed');
      expect(
        /must state whether conditions are satisfied/.test(draftErrors),
        'draft condition state passed',
      );
      expect(/no retained approval evidence reference/.test(draftErrors), 'draft reference passed');
    },
  },
  {
    name: 'creates a fail-closed deferred production-gate draft',
    run() {
      const template = createSignoffTemplate(itemFixture(), 'deferred');
      expect(template.decision.disposition === 'deferred', 'deferred disposition missing');
      expect(
        /REPLACE_WITH/.test(template.decision.conditionsSatisfied),
        'deferred condition state must stay unresolved',
      );
      expect(/REPLACE_WITH/.test(template.productionGate.state), 'gate state must stay unresolved');
      expect(
        /REPLACE_WITH/.test(template.productionGate.reason),
        'gate reason must stay unresolved',
      );
      expect(/REPLACE_WITH/.test(template.productionGate.owner), 'gate owner must stay unresolved');
    },
  },
  {
    name: 'requires an explicit decision for unresolved worklist rows',
    run() {
      expectThrows(
        () => createSignoffTemplate(itemFixture()),
        /supply --disposition approved or deferred only after a real decision exists/,
        'unresolved row generated a signoff without an explicit decision',
      );
    },
  },
  {
    name: 'refuses to contradict an existing review-log disposition',
    run() {
      expectThrows(
        () =>
          createSignoffTemplate(
            itemFixture({ status: 'Approved', statusBucket: 'approved' }),
            'deferred',
          ),
        /cannot contradict/,
        'generator allowed a contradictory disposition',
      );
    },
  },
  {
    name: 'rejects stale snapshot digests and existing signoffs',
    run() {
      expectThrows(
        () =>
          createSignoffTemplate(itemFixture({ reviewSnapshotSha256: '0'.repeat(64) }), 'approved'),
        /stale generated review snapshot/,
        'generator accepted a stale snapshot',
      );
      expectThrows(
        () => createSignoffTemplate(itemFixture({ signoff: { file: {}, record: {} } }), 'approved'),
        /already has a detached signoff/,
        'generator allowed duplicate signoff preparation',
      );
    },
  },
  {
    name: 'parses list and item modes without ambiguous combinations',
    run() {
      const parsed = parseArgs([
        '--item=clinical:conflict-and-synergy-rules',
        '--disposition',
        'APPROVED',
      ]);
      expect(parsed.itemId === 'clinical:conflict-and-synergy-rules', 'item option failed');
      expect(parsed.disposition === 'approved', 'disposition normalization failed');
      expectThrows(
        () => parseArgs(['--list', '--item', 'clinical:x']),
        /--list cannot be combined/,
        'list mode accepted an item option',
      );
      expectThrows(
        () => parseArgs(['--unknown']),
        /Unsupported argument/,
        'unknown option was accepted',
      );
    },
  },
  {
    name: 'writes only non-overwriting direct JSON children of the signoff directory',
    run() {
      const rootDir = mkdtempSync(join(tmpdir(), 'routinekind-signoff-template-'));
      try {
        const item = itemFixture();
        const template = createSignoffTemplate(item, 'approved');
        const outputPath = suggestedSignoffPath(item.id);
        const target = writeSignoffTemplate(rootDir, outputPath, template);
        const written = JSON.parse(readFileSync(target, 'utf8'));
        expect(written.itemId === item.id, 'written template is not the selected item');
        expectThrows(
          () => writeSignoffTemplate(rootDir, outputPath, template),
          /Refusing to overwrite/,
          'existing evidence was overwritten',
        );
        expectThrows(
          () => resolveSafeOutputPath(rootDir, 'docs/phase-3/signoffs/nested/item.json'),
          /direct JSON child/,
          'nested output path was accepted',
        );
        expectThrows(
          () => resolveSafeOutputPath(rootDir, '../outside.json'),
          /direct JSON child/,
          'traversal output path was accepted',
        );
      } finally {
        rmSync(rootDir, { force: true, recursive: true });
      }
    },
  },
  {
    name: 'refuses dirty or contract-blocked worklists',
    run() {
      assertWorklistUsable(worklistFixture());
      expectThrows(
        () => assertWorklistUsable({ ...worklistFixture(), gitStatus: ' M source.ts' }),
        /dirty worktree/,
        'dirty worklist was accepted',
      );
      const blocked = worklistFixture();
      blocked.summary.blockerCount = 1;
      expectThrows(
        () => assertWorklistUsable(blocked),
        /reports contract blockers/,
        'blocked worklist was accepted',
      );
    },
  },
];

let failed = false;
for (const testCase of cases) {
  try {
    testCase.run();
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${testCase.name}`);
    console.error(error instanceof Error ? error.stack : String(error));
  }
}

if (failed) process.exit(1);
