import { useQuery } from '@tanstack/react-query';
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { Button, StateNotice, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/cn';
import {
  readOutboxChangeRevision,
  readPhotoDeleteOutboxStatus,
  retryPhotoDeleteOutbox,
  subscribeOutboxChanges,
  type PhotoDeleteOutboxStatusRead,
} from '@/lib/offline/outbox';
import { isOwnerQueryScopeCurrent, queryKeys } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

import { PHOTO_COPY } from './copy';
import { runPhotoDeleteRetrySingleFlight } from './photoDeleteRetrySingleFlight';
import {
  createPhotoDeleteSyncStatusFixtureReader,
  photoDeleteSyncStatusQueryEnabled,
  photoDeleteSyncStatusQueryKey,
  resolvePhotoDeleteSyncStatusFixture,
  type PhotoDeleteSyncStatusFixture,
} from './photoDeleteSyncStatusFixture';

type DisplayState = PhotoDeleteOutboxStatusRead | { status: 'checking'; value: null };

function developmentFixture(): PhotoDeleteSyncStatusFixture | null {
  return resolvePhotoDeleteSyncStatusFixture({
    development: typeof __DEV__ !== 'undefined' && __DEV__,
    platform: Platform.OS,
    raw: process.env.EXPO_PUBLIC_E2E_PHOTO_DELETE_SYNC_STATUS,
  });
}

function usePhotoDeleteSyncStatus(fixture: PhotoDeleteSyncStatusFixture | null) {
  const ownerScope = useOwnerQueryScope();
  const { user } = useAuth();
  const ownerId = user?.id;
  const revision = useSyncExternalStore(
    subscribeOutboxChanges,
    readOutboxChangeRevision,
    readOutboxChangeRevision,
  );
  const [retrying, setRetrying] = useState(false);
  const retryPromiseRef = useRef<Promise<void> | null>(null);
  const fixtureInstanceId = useId();
  const readStatus = useMemo(
    () =>
      createPhotoDeleteSyncStatusFixtureReader(fixture, () =>
        readPhotoDeleteOutboxStatus(ownerScope, ownerId),
      ),
    [fixture, ownerId, ownerScope],
  );
  const queryKey = useMemo(
    () =>
      photoDeleteSyncStatusQueryKey(
        queryKeys.photoDeleteOutboxStatus(ownerScope, revision),
        fixture,
        fixtureInstanceId,
      ),
    [fixture, fixtureInstanceId, ownerScope, revision],
  );
  const statusQuery = useQuery({
    queryKey,
    queryFn: readStatus,
    enabled: photoDeleteSyncStatusQueryEnabled(fixture),
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

  const retry = useCallback((): Promise<void> => {
    if (fixture?.kind === 'static') return Promise.resolve();
    return runPhotoDeleteRetrySingleFlight(retryPromiseRef, async () => {
      setRetrying(true);
      try {
        if (state.status === 'available' && state.value.kind === 'needs_attention') {
          await retryPhotoDeleteOutbox(ownerScope, ownerId);
        }
        await refetch();
      } catch {
        // Keep queue, account, and storage details out of Progress presentation.
      } finally {
        if (isOwnerQueryScopeCurrent(ownerScope)) setRetrying(false);
      }
    });
  }, [fixture, ownerId, ownerScope, refetch, state]);

  return { retry, retrying, state };
}

export function PhotoDeleteSyncStatus({ className }: { className?: string }) {
  const fixture = useMemo(() => developmentFixture(), []);
  const { retry, retrying, state } = usePhotoDeleteSyncStatus(fixture);
  const displayedState = fixture?.kind === 'static' ? fixture.value : state;

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
          {PHOTO_COPY.deleteSync.savedTitle}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1">
          {PHOTO_COPY.deleteSync.savedBody}
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
          accessibilityLabel={PHOTO_COPY.deleteSync.syncingTitle}
          accessibilityState={{ busy: true }}
          color={colors.clay}
          size="small"
        />
        <View className="ml-3 flex-1">
          <Text variant="label" style={{ color: colors.clayDeep }}>
            {PHOTO_COPY.deleteSync.syncingTitle}
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            {PHOTO_COPY.deleteSync.syncingBody}
          </Text>
        </View>
      </View>
    );
  }

  const needsAttention =
    displayedState.status === 'available' && displayedState.value.attentionCount > 0;

  return (
    <StateNotice
      kind={needsAttention ? 'error' : 'unavailable'}
      compact
      title={
        needsAttention
          ? PHOTO_COPY.deleteSync.attentionTitle
          : PHOTO_COPY.deleteSync.unavailableTitle
      }
      body={
        needsAttention ? PHOTO_COPY.deleteSync.attentionBody : PHOTO_COPY.deleteSync.unavailableBody
      }
      className={className}
    >
      <Button
        accessibilityLabel={
          needsAttention ? PHOTO_COPY.deleteSync.retry : PHOTO_COPY.deleteSync.checkAgain
        }
        label={
          retrying
            ? PHOTO_COPY.deleteSync.retrying
            : needsAttention
              ? PHOTO_COPY.deleteSync.retry
              : PHOTO_COPY.deleteSync.checkAgain
        }
        variant="ghost"
        disabled={retrying}
        onPress={() => void retry()}
        className="mt-2"
      />
    </StateNotice>
  );
}
