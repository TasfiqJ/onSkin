import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REVIEWED_ADVISORIES = Object.freeze([
  Object.freeze({ package: 'braces', version: '3.0.3', advisory: 'GHSA-vfj7-8cjw-p6xm' }),
  Object.freeze({ package: 'node-forge', version: '1.4.0', advisory: 'GHSA-86w9-cpqp-85rv' }),
]);

const POLICY_PATH = 'docs/phase-9/security-advisory-exceptions.json';
const LOCK_PATH = 'package-lock.json';
const EVIDENCE_DIR = 'docs/phase-9/generated/ci-scanner-evidence';
const GHSA = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keyOf(value) {
  return `${value.package}@${value.version}:${value.advisory}`;
}

function policyErrors(policy, today) {
  const errors = [];
  if (!isRecord(policy) || policy.schemaVersion !== 1 || !Array.isArray(policy.exceptions)) {
    return ['security exception policy is malformed'];
  }
  const expected = new Set(REVIEWED_ADVISORIES.map(keyOf));
  if (policy.exceptions.length !== expected.size) {
    errors.push('security exception policy must contain exactly the two reviewed entries');
  }
  for (const entry of policy.exceptions) {
    if (!isRecord(entry) || !expected.delete(keyOf(entry))) {
      errors.push('security exception identity is not reviewed');
      continue;
    }
    for (const field of ['rationale', 'scope', 'reviewCondition']) {
      if (typeof entry[field] !== 'string' || entry[field].trim().length < 20) {
        errors.push(`${entry.package}: ${field} is missing or too short`);
      }
    }
    if (!/tooling|development|CI/iu.test(entry.scope)) {
      errors.push(`${entry.package}: tooling/dev scope is missing`);
    }
    if (
      !DATE.test(entry.reviewedOn) ||
      !DATE.test(entry.expiresOn) ||
      Number.isNaN(Date.parse(`${entry.reviewedOn}T00:00:00Z`)) ||
      Number.isNaN(Date.parse(`${entry.expiresOn}T00:00:00Z`)) ||
      entry.reviewedOn > entry.expiresOn ||
      today > entry.expiresOn
    ) {
      errors.push(`${entry.package}: review is expired or dates are invalid`);
    }
  }
  if (expected.size > 0) errors.push('security exception policy is missing reviewed identities');
  return errors;
}

function lockErrors(lock) {
  const errors = [];
  if (!isRecord(lock?.packages)) return ['package lock has no package inventory'];
  for (const entry of REVIEWED_ADVISORIES) {
    const paths = Object.entries(lock.packages).filter(
      ([path]) =>
        path.endsWith(`/node_modules/${entry.package}`) || path === `node_modules/${entry.package}`,
    );
    if (paths.length === 0 || paths.some(([, value]) => value?.version !== entry.version)) {
      errors.push(`${entry.package}: installed version or package path changed`);
    }
  }
  return errors;
}

function advisoryId(value) {
  if (!isRecord(value) || typeof value.url !== 'string') return null;
  const id = value.url.split('/').at(-1);
  return GHSA.test(id) ? id : null;
}

export function validateNpmAudit({ report, lock, policy, scannerExitCode, today }) {
  const errors = [...policyErrors(policy, today), ...lockErrors(lock)];
  if (!isRecord(report?.vulnerabilities) || !isRecord(report?.metadata?.vulnerabilities)) {
    return [...errors, 'npm audit report is missing vulnerability metadata'];
  }
  const high = Number(report.metadata.vulnerabilities.high);
  const critical = Number(report.metadata.vulnerabilities.critical);
  const records = Object.values(report.vulnerabilities).filter((item) =>
    ['high', 'critical'].includes(item?.severity),
  );
  if (
    !Number.isSafeInteger(high) ||
    !Number.isSafeInteger(critical) ||
    high < 0 ||
    critical < 0 ||
    high + critical !== records.length
  ) {
    errors.push('npm audit high/critical counts do not match the report');
  }
  if (scannerExitCode !== (records.length > 0 ? 1 : 0)) {
    errors.push('npm audit exit code is inconsistent with the report');
  }
  const approved = new Set(REVIEWED_ADVISORIES.map(keyOf));
  const observed = new Set();
  function roots(name) {
    const pending = [name];
    const visited = new Set();
    const result = new Set();
    while (pending.length > 0) {
      const current = pending.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      const finding = report.vulnerabilities[current];
      if (!isRecord(finding) || !Array.isArray(finding.via) || !Array.isArray(finding.nodes)) {
        throw new Error(`npm audit finding is malformed: ${current}`);
      }
      for (const via of finding.via) {
        if (typeof via === 'string') {
          pending.push(via);
          continue;
        }
        const id = advisoryId(via);
        if (!id || via.name !== current || !['high', 'critical'].includes(via.severity)) {
          throw new Error(`npm audit advisory is malformed: ${current}`);
        }
        const versions = finding.nodes.map((path) => lock.packages?.[path]?.version);
        if (versions.length === 0 || versions.some((version) => typeof version !== 'string')) {
          throw new Error(`npm audit advisory has unbound package paths: ${current}`);
        }
        for (const version of versions)
          result.add(keyOf({ package: current, version, advisory: id }));
      }
    }
    if (result.size === 0) throw new Error(`npm audit finding has no advisory root: ${name}`);
    return result;
  }
  for (const [name, finding] of Object.entries(report.vulnerabilities)) {
    if (!['high', 'critical'].includes(finding?.severity)) continue;
    try {
      for (const root of roots(name)) {
        observed.add(root);
        if (!approved.has(root)) errors.push(`unreviewed high/critical npm advisory: ${root}`);
      }
    } catch (error) {
      errors.push(error.message);
    }
  }
  for (const identity of approved) {
    if (!observed.has(identity)) errors.push(`reviewed npm advisory is missing: ${identity}`);
  }
  return [...new Set(errors)];
}

export function validateOsvScan({ report, lock, policy, today }) {
  const errors = [...policyErrors(policy, today), ...lockErrors(lock)];
  if (!Array.isArray(report?.results)) return [...errors, 'OSV report is missing results'];
  const approved = new Set(REVIEWED_ADVISORIES.map(keyOf));
  const observed = new Set();
  for (const result of report.results) {
    if (!Array.isArray(result?.packages)) {
      errors.push('OSV result has no package inventory');
      continue;
    }
    for (const item of result.packages) {
      const pkg = item?.package;
      if (!isRecord(pkg) || !Array.isArray(item.vulnerabilities)) {
        errors.push('OSV package finding is malformed');
        continue;
      }
      for (const vulnerability of item.vulnerabilities) {
        const identity = keyOf({
          package: pkg.name,
          version: pkg.version,
          advisory: vulnerability?.id,
        });
        if (pkg.ecosystem !== 'npm' || !approved.has(identity)) {
          errors.push(`unreviewed OSV advisory: ${identity}`);
        } else {
          observed.add(identity);
        }
      }
    }
  }
  for (const identity of approved) {
    if (!observed.has(identity)) errors.push(`reviewed OSV advisory is missing: ${identity}`);
  }
  return [...new Set(errors)];
}

function isNewerVersion(candidate, pinned) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/u.exec(value);
    return match ? match.slice(1, 4).map(Number) : null;
  };
  const left = parse(candidate);
  const right = parse(pinned);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return false;
}

export function validateLiveReviewData({ registry, advisories }) {
  const errors = [];
  for (const entry of REVIEWED_ADVISORIES) {
    const versions = registry?.[entry.package]?.versions;
    if (!isRecord(versions) || !Object.hasOwn(versions, entry.version)) {
      errors.push(`${entry.package}: registry no longer contains the reviewed version`);
    } else if (Object.keys(versions).some((version) => isNewerVersion(version, entry.version))) {
      errors.push(`${entry.package}: a newer release requires security review`);
    }
    const advisory = advisories?.[entry.advisory];
    const affected = advisory?.affected?.filter(
      (item) => item?.package?.name === entry.package && item?.package?.ecosystem === 'npm',
    );
    if (advisory?.id !== entry.advisory || advisory?.withdrawn || affected?.length !== 1) {
      errors.push(`${entry.package}: live advisory identity or status changed`);
    } else if (
      affected.some((item) =>
        item.ranges?.some((range) => range.events?.some((event) => event.fixed)),
      )
    ) {
      errors.push(`${entry.package}: a patched release is listed for the reviewed advisory`);
    }
  }
  return errors;
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok)
    throw new Error(`security review source returned HTTP ${response.status}: ${url}`);
  return response.json();
}

async function main() {
  const mode = process.argv[2];
  if (!['npm', 'osv'].includes(mode))
    throw new Error('usage: security-advisory-exceptions.mjs npm|osv');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const lock = readJson(LOCK_PATH);
  const policy = readJson(POLICY_PATH);
  const today = new Date().toISOString().slice(0, 10);
  let errors;
  if (mode === 'npm') {
    const exitCode = Number(
      readFileSync(resolve(root, EVIDENCE_DIR, 'npm-audit-high.exit-code'), 'utf8').trim(),
    );
    errors = validateNpmAudit({
      report: readJson(`${EVIDENCE_DIR}/npm-audit-high.json`),
      lock,
      policy,
      scannerExitCode: exitCode,
      today,
    });
  } else {
    errors = validateOsvScan({
      report: readJson(`${EVIDENCE_DIR}/osv-scan.json`),
      lock,
      policy,
      today,
    });
  }
  const [registry, advisories] = await Promise.all([
    Promise.all(
      REVIEWED_ADVISORIES.map(async (entry) => [
        entry.package,
        await fetchJson(`https://registry.npmjs.org/${entry.package}`),
      ]),
    ).then(Object.fromEntries),
    Promise.all(
      REVIEWED_ADVISORIES.map(async (entry) => [
        entry.advisory,
        await fetchJson(`https://api.osv.dev/v1/vulns/${entry.advisory}`),
      ]),
    ).then(Object.fromEntries),
  ]);
  errors.push(...validateLiveReviewData({ registry, advisories }));
  if (errors.length > 0) throw new Error(errors.join('\n'));
  process.stdout.write(`${mode} scanner findings match the two active reviewed exceptions.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
