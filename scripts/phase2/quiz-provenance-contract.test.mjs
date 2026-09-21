import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contract = readFileSync('apps/mobile/src/features/onboarding/quizContract.ts', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20260921000075_skin_profile_quiz_contract_successor.sql',
  'utf8',
);
const review = readFileSync('docs/phase-3/quiz-fto-summary.md', 'utf8');

function constant(name) {
  const value = contract.match(new RegExp(`export const ${name} =\\s*'([^']+)'`, 'u'))?.[1];
  assert.ok(value, `missing ${name} in quizContract.ts`);
  return value;
}

function migrationTuples() {
  const result = [];
  const starts = [...migration.matchAll(/quiz_contract_id = '([^']+)'/gu)];
  for (const [index, start] of starts.entries()) {
    const snippet = migration.slice(start.index, starts[index + 1]?.index ?? migration.length);
    const field = (name) => {
      const value = snippet.match(new RegExp(`${name} =\\s*'([^']+)'`, 'u'))?.[1];
      assert.ok(value, `missing ${name} in migration tuple ${index + 1}`);
      return value;
    };
    result.push({
      id: start[1],
      contentVersion: field('quiz_content_version'),
      scoringVersion: field('quiz_scoring_version'),
      contentSha256: field('quiz_content_sha256'),
      scoringSha256: field('quiz_scoring_sha256'),
      contractSha256: field('quiz_contract_sha256'),
    });
  }
  return result;
}

test('forward SQL admits only the exact old, interim, and current canonical quiz tuples', () => {
  const tuples = migrationTuples();
  assert.deepEqual(tuples, [
    {
      id: 'urn:routinekind:onboarding:skin-profile',
      contentVersion: 'draft-2026-07-04',
      scoringVersion: 'draft-1',
      contentSha256: 'be00ee6008ca03fbcb53e7256432cd044e6131e9aecd5bf90809b2a57cde39bb',
      scoringSha256: 'ffd16579edad35b21377244c41af69419248faa3f8f2238183c58a5a8893c893',
      contractSha256: '95022003f5dfa1fff5e95b846a9d48ef6ecc9dc97af341fb311afaa9aadd1c16',
    },
    {
      id: 'urn:layerwell:onboarding:skin-profile',
      contentVersion: 'draft-2026-07-04',
      scoringVersion: 'draft-1',
      contentSha256: '8398b025f7ebfa8cd823c180ba6d98475554b82651970b569c736d662c7c7f2f',
      scoringSha256: 'be3a05c5c9494d0976868c4d4e34c4c71fd01b8be19f9207e0198b930e1b982a',
      contractSha256: 'c434e4f031d2d9d18218a0ccddcecf3fff182e8208367375aee16c574c814007',
    },
    {
      id: constant('QUIZ_CONTRACT_ID'),
      contentVersion: constant('QUIZ_CONTENT_VERSION'),
      scoringVersion: constant('QUIZ_SCORING_VERSION'),
      contentSha256: constant('QUIZ_CONTENT_SHA256'),
      scoringSha256: constant('QUIZ_SCORING_SHA256'),
      contractSha256: constant('QUIZ_CONTRACT_SHA256'),
    },
  ]);
  assert.equal(new Set(tuples.map((tuple) => tuple.contractSha256)).size, 3);
});

test('forward constraint is non-validating, atomic, and never upgrades review status', () => {
  assert.match(
    migration,
    /begin;[\s\S]*add constraint skin_profiles_quiz_v2_provenance_coherent_successor[\s\S]*not valid;[\s\S]*drop constraint skin_profiles_quiz_v2_provenance_coherent;[\s\S]*rename constraint skin_profiles_quiz_v2_provenance_coherent_successor[\s\S]*commit;/u,
  );
  assert.match(migration, /and quiz_review_status = 'launch-blocked'/u);
  assert.doesNotMatch(
    migration,
    /\b(?:update|delete from|truncate)\s+(?:table\s+)?public\.skin_profiles\b/iu,
  );
  for (const value of [
    constant('QUIZ_CONTENT_VERSION'),
    constant('QUIZ_SCORING_VERSION'),
    constant('QUIZ_CONTENT_SHA256'),
    constant('QUIZ_SCORING_SHA256'),
    constant('QUIZ_CONTRACT_SHA256'),
  ]) {
    assert.ok(review.includes(value), `review packet must name ${value}`);
  }
  assert.match(review, /launch-blocked pending exact-hash IP\/legal and clinical review/u);
});
