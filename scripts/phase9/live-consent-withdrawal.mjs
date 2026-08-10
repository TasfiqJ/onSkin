#!/usr/bin/env node
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import {
  authUserMissing,
  block,
  command,
  envSnapshot,
  gitStatusExcludingPaths,
  HarnessAssertionError,
  harnessErrorDetail,
  hash,
  placeholderEnvValue,
  printResult,
  readScriptAppEnvironment,
  redactedErrorKind,
  resolveHostedSupabaseProjectTarget,
  stableErrorCode,
  storageObjectMissing,
  strict,
  write,
} from './lib.mjs';
import {
  HEALTH_CONSENT_SCHEMA_PATH,
  LIVE_CONSENT_COPY_CONTRACT_SHA256,
  LIVE_CONSENT_WITHDRAWAL_CHECK_MANIFEST_SHA256,
  LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH,
  LIVE_CONSENT_WITHDRAWAL_EVIDENCE_SCHEMA_VERSION,
  LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH,
  LIVE_HEALTH_CONSENT_COPY,
  REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS,
} from './consent-withdrawal-evidence.mjs';

const errors = [];
const warnings = [];
const checks = [];
const env = envSnapshot();
const runLive = env.PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL === 'true';
const appEnv = readScriptAppEnvironment();
const supabaseUrl = env.SUPABASE_URL;
const supabaseTarget = resolveHostedSupabaseProjectTarget(
  supabaseUrl,
  env.PHASE9_EXPECTED_SUPABASE_PROJECT_REF,
);
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const outputPaths = [
  'docs/phase-9/generated/live-consent-withdrawal.json',
  'docs/phase-9/generated/live-consent-withdrawal.md',
];
const gitHead = command('git', ['rev-parse', 'HEAD']).trim();
const sourceSha = exactValue(env.PHASE9_EVIDENCE_SOURCE_SHA ?? env.GITHUB_SHA, /^[a-f0-9]{40}$/i);
const sourceTreeClean = gitStatusExcludingPaths(outputPaths) === '';
const workerPollTimeoutSeconds = intEnv(
  'PHASE9_CONSENT_WITHDRAWAL_WORKER_POLL_TIMEOUT_SECONDS',
  180,
  30,
  600,
);
const workerPollIntervalSeconds = intEnv(
  'PHASE9_CONSENT_WITHDRAWAL_WORKER_POLL_INTERVAL_SECONDS',
  5,
  1,
  30,
);

const artifact = {
  schemaVersion: LIVE_CONSENT_WITHDRAWAL_EVIDENCE_SCHEMA_VERSION,
  status: runLive ? 'running' : 'not-run',
  sourceSha,
  sourceTreeClean,
  appEnvironment: appEnv,
  expectedSupabaseProjectRef: supabaseTarget.expectedProjectRef,
  actualSupabaseProjectRef: supabaseTarget.actualProjectRef,
  supabaseHost: supabaseTarget.safeHost,
  schemaRevision: {
    path: HEALTH_CONSENT_SCHEMA_PATH,
    sha256: hash(HEALTH_CONSENT_SCHEMA_PATH),
  },
  harnessRevision: {
    path: LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH,
    sha256: hash(LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH),
  },
  evidenceContractRevision: {
    path: LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH,
    sha256: hash(LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH),
  },
  copyContractSha256: LIVE_CONSENT_COPY_CONTRACT_SHA256,
  checkManifest: {
    names: REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS,
    sha256: LIVE_CONSENT_WITHDRAWAL_CHECK_MANIFEST_SHA256,
  },
  workerPollTimeoutSeconds,
  workerPollIntervalSeconds,
  checks,
  warnings,
  errors,
};

function intEnv(name, fallback, minimum, maximum) {
  const value = Number(env[name]);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function exactValue(value, pattern) {
  const text = String(value ?? '').trim();
  return text && pattern.test(text) ? text : null;
}

function assert(condition, message) {
  if (!condition) throw new HarnessAssertionError(message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function oneRow(data) {
  return Array.isArray(data) && data.length === 1 && isRecord(data[0]) ? data[0] : null;
}

function randomToken() {
  return randomBytes(32).toString('hex');
}

function record(name, status, detail = '') {
  checks.push({ name, status, detail });
}

function writeArtifacts(status) {
  if (status === 'pass' && strict && warnings.length > 0) status = 'fail';
  artifact.status = status;
  if (status === 'pass' || status === 'fail') {
    artifact.ranAt = new Date().toISOString();
  }
  write(
    'docs/phase-9/generated/live-consent-withdrawal.json',
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  write(
    'docs/phase-9/generated/live-consent-withdrawal.md',
    [
      '# Live consent-withdrawal evidence',
      '',
      `- Evidence schema: ${artifact.schemaVersion}`,
      `- Status: ${artifact.status}`,
      `- Source SHA: ${artifact.sourceSha ?? 'not supplied'}`,
      `- Clean source tree: ${artifact.sourceTreeClean ? 'yes' : 'no'}`,
      `- Environment: ${artifact.appEnvironment}`,
      `- Expected Supabase project ref: ${artifact.expectedSupabaseProjectRef ?? 'not configured'}`,
      `- Actual Supabase project ref: ${artifact.actualSupabaseProjectRef ?? 'not canonical'}`,
      `- Supabase host: ${artifact.supabaseHost ?? 'not configured'}`,
      `- Schema SHA-256: ${artifact.schemaRevision.sha256}`,
      `- Harness SHA-256: ${artifact.harnessRevision.sha256}`,
      `- Evidence-contract SHA-256: ${artifact.evidenceContractRevision.sha256}`,
      `- Check-manifest SHA-256: ${artifact.checkManifest.sha256}`,
      `- Ran at: ${artifact.ranAt ?? 'not run'}`,
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
    return true;
  } catch (error) {
    const detail = harnessErrorDetail(error);
    record(name, 'fail', detail);
    errors.push(`${name}: ${detail}`);
    return false;
  }
}

function publicClient(headers = {}) {
  return createClient(supabaseUrl, publishableKey, {
    global: { headers },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function createLiveUser(admin, onCreated) {
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
  assert(data.user, 'Supabase did not return the synthetic harness identity.');
  onCreated({ id: data.user.id });

  const client = publicClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  assert(signedIn.data.session, 'Supabase did not return the synthetic harness session.');
  return { id: data.user.id, client, session: signedIn.data.session };
}

async function authenticatedFixtureClient(session, epoch, generations) {
  const generationMarkers = Object.entries(generations)
    .map(([type, generation]) => `health-consent-generation=${type}:${generation}`)
    .join(';');
  const client = publicClient({
    'x-health-processing-epoch': String(epoch),
    'x-client-info': `phase9-live-consent-withdrawal;${generationMarkers}`,
  });
  const result = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (result.error) throw result.error;
  assert(
    result.data.user?.id === session.user.id,
    'The fixture client session did not retain the synthetic owner.',
  );
  return client;
}

async function insertOne(client, table, payload, select = '*') {
  const { data, error } = await client.from(table).insert(payload).select(select).single();
  if (error) throw error;
  return data;
}

async function activateHealthConsent(client, userId) {
  const copy = LIVE_HEALTH_CONSENT_COPY.baseGrant;
  const { data, error } = await client.rpc('grant_health_data_consent', {
    p_expected_epoch: 0,
    p_version: copy.version,
    p_consent_text_hash: copy.hash,
  });
  if (error) throw error;
  const row = oneRow(data);
  assert(
    row?.user_id === userId && row.state === 'active' && row.epoch === 1,
    'The base health authority did not activate at epoch 1.',
  );
  assert(
    row.consent_version === copy.version && row.consent_text_hash === copy.hash,
    'The base health authority returned a different disclosure receipt.',
  );
  return 1;
}

async function dependentStatus(client, consentType) {
  const { data, error } = await client.rpc('get_health_dependent_consent_status', {
    p_consent_type: consentType,
  });
  if (error) throw error;
  const row = oneRow(data);
  assert(
    row?.consent_type === consentType &&
      Number.isSafeInteger(row.generation) &&
      Number.isSafeInteger(row.health_epoch),
    `${consentType}: dependent status attestation was invalid.`,
  );
  return row;
}

async function grantDependentConsent(client, consentType, epoch) {
  const before = await dependentStatus(client, consentType);
  assert(
    before.state === 'unconsented' && before.health_epoch === epoch,
    `${consentType}: expected an initially unconsented dependent authority.`,
  );
  const copy = LIVE_HEALTH_CONSENT_COPY.dependent[consentType].grant;
  const { data, error } = await client.rpc('record_health_dependent_consent', {
    p_expected_epoch: epoch,
    p_expected_generation: before.generation,
    p_idempotency_key: randomToken(),
    p_consent_type: consentType,
    p_version: copy.version,
    p_consent_text_hash: copy.hash,
  });
  if (error) throw error;
  const row = oneRow(data);
  assert(
    row?.consent_type === consentType &&
      row.state === 'active' &&
      row.health_epoch === epoch &&
      row.generation === before.generation + 1 &&
      row.version === copy.version &&
      row.consent_text_hash === copy.hash,
    `${consentType}: dependent grant RPC attestation was invalid.`,
  );
  return row.generation;
}

async function latestGrantId(client, consentType) {
  const copy = LIVE_HEALTH_CONSENT_COPY.dependent[consentType].grant;
  const { data, error } = await client
    .from('consents')
    .select('id')
    .eq('consent_type', consentType)
    .eq('granted', true)
    .eq('version', copy.version)
    .eq('consent_text_hash', copy.hash)
    .order('granted_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  assert(typeof data.id === 'string', `${consentType}: grant receipt ID was unavailable.`);
  return data.id;
}

async function invokeWithdrawal(client, consentType, epoch, generation) {
  const copy = LIVE_HEALTH_CONSENT_COPY.dependent[consentType].withdrawal;
  const request = {
    consentType,
    version: copy.version,
    consentTextHash: copy.hash,
    idempotencyKey: randomToken(),
    expectedProcessingEpoch: epoch,
    expectedConsentGeneration: generation,
  };
  const { data, error, response } = await client.functions.invoke('consent-withdrawal', {
    method: 'POST',
    body: request,
  });
  if (error) throw error;
  assert(
    isRecord(data) && data.consent_type === consentType,
    `${consentType}: withdrawal response had the wrong consent type.`,
  );
  assert(
    data.processing_epoch === epoch && data.consent_generation === generation + 1,
    `${consentType}: withdrawal response had the wrong epoch or generation.`,
  );
  return { request, data, status: response?.status ?? null };
}

async function replayWithdrawal(client, request) {
  const { data, error, response } = await client.functions.invoke('consent-withdrawal', {
    method: 'POST',
    body: request,
  });
  if (error) throw error;
  assert(
    response?.status === 200 && data?.withdrawn === true && data?.replayed === true,
    `${request.consentType}: exact terminal replay did not attest prior completion.`,
  );
}

async function waitForDependentWithdrawal(client, consentType, generation) {
  const deadline = Date.now() + workerPollTimeoutSeconds * 1_000;
  do {
    const row = await dependentStatus(client, consentType);
    if (row.state === 'withdrawn' && row.generation === generation) return row;
    assert(
      row.state === 'withdrawing' && row.generation === generation,
      `${consentType}: scheduled withdrawal entered an unexpected state.`,
    );
    await new Promise((resolve) => setTimeout(resolve, workerPollIntervalSeconds * 1_000));
  } while (Date.now() < deadline);
  throw new HarnessAssertionError(
    `${consentType}: scheduled worker did not reach terminal withdrawal within the bounded poll window.`,
  );
}

async function expectRevocationRecorded(client, consentType) {
  const copy = LIVE_HEALTH_CONSENT_COPY.dependent[consentType].withdrawal;
  const { data, error } = await client
    .from('consents')
    .select('consent_type, granted, version, consent_text_hash, revoked_at')
    .eq('consent_type', consentType)
    .eq('granted', false)
    .eq('version', copy.version)
    .eq('consent_text_hash', copy.hash)
    .not('revoked_at', 'is', null)
    .order('granted_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  assert(
    data.consent_type === consentType &&
      data.granted === false &&
      data.version === copy.version &&
      data.consent_text_hash === copy.hash &&
      Boolean(data.revoked_at),
    `${consentType}: exact withdrawal receipt was not recorded.`,
  );
}

async function countRows(client, table, column, value) {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);
  if (error) throw error;
  assert(Number.isSafeInteger(count), `${table}: exact count was unavailable.`);
  return count;
}

async function expectRowCount(client, table, column, value, expected, label) {
  const actual = await countRows(client, table, column, value);
  assert(actual === expected, `${label}: expected ${expected}, got ${actual}.`);
}

function markSkippedChecks(afterIndex) {
  for (
    let index = afterIndex + 1;
    index < REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS.length - 1;
    index += 1
  ) {
    const name = REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[index];
    const detail = 'authoritative grant setup did not complete';
    record(name, 'fail', detail);
    errors.push(`${name}: ${detail}`);
  }
}

async function cleanupSyntheticState(admin, state) {
  const cleanupFailures = [];
  if (state.storagePaths.length > 0) {
    try {
      const result = await admin.storage.from('photos').remove(state.storagePaths);
      if (result.error) cleanupFailures.push(redactedErrorKind(result.error));
    } catch (error) {
      cleanupFailures.push(redactedErrorKind(error));
    }
  }
  if (state.noteIds.length > 0) {
    try {
      const { error } = await admin.from('community_notes').delete().in('id', state.noteIds);
      if (error) cleanupFailures.push(redactedErrorKind(error));
    } catch (error) {
      cleanupFailures.push(redactedErrorKind(error));
    }
  }
  if (state.topicIds.length > 0) {
    try {
      const { error } = await admin.from('community_topics').delete().in('id', state.topicIds);
      if (error) cleanupFailures.push(redactedErrorKind(error));
    } catch (error) {
      cleanupFailures.push(redactedErrorKind(error));
    }
  }
  if (state.user?.id) {
    try {
      const deletion = await admin.auth.admin.deleteUser(state.user.id);
      if (deletion.error) cleanupFailures.push(redactedErrorKind(deletion.error));
      const absence = await admin.auth.admin.getUserById(state.user.id);
      if (!authUserMissing(absence)) cleanupFailures.push('auth_identity_present');
    } catch (error) {
      cleanupFailures.push(redactedErrorKind(error));
    }
  }
  assert(cleanupFailures.length === 0, 'Synthetic cleanup did not attest complete removal.');
}

async function main() {
  if (!runLive) {
    warnings.push(
      'Hosted consent-withdrawal evidence not run; use the protected staging workflow with reviewed Supabase credentials.',
    );
    writeArtifacts('not-run');
    printResult('Phase 9 live consent withdrawal', errors, warnings);
    return;
  }

  block(
    errors,
    appEnv === 'staging',
    'Live consent-withdrawal evidence is restricted to the reviewed staging environment.',
  );
  block(
    errors,
    supabaseTarget.valid,
    'SUPABASE_URL and PHASE9_EXPECTED_SUPABASE_PROJECT_REF must identify one reviewed canonical hosted project.',
  );
  block(
    errors,
    !placeholderEnvValue(publishableKey),
    'A hosted Supabase publishable key is required.',
  );
  block(errors, !placeholderEnvValue(secretKey), 'A hosted Supabase secret key is required.');
  block(
    errors,
    Boolean(sourceSha) && sourceSha === gitHead,
    'Live evidence requires the exact checked-out 40-character source revision.',
  );
  block(
    errors,
    sourceTreeClean,
    'Live evidence requires a clean source tree apart from generated evidence outputs.',
  );
  if (errors.length > 0) {
    writeArtifacts('fail');
    printResult('Phase 9 live consent withdrawal', errors, warnings);
    return;
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const state = {
    user: null,
    storagePaths: [],
    topicIds: [],
    noteIds: [],
  };
  let fixtureClient = null;
  let epoch = null;
  const generations = {};

  try {
    state.user = await createLiveUser(admin, (created) => {
      state.user = created;
    });
    const setupPassed = await runCheck(REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[0], async () => {
      epoch = await activateHealthConsent(state.user.client, state.user.id);
      for (const consentType of Object.keys(LIVE_HEALTH_CONSENT_COPY.dependent)) {
        generations[consentType] = await grantDependentConsent(
          state.user.client,
          consentType,
          epoch,
        );
      }
      fixtureClient = await authenticatedFixtureClient(state.user.session, epoch, generations);
    });

    if (!setupPassed) {
      markSkippedChecks(0);
    } else {
      await runCheck(REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[1], async () => {
        const storagePath = `${state.user.id}/e${epoch}/phase9-consent-${randomUUID()}.bin`;
        state.storagePaths.push(storagePath);
        const upload = await fixtureClient.storage
          .from('photos')
          .upload(storagePath, new Blob(['phase9 consent photo']), {
            contentType: 'application/octet-stream',
            upsert: false,
          });
        if (upload.error) throw upload.error;
        const photo = await insertOne(fixtureClient, 'photos', {
          user_id: state.user.id,
          storage_path: storagePath,
          local_only: false,
          face_region_redacted: true,
        });

        const withdrawal = await invokeWithdrawal(
          state.user.client,
          'photo_cloud_backup',
          epoch,
          generations.photo_cloud_backup,
        );
        assert(
          withdrawal.status === 202 &&
            withdrawal.data.withdrawn === false &&
            withdrawal.data.pending === true &&
            withdrawal.data.state === 'withdrawing',
          'photo_cloud_backup did not return HTTP 202 with truthful scheduled-worker pending state.',
        );
        await waitForDependentWithdrawal(
          state.user.client,
          'photo_cloud_backup',
          generations.photo_cloud_backup + 1,
        );
        await replayWithdrawal(state.user.client, withdrawal.request);
        await expectRevocationRecorded(state.user.client, 'photo_cloud_backup');

        const { data: row, error } = await admin
          .from('photos')
          .select('local_only, storage_path')
          .eq('id', photo.id)
          .single();
        if (error) throw error;
        assert(
          row.local_only === true && row.storage_path === null,
          'photo_cloud_backup did not terminally relocalize photo metadata.',
        );
        const download = await admin.storage.from('photos').download(storagePath);
        assert(
          storageObjectMissing(download.error),
          'photo_cloud_backup left its owned Storage object downloadable.',
        );
      });

      await runCheck(REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[2], async () => {
        const session = await insertOne(fixtureClient, 'ask_sessions', {
          user_id: state.user.id,
          turn_count: 1,
          last_intent: 'phase9_live_consent',
          grounded_rate: 1,
          model_tier: 'deterministic',
        });
        const turn = await insertOne(fixtureClient, 'ask_turn_audit', {
          session_id: session.id,
          intent: 'phase9_live_consent',
          answer_kind: 'deterministic',
          was_grounded: true,
          was_refused: false,
          was_escalated: false,
          claimsafety_ok: true,
        });
        await insertOne(fixtureClient, 'ask_safety_audit', {
          user_id: state.user.id,
          turn_audit_id: turn.id,
          content_enc: '\\x706861736539',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        });

        const withdrawal = await invokeWithdrawal(
          state.user.client,
          'ask_layerwell',
          epoch,
          generations.ask_layerwell,
        );
        assert(
          withdrawal.status === 200 &&
            withdrawal.data.withdrawn === true &&
            withdrawal.data.pending === false &&
            withdrawal.data.cleanup?.ask_safety_audit_deleted >= 1 &&
            withdrawal.data.cleanup?.ask_turn_audit_deleted >= 1 &&
            withdrawal.data.cleanup?.ask_sessions_deleted >= 1,
          'ask_layerwell did not attest complete server-side Ask cleanup.',
        );
        await expectRevocationRecorded(state.user.client, 'ask_layerwell');
        await expectRowCount(
          admin,
          'ask_safety_audit',
          'user_id',
          state.user.id,
          0,
          'Ask safety-audit cleanup',
        );
        await expectRowCount(
          admin,
          'ask_turn_audit',
          'session_id',
          session.id,
          0,
          'Ask turn cleanup',
        );
        await expectRowCount(
          admin,
          'ask_sessions',
          'user_id',
          state.user.id,
          0,
          'Ask session cleanup',
        );
      });

      await runCheck(REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[3], async () => {
        await insertOne(fixtureClient, 'photo_trend', {
          user_id: state.user.id,
          series: 'front',
          delta_metric: 0,
          mdc_threshold: 1,
          change_state: 'consistent',
          narrative_key: 'phase9_live_consent',
          computed_local_date: new Date().toISOString().slice(0, 10),
        });
        const withdrawal = await invokeWithdrawal(
          state.user.client,
          'photo_trend_insights',
          epoch,
          generations.photo_trend_insights,
        );
        assert(
          withdrawal.status === 200 &&
            withdrawal.data.withdrawn === true &&
            withdrawal.data.cleanup?.photo_trend_deleted >= 1,
          'photo_trend_insights did not attest trend-row cleanup.',
        );
        await expectRevocationRecorded(state.user.client, 'photo_trend_insights');
        await expectRowCount(
          admin,
          'photo_trend',
          'user_id',
          state.user.id,
          0,
          'Photo trend cleanup',
        );
      });

      await runCheck(REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[4], async () => {
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
        state.topicIds.push(topic.id);
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
            reviewed_by: state.user.id,
          },
          'id',
        );
        state.noteIds.push(note.id);
        const grantId = await latestGrantId(state.user.client, 'community_participation');
        const question = await insertOne(fixtureClient, 'community_questions', {
          user_id: state.user.id,
          topic_id: topic.id,
          body: 'Phase 9 consent withdrawal question.',
          anon_handle: `phase9-consent-${randomUUID()}`,
          moderation_state: 'pending',
          consent_grant_id: grantId,
        });
        await insertOne(fixtureClient, 'community_reactions', {
          user_id: state.user.id,
          note_id: note.id,
          reaction: 'helped',
        });
        await insertOne(fixtureClient, 'community_blocks', {
          user_id: state.user.id,
          blocked_handle: `phase9-consent-block-${randomUUID()}`,
        });
        await insertOne(fixtureClient, 'community_reports', {
          reporter_id: state.user.id,
          question_id: question.id,
          reason: 'phase9-live-consent-withdrawal',
        });

        const withdrawal = await invokeWithdrawal(
          state.user.client,
          'community_participation',
          epoch,
          generations.community_participation,
        );
        assert(
          withdrawal.status === 200 &&
            withdrawal.data.withdrawn === true &&
            withdrawal.data.cleanup?.community_questions_deleted >= 1 &&
            withdrawal.data.cleanup?.community_reactions_deleted >= 1 &&
            withdrawal.data.cleanup?.community_reports_deleted >= 1 &&
            withdrawal.data.cleanup?.community_blocks_deleted >= 1,
          'community_participation did not attest all owner-row cleanup.',
        );
        await expectRevocationRecorded(state.user.client, 'community_participation');
        for (const [table, column] of [
          ['community_questions', 'user_id'],
          ['community_reactions', 'user_id'],
          ['community_reports', 'reporter_id'],
          ['community_blocks', 'user_id'],
        ]) {
          await expectRowCount(admin, table, column, state.user.id, 0, `${table} cleanup`);
        }
      });

      await runCheck(REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[5], async () => {
        const blockedClickToken = `phase9-consent-closed-${randomUUID()}`;
        const blockedCommerceWrite = await fixtureClient.from('commerce_click_events').insert({
          user_id: state.user.id,
          click_token: blockedClickToken,
          product_type: 'cleanser',
          source: 'direct',
          consented: true,
        });
        assert(
          stableErrorCode(blockedCommerceWrite.error) === '42501',
          `COM-01A commerce click publication was not rejected: ${redactedErrorKind(
            blockedCommerceWrite.error,
          )}.`,
        );

        const withdrawal = await invokeWithdrawal(
          state.user.client,
          'data_sharing',
          epoch,
          generations.data_sharing,
        );
        assert(
          withdrawal.status === 200 &&
            withdrawal.data.withdrawn === true &&
            withdrawal.data.cleanup?.commerce_click_events_deleted === 0 &&
            withdrawal.data.cleanup?.order_attributions_detached === 0,
          'data_sharing did not truthfully attest zero COM-01A cleanup.',
        );
        await expectRevocationRecorded(state.user.client, 'data_sharing');
        await expectRowCount(
          admin,
          'commerce_click_events',
          'user_id',
          state.user.id,
          0,
          'Commerce click cleanup',
        );
      });

      await runCheck(REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[6], async () => {
        await insertOne(fixtureClient, 'photos', {
          user_id: state.user.id,
          storage_path: null,
          local_only: true,
          face_region_redacted: true,
        });
        const withdrawal = await invokeWithdrawal(
          state.user.client,
          'photo_capture',
          epoch,
          generations.photo_capture,
        );
        assert(
          withdrawal.status === 202 &&
            withdrawal.data.withdrawn === false &&
            withdrawal.data.pending === true &&
            withdrawal.data.state === 'withdrawing',
          'photo_capture did not return HTTP 202 with truthful scheduled-worker pending state.',
        );
        await waitForDependentWithdrawal(
          state.user.client,
          'photo_capture',
          generations.photo_capture + 1,
        );
        await replayWithdrawal(state.user.client, withdrawal.request);
        await expectRevocationRecorded(state.user.client, 'photo_capture');
        await expectRowCount(admin, 'photos', 'user_id', state.user.id, 0, 'Photo capture cleanup');
      });
    }
  } catch (error) {
    errors.push(`harness: ${harnessErrorDetail(error)}`);
  } finally {
    await runCheck(REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[7], () =>
      cleanupSyntheticState(admin, state),
    );
  }

  writeArtifacts(errors.length > 0 ? 'fail' : 'pass');
  printResult('Phase 9 live consent withdrawal', errors, warnings);
}

main().catch((error) => {
  errors.push(`harness: ${harnessErrorDetail(error)}`);
  writeArtifacts('fail');
  printResult('Phase 9 live consent withdrawal', errors, warnings);
});
