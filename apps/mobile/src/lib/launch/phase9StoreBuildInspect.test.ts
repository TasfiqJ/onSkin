import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(
  new URL('../../../../../scripts/phase9/store-build-inspect.mjs', import.meta.url),
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
});
