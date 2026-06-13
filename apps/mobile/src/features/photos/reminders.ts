import AsyncStorage from '@react-native-async-storage/async-storage';

// Calm, opt-in weekly photo-capture reminder (docs/06 §5). This module owns only
// the PREFERENCE (local-first) and the copy lives in copy.ts (PHOTO_COPY.reminder).
// The actual scheduling/delivery — at a consistent time of day, timed with the
// skin-cycle scheduler (docs/05) — is delivered by Document 7's reminder system,
// not invented here. A missed week never breaks anything (the calm-streak ethos).
const KEY = 'onskin.photos.reminderWeekly';

export async function getPhotoReminderEnabled(): Promise<boolean> {
  try {
    // Default ON is the doc's "gentle nudge" posture, but it only fires once doc #7
    // wires delivery and the OS notification permission is granted.
    const v = await AsyncStorage.getItem(KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export async function setPhotoReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? '1' : '0');
}
