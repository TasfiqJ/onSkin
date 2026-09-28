import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const version = 'ask-advisor-2026-06-14-placeholder';
const mobilePath = join(repoRoot, 'apps/mobile/src/lib/consent/dependentConsentContract.ts');
const edgePath = join(repoRoot, 'supabase/functions/consent-withdrawal/granularWithdrawalCore.ts');
const migrationPath = join(
  repoRoot,
  'supabase/migrations/20260921000074_ask_consent_rebrand_hash_alignment.sql',
);

function declaredValue(sourceText, path, identifier) {
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((item) => ts.isIdentifier(item.name) && item.name.text === identifier);
  assert.ok(declaration?.initializer, `${identifier} must exist in ${path}`);
  return declaration.initializer;
}

function objectValue(expression) {
  let current = expression;
  while (
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    (ts.isCallExpression(current) && current.expression.getText() === 'Object.freeze')
  ) {
    current = ts.isCallExpression(current) ? current.arguments[0] : current.expression;
  }
  assert.ok(ts.isObjectLiteralExpression(current), 'consent contract must be an object literal');
  return current;
}

function propertyValue(object, name) {
  const property = object.properties.find(
    (item) => ts.isPropertyAssignment(item) && item.name.getText().replaceAll("'", '') === name,
  );
  assert.ok(property && ts.isPropertyAssignment(property), `${name} must exist`);
  return property.initializer;
}

function stringValue(expression) {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    return stringValue(expression.left) + stringValue(expression.right);
  }
  throw new Error('consent copy must be an exact string literal or literal concatenation');
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stagingCalls(migration) {
  return [
    ...migration.matchAll(
      /from public\.stage_health_consent_copy_draft_successor\(([\s\S]*?)\)\s*;/gu,
    ),
  ].map((match) => [...match[1].matchAll(/'([^']*)'/gu)].map((value) => value[1]));
}

function stagingDigest(fields) {
  const serialized =
    'health-consent-draft-successor:v1' +
    fields
      .slice(0, 8)
      .map((value) => `|${Buffer.byteLength(value, 'utf8')}:${value}`)
      .join('');
  return sha256(serialized);
}

test('0074 stages only exact displayed Ask consent hashes without rewriting history or approving grants', async () => {
  const [mobile, edge, migration, initial, earlier] = await Promise.all([
    readFile(mobilePath, 'utf8'),
    readFile(edgePath, 'utf8'),
    readFile(migrationPath, 'utf8'),
    readFile(
      join(repoRoot, 'supabase/migrations/20260715000054_health_consent_withdrawal_lifecycle.sql'),
      'utf8',
    ),
    readFile(
      join(
        repoRoot,
        'supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql',
      ),
      'utf8',
    ),
  ]);

  const mobileAsk = objectValue(
    propertyValue(
      objectValue(declaredValue(mobile, mobilePath, 'HEALTH_DEPENDENT_CONSENT_COPY')),
      'ask_layerwell',
    ),
  );
  const edgeAsk = objectValue(
    propertyValue(
      objectValue(declaredValue(edge, edgePath, 'CURRENT_GRANULAR_WITHDRAWAL_COPY_CONTRACT')),
      'ask_layerwell',
    ),
  );
  const contracts = new Map();
  for (const [action, mobileAction] of [
    ['grant', 'grant'],
    ['withdraw', 'withdrawal'],
  ]) {
    const copy = objectValue(propertyValue(mobileAsk, mobileAction));
    const text = stringValue(propertyValue(copy, 'text'));
    const pinned = stringValue(propertyValue(copy, 'sha256'));
    assert.equal(stringValue(propertyValue(copy, 'version')), version);
    assert.match(text, /ask_layerwell/u);
    assert.equal(pinned, sha256(text), `${action} must hash exact displayed copy`);
    contracts.set(action, { text, hash: pinned });
  }

  assert.equal(stringValue(propertyValue(edgeAsk, 'version')), version);
  assert.equal(stringValue(propertyValue(edgeAsk, 'text')), contracts.get('withdraw').text);
  assert.equal(stringValue(propertyValue(edgeAsk, 'hash')), contracts.get('withdraw').hash);
  assert.equal(stringValue(propertyValue(edgeAsk, 'reviewStatus')), 'draft_blocked');

  const calls = stagingCalls(migration);
  assert.equal(calls.length, 2, 'grant and withdrawal require separate durable staging receipts');
  const expectedPredecessors = {
    grant: '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
    withdraw: '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff',
  };
  for (const fields of calls) {
    assert.equal(fields.length, 9);
    const [
      type,
      action,
      previousVersion,
      previousHash,
      nextVersion,
      nextHash,
      reference,
      stagedBy,
      digest,
    ] = fields;
    assert.equal(type, 'ask_layerwell');
    assert.ok(action === 'grant' || action === 'withdraw');
    assert.equal(previousVersion, version);
    assert.equal(previousHash, expectedPredecessors[action]);
    assert.equal(nextVersion, version);
    assert.equal(nextHash, contracts.get(action).hash);
    assert.equal(
      reference,
      `DB-MIGRATION-20260921000074-ASK-${action.toUpperCase()}-HASH-CORRECTION`,
    );
    assert.equal(stagedBy, 'migration:20260921000074');
    assert.equal(
      digest,
      stagingDigest(fields),
      `${action} staging evidence must derive from exact fields`,
    );
  }
  assert.deepEqual(calls.map((fields) => fields[1]).sort(), ['grant', 'withdraw']);
  assert.ok(
    initial.includes(expectedPredecessors.withdraw),
    'the installed withdrawal tuple is preserved',
  );
  assert.ok(earlier.includes(expectedPredecessors.grant), 'the 0070 successor is preserved');
  assert.doesNotMatch(
    migration,
    /public\.promote_health_consent_copy_for_release|public\.supersede_health_consent_copy_for_release|update\s+public\.health_consent_copy_registry/iu,
  );
});
