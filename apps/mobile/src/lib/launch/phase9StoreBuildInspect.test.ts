import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const SCRIPT_PATH = fileURLToPath(
  new URL('../../../../../scripts/phase9/store-build-inspect.mjs', import.meta.url),
);
const RELEASE_SMOKE_PATH = fileURLToPath(
  new URL('../../../../../scripts/phase9/release-smoke.mjs', import.meta.url),
);
const PACKAGE_JSON_PATH = fileURLToPath(new URL('../../../../../package.json', import.meta.url));
const GENERATED_INSPECTION_PATH = fileURLToPath(
  new URL('../../../../../docs/phase-9/generated/store-build-inspection.json', import.meta.url),
);

function readStoreBuildInspectScript(): string {
  return readFileSync(SCRIPT_PATH, 'utf8');
}

describe('Phase 9 store build inspection contract', () => {
  it('keeps final production identity as non-strict evidence while strict mode blocks it', () => {
    const script = readStoreBuildInspectScript();

    expect(script).toMatch(/import \{[\s\S]*\bstrict\b[\s\S]*\} from '\.\/lib\.mjs';/);
    expect(script).toContain('/BRAND_LEGAL_CLEARANCE=cleared/');
    expect(script).toContain('/explicit final native identity env values/');
    expect(script).toContain(
      'if (!strict && isProductionIdentityConfigBlock(variant, variantResults[variant].error))',
    );
    expect(script).toContain(
      'Resolved production app config blocked until BRAND_LEGAL_CLEARANCE=cleared and explicit final native identity env values are supplied.',
    );
    expect(script).toContain('block(errors, false, message);');
  });

  it('keeps strict RC inspection check-only and leaves the worktree unchanged', () => {
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const releaseSmoke = readFileSync(RELEASE_SMOKE_PATH, 'utf8');
    const beforeExists = existsSync(GENERATED_INSPECTION_PATH);
    const beforeInspection = beforeExists ? readFileSync(GENERATED_INSPECTION_PATH) : null;
    const beforeStatus = spawnSync(
      'git',
      [
        '-c',
        `safe.directory=${REPOSITORY_ROOT}`,
        'status',
        '--porcelain=v1',
        '--untracked-files=all',
      ],
      {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
      },
    );

    expect(packageJson.scripts?.['phase9:store-build-inspect:strict']).toBe(
      'node scripts/phase9/store-build-inspect.mjs --check --strict',
    );
    expect(releaseSmoke).toMatch(
      /command\(process\.execPath, \[\s*'scripts\/phase9\/store-build-inspect\.mjs',\s*'--check',\s*'--strict',?\s*\]\);/u,
    );
    expect(beforeStatus.error).toBeUndefined();
    expect(beforeStatus.status).toBe(0);

    const inspection = spawnSync(process.execPath, [SCRIPT_PATH, '--check', '--strict'], {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        PHASE9_IOS_ARCHIVE_PRIVACY_EVIDENCE_PATH: '',
        PHASE9_IOS_SOURCE_GIT_SHA: '',
        PHASE9_IOS_EAS_BUILD_ID: '',
        PHASE9_IOS_BUILD_NUMBER: '',
        PHASE9_APPLE_TEAM_ID: '',
      },
      timeout: 30_000,
    });
    const afterStatus = spawnSync(
      'git',
      [
        '-c',
        `safe.directory=${REPOSITORY_ROOT}`,
        'status',
        '--porcelain=v1',
        '--untracked-files=all',
      ],
      {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
      },
    );

    expect(inspection.error).toBeUndefined();
    expect(inspection.signal).toBeNull();
    expect([0, 1]).toContain(inspection.status);
    expect(existsSync(GENERATED_INSPECTION_PATH)).toBe(beforeExists);
    if (beforeInspection) {
      expect(readFileSync(GENERATED_INSPECTION_PATH)).toEqual(beforeInspection);
    }
    expect(afterStatus.error).toBeUndefined();
    expect(afterStatus.status).toBe(0);
    expect(afterStatus.stdout).toBe(beforeStatus.stdout);
  }, 30_000);
});
