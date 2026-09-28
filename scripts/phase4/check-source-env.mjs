#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  normalizeProductionSupportEmail,
  normalizeProductionUrl,
  placeholderEnvValue,
} from '../phase9/lib.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();

function parseDotEnv(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

for (const candidate of [resolve(root, '.env'), resolve(root, 'apps/mobile/.env')]) {
  if (existsSync(candidate)) parseDotEnv(readFileSync(candidate, 'utf8'));
}

const required = [
  'CATALOG_APP_NAME',
  'CATALOG_APP_VERSION',
  'CATALOG_CONTACT_EMAIL',
  'CATALOG_ATTRIBUTION_URL',
];

function valueFor(name) {
  return process.env[name]?.trim() ?? '';
}

function isUsable(name) {
  const value = valueFor(name);
  if (/onskin/i.test(value)) return false;
  return value.length > 0 && !placeholderEnvValue(value);
}

const errors = [];
const warnings = [];

for (const name of required) {
  if (!isUsable(name))
    errors.push(`${name} is missing, a placeholder, or still uses an uncleared brand.`);
}

const email = valueFor('CATALOG_CONTACT_EMAIL');
if (email && !normalizeProductionSupportEmail(email)) {
  errors.push('CATALOG_CONTACT_EMAIL must be a production contact email address.');
}

const attributionUrl = valueFor('CATALOG_ATTRIBUTION_URL');
if (attributionUrl && !normalizeProductionUrl(attributionUrl)) {
  errors.push('CATALOG_ATTRIBUTION_URL must be a production HTTPS URL.');
}

const legacyObfApiFlag = valueFor('OBF_API_ENABLED');
if (legacyObfApiFlag && legacyObfApiFlag.toLowerCase() !== 'false') {
  errors.push(
    'OBF_API_ENABLED is retired: request-time Open Beauty Facts lookup must remain disabled.',
  );
}

if (valueFor('OBF_CONTRIBUTION_ENABLED') === 'true') {
  warnings.push(
    'OBF contribution was requested, but catalog-report intentionally suppresses enqueueing until its RPC has an atomic active-consent and expected-epoch guard.',
  );
}

console.log(
  `Phase 4 catalog source env: ${required.filter(isUsable).length}/${required.length} required values usable.`,
);
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);

if (errors.length > 0 && strict) process.exit(1);
if (errors.length > 0) {
  console.error(
    `\nPhase 4 source env is incomplete (${errors.length} blocker${errors.length === 1 ? '' : 's'}).`,
  );
} else {
  console.log('\nPhase 4 source env contract is complete.');
}
