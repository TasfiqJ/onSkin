import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('replenishment alert server default', () => {
  it('fails closed for legacy defaults and requires a new explicit Settings opt-in', () => {
    expect(migration).toContain('alter column replenishment_alerts set default false');
    expect(migration).toContain('set replenishment_alerts = false');
    expect(migration).not.toContain('set replenishment_alerts = true');
  });
});
