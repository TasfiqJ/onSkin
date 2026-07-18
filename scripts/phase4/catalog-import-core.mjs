import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

export const CATALOG_IMPORTER_VERSION = 'onskin-obf-stream-v1';
export const MAX_CATALOG_BATCH_SIZE = 500;
export const MAX_CATALOG_LINE_BYTES = 1_048_576;

const BEAUTY_TAGS = new Set([
  'en:beauty',
  'en:cosmetics',
  'en:skin-care',
  'en:face-care',
  'en:moisturizers',
  'en:sunscreens',
  'en:cleansers',
  'en:serums',
  'en:toners',
]);
const REJECT_TAGS = new Set([
  'en:mouthwashes',
  'en:toothpastes',
  'en:oral-care',
  'en:shampoos',
  'en:hair-care',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeText(value, maximumLength) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text) return { reason: 'missing', value: null };
  if (text.length > maximumLength) return { reason: 'oversized', value: null };
  return { reason: null, value: text };
}

export function normalizeGtin(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let index = body.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(digits.at(-1)) ? digits : null;
}

function categoryFromTags(tags) {
  const lower = tags.map((tag) => tag.toLowerCase());
  if (lower.some((tag) => tag.includes('sunscreen') || tag.includes('sun-protection'))) {
    return 'spf';
  }
  if (lower.some((tag) => tag.includes('cleanser'))) return 'cleanser';
  if (lower.some((tag) => tag.includes('toner') || tag.includes('essence'))) return 'toner';
  if (lower.some((tag) => tag.includes('serum'))) return 'serum';
  if (lower.some((tag) => tag.includes('moisturizer') || tag.includes('moisturiser'))) {
    return 'moisturiser_tube';
  }
  return null;
}

function isBeautyCandidate(tags) {
  const lower = tags.map((tag) => tag.toLowerCase());
  if (lower.some((tag) => REJECT_TAGS.has(tag))) return false;
  return lower.some((tag) => BEAUTY_TAGS.has(tag));
}

export function normalizeObfRecord(record, lineNumber) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { accepted: false, reason: 'invalid_record' };
  }

  const barcode = normalizeGtin(record.code);
  if (!barcode) return { accepted: false, reason: 'invalid_gtin' };

  const normalizedName = normalizeText(record.product_name, 240);
  if (!normalizedName.value) {
    return {
      accepted: false,
      reason: normalizedName.reason === 'oversized' ? 'oversized_name' : 'missing_name',
    };
  }

  const tags = Array.isArray(record.categories_tags)
    ? record.categories_tags.filter((tag) => typeof tag === 'string').slice(0, 128)
    : [];
  if (!isBeautyCandidate(tags)) return { accepted: false, reason: 'not_skin_care_category' };

  const normalizedBrand = normalizeText(record.brands, 160);
  if (normalizedBrand.reason === 'oversized') {
    return { accepted: false, reason: 'oversized_brand' };
  }
  const ingredients = normalizeText(record.ingredients_text, 32_768);
  if (ingredients.reason === 'oversized') {
    return { accepted: false, reason: 'oversized_ingredients' };
  }

  let sourceSnapshotDate = null;
  if (typeof record.last_modified_t === 'number' && Number.isFinite(record.last_modified_t)) {
    const date = new Date(record.last_modified_t * 1000);
    if (!Number.isNaN(date.getTime())) sourceSnapshotDate = date.toISOString().slice(0, 10);
  }

  const row = {
    canonical_identity: `gtin:${barcode}`,
    line_number: lineNumber,
    barcode,
    name: normalizedName.value,
    brand: normalizedBrand.value,
    category: categoryFromTags(tags),
    ingredients_text: ingredients.value,
    source_ref: barcode,
    source_url: `https://world.openbeautyfacts.org/product/${barcode}`,
    source_snapshot_date: sourceSnapshotDate,
    quality_grade: ingredients.value ? 'limited' : 'unverified',
  };
  return {
    accepted: true,
    row: { ...row, payload_sha256: sha256(JSON.stringify(row)) },
  };
}

export async function inspectCatalogJsonl(inputPath) {
  const digest = createHash('sha256');
  let bytes = 0;
  let inputRecords = 0;
  let lastByte = null;
  for await (const chunk of createReadStream(inputPath)) {
    digest.update(chunk);
    bytes += chunk.length;
    let newlineIndex = chunk.indexOf(0x0a);
    while (newlineIndex >= 0) {
      inputRecords += 1;
      newlineIndex = chunk.indexOf(0x0a, newlineIndex + 1);
    }
    if (chunk.length > 0) lastByte = chunk.at(-1);
  }
  if (bytes > 0 && lastByte !== 0x0a) inputRecords += 1;
  return { bytes, inputRecords, inputSha256: digest.digest('hex') };
}

async function* streamBoundedCatalogLines(inputPath) {
  let parts = [];
  let bufferedBytes = 0;
  let oversized = false;

  const append = (segment) => {
    if (segment.length === 0 || oversized) return;
    if (bufferedBytes + segment.length > MAX_CATALOG_LINE_BYTES) {
      parts = [];
      bufferedBytes = 0;
      oversized = true;
      return;
    }
    parts.push(segment);
    bufferedBytes += segment.length;
  };

  const completeLine = () => {
    if (oversized) return { oversized: true, value: null };
    const bytes = Buffer.concat(parts, bufferedBytes);
    const value = bytes.at(-1) === 0x0d ? bytes.subarray(0, -1).toString('utf8') : bytes.toString('utf8');
    return { oversized: false, value };
  };

  for await (const chunk of createReadStream(inputPath)) {
    let segmentStart = 0;
    for (let index = 0; index < chunk.length; index += 1) {
      if (chunk[index] !== 0x0a) continue;
      append(chunk.subarray(segmentStart, index));
      yield completeLine();
      parts = [];
      bufferedBytes = 0;
      oversized = false;
      segmentStart = index + 1;
    }
    append(chunk.subarray(segmentStart));
  }

  if (oversized || bufferedBytes > 0) yield completeLine();
}

function readCheckpoint(checkpointPath) {
  if (!checkpointPath || !existsSync(checkpointPath)) return null;
  const parsed = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  if (!parsed || parsed.schemaVersion !== 1) throw new Error('CATALOG_CHECKPOINT_INVALID');
  return parsed;
}

function writeCheckpoint(checkpointPath, checkpoint) {
  if (!checkpointPath) return;
  const temporaryPath = `${checkpointPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(checkpoint, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, checkpointPath);
}

function rejectionIncrement(rejections, reason) {
  rejections[reason] = (rejections[reason] ?? 0) + 1;
}

function classifyCatalogLine(line, lineNumber) {
  if (line.oversized) return { accepted: false, reason: 'oversized_record' };
  const value = line.value;
  if (!value.trim()) return { accepted: false, reason: 'blank_line' };
  let record;
  try {
    record = JSON.parse(value);
  } catch {
    return { accepted: false, reason: 'invalid_json' };
  }
  return normalizeObfRecord(record, lineNumber);
}

function batchDigest(input) {
  return sha256(JSON.stringify(input));
}

async function stageWithReplaySafeRetry(adapter, input) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await adapter.stageBatch(input);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function runCatalogImport({
  adapter,
  artifactUri,
  batchSize = 250,
  checkpointPath,
  inputPath,
  promote = false,
  sourceRevision,
}) {
  const workerStartedAt = new Date().toISOString();
  const workerStartedMs = Date.now();
  if (!adapter) throw new Error('CATALOG_IMPORT_ADAPTER_REQUIRED');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_CATALOG_BATCH_SIZE) {
    throw new Error('CATALOG_IMPORT_BATCH_SIZE_INVALID');
  }
  const normalizedSourceRevision =
    typeof sourceRevision === 'string' ? sourceRevision.trim() : '';
  if (!normalizedSourceRevision || normalizedSourceRevision.length > 160) {
    throw new Error('CATALOG_IMPORT_REVISION_INVALID');
  }

  const inspection = await inspectCatalogJsonl(inputPath);
  const priorCheckpoint = readCheckpoint(checkpointPath);
  if (
    priorCheckpoint &&
    (priorCheckpoint.inputSha256 !== inspection.inputSha256 ||
      priorCheckpoint.sourceRevision !== normalizedSourceRevision)
  ) {
    throw new Error('CATALOG_CHECKPOINT_ARTIFACT_MISMATCH');
  }

  const started = await adapter.beginImport({
    artifactSha256: inspection.inputSha256,
    artifactUri: artifactUri ?? basename(inputPath),
    importerVersion: CATALOG_IMPORTER_VERSION,
    sourceKey: 'open_beauty_facts',
    sourceRevision: normalizedSourceRevision,
  });
  if (started.status === 'active') {
    return { ...started, ...inspection, alreadyActive: true };
  }
  if (!['running', 'ready'].includes(started.status)) {
    throw new Error('CATALOG_IMPORT_TERMINAL_VERSION');
  }

  let checkpointLine = Number(started.checkpointLine);
  let acceptedRecords = Number(started.acceptedRecords);
  let rejectedRecords = Number(started.rejectedRecords);
  if (
    !Number.isSafeInteger(checkpointLine) ||
    checkpointLine < 0 ||
    checkpointLine > inspection.inputRecords
  ) {
    throw new Error('CATALOG_SERVER_CHECKPOINT_INVALID');
  }
  if (
    !Number.isSafeInteger(acceptedRecords) ||
    acceptedRecords < 0 ||
    !Number.isSafeInteger(rejectedRecords) ||
    rejectedRecords < 0 ||
    acceptedRecords + rejectedRecords !== checkpointLine
  ) {
    throw new Error('CATALOG_SERVER_COUNTS_INVALID');
  }

  // The server receipt is the progress authority. Rebuild reason counts from
  // the immutable source on every invocation so a stale local checkpoint from
  // a restored/recreated database cannot duplicate or suppress manifest data.
  const rejectionReasons = {};
  let batchRows = [];
  let batchRejected = 0;
  let batchLastLine = checkpointLine;

  const commitBatch = async () => {
    if (batchLastLine === checkpointLine) return;
    const payload = {
      importId: started.importId,
      expectedCheckpoint: checkpointLine,
      lastLine: batchLastLine,
      rows: batchRows,
      rejectedCount: batchRejected,
    };
    const receipt = await stageWithReplaySafeRetry(adapter, {
      ...payload,
      batchSha256: batchDigest(payload),
    });
    if (Number(receipt.checkpointLine) !== batchLastLine) {
      throw new Error('CATALOG_IMPORT_RECEIPT_CHECKPOINT_MISMATCH');
    }
    const nextAcceptedRecords = Number(receipt.acceptedRecords);
    const nextRejectedRecords = Number(receipt.rejectedRecords);
    const nextStagedProducts = Number(receipt.stagedProducts);
    if (
      !Number.isSafeInteger(nextAcceptedRecords) ||
      nextAcceptedRecords < 0 ||
      !Number.isSafeInteger(nextRejectedRecords) ||
      nextRejectedRecords < 0 ||
      nextAcceptedRecords + nextRejectedRecords !== batchLastLine ||
      !Number.isSafeInteger(nextStagedProducts) ||
      nextStagedProducts < 0 ||
      nextStagedProducts > nextAcceptedRecords
    ) {
      throw new Error('CATALOG_IMPORT_RECEIPT_COUNTS_INVALID');
    }
    checkpointLine = batchLastLine;
    acceptedRecords = nextAcceptedRecords;
    rejectedRecords = nextRejectedRecords;
    writeCheckpoint(checkpointPath, {
      schemaVersion: 1,
      importId: started.importId,
      inputSha256: inspection.inputSha256,
      sourceRevision: normalizedSourceRevision,
      checkpointLine,
      acceptedRecords,
      rejectedRecords,
      stagedProducts: nextStagedProducts,
      rejectionReasons,
    });
    batchRows = [];
    batchRejected = 0;
  };

  let lineNumber = 0;
  for await (const line of streamBoundedCatalogLines(inputPath)) {
    lineNumber += 1;
    const classified = classifyCatalogLine(line, lineNumber);
    if (lineNumber <= checkpointLine) {
      if (!classified.accepted) rejectionIncrement(rejectionReasons, classified.reason);
      continue;
    }
    batchLastLine = lineNumber;
    if (!classified.accepted) {
      batchRejected += 1;
      rejectionIncrement(rejectionReasons, classified.reason);
    } else {
      batchRows.push(classified.row);
    }

    if (batchLastLine - checkpointLine >= batchSize) await commitBatch();
  }
  await commitBatch();

  if (checkpointLine !== inspection.inputRecords) throw new Error('CATALOG_IMPORT_INCOMPLETE');
  const manifest = {
    schemaVersion: 1,
    source: 'open_beauty_facts',
    sourceRevision: normalizedSourceRevision,
    importerVersion: CATALOG_IMPORTER_VERSION,
    artifactSha256: inspection.inputSha256,
    artifactBytes: inspection.bytes,
    maximumLineBytes: MAX_CATALOG_LINE_BYTES,
    inputRecords: inspection.inputRecords,
    acceptedRecords,
    rejectedRecords,
    rejectionReasons,
    workerInvocationStartedAt: workerStartedAt,
    workerInvocationCompletedAt: new Date().toISOString(),
    workerInvocationDurationMs: Date.now() - workerStartedMs,
  };
  const ready = await adapter.markReady({
    importId: started.importId,
    inputSha256: inspection.inputSha256,
    inputRecords: inspection.inputRecords,
    acceptedRecords,
    rejectedRecords,
    manifest,
  });
  const promotion = promote ? await adapter.promote({ importId: started.importId }) : null;
  return { ...inspection, ...ready, manifest, promotion, alreadyActive: false };
}
