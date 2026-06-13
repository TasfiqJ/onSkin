import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { getAppLockEnabled, setAppLockEnabledStored } from './store';

// Biometric app-lock (docs/01 §5): opt-in Face ID/Touch ID to open the app —
// a trust signal for an app holding progress photos. Locks on cold start and on
// return from background when enabled.
type AppLockContextValue = {
  enabled: boolean;
  setEnabled: (v: boolean) => Promise<void>;
};

const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.paper,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 40, color: colors.ink }}>OnSkin</Text>
      <Text style={{ fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.muted }}>
        Locked — unlock to continue
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onUnlock}
        style={{ marginTop: 8, backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 }}>
        <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: colors.paper }}>Unlock</Text>
      </Pressable>
    </View>
  );
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const e = await getAppLockEnabled();
      if (!active) return;
      setEnabledState(e);
      setLocked(e); // lock immediately on cold start when enabled
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' && enabled) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  const authenticate = useCallback(() => {
    void LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock OnSkin' }).then((res) => {
      if (res.success) setLocked(false);
    });
  }, []);

  // Auto-prompt whenever we become locked.
  useEffect(() => {
    if (locked) authenticate();
  }, [locked, authenticate]);

  const setEnabled = useCallback(async (v: boolean) => {
    if (v) {
      const [hw, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hw || !enrolled) throw new Error('Biometrics are not set up on this device');
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to enable app lock' });
      if (!res.success) return;
    }
    await setAppLockEnabledStored(v);
    setEnabledState(v);
  }, []);

  const value = useMemo<AppLockContextValue>(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {loaded && locked ? <LockOverlay onUnlock={authenticate} /> : null}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider');
  return ctx;
}
