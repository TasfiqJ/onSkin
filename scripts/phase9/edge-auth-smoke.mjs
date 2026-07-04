#!/usr/bin/env node
import { block, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const userJwtFunctions = [
  'account-deletion',
  'data-export',
  'subscription-grants',
  'catalog-search',
  'catalog-lookup',
  'catalog-report',
];

for (const fn of userJwtFunctions) {
  const source = read(`supabase/functions/${fn}/index.ts`);
  block(errors, /auth\.getUser/.test(source), `${fn} must validate caller JWT with auth.getUser.`);
  block(errors, /401/.test(source) && /unauthorized/i.test(source), `${fn} must reject missing/wrong auth with 401.`);
  if (fn !== 'data-export') {
    block(errors, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(source), `${fn} service-role use must be explicit and auditable.`);
  }
}

const revenueCat = read('supabase/functions/revenuecat-webhook/index.ts');
block(errors, /REVENUECAT_WEBHOOK_AUTH/.test(revenueCat), 'RevenueCat webhook must verify shared auth header.');
block(errors, /REVENUECAT_WEBHOOK_SIGNING_SECRET/.test(revenueCat), 'RevenueCat webhook must support HMAC signing secret.');
block(errors, /X-RevenueCat-Webhook-Signature/.test(revenueCat), 'RevenueCat webhook must read signature header.');
block(errors, /stale_signature/.test(revenueCat), 'RevenueCat webhook must reject stale signatures.');
block(errors, /rc_event_id/.test(revenueCat) && /maybeSingle/.test(revenueCat), 'RevenueCat webhook must be idempotent by event id.');

const growth = read('supabase/functions/growth-event/index.ts');
block(errors, /allowedEvents/.test(growth), 'growth-event must allowlist event names.');
block(errors, /allowedKeys/.test(growth), 'growth-event must allowlist payload keys.');
block(errors, /sensitive/.test(growth), 'growth-event must drop sensitive payloads.');

const waitlist = read('supabase/functions/waitlist/index.ts');
block(errors, /invalid email/.test(waitlist), 'waitlist must validate email.');
block(errors, /allowedAttributionKeys/.test(waitlist), 'waitlist attribution must be allowlisted.');
block(errors, /sanitizeAttribution/.test(waitlist), 'waitlist attribution must be sanitized.');

const poll = read('supabase/functions/order-report-poll/index.ts');
block(errors, /SHOPMY_BRAND_API_KEY/.test(poll), 'order-report-poll must require ShopMy brand API key before polling.');
block(errors, /no brand API key/.test(poll), 'order-report-poll must no-op without ShopMy key.');
warn(warnings, !/INERT STUB/i.test(poll), 'order-report-poll remains inert until ShopMy account model and API key are approved.');

warn(warnings, process.env.PHASE9_EDGE_AUTH_PASS === 'true', 'Missing live Edge auth negative-test evidence: PHASE9_EDGE_AUTH_PASS=true.');

printResult('Phase 9 Edge auth smoke', errors, warnings);
