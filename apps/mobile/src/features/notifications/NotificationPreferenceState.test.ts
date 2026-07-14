import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./NotificationPreferenceState.tsx', import.meta.url)),
  'utf8',
);

describe('notification preference recovery surface', () => {
  it('keeps read recovery accessible and free of raw storage details', () => {
    expect(source).toContain("loading: 'Opening notification settings...'");
    expect(source).toContain("unavailableTitle: 'Notification settings unavailable'");
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('accessibilityState={{ disabled: retrying }}');
    expect(source).toContain('min-h-[56px]');
    expect(source).not.toContain('error.message');
    expect(source).not.toContain('NOTIF_PREFS_');
  });

  it('retains and retries the last content-free preference patch', () => {
    expect(source).toContain('const lastPatch = useRef<Partial<NotifPrefs> | null>(null);');
    expect(source).toContain('lastPatch.current = { ...patch };');
    expect(source).toContain('runMutation(lastPatch.current, true);');
    expect(source).toContain("mutationTitle: 'Notification change incomplete'");
    expect(source).toContain("retryMutation: 'Try saving again'");
    expect(source).not.toContain('JSON.stringify(error)');
  });
});
