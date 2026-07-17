#!/usr/bin/env node
import assert from 'node:assert/strict';
import { AuthApiError, StorageApiError } from '@supabase/supabase-js';

import {
  AUTHENTICATED_CATALOG_TABLES,
  HEALTH_PURPOSE_READ_FENCED_TABLES,
  HarnessAssertionError,
  OWNER_LINKED_PRIVATE_TABLES,
  PRIVATE_PUBLIC_TABLES,
  SEALED_SERVICE_PRIVATE_TABLES,
  SERVICE_ONLY_PRIVATE_TABLES,
  authUserMissing,
  deniedInsertResult,
  deniedReadOrMutationResult,
  exactEmptyRows,
  exactPostgresErrorResult,
  harnessErrorDetail,
  redactedErrorKind,
  stableErrorCode,
  storageAccessDenied,
  storageDeniedResult,
  storageObjectMissing,
  sqlPolicyStatement,
  tableClassificationIssues,
} from './lib.mjs';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function issueKeys(issues) {
  return issues.map((issue) => `${issue.kind}:${issue.table}`).sort();
}

const canonicalClassifications = [
  ['owner-linked private', OWNER_LINKED_PRIVATE_TABLES],
  ['service-only private', SERVICE_ONLY_PRIVATE_TABLES],
  ['sealed service-only private', SEALED_SERVICE_PRIVATE_TABLES],
  ['authenticated catalog/editorial', AUTHENTICATED_CATALOG_TABLES],
];
const canonicalTables = [
  ...OWNER_LINKED_PRIVATE_TABLES,
  ...SERVICE_ONLY_PRIVATE_TABLES,
  ...SEALED_SERVICE_PRIVATE_TABLES,
  ...AUTHENTICATED_CATALOG_TABLES,
];

test('canonical table inventory is exhaustive and duplicate-free', () => {
  assert.equal(canonicalTables.length, 80);
  assert.equal(OWNER_LINKED_PRIVATE_TABLES.length, 30);
  assert.equal(HEALTH_PURPOSE_READ_FENCED_TABLES.length, 27);
  assert.equal(new Set(HEALTH_PURPOSE_READ_FENCED_TABLES).size, 27);
  assert(
    HEALTH_PURPOSE_READ_FENCED_TABLES.every((table) => OWNER_LINKED_PRIVATE_TABLES.includes(table)),
  );
  assert(
    ['profiles', 'consents', 'entitlements'].every(
      (table) => !HEALTH_PURPOSE_READ_FENCED_TABLES.includes(table),
    ),
  );
  assert.equal(SERVICE_ONLY_PRIVATE_TABLES.length, 8);
  assert.equal(SEALED_SERVICE_PRIVATE_TABLES.length, 20);
  assert.deepEqual(
    [
      'catalog_sources',
      'catalog_import_batches',
      'catalog_quality_reports',
      'health_consent_copy_registry',
      'health_consent_copy_review_events',
      'health_dependent_consent_operations',
      'health_dependent_consent_states',
      'apple_auth_lifecycles',
      'apple_auth_capture_operations',
      'apple_auth_server_events',
    ].filter((table) => !SEALED_SERVICE_PRIVATE_TABLES.includes(table)),
    [],
  );
  assert.equal(new Set(canonicalTables).size, 80);
  assert.deepEqual(PRIVATE_PUBLIC_TABLES, [
    ...OWNER_LINKED_PRIVATE_TABLES,
    ...SERVICE_ONLY_PRIVATE_TABLES,
    ...SEALED_SERVICE_PRIVATE_TABLES,
  ]);
  assert.equal(new Set(PRIVATE_PUBLIC_TABLES).size, 58);
  assert.equal(
    PRIVATE_PUBLIC_TABLES.filter((table) => !SEALED_SERVICE_PRIVATE_TABLES.includes(table)).length,
    38,
  );
  assert.deepEqual(
    tableClassificationIssues({
      createdTables: canonicalTables,
      rlsTables: canonicalTables,
      classifications: canonicalClassifications,
    }),
    [],
  );
});

test('named SQL policy extraction cannot cross a statement boundary', () => {
  const source = `
    create policy "insert_guard" on storage.objects
      as restrictive for insert to authenticated
      with check (bucket_id = 'photos');
    create policy "update_guard" on storage.objects
      as restrictive for update to authenticated
      using (is_anonymous = false)
      with check (has_current_consent('photo_cloud_backup'));
  `;
  const insert = sqlPolicyStatement(source, 'insert_guard');
  const update = sqlPolicyStatement(source, 'update_guard');
  assert.match(insert, /on\s+storage\.objects/i);
  assert.match(insert, /as\s+restrictive/i);
  assert.match(insert, /for\s+insert/i);
  assert.match(insert, /to\s+authenticated/i);
  assert.doesNotMatch(insert, /is_anonymous|has_current_consent/i);
  assert.match(update, /on\s+storage\.objects/i);
  assert.match(update, /as\s+restrictive/i);
  assert.match(update, /for\s+update/i);
  assert.match(update, /to\s+authenticated/i);
  assert.match(update, /is_anonymous/);
  assert.equal(sqlPolicyStatement(source, 'missing_guard'), null);
});

test('classification validator detects an unclassified discovered table', () => {
  const issues = tableClassificationIssues({
    createdTables: [...canonicalTables, 'rogue_table'],
    rlsTables: [...canonicalTables, 'rogue_table'],
    classifications: canonicalClassifications,
  });
  assert.deepEqual(issueKeys(issues), ['unclassified:rogue_table']);
});

test('classification validator detects duplicate classification', () => {
  const issues = tableClassificationIssues({
    createdTables: canonicalTables,
    rlsTables: canonicalTables,
    classifications: [...canonicalClassifications, ['accidental duplicate', ['profiles']]],
  });
  assert.deepEqual(issueKeys(issues), ['duplicate:profiles']);
});

test('classification validator detects stale and RLS-disabled entries', () => {
  const stale = tableClassificationIssues({
    createdTables: canonicalTables,
    rlsTables: canonicalTables,
    classifications: [...canonicalClassifications, ['stale', ['ghost_table']]],
  });
  assert.deepEqual(issueKeys(stale), ['stale:ghost_table']);

  const rlsDisabled = tableClassificationIssues({
    createdTables: canonicalTables,
    rlsTables: canonicalTables.filter((table) => table !== 'profiles'),
    classifications: canonicalClassifications,
  });
  assert.deepEqual(issueKeys(rlsDisabled), ['rls-disabled:profiles']);
});

test('PostgREST denial predicates accept only 42501 or exact empty rows', () => {
  const denied = { data: null, error: { code: '42501' } };
  assert.equal(deniedInsertResult(denied), true);
  assert.equal(deniedReadOrMutationResult(denied), true);
  assert.equal(deniedReadOrMutationResult({ data: [], error: null }), true);
  assert.equal(deniedInsertResult({ data: [], error: null }), false);
  assert.equal(deniedReadOrMutationResult({ data: null, error: null }), false);
  assert.equal(deniedReadOrMutationResult({ data: [{ id: 1 }], error: null }), false);

  for (const code of ['23505', '23514', '42P01', 'PGRST204']) {
    assert.equal(deniedInsertResult({ data: null, error: { code } }), false);
    assert.equal(deniedReadOrMutationResult({ data: null, error: { code } }), false);
  }
  assert.equal(deniedInsertResult({ data: null, error: new TypeError('network') }), false);
  assert.equal(deniedInsertResult({ data: null, error: { code: 'NETWORK_ERROR' } }), false);
});

test('exact PostgreSQL predicates do not conflate constraints and RLS', () => {
  assert.equal(exactPostgresErrorResult({ error: { code: '23505' } }, '23505'), true);
  assert.equal(exactPostgresErrorResult({ error: { code: '23514' } }, '23514'), true);
  assert.equal(exactPostgresErrorResult({ error: { code: '23514' } }, '42501'), false);
  assert.equal(exactPostgresErrorResult({ error: null }, '42501'), false);
  assert.equal(stableErrorCode({ code: 'P0001' }), 'P0001');
  assert.equal(stableErrorCode({ code: 'PGRST204' }), 'PGRST204');
  assert.equal(stableErrorCode({ code: 'NETWORK_ERROR' }), null);
  assert.equal(exactEmptyRows([]), true);
  assert.equal(exactEmptyRows(null), false);
});

test('Storage denial predicates distinguish RLS from malformed auth and outages', () => {
  const accessDenied = new StorageApiError('secret', 403, 'AccessDenied');
  const legacyAccessDenied = new StorageApiError('secret', 403, '403');
  const legacyUnauthorized = new StorageApiError('secret', 403, 'unauthorized');
  const hidden = new StorageApiError('secret', 404, 'NoSuchKey');
  const legacyHidden = new StorageApiError('secret', 404, '404');

  for (const error of [accessDenied, legacyAccessDenied, legacyUnauthorized]) {
    assert.equal(storageAccessDenied(error), true);
    assert.equal(storageDeniedResult({ data: null, error }), true);
  }
  assert.equal(storageAccessDenied(hidden), false);
  assert.equal(storageAccessDenied(hidden, { allowNotFound: true }), true);
  assert.equal(storageAccessDenied(legacyHidden, { allowNotFound: true }), true);
  assert.equal(storageObjectMissing(hidden), true);
  assert.equal(storageObjectMissing(legacyHidden), true);

  for (const error of [
    new StorageApiError('secret', 400, 'InvalidRequest'),
    new StorageApiError('secret', 401, 'InvalidJWT'),
    new StorageApiError('secret', 404, 'NoSuchBucket'),
    new StorageApiError('secret', 409, 'ResourceAlreadyExists'),
    new StorageApiError('secret', 500, 'InternalError'),
    Object.assign(new Error('secret'), { name: 'StorageUnknownError' }),
    new TypeError('secret'),
  ]) {
    assert.equal(storageAccessDenied(error, { allowNotFound: true }), false);
    assert.equal(storageDeniedResult({ data: null, error }, { allowNotFound: true }), false);
  }

  assert.equal(storageDeniedResult({ data: [], error: null }), false);
  assert.equal(storageDeniedResult({ data: [], error: null }, { allowEmpty: true }), true);
  assert.equal(storageDeniedResult({ data: null, error: null }, { allowEmpty: true }), false);
  assert.equal(
    storageDeniedResult({ data: [{ name: 'object' }], error: null }, { allowEmpty: true }),
    false,
  );
});

test('Auth cleanup verification accepts only an exact typed missing-user result', () => {
  const missing = {
    data: { user: null },
    error: new AuthApiError('secret', 404, 'user_not_found'),
  };
  assert.equal(authUserMissing(missing), true);
  assert.equal(
    authUserMissing({
      data: { user: null },
      error: new AuthApiError('secret', 500, 'unexpected_failure'),
    }),
    false,
  );
  assert.equal(
    authUserMissing({
      data: { user: { id: 'still-present' } },
      error: new AuthApiError('secret', 404, 'user_not_found'),
    }),
    false,
  );
  assert.equal(authUserMissing({ data: { user: null }, error: new TypeError('network') }), false);
});

test('evidence redaction retains only authored assertions and stable error kinds', () => {
  const secret = 'SECRET_SENTINEL user@example.invalid https://private.invalid/token';
  const postgrestError = Object.assign(new Error(secret), {
    name: 'PostgrestError',
    code: '42501',
    details: secret,
    hint: secret,
  });
  const storageError = new StorageApiError(secret, 403, 'AccessDenied');
  const forgedAssertion = Object.assign(new Error(secret), { name: 'HarnessAssertionError' });
  const authoredAssertion = new HarnessAssertionError('safe authored assertion');

  const outputs = [
    redactedErrorKind(postgrestError),
    redactedErrorKind(storageError),
    redactedErrorKind(new TypeError(secret)),
    redactedErrorKind({ message: secret, details: secret, hint: secret }),
    redactedErrorKind({ code: '23514', message: secret }),
    redactedErrorKind({ code: secret, message: secret }),
    harnessErrorDetail(forgedAssertion),
    harnessErrorDetail(authoredAssertion),
  ];

  assert.deepEqual(outputs, [
    'code:42501',
    'http:403',
    'TypeError',
    'object',
    'code:23514',
    'object',
    'HarnessAssertionError',
    'safe authored assertion',
  ]);
  assert.equal(
    outputs.some((output) => output.includes(secret)),
    false,
  );
});

for (const { name, run } of tests) {
  try {
    await run();
  } catch (error) {
    console.error(`FAIL ${name}: ${harnessErrorDetail(error)}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(`OK Phase 9 RLS adversarial contract smoke passed (${tests.length} checks).`);
}
