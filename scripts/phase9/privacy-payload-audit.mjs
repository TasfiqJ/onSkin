#!/usr/bin/env node
import { abs, block, listFiles, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const registrySource = read('apps/mobile/src/lib/analytics/eventRegistry.ts');
const trackSource = read('apps/mobile/src/lib/analytics/track.ts');
const sentrySource = read('apps/mobile/src/lib/observability/sentry.ts');
const scrubSource = read('apps/mobile/src/lib/observability/scrub.ts');

const registryBody = registrySource.match(/ANALYTICS_ALLOWED_PROP_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
const allowed = new Set([...registryBody.matchAll(/'([^']+)'/g)].map((match) => match[1]));
const sensitiveKey =
  /(barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|question_id|id$|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|dspt|fitzpatrick|monk|axis|step|score|slug)/i;
const approvedBucketExceptions = new Set(['barcode_type', 'native_ocr_enabled', 'screen_name', 'share_id']);

block(errors, allowed.size > 0, 'Analytics event registry is empty or missing.');
block(errors, /isAllowedAnalyticsPropKey/.test(trackSource), 'Analytics sanitizer must call isAllowedAnalyticsPropKey.');
block(errors, /SENSITIVE_ANALYTICS_KEY/.test(trackSource), 'Analytics sanitizer is missing sensitive-key guard.');
block(errors, /sanitizeObservabilityContext/.test(sentrySource), 'Sentry captureException must sanitize context.');
block(errors, /SENSITIVE_CONTEXT_KEY/.test(scrubSource), 'Sentry scrubber is missing sensitive-key guard.');
block(errors, /SENSITIVE_VALUE/.test(scrubSource), 'Sentry scrubber is missing sensitive-value guard.');
block(errors, /route|query|url|receipt|ocr|barcode|free_text/i.test(scrubSource), 'Sentry scrubber must explicitly cover route/query/url/receipt/OCR/barcode/free text.');

for (const key of allowed) {
  block(errors, !sensitiveKey.test(key) || approvedBucketExceptions.has(key), `Sensitive analytics prop is allowlisted: ${key}.`);
}

const seenDropped = new Set();
function objectFromTrackSnippet(snippet) {
  const start = snippet.indexOf('{');
  if (start === -1) return '';
  let depth = 0;
  for (let index = start; index < snippet.length; index += 1) {
    const char = snippet[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return snippet.slice(start + 1, index);
  }
  return '';
}

for (const file of listFiles('apps/mobile/src').filter((item) => /\.(ts|tsx)$/.test(item) && !item.endsWith('.test.ts'))) {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!/\btrack\(/.test(lines[index])) continue;
    let snippet = lines[index];
    for (let next = index + 1; next < Math.min(lines.length, index + 12) && !/\);/.test(snippet); next += 1) {
      snippet += `\n${lines[next]}`;
    }
    const objectLiteral = objectFromTrackSnippet(snippet);
    if (!objectLiteral) continue;
    for (const keyMatch of objectLiteral.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g)) {
      const key = keyMatch[1];
      if (!allowed.has(key)) {
        seenDropped.add(`${file.replace(abs('.'), '.')} -> ${key}`);
      } else if (sensitiveKey.test(key) && !approvedBucketExceptions.has(key)) {
        seenDropped.add(`${file.replace(abs('.'), '.')} -> sensitive ${key}`);
      }
    }
  }
}

for (const item of [...seenDropped].sort()) {
  warn(warnings, false, `Track prop is not approved and will be dropped by sanitizer: ${item}.`);
}

warn(warnings, process.env.PHASE9_OBSERVABILITY_PAYLOAD_PASS === 'true', 'Missing live Sentry/PostHog payload sample approval: PHASE9_OBSERVABILITY_PAYLOAD_PASS=true.');

printResult('Phase 9 privacy payload audit', errors, warnings);
