import '../global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { lazy, Suspense, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { configureNotifications } from '@/features/notifications/startup';
import { statusBarStyleForSurface } from '@/theme/systemBarPolicy';
import { OnboardingProvider } from '@/features/onboarding/OnboardingContext';
import { prepareSensitiveImageDiskCacheMigration } from '@/features/photos/sensitiveImageDiskCache';
import { IntakeProvider } from '@/features/shelf/IntakeContext';
import { AppLockProvider } from '@/lib/applock/AppLockProvider';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { SessionBoundaryGate } from '@/lib/auth/SessionBoundaryGate';
import { OfflineSync } from '@/lib/offline/OfflineSync';
import { initSentry } from '@/lib/observability/sentry';
import { markStartupPhase } from '@/lib/observability/operationTiming';
import { StartupNavigationObserver } from '@/lib/observability/StartupNavigationObserver';
import { QueryDateBoundaryObserver } from '@/lib/query/QueryDateBoundaryObserver';
import { queryClient } from '@/lib/query/queryClient';
import { PlaintextStagingStartupGate } from '@/lib/storage/PlaintextStagingStartupGate';
import { PrivateDataAvailabilityGate } from '@/lib/storage/PrivateDataAvailabilityGate';
import { useFontDecision } from '@/theme/fontLoader';

initSentry();
markStartupPhase('javascript_started');
// Privacy migration only: older builds could have inherited expo-image's disk
// cache default. PhotoImage also gates decrypt until this scrub proves complete.
void prepareSensitiveImageDiskCacheMigration();
void SplashScreen.preventAutoHideAsync();

// Keep root notification handler startup minimal. Business-store/scheduling
// code is evaluated as a deferred module after the private-data boundary mounts.
const NotificationPreferenceScheduleReconciler = lazy(
  () => import('@/features/notifications/NotificationPreferenceScheduleReconciler'),
);

function RootContent() {
  // Set the local-notification handler + Android channel once at startup (docs/07 §9).
  useEffect(() => {
    void configureNotifications();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <QueryDateBoundaryObserver />
      <AuthProvider>
        <SessionBoundaryGate>
          <PlaintextStagingStartupGate>
            <AppLockProvider>
              <PrivateDataAvailabilityGate>
                <StartupNavigationObserver />
                <Suspense fallback={null}>
                  <NotificationPreferenceScheduleReconciler />
                </Suspense>
                <OnboardingProvider>
                  <IntakeProvider>
                    <OfflineSync />
                    <StatusBar style={statusBarStyleForSurface('paper')} />
                    <Stack screenOptions={{ headerShown: false }} />
                  </IntakeProvider>
                </OnboardingProvider>
              </PrivateDataAvailabilityGate>
            </AppLockProvider>
          </PlaintextStagingStartupGate>
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
        <RootContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
