#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const reportPath = resolve(scriptDir, 'beta-coverage-report.mjs');
const templatePath = resolve(root, 'docs/phase-4/beta-coverage-input.template.json');
const templateInput = JSON.parse(readFileSync(templatePath, 'utf8'));

const passthroughKeys = [
  'ComSpec',
  'HOME',
  'Path',
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'WINDIR',
];

const processBaseEnv = Object.fromEntries(
  passthroughKeys
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => typeof value === 'string' && value.length > 0),
);

const validInput = {
  cohort: {
    invitedUsers: 72,
    realTargetUsers: 64,
    completedUsers: 60,
  },
  productAddCompletion: {
    usersAddedThreePlusProducts: 60,
    productsAdded: 224,
  },
  catalog: {
    productsAdded: 224,
    barcodeLookups: {
      total: 96,
      matched: 74,
    },
    searches: {
      total: 81,
      matched: 63,
    },
    ocr: {
      attempts: 33,
      parsed: 29,
    },
    manualFallback: {
      started: 51,
      saved: 49,
    },
    wrongMatchReports: {
      total: 2,
      open: 0,
      triaged: 0,
      matchedScans: 137,
    },
    parser: {
      unknownTokenRate: 0.11,
      topUnknownTokens: ['madecassoside derivative', 'ferment complex'],
    },
    recommendationEligibility: {
      lowerThanUsableUsedInRecommendations: 0,
    },
    categoryCoverage: [
      { category: 'cleanser', added: 34, matched: 28 },
      { category: 'serum', added: 62, matched: 43 },
      { category: 'moisturizer', added: 41, matched: 35 },
      { category: 'sunscreen', added: 27, matched: 21 },
    ],
    topNoMatches: [
      { label: 'regional sunscreen barcode', count: 4 },
      { label: 'indie barrier serum', count: 3 },
    ],
    topWrongMatches: [{ label: 'legacy EAN collision', count: 2 }],
    expectedRecommendationProducts: [
      { label: 'moisturizer replacement', count: 11 },
      { label: 'gentle cleanser', count: 8 },
    ],
  },
  support: {
    totalTickets: 9,
    catalogTickets: 3,
    trustAccuracySourceConfusionTickets: 1,
    openP0P1Tickets: 0,
  },
  evidence: {
    realBetaData: true,
    dashboardUrl: 'https://posthog.routinekind.app/project/1/dashboard/phase4-catalog',
    analyticsDashboardUrl: 'https://posthog.routinekind.app/project/1/dashboard/beta',
    supportDashboardUrl: 'https://support.routinekind.app/dashboard/beta',
    sourceExportHash: '8d71fdbb3d6f9a48e31ac99e60f1c7800a9aa2a8e81a6adf73f2f56f0a9f4e1a',
    signedOffBy: 'Avery Chen',
  },
};

const requiredSourceHashes = [
  'docs/phase-4/beta-coverage-input.template.json',
  'supabase/functions/catalog-report/index.ts',
  'supabase/functions/catalog-report/privacy.ts',
  'supabase/functions/catalog-report/privacy.test.ts',
  'supabase/functions/deno.lock',
];

function runReport({ input = validInput, strict = false, missingInput = false } = {}) {
  const outDir = mkdtempSync(join(tmpdir(), 'routinekind-phase4-beta-coverage-'));
  const inputPath = resolve(outDir, 'beta-coverage-input.json');
  const outputPath = resolve(outDir, 'beta-coverage-report.json');
  if (!missingInput) writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);

  try {
    const result = spawnSync(
      process.execPath,
      [
        reportPath,
        ...(strict ? ['--strict'] : []),
        inputPath,
        outputPath,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: processBaseEnv,
      },
    );
    const packet = JSON.parse(readFileSync(outputPath, 'utf8'));
    const markdown = readFileSync(outputPath.replace(/\.json$/i, '.md'), 'utf8');
    return { ...result, packet, markdown };
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
}

const cases = [
  {
    name: 'beta coverage report accepts real-shaped beta evidence',
    result: runReport(),
    expect(result) {
      const sourceHashes = Object.fromEntries(
        result.packet.sourceHashes.map((sourceHash) => [sourceHash.path, sourceHash]),
      );
      return (
        result.status === 0 &&
        result.packet.evidenceBlockers.length === 0 &&
        result.packet.metrics.completedUsers === 60 &&
        result.packet.metrics.usersAddedThreePlusRate === 1 &&
        result.packet.evidence.signedOffBy === 'Avery Chen' &&
        requiredSourceHashes.every((path) => sourceHashes[path]?.exists === true) &&
        result.markdown.includes('Completed beta users')
      );
    },
  },
  {
    name: 'beta coverage report strict mode blocks missing beta exports',
    result: runReport({ missingInput: true, strict: true }),
    expect(result) {
      return (
        result.status !== 0 &&
        result.packet.status === 'blocked' &&
        result.packet.evidenceBlockers.some((item) =>
          item.includes('Missing beta coverage input artifact'),
        )
      );
    },
  },
  {
    name: 'beta coverage template documents the export shape without passing evidence gates',
    result: runReport({ input: templateInput }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.status === 'blocked' &&
        result.packet.evidence.realBetaData === false &&
        result.packet.evidenceBlockers.includes(
          'Evidence must explicitly set evidence.realBetaData=true for real beta exports.',
        ) &&
        result.packet.evidenceBlockers.includes('Missing real named beta coverage signoff.')
      );
    },
  },
  {
    name: 'beta coverage report rejects placeholder evidence',
    result: runReport({
      input: {
        ...validInput,
        evidence: {
          ...validInput.evidence,
          dashboardUrl: 'https://example.com/dashboard',
          signedOffBy: 'Tester Name',
        },
      },
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidenceBlockers.includes('Missing real production catalog/beta dashboard URL.') &&
        result.packet.evidenceBlockers.includes('Missing real named beta coverage signoff.')
      );
    },
  },
  {
    name: 'beta coverage report blocks high wrong-match and parser risk',
    result: runReport({
      input: {
        ...validInput,
        catalog: {
          ...validInput.catalog,
          wrongMatchReports: {
            total: 6,
            open: 1,
            triaged: 0,
            matchedScans: 120,
          },
          parser: {
            unknownTokenRate: 0.22,
            topUnknownTokens: ['unknown botanical complex'],
          },
        },
      },
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidenceBlockers.includes(
          'Wrong-match report rate exceeds the 2% Phase 4 alert threshold.',
        ) &&
        result.packet.evidenceBlockers.includes(
          'Open wrong-match reports must be resolved before beta coverage can pass.',
        ) &&
        result.packet.evidenceBlockers.includes(
          'Parser unknown-token rate exceeds the 15% Phase 4 alert threshold.',
        )
      );
    },
  },
  {
    name: 'beta coverage report blocks recommendation use below usable quality',
    result: runReport({
      input: {
        ...validInput,
        catalog: {
          ...validInput.catalog,
          recommendationEligibility: {
            lowerThanUsableUsedInRecommendations: 1,
          },
        },
      },
    }),
    expect(result) {
      return (
        result.status === 0 &&
        result.packet.evidenceBlockers.includes(
          'Products below usable quality must not be used in product-specific recommendations.',
        )
      );
    },
  },
];

let failed = false;
for (const testCase of cases) {
  if (testCase.expect(testCase.result)) {
    console.log(`OK ${testCase.name}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${testCase.name}`);
  const output = `${testCase.result.stdout ?? ''}\n${testCase.result.stderr ?? ''}`.trim();
  if (output) console.error(output);
}

if (failed) process.exit(1);
