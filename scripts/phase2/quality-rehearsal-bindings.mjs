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
