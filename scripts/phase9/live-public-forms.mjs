#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import {
  block,
  envSnapshot,
  placeholderEnvValue,
  printResult,
  readScriptAppEnvironment,
  redactedErrorKind,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const checks = [];
const samples = [];
const env = envSnapshot();

const runLive = env.PHASE9_RUN_LIVE_PUBLIC_FORMS === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const validTurnstileToken = env.PHASE9_TURNSTILE_VALID_TOKEN ?? '';
const publicFormsRateLimitMax = intEnv('PUBLIC_FORMS_RATE_LIMIT_MAX', 20, 1, 1000);
const publicFormsMaxBytes = intEnv('PUBLIC_FORMS_MAX_BYTES', 8192, 1024, 65536);
const probeBudget = intEnv(
  'PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX',
  Math.min(publicFormsRateLimitMax + 2, 1002),
  2,
  1100,
);

const artifact = {
  status: runLive ? 'running' : 'not-run',
  appEnvironment: appEnv,
  supabaseHost: safeHost(supabaseUrl),
  publicFormsRateLimitMax,
  publicFormsMaxBytes,
  probeBudget,
  checks,
  samples,
  warnings,
  errors,
};

function safeHost(value) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return 'invalid-url';
  }
}

const placeholder = placeholderEnvValue;

function intEnv(name, fallback, min, max) {
  const value = Number(env[name]);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function resultError(error) {
  return error instanceof Error ? error.message : String(error);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function record(name, status, detail = '') {
  checks.push({ name, status, detail });
}

function writeArtifacts(status) {
  artifact.status = status;
  if (status === 'pass' || status === 'fail') artifact.ranAt = new Date().toISOString();
  write('docs/phase-9/generated/live-public-forms.json', `${JSON.stringify(artifact, null, 2)}\n`);
  write(
    'docs/phase-9/generated/live-public-forms.md',
    [
      '# Live public forms evidence',
      '',
      `- Status: ${artifact.status}`,
      `- Environment: ${artifact.appEnvironment}`,
      `- Supabase host: ${artifact.supabaseHost ?? 'not configured'}`,
      `- Configured max: ${artifact.publicFormsRateLimitMax}`,
      `- Body max bytes: ${artifact.publicFormsMaxBytes}`,
      `- Probe budget: ${artifact.probeBudget}`,
      '',
      '## Checks',
      checks.length
        ? checks
            .map(
              (check) =>
                `- ${check.status.toUpperCase()}: ${check.name}${check.detail ? ` - ${check.detail}` : ''}`,
            )
            .join('\n')
        : '- Not run.',
      '',
      '## Redacted Rate-Limit Samples',
      samples.length
        ? samples
            .map(
              (sample) =>
                `- ${sample.scope}: count=${sample.requestCount}, window=${sample.windowSeconds}s, key=${sample.keyHashRedacted}`,
            )
            .join('\n')
        : '- None.',
      '',
      '## Warnings',
      warnings.length ? warnings.map((warning) => `- ${warning}`).join('\n') : '- None.',
      '',
      '## Errors',
      errors.length ? errors.map((error) => `- ${error}`).join('\n') : '- None.',
      '',
    ].join('\n'),
  );
}

async function runCheck(name, fn) {
  try {
    await fn();
    record(name, 'pass');
  } catch (error) {
    const message = resultError(error);
    record(name, 'fail', message);
    errors.push(`${name}: ${message}`);
  }
}

function functionUrl(name) {
  return `${supabaseUrl.replace(/\/+$/g, '')}/functions/v1/${name}`;
}

async function postFunction(name, body, token, extraHeaders = {}) {
  const headers = {
    apikey: publishableKey,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (token) headers['cf-turnstile-response'] = token;
  const response = await fetch(functionUrl(name), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
    text: await response.text(),
  };
}

async function postRawFunction(name, rawBody, extraHeaders = {}) {
  const response = await fetch(functionUrl(name), {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: rawBody,
  });
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
    text: await response.text(),
  };
}

function assertStatus(actual, expected, label, text) {
  assert(
    actual === expected,
    `${label}: expected HTTP ${expected}, got ${actual}${text ? ` (${text.slice(0, 120)})` : ''}.`,
  );
}

function assertRateLimited(response, label) {
  assert(
    response.status === 429,
    `${label}: expected HTTP 429, got ${response.status} (${response.text.slice(0, 120)}).`,
  );
  assert(
    /rate limited/i.test(response.text),
    `${label}: expected rate limited body, got ${response.text.slice(0, 120)}.`,
  );
  assert(/^\d+$/.test(response.retryAfter ?? ''), `${label}: expected numeric Retry-After header.`);
}

async function exhaustPublicFormScope({ functionName, scope, body, clientIp, userAgent }) {
  const headers = {
    'cf-connecting-ip': clientIp,
    'x-forwarded-for': clientIp,
    'x-real-ip': clientIp,
    'user-agent': userAgent,
  };
  for (let attempt = 1; attempt <= probeBudget; attempt += 1) {
    const response = await postFunction(functionName, body, '', headers);
    if (response.status === 429) {
      assertRateLimited(response, scope);
      return { attempts: attempt, retryAfter: response.retryAfter };
    }
    assertStatus(response.status, 403, `${scope} before limit`, response.text);
    assert(
      /turnstile required/i.test(response.text),
      `${scope} before limit did not return turnstile required.`,
    );
  }
  throw new Error(
    `${scope}: did not return 429 within ${probeBudget} attempts; check deployed PUBLIC_FORMS_RATE_LIMIT_MAX.`,
  );
}

function keyHashFor(scope, clientIp, userAgent) {
  return createHmac('sha256', secretKey).update(`${scope}|${clientIp}|${userAgent}`).digest('hex');
}

function oversizedPublicFormBody(fields) {
  return JSON.stringify({ ...fields, padding: 'x'.repeat(publicFormsMaxBytes + 1024) });
}

async function assertLimiterRow(admin, scope, clientIp, userAgent, attempts) {
  const keyHash = keyHashFor(scope, clientIp, userAgent);
  const { data, error } = await admin
    .from('edge_rate_limits')
    .select('scope,key_hash,window_seconds,request_count,updated_at')
    .eq('scope', scope)
    .eq('key_hash', keyHash)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  assert(row, `${scope}: expected an edge_rate_limits row for the synthetic public-form client.`);
  assert(
    /^[a-f0-9]{64}$/.test(row.key_hash),
    `${scope}: key_hash is not a 64-character lowercase hex digest.`,
  );
  assert(
    !JSON.stringify(row).includes(clientIp),
    `${scope}: edge_rate_limits row contains the raw client IP.`,
  );
  assert(
    !JSON.stringify(row).includes(userAgent),
    `${scope}: edge_rate_limits row contains the raw user agent.`,
  );
  assert(
    row.request_count >= attempts,
    `${scope}: request_count ${row.request_count} is lower than probe attempts ${attempts}.`,
  );
  assert(row.window_seconds >= 60, `${scope}: window_seconds must be at least 60.`);
  samples.push({
    scope,
    keyHashRedacted: `${row.key_hash.slice(0, 8)}...${row.key_hash.slice(-4)}`,
    keyHashLength: row.key_hash.length,
    requestCount: row.request_count,
    windowSeconds: row.window_seconds,
  });
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live public-forms harness not run; set PHASE9_RUN_LIVE_PUBLIC_FORMS=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live public forms', errors, warnings);
    return;
  }

  block(
    errors,
    !placeholder(supabaseUrl),
    'SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL is missing or placeholder.',
  );
  block(
    errors,
    !placeholder(publishableKey),
    'SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or placeholder.',
  );
  block(
    errors,
    !placeholder(secretKey),
    'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing or placeholder.',
  );
  block(
    errors,
    probeBudget > publicFormsRateLimitMax,
    'PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX must be greater than PUBLIC_FORMS_RATE_LIMIT_MAX.',
  );
  block(
    errors,
    appEnv !== 'production' || env.PHASE9_ALLOW_PRODUCTION_LIVE_PUBLIC_FORMS === 'true',
    'Refusing production public-form tests without PHASE9_ALLOW_PRODUCTION_LIVE_PUBLIC_FORMS=true.',
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live public forms', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const waitlistEmail = `phase9-public-forms-${runId}@example.invalid`;
  const shareId = `phase9-public-forms-${runId}`;
  const waitlistRateLimitEmail = `phase9-public-forms-rate-${runId}@example.invalid`;
  const waitlistOversizedEmail = `phase9-public-forms-oversized-${runId}@example.invalid`;
  const growthRateLimitShareId = `phase9-public-forms-rate-${runId}`;
  const growthOversizedShareId = `phase9-public-forms-oversized-${runId}`;
  const waitlistPayload = {
    email: waitlistEmail,
    source: 'phase9',
    medium: 'security',
    campaign: 'publicforms',
    body: 'must_drop_sensitive_key',
  };
  const growthPayload = {
    event: 'landing_viewed',
    source: 'phase9',
    medium: 'security',
    campaign: 'publicforms',
    share_id: shareId,
    email: 'must_drop_sensitive_key@example.invalid',
  };
  const waitlistRateLimitPayload = {
    email: waitlistRateLimitEmail,
    source: 'phase9',
    medium: 'security',
    campaign: 'publicformsratelimit',
  };
  const growthRateLimitPayload = {
    event: 'landing_viewed',
    source: 'phase9',
    medium: 'security',
    campaign: 'publicformsratelimit',
    share_id: growthRateLimitShareId,
  };
  const waitlistClientIp = '203.0.113.41';
  const growthClientIp = '203.0.113.42';
  const waitlistUserAgent = `phase9-public-forms-rate-limit/waitlist-${runId}`;
  const growthUserAgent = `phase9-public-forms-rate-limit/growth-${runId}`;

  try {
    await runCheck('waitlist rejects oversized public-form body before writes', async () => {
      const response = await postRawFunction(
        'waitlist',
        oversizedPublicFormBody({ email: waitlistOversizedEmail, source: 'phase9' }),
        {
          'cf-connecting-ip': '203.0.113.51',
          'user-agent': `phase9-public-forms-oversized/waitlist-${runId}`,
        },
      );
      assertStatus(response.status, 413, 'waitlist oversized body', response.text);
      assert(
        /payload too large/i.test(response.text),
        'waitlist oversized body did not return payload too large.',
      );
      const { data, error } = await admin
        .from('waitlist_signups')
        .select('email')
        .eq('email', waitlistOversizedEmail);
      if (error) throw error;
      assert((data ?? []).length === 0, 'waitlist oversized body wrote a waitlist row.');
    });

    await runCheck('growth-event rejects oversized public-form body before writes', async () => {
      const response = await postRawFunction(
        'growth-event',
        oversizedPublicFormBody({
          event: 'landing_viewed',
          source: 'phase9',
          share_id: growthOversizedShareId,
        }),
        {
          'cf-connecting-ip': '203.0.113.52',
          'user-agent': `phase9-public-forms-oversized/growth-${runId}`,
        },
      );
      assertStatus(response.status, 413, 'growth-event oversized body', response.text);
      assert(
        /payload too large/i.test(response.text),
        'growth-event oversized body did not return payload too large.',
      );
      const { data, error } = await admin
        .from('growth_events')
        .select('share_id')
        .eq('share_id', growthOversizedShareId);
      if (error) throw error;
      assert((data ?? []).length === 0, 'growth-event oversized body wrote a growth row.');
    });

    await runCheck('waitlist rejects missing Turnstile token', async () => {
      const response = await postFunction('waitlist', waitlistPayload, '');
      assertStatus(response.status, 403, 'waitlist missing token', response.text);
      assert(
        /turnstile required/i.test(response.text),
        'waitlist missing token did not return turnstile required.',
      );
    });

    await runCheck('growth-event rejects missing Turnstile token', async () => {
      const response = await postFunction('growth-event', growthPayload, '');
      assertStatus(response.status, 403, 'growth-event missing token', response.text);
      assert(
        /turnstile required/i.test(response.text),
        'growth-event missing token did not return turnstile required.',
      );
    });

    await runCheck('waitlist rejects invalid Turnstile token', async () => {
      const response = await postFunction('waitlist', waitlistPayload, `invalid-${runId}`);
      assertStatus(response.status, 403, 'waitlist invalid token', response.text);
      assert(
        /turnstile failed/i.test(response.text),
        'waitlist invalid token did not return turnstile failed.',
      );
    });

    await runCheck('growth-event rejects invalid Turnstile token', async () => {
      const response = await postFunction('growth-event', growthPayload, `invalid-${runId}`);
      assertStatus(response.status, 403, 'growth-event invalid token', response.text);
      assert(
        /turnstile failed/i.test(response.text),
        'growth-event invalid token did not return turnstile failed.',
      );
    });

    if (!validTurnstileToken) {
      warnings.push(
        'Valid Turnstile token path not run; set PHASE9_TURNSTILE_VALID_TOKEN for strict public-form evidence.',
      );
    } else {
      await runCheck(
        'waitlist accepts valid Turnstile token and sanitizes attribution',
        async () => {
          const response = await postFunction('waitlist', waitlistPayload, validTurnstileToken);
          assertStatus(response.status, 200, 'waitlist valid token', response.text);
          const { data, error } = await admin
            .from('waitlist_signups')
            .select('email, source, attribution')
            .eq('email', waitlistEmail)
            .single();
          if (error) throw error;
          assert(data.email === waitlistEmail, 'waitlist did not persist expected email.');
          assert(data.source === 'phase9', 'waitlist did not persist expected source.');
          assert(
            data.attribution?.body === undefined,
            'waitlist persisted a sensitive attribution key.',
          );
        },
      );

      await runCheck(
        'growth-event accepts valid Turnstile token and sanitizes payload',
        async () => {
          const response = await postFunction('growth-event', growthPayload, validTurnstileToken);
          assertStatus(response.status, 200, 'growth-event valid token', response.text);
          const { data, error } = await admin
            .from('growth_events')
            .select('event, source, medium, campaign, share_id')
            .eq('share_id', shareId)
            .single();
          if (error) throw error;
          assert(data.event === 'landing_viewed', 'growth-event did not persist expected event.');
          assert(data.source === 'phase9', 'growth-event did not persist expected source.');
          assert(data.share_id === shareId, 'growth-event did not persist expected share_id.');
        },
      );
    }

    await runCheck('waitlist returns 429 after configured public-form rate limit', async () => {
      const result = await exhaustPublicFormScope({
        functionName: 'waitlist',
        scope: 'waitlist',
        body: waitlistRateLimitPayload,
        clientIp: waitlistClientIp,
        userAgent: waitlistUserAgent,
      });
      await assertLimiterRow(
        admin,
        'waitlist',
        waitlistClientIp,
        waitlistUserAgent,
        result.attempts,
      );
    });

    await runCheck('growth-event returns 429 after configured public-form rate limit', async () => {
      const result = await exhaustPublicFormScope({
        functionName: 'growth-event',
        scope: 'growth-event',
        body: growthRateLimitPayload,
        clientIp: growthClientIp,
        userAgent: growthUserAgent,
      });
      await assertLimiterRow(
        admin,
        'growth-event',
        growthClientIp,
        growthUserAgent,
        result.attempts,
      );
    });

    await runCheck('public-form rate-limit probes avoid form writes', async () => {
      const { data: waitlistRows, error: waitlistError } = await admin
        .from('waitlist_signups')
        .select('email')
        .eq('email', waitlistRateLimitEmail);
      if (waitlistError) throw waitlistError;
      assert((waitlistRows ?? []).length === 0, 'waitlist rate-limit probes wrote a waitlist row.');

      const { data: growthRows, error: growthError } = await admin
        .from('growth_events')
        .select('share_id')
        .eq('share_id', growthRateLimitShareId);
      if (growthError) throw growthError;
      assert((growthRows ?? []).length === 0, 'growth-event rate-limit probes wrote a growth row.');
    });

    await runCheck('public-form edge_rate_limits stores keyed hashes only', async () => {
      assert(
        samples.length === 2,
        `expected two redacted limiter samples, found ${samples.length}.`,
      );
      for (const sample of samples) {
        assert(
          ['waitlist', 'growth-event'].includes(sample.scope),
          `unexpected limiter scope ${sample.scope}.`,
        );
        assert(sample.keyHashLength === 64, `${sample.scope}: key hash length must be 64.`);
        assert(
          sample.requestCount >= publicFormsRateLimitMax + 1,
          `${sample.scope}: request count did not exceed configured max.`,
        );
      }
    });
  } finally {
    const waitlistDelete = await admin.from('waitlist_signups').delete().eq('email', waitlistEmail);
    if (waitlistDelete.error)
      warnings.push(`Waitlist cleanup warning: ${redactedErrorKind(waitlistDelete.error)}`);
    const waitlistRateDelete = await admin
      .from('waitlist_signups')
      .delete()
      .eq('email', waitlistRateLimitEmail);
    if (waitlistRateDelete.error)
      warnings.push(
        `Waitlist rate-limit cleanup warning: ${redactedErrorKind(waitlistRateDelete.error)}`,
      );
    const waitlistOversizedDelete = await admin
      .from('waitlist_signups')
      .delete()
      .eq('email', waitlistOversizedEmail);
    if (waitlistOversizedDelete.error)
      warnings.push(
        `Waitlist oversized cleanup warning: ${redactedErrorKind(waitlistOversizedDelete.error)}`,
      );
    const growthDelete = await admin.from('growth_events').delete().eq('share_id', shareId);
    if (growthDelete.error)
      warnings.push(`Growth cleanup warning: ${redactedErrorKind(growthDelete.error)}`);
    const growthRateDelete = await admin
      .from('growth_events')
      .delete()
      .eq('share_id', growthRateLimitShareId);
    if (growthRateDelete.error)
      warnings.push(
        `Growth rate-limit cleanup warning: ${redactedErrorKind(growthRateDelete.error)}`,
      );
    const growthOversizedDelete = await admin
      .from('growth_events')
      .delete()
      .eq('share_id', growthOversizedShareId);
    if (growthOversizedDelete.error)
      warnings.push(
        `Growth oversized cleanup warning: ${redactedErrorKind(growthOversizedDelete.error)}`,
      );
  }

  writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live public forms', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live public forms', errors, warnings);
});
