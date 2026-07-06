#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
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
const env = envSnapshot();

const runLive = env.PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

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

function placeholder(value) {
  return (
    !value || /YOUR-|xxxxxxxx|example\.com|\.\.\.|__BLOCKED_PLACEHOLDER__/i.test(String(value))
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resultError(error) {
  return error instanceof Error ? error.message : String(error);
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
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function isoDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function createLiveUser(admin, label) {
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
  if (!data.user) throw new Error(`Supabase did not return a user for ${label}.`);

  const client = publicClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return { id: data.user.id, email, client };
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
  const { data, error } = await client.from(table).select('*').eq(column, value);
  if (error) throw error;
  assert(Array.isArray(data) && data.length > 0, `${label}: expected visible own row.`);
}

async function expectNotVisible(client, table, column, value, label) {
  const { data, error } = await client.from(table).select('*').eq(column, value);
  if (error && error.code === '42501') return;
  if (error) throw error;
  assert(Array.isArray(data) && data.length === 0, `${label}: private row was visible.`);
}

async function expectBlockedMutation(label, promise) {
  const { data, error } = await promise;
  if (error) return;
  assert(!Array.isArray(data) || data.length === 0, `${label}: cross-user mutation affected rows.`);
}

async function expectBlockedInsert(label, promise) {
  const { error } = await promise;
  assert(Boolean(error), `${label}: insert unexpectedly succeeded.`);
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
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const anonymous = publicClient();
  const users = [];
  const storagePaths = [];
  const globalCleanup = {
    communityNoteIds: [],
    communityTopicIds: [],
    conflictRuleIds: [],
  };

  try {
    const userA = await createLiveUser(admin, 'a');
    const userB = await createLiveUser(admin, 'b');
    users.push(userA, userB);

    await runCheck('profile owner isolation', async () => {
      const profile = await upsertOne(userA.client, 'profiles', {
        id: userA.id,
        display_name: 'Phase 9 User A',
        units: 'metric',
      });
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
      await expectNotVisible(anonymous, 'profiles', 'id', profile.id, 'profile anonymous read');
    });

    let product;
    let crossUserProduct;
    let routine;
    let step;
    await runCheck('skin profile, shelf, routine, and completion isolation', async () => {
      const skinProfile = await insertOne(userA.client, 'skin_profiles', {
        user_id: userA.id,
        oily_dry: 1,
        sensitive_resistant: 2,
        fitzpatrick: 3,
        goals: ['phase9-smoke'],
        completed_at: new Date().toISOString(),
      });
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
        opened_at: new Date().toISOString().slice(0, 10),
        pao_months: 12,
      });
      crossUserProduct = await insertOne(userB.client, 'user_products', {
        user_id: userB.id,
        manual_name: 'Phase 9 User B Serum',
        manual_brand: 'Security Smoke',
        opened_at: isoDate(),
        pao_months: 6,
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
        userB.client
          .from('user_products')
          .insert({ user_id: userA.id, manual_name: 'bad product' }),
      );

      routine = await insertOne(userA.client, 'routines', {
        user_id: userA.id,
        type: 'AM',
        name: 'Phase 9 AM',
      });
      step = await insertOne(userA.client, 'routine_steps', {
        routine_id: routine.id,
        user_product_id: product.id,
        step_order: 1,
        frequency: 'daily',
        instructions: 'Phase 9 smoke test step',
      });
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
      await expectBlockedMutation(
        'routine step cross-user product update',
        userA.client
          .from('routine_steps')
          .update({ user_product_id: crossUserProduct.id })
          .eq('id', step.id)
          .select('id'),
      );

      const completion = await insertOne(userA.client, 'routine_completions', {
        user_id: userA.id,
        routine_id: routine.id,
        step_id: step.id,
        completed_date: isoDate(),
      });
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
          completed_date: isoDate(),
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
      assert(product && crossUserProduct && routine, 'routine prerequisite rows were not created.');
      const ruleToken = randomUUID().replace(/-/g, '_');
      const conflictRule = await insertOne(
        admin,
        'conflict_rules',
        {
          tag_a: `phase9_a_${ruleToken}`,
          tag_b: `phase9_b_${ruleToken}`,
          interaction_type: 'irritation',
          base_severity: 'mild',
          evidence_grade: 'C',
          evidence_label: 'plausible',
          mechanism: 'Phase 9 synthetic RLS test rule.',
          resolution_type: 'no_change',
          resolution_copy: 'Phase 9 synthetic RLS test copy.',
          source_citation: 'phase9-live-adversarial',
          reviewed_by: 'phase9-live-adversarial',
          is_active: true,
        },
        'id',
      );
      globalCleanup.conflictRuleIds.push(conflictRule.id);

      const conflict = await insertOne(userA.client, 'routine_conflicts', {
        user_id: userA.id,
        rule_id: conflictRule.id,
        product_a_id: product.id,
        computed_severity: 'mild',
        status: 'suggested',
        rule_version: 1,
      });
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
          rule_id: conflictRule.id,
          computed_severity: 'mild',
        }),
      );
      await expectBlockedInsert(
        'routine conflict cross-user product insert',
        userA.client.from('routine_conflicts').insert({
          user_id: userA.id,
          rule_id: conflictRule.id,
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
          user_product_id: product.id,
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
      const cycleNight = await insertOne(userA.client, 'cycle_nights', {
        cycle_id: cycle.id,
        night_index: 0,
        slot: 'retinoid',
        user_product_id: product.id,
      });
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
      await expectBlockedMutation(
        'cycle night cross-user product update',
        userA.client
          .from('cycle_nights')
          .update({ user_product_id: crossUserProduct.id })
          .eq('cycle_id', cycleNight.cycle_id)
          .eq('night_index', cycleNight.night_index)
          .select('cycle_id'),
      );

      const shelfScan = await insertOne(userA.client, 'shelf_scans', {
        user_id: userA.id,
        barcode: `phase9-${randomUUID()}`,
        result: 'no_match',
      });
      await expectVisible(userA.client, 'shelf_scans', 'id', shelfScan.id, 'shelf scan owner read');
      await expectNotVisible(
        userB.client,
        'shelf_scans',
        'id',
        shelfScan.id,
        'shelf scan cross-user read',
      );
      await expectBlockedInsert(
        'shelf scan cross-user insert',
        userB.client.from('shelf_scans').insert({ user_id: userA.id, result: 'no_match' }),
      );
    });

    await runCheck('consent append-only and entitlement service-only isolation', async () => {
      const consent = await insertOne(userA.client, 'consents', {
        user_id: userA.id,
        consent_type: 'health_data_collection',
        granted: true,
        version: 'phase9-live-adversarial',
        consent_text_hash: 'phase9-live-adversarial',
      });
      await expectVisible(userA.client, 'consents', 'id', consent.id, 'consent owner read');
      await expectNotVisible(userB.client, 'consents', 'id', consent.id, 'consent cross-user read');
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

      const entitlementWrite = await admin.from('entitlements').upsert({
        user_id: userA.id,
        entitlement: 'pro',
        is_active: true,
        product_id: 'phase9_live_adversarial',
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        rc_event_id: `phase9-${randomUUID()}`,
      });
      if (entitlementWrite.error) throw entitlementWrite.error;
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

      const reverseTrialWrite = await admin.from('reverse_trial_grants').upsert({
        user_id: userA.id,
        expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        source: 'phase9-live-adversarial',
        metadata: { phase9: true },
      });
      if (reverseTrialWrite.error) throw reverseTrialWrite.error;
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
          user_id: userA.id,
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
        userB.client
          .from('notification_preferences')
          .insert({ user_id: userA.id, timezone: 'UTC' }),
      );

      const notification = await insertOne(userA.client, 'notification_log', {
        user_id: userA.id,
        tier: 'utility',
        kind: 'am_reminder',
      });
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

      const freeze = await insertOne(userA.client, 'streak_freezes', {
        user_id: userA.id,
        applied_for_date: isoDate(-1),
        source: 'auto',
      });
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
        userB.client
          .from('streak_freezes')
          .insert({ user_id: userA.id, applied_for_date: isoDate(-2) }),
      );

      const recommendationPreferences = await upsertOne(
        userA.client,
        'recommendation_preferences',
        {
          user_id: userA.id,
          values_filters: ['fragrance_free'],
          budget_band: 'drugstore',
          format_prefs: ['gel'],
        },
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
      await expectBlockedInsert(
        'recommendation preferences cross-user insert',
        userB.client
          .from('recommendation_preferences')
          .insert({ user_id: userA.id, values_filters: ['bad'] }),
      );

      const recommendation = await insertOne(userA.client, 'recommendations', {
        user_id: userA.id,
        trigger: 'gap',
        product_type: `phase9-${randomUUID()}`,
        fit_rationale: 'Phase 9 RLS test rationale.',
        evidence_grade: 'C',
      });
      await expectVisible(
        userA.client,
        'recommendations',
        'id',
        recommendation.id,
        'recommendation owner read',
      );
      await expectNotVisible(
        userB.client,
        'recommendations',
        'id',
        recommendation.id,
        'recommendation cross-user read',
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
      const trend = await insertOne(userA.client, 'photo_trend', {
        user_id: userA.id,
        series: 'front',
        delta_metric: 0,
        mdc_threshold: 1,
        change_state: 'consistent',
        narrative_key: 'phase9_live_adversarial',
        computed_local_date: isoDate(),
      });
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
      await expectBlockedMutation(
        'photo trend revoked consent update',
        userA.client
          .from('photo_trend')
          .update({ narrative_key: 'bad_after_revoke' })
          .eq('id', trend.id)
          .select('id'),
      );
    });

    await runCheck('catalog and commerce telemetry isolation', async () => {
      const catalogCorrection = await insertOne(userA.client, 'catalog_corrections', {
        user_id: userA.id,
        correction_type: 'missing_product',
        description: 'Phase 9 RLS correction.',
        proposed_payload: { productName: 'Phase 9 Cleanser' },
        client_context: { surface: 'phase9-live-adversarial' },
      });
      await expectVisible(
        userA.client,
        'catalog_corrections',
        'id',
        catalogCorrection.id,
        'catalog correction owner read',
      );
      await expectNotVisible(
        userB.client,
        'catalog_corrections',
        'id',
        catalogCorrection.id,
        'catalog correction cross-user read',
      );
      await expectBlockedInsert(
        'catalog correction cross-user insert',
        userB.client
          .from('catalog_corrections')
          .insert({ user_id: userA.id, correction_type: 'missing_product' }),
      );

      const lookupEvent = await insertOne(userA.client, 'catalog_lookup_events', {
        user_id: userA.id,
        lookup_type: 'search',
        query: 'phase9 cleanser',
        result: 'no_match',
      });
      await expectVisible(
        userA.client,
        'catalog_lookup_events',
        'id',
        lookupEvent.id,
        'lookup event owner read',
      );
      await expectNotVisible(
        userB.client,
        'catalog_lookup_events',
        'id',
        lookupEvent.id,
        'lookup event cross-user read',
      );
      await expectBlockedInsert(
        'lookup event cross-user insert',
        userB.client
          .from('catalog_lookup_events')
          .insert({ user_id: userA.id, lookup_type: 'search', result: 'no_match' }),
      );

      await grantConsent(userA.client, userA.id, 'data_sharing');
      const clickEvent = await insertOne(userA.client, 'commerce_click_events', {
        user_id: userA.id,
        click_token: `phase9-${randomUUID()}`,
        product_type: 'cleanser',
        source: 'none',
        consented: true,
      });
      await expectVisible(
        userA.client,
        'commerce_click_events',
        'id',
        clickEvent.id,
        'commerce click owner read',
      );
      await expectNotVisible(
        userB.client,
        'commerce_click_events',
        'id',
        clickEvent.id,
        'commerce click cross-user read',
      );
      await expectBlockedInsert(
        'commerce click cross-user insert',
        userB.client.from('commerce_click_events').insert({
          user_id: userA.id,
          click_token: `bad-${randomUUID()}`,
          source: 'none',
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
      await expectBlockedInsert(
        'commerce click unconsented insert',
        userA.client.from('commerce_click_events').insert({
          user_id: userA.id,
          click_token: `phase9-unconsented-${randomUUID()}`,
          product_type: 'cleanser',
          source: 'none',
          consented: false,
        }),
      );
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
      globalCleanup.communityNoteIds.push(publishedNote.id, unpublishedNote.id);
      await expectVisible(
        userA.client,
        'community_notes',
        'id',
        publishedNote.id,
        'published community note read',
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
      const question = await insertOne(userA.client, 'community_questions', {
        user_id: userA.id,
        topic_id: topic.id,
        body: 'Phase 9 synthetic moderation question.',
        anon_handle: `phase9-${randomUUID()}`,
        moderation_state: 'pending',
        consent_grant_id: communityConsent.id,
      });
      await expectVisible(
        userA.client,
        'community_questions',
        'id',
        question.id,
        'community question owner read',
      );
      await expectNotVisible(
        userB.client,
        'community_questions',
        'id',
        question.id,
        'pending community question cross-user read',
      );
      await expectBlockedInsert(
        'community question cross-user insert',
        userB.client.from('community_questions').insert({
          user_id: userA.id,
          topic_id: topic.id,
          body: 'bad',
          anon_handle: 'bad',
          consent_grant_id: communityConsent.id,
        }),
      );
      await expectBlockedInsert(
        'community report pending private question insert',
        userB.client.from('community_reports').insert({
          reporter_id: userB.id,
          question_id: question.id,
          reason: 'should not report private pending content',
        }),
      );

      const approval = await admin
        .from('community_questions')
        .update({ moderation_state: 'approved' })
        .eq('id', question.id);
      if (approval.error) throw approval.error;
      await expectVisible(
        userB.client,
        'community_questions',
        'id',
        question.id,
        'approved community question public read',
      );
      const report = await insertOne(userB.client, 'community_reports', {
        reporter_id: userB.id,
        question_id: question.id,
        reason: 'phase9-live-adversarial',
      });
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
        userA.client
          .from('community_reports')
          .insert({ reporter_id: userB.id, question_id: question.id, reason: 'bad' }),
      );

      const reaction = await insertOne(userA.client, 'community_reactions', {
        user_id: userA.id,
        note_id: publishedNote.id,
        reaction: 'helped',
      });
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
      const session = await insertOne(userA.client, 'ask_sessions', {
        user_id: userA.id,
        turn_count: 1,
        last_intent: 'phase9_live_adversarial',
        grounded_rate: 1,
        model_tier: 'deterministic',
      });
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
      const ownerPath = `${userA.id}/phase9-${randomUUID()}.bin`;
      const crossPath = `${userA.id}/phase9-cross-${randomUUID()}.bin`;
      const foreignMetadataPath = `${userB.id}/phase9-foreign-${randomUUID()}.bin`;
      storagePaths.push(ownerPath, crossPath);

      await grantConsent(userA.client, userA.id, 'photo_cloud_backup');
      const upload = await userA.client.storage
        .from('photos')
        .upload(ownerPath, new Blob(['phase9 live adversarial object']), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      if (upload.error) throw upload.error;

      const photo = await insertOne(userA.client, 'photos', {
        user_id: userA.id,
        storage_path: ownerPath,
        local_only: false,
        face_region_redacted: true,
      });
      await expectVisible(userA.client, 'photos', 'id', photo.id, 'photo metadata owner read');
      await expectNotVisible(
        userB.client,
        'photos',
        'id',
        photo.id,
        'photo metadata cross-user read',
      );
      await expectNotVisible(anonymous, 'photos', 'id', photo.id, 'photo metadata anonymous read');
      await expectBlockedInsert(
        'photo metadata cross-user insert',
        userB.client.from('photos').insert({ user_id: userA.id, local_only: true }),
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
          storage_path: `${userA.id}/phase9-local-only-${randomUUID()}.bin`,
          local_only: true,
          face_region_redacted: true,
        }),
      );
      await expectBlockedMutation(
        'photo metadata cross-user storage path update',
        userA.client
          .from('photos')
          .update({ storage_path: foreignMetadataPath })
          .eq('id', photo.id)
          .select('id'),
      );

      const ownerDownload = await userA.client.storage.from('photos').download(ownerPath);
      if (ownerDownload.error) throw ownerDownload.error;

      const crossDownload = await userB.client.storage.from('photos').download(ownerPath);
      assert(Boolean(crossDownload.error), 'storage cross-user download unexpectedly succeeded.');

      const anonDownload = await anonymous.storage.from('photos').download(ownerPath);
      assert(Boolean(anonDownload.error), 'storage anonymous download unexpectedly succeeded.');

      const crossUpload = await userB.client.storage
        .from('photos')
        .upload(crossPath, new Blob(['bad cross-user object']), {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      assert(
        Boolean(crossUpload.error),
        'storage cross-user upload into owner prefix unexpectedly succeeded.',
      );

      await userB.client.storage.from('photos').remove([ownerPath]);
      const stillReadableByOwner = await userA.client.storage.from('photos').download(ownerPath);
      if (stillReadableByOwner.error)
        throw new Error('storage cross-user delete removed owner object.');

      await revokeConsent(userA.client, userA.id, 'photo_cloud_backup');
      await expectBlockedInsert(
        'photo metadata revoked cloud consent insert',
        userA.client.from('photos').insert({
          user_id: userA.id,
          storage_path: `${userA.id}/phase9-revoked-${randomUUID()}.bin`,
          local_only: false,
          face_region_redacted: true,
        }),
      );
      const revokedUpload = await userA.client.storage
        .from('photos')
        .upload(
          `${userA.id}/phase9-revoked-${randomUUID()}.bin`,
          new Blob(['bad revoked object']),
          {
            contentType: 'application/octet-stream',
            upsert: false,
          },
        );
      assert(
        Boolean(revokedUpload.error),
        'storage upload after photo_cloud_backup revocation unexpectedly succeeded.',
      );
    });

    writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  } finally {
    if (storagePaths.length > 0) {
      await admin.storage
        .from('photos')
        .remove(storagePaths)
        .catch((error) => warnings.push(`Storage cleanup warning: ${redactedErrorKind(error)}`));
    }
    for (const user of users) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) warnings.push(`User cleanup warning: ${redactedErrorKind(error)}`);
    }
    await deleteByIds(admin, 'community_notes', globalCleanup.communityNoteIds).catch((error) =>
      warnings.push(`Community note cleanup warning: ${redactedErrorKind(error)}`),
    );
    await deleteByIds(admin, 'community_topics', globalCleanup.communityTopicIds).catch((error) =>
      warnings.push(`Community topic cleanup warning: ${redactedErrorKind(error)}`),
    );
    await deleteByIds(admin, 'conflict_rules', globalCleanup.conflictRuleIds).catch((error) =>
      warnings.push(`Conflict rule cleanup warning: ${redactedErrorKind(error)}`),
    );
  }

  printResult('Phase 9 live Supabase adversarial', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live Supabase adversarial', errors, warnings);
});
