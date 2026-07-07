#!/usr/bin/env node
import { createHmac, randomUUID } from 'node:crypto';
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
const env = envSnapshot();

const runLive = env.PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const webhookAuth = env.REVENUECAT_WEBHOOK_AUTH ?? '';
const signingSecret = env.REVENUECAT_WEBHOOK_SIGNING_SECRET ?? '';
const hasWebhookAuth = !placeholder(webhookAuth);
const hasSigningSecret = !placeholder(signingSecret);

const artifact = {
  status: runLive ? 'running' : 'not-run',
  appEnvironment: appEnv,
  supabaseHost: safeHost(supabaseUrl),
  checks,
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
  write(
    'docs/phase-9/generated/live-revenuecat-webhook.json',
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  write(
    'docs/phase-9/generated/live-revenuecat-webhook.md',
    [
      '# Live RevenueCat webhook evidence',
      '',
      `- Status: ${artifact.status}`,
      `- Environment: ${artifact.appEnvironment}`,
      `- Supabase host: ${artifact.supabaseHost ?? 'not configured'}`,
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

function sign(rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function headers(rawBody, options = {}) {
  const out = {
    apikey: publishableKey,
    'Content-Type': 'application/json',
  };

  if (options.auth === 'valid' && hasWebhookAuth) out.Authorization = webhookAuth;
  if (options.auth === 'invalid') out.Authorization = `invalid-${randomUUID()}`;
  if (options.signature === 'valid' && hasSigningSecret)
    out['X-RevenueCat-Webhook-Signature'] = sign(rawBody);
  if (options.signature === 'invalid') {
    const timestamp = Math.floor(Date.now() / 1000);
    out['X-RevenueCat-Webhook-Signature'] = `t=${timestamp},v1=${'0'.repeat(64)}`;
  }
  if (options.signature === 'stale' && hasSigningSecret) {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 3600;
    out['X-RevenueCat-Webhook-Signature'] = sign(rawBody, staleTimestamp);
  }

  return out;
}

async function postWebhook(body, options = {}) {
  const rawBody = JSON.stringify(body);
  const method = options.method ?? 'POST';
  const request = {
    method,
    headers: headers(rawBody, options),
  };
  if (method !== 'GET' && method !== 'HEAD') request.body = rawBody;

  const response = await fetch(functionUrl('revenuecat-webhook'), {
    ...request,
  });
  return { status: response.status, text: await response.text() };
}

function assertStatus(actual, expected, label, text) {
  assert(
    actual === expected,
    `${label}: expected HTTP ${expected}, got ${actual}${text ? ` (${text.slice(0, 120)})` : ''}.`,
  );
}

async function createLiveUser(admin) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `phase9-rc-webhook-${suffix}@example.invalid`;
  const password = `Phase9Rc-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase9_live_revenuecat_webhook: true },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return a RevenueCat harness user.');
  return { id: data.user.id, email };
}

function validOptions() {
  return {
    auth: hasWebhookAuth ? 'valid' : 'missing',
    signature: hasSigningSecret ? 'valid' : 'missing',
  };
}

const rawRevenueCatPayloadKeys = [
  'api_key',
  'authorization',
  'customer_info',
  'private_key',
  'raw_receipt',
  'request_ip',
  'subscriber_attributes',
];
const rawRevenueCatPayloadCanaries = [
  'phase9-api-key',
  'phase9-auth-header',
  'phase9-private',
  'phase9-raw-receipt',
  'phase9-sensitive-skin-concern',
  'phase9@example.invalid',
];

function eventBody(id, type, userId) {
  return {
    event: {
      id,
      type,
      app_user_id: userId,
      original_app_user_id: userId,
      aliases: [userId],
      product_id: 'onskin_phase9_security_annual',
      store: 'TEST_STORE',
      environment: 'SANDBOX',
      entitlement_ids: ['pro'],
      expiration_at_ms: Date.now() + 7 * 86_400_000,
      original_purchase_date_ms: Date.now() - 60_000,
      period_type: 'NORMAL',
      is_sandbox: true,
      presented_offering_id: 'phase9-security-webhook',
      api_key: 'phase9-api-key',
      authorization: 'phase9-auth-header',
      customer_info: { private_key: 'phase9-private', request_ip: '203.0.113.9' },
      raw_receipt: 'phase9-raw-receipt',
      subscriber_attributes: {
        $email: { value: 'phase9@example.invalid' },
        skin_concern: { value: 'phase9-sensitive-skin-concern' },
      },
    },
  };
}

function oversizedEventBody(id, type, userId) {
  const body = eventBody(id, type, userId);
  body.event.customer_info.oversized_padding = 'x'.repeat(300_000);
  return body;
}

function assertNoRawRevenueCatPayload(value, label) {
  const serialized = JSON.stringify(value ?? {});
  for (const canary of rawRevenueCatPayloadCanaries) {
    assert(!serialized.includes(canary), `${label} retained raw RevenueCat canary ${canary}.`);
  }
  for (const key of rawRevenueCatPayloadKeys) {
    assert(!serialized.includes(`"${key}"`), `${label} retained raw RevenueCat key ${key}.`);
  }
}

async function oneEvent(admin, eventId) {
  const { data, error } = await admin
    .from('subscriptions_events')
    .select(
      'rc_event_id,user_id,event_type,resolved_user_id,processing_status,signature_verified,auth_verified,store,environment,product_id,payload,app_user_id,original_app_user_id,aliases',
    )
    .eq('rc_event_id', eventId)
    .single();
  if (error) throw error;
  return data;
}

async function eventCount(admin, eventId) {
  const { data, error } = await admin
    .from('subscriptions_events')
    .select('id')
    .eq('rc_event_id', eventId);
  if (error) throw error;
  return (data ?? []).length;
}

async function entitlement(admin, userId) {
  const { data, error } = await admin
    .from('entitlements')
    .select(
      'user_id,entitlement,is_active,product_id,rc_event_id,source,store,environment,will_renew,period_type,store_user_id,raw_status',
    )
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live RevenueCat webhook harness not run; set PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live RevenueCat webhook', errors, warnings);
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
    hasWebhookAuth || hasSigningSecret,
    'RevenueCat webhook auth or signing secret is required.',
  );
  block(
    errors,
    appEnv !== 'production' || env.PHASE9_ALLOW_PRODUCTION_LIVE_REVENUECAT_WEBHOOK === 'true',
    'Refusing production RevenueCat webhook tests without PHASE9_ALLOW_PRODUCTION_LIVE_REVENUECAT_WEBHOOK=true.',
  );
  if (!hasWebhookAuth)
    warnings.push(
      'Shared Authorization path not run; set REVENUECAT_WEBHOOK_AUTH for strict evidence.',
    );
  if (!hasSigningSecret)
    warnings.push(
      'HMAC signature path not run; set REVENUECAT_WEBHOOK_SIGNING_SECRET for strict evidence.',
    );

  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live RevenueCat webhook', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const user = await createLiveUser(admin);
  const eventIds = {
    nonPost: `phase9-rc-non-post-${randomUUID()}`,
    badAuth: `phase9-rc-bad-auth-${randomUUID()}`,
    badSignature: `phase9-rc-bad-signature-${randomUUID()}`,
    staleSignature: `phase9-rc-stale-signature-${randomUUID()}`,
    oversized: `phase9-rc-oversized-${randomUUID()}`,
    initial: `phase9-rc-initial-${randomUUID()}`,
    renewal: `phase9-rc-renewal-${randomUUID()}`,
    cancellation: `phase9-rc-cancellation-${randomUUID()}`,
    billingIssue: `phase9-rc-billing-issue-${randomUUID()}`,
    expiration: `phase9-rc-expiration-${randomUUID()}`,
    refund: `phase9-rc-refund-${randomUUID()}`,
  };

  try {
    await runCheck('revenuecat-webhook rejects non-POST methods before writes', async () => {
      const response = await postWebhook(eventBody(eventIds.nonPost, 'INITIAL_PURCHASE', user.id), {
        ...validOptions(),
        method: 'GET',
      });
      assertStatus(response.status, 405, 'non-POST webhook method', response.text);
      assert(
        /method not allowed/i.test(response.text),
        'non-POST webhook did not return method-not-allowed.',
      );
      assert(
        (await eventCount(admin, eventIds.nonPost)) === 0,
        'non-POST webhook wrote a subscriptions_events row.',
      );
    });

    if (hasWebhookAuth) {
      await runCheck('revenuecat-webhook rejects invalid shared auth', async () => {
        const response = await postWebhook(
          eventBody(eventIds.badAuth, 'INITIAL_PURCHASE', user.id),
          {
            auth: 'invalid',
            signature: hasSigningSecret ? 'valid' : 'missing',
          },
        );
        assertStatus(response.status, 401, 'invalid shared auth', response.text);
        assert(
          /unauthorized/i.test(response.text),
          'invalid shared auth did not return unauthorized.',
        );
        assert(
          (await eventCount(admin, eventIds.badAuth)) === 0,
          'invalid shared auth wrote a subscriptions_events row.',
        );
      });
    }

    if (hasSigningSecret) {
      await runCheck('revenuecat-webhook rejects invalid HMAC signature', async () => {
        const response = await postWebhook(
          eventBody(eventIds.badSignature, 'INITIAL_PURCHASE', user.id),
          {
            auth: hasWebhookAuth ? 'valid' : 'missing',
            signature: 'invalid',
          },
        );
        assertStatus(response.status, 401, 'invalid HMAC signature', response.text);
        assert(
          /^bad signature$/i.test(response.text),
          `invalid HMAC signature returned unexpected body: ${response.text}`,
        );
        assert(
          (await eventCount(admin, eventIds.badSignature)) === 0,
          'invalid HMAC signature wrote a subscriptions_events row.',
        );
      });

      await runCheck('revenuecat-webhook rejects stale HMAC signature', async () => {
        const response = await postWebhook(
          eventBody(eventIds.staleSignature, 'INITIAL_PURCHASE', user.id),
          {
            auth: hasWebhookAuth ? 'valid' : 'missing',
            signature: 'stale',
          },
        );
        assertStatus(response.status, 401, 'stale HMAC signature', response.text);
        assert(
          /^bad signature$/i.test(response.text),
          `stale HMAC signature returned unexpected body: ${response.text}`,
        );
        assert(
          (await eventCount(admin, eventIds.staleSignature)) === 0,
          'stale HMAC signature wrote a subscriptions_events row.',
        );
      });
    }

    await runCheck('revenuecat-webhook rejects oversized raw bodies before writes', async () => {
      const response = await postWebhook(
        oversizedEventBody(eventIds.oversized, 'INITIAL_PURCHASE', user.id),
        validOptions(),
      );
      assertStatus(response.status, 413, 'oversized webhook body', response.text);
      assert(
        /payload too large/i.test(response.text),
        'oversized webhook body did not return payload-too-large.',
      );
      assert(
        (await eventCount(admin, eventIds.oversized)) === 0,
        'oversized webhook wrote a subscriptions_events row.',
      );
    });

    await runCheck(
      'revenuecat-webhook grants entitlement from verified initial purchase',
      async () => {
        const response = await postWebhook(
          eventBody(eventIds.initial, 'INITIAL_PURCHASE', user.id),
          validOptions(),
        );
        assertStatus(response.status, 200, 'initial purchase', response.text);
        assert(
          /^ok$/i.test(response.text),
          `initial purchase returned unexpected body: ${response.text}`,
        );

        const event = await oneEvent(admin, eventIds.initial);
        assert(
          event.resolved_user_id === user.id,
          'initial purchase did not resolve the app user id.',
        );
        assert(
          event.app_user_id === user.id,
          'initial purchase did not retain explicit app_user_id column.',
        );
        assert(
          event.original_app_user_id === user.id,
          'initial purchase did not retain explicit original_app_user_id column.',
        );
        assert(
          Array.isArray(event.aliases) && event.aliases.includes(user.id),
          'initial purchase did not retain explicit aliases column.',
        );
        assert(
          event.processing_status === 'processed',
          `initial purchase processing_status=${event.processing_status}.`,
        );
        assert(event.store === 'test_store', `initial purchase store=${event.store}.`);
        assert(
          event.environment === 'test_store',
          `initial purchase environment=${event.environment}.`,
        );
        if (hasWebhookAuth)
          assert(
            event.auth_verified === true,
            'initial purchase did not record shared auth verification.',
          );
        if (hasSigningSecret)
          assert(
            event.signature_verified === true,
            'initial purchase did not record HMAC verification.',
          );

        const row = await entitlement(admin, user.id);
        assert(row.is_active === true, 'initial purchase did not activate entitlement.');
        assert(row.entitlement === 'pro', `initial purchase entitlement=${row.entitlement}.`);
        assert(
          row.rc_event_id === eventIds.initial,
          'initial purchase entitlement did not record event id.',
        );
        assert(row.source === 'revenuecat', `initial purchase source=${row.source}.`);
        assert(row.will_renew === true, 'initial purchase did not mark will_renew=true.');
      },
    );

    await runCheck('revenuecat-webhook does not persist raw provider payload fields', async () => {
      const event = await oneEvent(admin, eventIds.initial);
      assert(
        event.payload?.event?.id === eventIds.initial,
        'subscription event payload did not retain sanitized event id.',
      );
      assert(
        event.payload?.event?.type === 'INITIAL_PURCHASE',
        'subscription event payload did not retain sanitized event type.',
      );
      assert(
        event.payload?.event?.product_id === 'onskin_phase9_security_annual',
        'subscription event payload did not retain sanitized product id.',
      );
      assert(
        !('app_user_id' in event.payload.event),
        'subscription event payload redundantly retained app_user_id.',
      );
      assert(
        !('original_app_user_id' in event.payload.event),
        'subscription event payload redundantly retained original_app_user_id.',
      );
      assert(
        !('aliases' in event.payload.event),
        'subscription event payload redundantly retained aliases.',
      );
      assertNoRawRevenueCatPayload(event.payload, 'subscription event payload');

      const row = await entitlement(admin, user.id);
      assert(
        row.store_user_id === user.id,
        'entitlement did not retain explicit store_user_id column.',
      );
      assert(
        row.raw_status?.id === eventIds.initial,
        'entitlement raw_status did not retain sanitized event id.',
      );
      assert(
        row.raw_status?.type === 'INITIAL_PURCHASE',
        'entitlement raw_status did not retain sanitized event type.',
      );
      assert(
        row.raw_status?.product_id === 'onskin_phase9_security_annual',
        'entitlement raw_status did not retain product id.',
      );
      assert(
        !('app_user_id' in row.raw_status),
        'entitlement raw_status redundantly retained app_user_id.',
      );
      assert(
        !('original_app_user_id' in row.raw_status),
        'entitlement raw_status redundantly retained original_app_user_id.',
      );
      assert(
        !('aliases' in row.raw_status),
        'entitlement raw_status redundantly retained aliases.',
      );
      assertNoRawRevenueCatPayload(row.raw_status, 'entitlement raw_status');
    });

    await runCheck('revenuecat-webhook deduplicates repeated event id', async () => {
      const response = await postWebhook(
        eventBody(eventIds.initial, 'INITIAL_PURCHASE', user.id),
        validOptions(),
      );
      assertStatus(response.status, 200, 'duplicate initial purchase', response.text);
      assert(
        /duplicate/i.test(response.text),
        `duplicate event returned unexpected body: ${response.text}`,
      );
      assert(
        (await eventCount(admin, eventIds.initial)) === 1,
        'duplicate event inserted more than one subscriptions_events row.',
      );
    });

    await runCheck('revenuecat-webhook keeps entitlement active on renewal', async () => {
      const response = await postWebhook(
        eventBody(eventIds.renewal, 'RENEWAL', user.id),
        validOptions(),
      );
      assertStatus(response.status, 200, 'renewal', response.text);
      assert(/^ok$/i.test(response.text), `renewal returned unexpected body: ${response.text}`);

      const event = await oneEvent(admin, eventIds.renewal);
      assert(event.resolved_user_id === user.id, 'renewal did not resolve the app user id.');
      assert(
        event.processing_status === 'processed',
        `renewal processing_status=${event.processing_status}.`,
      );

      const row = await entitlement(admin, user.id);
      assert(row.is_active === true, 'renewal did not keep entitlement active.');
      assert(row.rc_event_id === eventIds.renewal, 'renewal entitlement did not record event id.');
      assert(row.will_renew === true, 'renewal did not mark will_renew=true.');
    });

    await runCheck(
      'revenuecat-webhook keeps access but stops renewal on cancellation',
      async () => {
        const response = await postWebhook(
          eventBody(eventIds.cancellation, 'CANCELLATION', user.id),
          validOptions(),
        );
        assertStatus(response.status, 200, 'cancellation', response.text);
        assert(
          /^ok$/i.test(response.text),
          `cancellation returned unexpected body: ${response.text}`,
        );

        const event = await oneEvent(admin, eventIds.cancellation);
        assert(event.resolved_user_id === user.id, 'cancellation did not resolve the app user id.');
        assert(
          event.processing_status === 'processed',
          `cancellation processing_status=${event.processing_status}.`,
        );

        const row = await entitlement(admin, user.id);
        assert(row.is_active === true, 'cancellation should keep access active until expiration.');
        assert(
          row.rc_event_id === eventIds.cancellation,
          'cancellation entitlement did not record event id.',
        );
        assert(row.will_renew === false, 'cancellation did not mark will_renew=false.');
      },
    );

    await runCheck(
      'revenuecat-webhook keeps billing-issue access active while renewal can recover',
      async () => {
        const response = await postWebhook(
          eventBody(eventIds.billingIssue, 'BILLING_ISSUE', user.id),
          validOptions(),
        );
        assertStatus(response.status, 200, 'billing issue', response.text);
        assert(
          /^ok$/i.test(response.text),
          `billing issue returned unexpected body: ${response.text}`,
        );

        const event = await oneEvent(admin, eventIds.billingIssue);
        assert(
          event.resolved_user_id === user.id,
          'billing issue did not resolve the app user id.',
        );
        assert(
          event.processing_status === 'processed',
          `billing issue processing_status=${event.processing_status}.`,
        );

        const row = await entitlement(admin, user.id);
        assert(
          row.is_active === true,
          'billing issue should keep entitlement active while RevenueCat can recover billing.',
        );
        assert(
          row.rc_event_id === eventIds.billingIssue,
          'billing issue entitlement did not record event id.',
        );
        assert(
          row.will_renew === true,
          'billing issue did not preserve will_renew=true for recovery.',
        );
      },
    );

    await runCheck('revenuecat-webhook deactivates entitlement on expiration', async () => {
      const response = await postWebhook(
        eventBody(eventIds.expiration, 'EXPIRATION', user.id),
        validOptions(),
      );
      assertStatus(response.status, 200, 'expiration', response.text);
      assert(/^ok$/i.test(response.text), `expiration returned unexpected body: ${response.text}`);

      const event = await oneEvent(admin, eventIds.expiration);
      assert(event.resolved_user_id === user.id, 'expiration did not resolve the app user id.');
      assert(
        event.processing_status === 'processed',
        `expiration processing_status=${event.processing_status}.`,
      );

      const row = await entitlement(admin, user.id);
      assert(row.is_active === false, 'expiration did not deactivate entitlement.');
      assert(
        row.rc_event_id === eventIds.expiration,
        'expiration entitlement did not record event id.',
      );
      assert(row.will_renew === false, 'expiration did not mark will_renew=false.');
    });

    await runCheck('revenuecat-webhook revokes entitlement on refund', async () => {
      const response = await postWebhook(
        eventBody(eventIds.refund, 'REFUND', user.id),
        validOptions(),
      );
      assertStatus(response.status, 200, 'refund', response.text);
      assert(/^ok$/i.test(response.text), `refund returned unexpected body: ${response.text}`);

      const event = await oneEvent(admin, eventIds.refund);
      assert(event.resolved_user_id === user.id, 'refund did not resolve the app user id.');
      assert(
        event.processing_status === 'processed',
        `refund processing_status=${event.processing_status}.`,
      );

      const row = await entitlement(admin, user.id);
      assert(row.is_active === false, 'refund did not deactivate entitlement.');
      assert(row.rc_event_id === eventIds.refund, 'refund entitlement did not record event id.');
      assert(row.will_renew === false, 'refund did not mark will_renew=false.');
    });
  } finally {
    await admin.from('entitlements').delete().eq('user_id', user.id);
    await admin.from('subscriptions_events').delete().in('rc_event_id', Object.values(eventIds));
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error)
      warnings.push(`RevenueCat webhook user cleanup warning: ${redactedErrorKind(error)}`);
  }

  writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live RevenueCat webhook', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live RevenueCat webhook', errors, warnings);
});
