import type { NotifPrefs } from './store';

type ApplyNotificationPreferencePatchDeps = {
  save: (patch: Partial<NotifPrefs>) => Promise<NotifPrefs>;
  reschedule: (prefs: NotifPrefs) => Promise<void>;
};

export async function applyNotificationPreferencePatch(
  patch: Partial<NotifPrefs>,
  deps: ApplyNotificationPreferencePatchDeps,
): Promise<NotifPrefs> {
  const next = await deps.save(patch);
  await deps.reschedule(next);
  return next;
}
