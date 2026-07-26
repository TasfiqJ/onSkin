#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  HarnessAssertionError,
  deniedInsertResult,
  deniedReadOrMutationResult,
  harnessErrorDetail,
  placeholderEnvValue,
  redactedErrorKind,
} from '../phase9/lib.mjs';

const root = process.cwd();

function parseDotEnv(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

for (const candidate of [resolve(root, '.env'), resolve(root, 'apps/mobile/.env')]) {
  if (existsSync(candidate)) parseDotEnv(readFileSync(candidate, 'utf8'));
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const appEnv = readScriptAppEnvironment();

function readScriptAppEnvironment() {
  const raw = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? process.env.APP_VARIANT;
  const candidate = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['development', 'staging', 'production'].includes(candidate)) return candidate;
  return 'production';
}

function assert(condition, message) {
  if (!condition) throw new HarnessAssertionError(message);
}

function assertEnv(name, value) {
  assert(!placeholderEnvValue(value), `${name} is missing or still a placeholder`);
}

assertEnv('EXPO_PUBLIC_SUPABASE_URL', supabaseUrl);
assertEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishableKey);
assertEnv('SUPABASE_SECRET_KEY', secretKey);

if (appEnv === 'production' && process.env.PHASE2_ALLOW_PRODUCTION_SMOKE !== '1') {
  throw new Error(
    'Refusing to run RLS smoke tests against production without PHASE2_ALLOW_PRODUCTION_SMOKE=1.',
  );
}

const admin = createClient(supabaseUrl, secretKey, {
  global: { headers: { 'x-health-processing-epoch': '1' } },
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function publicClient() {
  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { 'x-health-processing-epoch': '1' } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function createSmokeUser(label, cleanupUsers) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `phase2-${label}-${suffix}@example.invalid`;
  const password = `Phase2-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase2_rls_smoke: true },
  });
  if (error) throw error;
  assert(Boolean(data.user), `Supabase did not return a user for ${label}`);
  const createdUser = data.user;
  cleanupUsers.push({ id: createdUser.id });

  const client = publicClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  assert(
    signIn.data.user?.id === createdUser.id,
    `Signed-in identity did not match the created ${label} smoke user.`,
  );
  return { id: createdUser.id, client };
}

async function cleanup(users) {
  const failures = [];
  for (const user of users) {
    if (!user?.id) continue;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) failures.push(`user:${redactedErrorKind(error)}`);
  }
  assert(failures.length === 0, `Smoke cleanup failed (${failures.join(', ')}).`);
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

async function expectOwnRead(client, table, column, value, label) {
  const { data, error } = await client.from(table).select(column).eq(column, value);
  if (error) throw error;
  assert(data.length >= 1, `${label}: expected at least one visible row`);
}

async function expectNoPrivateRead(client, table, column, value, label) {
  const result = await client.from(table).select(column).eq(column, value);
  assert(
    deniedReadOrMutationResult(result),
    result.error
      ? `${label}: expected PostgreSQL 42501 or an exact empty row set; received ${redactedErrorKind(result.error)}`
      : `${label}: private rows were visible or result was not an exact empty row set`,
  );
}

async function expectBlocked(label, promise) {
  const result = await promise;
  assert(
    deniedInsertResult(result),
    result.error
      ? `${label}: expected PostgreSQL 42501; received ${redactedErrorKind(result.error)}`
      : `${label}: insert unexpectedly succeeded`,
  );
}

async function expectNoAffectedRows(label, promise) {
  const result = await promise;
  assert(
    deniedReadOrMutationResult(result),
    result.error
      ? `${label}: expected PostgreSQL 42501 or zero affected rows; received ${redactedErrorKind(result.error)}`
      : `${label}: cross-user write affected rows or result was not an exact empty row set`,
  );
}

const users = [];

async function main() {
  try {
    const userA = await createSmokeUser('a', users);
    const userB = await createSmokeUser('b', users);
    for (const [label, user] of [
      ['a', userA],
      ['b', userB],
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

    const { data: profile, error: profileError } = await userA.client
      .from('profiles')
      .update({
        display_name: 'Phase 2 Smoke A',
        units: 'metric',
      })
      .eq('id', userA.id)
      .select()
      .single();
    if (profileError) throw profileError;
    await expectOwnRead(userA.client, 'profiles', 'id', profile.id, 'profile own read');
    await expectNoPrivateRead(
      userB.client,
      'profiles',
      'id',
      profile.id,
      'profile cross-user read',
    );
    await expectNoAffectedRows(
      'profile cross-user update',
      userB.client
        .from('profiles')
        .update({ display_name: 'bad update' })
        .eq('id', profile.id)
        .select('id'),
    );

    const skinProfile = await insertOne(userA.client, 'skin_profiles', {
      user_id: userA.id,
      oily_dry: 1,
      sensitive_resistant: 2,
      fitzpatrick: 3,
      goals: ['acne'],
      completed_at: new Date().toISOString(),
    });
    await expectOwnRead(
      userA.client,
      'skin_profiles',
      'id',
      skinProfile.id,
      'skin profile own read',
    );
    await expectNoPrivateRead(
      userB.client,
      'skin_profiles',
      'id',
      skinProfile.id,
      'skin profile cross-user read',
    );
    await expectBlocked(
      'skin profile cross-user insert',
      userB.client.from('skin_profiles').insert({ user_id: userA.id, goals: ['bad'] }),
    );

    const product = await insertOne(userA.client, 'user_products', {
      user_id: userA.id,
      manual_name: 'Phase 2 Cleanser',
      manual_brand: 'Smoke Test',
      is_opened: false,
      opened_at: null,
      pao_months: null,
      pao_source: 'unknown',
      expiry_source: 'unknown',
    });
    await expectOwnRead(userA.client, 'user_products', 'id', product.id, 'shelf own read');
    await expectNoPrivateRead(
      userB.client,
      'user_products',
      'id',
      product.id,
      'shelf cross-user read',
    );
    await expectBlocked(
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

    await expectBlocked(
      'catalog direct service insert',
      admin.from('products').insert({
        name: `Phase 4 Catalog Product ${randomUUID().slice(0, 8)}`,
        brand: 'Smoke Test',
        category: 'cleanser',
        source: 'curated',
        quality_grade: 'limited',
        review_status: 'unreviewed',
      }),
    );

    const missingBarcode = '10012345000017';

    const correctionWrite = await admin.rpc('submit_catalog_correction', {
      p_user_id: userA.id,
      p_expected_health_epoch: 1,
      p_report_request_id: randomUUID(),
      p_product_id: null,
      p_barcode: missingBarcode,
      p_correction_type: 'missing_product',
      p_description: 'phase4 smoke missing-product report',
      p_proposed_payload: {},
      p_client_context: { route: 'phase2-rls-smoke' },
    });
    if (correctionWrite.error) throw correctionWrite.error;
    assert(
      Array.isArray(correctionWrite.data) && correctionWrite.data.length === 1,
      'catalog correction service RPC did not return exactly one row',
    );
    const correction = correctionWrite.data[0];
    await expectOwnRead(
      admin,
      'catalog_corrections',
      'id',
      correction.id,
      'catalog correction service export read',
    );
    await expectNoPrivateRead(
      userA.client,
      'catalog_corrections',
      'id',
      correction.id,
      'catalog correction owner direct read',
    );
    await expectNoPrivateRead(
      userB.client,
      'catalog_corrections',
      'id',
      correction.id,
      'catalog correction cross-user read',
    );
    await expectBlocked(
      'catalog correction owner direct insert',
      userA.client.from('catalog_corrections').insert({
        user_id: userA.id,
        product_id: null,
        barcode: missingBarcode,
        correction_type: 'missing_product',
      }),
    );
    await expectBlocked(
      'catalog correction cross-user insert',
      userB.client.from('catalog_corrections').insert({
        user_id: userA.id,
        product_id: null,
        barcode: missingBarcode,
        correction_type: 'missing_product',
      }),
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
    const lookupEventId = lookupWrite.data;
    assert(typeof lookupEventId === 'string', 'catalog lookup RPC did not return an event id');
    await expectOwnRead(
      userA.client,
      'catalog_lookup_events',
      'id',
      lookupEventId,
      'catalog lookup own read',
    );
    await expectNoPrivateRead(
      userB.client,
      'catalog_lookup_events',
      'id',
      lookupEventId,
      'catalog lookup cross-user read',
    );
    await expectBlocked(
      'catalog lookup owner direct insert',
      userA.client.from('catalog_lookup_events').insert({
        user_id: userA.id,
        lookup_type: 'search',
        result: 'no_match',
      }),
    );
    await expectBlocked(
      'catalog lookup cross-user insert',
      userB.client.from('catalog_lookup_events').insert({
        user_id: userA.id,
        lookup_type: 'search',
        result: 'no_match',
      }),
    );

    const routine = await insertOne(userA.client, 'routines', {
      user_id: userA.id,
      type: 'AM',
      name: 'Phase 2 AM',
    });
    const step = await insertOne(userA.client, 'routine_steps', {
      routine_id: routine.id,
      user_product_id: product.id,
      step_order: 1,
      frequency: 'daily',
      instructions: 'Smoke test step',
    });
    await expectOwnRead(userA.client, 'routines', 'id', routine.id, 'routine own read');
    await expectNoPrivateRead(
      userB.client,
      'routines',
      'id',
      routine.id,
      'routine cross-user read',
    );
    await expectOwnRead(userA.client, 'routine_steps', 'id', step.id, 'routine step own read');
    await expectNoPrivateRead(
      userB.client,
      'routine_steps',
      'id',
      step.id,
      'routine step cross-user read',
    );
    await expectBlocked(
      'routine step cross-user insert',
      userB.client.from('routine_steps').insert({ routine_id: routine.id, step_order: 2 }),
    );

    const { data: consent, error: consentReadError } = await userA.client
      .from('consents')
      .select('id')
      .eq('consent_type', 'health_data_collection')
      .order('granted_at', { ascending: false })
      .limit(1)
      .single();
    if (consentReadError) throw consentReadError;
    await expectOwnRead(userA.client, 'consents', 'id', consent.id, 'consent own read');
    await expectNoPrivateRead(
      userB.client,
      'consents',
      'id',
      consent.id,
      'consent cross-user read',
    );
    await expectBlocked(
      'health consent owner direct insert',
      userA.client.from('consents').insert({
        user_id: userA.id,
        consent_type: 'health_data_collection',
        granted: false,
        version: 'bad-direct-revocation',
        consent_text_hash: 'c'.repeat(64),
      }),
    );
    await expectBlocked(
      'consent cross-user insert',
      userB.client.from('consents').insert({
        user_id: userA.id,
        consent_type: 'health_data_collection',
        granted: true,
        version: 'bad',
        consent_text_hash: 'bad',
      }),
    );

    const entitlementExpiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const snapshotAt = new Date();
    const { error: entitlementWriteError } = await admin.rpc(
      'reconcile_revenuecat_entitlement_snapshot',
      {
        p_user_id: userA.id,
        p_snapshot_at: snapshotAt.toISOString(),
        p_entitlement: 'pro',
        p_is_active: true,
        p_product_id: 'phase2_smoke',
        p_expires_at: entitlementExpiresAt,
        p_store: 'app_store',
        p_period_type: 'normal',
        p_will_renew: true,
        p_original_purchase_at: snapshotAt.toISOString(),
        p_offering_id: null,
        p_environment: appEnv === 'production' ? 'production' : 'sandbox',
        p_management_url: null,
        p_package_id: null,
      },
    );
    if (entitlementWriteError) throw entitlementWriteError;
    await expectOwnRead(userA.client, 'entitlements', 'user_id', userA.id, 'entitlement own read');
    await expectNoPrivateRead(
      userB.client,
      'entitlements',
      'user_id',
      userA.id,
      'entitlement cross-user read',
    );
    await expectNoAffectedRows(
      'entitlement client update',
      userA.client
        .from('entitlements')
        .update({ is_active: false })
        .eq('user_id', userA.id)
        .select('user_id'),
    );

    const unauthenticated = publicClient();
    await expectNoPrivateRead(
      unauthenticated,
      'profiles',
      'id',
      userA.id,
      'unauthenticated profile read',
    );
    await expectNoPrivateRead(
      unauthenticated,
      'skin_profiles',
      'user_id',
      userA.id,
      'unauthenticated skin profile read',
    );
    await expectNoPrivateRead(
      unauthenticated,
      'entitlements',
      'user_id',
      userA.id,
      'unauthenticated entitlement read',
    );

    console.log('OK Supabase RLS smoke tests passed.');
  } finally {
    await cleanup(users);
  }
}

main().catch((error) => {
  console.error(`FAIL Supabase RLS smoke tests: ${harnessErrorDetail(error)}`);
  process.exitCode = 1;
});
