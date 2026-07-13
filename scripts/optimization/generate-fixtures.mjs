import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OPTIMIZATION_FIXTURE_VERSION = 'optimization-fixtures:v1';
export const OPTIMIZATION_FIXTURE_SEED = 'routinekind-synthetic-2026-07-12';

const SCALE_COUNTS = Object.freeze({
  empty: {
    activeShelf: 0,
    archivedShelf: 0,
    completionDays: 0,
    photos: 0,
    outbox: 0,
    askMessages: 0,
    exportRows: 0,
  },
  median: {
    activeShelf: 24,
    archivedShelf: 12,
    completionDays: 90,
    photos: 10,
    outbox: 20,
    askMessages: 24,
    exportRows: 120,
  },
  stress: {
    activeShelf: 250,
    archivedShelf: 500,
    completionDays: 365,
    photos: 250,
    outbox: 1000,
    askMessages: 200,
    exportRows: 1205,
  },
});

function pad(value, width = 4) {
  return String(value).padStart(width, '0');
}

function localDateAtOffset(offset) {
  const date = new Date(Date.UTC(2025, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
}

function range(count, factory) {
  return Array.from({ length: count }, (_, index) => factory(index));
}

function createShelf(activeCount, archivedCount) {
  return [
    ...range(activeCount, (index) => ({
      id: `synthetic-shelf-active-${pad(index + 1)}`,
      productKey: `synthetic-product-${pad(index + 1)}`,
      status: 'active',
      updatedRevision: index + 1,
      openedAt: localDateAtOffset(index % 180),
    })),
    ...range(archivedCount, (index) => ({
      id: `synthetic-shelf-archive-${pad(index + 1)}`,
      productKey: `synthetic-product-${pad(activeCount + index + 1)}`,
      status: 'archived',
      updatedRevision: activeCount + index + 1,
      openedAt: localDateAtOffset(index % 180),
    })),
  ];
}

function createCompletions(dayCount) {
  return range(dayCount * 2, (index) => ({
    id: `synthetic-completion-${pad(index + 1, 5)}`,
    localDate: localDateAtOffset(Math.floor(index / 2)),
    phase: index % 2 === 0 ? 'am' : 'pm',
    stepKey: `synthetic-step-${pad((index % 12) + 1)}`,
  }));
}

function createPhotos(count) {
  return range(count, (index) => ({
    id: `synthetic-photo-${pad(index + 1)}`,
    series: index % 2 === 0 ? 'front' : 'side',
    takenAt: `${localDateAtOffset(index * 3)}T12:00:00.000Z`,
    rendition: 'encrypted-placeholder-only',
    byteLength: 0,
  }));
}

function createOutbox(count) {
  return range(count, (index) => ({
    operationId: `synthetic-operation-${pad(index + 1, 5)}`,
    owner: 'synthetic-owner-generation',
    entityType: index % 2 === 0 ? 'completion' : 'shelf',
    entityId: `synthetic-entity-${pad(index + 1, 5)}`,
    operation: index % 5 === 0 ? 'delete' : 'upsert',
    attemptCount: index % 4,
    nextAttemptAt: `${localDateAtOffset(index % 30)}T12:00:00.000Z`,
  }));
}

function createAskMessages(count) {
  return range(count, (index) => ({
    id: `synthetic-message-${pad(index + 1)}`,
    role: index % 2 === 0 ? 'user' : 'advisor',
    content: `Synthetic message ${pad(index + 1)}. No user or product content.`,
  }));
}

function createExportRows(count) {
  return range(count, (index) => ({
    id: `synthetic-export-row-${pad(index + 1, 5)}`,
    revision: index + 1,
    state: index % 3 === 0 ? 'archived' : 'active',
  }));
}

export function createOptimizationFixture(scale) {
  const counts = SCALE_COUNTS[scale];
  if (!counts) throw new Error(`Unknown fixture scale: ${scale}`);
  return {
    metadata: {
      version: OPTIMIZATION_FIXTURE_VERSION,
      seed: OPTIMIZATION_FIXTURE_SEED,
      scale,
      synthetic: true,
      containsImageBytes: false,
    },
    shelf: createShelf(counts.activeShelf, counts.archivedShelf),
    completions: createCompletions(counts.completionDays),
    photos: createPhotos(counts.photos),
    outbox: createOutbox(counts.outbox),
    askMessages: createAskMessages(counts.askMessages),
    exportRows: createExportRows(counts.exportRows),
  };
}

export function fixtureDocument(scale) {
  const data = createOptimizationFixture(scale);
  const serializedData = JSON.stringify(data);
  return {
    manifest: {
      version: OPTIMIZATION_FIXTURE_VERSION,
      seed: OPTIMIZATION_FIXTURE_SEED,
      scale,
      sha256: createHash('sha256').update(serializedData).digest('hex'),
      counts: Object.fromEntries(
        Object.entries(data)
          .filter(([, value]) => Array.isArray(value))
          .map(([key, value]) => [key, value.length]),
      ),
    },
    data,
  };
}

function parseArguments(argv) {
  let scale = 'median';
  let output = '';
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--scale') scale = argv[++index] ?? '';
    else if (argument === '--output') output = argv[++index] ?? '';
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!output) throw new Error('--output is required');
  return { scale, output: resolve(output) };
}

async function main() {
  const { scale, output } = parseArguments(process.argv.slice(2));
  const document = fixtureDocument(scale);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify({
      output,
      scale,
      sha256: document.manifest.sha256,
      counts: document.manifest.counts,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Fixture generation failed.');
    process.exitCode = 1;
  });
}
