#!/usr/bin/env node
import { resolve } from 'node:path';

import { runCatalogImport } from './catalog-import-core.mjs';

const MAX_RPC_RESPONSE_BYTES = 65_536;

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

function requiredArgument(name) {
  const value = argument(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

function createRpcAdapter(url, secretKey) {
  const baseUrl = url.replace(/\/+$/, '');
  async function readBoundedResponse(response) {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RPC_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('CATALOG_IMPORT_RPC_RESPONSE_TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, totalBytes).toString('utf8');
  }

  async function rpc(functionName, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          authorization: `Bearer ${secretKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const responseText = await readBoundedResponse(response);
      if (!response.ok) {
        throw new Error(`CATALOG_IMPORT_RPC_${response.status}:${responseText}`);
      }
      return responseText ? JSON.parse(responseText) : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    beginImport(input) {
      return rpc('begin_catalog_import', {
        p_source_key: input.sourceKey,
        p_source_revision: input.sourceRevision,
        p_artifact_uri: input.artifactUri,
        p_artifact_sha256: input.artifactSha256,
        p_importer_version: input.importerVersion,
      });
    },
    stageBatch(input) {
      return rpc('stage_catalog_import_batch', {
        p_import_id: input.importId,
        p_expected_checkpoint: input.expectedCheckpoint,
        p_last_line: input.lastLine,
        p_rows: input.rows,
        p_rejected_count: input.rejectedCount,
        p_batch_sha256: input.batchSha256,
      });
    },
    markReady(input) {
      return rpc('ready_catalog_import', {
        p_import_id: input.importId,
        p_input_sha256: input.inputSha256,
        p_input_records: input.inputRecords,
        p_accepted_records: input.acceptedRecords,
        p_rejected_records: input.rejectedRecords,
        p_manifest: input.manifest,
      });
    },
    promote(input) {
      return rpc('promote_catalog_import', { p_import_id: input.importId });
    },
  };
}

function isCatalogSecretKey(value) {
  if (/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(value)) return true;
  if (value.startsWith('sb_publishable_')) return false;
  const segments = value.split('.');
  if (segments.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

const inputPath = resolve(requiredArgument('--input'));
const sourceRevision = requiredArgument('--source-revision');
const checkpointPath = resolve(
  argument('--checkpoint', `${inputPath}.onskin-import-checkpoint.json`),
);
const artifactUri = argument('--artifact-uri', inputPath);
const batchSize = Number(argument('--batch-size', '250'));
const promote = process.argv.includes('--promote');
const supabaseUrl = process.env.CATALOG_SUPABASE_URL?.trim();
const supabaseSecretKey = process.env.CATALOG_SUPABASE_SECRET_KEY?.trim();

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    'CATALOG_IMPORT_CREDENTIALS_REQUIRED: set CATALOG_SUPABASE_URL and CATALOG_SUPABASE_SECRET_KEY',
  );
}
if (!isCatalogSecretKey(supabaseSecretKey)) {
  throw new Error('CATALOG_IMPORT_SECRET_KEY_REQUIRED');
}

const result = await runCatalogImport({
  adapter: createRpcAdapter(supabaseUrl, supabaseSecretKey),
  artifactUri,
  batchSize,
  checkpointPath,
  inputPath,
  promote,
  sourceRevision,
});

console.log(
  JSON.stringify(
    {
      importId: result.importId,
      status: result.promotion?.status ?? result.status,
      inputSha256: result.inputSha256,
      inputRecords: result.inputRecords,
      acceptedRecords: result.acceptedRecords,
      rejectedRecords: result.rejectedRecords,
      stagedProducts: result.stagedProducts,
      promoted: Boolean(result.promotion),
      alreadyActive: result.alreadyActive,
    },
    null,
    2,
  ),
);
