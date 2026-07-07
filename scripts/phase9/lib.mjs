import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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

const PLACEHOLDER_ENV_VALUE = /example\.com|your-project|x{4,}|\.{3,}|pending/i;
const PUBLIC_PRODUCTION_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_PRODUCTION_HOSTNAME = /(?:^localhost$|\.localhost$|\.local$|\.test$|\.invalid$|\.example$)/;

export function placeholderEnvValue(value) {
  const trimmed = String(value ?? '').trim();
  return !trimmed || PLACEHOLDER_ENV_VALUE.test(trimmed);
}

export function productionHostname(hostname) {
  const normalized = String(hostname ?? '').trim().toLowerCase();
  return (
    PUBLIC_PRODUCTION_HOSTNAME.test(normalized) &&
    !RESERVED_PRODUCTION_HOSTNAME.test(normalized) &&
    !normalized.includes('example.com') &&
    !placeholderEnvValue(normalized)
  );
}

export function productionUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed)) return false;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.username && !url.password && productionHostname(url.hostname);
}

export function productionDomain(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed)) return false;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    !url.port &&
    productionHostname(url.hostname)
  );
}

export function productionSupportEmail(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  const domain = trimmed.split('@').pop()?.toLowerCase() ?? '';
  return productionHostname(domain);
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
    [...Object.keys(exampleEnv), ...Object.keys(env)].filter((name) => name.startsWith('EXPO_PUBLIC_')),
  );

  for (const key of publicEnvKeys) {
    block(errors, !PUBLIC_SECRET_NAME.test(key), `Secret-looking key is public: ${key}.`);
    const value = String(env[key] ?? exampleEnv[key] ?? '');
    block(errors, !PUBLIC_SECRET_VALUE.test(value), `Secret-looking value is public: ${key}.`);
  }
}

export function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
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

export function requiredPhase9EvidenceKeys() {
  return [
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
    'PHASE9_ANDROID_CLOSED_TEST_PASS',
    'PHASE9_ANDROID_TARGET_API_PASS',
    'PHASE9_ANDROID_16KB_PASS',
    'PHASE9_IOS_PRIVACY_REPORT_PASS',
    'PHASE9_APP_STORE_PACKET_PASS',
    'PHASE9_PLAY_PACKET_PASS',
    'PHASE9_DEVICE_QA_PASS',
    'PHASE9_ROLLBACK_DRILL_PASS',
    'PHASE9_INCIDENT_RESPONSE_PASS',
    'PHASE9_DEPENDENCY_AUDIT_PASS',
    'PHASE9_BETA_EVIDENCE_PASS',
  ];
}
