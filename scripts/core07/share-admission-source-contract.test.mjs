#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  auditCore07aSourceSnapshot,
  CORE07A_SOURCE_PATHS,
  loadCore07aSourceSnapshot,
} from './share-admission-source-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

function mutate(snapshot, path, transform) {
  const before = snapshot[path];
  assert.equal(typeof before, 'string', `${path} must exist in the real snapshot`);
  const after = transform(before);
  assert.notEqual(after, before, `adversarial mutation must change ${path}`);
  return Object.freeze({ ...snapshot, [path]: after });
}

function replaceRequired(source, searchValue, replacement) {
  assert.ok(source.includes(searchValue), `fixture source is missing ${searchValue}`);
  return source.replace(searchValue, replacement);
}

function assertRejected(snapshot, pattern) {
  const errors = auditCore07aSourceSnapshot(snapshot);
  assert.ok(
    errors.some((error) => pattern.test(error)),
    `expected CORE-07A rejection matching ${pattern}; received:\n${errors.join('\n')}`,
  );
}

test('the real CORE-07A source is literal-zero-admission and side-effect free', () => {
  assert.deepEqual(auditCore07aSourceSnapshot(loadCore07aSourceSnapshot(root)), []);
});

test('the audit is deterministic, immutable, and path-sorted', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  const first = auditCore07aSourceSnapshot(snapshot);
  const second = auditCore07aSourceSnapshot(Object.freeze({ ...snapshot }));
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.deepEqual(first, [...first].sort());
});

test('missing mandatory admission, projection, renderer, route, and public HTML sources fail closed', () => {
  const snapshot = { ...loadCore07aSourceSnapshot(root) };
  delete snapshot[CORE07A_SOURCE_PATHS.shareAdmission];
  delete snapshot[CORE07A_SOURCE_PATHS.publicShareHtml];
  const errors = auditCore07aSourceSnapshot(Object.freeze(snapshot));
  assert.ok(
    errors.includes(`${CORE07A_SOURCE_PATHS.shareAdmission}: required CORE-07A source is missing.`),
  );
  assert.ok(
    errors.includes(
      `${CORE07A_SOURCE_PATHS.publicShareHtml}: required CORE-07A source is missing.`,
    ),
  );
});

test('raw DetectedConflict renderer authority is rejected', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.conflictCard,
      (source) => `${source}\ntype DetectedConflict = { readonly rule: unknown };\n`,
    ),
    /renderer must never accept or reference raw DetectedConflict/u,
  );
});

test('share and public-link capabilities cannot be opened by literals or flags', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.shareAdmission, (source) =>
      replaceRequired(
        source,
        'CONFLICT_SHARE_ADMISSION_OPEN = false',
        'CONFLICT_SHARE_ADMISSION_OPEN = true',
      ),
    ),
    /CONFLICT_SHARE_ADMISSION_OPEN must remain the literal false/u,
  );
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.publicLinkAdmission, (source) =>
      replaceRequired(
        source,
        'PUBLIC_CONFLICT_LINK_ADMISSION_OPEN = false',
        'PUBLIC_CONFLICT_LINK_ADMISSION_OPEN = true',
      ),
    ),
    /PUBLIC_CONFLICT_LINK_ADMISSION_OPEN must remain the literal false/u,
  );
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.phase7, (source) =>
      replaceRequired(source, 'shareCard: false', 'shareCard: true'),
    ),
    /phase7Flags\.shareCard must remain the literal false/u,
  );
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.phase8, (source) =>
      replaceRequired(source, 'publicLinks: false', 'publicLinks: true'),
    ),
    /phase8Flags\.publicLinks must remain the literal false/u,
  );
});

test('environment, development, and E2E admission bypasses are rejected', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.shareCard,
      (source) =>
        `${source}\nconst unsafeShareBypass = __DEV__ || process.env.EXPO_PUBLIC_E2E_SHARE_CARD === 'true';\n`,
    ),
    /must not have a flag, environment, development, or fixture bypass/u,
  );
});

test('capture, temporary-file, network, and native-share side effects are rejected', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.shareCard,
      (source) =>
        `import * as FileSystem from 'expo-file-system/legacy';\nimport * as Sharing from 'expo-sharing';\nimport { captureRef } from 'react-native-view-shot';\n${source}\nvoid captureRef; void FileSystem.deleteAsync; void Sharing.shareAsync;\n`,
    ),
    /contains capture, temporary-file, network, link, crypto, or native-share side effects/u,
  );
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.shareCard,
      (source) => `${source}\nasync function unsafeNetwork() { await fetch('/share'); }\n`,
    ),
    /contains capture, temporary-file, network, link, crypto, or native-share side effects/u,
  );
});

test('public-link identifier, crypto, digest, and URL creation side effects are rejected', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.shareLinks,
      (source) =>
        `import * as Crypto from 'expo-crypto';\n${source}\nasync function unsafeLink() { return Crypto.randomUUID(); }\n`,
    ),
    /contains capture, temporary-file, network, link, crypto, or native-share side effects/u,
  );
});

test('projection fields are an exact public allowlist and private aliases are rejected', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.shareProjection, (source) => {
      if (source.includes('export type ConflictShareProjection = Readonly<{')) {
        return source.replace(
          'export type ConflictShareProjection = Readonly<{',
          'export type ConflictShareProjection = Readonly<{ readonly productName: string;',
        );
      }
      return replaceRequired(
        source,
        'export interface ConflictShareProjection {',
        'export interface ConflictShareProjection { readonly productName: string;',
      );
    }),
    /must expose exactly|contains a private Shelf, health, rule, product, account, or token field/u,
  );
});

test('record-implying native and static public copy is rejected', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.publicRoute,
      (source) => `${source}\nconst unsafeRecordCopy = 'This shared card record is ready.';\n`,
    ),
    /must not imply a shared, reviewed, or per-user record/u,
  );
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.publicShareHtml, (source) =>
      source.replace('</body>', '<p>This reviewed product check is ready.</p></body>'),
    ),
    /must not imply a shared, reviewed, or per-user record/u,
  );
});

test('public-link analytics, token parsing, beacons, and destinations are rejected', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.publicRoute,
      (source) =>
        `${source}\nfunction track(event: string) { return event; }\ntrack('landing_viewed');\n`,
    ),
    /must not parse tokens, navigate, or emit analytics through track|must not emit public-link analytics/u,
  );
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.publicShareHtml, (source) =>
      source.replace(
        '</body>',
        "<script>navigator.sendBeacon('/api/growth-event', 'landing_viewed')</script></body>",
      ),
    ),
    /must not contain navigation, form, script, or destination side effects|must not parse tokens, send network data/u,
  );
});

test('future receipt, confirmation, and public-link authority types remain issuerless', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.shareAdmission,
      (source) =>
        `${source}\nexport function issueConflictShareReceipt(): never { throw new Error('unsafe'); }\n`,
    ),
    /future authority schemas must remain issuerless/u,
  );
  assertRejected(
    mutate(
      snapshot,
      CORE07A_SOURCE_PATHS.publicLinkAdmission,
      (source) =>
        `${source}\nexport function mintPublicLinkAuthority(): never { throw new Error('unsafe'); }\n`,
    ),
    /future authority schemas must remain issuerless/u,
  );
});

test('future authority schemas cannot drift review roles or exact confirmation literals', () => {
  const snapshot = loadCore07aSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.shareAdmission, (source) =>
      replaceRequired(source, "'release_signoff_operator'", "'founder'"),
    ),
    /must remain the exact six-role launch review union/u,
  );
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.shareAdmission, (source) =>
      replaceRequired(source, 'publicLinkIncluded: false', 'publicLinkIncluded: boolean'),
    ),
    /publicLinkIncluded must remain the exact literal false/u,
  );
  assertRejected(
    mutate(snapshot, CORE07A_SOURCE_PATHS.shareAdmission, (source) =>
      replaceRequired(source, 'confirmed: true', 'confirmed: boolean'),
    ),
    /confirmed must remain the exact literal true/u,
  );
});

test('CORE-07A enforcement is mandatory in every bound phase and launch verification', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(
    packageJson.scripts['core07:share-admission-source-contract:test'],
    'node --test scripts/core07/share-admission-source-contract.test.mjs',
  );
  for (const parentScript of [
    'phase3:verify',
    'phase7:verify',
    'phase8:verify',
    'phase9:verify',
    'launch:verify',
  ]) {
    const commands = String(packageJson.scripts[parentScript] ?? '').split(' && ');
    assert.ok(
      commands.includes('npm run core07:share-admission-source-contract:test'),
      `${parentScript} must run the CORE-07A contract as a blocking gate`,
    );
  }

  for (const path of [
    'scripts/phase7/check-core-loop.mjs',
    'scripts/phase8/check-growth-store-readiness.mjs',
  ]) {
    const source = read(path);
    assert.match(source, /auditCore07aShareAdmission/u, `${path} must run the CORE-07A audit`);
  }
  for (const path of [
    'scripts/phase7/check-core-loop-smoke.mjs',
    'scripts/phase8/check-growth-store-smoke.mjs',
  ]) {
    const source = read(path);
    assert.match(
      source,
      /share-admission-source-contract\.test\.mjs/u,
      `${path} must execute the CORE-07A adversarial contract`,
    );
  }
});
