import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { Button, StateNotice, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/cn';
import {
  readNotificationPreferencesOutboxStatus,
  readOutboxChangeRevision,
  retryNotificationPreferencesOutbox,
  subscribeOutboxChanges,
  type NotificationPreferencesOutboxStatusRead,
} from '@/lib/offline/outbox';
import { isOwnerQueryScopeCurrent, queryKeys } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

type DisplayState = NotificationPreferencesOutboxStatusRead | { status: 'checking'; value: null };

function developmentFixture(): NotificationPreferencesOutboxStatusRead | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || Platform.OS !== 'web') return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_NOTIFICATION_SYNC_STATUS?.trim().toLowerCase();
  if (!['saved_local', 'syncing', 'needs_attention'].includes(fixture ?? '')) return null;
  return {
    status: 'available',
    value: Object.freeze({
      kind: fixture as 'needs_attention' | 'saved_local' | 'syncing',
      pendingCount: 1,
      attentionCount: fixture === 'needs_attention' ? 1 : 0,
    }),
  };
}

function useNotificationPreferenceSyncStatus(disabled: boolean) {
  const ownerScope = useOwnerQueryScope();
  const { user } = useAuth();
  const ownerId = user?.id;
  const revision = useSyncExternalStore(
    subscribeOutboxChanges,
    readOutboxChangeRevision,
    readOutboxChangeRevision,
  );
  const [retrying, setRetrying] = useState(false);
  const statusQuery = useQuery({
    queryKey: queryKeys.notificationPreferencesOutboxStatus(ownerScope, revision),
    queryFn: () => readNotificationPreferencesOutboxStatus(ownerScope, ownerId),
    enabled: !disabled,
    networkMode: 'always',
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    placeholderData: (previous) => previous,
  });
  const { data, isError, refetch } = statusQuery;
  const state = useMemo<DisplayState>(
    () =>
      isError
        ? { status: 'unavailable', value: null }
        : (data ?? { status: 'checking', value: null }),
    [data, isError],
  );

  const retry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      if (state.status === 'available' && state.value.kind === 'needs_attention') {
        await retryNotificationPreferencesOutbox(ownerScope, ownerId);
      }
      await refetch();
    } catch {
      // Keep raw queue/storage errors out of notification settings presentation.
    } finally {
      if (isOwnerQueryScopeCurrent(ownerScope)) setRetrying(false);
    }
  }, [ownerId, ownerScope, refetch, retrying, state]);

  return { retry, retrying, state };
}

export function NotificationPreferenceSyncStatus({ className }: { className?: string }) {
  const fixture = developmentFixture();
  const { retry, retrying, state } = useNotificationPreferenceSyncStatus(fixture !== null);
  const displayedState = fixture ?? state;
  if (displayedState.status === 'checking') return null;
  if (displayedState.status === 'available' && displayedState.value.kind === 'idle') return null;

  if (displayedState.status === 'available' && displayedState.value.kind === 'saved_local') {
    return (
      <View
        accessibilityLiveRegion="polite"
        className={cn('rounded-[14px] border px-4 py-3', className)}
        style={{ backgroundColor: colors.greigeChip, borderColor: colors.hairline }}
      >
        <Text variant="label" style={{ color: colors.clayDeep }}>
          Saved locally
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1">
          Your notification choices are safe on this phone. We will sync them when a connection is
          ready.
        </Text>
      </View>
    );
  }

  if (displayedState.status === 'available' && displayedState.value.kind === 'syncing') {
    return (
      <View
        accessibilityLiveRegion="polite"
        className={cn('flex-row items-center rounded-[14px] border px-4 py-3', className)}
        style={{ backgroundColor: colors.greigeChip, borderColor: colors.hairline }}
      >
        <ActivityIndicator
          accessibilityLabel="Syncing notification settings"
          accessibilityState={{ busy: true }}
          color={colors.clay}
          size="small"
        />
        <View className="ml-3 flex-1">
          <Text variant="label" style={{ color: colors.clayDeep }}>
            Syncing notification settings
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            Your notification controls stay usable while this finishes.
          </Text>
        </View>
      </View>
    );
  }

  const deadCount = displayedState.status === 'available' ? displayedState.value.attentionCount : 0;
  const body =
    deadCount > 0
      ? `${deadCount} ${deadCount === 1 ? 'change is' : 'changes are'} still safe on this phone but could not sync.`
      : 'We could not safely read the notification sync queue. Your choices were not reset.';

  return (
    <StateNotice
      kind="error"
      compact
      title="Notification sync needs attention"
      body={body}
      className={className}
    >
      <Button
        label={retrying ? 'Trying again...' : deadCount > 0 ? 'Try sync again' : 'Check again'}
        variant="ghost"
        disabled={retrying}
        onPress={() => void retry()}
        className="mt-2"
      />
    </StateNotice>
  );
}
