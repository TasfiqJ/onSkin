import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Pressable, Text, View, type AppStateStatus } from 'react-native';

import { BRAND } from '@/lib/brand';
import { appLockUserMessage } from '@/lib/errors/userFacing';
import { colors } from '@/theme/tokens';

import {
  PHOTO_TIMELINE_PROMPT,
  authenticateAppLock,
  canUseAppLock,
  type AppLockAuthStatus,
} from './authenticate';
import { shouldLockForAppState, shouldShowPrivacyShieldForAppState } from './privacyState';
import {
  clearMalformedAppLockPreference,
  getAppLockEnabled,
  isRepairableAppLockPreferenceError,
  setAppLockEnabledStored,
} from './store';

// Biometric app-lock (docs/01 §5): opt-in device authentication to open the app,
// a trust signal for an app holding progress photos. Locks on cold start and on
// app-switch/background transitions when enabled. A generic shield also hides
// health-adjacent UI from OS app-switcher snapshots even when app lock is off.
type AppLockContextValue = {
  appUnlocked: boolean;
  enabled: boolean;
  photoTimelineUnlocked: boolean;
  setEnabled: (v: boolean) => Promise<void>;
  unlockPhotoTimeline: () => Promise<AppLockAuthStatus>;
};

const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

function LockOverlay({
  onUnlock,
  feedback,
  repairRequired,
}: {
  onUnlock: () => void;
  feedback: string | null;
  repairRequired: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        elevation: 1000,
        backgroundColor: colors.paper,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingHorizontal: 28,
      }}
    >
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 40, color: colors.ink }}>
        {BRAND.appName}
      </Text>
      <Text style={{ fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.muted }}>
        {repairRequired
          ? "The app-lock setting couldn't be read. Unlock this phone to reset only that setting."
          : 'Locked. Unlock to continue'}
      </Text>
      {feedback ? (
        <View
          style={{
            maxWidth: 320,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.hairlineStrong,
            backgroundColor: colors.clayTint,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text
            accessibilityRole="alert"
            style={{
              fontFamily: 'HankenGrotesk_400Regular',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
              color: colors.clayDeep,
            }}
          >
            {feedback}
          </Text>
        </View>
      ) : null}
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
          {repairRequired ? 'Unlock and reset app lock' : 'Unlock'}
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
        {BRAND.appName}
      </Text>
    </View>
  );
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockFeedback, setLockFeedback] = useState<string | null>(null);
  const [preferenceRepairRequired, setPreferenceRepairRequired] = useState(false);
  const [photoTimelineUnlocked, setPhotoTimelineUnlocked] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const e = await getAppLockEnabled();
        if (!active) return;
        setEnabledState(e);
        setLocked(e); // lock immediately on cold start when enabled
      } catch (error) {
        if (!active) return;
        // An unreadable encrypted preference must not expose data as if lock were off.
        setPreferenceRepairRequired(isRepairableAppLockPreferenceError(error));
        setEnabledState(true);
        setLocked(true);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setAppState(s);
      if (shouldLockForAppState(s, enabled)) {
        setLocked(true);
        setPhotoTimelineUnlocked(false);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const requestUnlock = useCallback(() => {
    void (async () => {
      const status = await authenticateAppLock(BRAND.appLockPrompt);
      if (status === 'success') {
        if (preferenceRepairRequired) {
          try {
            await clearMalformedAppLockPreference();
          } catch {
            setLockFeedback('App lock could not be reset. Try again.');
            return;
          }
          setPreferenceRepairRequired(false);
          setEnabledState(false);
        }
        setLockFeedback(null);
        setLocked(false);
      } else if (status === 'unavailable') {
        setLockFeedback(appLockUserMessage());
      }
    })();
  }, [preferenceRepairRequired]);

  const authenticate = useCallback(() => {
    setLockFeedback(null);
    requestUnlock();
  }, [requestUnlock]);

  const unlockPhotoTimeline = useCallback(async (): Promise<AppLockAuthStatus> => {
    const status = await authenticateAppLock(PHOTO_TIMELINE_PROMPT);
    if (status === 'success') setPhotoTimelineUnlocked(true);
    return status;
  }, []);

  // Auto-prompt whenever we are active and locked. Do not launch biometrics while
  // the OS is taking an app-switcher snapshot or the app is backgrounded.
  useEffect(() => {
    if (locked && appState === 'active' && !preferenceRepairRequired) requestUnlock();
  }, [locked, appState, preferenceRepairRequired, requestUnlock]);

  const setEnabled = useCallback(async (v: boolean) => {
    if (v) {
      const ready = await canUseAppLock();
      if (!ready) throw new Error('App lock unavailable');
      const status = await authenticateAppLock('Confirm to enable app lock');
      if (status === 'unavailable') throw new Error('App lock unavailable');
      if (status !== 'success') return;
    }
    await setAppLockEnabledStored(v);
    setLockFeedback(null);
    setPreferenceRepairRequired(false);
    setEnabledState(v);
    setPhotoTimelineUnlocked(false);
    if (!v) setLocked(false);
  }, []);

  const value = useMemo<AppLockContextValue>(
    () => ({
      appUnlocked: loaded && !locked,
      enabled,
      photoTimelineUnlocked,
      setEnabled,
      unlockPhotoTimeline,
    }),
    [enabled, loaded, locked, photoTimelineUnlocked, setEnabled, unlockPhotoTimeline],
  );
  const showPrivacyShield = shouldShowPrivacyShieldForAppState(appState);

  return (
    <AppLockContext.Provider value={value}>
      {loaded ? children : null}
      {showPrivacyShield || !loaded ? <PrivacyShield /> : null}
      {!showPrivacyShield && loaded && locked ? (
        <LockOverlay
          feedback={lockFeedback}
          onUnlock={authenticate}
          repairRequired={preferenceRepairRequired}
        />
      ) : null}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider');
  return ctx;
}
