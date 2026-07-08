#!/usr/bin/env node
import {
  block,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  has,
  listFiles,
  printResult,
  read,
  root,
  warn,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();

const registryPath = 'apps/mobile/src/lib/analytics/eventRegistry.ts';
const trackerPath = 'apps/mobile/src/lib/analytics/track.ts';
const schemaPath = 'docs/phase-10/beta-event-schema.md';

for (const file of [registryPath, trackerPath, schemaPath])
  block(errors, exists(file), `${file} is missing.`);

block(
  errors,
  has(registryPath, /ANALYTICS_ALLOWED_PROP_KEYS/),
  'Analytics allowed property registry is missing.',
);
block(
  errors,
  has(trackerPath, /SENSITIVE_ANALYTICS_KEY/),
  'Analytics tracker must keep a sensitive-key guard.',
);
block(
  errors,
  has(trackerPath, /sanitizeAnalyticsProps/),
  'Analytics tracker must sanitize event properties.',
);
block(
  errors,
  has(trackerPath, /isAllowedAnalyticsPropKey/),
  'Analytics tracker must enforce allowed property keys.',
);
block(
  errors,
  has(schemaPath, /Required Dashboards/i),
  'Beta event schema must define required dashboards.',
);
block(
  errors,
  has(schemaPath, /Retention cohorts/i),
  'Beta event schema must define retention cohorts.',
);
block(
  errors,
  has(schemaPath, /ANALYTICS_ALLOWED_PROP_KEYS/),
  'Beta event schema must reference the allowed property registry.',
);

const registryText = exists(registryPath) ? read(registryPath) : '';
const schemaText = exists(schemaPath) ? read(schemaPath) : '';
const propRegistry = registryText.match(
  /ANALYTICS_ALLOWED_PROP_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/,
);
const allowed = new Set(
  [...(propRegistry?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]),
);
const eventRegistry = registryText.match(
  /ANALYTICS_ALLOWED_EVENTS\s*=\s*\[([\s\S]*?)\]\s*as const/,
);
const allowedEvents = new Set(
  [...(eventRegistry?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]),
);

function stripComments(source) {
  return source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function minimumBetaEvents() {
  const section = schemaText.match(/## Minimum Event Coverage([\s\S]*?)(?:\n## |$)/);
  return [...(section?.[1] ?? '').matchAll(/`([a-z0-9_]+)`/g)].map((match) => match[1]);
}

function runtimeTrackedEvents() {
  const events = new Set();
  const runtimeFiles = listFiles('apps/mobile/src').filter(
    (file) =>
      /\.(ts|tsx)$/.test(file) &&
      !/\.(test|spec)\.(ts|tsx)$/.test(file) &&
      !file.replaceAll('\\', '/').includes('/__tests__/'),
  );

  for (const file of runtimeFiles) {
    const relative = file.replace(`${root}\\`, '').replace(`${root}/`, '').replaceAll('\\', '/');
    const text = stripComments(read(relative));
    for (const match of text.matchAll(/\btrack\(\s*['"]([a-z0-9_]+)['"]/g)) {
      events.add(match[1]);
    }
  }

  return events;
}

const betaEvents = minimumBetaEvents();
const trackedEvents = runtimeTrackedEvents();

block(
  errors,
  betaEvents.length >= 30,
  'Beta event schema must list the minimum V1 beta event coverage.',
);
for (const event of betaEvents) {
  block(
    errors,
    allowedEvents.has(event),
    `Minimum beta event is missing from ANALYTICS_ALLOWED_EVENTS: ${event}.`,
  );
  block(
    errors,
    trackedEvents.has(event),
    `Minimum beta event is registered in docs but not emitted by runtime source: ${event}.`,
  );
}
for (const requiredKey of [
  'screen_name',
  'source',
  'result',
  'reason',
  'context',
  'feature',
  'surface',
  'share_id',
  'barcode_type',
  'native_ocr_enabled',
]) {
  block(
    errors,
    allowed.has(requiredKey),
    `Analytics registry is missing required beta-safe property key: ${requiredKey}.`,
  );
}

const sensitiveKey =
  /(barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|dspt|fitzpatrick|monk|axis|step|score|slug)/i;
for (const key of allowed) {
  block(
    errors,
    !sensitiveKey.test(key) ||
      ['barcode_type', 'native_ocr_enabled', 'screen_name', 'share_id'].includes(key),
    `Sensitive-looking property is allowlisted: ${key}.`,
  );
}

const codeFiles = listFiles('apps/mobile/src').filter((file) => /\.(ts|tsx)$/.test(file));
for (const file of codeFiles) {
  const relative = file.replace(`${root}\\`, '').replace(`${root}/`, '').replaceAll('\\', '/');
  const text = read(relative);
  for (const match of text.matchAll(
    /\b(?:track|identify)\(\s*['"][^'"]+['"]\s*,\s*\{([\s\S]*?)\}\s*\)/g,
  )) {
    const props = stripComments(match[1]);
    for (const prop of props.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) {
      const key = prop[1];
      warn(
        warnings,
        allowed.has(key),
        `${relative} uses analytics prop "${key}" that is not in ANALYTICS_ALLOWED_PROP_KEYS and will be dropped.`,
      );
    }
  }
}

warn(
  warnings,
  evidenceFlagEnabled(env.PHASE10_DASHBOARDS_PASS),
  'Missing dashboard evidence: PHASE10_DASHBOARDS_PASS=true.',
);
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE10_PRIVACY_PAYLOAD_PASS),
  'Missing privacy payload evidence: PHASE10_PRIVACY_PAYLOAD_PASS=true.',
);

printResult('Phase 10 beta analytics audit', errors, warnings);
