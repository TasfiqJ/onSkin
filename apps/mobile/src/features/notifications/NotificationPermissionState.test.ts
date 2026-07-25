import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const component = readFileSync(
  fileURLToPath(new URL('./NotificationPermissionState.tsx', import.meta.url)),
  'utf8',
);
const route = readFileSync(
  fileURLToPath(new URL('../../app/settings/notifications.tsx', import.meta.url)),
  'utf8',
);

describe('notification permission recovery surface', () => {
  it('uses the shared focus lifecycle without creating another AppState listener', () => {
    expect(component).toContain('useIsFocused()');
    expect(component).toContain("queryKey: NOTIFICATION_PERMISSION_QUERY_KEY");
    expect(component).toContain("refetchOnMount: 'always'");
    expect(component).toContain("refetchOnWindowFocus: 'always'");
    expect(component).toContain("networkMode: 'always'");
    expect(component).not.toContain('AppState.addEventListener');
  });

  it('requires an explicit action and exposes accessible 48px recovery controls', () => {
    expect(component).toContain('requestNotificationPermissionSnapshot()');
    expect(component).toContain("openAppSettings({ alertOnFailure: false })");
    expect(component).toContain("className=\"mt-2 min-h-[48px] py-2\"");
    expect(component).toContain("'Allow notifications'");
    expect(component).toContain("'Open notification settings'");
    expect(component).toContain("'Retry notification access'");
    expect(component).not.toContain('Alert.alert');
  });

  it('preserves saved delivery intent and keeps the calibrated settings rows above recovery', () => {
    expect(route).toContain('<NotificationPermissionState');
    expect(route).toContain('onPermissionRecovered={preference.retryRead}');
    expect(route).toContain('const activeTrialReminderIntent = Boolean(');
    expect(route).toContain('activeTrialReminderIntent;');
    expect(route).not.toContain('reconcileEntitlementTrialReminder');
    expect(route).toContain('p?.amEnabled === true');
    expect(route).toContain('p?.promotionalOptIn === true');
    expect(route).not.toContain('p?.liveActivityEnabled === true');
    expect(route.indexOf('title="Tips &amp; announcements"')).toBeLessThan(
      route.indexOf('<NotificationPermissionState'),
    );
    expect(route.indexOf('<NotificationPermissionState')).toBeLessThan(
      route.indexOf('{SETTINGS_COPY.capNote}'),
    );
  });

  it('suppresses stale focus/action completions and only recovers on a grant transition', () => {
    expect(component).toContain('actionAttempt.current += 1');
    expect(component).toContain('recoveryAttempt.current += 1');
    expect(component).toContain('!mounted.current || attempt !== actionAttempt.current');
    expect(component).toContain('<FocusedNotificationPermissionState {...props} />');
    expect(component).toContain("nextStatus !== 'granted'");
    expect(component).toContain("previousStatus === 'granted'");
  });

  it('recovers from action failures without nesting alert regions or leaving the control busy', () => {
    expect(component.match(/<StateNotice/g)).toHaveLength(1);
    expect(component).toContain("kind={actionFailure ? 'error' : 'unavailable'}");
    expect(component).toContain('detail={actionFailure}');
    expect(component).toContain('setActionFailure(COPY.promptFailure)');
    expect(component).toContain(
      "requested.status === 'unavailable' || requested.status === 'undetermined'",
    );
    expect(component).toContain('setActionFailure(COPY.settingsFailure)');
    expect(component).toContain(
      'if (mounted.current && attempt === actionAttempt.current) setBusy(false)',
    );
  });
});
