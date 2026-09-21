import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hasExactPostgresRehearsalBinding } from './quality-rehearsal-bindings.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflow = await readFile(join(root, '.github/workflows/quality.yml'), 'utf8');
const bindings = [
  ['catalog_curation_upgrade_0062', 'catalog-curation-0062-upgrade-postgres-rehearsal.sql'],
  ['skin_profile_upgrade_0064', 'skin-profile-0064-upgrade-postgres-rehearsal.sql'],
  ['catalog_operator_upgrade_0065', 'catalog-operator-0065-upgrade-postgres-rehearsal.sql'],
  ['clinical_content_upgrade_0066', 'clinical-content-0066-upgrade-postgres-rehearsal.sql'],
  [
    'catalog_release_lint_contract_0067',
    'catalog-release-0067-lint-contract-postgres-rehearsal.sql',
  ],
];

test('the PostgreSQL quality job binds the exact database and script', () => {
  for (const [name, script] of bindings) {
    assert.equal(hasExactPostgresRehearsalBinding(workflow, name, script), true, name);
  }
});

test('renamed, removed, and duplicate rehearsal rows fail closed', () => {
  for (const [name, script] of bindings) {
    const row = `${name}|${script}`;
    assert.equal(
      hasExactPostgresRehearsalBinding(workflow.replace(row, `${name}|other.sql`), name, script),
      false,
      name,
    );
    assert.equal(
      hasExactPostgresRehearsalBinding(workflow.replace(row, ''), name, script),
      false,
      name,
    );
    assert.equal(
      hasExactPostgresRehearsalBinding(
        workflow.replace(row, `${row}\n          ${row}`),
        name,
        script,
      ),
      false,
      name,
    );
  }
});

test('a detached or malformed here-document cannot satisfy the binding', () => {
  const [name, script] = bindings[1];
  assert.equal(
    hasExactPostgresRehearsalBinding(
      workflow.replace("done <<'REHEARSALS'", "done <<'OTHER'"),
      name,
      script,
    ),
    false,
  );
  assert.equal(
    hasExactPostgresRehearsalBinding(
      workflow.replace("while IFS='|' read -r database script; do", 'while false; do'),
      name,
      script,
    ),
    false,
  );
  assert.equal(
    hasExactPostgresRehearsalBinding(
      workflow.replace(`${name}|${script}`, `${name} ${script}`),
      name,
      script,
    ),
    false,
  );
});
