import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hasExactPostgresRehearsalBinding, hasExactPostgresMatrixBinding } from './quality-rehearsal-bindings.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflow = await readFile(join(root, '.github/workflows/quality.yml'), 'utf8');
const bindings = [
  ['catalog_curation_upgrade_0062', 'catalog-curation-0062-upgrade-postgres-rehearsal.sql'],
  ['skin_profile_upgrade_0064', 'skin-profile-0064-upgrade-postgres-rehearsal.sql'],
  ['skin_profile_upgrade_0075', 'skin-profile-0075-upgrade-postgres-rehearsal.sql'],
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

test('actual PostgreSQL matrix retains both versions and the exact step environment binding', () => {
  assert.equal(hasExactPostgresMatrixBinding(workflow), true);
});

test('a changed image, matrix, misplaced environment or optional rehearsal cannot satisfy the matrix binding', () => {
  for (const changed of [
    workflow.replace('G97_MATRIX_POSTGRES: ${{ matrix.postgres }}', 'G97_MATRIX_POSTGRES: latest'),
    workflow.replace('"postgres:${G97_MATRIX_POSTGRES}"', '"postgres:latest"'),
    workflow.replace('          - 17-alpine', '          - 16-alpine'),
    workflow.replace('      max-parallel: 2', '      max-parallel: 3'),
    workflow.replace('      fail-fast: false', '      fail-fast: true'),
    workflow.replace('      - name: Execute all isolated PostgreSQL rehearsals', '      - name: Execute all isolated PostgreSQL rehearsals\n        continue-on-error: true'),
    workflow.replace('    name: Account deletion rehearsals', '    if: false\n    name: Account deletion rehearsals'),
    workflow.replace('        env:\n          G97_MATRIX_POSTGRES:', '        wrong-env:\n          G97_MATRIX_POSTGRES:'),
  ]) assert.equal(hasExactPostgresMatrixBinding(changed), false);
});

test('ambiguous and malformed YAML cannot grant PostgreSQL matrix coverage', () => {
  for (const changed of ['', 'jobs: []', workflow.replace('      max-parallel: 2', '      max-parallel: 2\n      max-parallel: 2')]) {
    assert.equal(hasExactPostgresMatrixBinding(changed), false);
  }
});
