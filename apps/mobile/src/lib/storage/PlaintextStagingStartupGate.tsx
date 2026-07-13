import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { scavengePlaintextStaging } from './plaintextStaging';

type StartupScavengeResult = 'ready' | 'failed';

function settledScavenge(pending: Promise<number>): Promise<StartupScavengeResult> {
  return pending.then(
    () => 'ready',
    () => 'failed',
  );
}

// Module evaluation starts the first serialized coordinator operation. Children
// that can reserve plaintext do not mount until it succeeds, so a producer can
// never enqueue ahead of startup scavenging.
const startupScavengeResult = settledScavenge(scavengePlaintextStaging());

export function PlaintextStagingStartupGate({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(startupScavengeResult);
  const [status, setStatus] = useState<'pending' | StartupScavengeResult>('pending');

  useEffect(() => {
    let active = true;
    void attempt.then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (status === 'ready') return children;

  const retry = () => {
    setStatus('pending');
    setAttempt(settledScavenge(scavengePlaintextStaging()));
  };

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
              OnSkin stayed closed because temporary private files could not be cleared. Try again
              before continuing.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
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
