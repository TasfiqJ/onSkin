import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { PausedHealthDataShell } from '@/features/healthConsent/HealthDataLifecycleGate';
import {
  readHealthDataLifecycle,
  verificationRequiredRecord,
  type HealthDataLifecycleRecord,
} from '@/features/healthConsent/lifecycleStore';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  captureAccountIdentityGeneration,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import { readLocalDataOwnership } from '@/lib/auth/sessionOwner';
import { clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { POLICY_LINKS } from '@/lib/legal/policyLinks';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';

/** Mounted directly below Auth/App Lock, never inside the health provider tree. */
export function AgeReverificationRights() {
  const { user, initializing, signOut } = useAuth();
  const owner = user?.id ?? null;
  const identity = captureAccountIdentityGeneration();
  const [revision, setRevision] = useState(0);
  const proofVersion = useRef(0);
  const [snapshot, setSnapshot] = useState<{
    owner: string;
    identity: number;
    proofVersion: number;
    record: HealthDataLifecycleRecord;
  } | null>(null);
  const [status, setStatus] = useState('Checking account access…');

  useEffect(() => {
    let current = true;
    let request = 0;
    const check = async () => {
      const token = ++request;
      const version = ++proofVersion.current;
      setSnapshot(null);
      clearActiveHealthProcessingEpoch();
      if (initializing || !owner || AppState.currentState !== 'active') return;
      try {
        const record = await runAccountGenerationOperation(async (lease) => {
          if ((await readLocalDataOwnership(owner)) !== 'match')
            throw new Error('OWNER_UNVERIFIED');
          lease.assertCurrent();
          const stored = await readHealthDataLifecycle(owner);
          lease.assertCurrent();
          return (
            stored ??
            verificationRequiredRecord({ ownerUserId: owner, reason: 'status_unavailable' })
          );
        });
        if (current && request === token && identity === captureAccountIdentityGeneration()) {
          setSnapshot({ owner, identity, record, proofVersion: version });
        }
      } catch {
        if (current && request === token)
          setStatus(
            'Account access could not be verified. Nothing was changed. Retry or contact support.',
          );
      }
    };
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      request += 1;
      proofVersion.current += 1;
      setSnapshot(null);
      clearActiveHealthProcessingEpoch();
      if (state === 'active') void check();
    });
    return () => {
      current = false;
      request += 1;
      proofVersion.current += 1;
      subscription.remove();
    };
  }, [owner, identity, initializing, revision]);

  if (snapshot && snapshot.owner === owner && snapshot.identity === identity) {
    return (
      <PausedHealthDataShell
        key={`${owner}:${identity}`}
        rightsOnly
        record={snapshot.record}
        onRecord={(record) => {
          clearActiveHealthProcessingEpoch();
          if (
            record.ownerUserId === owner &&
            identity === captureAccountIdentityGeneration() &&
            AppState.currentState === 'active' &&
            snapshot.proofVersion === proofVersion.current
          ) {
            setSnapshot({ ...snapshot, record });
          }
        }}
      />
    );
  }
  return (
    <Screen>
      <View className="flex-1 justify-center gap-3">
        <Text variant="title">Privacy &amp; account</Text>
        <Text>
          {owner
            ? status
            : 'Sign in and verify this device’s owner before using account data rights. Health features remain paused.'}
        </Text>
        <Button label="Retry account access" onPress={() => setRevision((value) => value + 1)} />
        <Button
          label="Sign out"
          variant="ghost"
          onPress={() =>
            void signOut().catch(() => setStatus('Sign out did not finish. Please retry.'))
          }
        />
        <Button
          label="Support"
          variant="ghost"
          onPress={() =>
            void openExternalHttpsUrl(POLICY_LINKS.support.url, {
              mode: 'browser',
              alertOnFailure: false,
            })
          }
        />
      </View>
    </Screen>
  );
}
