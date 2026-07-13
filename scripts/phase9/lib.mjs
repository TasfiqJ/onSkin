import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isReleasePlatformRequired, loadLaunchContract } from '../launch/contract.mjs';

export const root = process.cwd();
export const strict = process.argv.includes('--strict');

export function abs(path) {
  return resolve(root, path);
}

export function exists(path) {
  return existsSync(abs(path));
}

export function read(path) {
  return readFileSync(abs(path), 'utf8');
}

export function write(path, text) {
  const target = abs(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

export function mkdir(path) {
  mkdirSync(abs(path), { recursive: true });
}

export function hash(path) {
  return createHash('sha256')
    .update(readFileSync(abs(path)))
    .digest('hex');
}

export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    out[key] = rest.join('=').trim();
  }
  return out;
}

export function envFile(path) {
  return exists(path) ? parseEnv(read(path)) : {};
}

export function envSnapshot() {
  return { ...envFile('.env.example'), ...envFile('.env'), ...process.env };
}

export function readScriptAppEnvironment() {
  const runtimeEnv = { ...envFile('.env'), ...process.env };
  const raw = runtimeEnv.EXPO_PUBLIC_APP_ENV ?? runtimeEnv.APP_ENV ?? runtimeEnv.APP_VARIANT;
  const candidate = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['development', 'staging', 'production'].includes(candidate)) return candidate;
  return 'production';
}

export function listFiles(dir = '.') {
  const base = abs(dir);
  if (!existsSync(base)) return [];
  const out = [];
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (full.includes(`${join('node_modules', '')}`) || full.includes(`${join('.git', '')}`))
        continue;
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

export function has(path, pattern) {
  return pattern.test(read(path));
}

export function block(errors, condition, message) {
  if (!condition) errors.push(message);
}

export function warn(warnings, condition, message) {
  if (!condition) warnings.push(message);
}

const PLACEHOLDER_ENV_VALUE =
  /example\.com|your[-_][a-z0-9_-]*|replace-with|__blocked_placeholder__|x{4,}|\.{3,}|pending/i;
const PUBLIC_PRODUCTION_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_PRODUCTION_HOSTNAME =
  /(?:^localhost$|\.localhost$|\.local$|\.test$|\.invalid$|\.example$)/;

export function placeholderEnvValue(value) {
  const trimmed = String(value ?? '').trim();
  return !trimmed || PLACEHOLDER_ENV_VALUE.test(trimmed);
}

export function evidenceFlagEnabled(value) {
  return (
    String(value ?? '')
      .trim()
      .toLowerCase() === 'true'
  );
}

export function normalizeLaunchDecision(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['go', 'limited'].includes(normalized) ? normalized : null;
}

export function normalizeNamedSignoff(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed)) return null;
  if (/^(?:name|tester|qa|reviewer|signoff|signed off|tbd|n\/a)$/i.test(trimmed)) return null;
  if (/\b(?:tester|reviewer|your|full|actual|first|last)\s+name\b/i.test(trimmed)) return null;
  if (/\b(?:john|jane)\s+doe\b/i.test(trimmed)) return null;
  return /[a-z]/i.test(trimmed) && trimmed.length >= 3 ? trimmed : null;
}

export function normalizeAppleTeamId(value) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  if (placeholderEnvValue(normalized)) return null;
  if (/^(?:TEAMID\d*|APPLETEAM|APPLETEAMID)$/i.test(normalized)) return null;
  return /^[A-Z0-9]{10}$/.test(normalized) ? normalized : null;
}

export function normalizeAndroidSha256Fingerprints(value) {
  const raw = String(value ?? '').trim();
  if (placeholderEnvValue(raw)) return [];

  const fingerprints = raw
    .split(/[,;\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const normalized = [];
  for (const fingerprint of fingerprints) {
    if (placeholderEnvValue(fingerprint)) return [];
    const compact = fingerprint.replace(/:/g, '').toUpperCase();
    if (!/^[A-F0-9]{64}$/.test(compact) || /^0+$/.test(compact)) return [];
    normalized.push(compact.match(/.{2}/g).join(':'));
  }

  return [...new Set(normalized)];
}

export function productionHostname(hostname) {
  const normalized = String(hostname ?? '')
    .trim()
    .toLowerCase();
  return (
    PUBLIC_PRODUCTION_HOSTNAME.test(normalized) &&
    !RESERVED_PRODUCTION_HOSTNAME.test(normalized) &&
    !normalized.includes('example.com') &&
    !placeholderEnvValue(normalized)
  );
}

export function normalizeProductionUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed)) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
  if (!productionHostname(url.hostname)) return null;
  url.hash = '';
  return url.toString();
}

export function productionUrl(value) {
  return Boolean(normalizeProductionUrl(value));
}

export function normalizeProductionDomain(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed)) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.search || url.hash || url.port) return null;
  const hostname = url.hostname.toLowerCase();
  return productionHostname(hostname) ? hostname : null;
}

export function productionDomain(value) {
  return Boolean(normalizeProductionDomain(value));
}

export function normalizeProductionSupportEmail(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  const domain = trimmed.split('@').pop()?.toLowerCase() ?? '';
  return productionHostname(domain) ? trimmed : null;
}

export function productionSupportEmail(value) {
  return Boolean(normalizeProductionSupportEmail(value));
}

export function redactedErrorKind(error) {
  if (error instanceof Error) return error.name || 'Error';
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String(error.code ?? '') : '';
    if (/^[A-Za-z0-9_-]{1,40}$/.test(code)) return `code:${code}`;
    return 'object';
  }
  return typeof error;
}

const PUBLIC_SECRET_NAME = /(SECRET|PRIVATE|SERVICE_ROLE|WEBHOOK|PERSONAL|AUTH_TOKEN)/i;
const PUBLIC_SECRET_VALUE =
  /(sb_secret_|service_role|whsec_|sk_(?:live|test|prod|secret)|sntrys_|phx_|-----BEGIN|PRIVATE KEY)/i;

export function blockPublicEnvSecrets(errors, env, exampleEnv = {}) {
  const publicEnvKeys = new Set(
    [...Object.keys(exampleEnv), ...Object.keys(env)].filter((name) =>
      name.startsWith('EXPO_PUBLIC_'),
    ),
  );

  for (const key of publicEnvKeys) {
    block(errors, !PUBLIC_SECRET_NAME.test(key), `Secret-looking key is public: ${key}.`);
    const value = String(env[key] ?? exampleEnv[key] ?? '');
    block(errors, !PUBLIC_SECRET_VALUE.test(value), `Secret-looking value is public: ${key}.`);
  }
}

export function command(commandName, args, options = {}) {
  const cwd = options.cwd ?? root;
  const commandArgs =
    commandName === 'git' ? ['-c', `safe.directory=${resolve(cwd)}`, ...args] : args;

  return execFileSync(commandName, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

export const generatedEvidenceOutputPaths = Object.freeze([
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/generated/generated-packet-status-audit.json',
  'docs/generated/generated-packet-status-audit.md',
  'docs/generated/device-support-policy-audit.json',
  'docs/generated/device-support-policy-audit.md',
  'docs/generated/performance-readiness-audit.json',
  'docs/generated/performance-readiness-audit.md',
  'docs/generated/readiness-status-audit.json',
  'docs/generated/readiness-status-audit.md',
  'docs/generated/source-packet-audit.json',
  'docs/generated/source-packet-audit.md',
  'docs/generated/tas-todo-audit.json',
  'docs/generated/tas-todo-audit.md',
  'docs/phase-3/generated/review-packet-manifest.json',
  'docs/phase-3/generated/review-packet.md',
  'docs/phase-3/generated/review-operator-queue.json',
  'docs/phase-3/generated/review-operator-queue.md',
  'docs/phase-3/generated/review-worklist.json',
  'docs/phase-3/generated/review-worklist.md',
  'docs/phase-4/generated/beta-coverage-report.json',
  'docs/phase-4/generated/beta-coverage-report.md',
  'docs/phase-4/generated/catalog-qa-report.json',
  'docs/phase-4/generated/catalog-qa-report.md',
  'docs/phase-4/generated/cosing-fixture-import.json',
  'docs/phase-4/generated/obf-fixture-import.json',
  'docs/phase-4/generated/source-worklist.json',
  'docs/phase-4/generated/source-worklist.md',
  'docs/phase-5/generated/device-qa-packet.json',
  'docs/phase-5/generated/device-qa-packet.md',
  'docs/phase-6/generated/payments-qa-packet.json',
  'docs/phase-6/generated/payments-qa-packet.md',
  'docs/phase-7/generated/core-loop-qa-packet.json',
  'docs/phase-7/generated/core-loop-qa-packet.md',
  'docs/phase-8/generated/growth-store-qa-packet.json',
  'docs/phase-8/generated/growth-store-qa-packet.md',
  'docs/phase-9/generated/dependency-inventory.json',
  'docs/phase-9/generated/dependency-inventory.md',
  'docs/phase-9/generated/live-catalog-rate-limit.json',
  'docs/phase-9/generated/live-catalog-rate-limit.md',
  'docs/phase-9/generated/live-consent-withdrawal.json',
  'docs/phase-9/generated/live-consent-withdrawal.md',
  'docs/phase-9/generated/live-data-rights.json',
  'docs/phase-9/generated/live-data-rights.md',
  'docs/phase-9/generated/live-edge-auth.json',
  'docs/phase-9/generated/live-edge-auth.md',
  'docs/phase-9/generated/live-order-report-poll.json',
  'docs/phase-9/generated/live-order-report-poll.md',
  'docs/phase-9/generated/live-public-forms.json',
  'docs/phase-9/generated/live-public-forms.md',
  'docs/phase-9/generated/live-revenuecat-webhook.json',
  'docs/phase-9/generated/live-revenuecat-webhook.md',
  'docs/phase-9/generated/live-supabase-adversarial.json',
  'docs/phase-9/generated/live-supabase-adversarial.md',
  'docs/phase-9/generated/release-engineering-qa-packet.json',
  'docs/phase-9/generated/release-engineering-qa-packet.md',
  'docs/phase-9/generated/store-build-inspection.json',
  'docs/phase-10/generated/closed-beta-packet.json',
  'docs/phase-10/generated/closed-beta-packet.md',
  'docs/phase-10/generated/support-handoff-packet.json',
  'docs/phase-10/generated/support-handoff-packet.md',
  'docs/phase-11/generated/public-launch-packet.json',
  'docs/phase-11/generated/public-launch-packet.md',
]);

function normalizeRepoPath(path) {
  return String(path ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

function gitStatusLinePaths(line) {
  return String(line ?? '')
    .slice(3)
    .split(' -> ')
    .map(normalizeRepoPath)
    .filter(Boolean);
}

export function gitStatusExcludingPaths(excludedPaths = []) {
  const excluded = new Set(excludedPaths.map(normalizeRepoPath));

  return command('git', ['status', '--short'])
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const paths = gitStatusLinePaths(line);
      return paths.length === 0 || !paths.every((path) => excluded.has(path));
    })
    .join('\n')
    .trim();
}

export function gitStatusExcludingGeneratedEvidence(extraGeneratedPaths = []) {
  return gitStatusExcludingPaths([...generatedEvidenceOutputPaths, ...extraGeneratedPaths]);
}

export function printResult(title, errors, warnings) {
  console.log(title);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  for (const error of errors) console.error(`FAIL ${error}`);

  if (errors.length > 0) {
    console.error(`\n${title} has ${errors.length} blocker${errors.length === 1 ? '' : 's'}.`);
    process.exit(1);
  }

  if (warnings.length > 0 && strict) {
    console.error(
      `\n${title} strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
    );
    process.exit(1);
  }

  console.log(`\n${title} passed code gates. Strict release still requires warning-free evidence.`);
}

export function markdownList(items, empty = '- None.') {
  return items.length ? items.map((item) => `- ${item}`) : [empty];
}

const PHASE9_ANDROID_EVIDENCE_KEYS = Object.freeze([
  'PHASE9_ANDROID_CLOSED_TEST_PASS',
  'PHASE9_ANDROID_TARGET_API_PASS',
  'PHASE9_ANDROID_16KB_PASS',
  'PHASE9_PLAY_PACKET_PASS',
]);

export function requiredPhase9EvidenceKeys(
  contract = loadLaunchContract(resolve(import.meta.dirname, '../..')),
) {
  const keys = [
    'PHASE9_FINAL_IDENTITY_PASS',
    'PHASE9_LIVE_SUPABASE_PASS',
    'PHASE9_RLS_STAGING_PASS',
    'PHASE9_RLS_PRODUCTION_PASS',
    'PHASE9_EDGE_AUTH_PASS',
    'PHASE9_PUBLIC_FORMS_PASS',
    'PHASE9_CATALOG_RATE_LIMIT_PASS',
    'PHASE9_ORDER_REPORT_POLL_PASS',
    'PHASE9_DATA_EXPORT_DELETE_PASS',
    'PHASE9_CONSENT_WITHDRAWAL_PASS',
    'PHASE9_OBSERVABILITY_PAYLOAD_PASS',
    'PHASE9_REVENUECAT_WEBHOOK_PASS',
    'PHASE9_REVENUECAT_NATIVE_QA_PASS',
    'PHASE9_IOS_TESTFLIGHT_PASS',
    ...PHASE9_ANDROID_EVIDENCE_KEYS.slice(0, 3),
    'PHASE9_IOS_PRIVACY_REPORT_PASS',
    'PHASE9_APP_STORE_PACKET_PASS',
    PHASE9_ANDROID_EVIDENCE_KEYS[3],
    'PHASE9_DEVICE_QA_PASS',
    'PHASE9_ROLLBACK_DRILL_PASS',
    'PHASE9_INCIDENT_RESPONSE_PASS',
    'PHASE9_DEPENDENCY_AUDIT_PASS',
    'PHASE9_BETA_EVIDENCE_PASS',
  ];
  return isReleasePlatformRequired('android', contract)
    ? keys
    : keys.filter((key) => !PHASE9_ANDROID_EVIDENCE_KEYS.includes(key));
}

export function notApplicablePhase9EvidenceKeys(
  contract = loadLaunchContract(resolve(import.meta.dirname, '../..')),
) {
  return isReleasePlatformRequired('android', contract) ? [] : [...PHASE9_ANDROID_EVIDENCE_KEYS];
}
