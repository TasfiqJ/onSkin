import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, StateLoading, StateNotice } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors } from '@/theme/tokens';

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
        backgroundColor: colors.cream,
      }}
    >
      {status === 'pending' ? (
        <StateLoading label="Preparing private storage" />
      ) : (
        <StateNotice
          kind="error"
          presentation="plain"
          align="center"
          title="Private storage needs attention"
          body="OnSkin stayed closed because private storage could not be prepared safely. Try again before continuing."
          style={{ width: '100%', maxWidth: 420 }}
        >
          <Button
            accessibilityLabel="Retry preparing private storage"
            className="mt-6"
            label="Try again"
            onPress={onRetry}
          />
        </StateNotice>
      )}
    </View>
  );
}
