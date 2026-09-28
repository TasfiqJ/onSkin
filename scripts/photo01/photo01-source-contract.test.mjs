import assert from 'node:assert/strict';
import test from 'node:test';

import { auditPhoto01Sources } from './photo01-source-contract.mjs';

test('the repository satisfies the aggregate PHOTO-01 source contract', () => {
  assert.deepEqual(auditPhoto01Sources(), { checks: 18, status: 'pass' });
});

test('the contract rejects thumbnail network capability', () => {
  assert.throws(
    () =>
      auditPhoto01Sources({
        thumbnail: `${source('thumbnail')}\nfetch('https://example.invalid/upload')`,
      }),
    /no network\/cloud capability/u,
  );
});

test('the contract rejects raw deletion before metadata publication', () => {
  const store = source('store');
  const persist = 'await persist([rec, ...items], lease)';
  const cleanup = 'await deleteCapturedPhotoSource(input.localUri)';
  assert.throws(
    () =>
      auditPhoto01Sources({
        store: store.replace(persist, cleanup).replace(cleanup, persist),
      }),
    /atomic logical publication/u,
  );
});

test('the contract rejects omission of thumbnail deletion', () => {
  assert.throws(
    () =>
      auditPhoto01Sources({
        store: source('store').replace(
          '[target.encryptedLocalUri ?? target.localUri, target.thumbnailLocalUri]',
          '[target.encryptedLocalUri ?? target.localUri]',
        ),
      }),
    /deletion must quarantine both renditions/u,
  );
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = {
  thumbnail: 'apps/mobile/src/features/photos/photoThumbnail.ts',
  store: 'apps/mobile/src/features/photos/store.ts',
};

function source(name) {
  return fs.readFileSync(path.join(ROOT, FILES[name]), 'utf8').replace(/\r\n/g, '\n');
}
