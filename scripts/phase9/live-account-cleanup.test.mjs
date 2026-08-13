import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  cleanupLiveTestAccounts,
  deleteLiveTestAccount,
  verifyLiveTestAccountAbsent,
} from './live-account-cleanup.mjs';

const VALID_RESPONSE = {
  deleted: true,
  request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  apple: 'skipped',
  posthog: 'already_absent',
};

test('live cleanup uses and validates the guarded account-deletion response', async () => {
  const calls = [];
  const client = {
    functions: {
      async invoke(...args) {
        calls.push(args);
        return { data: VALID_RESPONSE, error: null };
      },
    },
  };

  await deleteLiveTestAccount(client);
  await deleteLiveTestAccount(client);

  assert.equal(calls.length, 2);
  const completionTokens = calls.map(([, options]) => options.body.completionToken);
  for (const completionToken of completionTokens) {
    assert.match(completionToken, /^[0-9a-f]{64}$/);
  }
  assert.notEqual(completionTokens[0], completionTokens[1]);
  assert.deepEqual(
    calls.map(([name, options]) => [name, options.method]),
    [
      ['account-deletion', 'POST'],
      ['account-deletion', 'POST'],
    ],
  );
});

test('live cleanup fails closed on provider errors and malformed success', async () => {
  await assert.rejects(
    deleteLiveTestAccount({
      functions: {
        async invoke() {
          return { data: null, error: new Error('edge unavailable') };
        },
      },
    }),
    /edge unavailable/,
  );

  await assert.rejects(
    deleteLiveTestAccount({
      functions: {
        async invoke() {
          return { data: { ...VALID_RESPONSE, deleted: false }, error: null };
        },
      },
    }),
    /LIVE_ACCOUNT_DELETION_RESPONSE_INVALID/,
  );
});

test('cleanup failures enter the caller error sink and cannot yield PASS', async () => {
  const errors = [];
  const authLookups = [];
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const admin = {
    auth: {
      admin: {
        async getUserById(id) {
          authLookups.push(id);
          return { data: { user: { id } }, error: null };
        },
      },
    },
  };
  const user = {
    id: userId,
    client: {
      functions: {
        async invoke() {
          return { data: null, error: new Error('edge unavailable') };
        },
      },
    },
  };

  await cleanupLiveTestAccounts({
    admin,
    users: [user],
    errors,
    label: 'Harness user cleanup',
    errorKind: (error) => error.message,
  });

  assert.deepEqual(errors, [
    'Harness user cleanup deletion failed: edge unavailable',
    'Harness user cleanup auth absence verification failed: LIVE_ACCOUNT_STILL_PRESENT',
  ]);
  assert.equal(errors.length > 0 ? 'fail' : 'pass', 'fail');
  assert.deepEqual(authLookups, [userId, userId]);
});

test('cleanup remains best-effort across users and verifies post-delete auth absence', async () => {
  const errors = [];
  const present = new Set([
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ]);
  const deletionCalls = [];
  const authLookups = [];
  const admin = {
    auth: {
      admin: {
        async getUserById(id) {
          authLookups.push(id);
          if (present.has(id)) return { data: { user: { id } }, error: null };
          return {
            data: { user: null },
            error: { code: 'user_not_found', message: 'User not found' },
          };
        },
      },
    },
  };
  const users = [...present].map((id, index) => ({
    id,
    client: {
      functions: {
        async invoke() {
          deletionCalls.push(id);
          if (index === 0) return { data: null, error: new Error('first delete failed') };
          present.delete(id);
          return { data: VALID_RESPONSE, error: null };
        },
      },
    },
  }));

  await cleanupLiveTestAccounts({
    admin,
    users,
    errors,
    errorKind: (error) => error.message,
  });

  assert.deepEqual(
    deletionCalls,
    users.map((user) => user.id),
  );
  assert.deepEqual(authLookups, [users[0].id, users[0].id, users[1].id, users[1].id]);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /first delete failed/);
  assert.match(errors[1], /LIVE_ACCOUNT_STILL_PRESENT/);
});

test('typed auth absence skips deletion while verification errors fail closed', async () => {
  let deletionCalls = 0;
  const absentAdmin = {
    auth: {
      admin: {
        async getUserById() {
          return {
            data: { user: null },
            error: { code: 'user_not_found', message: 'User not found' },
          };
        },
      },
    },
  };
  const absentErrors = [];
  const absentUser = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    client: {
      functions: {
        async invoke() {
          deletionCalls += 1;
          return { data: VALID_RESPONSE, error: null };
        },
      },
    },
  };

  await cleanupLiveTestAccounts({
    admin: absentAdmin,
    users: [absentUser],
    errors: absentErrors,
  });
  assert.equal(deletionCalls, 0);
  assert.deepEqual(absentErrors, []);

  await assert.rejects(
    verifyLiveTestAccountAbsent(
      {
        auth: {
          admin: {
            async getUserById() {
              return {
                data: { user: null },
                error: Object.assign(new Error('auth unavailable'), {
                  code: 'unexpected_failure',
                }),
              };
            },
          },
        },
      },
      absentUser.id,
    ),
    /auth unavailable/,
  );
});

test('live callers propagate cleanup errors before PASS artifacts and verify auth absence', async () => {
  const harnesses = [
    { path: '../phase2/supabase-rls-smoke.mjs', success: 'OK Supabase RLS smoke tests passed.' },
    { path: './live-consent-withdrawal.mjs', artifact: true },
    { path: './live-catalog-rate-limit.mjs', artifact: true },
    { path: './live-supabase-adversarial.mjs', artifact: true },
    { path: './live-revenuecat-webhook.mjs', artifact: true },
    { path: './live-edge-auth.mjs', artifact: true },
    { path: './live-data-rights.mjs', artifact: true },
  ];

  for (const harness of harnesses) {
    const source = await readFile(new URL(harness.path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /auth\.admin\.deleteUser/);
    assert.doesNotMatch(source, /deleteLiveTestAccount/);
    assert.match(source, /cleanupLiveTestAccounts/);

    const cleanupIndex = source.lastIndexOf('await cleanupLiveTestAccounts');
    const cleanupCallEnd = source.indexOf('});', cleanupIndex);
    const cleanupCallSource = source.slice(cleanupIndex, cleanupCallEnd + 3);
    const successIndex = harness.artifact
      ? source.lastIndexOf("writeArtifacts(errors.length > 0 ? 'fail' : 'pass')")
      : source.lastIndexOf(harness.success);
    assert.ok(cleanupIndex >= 0, `${harness.path}: cleanup call is missing.`);
    assert.ok(cleanupCallEnd >= 0, `${harness.path}: cleanup call is incomplete.`);
    harness.artifact
      ? assert.match(cleanupCallSource, /\berrors,/)
      : assert.match(cleanupCallSource, /\berrors:\s*cleanupErrors,/);
    assert.ok(successIndex >= 0, `${harness.path}: PASS decision is missing.`);
    assert.ok(
      cleanupIndex < successIndex,
      `${harness.path}: PASS is decided before account cleanup completes.`,
    );
  }

  const helperSource = await readFile(
    new URL('./live-account-cleanup.mjs', import.meta.url),
    'utf8',
  );
  assert.match(helperSource, /admin\.auth\.admin\.getUserById/);
  assert.match(helperSource, /auth absence verification failed/);
});
