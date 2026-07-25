import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Button, StateNotice } from '@/components/ui';
import { openAppSettings } from '@/lib/navigation/appSettings';

import { SETTINGS_COPY } from './copy';
import {
  getNotificationPermissionSnapshot,
  notificationPermissionRecoveryAction,
  requestNotificationPermissionSnapshot,
} from './permission';

const COPY = SETTINGS_COPY.permissionRecovery;

export const NOTIFICATION_PERMISSION_QUERY_KEY = ['notificationPermission'] as const;

type NotificationPermissionStateProps = {
  deliveryIntent: boolean;
  onPermissionRecovered: () => Promise<unknown> | unknown;
};

function FocusedNotificationPermissionState({
  deliveryIntent,
  onPermissionRecovered,
}: NotificationPermissionStateProps) {
  const mounted = useRef(true);
  const actionAttempt = useRef(0);
  const recoveryAttempt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [actionFailure, setActionFailure] = useState<string | null>(null);
  const permissionQuery = useQuery({
    queryKey: NOTIFICATION_PERMISSION_QUERY_KEY,
    queryFn: getNotificationPermissionSnapshot,
    enabled: deliveryIntent,
    networkMode: 'always',
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  const observedStatus = useRef(permissionQuery.data?.status ?? null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      actionAttempt.current += 1;
      recoveryAttempt.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!deliveryIntent || permissionQuery.isFetching || !permissionQuery.data) return;
    const nextStatus = permissionQuery.data.status;
    const previousStatus = observedStatus.current;
    observedStatus.current = nextStatus;
    if (nextStatus !== 'granted' || previousStatus === null || previousStatus === 'granted') return;

    const attempt = ++recoveryAttempt.current;
    void Promise.resolve(onPermissionRecovered()).catch(() => undefined).finally(() => {
      if (!mounted.current || attempt !== recoveryAttempt.current) return;
    });
  }, [
    deliveryIntent,
    onPermissionRecovered,
    permissionQuery.data,
    permissionQuery.isFetching,
  ]);

  if (!deliveryIntent || permissionQuery.isFetching) return null;

  const snapshot = permissionQuery.data;
  const action = notificationPermissionRecoveryAction(snapshot);
  if (action === null) return null;

  const runAction = async () => {
    if (busy) return;
    const attempt = ++actionAttempt.current;
    setBusy(true);
    setActionFailure(null);
    try {
      if (action === 'open_settings') {
        const opened = await openAppSettings({ alertOnFailure: false });
        if (!mounted.current || attempt !== actionAttempt.current) return;
        if (!opened) setActionFailure(COPY.settingsFailure);
        return;
      }
      try {
        if (action === 'request') {
          const requested = await requestNotificationPermissionSnapshot();
          if (requested.status === 'unavailable' || requested.status === 'undetermined') {
            setActionFailure(COPY.promptFailure);
          }
        }
      } catch {
        if (!mounted.current || attempt !== actionAttempt.current) return;
        setActionFailure(COPY.promptFailure);
      }
      await permissionQuery.refetch();
    } catch {
      if (!mounted.current || attempt !== actionAttempt.current) return;
      setActionFailure(action === 'open_settings' ? COPY.settingsFailure : COPY.promptFailure);
    } finally {
      if (mounted.current && attempt === actionAttempt.current) setBusy(false);
    }
  };

  const mustOpenSettings = action === 'open_settings';
  const unavailable = action === 'retry';
  const title = unavailable
    ? COPY.unavailableTitle
    : mustOpenSettings
      ? COPY.deniedTitle
      : COPY.askTitle;
  const body = unavailable
    ? COPY.unavailableBody
    : mustOpenSettings
      ? COPY.deniedBody
      : COPY.askBody;

  return (
    <StateNotice
      accessibilityLabel={actionFailure ?? undefined}
      kind={actionFailure ? 'error' : 'unavailable'}
      compact
      className="mt-16"
      title={title}
      body={body}
      detail={actionFailure}
    >
      <Button
        accessibilityLabel={
          action === 'request'
            ? 'Allow notifications'
            : action === 'open_settings'
              ? 'Open notification settings'
              : 'Retry notification access'
        }
        className="mt-2 min-h-[48px] py-2"
        disabled={busy}
        label={
          busy
            ? 'Working...'
            : action === 'request'
              ? 'Allow notifications'
              : action === 'open_settings'
                ? 'Open settings'
                : 'Try again'
        }
        onPress={() => void runAction()}
        variant="ghost"
      />
    </StateNotice>
  );
}

export function NotificationPermissionState(props: NotificationPermissionStateProps) {
  const isFocused = useIsFocused();
  if (!props.deliveryIntent || !isFocused) return null;
  return <FocusedNotificationPermissionState {...props} />;
}
