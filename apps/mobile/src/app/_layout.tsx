import '../global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { configureNotifications } from '@/features/notifications/startup';
import { OnboardingProvider } from '@/features/onboarding/OnboardingContext';
import { clearUnavailableCloudBackupPreference } from '@/features/photos/consent';
import { IntakeProvider } from '@/features/shelf/IntakeContext';
import { AppLockProvider } from '@/lib/applock/AppLockProvider';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { SessionBoundaryGate } from '@/lib/auth/SessionBoundaryGate';
import { OfflineSync } from '@/lib/offline/OfflineSync';
import { initSentry } from '@/lib/observability/sentry';
import { markStartupPhase } from '@/lib/observability/operationTiming';
import { QueryDateBoundaryObserver } from '@/lib/query/QueryDateBoundaryObserver';
import { queryClient } from '@/lib/query/queryClient';
import { PlaintextStagingStartupGate } from '@/lib/storage/PlaintextStagingStartupGate';
import { PrivateDataAvailabilityGate } from '@/lib/storage/PrivateDataAvailabilityGate';
import { useFontDecision } from '@/theme/fontLoader';

initSentry();
markStartupPhase('javascript_started');
void SplashScreen.preventAutoHideAsync();

function RootContent() {
  // Set the local-notification handler + Android channel once at startup (docs/07 §9).
  useEffect(() => {
    void configureNotifications();
  }, []);

  useEffect(() => {
    void clearUnavailableCloudBackupPreference();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <QueryDateBoundaryObserver />
      <AuthProvider>
        <SessionBoundaryGate>
          <AppLockProvider>
            <PrivateDataAvailabilityGate>
              <OnboardingProvider>
                <IntakeProvider>
                  <OfflineSync />
                  <StatusBar style="dark" />
                  <Stack screenOptions={{ headerShown: false }} />
                </IntakeProvider>
              </OnboardingProvider>
            </PrivateDataAvailabilityGate>
          </AppLockProvider>
        </SessionBoundaryGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  const fontDecisionComplete = useFontDecision();
  useState(() => {
    markStartupPhase('root_render_started');
    return true;
  });

  useEffect(() => {
    if (fontDecisionComplete) {
      markStartupPhase('font_decision_complete');
      void SplashScreen.hideAsync();
    }
  }, [fontDecisionComplete]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PlaintextStagingStartupGate>
          <RootContent />
        </PlaintextStagingStartupGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
