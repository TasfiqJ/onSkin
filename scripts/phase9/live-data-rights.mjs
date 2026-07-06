#!/usr/bin/env node
import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import {
  block,
  envSnapshot,
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

const runLive = env.PHASE9_RUN_LIVE_DATA_RIGHTS === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const dataExportRateLimitMax = intEnv('DATA_EXPORT_RATE_LIMIT_MAX', 5, 1, 100);
const dataExportRateLimitWindowSeconds = intEnv(
  'DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS',
  3600,
  60,
  86400,
);
const dataExportPhotoUrlTtlSeconds = intEnv('DATA_EXPORT_PHOTO_URL_TTL_SECONDS', 3600, 60, 3600);
const dataExportProbeBudget = intEnv(
  'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX',
  Math.min(dataExportRateLimitMax + 2, 102),
  2,
  110,
);
const runSignedUrlExpiryCheck = env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK === 'true';
const signedUrlExpiryWaitSeconds = intEnv(
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS',
  Math.min(dataExportPhotoUrlTtlSeconds + 10, 3900),
  0,
  3900,
);

const artifact = {
  status: runLive ? 'running' : 'not-run',
  appEnvironment: appEnv,
  supabaseHost: safeHost(supabaseUrl),
  dataExportRateLimitMax,
  dataExportRateLimitWindowSeconds,
  dataExportPhotoUrlTtlSeconds,
  dataExportProbeBudget,
  signedUrlExpiryCheck: runSignedUrlExpiryCheck,
  signedUrlExpiryWaitSeconds,
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

function placeholder(value) {
  return (
    !value || /YOUR-|xxxxxxxx|example\.com|\.\.\.|__BLOCKED_PLACEHOLDER__/i.test(String(value))
  );
}

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
  write('docs/phase-9/generated/live-data-rights.json', `${JSON.stringify(artifact, null, 2)}\n`);
  write(
    'docs/phase-9/generated/live-data-rights.md',
    [
      '# Live data rights evidence',
      '',
      `- Status: ${artifact.status}`,
      `- Environment: ${artifact.appEnvironment}`,
      `- Supabase host: ${artifact.supabaseHost ?? 'not configured'}`,
      `- Data export configured max: ${artifact.dataExportRateLimitMax}`,
      `- Data export configured window: ${artifact.dataExportRateLimitWindowSeconds}s`,
      `- Data export photo URL TTL: ${artifact.dataExportPhotoUrlTtlSeconds}s`,
      `- Data export probe budget: ${artifact.dataExportProbeBudget}`,
      `- Signed URL expiry check: ${artifact.signedUrlExpiryCheck ? 'enabled' : 'disabled'}`,
      `- Signed URL expiry wait: ${artifact.signedUrlExpiryWaitSeconds}s`,
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
      '## Redacted Evidence Samples',
      samples.length
        ? samples
            .map((sample) => {
              if (sample.scope === 'data-export-photo-url-expiry') {
                return `- ${sample.scope}: ttl=${sample.ttlSeconds}s, waited=${sample.waitSeconds}s, before=${sample.beforeStatus}, after=${sample.afterStatus}`;
              }
              return `- ${sample.scope}: count=${sample.requestCount}, window=${sample.windowSeconds}s, key=${sample.keyHashRedacted}`;
            })
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

function publicClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function functionUrl(name) {
  return `${supabaseUrl.replace(/\/+$/g, '')}/functions/v1/${name}`;
}

async function createLiveUser(admin, label) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `phase9-data-${label}-${suffix}@example.invalid`;
  const password = `Phase9Data-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase9_live_data_rights: true },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`Supabase did not return a user for ${label}.`);

  const client = publicClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const token = signedIn.data.session?.access_token;
  assert(token, `Supabase did not return a session access token for ${label}.`);
  return { id: data.user.id, email, client, token };
}

async function insertOne(client, table, payload, select = '*') {
  const { data, error } = await client.from(table).insert(payload).select(select).single();
  if (error) throw error;
  return data;
}

async function upsertOne(client, table, payload, select = '*') {
  const { data, error } = await client.from(table).upsert(payload).select(select).single();
  if (error) throw error;
  return data;
}

function rows(bundle, key) {
  const value = bundle[key];
  assert(Array.isArray(value), `export field ${key} is not an array.`);
  return value;
}

function expectBundleHasOnlyUser(bundle, key, column, userId, otherUserId) {
  const value = rows(bundle, key);
  assert(
    value.some((row) => row?.[column] === userId),
    `export ${key} is missing caller row.`,
  );
  assert(
    !value.some((row) => row?.[column] === otherUserId),
    `export ${key} leaked another user's row.`,
  );
}

async function expectAdminRows(admin, table, column, value, expectedCount, label) {
  const { data, error } = await admin.from(table).select('*').eq(column, value);
  if (error) throw error;
  assert(
    (data ?? []).length === expectedCount,
    `${label}: expected ${expectedCount} row(s), got ${(data ?? []).length}.`,
  );
  return data ?? [];
}

async function userExists(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  return !error && Boolean(data.user);
}

async function postDataExport(token) {
  const response = await fetch(functionUrl('data-export'), {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
    text: await response.text(),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function assertDataExportRateLimited(response) {
  const body = parseJson(response.text);
  assert(
    response.status === 429,
    `data-export expected HTTP 429, got ${response.status} (${response.text.slice(0, 120)}).`,
  );
  assert(
    body?.error === 'RATE_LIMITED',
    `data-export expected RATE_LIMITED body, got ${response.text.slice(0, 120)}.`,
  );
  assert(
    /^\d+$/.test(response.retryAfter ?? ''),
    'data-export expected numeric Retry-After header.',
  );
}

async function assertSignedUrlExpiry(url) {
  const before = await fetch(url);
  assert(
    before.ok,
    `data-export photo signed URL was not downloadable before expiry; status ${before.status}.`,
  );
  await before.arrayBuffer();

  await wait(signedUrlExpiryWaitSeconds * 1000);

  const after = await fetch(url);
  if (after.body) await after.body.cancel().catch(() => {});
  assert(
    !after.ok,
    `data-export photo signed URL was still downloadable after ${signedUrlExpiryWaitSeconds}s; status ${after.status}.`,
  );
  samples.push({
    scope: 'data-export-photo-url-expiry',
    ttlSeconds: dataExportPhotoUrlTtlSeconds,
    waitSeconds: signedUrlExpiryWaitSeconds,
    beforeStatus: before.status,
    afterStatus: after.status,
  });
}

async function exhaustDataExportRateLimit(user) {
  for (let attempt = 1; attempt <= dataExportProbeBudget; attempt += 1) {
    const response = await postDataExport(user.token);
    if (response.status === 429) {
      assertDataExportRateLimited(response);
      return { attempts: attempt, retryAfter: response.retryAfter };
    }

    const body = parseJson(response.text);
    assert(
      response.status === 200,
      `data-export before limit expected 200, got ${response.status}.`,
    );
    assert(
      body?.user_id === user.id,
      `data-export before limit returned wrong user_id: ${response.text.slice(0, 120)}.`,
    );
    assert(
      body?.export_schema_version === 2,
      'data-export before limit returned the wrong export schema version.',
    );
  }
  throw new Error(
    `data-export did not return 429 within ${dataExportProbeBudget} attempts; check deployed DATA_EXPORT_RATE_LIMIT_MAX.`,
  );
}

function keyHashFor(scope, userId) {
  return createHmac('sha256', secretKey).update(`${scope}|${userId}`).digest('hex');
}

async function assertDataExportLimiterRow(admin, userId, attempts) {
  const keyHash = keyHashFor('data-export', userId);
  const { data, error } = await admin
    .from('edge_rate_limits')
    .select('scope,key_hash,window_seconds,request_count,updated_at')
    .eq('scope', 'data-export')
    .eq('key_hash', keyHash)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  assert(row, 'data-export: expected an edge_rate_limits row for the synthetic data-rights user.');
  assert(
    /^[a-f0-9]{64}$/.test(row.key_hash),
    'data-export: key_hash is not a 64-character lowercase hex digest.',
  );
  assert(
    !JSON.stringify(row).includes(userId),
    'data-export: edge_rate_limits row contains the raw user id.',
  );
  assert(
    row.request_count >= attempts,
    `data-export: request_count ${row.request_count} is lower than probe attempts ${attempts}.`,
  );
  assert(
    row.request_count >= dataExportRateLimitMax + 1,
    'data-export: request count did not exceed the configured max.',
  );
  assert(row.window_seconds >= 60, 'data-export: window_seconds must be at least 60.');
  samples.push({
    scope: 'data-export',
    keyHashRedacted: `${row.key_hash.slice(0, 8)}...${row.key_hash.slice(-4)}`,
    keyHashLength: row.key_hash.length,
    requestCount: row.request_count,
    windowSeconds: row.window_seconds,
  });
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live data-rights harness not run; set PHASE9_RUN_LIVE_DATA_RIGHTS=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live data rights', errors, warnings);
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
    dataExportProbeBudget > dataExportRateLimitMax,
    'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX must be greater than DATA_EXPORT_RATE_LIMIT_MAX.',
  );
  if (runSignedUrlExpiryCheck) {
    block(
      errors,
      dataExportPhotoUrlTtlSeconds <= 120,
      'DATA_EXPORT_PHOTO_URL_TTL_SECONDS must be 120 or lower for the live signed URL expiry check.',
    );
    block(
      errors,
      signedUrlExpiryWaitSeconds > dataExportPhotoUrlTtlSeconds,
      'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS must be greater than DATA_EXPORT_PHOTO_URL_TTL_SECONDS.',
    );
  }
  block(
    errors,
    appEnv !== 'production' || env.PHASE9_ALLOW_PRODUCTION_LIVE_DATA_RIGHTS === 'true',
    'Refusing production live data-rights tests without PHASE9_ALLOW_PRODUCTION_LIVE_DATA_RIGHTS=true.',
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live data rights', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const users = [];
  const storagePaths = [];
  const externalOrderIds = [];

  try {
    const userA = await createLiveUser(admin, 'a');
    const userB = await createLiveUser(admin, 'b');
    users.push(userA, userB);
    let callerPhotoSignedUrl = null;

    const seed = async (user, label) => {
      await upsertOne(user.client, 'profiles', {
        id: user.id,
        display_name: `Phase 9 Data ${label}`,
        units: 'metric',
      });
      const skinProfile = await insertOne(user.client, 'skin_profiles', {
        user_id: user.id,
        oily_dry: label === 'a' ? 1 : 2,
        sensitive_resistant: 2,
        fitzpatrick: 3,
        goals: [`phase9-data-${label}`],
        completed_at: new Date().toISOString(),
      });
      const product = await insertOne(user.client, 'user_products', {
        user_id: user.id,
        manual_name: `Phase 9 ${label} Cleanser`,
        manual_brand: 'Data Rights Smoke',
        opened_at: new Date().toISOString().slice(0, 10),
        pao_months: 12,
      });
      const routine = await insertOne(user.client, 'routines', {
        user_id: user.id,
        type: 'AM',
        name: `Phase 9 ${label} AM`,
      });
      const step = await insertOne(user.client, 'routine_steps', {
        routine_id: routine.id,
        user_product_id: product.id,
        step_order: 1,
        frequency: 'daily',
        instructions: `Phase 9 ${label} step`,
      });
      const consent = await insertOne(user.client, 'consents', {
        user_id: user.id,
        consent_type: 'health_data_collection',
        granted: true,
        version: `phase9-data-${label}`,
        consent_text_hash: `phase9-data-${label}`,
      });
      await insertOne(user.client, 'consents', {
        user_id: user.id,
        consent_type: 'photo_cloud_backup',
        granted: true,
        version: `phase9-data-${label}`,
        consent_text_hash: `phase9-data-${label}`,
      });
      await insertOne(user.client, 'consents', {
        user_id: user.id,
        consent_type: 'data_sharing',
        granted: true,
        version: `phase9-data-${label}`,
        consent_text_hash: `phase9-data-${label}`,
      });
      const completion = await insertOne(user.client, 'routine_completions', {
        user_id: user.id,
        routine_id: routine.id,
        step_id: step.id,
        completed_date: new Date().toISOString().slice(0, 10),
      });

      const photoPath = `${user.id}/phase9-data-${label}-${randomUUID()}.bin`;
      storagePaths.push(photoPath);
      const upload = await user.client.storage
        .from('photos')
        .upload(photoPath, new Blob([`phase9 data rights ${label}`]), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      if (upload.error) throw upload.error;
      const photo = await insertOne(user.client, 'photos', {
        user_id: user.id,
        storage_path: photoPath,
        local_only: false,
        face_region_redacted: true,
      });

      const clickToken = `phase9-data-${label}-${randomUUID()}`;
      const click = await insertOne(user.client, 'commerce_click_events', {
        user_id: user.id,
        click_token: clickToken,
        product_type: 'cleanser',
        source: 'direct',
        consented: true,
      });
      const externalOrderId = `phase9-data-${label}-${randomUUID()}`;
      externalOrderIds.push(externalOrderId);
      const orderWrite = await admin.from('order_attributions').insert({
        external_order_id: externalOrderId,
        click_token: clickToken,
        order_amount_cents: 1299,
        commission_cents: 123,
        currency: 'USD',
        status: 'locked',
        transaction_date: new Date().toISOString(),
        record_updated_at: new Date().toISOString(),
      });
      if (orderWrite.error) throw orderWrite.error;

      const entitlementWrite = await admin.from('entitlements').upsert({
        user_id: user.id,
        entitlement: 'pro',
        is_active: true,
        product_id: `phase9_data_${label}`,
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        rc_event_id: `phase9-data-${label}-${randomUUID()}`,
        store: 'app_granted',
        period_type: 'reverse_trial',
        will_renew: false,
        original_purchase_at: new Date().toISOString(),
      });
      if (entitlementWrite.error) throw entitlementWrite.error;

      return {
        skinProfile,
        product,
        routine,
        step,
        consent,
        completion,
        photo,
        click,
        clickToken,
        externalOrderId,
      };
    };

    const seededA = await seed(userA, 'a');
    const seededB = await seed(userB, 'b');
    const malformedPhoto = await insertOne(
      admin,
      'photos',
      {
        user_id: userA.id,
        storage_path: seededB.photo.storage_path,
        local_only: false,
        face_region_redacted: true,
      },
      'id, user_id, storage_path',
    );

    await runCheck('data-export returns only caller data and safe service-role rows', async () => {
      const { data, error } = await userA.client.functions.invoke('data-export', {
        method: 'POST',
      });
      if (error) throw error;
      assert(data && typeof data === 'object', 'data-export did not return a JSON bundle.');
      assert(data.user_id === userA.id, 'data-export returned the wrong user_id.');
      assert(data.export_schema_version === 2, 'data-export schema version mismatch.');

      expectBundleHasOnlyUser(data, 'skin_profiles', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'user_products', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'routines', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'routine_completions', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'consents', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'photos', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'commerce_click_events', 'user_id', userA.id, userB.id);
      expectBundleHasOnlyUser(data, 'entitlements', 'user_id', userA.id, userB.id);

      const orderRows = rows(data, 'order_attributions');
      assert(
        orderRows.some((row) => row.external_order_id === seededA.externalOrderId),
        'export missing caller order attribution.',
      );
      assert(
        !orderRows.some((row) => row.external_order_id === seededB.externalOrderId),
        'export leaked another user order attribution.',
      );
      assert(
        orderRows.every((row) => !Object.hasOwn(row, 'commission_cents')),
        'export leaked commission_cents.',
      );

      const photoUrls = rows(data, 'photo_download_urls');
      const callerPhotoUrl = photoUrls.find(
        (row) => row.id === seededA.photo.id && typeof row.url === 'string',
      );
      assert(callerPhotoUrl, 'export missing caller photo signed URL.');
      callerPhotoSignedUrl = callerPhotoUrl.url;
      assert(
        !photoUrls.some((row) => row.id === seededB.photo.id),
        'export leaked another user photo signed URL.',
      );
      assert(
        !photoUrls.some((row) => row.id === malformedPhoto.id),
        'export signed a malformed cross-user photo path.',
      );
      const photoUrlOmissions = rows(data, 'photo_download_url_omissions');
      assert(
        photoUrlOmissions.some(
          (row) => row.id === malformedPhoto.id && row.reason === 'INVALID_STORAGE_PATH',
        ),
        'export did not record omission for malformed cross-user photo path.',
      );
    });

    if (runSignedUrlExpiryCheck) {
      await runCheck('data-export photo signed URLs expire after configured TTL', async () => {
        assert(
          callerPhotoSignedUrl,
          'data-export did not capture a caller photo signed URL for expiry verification.',
        );
        await assertSignedUrlExpiry(callerPhotoSignedUrl);
      });
    } else {
      warnings.push(
        'Live data-export signed URL expiry evidence not run; set PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK=true with a short staging DATA_EXPORT_PHOTO_URL_TTL_SECONDS.',
      );
    }

    await runCheck('data-export returns 429 after configured data-rights rate limit', async () => {
      const result = await exhaustDataExportRateLimit(userA);
      await assertDataExportLimiterRow(admin, userA.id, result.attempts);
    });

    await runCheck('edge_rate_limits stores keyed hashes only for data-export scope', async () => {
      const rateLimitSamples = samples.filter((sample) => sample.scope === 'data-export');
      assert(
        rateLimitSamples.length === 1,
        `expected one redacted data-export limiter sample, found ${rateLimitSamples.length}.`,
      );
      const sample = rateLimitSamples[0];
      assert(sample.scope === 'data-export', `unexpected limiter scope ${sample.scope}.`);
      assert(sample.keyHashLength === 64, 'data-export: key hash length must be 64.');
      assert(
        !sample.keyHashRedacted.includes(userA.id),
        'data-export: redacted hash includes raw user id.',
      );
      assert(
        sample.requestCount >= dataExportRateLimitMax + 1,
        'data-export: request count did not exceed configured max.',
      );
    });

    await runCheck(
      'account-deletion deletes caller account/data without touching another user',
      async () => {
        const { data, error } = await userA.client.functions.invoke('account-deletion', {
          method: 'POST',
          body: {},
        });
        if (error) throw error;
        assert(
          data?.deleted === true,
          `account-deletion did not report success: ${JSON.stringify(data)}`,
        );

        assert(!(await userExists(admin, userA.id)), 'deleted user still exists in auth.');
        assert(await userExists(admin, userB.id), 'account-deletion removed the wrong user.');

        await expectAdminRows(admin, 'profiles', 'id', userA.id, 0, 'deleted profile');
        await expectAdminRows(
          admin,
          'skin_profiles',
          'user_id',
          userA.id,
          0,
          'deleted skin profile',
        );
        await expectAdminRows(admin, 'user_products', 'user_id', userA.id, 0, 'deleted shelf');
        await expectAdminRows(admin, 'routines', 'user_id', userA.id, 0, 'deleted routine');
        await expectAdminRows(
          admin,
          'routine_completions',
          'user_id',
          userA.id,
          0,
          'deleted completion',
        );
        await expectAdminRows(admin, 'consents', 'user_id', userA.id, 0, 'deleted consent');
        await expectAdminRows(admin, 'photos', 'user_id', userA.id, 0, 'deleted photo metadata');
        await expectAdminRows(
          admin,
          'commerce_click_events',
          'user_id',
          userA.id,
          0,
          'deleted commerce click',
        );
        await expectAdminRows(admin, 'entitlements', 'user_id', userA.id, 0, 'deleted entitlement');

        await expectAdminRows(admin, 'profiles', 'id', userB.id, 1, 'other user profile retained');
        await expectAdminRows(
          admin,
          'skin_profiles',
          'id',
          seededB.skinProfile.id,
          1,
          'other user skin profile retained',
        );
        await expectAdminRows(
          admin,
          'photos',
          'id',
          seededB.photo.id,
          1,
          'other user photo metadata retained',
        );

        const ownerPhoto = await admin.storage.from('photos').download(seededA.photo.storage_path);
        assert(Boolean(ownerPhoto.error), 'deleted user photo object was still downloadable.');
        const otherPhoto = await admin.storage.from('photos').download(seededB.photo.storage_path);
        if (otherPhoto.error)
          throw new Error('account-deletion removed another user photo object.');

        const { data: ownerOrder, error: ownerOrderError } = await admin
          .from('order_attributions')
          .select('click_token')
          .eq('external_order_id', seededA.externalOrderId)
          .single();
        if (ownerOrderError) throw ownerOrderError;
        assert(
          ownerOrder.click_token === null,
          'deleted user order attribution click token was not scrubbed.',
        );

        const { data: otherOrder, error: otherOrderError } = await admin
          .from('order_attributions')
          .select('click_token')
          .eq('external_order_id', seededB.externalOrderId)
          .single();
        if (otherOrderError) throw otherOrderError;
        assert(
          otherOrder.click_token === seededB.clickToken,
          'account-deletion scrubbed another user order attribution.',
        );
      },
    );
  } finally {
    if (storagePaths.length > 0) {
      await admin.storage
        .from('photos')
        .remove(storagePaths)
        .catch((error) => warnings.push(`Storage cleanup warning: ${redactedErrorKind(error)}`));
    }
    for (const externalOrderId of externalOrderIds) {
      const { error } = await admin
        .from('order_attributions')
        .delete()
        .eq('external_order_id', externalOrderId);
      if (error) warnings.push(`Order cleanup warning: ${redactedErrorKind(error)}`);
    }
    for (const user of users) {
      if (!user?.id) continue;
      if (!(await userExists(admin, user.id))) continue;
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) warnings.push(`User cleanup warning: ${redactedErrorKind(error)}`);
    }
  }

  writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live data rights', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live data rights', errors, warnings);
});
