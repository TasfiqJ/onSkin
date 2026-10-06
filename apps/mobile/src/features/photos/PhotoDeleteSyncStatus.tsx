import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  captureHealthDataWriteLease,
  assertHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
} from '@/lib/consent/healthProcessingEpoch';

import { PHOTO_COPY } from './copy';
import { getPhotoDeleteStatus, retryPhotoDeletes, type PhotoDeleteStatus } from './store';
import { subscribePhotoDeleteChanges } from './photoDeleteJournal';
import { runPhotoDeleteRetrySingleFlight } from './photoDeleteRetrySingleFlight';

export function photoDeleteAuthorityKey(): string {
  const lease = activeHealthProcessingLeaseSnapshot();
  return lease === null
    ? 'closed'
    : JSON.stringify([lease.ownerUserId, lease.generation, lease.epoch, lease.accountGeneration]);
}

/** Aggregate, path-free recovery only. Mounted inside the existing entitlement,
 * lock and photo-storage gates on both empty and populated Progress surfaces. */
export function PhotoDeleteSyncStatus({ tone = 'paper' }: { tone?: 'paper' | 'night' }) {
  const key = useSyncExternalStore(
    subscribeActiveHealthProcessingLeaseChanges,
    photoDeleteAuthorityKey,
    () => 'closed',
  );
  return key === 'closed' ? null : (
    <PhotoDeleteSyncStatusForLease key={key} authorityKey={key} tone={tone} />
  );
}

function PhotoDeleteSyncStatusForLease({
  authorityKey: key,
  tone,
}: {
  authorityKey: string;
  tone: 'paper' | 'night';
}) {
  const color = tone === 'night' ? '#F4EFE7' : '#29231D';
  const { user } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<{
    key: string;
    status: PhotoDeleteStatus | null;
    failed: boolean;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const flight = useRef<Promise<void> | null>(null);
  const refresh = useRef<() => Promise<void>>(async () => undefined);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let sequence = 0;
    let disposed = false;
    const read = async () => {
      const version = ++sequence;
      try {
        const lease = captureHealthDataWriteLease();
        const status = await getPhotoDeleteStatus();
        assertHealthDataWriteLease(lease);
        if (!disposed && version === sequence && photoDeleteAuthorityKey() === key)
          setState({ key, status, failed: false });
      } catch {
        if (!disposed && version === sequence && photoDeleteAuthorityKey() === key)
          setState({ key, status: null, failed: true });
      }
    };
    refresh.current = read;
    void read();
    const unsubscribe = subscribePhotoDeleteChanges(() => {
      void read();
    });
    return () => {
      disposed = true;
      mounted.current = false;
      unsubscribe();
    };
  }, [key]);
  const current = state?.key === key ? state : null;
  if (key === 'closed' || current === null) return null;
  if (!current.failed && current.status?.localPending === 0 && current.status.remotePending === 0)
    return null;

  const retry = () => {
    if (photoDeleteAuthorityKey() !== key) return;
    void runPhotoDeleteRetrySingleFlight(flight, async () => {
      setRetrying(true);
      try {
        const lease = captureHealthDataWriteLease();
        if (current.failed) await refresh.current();
        else {
          await retryPhotoDeletes(user?.id ?? null);
          assertHealthDataWriteLease(lease);
          await qc.invalidateQueries({ queryKey: ['photos'] });
          assertHealthDataWriteLease(lease);
          await refresh.current();
        }
      } catch {
        // The journal retains the operation; a failure never means deleted data
        // was restored. Keep the same visible manual recovery action.
        if (mounted.current && photoDeleteAuthorityKey() === key) {
          setState((previous) =>
            previous?.key === key
              ? previous.status === null
                ? { ...previous, failed: true }
                : {
                    ...previous,
                    status: { ...previous.status, needsAttention: true },
                    failed: false,
                  }
              : previous,
          );
        }
      } finally {
        if (mounted.current && photoDeleteAuthorityKey() === key) setRetrying(false);
      }
    });
  };
  const localPending = (current.status?.localPending ?? 0) > 0;
  const title = current.failed
    ? PHOTO_COPY.deleteSync.unavailableTitle
    : localPending || current.status?.needsAttention
      ? PHOTO_COPY.deleteSync.attentionTitle
      : PHOTO_COPY.deleteSync.savedTitle;
  const body = current.failed
    ? PHOTO_COPY.deleteSync.unavailableBody
    : localPending
      ? 'Protected local deletion cleanup is not finished. Try again to safely check and finish it. No photo images are uploaded.'
      : current.status?.needsAttention
        ? PHOTO_COPY.deleteSync.attentionBody
        : PHOTO_COPY.deleteSync.savedBody;
  return (
    <View accessibilityLiveRegion="polite"
      accessibilityRole={current.failed || localPending || current.status?.needsAttention ? 'alert' : undefined}
      accessibilityState={{ busy: retrying }} style={{ padding: 16, gap: 8 }}>
      <Text variant="label" style={{ color }}>
        {title}
      </Text>
      <Text variant="bodySm" style={{ color }}>
        {body}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={current.failed ? PHOTO_COPY.deleteSync.checkAgain : PHOTO_COPY.deleteSync.retry}
        accessibilityState={{ disabled: retrying, busy: retrying }}
        disabled={retrying}
        onPress={retry}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Text style={{ color }}>
          {retrying
            ? PHOTO_COPY.deleteSync.retrying
            : current.failed
              ? PHOTO_COPY.deleteSync.checkAgain
              : PHOTO_COPY.deleteSync.retry}
        </Text>
      </Pressable>
    </View>
  );
}
