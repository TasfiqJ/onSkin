import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const DEPLOYER = readFileSync(`${REPO_ROOT}/scripts/phase2/deploy-supabase-staging.ps1`, 'utf8');
const VERSION_GATE = readFileSync(
  `${REPO_ROOT}/scripts/phase2/supabase-cli-version-gate.ps1`,
  'utf8',
);
const CATALOG_HARNESS = readFileSync(
  `${REPO_ROOT}/scripts/optimization/catalog-search-plan-load.mjs`,
  'utf8',
);

describe('Supabase concurrent-migration deployment contract', () => {
  it('runs the version gate before every remote mutation', () => {
    const gateImport = DEPLOYER.indexOf(
      '. (Join-Path $PSScriptRoot "supabase-cli-version-gate.ps1")',
    );
    const pathResolve = DEPLOYER.indexOf('$supabaseCliPath = Resolve-SupabaseCliApplicationPath');
    const gateCall = DEPLOYER.indexOf(
      '$null = Assert-SupabaseCliMinimumVersion -CliPath $supabaseCliPath',
    );
    const firstRemoteMutation = DEPLOYER.indexOf('& $supabaseCliPath link --project-ref');

    expect(gateImport).toBeGreaterThanOrEqual(0);
    expect(pathResolve).toBeGreaterThan(gateImport);
    expect(gateCall).toBeGreaterThan(pathResolve);
    expect(firstRemoteMutation).toBeGreaterThan(gateCall);
  });

  it('uses the v2.109 non-transactional linked migration runner', () => {
    expect(DEPLOYER).toContain('& $supabaseCliPath migration up --linked');
    expect(DEPLOYER).not.toContain('supabase db push');
    expect(DEPLOYER).toContain('SUPABASE_MIGRATION_UP_FAILED');
    expect(DEPLOYER).not.toMatch(/^\s*supabase\s+\w+/m);
    expect(DEPLOYER.match(/& \$supabaseCliPath\b/g)?.length).toBeGreaterThanOrEqual(4);

    expect(VERSION_GATE).toMatch(/\[Version\]::new\(2,\s*109,\s*0\)/);
    expect(VERSION_GATE).toContain('function Resolve-SupabaseCliApplicationPath');
    expect(VERSION_GATE).toContain('-CommandType Application');
    expect(VERSION_GATE).toContain('& $CliPath --version');
  });

  it('keeps the report contract aligned without fabricating hosted replay', () => {
    expect(CATALOG_HARNESS).toContain(
      "minimum_supabase_cli_for_concurrent_index_migration: '2.109.0'",
    );
    expect(CATALOG_HARNESS).toContain(
      "staging_deployer_migration_command: 'supabase migration up --linked'",
    );
    expect(CATALOG_HARNESS).toContain('exact_staging_runner_replayed: false');
    expect(CATALOG_HARNESS).toContain("'hosted_staging_migration_runner_replay'");
  });
});
