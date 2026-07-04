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
  return createHash('sha256').update(readFileSync(abs(path))).digest('hex');
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

export function listFiles(dir = '.') {
  const base = abs(dir);
  if (!existsSync(base)) return [];
  const out = [];
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (full.includes(`${join('node_modules', '')}`) || full.includes(`${join('.git', '')}`)) continue;
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
    console.error(`\n${title} strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
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
    'PHASE9_DATA_EXPORT_DELETE_PASS',
    'PHASE9_CONSENT_WITHDRAWAL_PASS',
    'PHASE9_OBSERVABILITY_PAYLOAD_PASS',
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
