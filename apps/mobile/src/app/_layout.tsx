import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { configureNotifications } from '@/features/notifications/deliver';
import { clearUnavailableCloudBackupPreference } from '@/features/photos/consent';
import { AppLockProvider } from '@/lib/applock/AppLockProvider';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { OfflineSync } from '@/lib/offline/OfflineSync';
import { initSentry } from '@/lib/observability/sentry';
import { queryClient } from '@/lib/query/queryClient';
import { PrivateDataAvailabilityGate } from '@/lib/storage/PrivateDataAvailabilityGate';
import { fontMap } from '@/theme/fonts';

initSentry();
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontMap);

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Set the local-notification handler + Android channel once at startup (docs/07 §9).
  useEffect(() => {
    void configureNotifications();
  }, []);

  useEffect(() => {
    void clearUnavailableCloudBackupPreference();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppLockProvider>
              <PrivateDataAvailabilityGate>
                <OfflineSync />
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }} />
              </PrivateDataAvailabilityGate>
            </AppLockProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
