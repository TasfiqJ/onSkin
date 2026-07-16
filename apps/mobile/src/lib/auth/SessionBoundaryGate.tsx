import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, StateLoading, StateNotice, Text } from '@/components/ui';
import { markStartupPhase } from '@/lib/observability/operationTiming';
import { colors } from '@/theme/tokens';

import { useAuth } from './AuthProvider';
import {
  getAccountIsolationE2EFixture,
  readAccountIsolationE2EStorageProof,
  type AccountIsolationE2EStorageProof,
} from './accountIsolationE2E';

const COPY = {
  loading: 'Securing account data...',
  eyebrow: 'Account change paused',
  title: 'Your private data could not be secured.',
  body: 'App content remains locked while OnSkin verifies or finishes clearing local private data. Try again to continue safely.',
  retry: 'Try again',
} as const;

export function SessionBoundaryGate({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { initializing, sessionBoundaryError, retrySessionBoundary } = useAuth();
  const e2eFixture = useMemo(() => getAccountIsolationE2EFixture(), []);
  const [e2eStorageProof, setE2EStorageProof] =
    useState<AccountIsolationE2EStorageProof | null>(null);
  const [e2eStorageProofReadFailed, setE2EStorageProofReadFailed] = useState(false);

  useEffect(() => {
    if (initializing || sessionBoundaryError) return;
    markStartupPhase('authentication_hydration_complete');
    markStartupPhase('account_generation_complete');
  }, [initializing, sessionBoundaryError]);

  useEffect(() => {
    if (!sessionBoundaryError || e2eFixture?.mode !== 'owner_marker_future') return;
    let active = true;
    void readAccountIsolationE2EStorageProof(e2eFixture).then(
      (proof) => {
        if (active) {
          setE2EStorageProof(proof);
          setE2EStorageProofReadFailed(false);
        }
      },
      () => {
        if (active) {
          setE2EStorageProof(null);
          setE2EStorageProofReadFailed(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [e2eFixture, sessionBoundaryError]);

  const retryBoundary = async () => {
    setE2EStorageProof(null);
    setE2EStorageProofReadFailed(false);
    await retrySessionBoundary();
  };

  if (!initializing && !sessionBoundaryError) return children;

  if (!sessionBoundaryError) {
    return (
      <View
        accessibilityLabel={COPY.loading}
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center px-7"
        style={{ backgroundColor: colors.paper }}
      >
        <StateLoading label={COPY.loading} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <StateNotice
        kind="unavailable"
        presentation="plain"
        align="center"
        title={COPY.title}
        body={COPY.body}
        accessibilityLabel={`${COPY.eyebrow}. ${COPY.title}`}
      >
        {e2eFixture?.mode === 'owner_marker_future' ? (
          <Text
            variant="label"
            className="mt-4 text-center"
            style={{ color: colors.clayDeep }}
          >
            {e2eStorageProofReadFailed
              ? 'Recovery fixture could not verify local storage; no change or cleanup is inferred.'
              : !e2eStorageProof
                ? 'Checking recovery fixture storage...'
                : e2eStorageProof.ownerMarkerPreserved &&
                  e2eStorageProof.privateRecordPreserved &&
                  e2eStorageProof.cleanupMarkerAbsent
                  ? 'Recovery fixture verified: unknown owner bytes and a representative private sentinel are unchanged; cleanup did not start.'
                  : 'Recovery fixture failed: local bytes changed or cleanup started.'}
          </Text>
        ) : null}
        <Button
          accessibilityLabel="Retry securing account data"
          className="mt-7"
          label={COPY.retry}
          onPress={() => void retryBoundary()}
        />
      </StateNotice>
    </ScrollView>
  );
}
