import { Pressable, View } from 'react-native';

import { NotificationPreferenceSaveError } from './applyPreferences';

import { Text } from '@/components/ui';

export function NotificationPreferenceSaveNotice({ pending, onRetry, error }: {
  pending: boolean;
  error?: unknown;
  onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert" className="mb-3 rounded-card bg-paper-raised p-4">
      <Text variant="bodySm">
        {error instanceof NotificationPreferenceSaveError
          ? 'Your preferences are saved, but reminders were not confirmed. Try again. OS delivery is not guaranteed.'
          : 'Your preferences may be saved, but reminders were not confirmed. Try again.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try saving reminder preferences again"
        disabled={pending}
        onPress={onRetry}
        className="min-h-[48px] justify-center"
      >
        <Text variant="bodySm" className="font-sans-semibold">Try again</Text>
      </Pressable>
    </View>
  );
}

export function NotificationPreferenceSavedNotice({ scheduling }: {
  scheduling: import('./deliver').ReminderScheduleOutcome;
}) {
  const copy = {
    scheduled: 'Preferences saved. Reminders scheduled; OS delivery is not guaranteed.',
    disabled: 'Preferences saved. Routine and photo reminders are off.',
    permission_denied: 'Preferences saved. OS permission does not allow reminder delivery.',
    web_preferences_only: 'Preferences saved on this browser. Native reminder scheduling is unavailable here.',
    admission_closed: 'Preferences saved. Reminder scheduling is unavailable.',
  };
  return <Text accessibilityLiveRegion="polite" variant="bodySm">{copy[scheduling]}</Text>;
}
