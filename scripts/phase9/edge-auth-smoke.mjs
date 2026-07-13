#!/usr/bin/env node
import { block, evidenceFlagEnabled, listFiles, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];
const packageJson = JSON.parse(read('package.json'));
const liveEdgeAuth = read('scripts/phase9/live-edge-auth.mjs');
const livePublicForms = read('scripts/phase9/live-public-forms.mjs');
const liveCatalogRateLimit = read('scripts/phase9/live-catalog-rate-limit.mjs');
const liveOrderReportPoll = read('scripts/phase9/live-order-report-poll.mjs');
const liveRevenueCatWebhook = read('scripts/phase9/live-revenuecat-webhook.mjs');
const userEdgeAuthHelper = read('supabase/functions/_shared/auth.ts');
const userEdgeBodyHelper = read('supabase/functions/_shared/body.ts');
const edgeEnvHelper = read('supabase/functions/_shared/env.ts');
const externalFetchHelper = read('supabase/functions/_shared/fetch.ts');
const supabaseKeyMapHelper = read('supabase/functions/_shared/supabaseKeyMap.ts');
const supabasePublishableKeyHelper = read('supabase/functions/_shared/supabasePublishableKey.ts');
const supabaseSecretKeyHelper = read('supabase/functions/_shared/supabaseSecretKey.ts');
const clientSupabaseSecretReferences = listFiles('apps/mobile')
  .filter((path) => /\.(?:js|jsx|ts|tsx)$/.test(path))
  .filter((path) => /SUPABASE_(?:SECRET_KEYS|SECRET_KEY|SERVICE_ROLE_KEY)/.test(read(path)));

function orderedPublicFormChecks(source, scope) {
  return new RegExp(
    `const rateLimitError = await enforceRateLimit\\(req, '${scope}'\\);[\\s\\S]*if \\(rateLimitError\\) return rateLimitError;[\\s\\S]*const turnstileError = await verifyTurnstile`,
  ).test(source);
}

function publicFormBodyLimitChecks(source, scope) {
  const handlerSource = source.slice(source.indexOf('Deno.serve'));
  return (
    /intEnv\('PUBLIC_FORMS_MAX_BYTES',\s*8192,\s*1024,\s*65536\)/.test(source) &&
    /contentLengthTooLarge/.test(source) &&
    /readLimitedText/.test(source) &&
    /payload too large/.test(source) &&
    /413/.test(source) &&
    handlerSource.indexOf('contentLengthTooLarge(req)') !== -1 &&
    handlerSource.indexOf(`enforceRateLimit(req, '${scope}')`) !== -1 &&
    handlerSource.indexOf('contentLengthTooLarge(req)') <
      handlerSource.indexOf(`enforceRateLimit(req, '${scope}')`)
  );
}

const userJwtFunctions = [
  'account-deletion',
  'data-export',
  'subscription-grants',
  'catalog-search',
  'catalog-lookup',
  'catalog-report',
  'consent-withdrawal',
];
const bodyLimitedUserJwtFunctions = userJwtFunctions.filter((fn) => fn !== 'data-export');

function userEdgeBodyLimitChecks(source, fn) {
  const handlerSource = source.slice(source.indexOf('Deno.serve'));
  return (
    /userEdgeBodyMaxBytes/.test(source) &&
    /contentLengthTooLarge/.test(source) &&
    /readLimitedJson/.test(source) &&
    /payload_too_large/.test(source) &&
    /413/.test(source) &&
    handlerSource.indexOf("req.method !== 'POST'") !== -1 &&
    handlerSource.indexOf('contentLengthTooLarge(req, maxBodyBytes)') !== -1 &&
    handlerSource.indexOf('auth.getUser') !== -1 &&
    handlerSource.indexOf("req.method !== 'POST'") <
      handlerSource.indexOf('contentLengthTooLarge(req, maxBodyBytes)') &&
    handlerSource.indexOf('contentLengthTooLarge(req, maxBodyBytes)') <
      handlerSource.indexOf('auth.getUser')
  );
}

function externalProviderFetchChecks(source) {
  return (
    /fetchWithTimeout/.test(source) &&
    /readLimitedResponse(?:Json|Text)/.test(source) &&
    !/await fetch\(/.test(source) &&
    !/\.(?:json|text)\(\)/.test(source)
  );
}

block(
  errors,
  /function bearerToken/.test(userEdgeAuthHelper) &&
    /\^Bearer\\s\+\(\\S\+\)\$/i.test(userEdgeAuthHelper) &&
    /function bearerAuthorizationHeader/.test(userEdgeAuthHelper),
  'Shared user Edge auth helper must require a Bearer token and normalize forwarded Authorization headers.',
);
block(
  errors,
  /USER_EDGE_BODY_MAX_BYTES/.test(userEdgeBodyHelper) &&
    /16384/.test(userEdgeBodyHelper) &&
    /1024/.test(userEdgeBodyHelper) &&
    /65536/.test(userEdgeBodyHelper) &&
    /readLimitedText/.test(userEdgeBodyHelper) &&
    /reader\.cancel/.test(userEdgeBodyHelper),
  'Shared user Edge body helper must bound USER_EDGE_BODY_MAX_BYTES from 1024 to 65536 and cancel oversized streams.',
);
block(
  errors,
  /EDGE_EXTERNAL_FETCH_TIMEOUT_MS/.test(externalFetchHelper) &&
    /EDGE_EXTERNAL_RESPONSE_MAX_BYTES/.test(externalFetchHelper) &&
    /AbortController/.test(externalFetchHelper) &&
    /fetchWithTimeout/.test(externalFetchHelper) &&
    /readLimitedResponseText/.test(externalFetchHelper) &&
    /readLimitedResponseJson/.test(externalFetchHelper) &&
    /reader\.cancel/.test(externalFetchHelper),
  'Shared external fetch helper must enforce timeouts and bounded response reads.',
);
block(
  errors,
  /readEdgeAppEnvironment/.test(edgeEnvHelper) &&
    /resolveEdgeAppEnvironment/.test(edgeEnvHelper) &&
    /APP_ENV/.test(edgeEnvHelper) &&
    /EXPO_PUBLIC_APP_ENV/.test(edgeEnvHelper) &&
    /trim\(\)\.toLowerCase\(\)/.test(edgeEnvHelper) &&
    /APP_ENV_NOT_CONFIGURED/.test(edgeEnvHelper) &&
    /APP_ENV_INVALID/.test(edgeEnvHelper) &&
    /APP_ENV_CONFLICT/.test(edgeEnvHelper) &&
    !/\? candidate : 'production'/.test(edgeEnvHelper),
  'Shared Edge env helper must require APP_ENV and reject invalid or contradictory values.',
);
block(
  errors,
  /function booleanEnv/.test(edgeEnvHelper) &&
    /trim\(\)\.toLowerCase\(\)/.test(edgeEnvHelper) &&
    /invalidValue/.test(edgeEnvHelper),
  'Shared Edge env helper must normalize boolean envs and support explicit invalid-value fail-closed behavior.',
);
block(
  errors,
  /defaultHostedSupabaseKey/.test(supabaseKeyMapHelper) &&
    /JSON\.parse/.test(supabaseKeyMapHelper) &&
    /\.default/.test(supabaseKeyMapHelper) &&
    /_INVALID/.test(supabaseKeyMapHelper),
  'Shared Supabase key-map parser must resolve the default hosted key and fail closed on malformed maps.',
);
block(
  errors,
  /SUPABASE_PUBLISHABLE_KEYS/.test(supabasePublishableKeyHelper) &&
    /SUPABASE_PUBLISHABLE_KEY/.test(supabasePublishableKeyHelper) &&
    /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/.test(supabasePublishableKeyHelper) &&
    /SUPABASE_ANON_KEY/.test(supabasePublishableKeyHelper),
  'Shared publishable-key resolver must prefer hosted maps with singular/local/legacy fallback.',
);
block(
  errors,
  /SUPABASE_SECRET_KEYS/.test(supabaseSecretKeyHelper) &&
    /SUPABASE_SECRET_KEY/.test(supabaseSecretKeyHelper) &&
    /SUPABASE_SERVICE_ROLE_KEY/.test(supabaseSecretKeyHelper) &&
    !/EXPO_PUBLIC_/.test(supabaseSecretKeyHelper),
  'Shared secret-key resolver must prefer hosted maps, keep server-only fallbacks, and never read public env names.',
);
block(
  errors,
  clientSupabaseSecretReferences.length === 0,
  'Mobile source must never reference Supabase secret/service-role key variables.',
);

for (const fn of userJwtFunctions) {
  const source = read(`supabase/functions/${fn}/index.ts`);
  const handlerSource = source.slice(source.indexOf('Deno.serve'));
  block(errors, /auth\.getUser/.test(source), `${fn} must validate caller JWT with auth.getUser.`);
  block(
    errors,
    /bearer(?:Token|AuthorizationHeader)\(req\)/.test(source),
    `${fn} must use strict shared Bearer auth parsing.`,
  );
  block(
    errors,
    !/replace\(\s*\/\^?Bearer/.test(source),
    `${fn} must not strip Bearer auth with ad hoc string replacement.`,
  );
  block(
    errors,
    /401/.test(source) && /unauthorized/i.test(source),
    `${fn} must reject missing/wrong auth with 401.`,
  );
  block(
    errors,
    /req\.method === 'OPTIONS'/.test(handlerSource),
    `${fn} must return early for CORS preflight requests.`,
  );
  block(
    errors,
    /req\.method !== 'POST'/.test(handlerSource),
    `${fn} must reject non-POST execution methods.`,
  );
  block(
    errors,
    !/Access-Control-Allow-Methods': 'GET, POST, OPTIONS'/.test(source),
    `${fn} must not advertise GET for side-effecting user-JWT execution.`,
  );
  block(
    errors,
    handlerSource.indexOf("req.method !== 'POST'") !== -1 &&
      handlerSource.indexOf('auth.getUser') !== -1 &&
      handlerSource.indexOf("req.method !== 'POST'") < handlerSource.indexOf('auth.getUser'),
    `${fn} method check must run before caller auth resolution.`,
  );
  block(
    errors,
    /readSupabaseSecretKey/.test(source) &&
      !/Deno\.env\.get\(['"]SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)['"]\)/.test(source),
    `${fn} must resolve server credentials through the shared hosted-key helper.`,
  );
}

for (const fn of ['growth-event', 'order-report-poll', 'revenuecat-webhook', 'waitlist']) {
  const source = read(`supabase/functions/${fn}/index.ts`);
  block(
    errors,
    /readSupabaseSecretKey/.test(source) &&
      !/Deno\.env\.get\(['"]SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)['"]\)/.test(source),
    `${fn} must resolve server credentials through the shared hosted-key helper.`,
  );
}

for (const fn of ['catalog-lookup', 'catalog-report', 'catalog-search', 'data-export']) {
  const source = read(`supabase/functions/${fn}/index.ts`);
  block(
    errors,
    /readSupabasePublishableKey/.test(source) &&
      !/Deno\.env\.get\(['"](?:EXPO_PUBLIC_)?SUPABASE_(?:PUBLISHABLE_KEY|ANON_KEY)['"]\)/.test(
        source,
      ),
    `${fn} must resolve public credentials through the shared hosted-key helper.`,
  );
}

for (const fn of [
  'account-deletion',
  'catalog-lookup',
  'waitlist',
  'growth-event',
  'order-report-poll',
]) {
  const source = read(`supabase/functions/${fn}/index.ts`);
  block(
    errors,
    externalProviderFetchChecks(source),
    `${fn} external provider calls must use timed fetches and bounded response readers.`,
  );
}

for (const fn of bodyLimitedUserJwtFunctions) {
  const source = read(`supabase/functions/${fn}/index.ts`);
  block(
    errors,
    userEdgeBodyLimitChecks(source, fn),
    `${fn} must reject oversized user Edge request bodies before auth/body parsing work.`,
  );
}

const subscriptionGrants = read('supabase/functions/subscription-grants/index.ts');
block(
  errors,
  !/error:\s*(grantErr|error)\.message/.test(subscriptionGrants),
  'subscription-grants must not return raw database errors.',
);
block(
  errors,
  /reverse_trial_grant_failed/.test(subscriptionGrants),
  'subscription-grants must return a stable reverse-trial grant failure code.',
);
block(
  errors,
  /active_subscription_exists/.test(subscriptionGrants),
  'subscription-grants must return a stable active-subscription conflict code.',
);
block(
  errors,
  /reverse_trial_already_used/.test(subscriptionGrants),
  'subscription-grants must return a stable already-used reverse-trial conflict code.',
);
block(
  errors,
  /readEdgeAppEnvironment/.test(subscriptionGrants) &&
    !/Deno\.env\.get\(['"]APP_ENV['"]\)\s*\?\?/.test(subscriptionGrants),
  'subscription-grants must use the shared fail-closed app-environment resolver.',
);

const catalogReport = read('supabase/functions/catalog-report/index.ts');
const catalogReportPrivacy = read('supabase/functions/catalog-report/privacy.ts');
block(
  errors,
  /allowedTopLevelKeys/.test(catalogReport),
  'catalog-report must reject unknown top-level request fields.',
);
block(
  errors,
  /allowedPayloadKeys/.test(catalogReport),
  'catalog-report must allowlist proposed payload keys.',
);
block(
  errors,
  /allowedContextKeys/.test(catalogReport),
  'catalog-report must allowlist client context keys.',
);
block(
  errors,
  /sensitiveText/.test(catalogReportPrivacy),
  'catalog-report must filter sensitive support payload text.',
);
block(
  errors,
  /unexpected_field/.test(catalogReport),
  'catalog-report must return a stable code for unexpected request fields.',
);
block(
  errors,
  /invalid_proposed_payload/.test(catalogReport),
  'catalog-report must reject invalid proposed payload objects.',
);
block(
  errors,
  /invalid_client_context/.test(catalogReport),
  'catalog-report must reject invalid client context objects.',
);
block(
  errors,
  /proposed_payload:\s*proposedPayload\.value/.test(catalogReport),
  'catalog-report must write sanitized proposed payloads only.',
);
block(
  errors,
  /client_context:\s*clientContext\.value/.test(catalogReport),
  'catalog-report must write sanitized client context only.',
);
block(
  errors,
  !/proposed_payload:\s*body\.proposedPayload/.test(catalogReport),
  'catalog-report must not persist raw proposedPayload.',
);
block(
  errors,
  !/client_context:\s*body\.clientContext/.test(catalogReport),
  'catalog-report must not persist raw clientContext.',
);
block(
  errors,
  /safeUrl/.test(catalogReportPrivacy),
  'catalog-report must normalize URLs and drop query strings before support storage.',
);
block(
  errors,
  /Number\.isFinite/.test(catalogReportPrivacy),
  'catalog-report must reject non-finite numeric payload values.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase4:catalog-report-privacy-smoke']),
  'package.json is missing phase4:catalog-report-privacy-smoke.',
);

const catalogLookup = read('supabase/functions/catalog-lookup/index.ts');
block(
  errors,
  !/req\.method === 'GET'/.test(catalogLookup),
  'catalog-lookup must not support GET because lookups write caller telemetry and can call external catalog APIs.',
);
block(
  errors,
  !/searchParams\.get\('barcode'\)/.test(catalogLookup),
  'catalog-lookup must not accept barcodes from query strings.',
);

function orderedCatalogRateLimit(source, scope, firstBodyMarker, firstWorkMarker) {
  const handlerSource = source.slice(source.indexOf('Deno.serve'));
  return (
    handlerSource.includes(`enforceRateLimit(admin, '${scope}', userId)`) &&
    handlerSource.indexOf(`enforceRateLimit(admin, '${scope}', userId)`) <
      handlerSource.indexOf(firstBodyMarker) &&
    handlerSource.indexOf(`enforceRateLimit(admin, '${scope}', userId)`) <
      handlerSource.indexOf(firstWorkMarker)
  );
}

for (const [label, source, scope, firstBodyMarker, firstWorkMarker] of [
  [
    'catalog-search',
    read('supabase/functions/catalog-search/index.ts'),
    'catalog-search',
    'readLimitedJson(req',
    'admin.rpc(CATALOG_SEARCH_RPC',
  ],
  [
    'catalog-lookup',
    catalogLookup,
    'catalog-lookup',
    'requestBarcode(req)',
    'fetchOpenBeautyFacts',
  ],
]) {
  block(
    errors,
    /CATALOG_RATE_LIMIT_MAX/.test(source),
    `${label} must use catalog-specific rate-limit max.`,
  );
  block(
    errors,
    /CATALOG_RATE_LIMIT_WINDOW_SECONDS/.test(source),
    `${label} must use catalog-specific rate-limit window.`,
  );
  block(
    errors,
    /consume_edge_rate_limit/.test(source),
    `${label} must use the shared Postgres rate-limit RPC.`,
  );
  block(
    errors,
    /hmacSha256Hex/.test(source) && /keyHash/.test(source) && /serviceKey/.test(source),
    `${label} must keyed-hash user identity before rate-limit storage.`,
  );
  block(
    errors,
    /CATALOG_RATE_LIMIT_FAILED/.test(source),
    `${label} must log only a stable rate-limit failure code.`,
  );
  block(
    errors,
    /rate_limit_unavailable/.test(source),
    `${label} must fail closed when the rate limiter is unavailable.`,
  );
  block(
    errors,
    /429/.test(source) && /rate_limited/.test(source),
    `${label} must return 429 when the caller is rate-limited.`,
  );
  block(
    errors,
    orderedCatalogRateLimit(source, scope, firstBodyMarker, firstWorkMarker),
    `${label} must rate-limit before request body parsing, external calls, service-role catalog reads, or telemetry writes.`,
  );
}

block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-catalog-rate-limit']),
  'package.json is missing phase9:live-catalog-rate-limit.',
);
block(
  errors,
  /PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT/.test(liveCatalogRateLimit) &&
    /PHASE9_ALLOW_PRODUCTION_LIVE_CATALOG_RATE_LIMIT/.test(liveCatalogRateLimit) &&
    /docs\/phase-9\/generated\/live-catalog-rate-limit\.json/.test(liveCatalogRateLimit),
  'Live catalog rate-limit harness must be explicit-flagged, production-guarded, and write evidence artifacts.',
);
block(
  errors,
  /catalog-search returns 429 after configured user rate limit/.test(liveCatalogRateLimit) &&
    /catalog-lookup returns 429 after configured user rate limit/.test(liveCatalogRateLimit) &&
    /Retry-After/.test(liveCatalogRateLimit) &&
    /edge_rate_limits stores keyed hashes only for catalog scopes/.test(liveCatalogRateLimit),
  'Live catalog rate-limit harness must prove search/lookup 429 behavior, Retry-After, and keyed-hash storage.',
);
block(
  errors,
  /query: 'x'/.test(liveCatalogRateLimit) &&
    /barcode: '123'/.test(liveCatalogRateLimit) &&
    /catalog_lookup_events/.test(liveCatalogRateLimit),
  'Live catalog rate-limit harness must use safe probes and prove they avoid catalog lookup telemetry writes.',
);
block(
  errors,
  /createHmac/.test(liveCatalogRateLimit) &&
    /\$\{scope\}\|\$\{userId\}/.test(liveCatalogRateLimit) &&
    /keyHashRedacted/.test(liveCatalogRateLimit),
  'Live catalog rate-limit harness must derive the expected HMAC key and redact evidence samples.',
);

const shelfDetail = read('apps/mobile/src/app/shelf/[id].tsx');
block(
  errors,
  !/shelfProductId/.test(shelfDetail),
  'catalog-report client context must not send local shelf product IDs.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-edge-auth']),
  'package.json is missing phase9:live-edge-auth.',
);
block(
  errors,
  /PHASE9_RUN_LIVE_EDGE_AUTH/.test(liveEdgeAuth) &&
    /PHASE9_ALLOW_PRODUCTION_LIVE_EDGE_AUTH/.test(liveEdgeAuth) &&
    /docs\/phase-9\/generated\/live-edge-auth\.json/.test(liveEdgeAuth),
  'Live Edge auth harness must be explicit-flagged, production-guarded, and write evidence artifacts.',
);
block(
  errors,
  /user Edge Functions reject missing JWT/.test(liveEdgeAuth) &&
    /user Edge Functions reject invalid JWT/.test(liveEdgeAuth),
  'Live Edge auth harness must cover missing and invalid JWT rejection.',
);
block(
  errors,
  /auth === 'raw'/.test(liveEdgeAuth) &&
    /user Edge Functions reject raw JWT without Bearer scheme/.test(liveEdgeAuth) &&
    /raw-JWT catalog call wrote lookup event/.test(liveEdgeAuth),
  'Live Edge auth harness must prove raw JWT Authorization headers are rejected without side effects.',
);
block(
  errors,
  /user Edge Functions reject valid JWT non-POST methods/.test(liveEdgeAuth) &&
    /user Edge Functions reject oversized bodies before side effects/.test(liveEdgeAuth) &&
    /USER_EDGE_BODY_MAX_BYTES/.test(liveEdgeAuth) &&
    /payload_too_large/.test(liveEdgeAuth) &&
    /methodRestrictedFunctions/.test(liveEdgeAuth) &&
    /assertMethodNotAllowed/.test(liveEdgeAuth) &&
    /valid-JWT non-POST catalog call wrote lookup event/.test(liveEdgeAuth) &&
    /oversized body catalog call wrote lookup event/.test(liveEdgeAuth) &&
    /valid-JWT non-POST subscription call wrote entitlement/.test(liveEdgeAuth) &&
    /oversized body subscription call wrote entitlement/.test(liveEdgeAuth) &&
    /valid-JWT non-POST consent-withdrawal wrote consent/.test(liveEdgeAuth) &&
    /oversized body consent-withdrawal wrote consent/.test(liveEdgeAuth) &&
    /valid-JWT non-POST account-deletion removed the live harness user/.test(liveEdgeAuth),
  'Live Edge auth harness must prove user-JWT functions reject valid-JWT non-POST and oversized body requests without side effects.',
);
block(
  errors,
  /subscription-grants valid JWT rejects unknown action without grant/.test(liveEdgeAuth) &&
    /unknown subscription action wrote entitlement/.test(liveEdgeAuth),
  'Live Edge auth harness must prove subscription-grants malformed actions do not grant entitlements.',
);
block(
  errors,
  /catalog-report valid JWT rejects malformed JSON and unknown fields/.test(liveEdgeAuth) &&
    /catalog-report valid JWT rejects invalid nested payload shapes/.test(liveEdgeAuth) &&
    /catalog-report valid JWT stores sanitized report payload only/.test(liveEdgeAuth),
  'Live Edge auth harness must cover catalog-report malformed, unknown-field, nested-shape, and sanitized-persistence paths.',
);

const revenueCat = read('supabase/functions/revenuecat-webhook/index.ts');
const revenueCatCore = read('supabase/functions/revenuecat-webhook/webhookCore.ts');
const revenueCatAtomicMigration = read(
  'supabase/migrations/20260713000041_revenuecat_webhook_atomic_projection.sql',
);
const revenueCatHandler = revenueCat.slice(revenueCat.indexOf('Deno.serve'));
block(
  errors,
  /REVENUECAT_WEBHOOK_AUTH/.test(revenueCat),
  'RevenueCat webhook must verify shared auth header.',
);
block(
  errors,
  /constantTimeEqualString/.test(revenueCat) &&
    /constantTimeEqualString\(authHeader,\s*webhookAuth\)/.test(revenueCat),
  'RevenueCat webhook shared auth must use constant-time string comparison.',
);
block(
  errors,
  /REVENUECAT_WEBHOOK_SIGNING_SECRET/.test(revenueCat),
  'RevenueCat webhook must support HMAC signing secret.',
);
block(
  errors,
  /intEnv\(\s*'REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS'\s*,\s*300\s*,\s*1\s*,\s*3600\s*,?\s*\)/.test(
    revenueCat,
  ),
  'RevenueCat webhook signature tolerance must be bounded and fail safe.',
);
block(
  errors,
  /intEnv\('REVENUECAT_WEBHOOK_MAX_BYTES',\s*65536,\s*1024,\s*262144\)/.test(revenueCat),
  'RevenueCat webhook body limit must be bounded and fail safe.',
);
block(
  errors,
  /readLimitedText/.test(revenueCat),
  'RevenueCat webhook must use a bounded raw-body reader.',
);
block(
  errors,
  /payload too large/.test(revenueCat) && /413/.test(revenueCat),
  'RevenueCat webhook must reject oversized bodies with 413.',
);
block(
  errors,
  /X-RevenueCat-Webhook-Signature/.test(revenueCat),
  'RevenueCat webhook must read signature header.',
);
block(
  errors,
  /stale_signature/.test(revenueCat),
  'RevenueCat webhook must reject stale signatures.',
);
block(
  errors,
  !/bad signature:\s*\$\{signature\.reason\}/.test(revenueCat),
  'RevenueCat webhook must not return raw signature failure reasons.',
);
block(
  errors,
  /return json\('bad signature', 401\)/.test(revenueCat),
  'RevenueCat webhook must return a stable public signature failure.',
);
block(
  errors,
  /req\.method !== 'POST'/.test(revenueCat),
  'RevenueCat webhook must reject non-POST methods before verification work.',
);
block(
  errors,
  revenueCatHandler.indexOf("req.method !== 'POST'") !== -1 &&
    revenueCatHandler.indexOf('readLimitedText') !== -1 &&
    revenueCatHandler.indexOf("req.method !== 'POST'") <
      revenueCatHandler.indexOf('readLimitedText'),
  'RevenueCat webhook method check must run before reading the raw body.',
);
block(
  errors,
  revenueCatHandler.indexOf('webhook verification not configured') !== -1 &&
    revenueCatHandler.indexOf('readLimitedText') !== -1 &&
    revenueCatHandler.indexOf('webhook verification not configured') <
      revenueCatHandler.indexOf('readLimitedText'),
  'RevenueCat webhook must fail closed for missing verification before reading the raw body.',
);
block(
  errors,
  revenueCatHandler.indexOf('!authVerified') !== -1 &&
    revenueCatHandler.indexOf('readLimitedText') !== -1 &&
    revenueCatHandler.indexOf('!authVerified') < revenueCatHandler.indexOf('readLimitedText'),
  'RevenueCat webhook must reject bad shared auth before reading the raw body.',
);
block(
  errors,
  /!webhookAuth\s*&&\s*!signingSecret/.test(revenueCat) &&
    /webhook verification not configured/.test(revenueCat) &&
    /503/.test(revenueCat),
  'RevenueCat webhook must fail closed when no auth or signing secret is configured.',
);
block(
  errors,
  /sanitizeRevenueCatEvent/.test(revenueCatCore),
  'RevenueCat webhook must sanitize provider events before JSON persistence.',
);
block(
  errors,
  /p_payload:\s*\{\s*event:\s*sanitizedEvent\s*\}/.test(revenueCatCore),
  'RevenueCat webhook must persist only sanitized subscription event payloads.',
);
block(
  errors,
  /coalesce\(p_payload\s*->\s*'event',\s*'\{\}'::jsonb\)/.test(revenueCatAtomicMigration),
  'RevenueCat webhook must persist only sanitized entitlement raw_status snapshots.',
);
block(
  errors,
  /REVENUECAT_ATOMIC_PROCESSING_FAILED:/.test(revenueCatAtomicMigration) &&
    /return json\('processing failed',\s*503\)/.test(revenueCat),
  'RevenueCat webhook must persist a stable failure code and request provider retry.',
);
block(
  errors,
  !/error:\s*error\?\.message/.test(revenueCat) &&
    !/error:\s*error\?\.message/.test(revenueCatCore),
  'RevenueCat webhook must not persist raw entitlement write errors.',
);
block(
  errors,
  !/payload:\s*body/.test(revenueCat),
  'RevenueCat webhook must not persist the raw parsed webhook body.',
);
block(
  errors,
  !/raw_status:\s*event/.test(revenueCat) && !/raw_status:\s*event/.test(revenueCatCore),
  'RevenueCat webhook must not persist the raw provider event.',
);
block(
  errors,
  /persistRevenueCatEvent\(supabase,\s*atomicArgs\)/.test(revenueCat) &&
    /on conflict \(rc_event_id\) do nothing/.test(revenueCatAtomicMigration) &&
    /excluded\.rc_event_at > entitlement_projection\.rc_event_at/.test(revenueCatAtomicMigration) &&
    /pg_catalog\.convert_to\(excluded\.rc_event_id/.test(revenueCatAtomicMigration) &&
    !/\.from\('subscriptions_events'\)/.test(revenueCatHandler) &&
    !/\.from\('entitlements'\)/.test(revenueCatHandler),
  'RevenueCat webhook must delegate idempotency and ordered event/projection writes to one atomic RPC.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-revenuecat-webhook']),
  'package.json is missing phase9:live-revenuecat-webhook.',
);
block(
  errors,
  /revenuecat-webhook rejects invalid shared auth/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook rejects non-POST methods before writes/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook rejects invalid HMAC signature/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook rejects stale HMAC signature/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook rejects oversized raw bodies before writes/.test(liveRevenueCatWebhook) &&
    /oversizedEventBody/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook deduplicates repeated event id/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook keeps entitlement active on renewal/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook keeps access but stops renewal on cancellation/.test(
      liveRevenueCatWebhook,
    ) &&
    /revenuecat-webhook keeps billing-issue access active while renewal can recover/.test(
      liveRevenueCatWebhook,
    ) &&
    /revenuecat-webhook deactivates entitlement on expiration/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook revokes entitlement on refund/.test(liveRevenueCatWebhook) &&
    /revenuecat-webhook records reordered stale events without regressing entitlement/.test(
      liveRevenueCatWebhook,
    ) &&
    /revenuecat-webhook does not persist raw provider payload fields/.test(liveRevenueCatWebhook) &&
    /subscriber_attributes/.test(liveRevenueCatWebhook) &&
    /raw_receipt/.test(liveRevenueCatWebhook) &&
    /assertNoRawRevenueCatPayload/.test(liveRevenueCatWebhook) &&
    /PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK/.test(liveRevenueCatWebhook),
  'Live RevenueCat webhook harness must test auth, HMAC, duplicate, lifecycle, refund, and raw payload minimization paths behind an explicit run flag.',
);

const growth = read('supabase/functions/growth-event/index.ts');
block(errors, /allowedEvents/.test(growth), 'growth-event must allowlist event names.');
block(errors, /allowedKeys/.test(growth), 'growth-event must allowlist payload keys.');
block(errors, /sensitive/.test(growth), 'growth-event must drop sensitive payloads.');
block(
  errors,
  /readEdgeAppEnvironment/.test(growth),
  'growth-event must use normalized app env parsing.',
);
block(
  errors,
  /booleanEnv\('PUBLIC_FORMS_TURNSTILE_REQUIRED',\s*\{\s*invalidValue:\s*true\s*\}\)/.test(growth),
  'growth-event must require Turnstile on malformed PUBLIC_FORMS_TURNSTILE_REQUIRED values.',
);
block(
  errors,
  /verifyTurnstile/.test(growth),
  'growth-event must verify Turnstile for production abuse control.',
);
block(
  errors,
  /turnstile not configured/.test(growth),
  'growth-event must fail closed when production Turnstile is not configured.',
);
block(
  errors,
  /consume_edge_rate_limit/.test(growth),
  'growth-event must use the shared Postgres rate-limit RPC.',
);
block(
  errors,
  /hmacSha256Hex/.test(growth) && /keyHash/.test(growth) && /serviceKey/.test(growth),
  'growth-event must keyed-hash request identity before rate-limit storage.',
);
block(
  errors,
  /429/.test(growth) && /rate limited/.test(growth),
  'growth-event must return 429 when rate-limited.',
);
block(
  errors,
  orderedPublicFormChecks(growth, 'growth-event'),
  'growth-event must rate-limit before external Turnstile verification.',
);
block(
  errors,
  publicFormBodyLimitChecks(growth, 'growth-event'),
  'growth-event must reject oversized public-form bodies before rate-limit/body parsing work.',
);

const waitlist = read('supabase/functions/waitlist/index.ts');
block(errors, /invalid email/.test(waitlist), 'waitlist must validate email.');
block(errors, /allowedAttributionKeys/.test(waitlist), 'waitlist attribution must be allowlisted.');
block(errors, /sanitizeAttribution/.test(waitlist), 'waitlist attribution must be sanitized.');
block(
  errors,
  /readEdgeAppEnvironment/.test(waitlist),
  'waitlist must use normalized app env parsing.',
);
block(
  errors,
  /booleanEnv\('PUBLIC_FORMS_TURNSTILE_REQUIRED',\s*\{\s*invalidValue:\s*true\s*\}\)/.test(
    waitlist,
  ),
  'waitlist must require Turnstile on malformed PUBLIC_FORMS_TURNSTILE_REQUIRED values.',
);
block(
  errors,
  /verifyTurnstile/.test(waitlist),
  'waitlist must verify Turnstile for production abuse control.',
);
block(
  errors,
  /turnstile not configured/.test(waitlist),
  'waitlist must fail closed when production Turnstile is not configured.',
);
block(
  errors,
  /consume_edge_rate_limit/.test(waitlist),
  'waitlist must use the shared Postgres rate-limit RPC.',
);
block(
  errors,
  /hmacSha256Hex/.test(waitlist) && /keyHash/.test(waitlist) && /serviceKey/.test(waitlist),
  'waitlist must keyed-hash request identity before rate-limit storage.',
);
block(
  errors,
  /429/.test(waitlist) && /rate limited/.test(waitlist),
  'waitlist must return 429 when rate-limited.',
);
block(
  errors,
  orderedPublicFormChecks(waitlist, 'waitlist'),
  'waitlist must rate-limit before external Turnstile verification.',
);
block(
  errors,
  publicFormBodyLimitChecks(waitlist, 'waitlist'),
  'waitlist must reject oversized public-form bodies before rate-limit/body parsing work.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-public-forms']),
  'package.json is missing phase9:live-public-forms.',
);
block(
  errors,
  /waitlist rejects missing Turnstile token/.test(livePublicForms) &&
    /growth-event rejects invalid Turnstile token/.test(livePublicForms) &&
    /waitlist rejects oversized public-form body before writes/.test(livePublicForms) &&
    /growth-event rejects oversized public-form body before writes/.test(livePublicForms) &&
    /oversizedPublicFormBody/.test(livePublicForms) &&
    /waitlist returns 429 after configured public-form rate limit/.test(livePublicForms) &&
    /growth-event returns 429 after configured public-form rate limit/.test(livePublicForms) &&
    /public-form edge_rate_limits stores keyed hashes only/.test(livePublicForms) &&
    /Retry-After/.test(livePublicForms) &&
    /keyHashRedacted/.test(livePublicForms) &&
    /PHASE9_RUN_LIVE_PUBLIC_FORMS/.test(livePublicForms),
  'Live public-form harness must test waitlist/growth Turnstile negatives, 429 rate limits, Retry-After, and keyed-hash evidence behind an explicit run flag.',
);
block(
  errors,
  /cf-connecting-ip/.test(livePublicForms) &&
    /turnstile required/.test(livePublicForms) &&
    /public-form rate-limit probes avoid form writes/.test(livePublicForms),
  'Live public-form harness must use missing-token rate-limit probes and prove they avoid form writes.',
);

const rateLimitMigration = read('supabase/migrations/20260705000029_phase9_edge_rate_limits.sql');
block(
  errors,
  /create table if not exists public\.edge_rate_limits/.test(rateLimitMigration),
  'edge rate-limit migration must create edge_rate_limits.',
);
block(
  errors,
  /alter table public\.edge_rate_limits enable row level security/.test(rateLimitMigration),
  'edge_rate_limits must have RLS enabled.',
);
block(
  errors,
  /create or replace function public\.consume_edge_rate_limit/.test(rateLimitMigration),
  'edge rate-limit migration must create consume_edge_rate_limit.',
);
block(
  errors,
  /security definer/i.test(rateLimitMigration),
  'consume_edge_rate_limit must be SECURITY DEFINER for service-role RPC writes.',
);
block(
  errors,
  /set search_path = ''/.test(rateLimitMigration),
  'consume_edge_rate_limit must pin an empty search_path.',
);
block(
  errors,
  /revoke all on function public\.consume_edge_rate_limit/.test(rateLimitMigration),
  'consume_edge_rate_limit must be revoked from public client roles.',
);
block(
  errors,
  /grant execute on function public\.consume_edge_rate_limit\(text, text, integer, integer\) to service_role/.test(
    rateLimitMigration,
  ),
  'consume_edge_rate_limit must only be executable by service_role.',
);
block(
  errors,
  /Stores only keyed-hashed request keys/.test(rateLimitMigration),
  'edge rate-limit migration must document that raw IPs/user agents are not persisted.',
);

const poll = read('supabase/functions/order-report-poll/index.ts');
const pollCore = read('supabase/functions/order-report-poll/orderAttributionCore.ts');
const pollCoreTest = read('supabase/functions/order-report-poll/orderAttributionCore.test.ts');
block(
  errors,
  /SHOPMY_BRAND_API_KEY/.test(poll),
  'order-report-poll must require ShopMy brand API key before polling.',
);
block(errors, /no brand API key/.test(poll), 'order-report-poll must no-op without ShopMy key.');
block(
  errors,
  /SHOPMY_BRAND_DOMAIN/.test(poll) && /shopmy_brand_domain_not_configured/.test(poll),
  'order-report-poll must require a server-only registered ShopMy brand domain when activated.',
);
block(
  errors,
  /ORDER_REPORT_POLL_SECRET/.test(poll),
  'order-report-poll must require a scheduler secret before activation.',
);
block(
  errors,
  /req\.method !== 'POST'/.test(poll) && /method_not_allowed/.test(poll),
  'order-report-poll must reject non-POST methods.',
);
block(
  errors,
  /scheduler_secret_not_configured/.test(poll),
  'order-report-poll must fail closed when ShopMy key exists but scheduler secret is missing.',
);
block(
  errors,
  /authorizedSchedulerRequest/.test(poll),
  'order-report-poll must validate scheduler authorization before polling.',
);
block(
  errors,
  /Authorization/.test(poll) && /x-scheduler-secret/.test(poll),
  'order-report-poll must support explicit scheduler secret headers.',
);
block(
  errors,
  /constantTimeEqual/.test(poll),
  'order-report-poll must compare scheduler secrets without direct string equality.',
);
block(
  errors,
  poll.indexOf("req.method !== 'POST'") !== -1 &&
    poll.indexOf('!shopmyBrandKey') !== -1 &&
    poll.indexOf("req.method !== 'POST'") < poll.indexOf('!shopmyBrandKey'),
  'order-report-poll method check must run before inert/no-op handling.',
);
block(
  errors,
  poll.indexOf('authorizedSchedulerRequest(req)') !== -1 &&
    poll.indexOf('fetchWithTimeout(ORDER_REPORT_URL') !== -1 &&
    poll.indexOf('authorizedSchedulerRequest(req)') <
      poll.indexOf('fetchWithTimeout(ORDER_REPORT_URL'),
  'order-report-poll scheduler authorization must run before the ShopMy API call.',
);
block(
  errors,
  /https:\/\/api\.shopmy\.us\/v1\/Partners\/OrderReport/.test(poll) &&
    /Authorization:\s*`Bearer \$\{shopmyBrandKey\}`/.test(poll) &&
    /domain:\s*shopmyBrandDomain/.test(poll) &&
    !/x-api-key/.test(poll),
  'order-report-poll must use the official ShopMy endpoint, Bearer authentication, and registered-domain body.',
);
block(
  errors,
  /for \(let page = 0; page < maxPages; page \+= 1\)/.test(pollCore) &&
    /limit:\s*pageSize/.test(pollCore) &&
    /ORDER_REPORT_PAGE_LIMIT_EXCEEDED/.test(pollCore) &&
    /order_report_page_limit_exceeded/.test(pollCore) &&
    /order_report_upstream_failed/.test(pollCore) &&
    /official ShopMy wire fixture/.test(pollCoreTest) &&
    /max-page truncation/.test(pollCoreTest),
  'order-report-poll must test zero-indexed bounded pagination and map incomplete/upstream responses to stable non-2xx failures.',
);
block(
  errors,
  /'Order ID'/.test(pollCore) &&
    /'Order Amount USD'/.test(pollCore) &&
    /'Commission Amount USD'/.test(pollCore) &&
    /not expose a click-token/.test(pollCore) &&
    /click_token === null/.test(pollCoreTest),
  'order-report-poll must adapt the documented display-key wire DTO without inventing click attribution.',
);
warn(
  warnings,
  !/INERT STUB/i.test(poll),
  'order-report-poll remains inert until ShopMy account model and API key are approved.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-order-report-poll']),
  'package.json is missing phase9:live-order-report-poll.',
);
block(
  errors,
  /PHASE9_RUN_LIVE_ORDER_REPORT_POLL/.test(liveOrderReportPoll) &&
    /PHASE9_ALLOW_PRODUCTION_LIVE_ORDER_REPORT_POLL/.test(liveOrderReportPoll) &&
    /docs\/phase-9\/generated\/live-order-report-poll\.json/.test(liveOrderReportPoll),
  'Live order-report-poll harness must be explicit-flagged, production-guarded, and write evidence artifacts.',
);
block(
  errors,
  /order-report-poll rejects non-POST before service-role work/.test(liveOrderReportPoll) &&
    /order-report-poll missing scheduler secret does not write attributions/.test(
      liveOrderReportPoll,
    ) &&
    /order-report-poll wrong scheduler secret does not write attributions/.test(
      liveOrderReportPoll,
    ) &&
    /order-report-poll evidence avoids authorized ShopMy polling/.test(liveOrderReportPoll),
  'Live order-report-poll harness must prove method rejection and missing/wrong scheduler secret no-write behavior.',
);
block(
  errors,
  /Authorized scheduler success path intentionally not run/.test(liveOrderReportPoll) &&
    !/ORDER_REPORT_POLL_SECRET/.test(liveOrderReportPoll) &&
    !/SHOPMY_ORDER_REPORT_POLL_SECRET/.test(liveOrderReportPoll) &&
    !/SHOPMY_BRAND_API_KEY/.test(liveOrderReportPoll) &&
    !/SHOPMY_BRAND_DOMAIN/.test(liveOrderReportPoll) &&
    /PHASE9_ORDER_REPORT_POLL_ACTIVATED_EXPECTED/.test(liveOrderReportPoll),
  'Live order-report-poll harness must not read/send ShopMy activation values or the real scheduler secret and must support activated-env expectations.',
);

warn(
  warnings,
  evidenceFlagEnabled(process.env.PHASE9_EDGE_AUTH_PASS),
  'Missing live Edge auth negative-test evidence: PHASE9_EDGE_AUTH_PASS=true.',
);

printResult('Phase 9 Edge auth smoke', errors, warnings);
