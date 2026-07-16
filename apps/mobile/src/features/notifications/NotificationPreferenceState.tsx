import { useCallback, useRef, useState } from 'react';
import { Button, StateLoading, StateNotice } from '@/components/ui';

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
      <StateLoading label={COPY.loading} className="mt-8 px-4 py-8" />
    );
  }

  return (
    <StateNotice
      kind="unavailable"
      className="mt-6"
      title={COPY.unavailableTitle}
      body={COPY.unavailableBody}
    >
      <Button
        accessibilityLabel="Retry loading notification settings"
        className="mt-5"
        disabled={retrying}
        label={retrying ? COPY.retryingRead : COPY.retryRead}
        onPress={onRetry}
      />
    </StateNotice>
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
    <StateNotice
      kind="error"
      compact
      className="mb-2 mt-3"
      title={COPY.mutationTitle}
      body={COPY.mutationBody}
    >
      <Button
        accessibilityLabel="Retry saving notification settings"
        className="mt-2 min-h-[48px] py-2"
        disabled={retrying}
        label={retrying ? COPY.retryingMutation : COPY.retryMutation}
        onPress={onRetry}
        variant="ghost"
      />
    </StateNotice>
  );
}
