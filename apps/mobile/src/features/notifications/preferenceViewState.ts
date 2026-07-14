import type { NotifPrefs, NotifPrefsRead } from './store';

export type NotificationPreferenceViewState =
  | { status: 'loading' }
  | { status: 'ready'; prefs: NotifPrefs }
  | { status: 'unavailable' };

/**
 * Route-facing projection of the typed private preference read. Only genuine
 * absence and a successfully decoded record may expose editable controls.
 */
export function resolveNotificationPreferenceViewState(
  read: NotifPrefsRead | undefined,
  queryFailed = false,
): NotificationPreferenceViewState {
  if (queryFailed) return { status: 'unavailable' };
  if (!read) return { status: 'loading' };
  if (read.status === 'absent' || read.status === 'available') {
    return { status: 'ready', prefs: read.prefs };
  }
  return { status: 'unavailable' };
}
