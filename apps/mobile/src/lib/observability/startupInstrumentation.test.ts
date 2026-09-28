import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('startup instrumentation ownership', () => {
  it('marks each privacy-gate decision only from the gate that owns it', () => {
    expect(source('src/lib/auth/SessionBoundaryGate.tsx')).toContain(
      "markStartupPhase('authentication_hydration_complete')",
    );
    expect(source('src/lib/auth/SessionBoundaryGate.tsx')).toContain(
      "markStartupPhase('account_generation_complete')",
    );
    expect(source('src/lib/applock/AppLockProvider.tsx')).toContain(
      "markStartupPhase('app_lock_decision_complete')",
    );
    expect(source('src/lib/storage/PrivateDataAvailabilityGate.tsx')).toContain(
      "markStartupPhase('vault_decision_complete')",
    );
  });
});
