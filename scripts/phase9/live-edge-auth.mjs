#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { block, envSnapshot, printResult, readScriptAppEnvironment, write } from './lib.mjs';

const errors = [];
const warnings = [];
const checks = [];
const env = envSnapshot();

const runLive = env.PHASE9_RUN_LIVE_EDGE_AUTH === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const userEdgeBodyMaxBytes = intEnv('USER_EDGE_BODY_MAX_BYTES', 16384, 1024, 65536);

const userJwtFunctions = [
  'account-deletion',
  'data-export',
  'subscription-grants',
  'catalog-search',
  'catalog-lookup',
  'catalog-report',
  'consent-withdrawal',
];
const methodRestrictedFunctions = userJwtFunctions;
const bodyLimitedFunctions = userJwtFunctions.filter(
  (functionName) => functionName !== 'data-export',
);

const artifact = {
  status: runLive ? 'running' : 'not-run',
  appEnvironment: appEnv,
  supabaseHost: safeHost(supabaseUrl),
  userEdgeBodyMaxBytes,
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

function placeholder(value) {
  return (
    !value ||
    /YOUR-|replace-with|xxxxxxxx|example\.com|\.\.\.|__BLOCKED_PLACEHOLDER__/i.test(String(value))
  );
}

function intEnv(name, fallback, min, max) {
  const value = Number(env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
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
  write('docs/phase-9/generated/live-edge-auth.json', `${JSON.stringify(artifact, null, 2)}\n`);
  write(
    'docs/phase-9/generated/live-edge-auth.md',
    [
      '# Live Edge auth evidence',
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

function publicClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function createLiveUser(admin) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `phase9-edge-auth-${suffix}@example.invalid`;
  const password = `Phase9Edge-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase9_live_edge_auth: true },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return an Edge auth harness user.');

  const client = publicClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const token = signedIn.data.session?.access_token;
  assert(token, 'Supabase did not return a session access token.');
  return { id: data.user.id, email, token };
}

function defaultBody(functionName) {
  if (functionName === 'subscription-grants') return { action: 'start_reverse_trial' };
  if (functionName === 'catalog-search') return { query: 'phase9' };
  if (functionName === 'catalog-lookup') return { barcode: '012345678905' };
  if (functionName === 'catalog-report')
    return { correctionType: 'wrong_match', barcode: '012345678905' };
  if (functionName === 'consent-withdrawal') {
    return {
      consentType: 'marketing',
      version: 'phase9-live-edge-auth',
      consentTextHash: '0'.repeat(64),
    };
  }
  return {};
}

function oversizedBody() {
  return JSON.stringify({ phase9OversizedBody: 'x'.repeat(userEdgeBodyMaxBytes + 1024) });
}

async function postFunction(
  functionName,
  { auth = 'missing', token = '', body = {}, rawBody, method = 'POST' } = {},
) {
  const headers = {
    apikey: publishableKey,
    'Content-Type': 'application/json',
  };
  if (auth === 'valid') headers.Authorization = `Bearer ${token}`;
  if (auth === 'invalid') headers.Authorization = `Bearer invalid-${randomUUID()}`;
  if (auth === 'raw') headers.Authorization = token;

  const request = {
    method,
    headers,
  };
  if (method !== 'GET' && method !== 'HEAD') {
    request.body = rawBody ?? JSON.stringify(body);
  }

  const response = await fetch(functionUrl(functionName), request);
  return { status: response.status, text: await response.text() };
}

async function liveUserExists(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return false;
  return Boolean(data?.user?.id);
}

async function getFunction(functionName, token) {
  const response = await postFunction(functionName, {
    auth: 'valid',
    token,
    method: 'GET',
  });
  return { status: response.status, text: response.text };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function assertStatus(actual, expected, label, text) {
  assert(
    actual === expected,
    `${label}: expected HTTP ${expected}, got ${actual}${text ? ` (${text.slice(0, 120)})` : ''}.`,
  );
}

function assertErrorCode(response, code, label) {
  const body = parseJson(response.text);
  assert(
    body?.error === code,
    `${label}: expected error ${code}, got ${response.text.slice(0, 120)}.`,
  );
}

function assertMethodNotAllowed(response, label) {
  const body = parseJson(response.text);
  const code = body?.error;
  assert(
    code === 'method_not_allowed' || code === 'METHOD_NOT_ALLOWED',
    `${label}: expected method_not_allowed, got ${response.text.slice(0, 120)}.`,
  );
}

async function countRows(admin, table, column, value) {
  const { data, error } = await admin.from(table).select('id').eq(column, value);
  if (error) throw error;
  return (data ?? []).length;
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live Edge auth harness not run; set PHASE9_RUN_LIVE_EDGE_AUTH=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live Edge auth', errors, warnings);
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
    appEnv !== 'production' || env.PHASE9_ALLOW_PRODUCTION_LIVE_EDGE_AUTH === 'true',
    'Refusing production Edge auth tests without PHASE9_ALLOW_PRODUCTION_LIVE_EDGE_AUTH=true.',
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live Edge auth', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  let user = null;
  const correctionIds = [];

  try {
    user = await createLiveUser(admin);

    await runCheck('user Edge Functions reject missing JWT', async () => {
      for (const functionName of userJwtFunctions) {
        const response = await postFunction(functionName, {
          auth: 'missing',
          body: defaultBody(functionName),
        });
        assertStatus(response.status, 401, `${functionName} missing JWT`, response.text);
      }
    });

    await runCheck('user Edge Functions reject invalid JWT', async () => {
      for (const functionName of userJwtFunctions) {
        const response = await postFunction(functionName, {
          auth: 'invalid',
          body: defaultBody(functionName),
        });
        assertStatus(response.status, 401, `${functionName} invalid JWT`, response.text);
      }
    });

    await runCheck('user Edge Functions reject raw JWT without Bearer scheme', async () => {
      for (const functionName of userJwtFunctions) {
        const response = await postFunction(functionName, {
          auth: 'raw',
          token: user.token,
          body: defaultBody(functionName),
        });
        assertStatus(response.status, 401, `${functionName} raw JWT`, response.text);
      }
      assert(
        await liveUserExists(admin, user.id),
        'raw-JWT account-deletion removed the live harness user.',
      );
      assert(
        (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
        'raw-JWT subscription call wrote entitlement.',
      );
      assert(
        (await countRows(admin, 'reverse_trial_grants', 'user_id', user.id)) === 0,
        'raw-JWT subscription call wrote grant.',
      );
      assert(
        (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
        'raw-JWT catalog call wrote lookup event.',
      );
      assert(
        (await countRows(admin, 'consents', 'user_id', user.id)) === 0,
        'raw-JWT consent-withdrawal wrote consent.',
      );
    });

    await runCheck('user Edge Functions reject valid JWT non-POST methods', async () => {
      for (const functionName of methodRestrictedFunctions) {
        const response = await getFunction(functionName, user.token);
        assertStatus(response.status, 405, `${functionName} valid JWT GET`, response.text);
        assertMethodNotAllowed(response, `${functionName} valid JWT GET`);
      }
      assert(
        await liveUserExists(admin, user.id),
        'valid-JWT non-POST account-deletion removed the live harness user.',
      );
      assert(
        (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
        'valid-JWT non-POST subscription call wrote entitlement.',
      );
      assert(
        (await countRows(admin, 'reverse_trial_grants', 'user_id', user.id)) === 0,
        'valid-JWT non-POST subscription call wrote grant.',
      );
      assert(
        (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
        'valid-JWT non-POST catalog call wrote lookup event.',
      );
      assert(
        (await countRows(admin, 'consents', 'user_id', user.id)) === 0,
        'valid-JWT non-POST consent-withdrawal wrote consent.',
      );
    });

    await runCheck('user Edge Functions reject oversized bodies before side effects', async () => {
      for (const functionName of bodyLimitedFunctions) {
        const response = await postFunction(functionName, {
          auth: 'valid',
          token: user.token,
          rawBody: oversizedBody(),
        });
        assertStatus(response.status, 413, `${functionName} oversized body`, response.text);
        assertErrorCode(response, 'payload_too_large', `${functionName} oversized body`);
      }
      assert(
        await liveUserExists(admin, user.id),
        'oversized body account-deletion removed the live harness user.',
      );
      assert(
        (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
        'oversized body subscription call wrote entitlement.',
      );
      assert(
        (await countRows(admin, 'reverse_trial_grants', 'user_id', user.id)) === 0,
        'oversized body subscription call wrote grant.',
      );
      assert(
        (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
        'oversized body catalog call wrote lookup event.',
      );
      assert(
        (await countRows(admin, 'consents', 'user_id', user.id)) === 0,
        'oversized body consent-withdrawal wrote consent.',
      );
    });

    await runCheck(
      'subscription-grants valid JWT rejects unknown action without grant',
      async () => {
        const response = await postFunction('subscription-grants', {
          auth: 'valid',
          token: user.token,
          body: { action: 'phase9_unknown_action' },
        });
        assertStatus(response.status, 400, 'subscription-grants unknown action', response.text);
        assertErrorCode(response, 'unknown_action', 'subscription-grants unknown action');
        assert(
          (await countRows(admin, 'entitlements', 'user_id', user.id)) === 0,
          'unknown subscription action wrote entitlement.',
        );
        assert(
          (await countRows(admin, 'reverse_trial_grants', 'user_id', user.id)) === 0,
          'unknown subscription action wrote grant.',
        );
      },
    );

    await runCheck('catalog-search valid JWT returns too_short without lookup event', async () => {
      const response = await postFunction('catalog-search', {
        auth: 'valid',
        token: user.token,
        body: { query: 'x', limit: 10 },
      });
      assertStatus(response.status, 200, 'catalog-search too short', response.text);
      const body = parseJson(response.text);
      assert(
        body?.result === 'too_short',
        `catalog-search returned unexpected body: ${response.text.slice(0, 120)}.`,
      );
      assert(
        (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
        'too-short catalog search wrote lookup event.',
      );
    });

    await runCheck(
      'catalog-lookup valid JWT rejects invalid barcode without lookup event',
      async () => {
        const response = await postFunction('catalog-lookup', {
          auth: 'valid',
          token: user.token,
          body: { barcode: '123' },
        });
        assertStatus(response.status, 400, 'catalog-lookup invalid barcode', response.text);
        assertErrorCode(response, 'invalid_barcode', 'catalog-lookup invalid barcode');
        assert(
          (await countRows(admin, 'catalog_lookup_events', 'user_id', user.id)) === 0,
          'invalid catalog lookup wrote lookup event.',
        );
      },
    );

    await runCheck(
      'catalog-report valid JWT rejects malformed JSON and unknown fields',
      async () => {
        const badJson = await postFunction('catalog-report', {
          auth: 'valid',
          token: user.token,
          rawBody: 'not-json',
        });
        assertStatus(badJson.status, 400, 'catalog-report bad JSON', badJson.text);
        assertErrorCode(badJson, 'bad_json', 'catalog-report bad JSON');

        const unexpected = await postFunction('catalog-report', {
          auth: 'valid',
          token: user.token,
          body: { correctionType: 'wrong_match', barcode: '012345678905', shelfProductId: user.id },
        });
        assertStatus(unexpected.status, 400, 'catalog-report unexpected field', unexpected.text);
        assertErrorCode(unexpected, 'unexpected_field', 'catalog-report unexpected field');
      },
    );

    await runCheck('catalog-report valid JWT rejects invalid nested payload shapes', async () => {
      const invalidPayload = await postFunction('catalog-report', {
        auth: 'valid',
        token: user.token,
        body: { correctionType: 'wrong_match', proposedPayload: ['not-an-object'] },
      });
      assertStatus(
        invalidPayload.status,
        400,
        'catalog-report invalid proposedPayload',
        invalidPayload.text,
      );
      assertErrorCode(
        invalidPayload,
        'invalid_proposed_payload',
        'catalog-report invalid proposedPayload',
      );

      const invalidContext = await postFunction('catalog-report', {
        auth: 'valid',
        token: user.token,
        body: { correctionType: 'wrong_match', clientContext: ['not-an-object'] },
      });
      assertStatus(
        invalidContext.status,
        400,
        'catalog-report invalid clientContext',
        invalidContext.text,
      );
      assertErrorCode(
        invalidContext,
        'invalid_client_context',
        'catalog-report invalid clientContext',
      );
    });

    await runCheck('catalog-report valid JWT stores sanitized report payload only', async () => {
      const response = await postFunction('catalog-report', {
        auth: 'valid',
        token: user.token,
        body: {
          correctionType: 'wrong_match',
          barcode: '012345678905',
          description: 'phase9 catalog correction',
          proposedPayload: {
            productName: 'Phase9 cleanser',
            sourceUrl: 'https://example.org/catalog/product?token=must-not-persist',
            defaultPaoMonths: 12,
            suggestedCorrection: 'Use the reviewed catalog source',
          },
          clientContext: {
            route: 'phase9_live_edge_auth',
            platform: 'security',
          },
        },
      });
      assertStatus(response.status, 200, 'catalog-report sanitized payload', response.text);
      const body = parseJson(response.text);
      const correctionId = body?.correction?.id;
      assert(
        correctionId,
        `catalog-report did not return a correction id: ${response.text.slice(0, 120)}.`,
      );
      correctionIds.push(correctionId);

      const { data, error } = await admin
        .from('catalog_corrections')
        .select('id,user_id,barcode,correction_type,description,proposed_payload,client_context')
        .eq('id', correctionId)
        .single();
      if (error) throw error;
      assert(data.user_id === user.id, 'catalog-report correction row belongs to the wrong user.');
      assert(
        data.correction_type === 'wrong_match',
        `catalog-report correction_type=${data.correction_type}.`,
      );
      assert(data.barcode === '012345678905', `catalog-report barcode=${data.barcode}.`);
      assert(
        data.description === 'phase9 catalog correction',
        `catalog-report description=${data.description}.`,
      );
      assert(
        data.proposed_payload?.productName === 'Phase9 cleanser',
        'catalog-report dropped safe productName.',
      );
      assert(
        data.proposed_payload?.sourceUrl === 'https://example.org/catalog/product',
        'catalog-report did not strip sourceUrl query.',
      );
      assert(
        !JSON.stringify(data.proposed_payload).includes('must-not-persist'),
        'catalog-report persisted a URL query token.',
      );
      assert(
        data.client_context?.route === 'phase9_live_edge_auth',
        'catalog-report dropped safe route context.',
      );
      assert(
        data.client_context?.shelfProductId === undefined,
        'catalog-report persisted a local shelf product id.',
      );
    });
  } finally {
    if (user?.id) {
      if (correctionIds.length > 0) {
        const { error } = await admin.from('catalog_corrections').delete().in('id', correctionIds);
        if (error) warnings.push(`Catalog correction cleanup warning: ${error.message}`);
      }
      for (const table of ['catalog_lookup_events', 'entitlements', 'reverse_trial_grants']) {
        const { error } = await admin.from(table).delete().eq('user_id', user.id);
        if (error) warnings.push(`${table} cleanup warning: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error)
        warnings.push(`Edge auth user cleanup warning for ${user.email}: ${error.message}`);
    }
  }

  writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live Edge auth', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live Edge auth', errors, warnings);
});
