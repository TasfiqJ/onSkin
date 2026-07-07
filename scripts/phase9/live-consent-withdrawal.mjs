#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
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

const runLive = env.PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const consentTextHash = 'a'.repeat(64);

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
    'docs/phase-9/generated/live-consent-withdrawal.json',
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  write(
    'docs/phase-9/generated/live-consent-withdrawal.md',
    [
      '# Live consent-withdrawal evidence',
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

async function createLiveUser(admin) {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `phase9-consent-${suffix}@example.invalid`;
  const password = `Phase9Consent-${suffix}-Password!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phase9_live_consent_withdrawal: true },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return a consent-withdrawal harness user.');

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

async function grantConsent(client, userId, consentType) {
  return insertOne(client, 'consents', {
    user_id: userId,
    consent_type: consentType,
    granted: true,
    version: 'phase9-live-consent-withdrawal',
    consent_text_hash: consentTextHash,
  });
}

async function invokeWithdrawal(client, consentType) {
  const { data, error } = await client.functions.invoke('consent-withdrawal', {
    method: 'POST',
    body: {
      consentType,
      version: 'phase9-live-consent-withdrawal',
      consentTextHash,
    },
  });
  if (error) throw error;
  assert(data?.withdrawn === true, `${consentType}: withdrawal did not report success.`);
  assert(
    data?.consent_type === consentType,
    `${consentType}: withdrawal response had wrong consent_type.`,
  );
  return data.cleanup ?? {};
}

async function expectRevocationRecorded(client, consentType) {
  const { data, error } = await client
    .from('consents')
    .select('consent_type, granted, revoked_at')
    .eq('consent_type', consentType)
    .eq('granted', false)
    .not('revoked_at', 'is', null)
    .order('granted_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  assert(data.consent_type === consentType, `${consentType}: revocation row had wrong type.`);
  assert(data.granted === false, `${consentType}: revocation row was not marked revoked.`);
  assert(Boolean(data.revoked_at), `${consentType}: revocation row is missing revoked_at.`);
}

async function countRows(client, table, column, value) {
  const { data, error } = await client.from(table).select('id').eq(column, value);
  if (error) throw error;
  return (data ?? []).length;
}

async function expectRowCount(client, table, column, value, expected, label) {
  const actual = await countRows(client, table, column, value);
  assert(actual === expected, `${label}: expected ${expected}, got ${actual}.`);
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Live consent-withdrawal harness not run; set PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL=true with staging credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live consent withdrawal', errors, warnings);
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
    appEnv !== 'production' || env.PHASE9_ALLOW_PRODUCTION_LIVE_CONSENT_WITHDRAWAL === 'true',
    'Refusing production live consent-withdrawal tests without PHASE9_ALLOW_PRODUCTION_LIVE_CONSENT_WITHDRAWAL=true.',
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live consent withdrawal', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const storagePaths = [];
  const topicIds = [];
  const noteIds = [];
  const orderIds = [];
  let user = null;

  try {
    user = await createLiveUser(admin);

    await runCheck(
      'photo_cloud_backup withdrawal relocalizes metadata and removes owned storage object',
      async () => {
        await grantConsent(user.client, user.id, 'photo_cloud_backup');
        const storagePath = `${user.id}/phase9-consent-${randomUUID()}.bin`;
        storagePaths.push(storagePath);
        const upload = await user.client.storage
          .from('photos')
          .upload(storagePath, new Blob(['phase9 consent photo']), {
            contentType: 'application/octet-stream',
            upsert: false,
          });
        if (upload.error) throw upload.error;
        const photo = await insertOne(user.client, 'photos', {
          user_id: user.id,
          storage_path: storagePath,
          local_only: false,
          face_region_redacted: true,
        });

        const cleanup = await invokeWithdrawal(user.client, 'photo_cloud_backup');
        assert(
          cleanup.photo_rows_relocalized >= 1,
          'photo_cloud_backup cleanup did not relocalize a photo row.',
        );
        assert(
          cleanup.storage_objects_removed >= 1,
          'photo_cloud_backup cleanup did not remove a storage object.',
        );
        await expectRevocationRecorded(user.client, 'photo_cloud_backup');

        const { data: row, error } = await admin
          .from('photos')
          .select('local_only, storage_path')
          .eq('id', photo.id)
          .single();
        if (error) throw error;
        assert(
          row.local_only === true && row.storage_path === null,
          'photo row was not relocalized after withdrawal.',
        );

        const download = await admin.storage.from('photos').download(storagePath);
        assert(Boolean(download.error), 'withdrawn cloud photo object was still downloadable.');
      },
    );

    await runCheck(
      'ask_onskin withdrawal deletes server-side safety audit content only',
      async () => {
        await grantConsent(user.client, user.id, 'ask_onskin');
        const session = await insertOne(user.client, 'ask_sessions', {
          user_id: user.id,
          turn_count: 1,
          last_intent: 'phase9_live_consent',
          grounded_rate: 1,
          model_tier: 'deterministic',
        });
        const turn = await insertOne(user.client, 'ask_turn_audit', {
          session_id: session.id,
          intent: 'phase9_live_consent',
          answer_kind: 'deterministic',
          was_grounded: true,
          was_refused: false,
          was_escalated: false,
          claimsafety_ok: true,
        });
        await insertOne(user.client, 'ask_safety_audit', {
          user_id: user.id,
          turn_audit_id: turn.id,
          content_enc: '\\x706861736539',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        });

        const cleanup = await invokeWithdrawal(user.client, 'ask_onskin');
        assert(
          cleanup.ask_safety_audit_deleted >= 1,
          'ask_onskin cleanup did not delete safety audit content.',
        );
        await expectRevocationRecorded(user.client, 'ask_onskin');
        await expectRowCount(
          admin,
          'ask_safety_audit',
          'user_id',
          user.id,
          0,
          'Ask safety audit cleanup',
        );
        await expectRowCount(
          admin,
          'ask_sessions',
          'user_id',
          user.id,
          1,
          'Ask metadata retention',
        );
      },
    );

    await runCheck('photo_trend_insights withdrawal deletes trend rows', async () => {
      await grantConsent(user.client, user.id, 'photo_trend_insights');
      await insertOne(user.client, 'photo_trend', {
        user_id: user.id,
        series: 'front',
        delta_metric: 0,
        mdc_threshold: 1,
        change_state: 'consistent',
        narrative_key: 'phase9_live_consent',
        computed_local_date: new Date().toISOString().slice(0, 10),
      });

      const cleanup = await invokeWithdrawal(user.client, 'photo_trend_insights');
      assert(
        cleanup.photo_trend_deleted >= 1,
        'photo_trend_insights cleanup did not delete trend rows.',
      );
      await expectRevocationRecorded(user.client, 'photo_trend_insights');
      await expectRowCount(admin, 'photo_trend', 'user_id', user.id, 0, 'photo trend cleanup');
    });

    await runCheck('community_participation withdrawal deletes user community rows', async () => {
      const topic = await insertOne(
        admin,
        'community_topics',
        {
          slug: `phase9-consent-${randomUUID()}`,
          title: 'Phase 9 consent topic',
          description: 'Synthetic consent withdrawal topic.',
          is_active: true,
        },
        'id',
      );
      topicIds.push(topic.id);
      const note = await insertOne(
        admin,
        'community_notes',
        {
          topic_id: topic.id,
          kind: 'explainer',
          title: 'Phase 9 consent note',
          body: 'Synthetic published note for consent testing.',
          evidence_grade: 'C',
          evidence_label: 'plausible',
          provenance: 'editorial',
          claim_safety_ok: true,
          reviewed_by: user.id,
        },
        'id',
      );
      noteIds.push(note.id);

      const consent = await grantConsent(user.client, user.id, 'community_participation');
      const question = await insertOne(user.client, 'community_questions', {
        user_id: user.id,
        topic_id: topic.id,
        body: 'Phase 9 consent withdrawal question.',
        anon_handle: `phase9-consent-${randomUUID()}`,
        moderation_state: 'pending',
        consent_grant_id: consent.id,
      });
      await insertOne(user.client, 'community_reactions', {
        user_id: user.id,
        note_id: note.id,
        reaction: 'helped',
      });
      await insertOne(user.client, 'community_blocks', {
        user_id: user.id,
        blocked_handle: `phase9-consent-block-${randomUUID()}`,
      });
      await insertOne(user.client, 'community_reports', {
        reporter_id: user.id,
        question_id: question.id,
        reason: 'phase9-live-consent-withdrawal',
      });

      const cleanup = await invokeWithdrawal(user.client, 'community_participation');
      assert(
        cleanup.community_questions_deleted >= 1,
        'community cleanup did not delete questions.',
      );
      assert(
        cleanup.community_reactions_deleted >= 1,
        'community cleanup did not delete reactions.',
      );
      assert(cleanup.community_reports_deleted >= 1, 'community cleanup did not delete reports.');
      assert(cleanup.community_blocks_deleted >= 1, 'community cleanup did not delete blocks.');
      await expectRevocationRecorded(user.client, 'community_participation');
      await expectRowCount(
        admin,
        'community_questions',
        'user_id',
        user.id,
        0,
        'community question cleanup',
      );
      await expectRowCount(
        admin,
        'community_reactions',
        'user_id',
        user.id,
        0,
        'community reaction cleanup',
      );
      await expectRowCount(
        admin,
        'community_reports',
        'reporter_id',
        user.id,
        0,
        'community report cleanup',
      );
      await expectRowCount(
        admin,
        'community_blocks',
        'user_id',
        user.id,
        0,
        'community block cleanup',
      );
    });

    await runCheck(
      'data_sharing withdrawal detaches order links and deletes commerce clicks',
      async () => {
        await grantConsent(user.client, user.id, 'data_sharing');
        const clickToken = `phase9-consent-${randomUUID()}`;
        await insertOne(user.client, 'commerce_click_events', {
          user_id: user.id,
          click_token: clickToken,
          product_type: 'cleanser',
          source: 'direct',
          consented: true,
        });
        const externalOrderId = `phase9-consent-${randomUUID()}`;
        orderIds.push(externalOrderId);
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

        const cleanup = await invokeWithdrawal(user.client, 'data_sharing');
        assert(
          cleanup.commerce_click_events_deleted >= 1,
          'data_sharing cleanup did not delete commerce clicks.',
        );
        assert(
          cleanup.order_attributions_detached >= 1,
          'data_sharing cleanup did not detach order attributions.',
        );
        await expectRevocationRecorded(user.client, 'data_sharing');
        await expectRowCount(
          admin,
          'commerce_click_events',
          'user_id',
          user.id,
          0,
          'commerce click cleanup',
        );

        const { data: order, error } = await admin
          .from('order_attributions')
          .select('click_token')
          .eq('external_order_id', externalOrderId)
          .single();
        if (error) throw error;
        assert(
          order.click_token === null,
          'data_sharing withdrawal did not detach order attribution click token.',
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
    for (const externalOrderId of orderIds) {
      const { error } = await admin
        .from('order_attributions')
        .delete()
        .eq('external_order_id', externalOrderId);
      if (error) warnings.push(`Order cleanup warning: ${redactedErrorKind(error)}`);
    }
    if (noteIds.length > 0) {
      const { error } = await admin.from('community_notes').delete().in('id', noteIds);
      if (error) warnings.push(`Community note cleanup warning: ${redactedErrorKind(error)}`);
    }
    if (topicIds.length > 0) {
      const { error } = await admin.from('community_topics').delete().in('id', topicIds);
      if (error) warnings.push(`Community topic cleanup warning: ${redactedErrorKind(error)}`);
    }
    if (user?.id) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) warnings.push(`Consent harness user cleanup warning: ${redactedErrorKind(error)}`);
    }
  }

  writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live consent withdrawal', errors, warnings);
}

main().catch((error) => {
  errors.push(resultError(error));
  writeArtifacts('fail');
  printResult('Phase 9 live consent withdrawal', errors, warnings);
});
