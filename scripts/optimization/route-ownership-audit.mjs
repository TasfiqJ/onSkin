#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');
const routeRoot = resolve(repositoryRoot, 'apps/mobile/src/app');
const oversizedThresholdLines = 500;

export const MEASURED_ROUTE_BOUNDARIES = [
  {
    route: 'apps/mobile/src/app/(tabs)/today.tsx',
    boundaries: [
      'const TodayHeader = memo(',
      'const CheckRow = memo(',
      'function TodayScreenContent(',
    ],
    evidence: 'docs/optimization/evidence/2026-07-15_today-route-view-model-checkpoint.md',
    evidenceMarkers: ['falls by 8 of 17 observers', 'local-date subscriptions fall by 8 of 9'],
  },
  {
    route: 'apps/mobile/src/app/(tabs)/progress.tsx',
    boundaries: [
      'const TimelinePhotosRow = memo(',
      'function PhotoProgressContent(',
      'function ProgressRouteBoundary(',
    ],
    evidence: 'docs/optimization/evidence/2026-07-15_progress-shelf-route-ownership-checkpoint.md',
    evidenceMarkers: ['The Progress tab owns one local-date identity', 'uses `SectionList`'],
  },
  {
    route: 'apps/mobile/src/app/(tabs)/shelf.tsx',
    boundaries: [
      'const ProductCard = memo(',
      'const ShelfListHeader = memo(',
      'function FocusedShelfScreen(',
    ],
    evidence: 'docs/optimization/evidence/2026-07-15_progress-shelf-route-ownership-checkpoint.md',
    evidenceMarkers: [
      'use `FlatList` with stable product IDs',
      'isolated from filter-only rerenders',
    ],
  },
  {
    route: 'apps/mobile/src/app/ask/index.tsx',
    boundaries: [
      'const AskMessageRow = memo(',
      'function AskComposer(',
      '<Profiler id="ask-history"',
    ],
    evidence: 'docs/optimization/evidence/2026-07-15_ask-100-turn-keystroke-checkpoint.md',
    evidenceMarkers: [
      'History commits during typing | 6 | 6',
      'Row renders during typing | 16 | 16',
    ],
  },
  {
    route: 'apps/mobile/src/app/shelf/search.tsx',
    boundaries: [
      'const CatalogSearchComposer = memo(',
      'const CatalogResultCard = memo(',
      '<Profiler id="catalog-search-results"',
    ],
    evidence: 'docs/optimization/evidence/2026-07-16_catalog-search-input-isolation-checkpoint.md',
    evidenceMarkers: ['Result-region commits', 'Result-card renders', 'mean development Profiler'],
  },
  {
    route: 'apps/mobile/src/app/shelf/ocr.tsx',
    boundaries: [
      'const OcrCapturePanel = memo(',
      'const OcrParsedPreview = memo(',
      'const OcrReviewEditor = memo(',
      '<Profiler id="ocr-review-editor"',
    ],
    evidence: 'docs/optimization/evidence/2026-07-16_ocr-input-isolation-checkpoint.md',
    evidenceMarkers: ['Route renders', 'Preview parses', "editor's development Profiler"],
  },
  {
    route: 'apps/mobile/src/app/(tabs)/you.tsx',
    boundaries: [
      'const YouStaticOverview = memo(',
      'const YouSecuritySection = memo(',
      'const YouPrivacySection = memo(',
      'const YouPoliciesSection = memo(',
      'const YouDataSection = memo(',
      'const YouMutationSections = memo(',
    ],
    evidence: 'docs/optimization/evidence/2026-07-16_you-mutation-isolation-checkpoint.md',
    evidenceMarkers: ['Protected render deltas', 'Every other owner 0'],
  },
];

function repositoryPath(path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/');
}

function lineCount(source) {
  const lines = source.split(/\r\n|\n|\r/);
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

function routeFiles(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      routeFiles(path, output);
    } else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
      output.push(path);
    }
  }
  return output;
}

export function auditRouteOwnership() {
  const inventory = routeFiles(routeRoot)
    .map((path) => {
      const source = readFileSync(path, 'utf8');
      return { path: repositoryPath(path), lines: lineCount(source) };
    })
    .sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));
  const oversizedRoutes = inventory.filter((route) => route.lines > oversizedThresholdLines);
  const measuredRoutes = MEASURED_ROUTE_BOUNDARIES.map((definition) => {
    const routePath = resolve(repositoryRoot, definition.route);
    const evidencePath = resolve(repositoryRoot, definition.evidence);
    const source = readFileSync(routePath, 'utf8');
    const evidenceExists = existsSync(evidencePath);
    const evidence = evidenceExists ? readFileSync(evidencePath, 'utf8') : '';
    const missingBoundaries = definition.boundaries.filter((marker) => !source.includes(marker));
    const missingEvidenceMarkers = definition.evidenceMarkers.filter(
      (marker) => !evidence.includes(marker),
    );
    return {
      route: definition.route,
      lines: lineCount(source),
      boundaries: definition.boundaries.length,
      evidence: definition.evidence,
      evidenceExists,
      missingBoundaries,
      missingEvidenceMarkers,
      pass: evidenceExists && missingBoundaries.length === 0 && missingEvidenceMarkers.length === 0,
    };
  });
  const measuredPaths = new Set(measuredRoutes.map((route) => route.route));

  return {
    schemaVersion: 1,
    oversizedThresholdLines,
    routeFileCount: inventory.length,
    oversizedRouteCount: oversizedRoutes.length,
    oversizedRoutes,
    measuredRouteCount: measuredRoutes.length,
    measuredRoutes,
    unmeasuredOversizedRoutes: oversizedRoutes.filter((route) => !measuredPaths.has(route.path)),
    pass: measuredRoutes.every((route) => route.pass),
  };
}

function run(argv) {
  if (argv.some((argument) => argument !== '--json')) {
    throw new Error('Usage: node scripts/optimization/route-ownership-audit.mjs [--json]');
  }
  const result = auditRouteOwnership();
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${result.measuredRouteCount} measured route ownership splits; ${result.oversizedRouteCount} routes exceed ${result.oversizedThresholdLines} lines.\n`,
    );
  }
  if (!result.pass) throw new Error('Measured route ownership audit failed.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
