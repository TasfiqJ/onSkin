#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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
  if (!condition) throw new Error(message);
}

function redactedErrorKind(error) {
  if (error instanceof Error) return error.name || 'Error';
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String(error.code ?? '') : '';
    if (/^[A-Za-z0-9_-]{1,40}$/.test(code)) return `code:${code}`;
    return 'object';
  }
  return typeof error;
}

function assertEnv(name, value) {
  assert(value && !value.includes('YOUR-') && !value.includes('xxxxxxxx'), `${name} is missing or still a placeholder`);
}

assertEnv('EXPO_PUBLIC_SUPABASE_URL', supabaseUrl);
assertEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishableKey);
assertEnv('SUPABASE_SECRET_KEY', secretKey);

if (appEnv === 'production' && process.env.PHASE2_ALLOW_PRODUCTION_SMOKE !== '1') {
  throw new Error('Refusing to run RLS smoke tests against production without PHASE2_ALLOW_PRODUCTION_SMOKE=1.');
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function publicClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function createSmokeUser(label) {
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
  if (!data.user) throw new Error(`Supabase did not return a user for ${label}`);

  const client = publicClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}

async function cleanup(users, catalogProductIds = []) {
  for (const productId of catalogProductIds) {
    const { error } = await admin.from('products').delete().eq('id', productId);
    if (error) console.warn(`WARN catalog product cleanup failed: ${redactedErrorKind(error)}`);
  }
  for (const user of users) {
    if (!user?.id) continue;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) console.warn(`WARN smoke user cleanup failed: ${redactedErrorKind(error)}`);
  }
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
  const { data, error } = await client.from(table).select('*').eq(column, value);
  if (error) throw error;
  assert(data.length >= 1, `${label}: expected at least one visible row`);
}

async function expectNoPrivateRead(client, table, column, value, label) {
  const { data, error } = await client.from(table).select('*').eq(column, value);
  if (error) return;
  assert(data.length === 0, `${label}: private rows were visible`);
}

async function expectBlocked(label, promise) {
  const { error } = await promise;
  assert(error, `${label}: expected RLS or permission error`);
}

async function expectNoAffectedRows(label, promise) {
  const { data, error } = await promise;
  if (error) return;
  assert(Array.isArray(data) && data.length === 0, `${label}: cross-user write affected rows`);
}

const users = [];
const catalogProductIds = [];

try {
  const userA = await createSmokeUser('a');
  const userB = await createSmokeUser('b');
  users.push(userA, userB);

  const profile = await upsertOne(userA.client, 'profiles', {
    id: userA.id,
    display_name: 'Phase 2 Smoke A',
    units: 'metric',
  });
  await expectOwnRead(userA.client, 'profiles', 'id', profile.id, 'profile own read');
  await expectNoPrivateRead(userB.client, 'profiles', 'id', profile.id, 'profile cross-user read');
  await expectNoAffectedRows(
    'profile cross-user update',
    userB.client.from('profiles').update({ display_name: 'bad update' }).eq('id', profile.id).select('id'),
  );

  const skinProfile = await insertOne(userA.client, 'skin_profiles', {
    user_id: userA.id,
    oily_dry: 1,
    sensitive_resistant: 2,
    fitzpatrick: 3,
    goals: ['acne'],
    completed_at: new Date().toISOString(),
  });
  await expectOwnRead(userA.client, 'skin_profiles', 'id', skinProfile.id, 'skin profile own read');
  await expectNoPrivateRead(userB.client, 'skin_profiles', 'id', skinProfile.id, 'skin profile cross-user read');
  await expectBlocked(
    'skin profile cross-user insert',
    userB.client.from('skin_profiles').insert({ user_id: userA.id, goals: ['bad'] }),
  );

  const product = await insertOne(userA.client, 'user_products', {
    user_id: userA.id,
    manual_name: 'Phase 2 Cleanser',
    manual_brand: 'Smoke Test',
    opened_at: '2026-07-04',
    pao_months: 12,
  });
  await expectOwnRead(userA.client, 'user_products', 'id', product.id, 'shelf own read');
  await expectNoPrivateRead(userB.client, 'user_products', 'id', product.id, 'shelf cross-user read');
  await expectBlocked(
    'shelf cross-user insert',
    userB.client.from('user_products').insert({ user_id: userA.id, manual_name: 'bad product' }),
  );

  const catalogProduct = await insertOne(
    admin,
    'products',
    {
      name: `Phase 4 Catalog Product ${randomUUID().slice(0, 8)}`,
      brand: 'Smoke Test',
      category: 'cleanser',
      source: 'curated',
      quality_grade: 'limited',
      review_status: 'unreviewed',
    },
    'id, name',
  );
  catalogProductIds.push(catalogProduct.id);
  await expectOwnRead(userA.client, 'products', 'id', catalogProduct.id, 'catalog product auth read');

  const correction = await insertOne(userA.client, 'catalog_corrections', {
    user_id: userA.id,
    product_id: catalogProduct.id,
    correction_type: 'wrong_match',
    description: 'phase4 smoke correction',
  });
  await expectOwnRead(userA.client, 'catalog_corrections', 'id', correction.id, 'catalog correction own read');
  await expectNoPrivateRead(userB.client, 'catalog_corrections', 'id', correction.id, 'catalog correction cross-user read');
  await expectBlocked(
    'catalog correction cross-user insert',
    userB.client.from('catalog_corrections').insert({
      user_id: userA.id,
      product_id: catalogProduct.id,
      correction_type: 'wrong_match',
    }),
  );

  const lookupEvent = await insertOne(userA.client, 'catalog_lookup_events', {
    user_id: userA.id,
    lookup_type: 'search',
    query: 'phase4 smoke',
    result: 'matched',
    matched_product_id: catalogProduct.id,
    quality_grade: 'limited',
  });
  await expectOwnRead(userA.client, 'catalog_lookup_events', 'id', lookupEvent.id, 'catalog lookup own read');
  await expectNoPrivateRead(userB.client, 'catalog_lookup_events', 'id', lookupEvent.id, 'catalog lookup cross-user read');
  await expectBlocked(
    'catalog lookup cross-user insert',
    userB.client.from('catalog_lookup_events').insert({
      user_id: userA.id,
      lookup_type: 'search',
      query: 'bad',
      result: 'matched',
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
  await expectNoPrivateRead(userB.client, 'routines', 'id', routine.id, 'routine cross-user read');
  await expectOwnRead(userA.client, 'routine_steps', 'id', step.id, 'routine step own read');
  await expectNoPrivateRead(userB.client, 'routine_steps', 'id', step.id, 'routine step cross-user read');
  await expectBlocked(
    'routine step cross-user insert',
    userB.client.from('routine_steps').insert({ routine_id: routine.id, step_order: 2 }),
  );

  const consent = await insertOne(userA.client, 'consents', {
    user_id: userA.id,
    consent_type: 'health_data_collection',
    granted: true,
    version: 'phase2-smoke',
    consent_text_hash: 'phase2-smoke',
  });
  await expectOwnRead(userA.client, 'consents', 'id', consent.id, 'consent own read');
  await expectNoPrivateRead(userB.client, 'consents', 'id', consent.id, 'consent cross-user read');
  await expectBlocked(
    'consent cross-user insert',
    userB.client.from('consents').insert({
      user_id: userA.id,
      consent_type: 'health_data_collection',
      granted: true,
      version: 'bad',
    }),
  );

  const entitlementExpiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const entitlementWrite = await admin.from('entitlements').upsert({
    user_id: userA.id,
    entitlement: 'pro',
    is_active: true,
    product_id: 'phase2_smoke',
    expires_at: entitlementExpiresAt,
    store: 'app_granted',
    period_type: 'reverse_trial',
    will_renew: false,
    original_purchase_at: new Date().toISOString(),
  });
  if (entitlementWrite.error) throw entitlementWrite.error;
  await expectOwnRead(userA.client, 'entitlements', 'user_id', userA.id, 'entitlement own read');
  await expectNoPrivateRead(userB.client, 'entitlements', 'user_id', userA.id, 'entitlement cross-user read');
  await expectNoAffectedRows(
    'entitlement client update',
    userA.client.from('entitlements').update({ is_active: false }).eq('user_id', userA.id).select('user_id'),
  );

  const anon = publicClient();
  await expectNoPrivateRead(anon, 'profiles', 'id', userA.id, 'anonymous profile read');
  await expectNoPrivateRead(anon, 'skin_profiles', 'user_id', userA.id, 'anonymous skin profile read');
  await expectNoPrivateRead(anon, 'entitlements', 'user_id', userA.id, 'anonymous entitlement read');

  console.log('OK Supabase RLS smoke tests passed.');
} finally {
  await cleanup(users, catalogProductIds);
}
