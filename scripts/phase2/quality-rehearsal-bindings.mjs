import { parseDocument } from 'yaml';

export function hasExactPostgresRehearsalBinding(workflow, database, script) {
  const runners = [
    ...workflow.matchAll(
      /while IFS='\|' read -r database script; do[\s\S]*?psql -U postgres -d "\$database" -v ON_ERROR_STOP=1 -f "\$script"[\s\S]*?done <<'REHEARSALS'\r?\n(?<rows>[\s\S]*?)^[ \t]*REHEARSALS[ \t]*$/gmu,
    ),
  ];
  if (runners.length !== 1 || !runners[0].groups?.rows) return false;

  const rows = runners[0].groups.rows
    .trim()
    .split(/\r?\n/u)
    .map((row) => row.trim());
  if (!rows.every((row) => /^[a-z0-9_]+\|[a-z0-9-]+\.sql$/u.test(row))) return false;

  const matches = rows.filter((row) => row.startsWith(`${database}|`));
  return matches.length === 1 && matches[0] === `${database}|${script}`;
}

// Preserve the exact two PostgreSQL versions while resolving the matrix value
// through the reviewed step environment instead of interpolating Bash source.
export function hasExactPostgresMatrixBinding(workflow) {
  try {
    const document = parseDocument(workflow, { strict: true, uniqueKeys: true, merge: false });
    if (document.errors.length || document.warnings.length) return false;
    const job = document.toJS({ maxAliasCount: 0 }).jobs?.['account-deletion-postgres'];
    const keys = (value, expected) => value && Object.keys(value).sort().join() === [...expected].sort().join();
    if (!keys(job, ['name', 'runs-on', 'strategy', 'steps']) || job['runs-on'] !== 'ubuntu-latest') return false;
    const strategy = job.strategy;
    if (!keys(strategy, ['fail-fast', 'max-parallel', 'matrix']) || strategy['fail-fast'] !== false || strategy['max-parallel'] !== 2 || !keys(strategy.matrix, ['postgres'])) return false;
    if (!Array.isArray(strategy.matrix.postgres) || strategy.matrix.postgres.join() !== '15-alpine,17-alpine') return false;
    const candidates = job.steps.filter((step) => step.name === 'Execute all isolated PostgreSQL rehearsals');
    if (candidates.length !== 1) return false;
    const step = candidates[0];
    return keys(step, ['name', 'env', 'run']) && keys(step.env, ['G97_MATRIX_POSTGRES']) &&
      step.env.G97_MATRIX_POSTGRES === '${{ matrix.postgres }}' &&
      typeof step.run === 'string' && step.run.includes('"postgres:${G97_MATRIX_POSTGRES}"');
  } catch {
    return false;
  }
}
