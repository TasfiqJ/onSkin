import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function invariant(condition, message) {
  if (!condition) throw new Error(`PHOTO01_SOURCE_CONTRACT_FAILED: ${message}`);
}

function ordered(source, fragments, label) {
  let cursor = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, cursor + 1);
    invariant(next > cursor, `${label}: missing or out-of-order ${JSON.stringify(fragment)}`);
    cursor = next;
  }
}

export function auditPhoto01Sources(sources = {}) {
  const encrypted =
    sources.encrypted ?? read('apps/mobile/src/features/photos/encryptedStorage.ts');
  const thumbnail = sources.thumbnail ?? read('apps/mobile/src/features/photos/photoThumbnail.ts');
  const store = sources.store ?? read('apps/mobile/src/features/photos/store.ts');
  const progress = sources.progress ?? read('apps/mobile/src/app/(tabs)/progress.tsx');
  const localExport =
    sources.localExport ?? read('apps/mobile/src/features/settings/localDeviceExport.ts');

  invariant(
    encrypted.includes(
      "PHOTO_RENDITION_ENCRYPTION_VERSION = 'xchacha20poly1305:photo-rendition:v1'",
    ),
    'renditions need a distinct versioned envelope',
  );
  for (const field of ['photoId', 'captureSessionId', 'rendition']) {
    invariant(encrypted.includes(`${field}:`), `rendition identity must bind ${field}`);
  }
  invariant(
    encrypted.includes('renditionAssociatedData(envelopeIdentity)'),
    'publication identity must be authenticated AEAD associated data',
  );
  invariant(
    encrypted.includes('canonicalPhotoRenditionUri(identity)') &&
      encrypted.includes('ownedEncryptedPhotoUri'),
    'renditions need canonical owned direct-child paths',
  );

  ordered(
    thumbnail,
    [
      'handle = await deps.reserve()',
      'await deps.runGenerated',
      'await deps.manipulate(input.sourceUri)',
      'await deps.move',
      'await deps.markWritten(handle)',
      'encrypted = await deps.encrypt',
      'await deps.cleanup(handle)',
    ],
    'thumbnail plaintext ownership',
  );
  invariant(
    thumbnail.includes('resize: { width: THUMBNAIL_WIDTH }') &&
      thumbnail.includes('format: SaveFormat.JPEG'),
    'thumbnail must be a bounded JPEG derivative',
  );
  invariant(
    thumbnail.includes("reservePlaintextStaging('photo_thumbnail_jpeg')"),
    'thumbnail manipulation must have a dedicated journal purpose',
  );
  invariant(
    !/(fetch\s*\(|XMLHttpRequest|supabase|axios|FormData|WebSocket)/u.test(thumbnail),
    'thumbnail path must have no network/cloud capability',
  );

  const addStart = store.indexOf('export async function addPhotoWithOutcome');
  const addEnd = store.indexOf('export async function addPhoto(', addStart);
  invariant(addStart >= 0 && addEnd > addStart, 'add-photo publication boundary missing');
  const add = store.slice(addStart, addEnd);
  ordered(
    add,
    [
      'beginPhotoRenditionPublication',
      "rendition: 'original'",
      'createEncryptedPhotoThumbnail',
      'thumbnailLocalUri: thumbnail?.encryptedLocalUri ?? null',
      'await persist([rec, ...items], lease)',
      'await deleteCapturedPhotoSource(input.localUri)',
    ],
    'atomic logical publication',
  );
  invariant(!add.includes('supabase.'), 'local photo publication must not access cloud storage');
  invariant(
    add.includes("markPhotoRenditionPublication(publicationIdentity, 'metadata_committed')") &&
      add.includes('settlePhotoRenditionPublication(publicationIdentity)'),
    'publication journal must survive through metadata, raw cleanup, and settlement',
  );
  invariant(
    encrypted.includes('hasExactKeys(record') &&
      encrypted.includes('assertExpectedRendition(encryptedLocalUri, envelope, expected)'),
    'new envelopes need exact-key parsing and expected-identity consumption binding',
  );
  invariant(
    store.includes('[target.encryptedLocalUri ?? target.localUri, target.thumbnailLocalUri]'),
    'deletion must quarantine both renditions',
  );
  invariant(
    store.includes('[photo.encryptedLocalUri ?? photo.localUri, photo.thumbnailLocalUri]'),
    'reconciliation must bind both renditions to metadata',
  );
  invariant(
    progress.includes('uri={photo.thumbnailLocalUri ?? photo.localUri}'),
    'timeline must demand the encrypted thumbnail when present',
  );
  invariant(
    localExport.includes("'thumbnailLocalUri'") && localExport.includes("'encryptedLocalUri'"),
    'data export must strip rendition paths',
  );

  return Object.freeze({ checks: 18, status: 'pass' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditPhoto01Sources();
  process.stdout.write(`PHOTO-01 source contract: ${result.checks}/${result.checks} passed\n`);
}
