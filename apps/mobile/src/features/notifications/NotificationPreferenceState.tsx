import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { useNotifPrefs, useUpdateNotifPrefs } from './useNotifications';
import { resolveNotificationPreferenceViewState } from './preferenceViewState';
import type { NotifPrefs } from './store';

const COPY = {
  loading: 'Opening notification settings...',
  unavailableTitle: 'Notification settings unavailable',
  unavailableBody:
    "We couldn't safely read these settings on this device. Nothing was reset or replaced.",
  retryRead: 'Try again',
  retryingRead: 'Trying again...',
  mutationTitle: 'Notification change incomplete',
  mutationBody:
    "We couldn't finish saving and scheduling that change. Try again to make sure this device matches your choice.",
  retryMutation: 'Try saving again',
  retryingMutation: 'Trying again...',
} as const;

type ApplyPatch = (patch: Partial<NotifPrefs>) => void;

export function useNotificationPreferenceRouteState() {
  const prefsQuery = useNotifPrefs();
  const update = useUpdateNotifPrefs();
  const lastPatch = useRef<Partial<NotifPrefs> | null>(null);
  const [mutationFailed, setMutationFailed] = useState(false);

  const runMutation = useCallback(
    (patch: Partial<NotifPrefs>, retainFailure: boolean) => {
      if (update.isPending) return;
      if (!retainFailure) setMutationFailed(false);
      update.mutate(patch, {
        onError: () => setMutationFailed(true),
        onSuccess: () => {
          lastPatch.current = null;
          setMutationFailed(false);
        },
      });
    },
    [update],
  );

  const applyPatch: ApplyPatch = useCallback(
    (patch) => {
      lastPatch.current = { ...patch };
      runMutation(lastPatch.current, false);
    },
    [runMutation],
  );

  const retryLastPatch = useCallback(() => {
    if (!lastPatch.current) return;
    runMutation(lastPatch.current, true);
  }, [runMutation]);

  return {
    applyPatch,
    mutationFailed,
    mutationPending: update.isPending,
    preferenceState: resolveNotificationPreferenceViewState(prefsQuery.data, prefsQuery.isError),
    readRetrying: prefsQuery.isFetching,
    retryLastPatch,
    retryRead: () => void prefsQuery.refetch(),
  };
}

export function NotificationPreferenceAvailability({
  state,
  retrying,
  onRetry,
}: {
  state: 'loading' | 'unavailable';
  retrying: boolean;
  onRetry: () => void;
}) {
  if (state === 'loading') {
    return (
      <View accessibilityLiveRegion="polite" className="mt-8 items-center px-4 py-8">
        <Text variant="bodySm" tone="muted" className="text-center">
          {COPY.loading}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="mt-6 rounded-[18px] bg-paper-raised p-5"
    >
      <Text variant="body" className="font-sans-bold">
        {COPY.unavailableTitle}
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-2" style={{ lineHeight: 20 }}>
        {COPY.unavailableBody}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: retrying }}
        disabled={retrying}
        onPress={onRetry}
        className="mt-5 min-h-[56px] items-center justify-center rounded-pill px-5 py-3"
        style={{ backgroundColor: colors.ink, opacity: retrying ? 0.68 : 1 }}
      >
        <Text className="font-sans-semibold" style={{ color: colors.paperRaised, fontSize: 15 }}>
          {retrying ? COPY.retryingRead : COPY.retryRead}
        </Text>
      </Pressable>
    </View>
  );
}

export function NotificationPreferenceMutationFeedback({
  failed,
  retrying,
  onRetry,
}: {
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (!failed) return <></>;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="mb-2 mt-3 rounded-[14px] px-4 py-3"
      style={{ backgroundColor: colors.clayTint }}
    >
      <Text variant="bodySm" className="font-sans-bold">
        {COPY.mutationTitle}
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-1" style={{ lineHeight: 19 }}>
        {COPY.mutationBody}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: retrying }}
        disabled={retrying}
        onPress={onRetry}
        className="mt-2 min-h-[48px] items-center justify-center rounded-pill px-4 py-2"
        style={{ backgroundColor: colors.paperRaised, opacity: retrying ? 0.68 : 1 }}
      >
        <Text className="font-sans-semibold" style={{ color: colors.ink, fontSize: 14 }}>
          {retrying ? COPY.retryingMutation : COPY.retryMutation}
        </Text>
      </Pressable>
    </View>
  );
}
