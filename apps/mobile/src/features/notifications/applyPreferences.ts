import type { NotifPrefs, NotifPrefsSaveResult } from './store';

type ApplyNotificationPreferencePatchDeps = {
  saveAndReschedule: (patch: Partial<NotifPrefs>) => Promise<NotifPrefsSaveResult>;
};

export async function applyNotificationPreferencePatch(
  patch: Partial<NotifPrefs>,
  deps: ApplyNotificationPreferencePatchDeps,
): Promise<NotifPrefs> {
  // Production persists and reconciles inside one serialized notification
  // operation. A behavioural send can therefore never cross a durable opt-out.
  const result = await deps.saveAndReschedule(patch);
  return result.prefs;
}
