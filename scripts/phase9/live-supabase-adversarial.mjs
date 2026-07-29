#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import {
  PRIVATE_PUBLIC_TABLES,
  SEALED_PUBLIC_TABLES,
  SERVICE_ONLY_PRIVATE_TABLES,
  HarnessAssertionError,
  authUserMissing,
  block,
  deniedInsertResult,
  deniedReadOrMutationResult,
  envSnapshot,
  exactPostgresErrorResult,
  harnessErrorDetail,
  placeholderEnvValue,
  printResult,
  readScriptAppEnvironment,
  redactedErrorKind,
  storageDeniedResult,
  storageObjectMissing,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const checks = [];
const env = envSnapshot();
const privateTableProbes = new Map();
const serviceCleanup = [];

const runLive = env.PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const anonymousCaptchaToken = env.PHASE9_ANONYMOUS_CAPTCHA_TOKEN;

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

function assert(condition, message) {
  if (!condition) throw new HarnessAssertionError(message);
}

function resultError(error) {
  return harnessErrorDetail(error);
}

function record(name, status, detail = '') {
  checks.push({ name, status, detail });
}

function writeArtifacts(status) {
  artifact.status = status;
  if (status === 'pass' || status === 'fail') artifact.ranAt = new Date().toISOString();
  write(
    'docs/phase-9/generated/live-supabase-adversarial.json',
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  write(
    'docs/phase-9/generated/live-supabase-adversarial.md',
    [
      '# Live Supabase adversarial evidence',
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

function publicClient() {
  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { 'x-health-processing-epoch': '1' } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function isoDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function addIsoDays(value, offsetDays) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function createLiveUser(admin, label, cleanupUsers) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `phase9-${label}-${suffix}@example.invalid`;
  const password = `Phase9-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase9_live_adversarial: true },
  });
  if (error) throw error;
  assert(Boolean(data.user), `Supabase did not return a user for ${label}.`);
  const createdUser = data.user;
  cleanupUsers.push({ id: createdUser.id });

  const client = publicClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  assert(
    signedIn.data.user?.id === createdUser.id,
    `Signed-in user identity did not match the created ${label} user.`,
  );
  const healthGrant = await client.rpc('grant_health_data_consent', {
    p_expected_epoch: 0,
    p_version: 'draft-v1-2026-07-10',
    p_consent_text_hash: '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
  });
  if (healthGrant.error) throw healthGrant.error;
  return { id: createdUser.id, client };
}

async function createSignedAnonymousUser(cleanupUsers) {
  const client = publicClient();
  const credentials = placeholder(anonymousCaptchaToken)
    ? undefined
    : { options: { captchaToken: anonymousCaptchaToken } };
  const { data, error } = await client.auth.signInAnonymously(credentials);
  if (error) throw error;
  assert(Boolean(data.user), 'Supabase did not return a signed anonymous Auth user.');
  cleanupUsers.push({ id: data.user.id });
  assert(data.user.is_anonymous === true, 'Anonymous Auth user did not carry is_anonymous=true.');
  assert(
    data.session?.user?.id === data.user.id,
    'Anonymous Auth session identity did not match its created user.',
  );
  const healthGrant = await client.rpc('grant_health_data_consent', {
    p_expected_epoch: 0,
    p_version: 'draft-v1-2026-07-10',
    p_consent_text_hash: '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
  });
  if (healthGrant.error) throw healthGrant.error;
  return { id: data.user.id, client };
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

async function expectVisible(client, table, column, value, label) {
  const { data, error } = await client.from(table).select(column).eq(column, value);
  if (error) throw error;
  assert(Array.isArray(data) && data.length > 0, `${label}: expected visible own row.`);
}

async function expectNotVisible(client, table, column, value, label) {
  const result = await client.from(table).select(column).eq(column, value);
  assert(
    deniedReadOrMutationResult(result),
    result.error
      ? `${label}: expected PostgreSQL 42501 or an exact empty row set; received ${redactedErrorKind(result.error)}.`
      : `${label}: private row was visible or the result was not an exact empty row set.`,
  );
}

async function expectEmptyTable(client, table, select, label) {
  const result = await client.from(table).select(select).limit(1);
  if (result.error) throw result.error;
  assert(
    Array.isArray(result.data) && result.data.length === 0,
    `${label}: expected an exact empty relation.`,
  );
}

async function expectBlockedMutation(label, promise) {
  const result = await promise;
  assert(
    deniedReadOrMutationResult(result),
    result.error
      ? `${label}: expected PostgreSQL 42501 or zero affected rows; received ${redactedErrorKind(result.error)}.`
      : `${label}: blocked mutation did not return an exact empty row set.`,
  );
}

async function expectBlockedInsert(label, promise) {
  const result = await promise;
  assert(
    deniedInsertResult(result),
    result.error
      ? `${label}: expected PostgreSQL 42501; received ${redactedErrorKind(result.error)}.`
      : `${label}: insert unexpectedly succeeded.`,
  );
}

async function expectPostgresCode(label, expectedCode, promise) {
  const result = await promise;
  assert(
    exactPostgresErrorResult(result, expectedCode),
    result.error
      ? `${label}: expected PostgreSQL ${expectedCode}; received ${redactedErrorKind(result.error)}.`
      : `${label}: operation unexpectedly succeeded.`,
  );
}

function expectStorageDenied(label, result, options) {
  assert(
    storageDeniedResult(result, options),
    result.error
      ? `${label}: expected a typed Storage API access denial; received ${redactedErrorKind(result.error)}.`
      : `${label}: Storage operation unexpectedly succeeded.`,
  );
}

async function expectStorageBody(client, path, expectedBody, label) {
  const result = await client.storage.from('photos').download(path);
  if (result.error) throw result.error;
  assert(Boolean(result.data), `${label}: Storage download returned no object.`);
  assert((await result.data.text()) === expectedBody, `${label}: Storage object body changed.`);
}

function registerPrivateTableProbe(table, column, value, crossClient = 'userB') {
  assert(PRIVATE_PUBLIC_TABLES.includes(table), `Unknown private-table probe: ${table}.`);
  assert(!privateTableProbes.has(table), `Duplicate private-table probe: ${table}.`);
  assert(typeof column === 'string' && column.length > 0, `Missing probe column for ${table}.`);
  assert(value !== null && value !== undefined, `Missing probe value for ${table}.`);
  assert(
    crossClient === 'userA' || crossClient === 'userB',
    `Unknown cross-client selector for ${table}.`,
  );
  privateTableProbes.set(table, { column, value, crossClient });
}

function registerClosedPrivateTableProbe(table, column, value) {
  assert(PRIVATE_PUBLIC_TABLES.includes(table), `Unknown closed private-table probe: ${table}.`);
  assert(!privateTableProbes.has(table), `Duplicate private-table probe: ${table}.`);
  assert(
    typeof column === 'string' && column.length > 0,
    `Missing closed probe column for ${table}.`,
  );
  assert(value !== null && value !== undefined, `Missing closed probe value for ${table}.`);
  privateTableProbes.set(table, { closed: true, column, value });
}

function registerSealedPrivateTableProbe(table, column, value) {
  assert(SEALED_PUBLIC_TABLES.includes(table), `Unknown sealed private-table probe: ${table}.`);
  assert(!privateTableProbes.has(table), `Duplicate private-table probe: ${table}.`);
  assert(
    typeof column === 'string' && column.length > 0,
    `Missing sealed probe column for ${table}.`,
  );
  assert(value !== null && value !== undefined, `Missing sealed probe value for ${table}.`);
  privateTableProbes.set(table, { sealed: true, column, value });
}

function trackServiceCleanup(table, column, value) {
  serviceCleanup.push({ table, column, value });
}

async function grantConsent(client, userId, consentType) {
  return insertOne(client, 'consents', {
    user_id: userId,
    consent_type: consentType,
    granted: true,
    version: 'phase9-live-adversarial',
    consent_text_hash: 'phase9-live-adversarial',
  });
}

async function revokeConsent(client, userId, consentType) {
  return insertOne(client, 'consents', {
    user_id: userId,
    consent_type: consentType,
    granted: false,
    version: 'phase9-live-adversarial',
    consent_text_hash: 'phase9-live-adversarial',
    revoked_at: new Date().toISOString(),
  });
}

async function deleteByIds(admin, table, ids) {
  if (ids.length === 0) return;
  const { error } = await admin.from(table).delete().in('id', ids);
  if (error) throw error;
  const remaining = await admin.from(table).select('id').in('id', ids);
  if (remaining.error) throw remaining.error;
  assert(
    Array.isArray(remaining.data) && remaining.data.length === 0,
    `${table} cleanup left a residual row.`,
  );
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live Supabase adversarial harness not run; set PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live Supabase adversarial', errors, warnings);
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
    appEnv !== 'production' || env.PHASE9_ALLOW_PRODUCTION_LIVE_SUPABASE_ADVERSARIAL === 'true',
    'Refusing production live adversarial tests without PHASE9_ALLOW_PRODUCTION_LIVE_SUPABASE_ADVERSARIAL=true.',
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live Supabase adversarial', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    global: { headers: { 'x-health-processing-epoch': '1' } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const unauthenticated = publicClient();
  const users = [];
  const storagePaths = [];
  const globalCleanup = {
    communityNoteIds: [],
    communityTopicIds: [],
  };

  try {
    const userA = await createLiveUser(admin, 'a', users);
    const userB = await createLiveUser(admin, 'b', users);
    const signedAnonymous = await createSignedAnonymousUser(users);

    for (const [label, user] of [
      ['a', userA],
      ['b', userB],
      ['anonymous', signedAnonymous],
    ]) {
      const { data, error } = await user.client.rpc('grant_health_data_consent', {
        p_expected_epoch: 0,
        p_version: 'draft-v1-2026-07-10',
        p_consent_text_hash: '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
      });
      if (error) throw error;
      assert(
        Array.isArray(data) && data[0]?.state === 'active' && data[0]?.epoch === 1,
        `Health consent activation failed for user ${label}.`,
      );
    }

    await runCheck('profile owner isolation', async () => {
      const { data: profile, error: profileError } = await userA.client
        .from('profiles')
        .update({
          display_name: 'Phase 9 User A',
          units: 'metric',
        })
        .eq('id', userA.id)
        .select()
        .single();
      if (profileError) throw profileError;
      registerPrivateTableProbe('profiles', 'id', profile.id);
      await expectVisible(userA.client, 'profiles', 'id', profile.id, 'profile owner read');
      await expectNotVisible(userB.client, 'profiles', 'id', profile.id, 'profile cross-user read');
      await expectBlockedMutation(
        'profile cross-user update',
        userB.client
          .from('profiles')
          .update({ display_name: 'Phase 9 bad update' })
          .eq('id', profile.id)
          .select('id'),
      );
      await expectNotVisible(
        unauthenticated,
        'profiles',
        'id',
        profile.id,
        'profile unauthenticated read',
      );
    });

    let product;
    let secondProduct;
    let crossUserProduct;
    let routine;
    let step;
    let adherenceReferenceDay;
    await runCheck('skin profile, shelf, routine, and completion isolation', async () => {
      const skinProfile = await insertOne(userA.client, 'skin_profiles', {
        user_id: userA.id,
        oily_dry: 1,
        sensitive_resistant: 2,
        fitzpatrick: 3,
        goals: ['phase9-smoke'],
        completed_at: new Date().toISOString(),
      });
      registerPrivateTableProbe('skin_profiles', 'id', skinProfile.id);
      await expectVisible(
        userA.client,
        'skin_profiles',
        'id',
        skinProfile.id,
        'skin profile owner read',
      );
      await expectNotVisible(
        userB.client,
        'skin_profiles',
        'id',
        skinProfile.id,
        'skin profile cross-user read',
      );
      await expectBlockedInsert(
        'skin profile cross-user insert',
        userB.client.from('skin_profiles').insert({ user_id: userA.id, goals: ['bad'] }),
      );

      product = await insertOne(userA.client, 'user_products', {
        user_id: userA.id,
        manual_name: 'Phase 9 Cleanser',
        manual_brand: 'Security Smoke',
        is_opened: false,
        opened_at: null,
        pao_months: null,
        pao_source: 'unknown',
        expiry_source: 'unknown',
      });
      registerPrivateTableProbe('user_products', 'id', product.id);
      secondProduct = await insertOne(userA.client, 'user_products', {
        user_id: userA.id,
        manual_name: 'Phase 9 Serum',
        manual_brand: 'Security Smoke',
        is_opened: false,
        opened_at: null,
        pao_months: null,
        pao_source: 'unknown',
        expiry_source: 'unknown',
      });
      crossUserProduct = await insertOne(userB.client, 'user_products', {
        user_id: userB.id,
        manual_name: 'Phase 9 User B Serum',
        manual_brand: 'Security Smoke',
        is_opened: false,
        opened_at: null,
        pao_months: null,
        pao_source: 'unknown',
        expiry_source: 'unknown',
      });
      await expectVisible(userA.client, 'user_products', 'id', product.id, 'shelf owner read');
      await expectNotVisible(
        userB.client,
        'user_products',
        'id',
        product.id,
        'shelf cross-user read',
      );
      await expectNotVisible(
        userA.client,
        'user_products',
        'id',
        crossUserProduct.id,
        'shelf reverse cross-user read',
      );
      await expectBlockedInsert(
        'shelf cross-user insert',
        userB.client.from('user_products').insert({
          user_id: userA.id,
          manual_name: 'bad product',
          is_opened: false,
          opened_at: null,
          pao_months: null,
          pao_source: 'unknown',
          expiry_source: 'unknown',
        }),
      );

      routine = await insertOne(userA.client, 'routines', {
        user_id: userA.id,
        type: 'AM',
        name: 'Phase 9 AM',
      });
      registerPrivateTableProbe('routines', 'id', routine.id);
      step = await insertOne(userA.client, 'routine_steps', {
        routine_id: routine.id,
        user_product_id: product.id,
        step_order: 1,
        frequency: 'daily',
        instructions: 'Phase 9 smoke test step',
      });
      registerPrivateTableProbe('routine_steps', 'id', step.id);
      await expectVisible(userA.client, 'routine_steps', 'id', step.id, 'routine step owner read');
      await expectNotVisible(
        userB.client,
        'routine_steps',
        'id',
        step.id,
        'routine step cross-user read',
      );
      await expectBlockedInsert(
        'routine step cross-user insert',
        userB.client.from('routine_steps').insert({ routine_id: routine.id, step_order: 2 }),
      );
      await expectBlockedInsert(
        'routine step cross-user product insert',
        userA.client.from('routine_steps').insert({
          routine_id: routine.id,
          user_product_id: crossUserProduct.id,
          step_order: 3,
        }),
      );
      await expectPostgresCode(
        'routine step cross-user product update',
        '42501',
        userA.client
          .from('routine_steps')
          .update({ user_product_id: crossUserProduct.id })
          .eq('id', step.id)
          .select('id'),
      );

      const adherence = await userA.client.rpc('set_routine_adherence_timezone', {
        p_timezone: 'America/Toronto',
      });
      if (adherence.error) throw adherence.error;
      const adherenceProjection = Array.isArray(adherence.data) ? adherence.data[0] : null;
      assert(
        /^\d{4}-\d{2}-\d{2}$/u.test(String(adherenceProjection?.reference_day ?? '')),
        'adherence timezone setter did not return an exact local reference day.',
      );
      adherenceReferenceDay = adherenceProjection.reference_day;

      const completion = await insertOne(userA.client, 'routine_completions', {
        user_id: userA.id,
        routine_id: routine.id,
        step_id: step.id,
        completed_date: isoDate(),
      });
      registerPrivateTableProbe('routine_completions', 'id', completion.id);
      await expectVisible(
        userA.client,
        'routine_completions',
        'id',
        completion.id,
        'completion owner read',
      );
      await expectNotVisible(
        userB.client,
        'routine_completions',
        'id',
        completion.id,
        'completion cross-user read',
      );
      await expectBlockedInsert(
        'completion cross-user insert',
        userB.client.from('routine_completions').insert({
          user_id: userA.id,
          routine_id: routine.id,
          step_id: step.id,
          completed_date: isoDate(-1),
        }),
      );
      await expectBlockedMutation(
        'completion client update',
        userA.client
          .from('routine_completions')
          .update({ source: 'backfilled' })
          .eq('id', completion.id)
          .select('id'),
      );
    });

    await runCheck('routine conflict, active ramp, cycle, and shelf scan isolation', async () => {
      assert(
        product && secondProduct && crossUserProduct && routine,
        'routine prerequisite rows were not created.',
      );
      // The global clinical rule table is deliberately unreadable even to the
      // service role. Use the fixed migration seed only as an FK fixture; this
      // test is about owner isolation of routine_conflicts, not publication of
      // the unreviewed rule itself.
      const conflictRuleId = '00000000-0000-4000-8000-000000000001';

      const firstConflictPayload = {
        user_id: userA.id,
        rule_id: conflictRuleId,
        product_a_id: product.id,
        product_b_id: secondProduct.id,
        computed_severity: 'mild',
        status: 'suggested',
        rule_version: 1,
      };
      const firstConflictAttempt = await userA.client
        .from('routine_conflicts')
        .insert(firstConflictPayload)
        .select('*')
        .single();
      let conflict;
      let canonicalConflictPayload;
      if (firstConflictAttempt.error) {
        assert(
          exactPostgresErrorResult(firstConflictAttempt, '23514'),
          `routine conflict first ordering expected PostgreSQL 23514 or success; received ${redactedErrorKind(firstConflictAttempt.error)}.`,
        );
        canonicalConflictPayload = {
          ...firstConflictPayload,
          product_a_id: secondProduct.id,
          product_b_id: product.id,
        };
        conflict = await insertOne(userA.client, 'routine_conflicts', canonicalConflictPayload);
      } else {
        assert(Boolean(firstConflictAttempt.data), 'routine conflict insert returned no row.');
        canonicalConflictPayload = firstConflictPayload;
        conflict = firstConflictAttempt.data;
      }
      const canonicalProductAId = canonicalConflictPayload.product_a_id;
      const canonicalProductBId = canonicalConflictPayload.product_b_id;
      registerPrivateTableProbe('routine_conflicts', 'id', conflict.id);
      assert(
        conflict.product_a_id === canonicalProductAId &&
          conflict.product_b_id === canonicalProductBId,
        'routine conflict stored product order was not canonical.',
      );
      await expectPostgresCode(
        'routine conflict swapped canonical pair',
        '23514',
        userA.client.from('routine_conflicts').insert({
          ...canonicalConflictPayload,
          product_a_id: canonicalProductBId,
          product_b_id: canonicalProductAId,
        }),
      );
      await expectPostgresCode(
        'routine conflict duplicate canonical identity',
        '23505',
        userA.client.from('routine_conflicts').insert(canonicalConflictPayload),
      );
      const canonicalRows = await userA.client
        .from('routine_conflicts')
        .select('id')
        .eq('user_id', userA.id)
        .eq('rule_id', conflictRuleId)
        .eq('product_a_id', canonicalProductAId)
        .eq('product_b_id', canonicalProductBId);
      if (canonicalRows.error) throw canonicalRows.error;
      assert(
        canonicalRows.data.length === 1,
        'routine conflict canonical identity did not resolve to exactly one row.',
      );
      await expectVisible(
        userA.client,
        'routine_conflicts',
        'id',
        conflict.id,
        'routine conflict owner read',
      );
      await expectNotVisible(
        userB.client,
        'routine_conflicts',
        'id',
        conflict.id,
        'routine conflict cross-user read',
      );
      await expectBlockedInsert(
        'routine conflict cross-user insert',
        userB.client.from('routine_conflicts').insert({
          user_id: userA.id,
          rule_id: conflictRuleId,
          computed_severity: 'mild',
        }),
      );
      await expectBlockedInsert(
        'routine conflict cross-user product insert',
        userA.client.from('routine_conflicts').insert({
          user_id: userA.id,
          rule_id: conflictRuleId,
          product_a_id: crossUserProduct.id,
          computed_severity: 'mild',
        }),
      );

      const ramp = await insertOne(userA.client, 'active_ramp', {
        user_id: userA.id,
        user_product_id: product.id,
        ramp_class: 'retinoid',
        freq_per_week: 1,
        target_per_week: 3,
        started_at: isoDate(),
      });
      registerPrivateTableProbe('active_ramp', 'id', ramp.id);
      await expectVisible(userA.client, 'active_ramp', 'id', ramp.id, 'active ramp owner read');
      await expectNotVisible(
        userB.client,
        'active_ramp',
        'id',
        ramp.id,
        'active ramp cross-user read',
      );
      await expectBlockedInsert(
        'active ramp cross-user insert',
        userB.client.from('active_ramp').insert({
          user_id: userA.id,
          user_product_id: secondProduct.id,
          ramp_class: 'retinoid',
          freq_per_week: 1,
          target_per_week: 3,
        }),
      );
      await expectBlockedInsert(
        'active ramp cross-user product insert',
        userA.client.from('active_ramp').insert({
          user_id: userA.id,
          user_product_id: crossUserProduct.id,
          ramp_class: 'aha',
          freq_per_week: 1,
          target_per_week: 2,
        }),
      );

      const cycle = await insertOne(userA.client, 'cycles', {
        user_id: userA.id,
        variant: 'gentle',
        length_nights: 4,
        anchor_date: isoDate(),
      });
      registerPrivateTableProbe('cycles', 'id', cycle.id);
      const cycleNight = await insertOne(userA.client, 'cycle_nights', {
        cycle_id: cycle.id,
        night_index: 0,
        slot: 'retinoid',
        user_product_id: product.id,
      });
      registerPrivateTableProbe('cycle_nights', 'cycle_id', cycleNight.cycle_id);
      await expectVisible(userA.client, 'cycles', 'id', cycle.id, 'cycle owner read');
      await expectNotVisible(userB.client, 'cycles', 'id', cycle.id, 'cycle cross-user read');
      await expectVisible(
        userA.client,
        'cycle_nights',
        'cycle_id',
        cycle.id,
        'cycle night owner read',
      );
      await expectNotVisible(
        userB.client,
        'cycle_nights',
        'cycle_id',
        cycle.id,
        'cycle night cross-user read',
      );
      await expectBlockedInsert(
        'cycle night cross-user cycle insert',
        userB.client.from('cycle_nights').insert({
          cycle_id: cycle.id,
          night_index: 1,
          slot: 'recovery',
        }),
      );
      await expectBlockedInsert(
        'cycle night cross-user product insert',
        userA.client.from('cycle_nights').insert({
          cycle_id: cycle.id,
          night_index: 2,
          slot: 'other_active',
          user_product_id: crossUserProduct.id,
        }),
      );
      await expectPostgresCode(
        'cycle night cross-user product update',
        '42501',
        userA.client
          .from('cycle_nights')
          .update({ user_product_id: crossUserProduct.id })
          .eq('cycle_id', cycleNight.cycle_id)
          .eq('night_index', cycleNight.night_index)
          .select('cycle_id'),
      );

      await expectBlockedInsert(
        'sealed shelf scan insert',
        userA.client.from('shelf_scans').insert({ user_id: userA.id, result: 'no_match' }),
      );
      registerSealedPrivateTableProbe('shelf_scans', 'id', randomUUID());
    });

    await runCheck('Shelf provenance matrix', async () => {
      const shelfCases = [
        {
          name: 'unopened printed expiry',
          expectedSource: 'printed',
          mismatchedSource: 'estimated',
          expectedComputed: '2032-06-15',
          payload: {
            is_opened: false,
            opened_at: null,
            pao_months: null,
            pao_source: 'unknown',
            expiry_date: '2032-06-15',
            expiry_source: 'printed',
          },
        },
        {
          name: 'unopened unknown expiry',
          expectedSource: 'unknown',
          mismatchedSource: 'estimated',
          expectedComputed: null,
          payload: {
            is_opened: false,
            opened_at: null,
            pao_months: null,
            pao_source: 'unknown',
            expiry_date: null,
            expiry_source: 'unknown',
          },
        },
        {
          name: 'opened unknown expiry',
          expectedSource: 'unknown',
          mismatchedSource: 'pao_computed',
          expectedComputed: null,
          payload: {
            is_opened: true,
            opened_at: '2024-01-15',
            pao_months: null,
            pao_source: 'unknown',
            expiry_date: null,
            expiry_source: 'unknown',
          },
        },
        {
          name: 'opened printed expiry wins',
          expectedSource: 'printed',
          mismatchedSource: 'pao_computed',
          expectedComputed: '2032-06-15',
          payload: {
            is_opened: true,
            opened_at: '2024-01-15',
            pao_months: 120,
            pao_source: 'label',
            expiry_date: '2032-06-15',
            expiry_source: 'printed',
          },
        },
        {
          name: 'opened PAO expiry wins',
          expectedSource: 'pao_computed',
          mismatchedSource: 'printed',
          expectedComputed: '2025-01-15',
          payload: {
            is_opened: true,
            opened_at: '2024-01-15',
            pao_months: 12,
            pao_source: 'label',
            expiry_date: '2032-06-15',
            expiry_source: 'pao_computed',
          },
        },
      ];

      for (const shelfCase of shelfCases) {
        const basePayload = {
          user_id: userA.id,
          manual_brand: 'Phase 9 Shelf Provenance',
          ...shelfCase.payload,
        };
        const row = await insertOne(userA.client, 'user_products', {
          ...basePayload,
          manual_name: `Phase 9 ${shelfCase.name}`,
        });
        assert(
          row.expiry_source === shelfCase.expectedSource &&
            row.expiry_computed === shelfCase.expectedComputed,
          `Shelf ${shelfCase.name}: stored provenance did not match the derived branch.`,
        );

        await expectPostgresCode(
          `Shelf ${shelfCase.name} mismatched source insert`,
          '23514',
          userA.client.from('user_products').insert({
            ...basePayload,
            manual_name: `Phase 9 invalid ${shelfCase.name}`,
            expiry_source: shelfCase.mismatchedSource,
          }),
        );
        await expectPostgresCode(
          `Shelf ${shelfCase.name} mismatched source update`,
          '23514',
          userA.client
            .from('user_products')
            .update({ expiry_source: shelfCase.mismatchedSource })
            .eq('id', row.id)
            .select('id'),
        );

        const unchanged = await admin
          .from('user_products')
          .select('expiry_source, expiry_computed')
          .eq('id', row.id)
          .single();
        if (unchanged.error) throw unchanged.error;
        assert(
          unchanged.data.expiry_source === shelfCase.expectedSource &&
            unchanged.data.expiry_computed === shelfCase.expectedComputed,
          `Shelf ${shelfCase.name}: failed update changed the stored row.`,
        );
      }

      for (const paoSource of ['label', 'catalog']) {
        const expectedExpirySource = 'pao_computed';
        const row = await insertOne(userA.client, 'user_products', {
          user_id: userA.id,
          manual_name: `Phase 9 PAO source ${paoSource}`,
          manual_brand: 'Phase 9 Shelf Provenance',
          is_opened: true,
          opened_at: '2024-01-15',
          pao_months: 12,
          pao_source: paoSource,
          expiry_date: null,
          expiry_source: expectedExpirySource,
        });
        assert(
          row.pao_source === paoSource &&
            row.expiry_source === expectedExpirySource &&
            row.expiry_computed === '2025-01-15',
          `Shelf PAO source ${paoSource}: stored provenance or computed expiry was wrong.`,
        );

        await expectPostgresCode(
          `Shelf PAO source ${paoSource} null update`,
          '23514',
          userA.client
            .from('user_products')
            .update({ pao_months: null, pao_source: paoSource })
            .eq('id', row.id)
            .select('id'),
        );
        const unchanged = await admin
          .from('user_products')
          .select('pao_months, pao_source, expiry_source, expiry_computed')
          .eq('id', row.id)
          .single();
        if (unchanged.error) throw unchanged.error;
        assert(
          unchanged.data.pao_months === 12 &&
            unchanged.data.pao_source === paoSource &&
            unchanged.data.expiry_source === expectedExpirySource &&
            unchanged.data.expiry_computed === '2025-01-15',
          `Shelf PAO source ${paoSource}: failed update changed the stored row.`,
        );
      }

      await expectPostgresCode(
        'Shelf non-null PAO with unknown provenance',
        '23514',
        userA.client.from('user_products').insert({
          user_id: userA.id,
          manual_name: 'Phase 9 invalid unknown PAO',
          manual_brand: 'Phase 9 Shelf Provenance',
          is_opened: true,
          opened_at: '2024-01-15',
          pao_months: 12,
          pao_source: 'unknown',
          expiry_date: null,
          expiry_source: 'unknown',
        }),
      );

      await expectPostgresCode(
        'Shelf unlinked category estimate without catalog provenance',
        '23514',
        userA.client.from('user_products').insert({
          user_id: userA.id,
          manual_name: 'Phase 9 invalid unlinked category estimate',
          manual_brand: 'Phase 9 Shelf Provenance',
          catalog_product_id: null,
          is_opened: true,
          opened_at: '2024-01-15',
          pao_months: 9,
          pao_source: 'category_default',
          expiry_date: null,
          expiry_source: 'estimated',
        }),
      );

      for (const invalidSource of ['label', 'catalog', 'category_default']) {
        await expectPostgresCode(
          `Shelf null PAO with ${invalidSource} provenance`,
          '23514',
          userA.client.from('user_products').insert({
            user_id: userA.id,
            manual_name: `Phase 9 invalid null PAO ${invalidSource}`,
            manual_brand: 'Phase 9 Shelf Provenance',
            is_opened: false,
            opened_at: null,
            pao_months: null,
            pao_source: invalidSource,
            expiry_date: null,
            expiry_source: 'unknown',
          }),
        );
      }
    });

    await runCheck('consent append-only and entitlement service-only isolation', async () => {
      const { data: consent, error: consentReadError } = await userA.client
        .from('consents')
        .select('id, granted, revoked_at, version')
        .eq('consent_type', 'health_data_collection')
        .order('granted_at', { ascending: false })
        .limit(1)
        .single();
      if (consentReadError) throw consentReadError;
      registerPrivateTableProbe('consents', 'id', consent.id);
      await expectVisible(userA.client, 'consents', 'id', consent.id, 'consent owner read');
      await expectNotVisible(userB.client, 'consents', 'id', consent.id, 'consent cross-user read');
      await expectBlockedInsert(
        'health consent owner direct insert',
        userA.client.from('consents').insert({
          user_id: userA.id,
          consent_type: 'health_data_collection',
          granted: false,
          version: 'bad-direct-revocation',
          consent_text_hash: 'c'.repeat(64),
        }),
      );
      await expectBlockedInsert(
        'consent cross-user insert',
        userB.client.from('consents').insert({
          user_id: userA.id,
          consent_type: 'health_data_collection',
          granted: true,
          version: 'bad',
          consent_text_hash: 'bad',
        }),
      );
      await expectBlockedMutation(
        'consent client update',
        userA.client.from('consents').update({ granted: false }).eq('id', consent.id).select('id'),
      );
      await expectPostgresCode(
        'consent append-only admin update',
        'P0001',
        admin.from('consents').update({ granted: false }).eq('id', consent.id).select('id'),
      );
      const unchangedConsent = await admin
        .from('consents')
        .select('granted, revoked_at, version')
        .eq('id', consent.id)
        .single();
      if (unchangedConsent.error) throw unchangedConsent.error;
      assert(
        unchangedConsent.data.granted === true &&
          unchangedConsent.data.revoked_at === null &&
          unchangedConsent.data.version === 'phase9-live-adversarial-a',
        'consent row changed after append-only update denials.',
      );

      const { error: reverseTrialGrantError } = await admin.rpc('grant_app_granted_reverse_trial', {
        p_user_id: userA.id,
        p_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        p_environment: appEnv === 'production' ? 'production' : 'development',
      });
      if (reverseTrialGrantError) throw reverseTrialGrantError;

      const snapshotAt = new Date();
      const entitlementExpiresAt = new Date(snapshotAt.getTime() + 7 * 86_400_000).toISOString();
      const { error: entitlementWriteError } = await admin.rpc(
        'reconcile_revenuecat_entitlement_snapshot',
        {
          p_user_id: userA.id,
          p_snapshot_at: snapshotAt.toISOString(),
          p_entitlement: 'pro',
          p_is_active: true,
          p_product_id: 'phase9_live_adversarial',
          p_expires_at: entitlementExpiresAt,
          p_store: 'app_store',
          p_period_type: 'normal',
          p_will_renew: true,
          p_original_purchase_at: new Date(snapshotAt.getTime() - 86_400_000).toISOString(),
          p_offering_id: null,
          p_environment: 'sandbox',
          p_management_url: null,
          p_package_id: null,
        },
      );
      if (entitlementWriteError) throw entitlementWriteError;
      registerPrivateTableProbe('entitlements', 'user_id', userA.id);
      await expectVisible(
        userA.client,
        'entitlements',
        'user_id',
        userA.id,
        'entitlement owner read',
      );
      await expectNotVisible(
        userB.client,
        'entitlements',
        'user_id',
        userA.id,
        'entitlement cross-user read',
      );
      await expectBlockedMutation(
        'entitlement client update',
        userA.client
          .from('entitlements')
          .update({ is_active: false })
          .eq('user_id', userA.id)
          .select('user_id'),
      );

      registerPrivateTableProbe('reverse_trial_grants', 'user_id', userA.id);
      await expectNotVisible(
        userA.client,
        'reverse_trial_grants',
        'user_id',
        userA.id,
        'reverse trial grant client read',
      );
      await expectNotVisible(
        userB.client,
        'reverse_trial_grants',
        'user_id',
        userA.id,
        'reverse trial grant cross-user read',
      );
      await expectBlockedInsert(
        'reverse trial grant client insert',
        userA.client.from('reverse_trial_grants').insert({
          user_id: userB.id,
          expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          source: 'bad-client',
        }),
      );
    });

    await runCheck('notification, streak, recommendation, and trend isolation', async () => {
      const preferences = await upsertOne(userA.client, 'notification_preferences', {
        user_id: userA.id,
        am_reminder_time: '08:00',
        pm_reminder_time: '20:00',
        push_token: 'phase9-live-adversarial-redacted',
        timezone: 'America/Toronto',
        lockscreen_discreet: true,
      });
      registerPrivateTableProbe('notification_preferences', 'user_id', preferences.user_id);
      await expectVisible(
        userA.client,
        'notification_preferences',
        'user_id',
        preferences.user_id,
        'notification preferences owner read',
      );
      await expectNotVisible(
        userB.client,
        'notification_preferences',
        'user_id',
        preferences.user_id,
        'notification preferences cross-user read',
      );
      await expectBlockedInsert(
        'notification preferences cross-user insert',
        userA.client
          .from('notification_preferences')
          .insert({ user_id: userB.id, timezone: 'UTC' }),
      );

      const notification = await insertOne(userA.client, 'notification_log', {
        user_id: userA.id,
        tier: 'utility',
        kind: 'am_reminder',
      });
      registerPrivateTableProbe('notification_log', 'id', notification.id);
      await expectVisible(
        userA.client,
        'notification_log',
        'id',
        notification.id,
        'notification log owner read',
      );
      await expectNotVisible(
        userB.client,
        'notification_log',
        'id',
        notification.id,
        'notification log cross-user read',
      );
      await expectBlockedInsert(
        'notification log cross-user insert',
        userB.client
          .from('notification_log')
          .insert({ user_id: userA.id, tier: 'utility', kind: 'pm_step' }),
      );

      assert(adherenceReferenceDay, 'adherence reference day was not configured.');
      await expectBlockedInsert(
        'streak freeze owner insert',
        userA.client.from('streak_freezes').insert({
          user_id: userA.id,
          applied_for_date: addIsoDays(adherenceReferenceDay, -1),
          source: 'auto',
        }),
      );
      await insertOne(userA.client, 'routine_completions', {
        user_id: userA.id,
        routine_id: routine.id,
        step_id: null,
        completed_date: adherenceReferenceDay,
      });
      await insertOne(userA.client, 'routine_completions', {
        user_id: userA.id,
        routine_id: routine.id,
        step_id: null,
        completed_date: addIsoDays(adherenceReferenceDay, -2),
      });
      const freezeRead = await userA.client
        .from('streak_freezes')
        .select('id,user_id,applied_for_date,source')
        .eq('user_id', userA.id)
        .eq('applied_for_date', addIsoDays(adherenceReferenceDay, -1))
        .single();
      if (freezeRead.error) throw freezeRead.error;
      const freeze = freezeRead.data;
      assert(freeze?.source === 'auto', 'server-owned freeze source was not automatic.');
      registerPrivateTableProbe('streak_freezes', 'id', freeze.id);
      await expectVisible(
        userA.client,
        'streak_freezes',
        'id',
        freeze.id,
        'streak freeze owner read',
      );
      await expectNotVisible(
        userB.client,
        'streak_freezes',
        'id',
        freeze.id,
        'streak freeze cross-user read',
      );
      await expectBlockedInsert(
        'streak freeze cross-user insert',
        userB.client.from('streak_freezes').insert({
          user_id: userA.id,
          applied_for_date: addIsoDays(adherenceReferenceDay, -2),
        }),
      );

      const recommendationPreferencesResult = await userA.client.rpc(
        'set_recommendation_preferences',
        {
          p_values_filters: ['fragrance_free'],
          p_budget_band: 'drugstore',
          p_format_prefs: ['gel'],
        },
      );
      if (recommendationPreferencesResult.error) throw recommendationPreferencesResult.error;
      assert(
        Array.isArray(recommendationPreferencesResult.data) &&
          recommendationPreferencesResult.data.length === 1,
        'recommendation preference RPC did not return exactly one owner row.',
      );
      const recommendationPreferences = recommendationPreferencesResult.data[0];
      assert(
        recommendationPreferences?.user_id === userA.id,
        'recommendation preference RPC returned a foreign owner.',
      );
      registerPrivateTableProbe(
        'recommendation_preferences',
        'user_id',
        recommendationPreferences.user_id,
      );
      await expectVisible(
        userA.client,
        'recommendation_preferences',
        'user_id',
        recommendationPreferences.user_id,
        'recommendation preferences owner read',
      );
      await expectNotVisible(
        userB.client,
        'recommendation_preferences',
        'user_id',
        recommendationPreferences.user_id,
        'recommendation preferences cross-user read',
      );
      await expectBlockedMutation(
        'recommendation preferences owner direct update',
        userA.client
          .from('recommendation_preferences')
          .update({ budget_band: 'premium' })
          .eq('user_id', userA.id),
      );
      await expectBlockedInsert(
        'recommendation preferences cross-user insert',
        userA.client
          .from('recommendation_preferences')
          .insert({ user_id: userB.id, values_filters: ['bad'] }),
      );
      await expectBlockedInsert(
        'recommendation preferences service-role direct insert',
        admin.from('recommendation_preferences').insert({
          user_id: userB.id,
          values_filters: ['fragrance_free'],
          budget_band: 'drugstore',
          format_prefs: ['gel'],
        }),
      );

      const absentRecommendationId = '00000000-0000-0000-0000-000000000000';
      registerClosedPrivateTableProbe('recommendations', 'id', absentRecommendationId);
      await expectEmptyTable(
        admin,
        'recommendations',
        'id',
        'recommendation cache service-role zero-admission read',
      );
      await expectEmptyTable(
        userA.client,
        'recommendations',
        'id',
        'recommendation cache owner zero-admission read',
      );
      await expectBlockedInsert(
        'recommendation owner insert while admission is closed',
        userA.client.from('recommendations').insert({
          user_id: userA.id,
          trigger: 'gap',
          product_type: `phase9-${randomUUID()}`,
          fit_rationale: 'Phase 9 closed-admission probe.',
          evidence_grade: 'C',
        }),
      );
      await expectBlockedInsert(
        'recommendation service-role insert while admission is closed',
        admin.from('recommendations').insert({
          user_id: userA.id,
          trigger: 'gap',
          product_type: `phase9-${randomUUID()}`,
          fit_rationale: 'Phase 9 service-role closed-admission probe.',
          evidence_grade: 'C',
        }),
      );
      await expectBlockedInsert(
        'recommendation cross-user insert',
        userB.client.from('recommendations').insert({
          user_id: userA.id,
          trigger: 'goal',
          product_type: `phase9-bad-${randomUUID()}`,
          fit_rationale: 'bad',
        }),
      );

      await grantConsent(userA.client, userA.id, 'photo_trend_insights');
      await grantConsent(userB.client, userB.id, 'photo_trend_insights');
      const trend = await insertOne(userA.client, 'photo_trend', {
        user_id: userA.id,
        series: 'front',
        delta_metric: 0,
        mdc_threshold: 1,
        change_state: 'consistent',
        narrative_key: 'phase9_live_adversarial',
        computed_local_date: isoDate(),
      });
      registerPrivateTableProbe('photo_trend', 'id', trend.id);
      await expectVisible(userA.client, 'photo_trend', 'id', trend.id, 'photo trend owner read');
      await expectNotVisible(
        userB.client,
        'photo_trend',
        'id',
        trend.id,
        'photo trend cross-user read',
      );
      await expectBlockedInsert(
        'photo trend cross-user insert',
        userB.client.from('photo_trend').insert({
          user_id: userA.id,
          series: 'front',
          change_state: 'consistent',
          computed_local_date: isoDate(),
        }),
      );
      await revokeConsent(userA.client, userA.id, 'photo_trend_insights');
      await expectBlockedInsert(
        'photo trend revoked consent insert',
        userA.client.from('photo_trend').insert({
          user_id: userA.id,
          series: 'front',
          change_state: 'consistent',
          computed_local_date: isoDate(),
        }),
      );
      await expectPostgresCode(
        'photo trend revoked consent update',
        '42501',
        userA.client
          .from('photo_trend')
          .update({ narrative_key: 'bad_after_revoke' })
          .eq('id', trend.id)
          .select('id'),
      );
    });

    await runCheck('catalog and commerce telemetry isolation', async () => {
      const correctionWrite = await admin.rpc('submit_catalog_correction', {
        p_user_id: userA.id,
        p_expected_health_epoch: 1,
        p_report_request_id: randomUUID(),
        p_product_id: null,
        p_barcode: null,
        p_correction_type: 'missing_product',
        p_description: 'Phase 9 RLS correction.',
        p_proposed_payload: { productName: 'Phase 9 Cleanser' },
        p_client_context: { route: 'phase9-live-adversarial' },
      });
      if (correctionWrite.error) throw correctionWrite.error;
      assert(
        Array.isArray(correctionWrite.data) && correctionWrite.data.length === 1,
        'catalog correction service RPC did not return exactly one row.',
      );
      const catalogCorrection = correctionWrite.data[0];
      registerPrivateTableProbe('catalog_corrections', 'id', catalogCorrection.id);
      await expectNotVisible(
        userA.client,
        'catalog_corrections',
        'id',
        catalogCorrection.id,
        'catalog correction owner direct read',
      );
      await expectNotVisible(
        userB.client,
        'catalog_corrections',
        'id',
        catalogCorrection.id,
        'catalog correction cross-user read',
      );
      await expectBlockedInsert(
        'catalog correction owner direct insert',
        userA.client
          .from('catalog_corrections')
          .insert({ user_id: userA.id, correction_type: 'missing_product' }),
      );
      await expectBlockedInsert(
        'catalog correction cross-user insert',
        userB.client
          .from('catalog_corrections')
          .insert({ user_id: userA.id, correction_type: 'missing_product' }),
      );

      const lookupWrite = await admin.rpc('record_catalog_lookup_event', {
        p_user_id: userA.id,
        p_expected_health_epoch: 1,
        p_lookup_type: 'search',
        p_result: 'no_match',
        p_rate_limit: 240,
        p_window_seconds: 900,
      });
      if (lookupWrite.error) throw lookupWrite.error;
      assert(typeof lookupWrite.data === 'string', 'catalog lookup RPC returned no event id.');
      const lookupEventId = lookupWrite.data;
      registerPrivateTableProbe('catalog_lookup_events', 'id', lookupEventId);
      await expectVisible(
        userA.client,
        'catalog_lookup_events',
        'id',
        lookupEventId,
        'lookup event owner read',
      );
      await expectNotVisible(
        userB.client,
        'catalog_lookup_events',
        'id',
        lookupEventId,
        'lookup event cross-user read',
      );
      await expectBlockedInsert(
        'lookup event owner direct insert',
        userA.client
          .from('catalog_lookup_events')
          .insert({ user_id: userA.id, lookup_type: 'search', result: 'no_match' }),
      );
      await expectBlockedInsert(
        'lookup event cross-user insert',
        userB.client
          .from('catalog_lookup_events')
          .insert({ user_id: userA.id, lookup_type: 'search', result: 'no_match' }),
      );

      await grantConsent(userA.client, userA.id, 'data_sharing');
      await grantConsent(userB.client, userB.id, 'data_sharing');
      await expectBlockedInsert(
        'commerce click owner insert while admission is closed',
        userA.client.from('commerce_click_events').insert({
          user_id: userA.id,
          click_token: `phase9-closed-${randomUUID()}`,
          product_type: 'cleanser',
          source: 'none',
          consented: true,
        }),
      );
      await expectBlockedInsert(
        'commerce click cross-user insert while admission is closed',
        userB.client.from('commerce_click_events').insert({
          user_id: userA.id,
          click_token: `phase9-cross-closed-${randomUUID()}`,
          product_type: 'cleanser',
          source: 'none',
          consented: true,
        }),
      );
      await revokeConsent(userA.client, userA.id, 'data_sharing');
      await expectBlockedInsert(
        'commerce click revoked consent insert',
        userA.client.from('commerce_click_events').insert({
          user_id: userA.id,
          click_token: `phase9-revoked-${randomUUID()}`,
          product_type: 'cleanser',
          source: 'none',
          consented: true,
        }),
      );
      registerClosedPrivateTableProbe('commerce_click_events', 'id', randomUUID());
    });

    await runCheck('community owner, moderation, and report isolation', async () => {
      const topic = await insertOne(
        admin,
        'community_topics',
        {
          slug: `phase9-${randomUUID()}`,
          title: 'Phase 9 RLS topic',
          description: 'Synthetic live adversarial topic.',
          is_active: true,
        },
        'id',
      );
      globalCleanup.communityTopicIds.push(topic.id);

      const publishedNote = await insertOne(
        admin,
        'community_notes',
        {
          topic_id: topic.id,
          kind: 'explainer',
          title: 'Phase 9 published note',
          body: 'Synthetic published note for RLS testing.',
          evidence_grade: 'C',
          evidence_label: 'plausible',
          provenance: 'editorial',
          claim_safety_ok: true,
          reviewed_by: userA.id,
        },
        'id',
      );
      globalCleanup.communityNoteIds.push(publishedNote.id);
      const unpublishedNote = await insertOne(
        admin,
        'community_notes',
        {
          topic_id: topic.id,
          kind: 'explainer',
          title: 'Phase 9 unpublished note',
          body: 'Synthetic unpublished note for RLS testing.',
          evidence_grade: 'C',
          evidence_label: 'plausible',
          provenance: 'editorial',
          claim_safety_ok: false,
        },
        'id',
      );
      globalCleanup.communityNoteIds.push(unpublishedNote.id);
      await expectVisible(
        userA.client,
        'community_notes',
        'id',
        publishedNote.id,
        'published community note read',
      );
      await expectVisible(
        signedAnonymous.client,
        'community_notes',
        'id',
        publishedNote.id,
        'published community note signed-anonymous authenticated read',
      );
      await expectNotVisible(
        userA.client,
        'community_notes',
        'id',
        unpublishedNote.id,
        'unpublished community note read',
      );

      const blockRow = await insertOne(userA.client, 'community_blocks', {
        user_id: userA.id,
        blocked_handle: `phase9-${randomUUID()}`,
      });
      registerPrivateTableProbe('community_blocks', 'blocked_handle', blockRow.blocked_handle);
      await expectVisible(
        userA.client,
        'community_blocks',
        'blocked_handle',
        blockRow.blocked_handle,
        'community block owner read',
      );
      await expectNotVisible(
        userB.client,
        'community_blocks',
        'blocked_handle',
        blockRow.blocked_handle,
        'community block cross-user read',
      );
      await expectBlockedInsert(
        'community block cross-user insert',
        userB.client
          .from('community_blocks')
          .insert({ user_id: userA.id, blocked_handle: 'bad-handle' }),
      );

      const communityConsent = await grantConsent(
        userA.client,
        userA.id,
        'community_participation',
      );
      const communityConsentB = await grantConsent(
        userB.client,
        userB.id,
        'community_participation',
      );
      const signedAnonymousCommunityConsent = await grantConsent(
        signedAnonymous.client,
        signedAnonymous.id,
        'community_participation',
      );
      await expectBlockedInsert(
        'community question signed-anonymous insert',
        signedAnonymous.client.from('community_questions').insert({
          user_id: signedAnonymous.id,
          topic_id: topic.id,
          body: 'signed anonymous users must not post',
          anon_handle: `phase9-signed-anonymous-${randomUUID()}`,
          moderation_state: 'pending',
          consent_grant_id: signedAnonymousCommunityConsent.id,
        }),
      );
      const pendingQuestion = await insertOne(userA.client, 'community_questions', {
        user_id: userA.id,
        topic_id: topic.id,
        body: 'Phase 9 synthetic pending moderation question.',
        anon_handle: `phase9-${randomUUID()}`,
        moderation_state: 'pending',
        consent_grant_id: communityConsent.id,
      });
      registerPrivateTableProbe('community_questions', 'id', pendingQuestion.id);
      await expectVisible(
        userA.client,
        'community_questions',
        'id',
        pendingQuestion.id,
        'community question owner read',
      );
      await expectNotVisible(
        userB.client,
        'community_questions',
        'id',
        pendingQuestion.id,
        'pending community question cross-user read',
      );
      await expectBlockedInsert(
        'community question cross-user insert',
        userB.client.from('community_questions').insert({
          user_id: userA.id,
          topic_id: topic.id,
          body: 'bad',
          anon_handle: 'bad',
          consent_grant_id: communityConsentB.id,
        }),
      );
      await expectBlockedInsert(
        'community report pending private question insert',
        userB.client.from('community_reports').insert({
          reporter_id: userB.id,
          question_id: pendingQuestion.id,
          reason: 'should not report private pending content',
        }),
      );

      const approvedQuestion = await insertOne(userA.client, 'community_questions', {
        user_id: userA.id,
        topic_id: topic.id,
        body: 'Phase 9 synthetic approved moderation question.',
        anon_handle: `phase9-approved-${randomUUID()}`,
        moderation_state: 'pending',
        consent_grant_id: communityConsent.id,
      });
      const approval = await admin
        .from('community_questions')
        .update({ moderation_state: 'approved' })
        .eq('id', approvedQuestion.id);
      if (approval.error) throw approval.error;
      await expectVisible(
        userB.client,
        'community_questions',
        'id',
        approvedQuestion.id,
        'approved community question public read',
      );

      const moderationEvent = await insertOne(admin, 'community_moderation_events', {
        question_id: approvedQuestion.id,
        action: 'approved',
        reason: 'phase9-live-adversarial',
      });
      trackServiceCleanup('community_moderation_events', 'id', moderationEvent.id);
      registerPrivateTableProbe('community_moderation_events', 'id', moderationEvent.id);
      await expectVisible(
        admin,
        'community_moderation_events',
        'id',
        moderationEvent.id,
        'community moderation event admin read',
      );
      await expectNotVisible(
        userA.client,
        'community_moderation_events',
        'id',
        moderationEvent.id,
        'community moderation event question-owner read',
      );
      await expectNotVisible(
        userB.client,
        'community_moderation_events',
        'id',
        moderationEvent.id,
        'community moderation event cross-user read',
      );
      await expectNotVisible(
        unauthenticated,
        'community_moderation_events',
        'id',
        moderationEvent.id,
        'community moderation event unauthenticated read',
      );
      await expectPostgresCode(
        'community moderation event client insert',
        '42501',
        userA.client.from('community_moderation_events').insert({
          question_id: approvedQuestion.id,
          action: 'rejected',
          reason: 'client mutation must fail',
        }),
      );
      await expectBlockedMutation(
        'community moderation event client update',
        userA.client
          .from('community_moderation_events')
          .update({ reason: 'client update must fail' })
          .eq('id', moderationEvent.id)
          .select('id'),
      );
      await expectBlockedMutation(
        'community moderation event client delete',
        userA.client
          .from('community_moderation_events')
          .delete()
          .eq('id', moderationEvent.id)
          .select('id'),
      );
      const unchangedModerationEvent = await admin
        .from('community_moderation_events')
        .select('action, reason')
        .eq('id', moderationEvent.id)
        .single();
      if (unchangedModerationEvent.error) throw unchangedModerationEvent.error;
      assert(
        unchangedModerationEvent.data.action === 'approved' &&
          unchangedModerationEvent.data.reason === 'phase9-live-adversarial',
        'community moderation event changed after a blocked client mutation.',
      );

      const report = await insertOne(userB.client, 'community_reports', {
        reporter_id: userB.id,
        question_id: approvedQuestion.id,
        reason: 'phase9-live-adversarial',
      });
      registerPrivateTableProbe('community_reports', 'id', report.id, 'userA');
      await expectVisible(
        userB.client,
        'community_reports',
        'id',
        report.id,
        'community report owner read',
      );
      await expectNotVisible(
        userA.client,
        'community_reports',
        'id',
        report.id,
        'community report cross-user read',
      );
      await expectBlockedInsert(
        'community report cross-user reporter insert',
        userA.client.from('community_reports').insert({
          reporter_id: userB.id,
          question_id: approvedQuestion.id,
          reason: 'bad',
        }),
      );

      const reaction = await insertOne(userA.client, 'community_reactions', {
        user_id: userA.id,
        note_id: publishedNote.id,
        reaction: 'helped',
      });
      registerPrivateTableProbe('community_reactions', 'id', reaction.id);
      await expectVisible(
        userA.client,
        'community_reactions',
        'id',
        reaction.id,
        'community reaction owner read',
      );
      await expectNotVisible(
        userB.client,
        'community_reactions',
        'id',
        reaction.id,
        'community reaction cross-user read',
      );
      await expectBlockedInsert(
        'community reaction cross-user insert',
        userB.client.from('community_reactions').insert({
          user_id: userA.id,
          note_id: publishedNote.id,
          reaction: 'use_this',
        }),
      );
      await expectBlockedInsert(
        'community reaction unpublished note insert',
        userA.client.from('community_reactions').insert({
          user_id: userA.id,
          note_id: unpublishedNote.id,
          reaction: 'use_this',
        }),
      );
      await expectBlockedInsert(
        'community reaction null note insert',
        userA.client
          .from('community_reactions')
          .insert({ user_id: userA.id, reaction: 'use_this' }),
      );
      await revokeConsent(userA.client, userA.id, 'community_participation');
      await expectBlockedInsert(
        'community question revoked consent insert',
        userA.client.from('community_questions').insert({
          user_id: userA.id,
          topic_id: topic.id,
          body: 'revoked consent should block this question',
          anon_handle: `phase9-revoked-${randomUUID()}`,
          moderation_state: 'pending',
          consent_grant_id: communityConsent.id,
        }),
      );
      await expectBlockedInsert(
        'community reaction revoked consent insert',
        userA.client.from('community_reactions').insert({
          user_id: userA.id,
          note_id: publishedNote.id,
          reaction: 'use_this',
        }),
      );
    });

    await runCheck('Ask metadata and safety audit isolation', async () => {
      await grantConsent(userA.client, userA.id, 'ask_onskin');
      await grantConsent(userB.client, userB.id, 'ask_onskin');
      const session = await insertOne(userA.client, 'ask_sessions', {
        user_id: userA.id,
        turn_count: 1,
        last_intent: 'phase9_live_adversarial',
        grounded_rate: 1,
        model_tier: 'deterministic',
      });
      registerPrivateTableProbe('ask_sessions', 'id', session.id);
      await expectVisible(userA.client, 'ask_sessions', 'id', session.id, 'Ask session owner read');
      await expectNotVisible(
        userB.client,
        'ask_sessions',
        'id',
        session.id,
        'Ask session cross-user read',
      );
      await expectBlockedInsert(
        'Ask session cross-user insert',
        userB.client.from('ask_sessions').insert({ user_id: userA.id, turn_count: 1 }),
      );

      const turn = await insertOne(userA.client, 'ask_turn_audit', {
        session_id: session.id,
        intent: 'phase9_live_adversarial',
        answer_kind: 'deterministic',
        was_grounded: true,
        was_refused: false,
        was_escalated: false,
        claimsafety_ok: true,
        model_id_version: 'phase9-live-adversarial',
        system_prompt_hash: 'phase9-live-adversarial',
        corpus_version: 'phase9-live-adversarial',
        est_cost_usd: 0,
      });
      registerPrivateTableProbe('ask_turn_audit', 'id', turn.id);
      await expectVisible(userA.client, 'ask_turn_audit', 'id', turn.id, 'Ask turn owner read');
      await expectNotVisible(
        userB.client,
        'ask_turn_audit',
        'id',
        turn.id,
        'Ask turn cross-user read',
      );
      await expectBlockedInsert(
        'Ask turn cross-user session insert',
        userB.client.from('ask_turn_audit').insert({
          session_id: session.id,
          intent: 'bad',
          answer_kind: 'deterministic',
          was_grounded: true,
          was_refused: false,
          was_escalated: false,
          claimsafety_ok: true,
        }),
      );

      const safetyAudit = await insertOne(userA.client, 'ask_safety_audit', {
        user_id: userA.id,
        turn_audit_id: turn.id,
        content_enc: '\\x706861736539',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      registerPrivateTableProbe('ask_safety_audit', 'id', safetyAudit.id);
      await expectVisible(
        userA.client,
        'ask_safety_audit',
        'id',
        safetyAudit.id,
        'Ask safety owner read',
      );
      await expectNotVisible(
        userB.client,
        'ask_safety_audit',
        'id',
        safetyAudit.id,
        'Ask safety cross-user read',
      );
      await expectBlockedInsert(
        'Ask safety cross-user insert',
        userB.client.from('ask_safety_audit').insert({
          user_id: userA.id,
          turn_audit_id: turn.id,
          content_enc: '\\x626164',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      );
      await expectBlockedInsert(
        'Ask safety cross-turn insert',
        userB.client.from('ask_safety_audit').insert({
          user_id: userB.id,
          turn_audit_id: turn.id,
          content_enc: '\\x626164',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      );
      await revokeConsent(userA.client, userA.id, 'ask_onskin');
      await expectBlockedInsert(
        'Ask session revoked consent insert',
        userA.client.from('ask_sessions').insert({ user_id: userA.id, turn_count: 1 }),
      );
      await expectBlockedInsert(
        'Ask safety revoked consent insert',
        userA.client.from('ask_safety_audit').insert({
          user_id: userA.id,
          turn_audit_id: turn.id,
          content_enc: '\\x626164',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      );
    });

    await runCheck('photos table and storage object isolation', async () => {
      const ownerPath = `${userA.id}/e1/phase9-${randomUUID()}.bin`;
      const crossPath = `${userA.id}/e1/phase9-cross-${randomUUID()}.bin`;
      const foreignMetadataPath = `${userB.id}/e1/phase9-foreign-${randomUUID()}.bin`;
      const revokedPath = `${userA.id}/e1/phase9-revoked-${randomUUID()}.bin`;
      const signedAnonymousCloudPath = `${signedAnonymous.id}/e1/phase9-anonymous-${randomUUID()}.bin`;
      const signedAnonymousUpdatePath = `${signedAnonymous.id}/e1/phase9-anonymous-update-${randomUUID()}.bin`;
      const originalObjectBody = 'phase9 live adversarial object';
      const ownerUpdatedObjectBody = 'phase9 live adversarial owner update';
      const signedAnonymousOriginalBody = 'phase9 signed anonymous seeded object';
      storagePaths.push(
        ownerPath,
        crossPath,
        revokedPath,
        signedAnonymousCloudPath,
        signedAnonymousUpdatePath,
      );

      await grantConsent(userA.client, userA.id, 'photo_cloud_backup');
      await grantConsent(userB.client, userB.id, 'photo_cloud_backup');
      const upload = await userA.client.storage
        .from('photos')
        .upload(ownerPath, new Blob([originalObjectBody]), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      if (upload.error) throw upload.error;
      const ownerUpdate = await userA.client.storage
        .from('photos')
        .update(ownerPath, new Blob([ownerUpdatedObjectBody]), {
          contentType: 'application/octet-stream',
        });
      if (ownerUpdate.error) throw ownerUpdate.error;
      await expectStorageBody(
        userA.client,
        ownerPath,
        ownerUpdatedObjectBody,
        'storage consenting owner cloud update',
      );

      const signedAnonymousLocalPhoto = await insertOne(signedAnonymous.client, 'photos', {
        user_id: signedAnonymous.id,
        storage_path: null,
        local_only: true,
        face_region_redacted: false,
      });
      await expectVisible(
        signedAnonymous.client,
        'photos',
        'id',
        signedAnonymousLocalPhoto.id,
        'photo metadata signed-anonymous local-only insert',
      );
      const signedAnonymousLocalUpdate = await signedAnonymous.client
        .from('photos')
        .update({ face_region_redacted: true })
        .eq('id', signedAnonymousLocalPhoto.id)
        .select('id, local_only, storage_path, face_region_redacted')
        .single();
      if (signedAnonymousLocalUpdate.error) throw signedAnonymousLocalUpdate.error;
      assert(
        signedAnonymousLocalUpdate.data.local_only === true &&
          signedAnonymousLocalUpdate.data.storage_path === null &&
          signedAnonymousLocalUpdate.data.face_region_redacted === true,
        'signed-anonymous local-only photo update returned unexpected state.',
      );
      await grantConsent(signedAnonymous.client, signedAnonymous.id, 'photo_cloud_backup');
      const signedAnonymousSeed = await admin.storage
        .from('photos')
        .upload(signedAnonymousUpdatePath, new Blob([signedAnonymousOriginalBody]), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      if (signedAnonymousSeed.error) throw signedAnonymousSeed.error;
      await expectStorageBody(
        signedAnonymous.client,
        signedAnonymousUpdatePath,
        signedAnonymousOriginalBody,
        'storage signed-anonymous seeded object read',
      );
      const signedAnonymousUpdate = await signedAnonymous.client.storage
        .from('photos')
        .update(signedAnonymousUpdatePath, new Blob(['bad signed anonymous update']), {
          contentType: 'application/octet-stream',
        });
      expectStorageDenied('storage signed-anonymous cloud update', signedAnonymousUpdate);
      await expectStorageBody(
        signedAnonymous.client,
        signedAnonymousUpdatePath,
        signedAnonymousOriginalBody,
        'storage signed-anonymous object after blocked update',
      );
      const signedAnonymousPhoto = await insertOne(admin, 'photos', {
        user_id: signedAnonymous.id,
        storage_path: signedAnonymousUpdatePath,
        local_only: false,
        face_region_redacted: true,
      });
      await expectVisible(
        signedAnonymous.client,
        'photos',
        'id',
        signedAnonymousPhoto.id,
        'photo metadata signed-anonymous owner read',
      );
      await expectPostgresCode(
        'photo metadata signed-anonymous cloud update',
        '42501',
        signedAnonymous.client
          .from('photos')
          .update({ face_region_redacted: false })
          .eq('id', signedAnonymousPhoto.id)
          .select('id'),
      );
      const unchangedSignedAnonymousPhoto = await admin
        .from('photos')
        .select('face_region_redacted, storage_path, local_only')
        .eq('id', signedAnonymousPhoto.id)
        .single();
      if (unchangedSignedAnonymousPhoto.error) throw unchangedSignedAnonymousPhoto.error;
      assert(
        unchangedSignedAnonymousPhoto.data.face_region_redacted === true &&
          unchangedSignedAnonymousPhoto.data.storage_path === signedAnonymousUpdatePath &&
          unchangedSignedAnonymousPhoto.data.local_only === false,
        'signed-anonymous photo metadata changed after a blocked cloud update.',
      );

      const photo = await insertOne(userA.client, 'photos', {
        user_id: userA.id,
        storage_path: ownerPath,
        local_only: false,
        face_region_redacted: true,
        alignment_score: 0.91,
        lighting_score: 0.88,
        head_roll: 1,
        head_yaw: 2,
        head_pitch: -1,
        quality_source: 'post_capture_measurement',
      });
      registerPrivateTableProbe('photos', 'id', photo.id);
      await expectVisible(userA.client, 'photos', 'id', photo.id, 'photo metadata owner read');
      const ownerMetadataUpdate = await userA.client
        .from('photos')
        .update({ alignment_score: 0.92 })
        .eq('id', photo.id)
        .select('id, alignment_score, storage_path, local_only')
        .single();
      if (ownerMetadataUpdate.error) throw ownerMetadataUpdate.error;
      assert(
        Number(ownerMetadataUpdate.data.alignment_score) === 0.92 &&
          ownerMetadataUpdate.data.storage_path === ownerPath &&
          ownerMetadataUpdate.data.local_only === false,
        'consenting owner cloud photo metadata update returned unexpected state.',
      );
      await expectNotVisible(
        userB.client,
        'photos',
        'id',
        photo.id,
        'photo metadata cross-user read',
      );
      await expectNotVisible(
        unauthenticated,
        'photos',
        'id',
        photo.id,
        'photo metadata unauthenticated read',
      );
      await expectBlockedInsert(
        'photo metadata cross-user insert',
        userB.client.from('photos').insert({ user_id: userA.id, local_only: true }),
      );
      await expectPostgresCode(
        'photo quality metadata without provenance',
        '23514',
        userA.client.from('photos').insert({
          user_id: userA.id,
          local_only: true,
          alignment_score: 0.99,
        }),
      );
      await expectPostgresCode(
        'photo quality metadata with invalid provenance',
        '23514',
        userA.client.from('photos').insert({
          user_id: userA.id,
          local_only: true,
          alignment_score: 0.99,
          quality_source: 'camera_preview_estimate',
        }),
      );
      await expectBlockedInsert(
        'photo metadata cross-user storage path insert',
        userA.client.from('photos').insert({
          user_id: userA.id,
          storage_path: foreignMetadataPath,
          local_only: false,
          face_region_redacted: true,
        }),
      );
      await expectBlockedInsert(
        'photo metadata local-only storage path insert',
        userA.client.from('photos').insert({
          user_id: userA.id,
          storage_path: `${userA.id}/e1/phase9-local-only-${randomUUID()}.bin`,
          local_only: true,
          face_region_redacted: true,
        }),
      );
      await expectPostgresCode(
        'photo metadata cross-user storage path update',
        '42501',
        userA.client
          .from('photos')
          .update({ storage_path: foreignMetadataPath })
          .eq('id', photo.id)
          .select('id'),
      );

      await expectBlockedInsert(
        'photo metadata signed-anonymous cloud insert',
        signedAnonymous.client.from('photos').insert({
          user_id: signedAnonymous.id,
          storage_path: signedAnonymousCloudPath,
          local_only: false,
          face_region_redacted: true,
        }),
      );
      const signedAnonymousUpload = await signedAnonymous.client.storage
        .from('photos')
        .upload(signedAnonymousCloudPath, new Blob(['signed anonymous cloud object']), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      expectStorageDenied('storage signed-anonymous cloud upload', signedAnonymousUpload);

      const ownerDownload = await userA.client.storage.from('photos').download(ownerPath);
      if (ownerDownload.error) throw ownerDownload.error;
      assert(
        Boolean(ownerDownload.data) && (await ownerDownload.data.text()) === ownerUpdatedObjectBody,
        'storage owner download returned an unexpected object body.',
      );

      const crossDownload = await userB.client.storage.from('photos').download(ownerPath);
      expectStorageDenied('storage cross-user download', crossDownload, { allowNotFound: true });

      const unauthenticatedDownload = await unauthenticated.storage
        .from('photos')
        .download(ownerPath);
      expectStorageDenied('storage unauthenticated download', unauthenticatedDownload, {
        allowNotFound: true,
      });

      const crossUpload = await userB.client.storage
        .from('photos')
        .upload(crossPath, new Blob(['bad cross-user object']), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      expectStorageDenied('storage cross-user upload into owner prefix', crossUpload);

      const crossUpdate = await userB.client.storage
        .from('photos')
        .update(ownerPath, new Blob(['bad cross-user update']), {
          contentType: 'application/octet-stream',
        });
      expectStorageDenied('storage cross-user object update', crossUpdate);
      await expectStorageBody(
        userA.client,
        ownerPath,
        ownerUpdatedObjectBody,
        'storage object after cross-user update',
      );

      const crossDelete = await userB.client.storage.from('photos').remove([ownerPath]);
      expectStorageDenied('storage cross-user delete', crossDelete, { allowEmpty: true });
      await expectStorageBody(
        userA.client,
        ownerPath,
        ownerUpdatedObjectBody,
        'storage object after cross-user delete',
      );

      await revokeConsent(userA.client, userA.id, 'photo_cloud_backup');
      await expectBlockedInsert(
        'photo metadata revoked cloud consent insert',
        userA.client.from('photos').insert({
          user_id: userA.id,
          storage_path: revokedPath,
          local_only: false,
          face_region_redacted: true,
        }),
      );
      await expectPostgresCode(
        'photo metadata revoked cloud consent update',
        '42501',
        userA.client
          .from('photos')
          .update({ face_region_redacted: false })
          .eq('id', photo.id)
          .select('id'),
      );
      const unchangedPhoto = await admin
        .from('photos')
        .select('face_region_redacted, storage_path, local_only')
        .eq('id', photo.id)
        .single();
      if (unchangedPhoto.error) throw unchangedPhoto.error;
      assert(
        unchangedPhoto.data.face_region_redacted === true &&
          unchangedPhoto.data.storage_path === ownerPath &&
          unchangedPhoto.data.local_only === false,
        'photo metadata changed after cloud consent revocation.',
      );

      const revokedUpdate = await userA.client.storage
        .from('photos')
        .update(ownerPath, new Blob(['bad revoked update']), {
          contentType: 'application/octet-stream',
        });
      expectStorageDenied(
        'storage object update after photo_cloud_backup revocation',
        revokedUpdate,
      );
      await expectStorageBody(
        userA.client,
        ownerPath,
        ownerUpdatedObjectBody,
        'storage object after consent-revoked update',
      );

      const revokedUpload = await userA.client.storage
        .from('photos')
        .upload(revokedPath, new Blob(['bad revoked object']), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      expectStorageDenied('storage upload after photo_cloud_backup revocation', revokedUpload);
    });

    await runCheck('sealed and directly queryable private table controls', async () => {
      const absentUuid = '00000000-0000-0000-0000-000000000000';
      const absentDigest = '0'.repeat(64);
      registerSealedPrivateTableProbe('catalog_sources', 'id', absentUuid);
      registerSealedPrivateTableProbe('shelf_product_identities', 'id', absentUuid);
      registerSealedPrivateTableProbe('obf_contribution_queue', 'id', absentUuid);
      registerSealedPrivateTableProbe('health_processing_states', 'user_id', absentUuid);
      registerSealedPrivateTableProbe('catalog_import_batches', 'id', absentUuid);
      registerSealedPrivateTableProbe('catalog_quality_reports', 'id', absentUuid);
      registerSealedPrivateTableProbe('health_consent_withdrawal_operations', 'id', absentUuid);
      registerSealedPrivateTableProbe(
        'health_consent_withdrawal_steps',
        'operation_id',
        absentUuid,
      );
      registerSealedPrivateTableProbe(
        'health_consent_copy_registry',
        'consent_text_hash',
        absentDigest,
      );
      registerSealedPrivateTableProbe('health_consent_copy_review_events', 'id', absentUuid);
      registerSealedPrivateTableProbe('health_consent_copy_staging_events', 'id', absentUuid);
      registerSealedPrivateTableProbe('health_dependent_consent_operations', 'id', absentUuid);
      registerSealedPrivateTableProbe('health_dependent_consent_states', 'user_id', absentUuid);
      registerSealedPrivateTableProbe(
        'account_publication_leases',
        'capability_digest',
        absentDigest,
      );
      registerSealedPrivateTableProbe('account_deletion_operations', 'id', absentUuid);
      registerSealedPrivateTableProbe('account_deletion_barriers', 'user_id', absentUuid);
      registerSealedPrivateTableProbe('account_deletion_steps', 'operation_id', absentUuid);
      registerSealedPrivateTableProbe(
        'account_deletion_receipts',
        'capability_digest',
        absentDigest,
      );
      registerSealedPrivateTableProbe(
        'account_deletion_operator_recovery_audit',
        'command_digest',
        absentDigest,
      );
      registerSealedPrivateTableProbe(
        'revenuecat_identity_tombstones',
        'identity_hmac',
        absentDigest,
      );
      registerSealedPrivateTableProbe('apple_auth_lifecycles', 'user_id', absentUuid);
      registerSealedPrivateTableProbe('apple_auth_capture_operations', 'id', absentUuid);
      registerSealedPrivateTableProbe('apple_auth_server_events', 'jti_hmac', absentDigest);
      registerSealedPrivateTableProbe('conflict_rules', 'id', absentUuid);
      registerSealedPrivateTableProbe('sequencing_rules', 'id', absentUuid);
      registerSealedPrivateTableProbe('creator_stacks', 'id', absentUuid);
      registerSealedPrivateTableProbe('creator_stack_items', 'id', absentUuid);
      registerSealedPrivateTableProbe('ingredient_tags', 'ingredient_id', absentUuid);
      registerSealedPrivateTableProbe('ingredient_pao_defaults', 'category', '__phase9_absent__');
      registerSealedPrivateTableProbe('product_categories', 'id', '__phase9_absent__');
      registerSealedPrivateTableProbe('ingredient_tag_definitions', 'tag', '__phase9_absent__');

      const subscriptionEvent = await insertOne(admin, 'subscriptions_events', {
        rc_event_id: `phase9-${randomUUID()}`,
        user_id: userA.id,
        event_type: 'PHASE9_LIVE_ADVERSARIAL',
        payload: { phase9: true },
        processed_at: new Date().toISOString(),
        processing_status: 'ignored_event_type',
        projection_applied: false,
        processing_attempts: 1,
      });
      trackServiceCleanup('subscriptions_events', 'id', subscriptionEvent.id);
      registerPrivateTableProbe('subscriptions_events', 'id', subscriptionEvent.id);

      registerClosedPrivateTableProbe('order_attributions', 'id', absentUuid);

      const waitlistSignup = await insertOne(admin, 'waitlist_signups', {
        email: `phase9-${randomUUID()}@example.invalid`,
        source: 'phase9-live-adversarial',
        attribution: { phase9: true },
      });
      trackServiceCleanup('waitlist_signups', 'id', waitlistSignup.id);
      registerPrivateTableProbe('waitlist_signups', 'id', waitlistSignup.id);

      const growthEvent = await insertOne(admin, 'growth_events', {
        event: 'landing_viewed',
        source: 'phase9-live-adversarial',
        share_id: randomUUID(),
      });
      trackServiceCleanup('growth_events', 'id', growthEvent.id);
      registerPrivateTableProbe('growth_events', 'id', growthEvent.id);

      const rateLimitKeyHash = randomUUID().replaceAll('-', '').repeat(2);
      const rateLimit = await insertOne(admin, 'edge_rate_limits', {
        scope: 'phase9_live_adversarial',
        key_hash: rateLimitKeyHash,
        window_start: new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString(),
        window_seconds: 60,
        request_count: 1,
      });
      trackServiceCleanup('edge_rate_limits', 'key_hash', rateLimit.key_hash);
      registerPrivateTableProbe('edge_rate_limits', 'key_hash', rateLimit.key_hash);
    });

    await runCheck('all 68 private tables have access-control probes', async () => {
      const registeredTables = [...privateTableProbes.keys()].sort();
      const expectedTables = [...PRIVATE_PUBLIC_TABLES].sort();
      assert(
        JSON.stringify(registeredTables) === JSON.stringify(expectedTables),
        `Private-table probe registry mismatch: expected ${expectedTables.length}, received ${registeredTables.length}.`,
      );

      for (const table of PRIVATE_PUBLIC_TABLES) {
        const probe = privateTableProbes.get(table);
        assert(Boolean(probe), `Missing private-table positive control: ${table}.`);
        if (probe.closed === true) {
          for (const [client, label] of [
            [admin, 'service-role admin'],
            [userA.client, 'owner client'],
            [userB.client, 'cross-user client'],
            [signedAnonymous.client, 'signed-anonymous client'],
            [unauthenticated, 'unauthenticated client'],
          ]) {
            await expectNotVisible(
              client,
              table,
              probe.column,
              probe.value,
              `${table} ${label} closed-table read`,
            );
          }
          continue;
        }
        if (probe.sealed === true) {
          for (const [client, label] of [
            [admin, 'service-role admin'],
            [userA.client, 'owner client'],
            [userB.client, 'cross-user client'],
            [signedAnonymous.client, 'signed-anonymous client'],
            [unauthenticated, 'unauthenticated client'],
          ]) {
            await expectNotVisible(
              client,
              table,
              probe.column,
              probe.value,
              `${table} ${label} direct table read`,
            );
          }
          continue;
        }
        const crossClient = probe.crossClient === 'userA' ? userA.client : userB.client;
        await expectVisible(
          admin,
          table,
          probe.column,
          probe.value,
          `${table} admin positive control`,
        );
        await expectNotVisible(
          crossClient,
          table,
          probe.column,
          probe.value,
          `${table} authenticated cross-user read`,
        );
        await expectNotVisible(
          signedAnonymous.client,
          table,
          probe.column,
          probe.value,
          `${table} signed-anonymous cross-user read`,
        );
        await expectNotVisible(
          unauthenticated,
          table,
          probe.column,
          probe.value,
          `${table} unauthenticated read`,
        );
        if (SERVICE_ONLY_PRIVATE_TABLES.includes(table)) {
          await expectNotVisible(
            userA.client,
            table,
            probe.column,
            probe.value,
            `${table} owner client service-only read`,
          );
        }
      }
    });
  } finally {
    for (const row of [...serviceCleanup].reverse()) {
      const { error } = await admin.from(row.table).delete().eq(row.column, row.value);
      if (error) {
        errors.push(`${row.table} cleanup failed: ${redactedErrorKind(error)}`);
        continue;
      }
      const remaining = await admin.from(row.table).select(row.column).eq(row.column, row.value);
      if (remaining.error) {
        errors.push(
          `${row.table} cleanup verification failed: ${redactedErrorKind(remaining.error)}`,
        );
      } else if (!Array.isArray(remaining.data) || remaining.data.length !== 0) {
        errors.push(`${row.table} cleanup left a residual row.`);
      }
    }
    if (storagePaths.length > 0) {
      const { error } = await admin.storage.from('photos').remove(storagePaths);
      if (error) {
        errors.push(`Storage cleanup failed: ${redactedErrorKind(error)}`);
      } else {
        for (const path of storagePaths) {
          const remaining = await admin.storage.from('photos').download(path);
          if (!remaining.error) {
            errors.push('Storage cleanup left a residual object.');
          } else if (!storageObjectMissing(remaining.error)) {
            errors.push(
              `Storage cleanup verification failed: ${redactedErrorKind(remaining.error)}`,
            );
          }
        }
      }
    }
    for (const user of users) {
      const deleted = await admin.auth.admin.deleteUser(user.id);
      if (deleted.error) {
        errors.push(`User cleanup failed: ${redactedErrorKind(deleted.error)}`);
        continue;
      }
      const remaining = await admin.auth.admin.getUserById(user.id);
      if (!authUserMissing(remaining)) {
        errors.push(
          remaining.error
            ? `User cleanup verification failed: ${redactedErrorKind(remaining.error)}`
            : 'User cleanup left a residual Auth user.',
        );
      }
    }
    for (const [table, probe] of privateTableProbes) {
      // Direct table privileges are intentionally absent for sealed tables,
      // including service_role. Their residue is attested through the narrow
      // lifecycle RPC/rehearsal lanes, not through an impossible admin read.
      if (probe.sealed === true || probe.closed === true) continue;
      const remaining = await admin.from(table).select(probe.column).eq(probe.column, probe.value);
      if (remaining.error) {
        errors.push(
          `${table} owner-cascade verification failed: ${redactedErrorKind(remaining.error)}`,
        );
      } else if (!Array.isArray(remaining.data) || remaining.data.length !== 0) {
        errors.push(`${table} owner-cascade cleanup left a residual row.`);
      }
    }
    await deleteByIds(admin, 'community_notes', globalCleanup.communityNoteIds).catch((error) =>
      errors.push(`Community note cleanup failed: ${redactedErrorKind(error)}`),
    );
    await deleteByIds(admin, 'community_topics', globalCleanup.communityTopicIds).catch((error) =>
      errors.push(`Community topic cleanup failed: ${redactedErrorKind(error)}`),
    );
  }

  writeArtifacts(errors.length > 0 || warnings.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live Supabase adversarial', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live Supabase adversarial', errors, warnings);
});
