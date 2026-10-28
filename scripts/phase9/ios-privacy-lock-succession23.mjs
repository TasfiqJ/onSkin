import { createHash } from 'node:crypto';
import { lstatSync, opendirSync } from 'node:fs';

export const IOS_PRIVACY_LOCK_SUCCESSION23_PATH = 'docs/phase-9/ios-sdk-lock-succession23.v1.json';
export const LOCK_SUCCESSION23_SHA256 = '47392eb02fbb42e981020c30efb253f1df2f2ad7601cbdaf072f0f2e1003244b';
export const CURRENT_LOCK23_SHA256 = '1485297ffa6cc20367a5f2fda35bc33e12dc11ef422c813f5f28a4e339cb3b95';
const HISTORICAL_LOCK_SHA256 = '7656c2e6bf482df5a9bc94c9789816a40c5f2b5cfb30e2f10748411229c136cb';
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// Every entry is enumerated and read; the pinned tree denominator also rejects
// omitted/missing content that two identical walks alone could not establish.
export function nativeTree23(root, path, { checkedPath, readBoundedFile, reject }) {
  const rows = [];
  const aliases = new Set();
  let files = 0;
  let directories = 0;
  let bytes = 0;
  let enumeratedEntries = 0;
  const visit = (name, depth) => {
    if (depth > 40 || rows.length >= 20000) reject('Native source tree exceeds its bounds.');
    const entry = checkedPath(root, name);
    const key = name.normalize('NFKC').toLowerCase();
    if (aliases.has(key)) reject('Native source tree contains an alias.');
    aliases.add(key);
    const before = lstatSync(entry.absolute, { bigint: true });
    if (before.isDirectory()) {
      rows.push({ path: name, kind: 'directory' });
      directories += 1;
      const children = [];
      const directory = opendirSync(entry.absolute);
      try {
        for (let child; (child = directory.readSync()) !== null;) {
          enumeratedEntries += 1;
          // Include the tree root in the same 20,000-entry ceiling, and stop
          // enumeration before allocating an unbounded child-name list.
          if (enumeratedEntries >= 20000) reject('Native source tree exceeds its bounds.');
          children.push(child.name);
        }
      } finally {
        directory.closeSync();
      }
      for (const child of children.sort()) {
        if (!child || /[\\/\x00-\x1f:]/.test(child) || child.endsWith('.') || child.endsWith(' ')) {
          reject('Native source tree has an unsafe entry name.');
        }
        visit(`${name}/${child}`, depth + 1);
      }
    } else if (before.isFile()) {
      const file = readBoundedFile(root, name, 16 * 1024 * 1024);
      bytes += file.bytes.length;
      if (bytes > 128 * 1024 * 1024) reject('Native source tree exceeds its byte bound.');
      rows.push({ path: name, kind: 'file', bytes: file.bytes.length, sha256: file.sha256 });
      files += 1;
    } else reject('Native source tree contains a nonregular entry.');
    const after = lstatSync(entry.absolute, { bigint: true });
    if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].some((key) => before[key] !== after[key])) {
      reject('Native source tree changed while being read.');
    }
  };
  visit(path, 0);
  return { path, files, directories, bytes, sha256: sha256(jsonBytes(rows)) };
}

export function lockSuccession23({ mapping, mappingFile, lock, lockFile, root,
  readJson, readBoundedFile, checkedPath, historicalCheck, fail }) {
  const reject = (message) => fail('LOCK_SUCCESSION23_IDENTITY', message, IOS_PRIVACY_LOCK_SUCCESSION23_PATH);
  const file = readJson(root, IOS_PRIVACY_LOCK_SUCCESSION23_PATH, 4 * 1024 * 1024);
  const witness = file.value;
  if (file.sha256 !== LOCK_SUCCESSION23_SHA256) reject('Current source witness bytes drifted.');
  if (witness.schemaVersion !== 1 || witness.kind !== 'ios_privacy_lock_succession23_source_only' ||
      witness.authority !== 'BRAIN-M1X-SECURITY-INTEGRATION23-REPAIR-01' ||
      witness.base.commit !== '34fac69f3ba527724ecdf2d1cef69f27372756ad' ||
      witness.base.tree !== '832baeae6421bfaa6fb668b025932d2c49a4f33c' ||
      witness.historicalLock.sha256 !== HISTORICAL_LOCK_SHA256 ||
      witness.candidateLock.sha256 !== CURRENT_LOCK23_SHA256 ||
      lockFile.sha256 !== CURRENT_LOCK23_SHA256 || lockFile.bytes.length !== witness.candidateLock.bytes ||
      !same(witness.changedNodes, ['', 'node_modules/node-forge'])) {
    reject('Current complete-lock/source identity is not the declared successor.');
  }
  const historical = JSON.parse(lockFile.bytes.toString('utf8'));
  for (const path of witness.changedNodes) {
    if (!same(lock.packages[path], witness.candidateNodes[path])) reject('Declared dependency delta drifted.');
    historical.packages[path] = witness.originalNodes[path];
  }
  const historicalBytes = jsonBytes(historical);
  if (sha256(historicalBytes) !== HISTORICAL_LOCK_SHA256 || historicalBytes.length !== witness.historicalLock.bytes) {
    reject('Reversing exactly the two declared nodes did not reproduce the complete historical lock.');
  }
  for (const [path, node] of Object.entries(witness.unchangedNativeNodes)) {
    if (!same(lock.packages[path], node)) reject('A relevant native lock record changed.');
  }
  for (const pin of [...witness.immutableInputs, ...witness.sourcePins,
    ...witness.mandatoryPatchInputs, witness.mobilePackage]) {
    const actual = readBoundedFile(root, pin.path, 4 * 1024 * 1024);
    if (actual.sha256 !== pin.sha256 || actual.bytes.length !== pin.bytes) reject('Pinned native source input drifted.');
  }
  for (const expected of witness.installedNativeTrees) {
    const actual = nativeTree23(root, expected.path, { checkedPath, readBoundedFile, reject });
    if (!same(actual, expected)) reject('Installed native source inventory differs from its exact pinned denominator.');
  }
  if (witness.claims.sourceOnly !== true || witness.claims.archiveRequired !== true ||
      Object.entries(witness.claims).some(([key, value]) => !['sourceOnly', 'archiveRequired'].includes(key) && value !== false) ||
      Object.values(witness.admissions).some((value) => value !== false) ||
      witness.gates.G97 !== 'FAIL/NO_GO' || witness.gates.M1_03 !== 'BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED' ||
      witness.gates.M2 !== 'NOT_AUTHORIZED' || witness.spendUsd !== 0) reject('Source-only false-admission boundary drifted.');
  // The original validator definition and its exact eight-node/provenance rules
  // remain unchanged. It receives only the independently reconstructed PR25 lock.
  historicalCheck({ mapping, mappingFile, root, lock: historical,
    lockFile: { ...lockFile, bytes: historicalBytes, sha256: HISTORICAL_LOCK_SHA256 } });
  return { ...file, kind: 'succession23' };
}

export function checkCurrentAuditSnapshot23(report, witnessBytes) {
  if (!Buffer.isBuffer(witnessBytes) || sha256(witnessBytes) !== LOCK_SUCCESSION23_SHA256) {
    throw new Error('CURRENT_NATIVE_SOURCE23_WITNESS_DRIFT');
  }
  const witness = JSON.parse(witnessBytes.toString('utf8'));
  if (!report.inputs?.lockSuccession23 || report.status !== 'archive_required' || report.errors.length !== 0) {
    throw new Error('CURRENT_NATIVE_SOURCE23_INVALID');
  }
  const snapshot = structuredClone(report);
  delete snapshot.inputs.lockSuccession23;
  if (witness.currentAuditSnapshot.hashDomain !== 'canonicalAuditJson(report) with only inputs.lockSuccession23 omitted' ||
      sha256(jsonBytes(snapshot)) !== witness.currentAuditSnapshot.sha256) {
    throw new Error('CURRENT_NATIVE_SOURCE23_SNAPSHOT_DRIFT');
  }
  return true;
}
