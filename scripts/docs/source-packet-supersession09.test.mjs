// Actual producer CLI, small disposable source fixtures; never a full-checkout proof.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const producer = join(root, 'scripts/docs/source-packet-audit.mjs');
const manifestPath = 'docs/release/full-app-j01/source-packet-supersession09.v1.json';
const authority = JSON.parse(readFileSync(join(root, manifestPath)));
const jsonPath = 'docs/generated/source-packet-audit.json';
const mdPath = 'docs/generated/source-packet-audit.md';
const scratch = mkdtempSync(join(tmpdir(), 'onskin-source09-'));
const fixture = join(scratch, 'source');
const originals = new Map();
let rejected = 0;
const notRun = [];
function put(path, raw) {
  mkdirSync(dirname(join(fixture, path)), { recursive: true });
  writeFileSync(join(fixture, path), raw);
}
function run(name, expectedExit, args = ['--strict', '--check'], env = {}) {
  const argv = [producer, ...args];
  const result = spawnSync(process.execPath, argv, {
    cwd: fixture, encoding: 'utf8', env: { ...process.env,
      SOURCE_PACKET_AUDIT_JSON: jsonPath, SOURCE_PACKET_AUDIT_MD: mdPath, ...env },
  });
  console.log(JSON.stringify({ case: name, argv: [process.execPath, ...argv], cwd: fixture,
    exit: result.status, expectedExit, stdout: result.stdout, stderr: result.stderr }));
  assert.equal(result.error, undefined);
  assert.equal(result.status, expectedExit, name);
  if (expectedExit === 1) rejected++;
  return result;
}
function restore() {
  for (const [path, raw] of originals) put(path, raw);
}
function changed(name, path, raw, generate = true) {
  put(path, raw);
  try { run(name, 1, generate ? ['--strict'] : ['--strict', '--check']); }
  finally { restore(); }
  run(name + '-restored', 0);
}
try {
  const paths = new Set(['AGENTS.md', 'CLAUDE.md', manifestPath, jsonPath, mdPath,
    ...authority.originalPacketFiles.map((row) => row.path),
    ...authority.originalPacketFiles.filter((row) => row.path.startsWith('04_repo_docs/docs/'))
      .map((row) => row.path.slice('04_repo_docs/'.length))]);
  for (const path of paths) {
    const raw = readFileSync(join(root, path)); originals.set(path, raw); put(path, raw);
  }
  run('authentic-current', 0);
  const audit = JSON.parse(originals.get(jsonPath));
  assert.equal(audit.summary.authorizedSupersessionCount, 5);
  assert.equal(audit.summary.identicalMirrorCount, audit.summary.sourceDocCount - 5);
  assert.equal(audit.summary.totalPacketFileCount, authority.originalPacketFiles.length);
  assert.equal(audit.status, 'pass');
  assert.equal(audit.strict, true);
  assert.equal(audit.authorizedSupersession.legacyCutover, 'NOT_DONE');
  for (const row of authority.supersessions) {
    const doc = audit.docs.find((d) => d.activePath === row.activePath);
    assert.equal(doc.identical, false); assert.equal(doc.authorizedSupersession, true);
    changed('remove-notice-' + row.activePath, row.activePath, originals.get(row.sourcePath));
  }
  const row = authority.supersessions[0];
  const original = originals.get(row.activePath);
  const insert = Buffer.from(authority.insertBase64, 'base64');
  changed('duplicate-notice', row.activePath, Buffer.concat([
    original.subarray(0, row.insertOffset), insert, original.subarray(row.insertOffset)]));
  changed('changed-claim', row.activePath,
    Buffer.from(original.toString('utf8').replace('No release date', 'Approved release date')));
  changed('wrong-authority', row.activePath,
    Buffer.from(original.toString('utf8').replace(authority.noticeAuthorization, 'FORGED-AUTHORITY')));
  changed('body-insert-outside-notice', row.activePath, Buffer.concat([original, Buffer.from('\nAlien body\n')]));
  changed('unexpected-heading', row.activePath, Buffer.concat([original, Buffer.from('\n## Unapproved scope\n')]));
  const swapped = Buffer.from(insert); [swapped[20], swapped[21]] = [swapped[21], swapped[20]];
  changed('notice-byte-order', row.activePath, Buffer.concat([
    original.subarray(0, row.insertOffset), swapped, original.subarray(row.insertOffset + insert.length)]));
  changed('notice-crlf-encoding', row.activePath, Buffer.concat([
    original.subarray(0, row.insertOffset), Buffer.from(insert.toString('utf8').replaceAll('\n', '\r\n')),
    original.subarray(row.insertOffset + insert.length)]));
  changed('utf8-bom', row.activePath, Buffer.concat([Buffer.from([239, 187, 191]), original]));
  unlinkSync(join(fixture, row.sourcePath));
  try { run('drop-original-doc', 1, ['--strict']); } finally { restore(); }
  run('drop-original-doc-restored', 0);
  changed('mutate-original-doc', row.sourcePath, Buffer.concat([originals.get(row.sourcePath), Buffer.from('\n')]));
  changed('mutate-original-top-level', '04_repo_docs/README.md', Buffer.from('forged original\n'));
  const sixth = audit.docs.find((doc) => doc.identical);
  changed('unauthorized-sixth-mirror', sixth.activePath,
    Buffer.concat([originals.get(sixth.activePath), Buffer.from('\nSixth notice\n')]));
  for (const name of ['UNEXPECTED.md', 'unexpected.bin']) {
    put('04_repo_docs/' + name, 'unexpected');
    try { run('unexpected-packet-file-' + name, 1, ['--strict']); }
    finally { unlinkSync(join(fixture, '04_repo_docs', name)); restore(); }
    run('unexpected-packet-file-restored-' + name, 0);
  }
  for (const path of [jsonPath, mdPath]) changed('corrupt-projection-' + path, path, Buffer.from('corrupt\n'), false);
  changed('duplicate-generated-json-key', jsonPath,
    Buffer.from(originals.get(jsonPath).toString('utf8').replace('"status": "pass",', '"status": "blocked",\n  "status": "pass",')), false);
  const forged = JSON.parse(originals.get(manifestPath));
  forged.supersessions.push({ ...row, activePath: sixth.activePath });
  changed('forged-sixth-supersession-row', manifestPath, Buffer.from(JSON.stringify(forged)));
  forged.supersessions[0].activePath = '../escape';
  changed('manifest-traversal-row', manifestPath, Buffer.from(JSON.stringify(forged)));
  changed('malformed-manifest', manifestPath, Buffer.from('{'));
  changed('duplicate-manifest-key', manifestPath, Buffer.from('{"schemaVersion":1,"schemaVersion":1}'));
  unlinkSync(join(fixture, manifestPath));
  try { run('missing-manifest', 1, ['--strict']); } finally { restore(); }
  run('missing-manifest-restored', 0);
  run('output-traversal', 1, ['--strict'], { SOURCE_PACKET_AUDIT_JSON: '../escape.json' });
  assert.equal(existsSync(join(scratch, 'escape.json')), false);
  restore(); run('output-traversal-restored', 0);
  run('output-overwrites-input', 1, ['--strict'], { SOURCE_PACKET_AUDIT_JSON: row.activePath });
  assert.deepEqual(readFileSync(join(fixture, row.activePath)), original);
  run('output-overwrites-input-restored', 0);
  // Check every link operation separately; unavailable Windows file symlinks are NOT_RUN.
  for (const [name, path, directory] of [
    ['original-file-symlink', row.sourcePath, false],
    ['active-file-symlink', row.activePath, false],
    ['manifest-symlink', manifestPath, false],
    ['output-symlink', jsonPath, false],
    ['original-directory-junction', '04_repo_docs/docs', true],
  ]) {
    const actual = join(fixture, path), saved = join(scratch, name);
    renameSync(actual, saved);
    let linked = false;
    try {
      try { symlinkSync(saved, actual, directory ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file'); linked = true; }
      catch (error) {
        if (!['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) throw error;
        notRun.push({ case: name, status: 'NOT_RUN', reason: error.code, platform: process.platform });
        console.log(JSON.stringify(notRun.at(-1)));
      }
      if (linked) { assert.equal(lstatSync(actual).isSymbolicLink(), true); run(name, 1, ['--strict']); }
    } finally {
      if (linked) unlinkSync(actual);
      renameSync(saved, actual); restore();
    }
    run(name + '-restored', 0);
  }
  if (process.platform === 'win32') {
    notRun.push({ case: 'case-colliding-packet-names', status: 'NOT_RUN', reason: 'Case-insensitive host cannot hold both regular names' });
    console.log(JSON.stringify(notRun.at(-1)));
  } else {
    put('04_repo_docs/readme.md', 'collision');
    try { run('case-colliding-packet-names', 1); }
    finally { unlinkSync(join(fixture, '04_repo_docs/readme.md')); restore(); }
  }
  // Projection comparison ignores only the existing timestamp and Markdown CRLF policy.
  const json = JSON.parse(originals.get(jsonPath)); json.generatedAt = 'NORMALIZED_TIMESTAMP';
  put(jsonPath, JSON.stringify(json, null, 2));
  put(mdPath, originals.get(mdPath).toString('utf8').replace(/^Generated: .+$/m, 'Generated: NORMALIZED_TIMESTAMP').replaceAll('\n', '\r\n'));
  run('normalized-projections', 0);
  restore();
  run('nonstrict-authentic-generation', 0, []);
  restore();
  run('authentic-restored', 0);
  console.log(JSON.stringify({ passed: true, rejected, notRun,
    currentExit: 0, tamperedExit: 1, restoredExit: 0,
    qualification: 'DISPOSABLE_SOURCE_FIXTURES_NOT_INDEPENDENT_COMPLETE_CHECKOUT' }));
} finally {
  // Only this process's freshly created scratch directory is removed.
  rmSync(scratch, { recursive: true, force: true });
}
