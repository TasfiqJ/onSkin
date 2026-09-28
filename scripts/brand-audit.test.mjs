import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_LEGACY_COMPATIBILITY_MANIFEST,
  LEGACY_COMPATIBILITY_NOTICE,
  auditBrandIdentity,
  auditShouldFail,
} from './brand-audit-lib.mjs';

const DEFAULT_SOURCE_PATH = 'supabase/functions/example.ts';
const REVIEWED_LITERAL = "'onskin-reviewed-domain:v1:'";

function entry(overrides = {}) {
  return {
    path: DEFAULT_SOURCE_PATH,
    literal: REVIEWED_LITERAL,
    expectedCount: 1,
    subtype: 'cryptographic-domain-separation',
    rationale: 'This exact test domain represents a persisted compatibility contract.',
    ...overrides,
  };
}

async function writeFixtureFile(root, relPath, content) {
  const filePath = path.join(root, ...relPath.split('/'));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function fixture(t, { sourcePath = DEFAULT_SOURCE_PATH, source, entries, manifest = true }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brand-audit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixtureFile(root, sourcePath, source);
  if (manifest) {
    await writeFixtureFile(
      root,
      DEFAULT_LEGACY_COMPATIBILITY_MANIFEST,
      `${JSON.stringify({ schemaVersion: 1, notice: LEGACY_COMPATIBILITY_NOTICE, entries }, null, 2)}\n`,
    );
  }
  return { root, sourcePath };
}

async function runFixture(root, target) {
  return auditBrandIdentity({ repoRoot: root, targets: [target] });
}

test('exact reviewed path + literal + count passes strict audit', async (t) => {
  const { root } = await fixture(t, {
    source: `export const domain = ${REVIEWED_LITERAL};\n`,
    entries: [entry()],
  });
  const result = await runFixture(root, 'supabase');

  assert.deepEqual(result.manifest.errors, []);
  assert.equal(result.legacyCompatibilityCount, 1);
  assert.equal(result.reviewNeededCount, 0);
  assert.equal(result.publicRiskCount, 0);
  assert.equal(auditShouldFail(result, true), false);
});

test('a new unclassified legacy hit on the reviewed line still fails strict audit', async (t) => {
  const { root } = await fixture(t, {
    source: `export const domains = [${REVIEWED_LITERAL}, 'onskin-new-domain:v1:'];\n`,
    entries: [entry()],
  });
  const result = await runFixture(root, 'supabase');

  assert.deepEqual(result.manifest.errors, []);
  assert.equal(result.legacyCompatibilityCount, 1);
  assert.equal(result.reviewNeededCount, 1);
  assert.equal(auditShouldFail(result, true), true);
});

test('a drifted reviewed literal fails both manifest validation and strict audit', async (t) => {
  const { root } = await fixture(t, {
    source: "export const domain = 'onskin-reviewed-domain:v2:';\n",
    entries: [entry()],
  });
  const result = await runFixture(root, 'supabase');

  assert.equal(result.manifest.errors.length, 1);
  assert.match(result.manifest.errors[0], /expected 1 exact occurrence\(s\).*found 0/);
  assert.equal(result.reviewNeededCount, 1);
  assert.equal(auditShouldFail(result, true), true);
});

test('a stale manifest entry fails even when no legacy source hit remains', async (t) => {
  const { root } = await fixture(t, {
    source: "export const domain = 'layerwell-reviewed-domain:v1:';\n",
    entries: [entry()],
  });
  const result = await runFixture(root, 'supabase');

  assert.equal(result.manifest.errors.length, 1);
  assert.equal(result.findings.length, 0);
  assert.equal(auditShouldFail(result, false), true);
});

test('duplicate manifest entries fail closed', async (t) => {
  const duplicate = entry();
  const { root } = await fixture(t, {
    source: `export const domain = ${REVIEWED_LITERAL};\n`,
    entries: [entry(), duplicate],
  });
  const result = await runFixture(root, 'supabase');

  assert.equal(result.manifest.errors.length, 1);
  assert.match(result.manifest.errors[0], /duplicates an earlier path \+ literal entry/);
  assert.equal(auditShouldFail(result, false), true);
});

test('source count mismatch fails closed', async (t) => {
  const { root } = await fixture(t, {
    source: `export const first = ${REVIEWED_LITERAL};\nexport const second = ${REVIEWED_LITERAL};\n`,
    entries: [entry()],
  });
  const result = await runFixture(root, 'supabase');

  assert.equal(result.manifest.errors.length, 1);
  assert.match(result.manifest.errors[0], /expected 1 exact occurrence\(s\).*found 2/);
  assert.equal(result.reviewNeededCount, 2);
  assert.equal(auditShouldFail(result, true), true);
});

test('public asset risk cannot be compatibility-allowlisted', async (t) => {
  const sourcePath = 'apps/mobile/src/brand.ts';
  const { root } = await fixture(t, {
    sourcePath,
    source: "export const displayName = 'OnSkin-public:v1:';\n",
    entries: [entry({ path: sourcePath, literal: "'OnSkin-public:v1:'" })],
  });
  const result = await runFixture(root, 'apps/mobile');

  assert.equal(result.manifest.errors.length, 1);
  assert.match(result.manifest.errors[0], /public asset and cannot be compatibility-allowlisted/);
  assert.equal(result.publicRiskCount, 1);
  assert.equal(result.legacyCompatibilityCount, 0);
  assert.equal(auditShouldFail(result, true), true);
});

test('missing compatibility manifest fails closed', async (t) => {
  const { root } = await fixture(t, {
    source: "export const domain = 'layerwell-reviewed-domain:v1:';\n",
    entries: [],
    manifest: false,
  });
  const result = await runFixture(root, 'supabase');

  assert.equal(result.manifest.errors.length, 1);
  assert.match(result.manifest.errors[0], /Cannot read and parse/);
  assert.equal(auditShouldFail(result, false), true);
});
