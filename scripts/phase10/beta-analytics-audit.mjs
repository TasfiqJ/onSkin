#!/usr/bin/env node
import {
  block,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  has,
  printResult,
  read,
  warn,
} from './lib.mjs';
import { auditAnalyticsSource } from '../phase9/analytics-source-audit.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const analyticsSourceAudit = auditAnalyticsSource();
errors.push(...analyticsSourceAudit.errors);

const registryPath = 'apps/mobile/src/lib/analytics/eventRegistry.ts';
const trackerPath = 'apps/mobile/src/lib/analytics/track.ts';
const schemaPath = 'docs/phase-10/beta-event-schema.md';
const REQUIRED_PHASE_H_EVENTS = [
  'onboarding_started',
  'product_added',
  'first_useful_insight',
  'routine_created',
  'first_checkoff_completed',
  'routine_checkoff_completed',
  'cycle_night_completed',
  'photo_baseline_added',
  'paywall_shown',
  'reverse_trial_started',
  'purchase_completed',
];
const PROHIBITED_CONFLICT_EVENTS = [
  'conflict_detected',
  'conflict_detail_viewed',
  'conflict_overridden',
  'conflict_resolution_chosen',
  'landing_viewed',
  'share_card_export_failed',
  'share_card_export_started',
  'share_card_export_succeeded',
  'share_card_exported',
  'share_link_created',
  'share_link_opened',
  'share_sheet_opened',
];

for (const file of [registryPath, trackerPath, schemaPath])
  block(errors, exists(file), `${file} is missing.`);

block(
  errors,
  has(registryPath, /ANALYTICS_ALLOWED_PROP_KEYS/),
  'Analytics allowed property registry is missing.',
);
block(
  errors,
  has(registryPath, /ANALYTICS_EVENT_SCHEMAS/),
  'Exact per-event analytics schemas are missing.',
);
block(
  errors,
  has(trackerPath, /analyticsSchemaForEvent/) && has(trackerPath, /isAllowedAnalyticsPropValue/),
  'Analytics tracker must keep an exact event-key/value guard.',
);
block(
  errors,
  has(trackerPath, /sanitizeAnalyticsProps/),
  'Analytics tracker must sanitize event properties.',
);
block(
  errors,
  has(trackerPath, /analyticsSchemaForEvent/) && has(trackerPath, /isAllowedAnalyticsPropValue/),
  'Analytics tracker must apply the exact schema for the named event.',
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

const schemaText = exists(schemaPath) ? read(schemaPath) : '';
const allowed = analyticsSourceAudit.allowedProps;
const allowedEvents = analyticsSourceAudit.allowedEvents;

function minimumBetaEvents() {
  const section = schemaText.match(
    /## Minimum Event Coverage([\s\S]*?)(?:\nRoutine event definitions:|\n## |$)/,
  );
  return (section?.[1] ?? '').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*-\s+`([a-z0-9_]+)`\s*$/);
    return match ? [match[1]] : [];
  });
}

const betaEvents = minimumBetaEvents();
const betaEventSet = new Set(betaEvents);
const trackedEvents = analyticsSourceAudit.trackedEvents;

for (const event of PROHIBITED_CONFLICT_EVENTS) {
  block(
    errors,
    !betaEventSet.has(event),
    `Minimum beta coverage must prohibit conflict-state event: ${event}.`,
  );
  block(
    errors,
    !allowedEvents.has(event),
    `ANALYTICS_ALLOWED_EVENTS must prohibit conflict-state event: ${event}.`,
  );
  block(
    errors,
    !trackedEvents.has(event),
    `Runtime source must not emit conflict-state event: ${event}.`,
  );
}

for (const route of [
  'apps/mobile/src/app/conflict/[ruleId].tsx',
  'apps/mobile/src/app/share/conflict/[ruleId].tsx',
]) {
  const source = exists(route) ? stripComments(read(route)) : '';
  block(errors, exists(route), `${route} is missing.`);
  block(
    errors,
    !/\btrack\s*\(/.test(source),
    `${route} must not emit analytics; any event from a conflict-only route reveals conflict existence.`,
  );
}

block(
  errors,
  betaEvents.length >= 30,
  'Beta event schema must list the minimum V1 beta event coverage.',
);
block(
  errors,
  betaEventSet.size === betaEvents.length,
  'Beta event schema Minimum Event Coverage must not contain duplicate events.',
);
for (const event of REQUIRED_PHASE_H_EVENTS) {
  block(
    errors,
    betaEventSet.has(event),
    `Phase H beta event contract is missing from Minimum Event Coverage: ${event}.`,
  );
}
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
