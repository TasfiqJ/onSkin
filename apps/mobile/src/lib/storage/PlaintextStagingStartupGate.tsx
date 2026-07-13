import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth/AuthProvider';

import { preparePrivateStorageForSession } from './privateStorageStartup';

type StartupScavengeResult = 'ready' | 'failed';

function settledStartup(pending: Promise<void>): Promise<StartupScavengeResult> {
  return pending.then(
    () => 'ready',
    () => 'failed',
  );
}

export function PlaintextStagingStartupGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [attempt, setAttempt] = useState(0);

  return (
    <PrivateStorageStartupAttempt
      key={JSON.stringify([userId, attempt])}
      userId={userId}
      onRetry={() => setAttempt((value) => value + 1)}
    >
      {children}
    </PrivateStorageStartupAttempt>
  );
}

function PrivateStorageStartupAttempt({
  children,
  onRetry,
  userId,
}: {
  children: ReactNode;
  onRetry: () => void;
  userId: string | null;
}) {
  const [status, setStatus] = useState<'pending' | StartupScavengeResult>('pending');

  useEffect(() => {
    let active = true;
    void settledStartup(preparePrivateStorageForSession(userId)).then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  if (status === 'ready') return children;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingHorizontal: 32,
        backgroundColor: '#F4EFE7',
      }}
    >
      {status === 'pending' ? (
        <>
          <ActivityIndicator color="#201B15" />
          <Text style={{ color: '#625B52', textAlign: 'center' }}>Preparing private storage</Text>
        </>
      ) : (
        <>
          <View accessibilityRole="alert">
            <Text
              style={{ color: '#201B15', fontSize: 20, fontWeight: '600', textAlign: 'center' }}
            >
              Private storage needs attention
            </Text>
            <Text style={{ color: '#625B52', lineHeight: 21, marginTop: 8, textAlign: 'center' }}>
              OnSkin stayed closed because private storage could not be prepared safely. Try again
              before continuing.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={{
              minHeight: 52,
              minWidth: 160,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: '#201B15',
              paddingHorizontal: 24,
            }}
          >
            <Text style={{ color: '#F4EFE7', fontSize: 16, fontWeight: '600' }}>Try again</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
