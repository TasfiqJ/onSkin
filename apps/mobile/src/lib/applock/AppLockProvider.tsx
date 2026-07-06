import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Alert, AppState, Pressable, Text, View, type AppStateStatus } from 'react-native';

import { appLockUserMessage } from '@/lib/errors/userFacing';
import { colors } from '@/theme/tokens';

import { authenticateAppLock, canUseAppLock } from './authenticate';
import { shouldLockForAppState, shouldShowPrivacyShieldForAppState } from './privacyState';
import { getAppLockEnabled, setAppLockEnabledStored } from './store';

// Biometric app-lock (docs/01 §5): opt-in device authentication to open the app,
// a trust signal for an app holding progress photos. Locks on cold start and on
// app-switch/background transitions when enabled. A generic shield also hides
// health-adjacent UI from OS app-switcher snapshots even when app lock is off.
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
      }}
    >
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 40, color: colors.ink }}>
        OnSkin
      </Text>
      <Text style={{ fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.muted }}>
        Locked. Unlock to continue
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onUnlock}
        style={{
          marginTop: 8,
          backgroundColor: colors.ink,
          borderRadius: 999,
          paddingHorizontal: 28,
          paddingVertical: 14,
        }}
      >
        <Text
          style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: colors.paper }}
        >
          Unlock
        </Text>
      </Pressable>
    </View>
  );
}

function PrivacyShield() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        elevation: 999,
        backgroundColor: colors.paper,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 40, color: colors.ink }}>
        OnSkin
      </Text>
    </View>
  );
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

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
      setAppState(s);
      if (shouldLockForAppState(s, enabled)) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  const authenticate = useCallback(() => {
    void authenticateAppLock('Unlock OnSkin').then((status) => {
      if (status === 'success') setLocked(false);
      else if (status === 'unavailable') Alert.alert('App lock', appLockUserMessage());
    });
  }, []);

  // Auto-prompt whenever we are active and locked. Do not launch biometrics while
  // the OS is taking an app-switcher snapshot or the app is backgrounded.
  useEffect(() => {
    if (locked && appState === 'active') authenticate();
  }, [locked, appState, authenticate]);

  const setEnabled = useCallback(async (v: boolean) => {
    if (v) {
      const ready = await canUseAppLock();
      if (!ready) throw new Error('App lock unavailable');
      const status = await authenticateAppLock('Confirm to enable app lock');
      if (status === 'unavailable') throw new Error('App lock unavailable');
      if (status !== 'success') return;
    }
    await setAppLockEnabledStored(v);
    setEnabledState(v);
  }, []);

  const value = useMemo<AppLockContextValue>(
    () => ({ enabled, setEnabled }),
    [enabled, setEnabled],
  );
  const showPrivacyShield = shouldShowPrivacyShieldForAppState(appState);

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {showPrivacyShield ? <PrivacyShield /> : null}
      {!showPrivacyShield && loaded && locked ? <LockOverlay onUnlock={authenticate} /> : null}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider');
  return ctx;
}
