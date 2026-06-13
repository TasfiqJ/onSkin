import * as Haptics from 'expo-haptics';

// Restrained haptics (docs/01 §8): a selection tick on card taps, a success
// notification on quiz completion and the first check-off. Failures are swallowed
// (haptics are unsupported on some devices/emulators).
export const haptics = {
  select() {
    void Haptics.selectionAsync().catch(() => {});
  },
  success() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  impact() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
};
