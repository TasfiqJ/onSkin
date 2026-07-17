import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Pressable, ScrollView, View, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { appLockUserMessage } from '@/lib/errors/userFacing';
import { colors } from '@/theme/tokens';
import { markStartupPhase } from '@/lib/observability/operationTiming';
import { AccountGenerationLeaseError } from '@/lib/auth/accountGeneration';

import {
  PHOTO_TIMELINE_PROMPT,
  getPresentedAppLockAuthenticationToken,
  invalidatePendingAppLockAuthentication,
  updateAppLockAuthenticationAppState,
  type AppLockAuthStatus,
} from './authenticate';
import {
  attemptAppUnlockForCurrentAccount,
  readAppLockPreferenceForCurrentAccount,
  setAppLockPreferenceForCurrentAccount,
} from './accountOperations';
import { shouldLockForAppState, shouldShowPrivacyShieldForAppState } from './privacyState';
import {
  captureAppLockInteractionLease,
  createAppLockInteractionLifecycle,
  createAppLockInteractionOwnerToken,
  isAppLockInteractionLeaseCurrent,
  releasePreservedAppLockInteractionLease,
  transitionAppLockInteractionLifecycle,
  type AppLockInteractionLease,
} from './interactionLifecycle';
import { decideAppLockPreference, type AppLockPreferenceRecovery } from './preferenceDecision';
import type { AppLockPreferenceReadResult } from './preferenceResult';
import { runSingleFlight, type SingleFlightLease } from './singleFlight';

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

const APP_LOCK_READ_COPY = {
  body: "The app-lock setting couldn't be read. Nothing was changed. Try again when this phone's secure storage is available.",
  retry: 'Try again',
  retrying: 'Trying again...',
  retryFailed: 'It is still unavailable. Your app-lock setting remains unchanged.',
} as const;

function LockOverlay({
  onUnlock,
  feedback,
  preferenceRecovery,
  retrying,
}: {
  onUnlock: () => void;
  feedback: string | null;
  preferenceRecovery: AppLockPreferenceRecovery;
  retrying: boolean;
}) {
  const insets = useSafeAreaInsets();
  const repairRequired = preferenceRecovery === 'repair';
  const retryRequired = preferenceRecovery === 'retry';
  const actionLabel = retrying
    ? 'Checking app lock...'
    : repairRequired
      ? 'Unlock and reset app lock'
      : retryRequired
        ? APP_LOCK_READ_COPY.retry
        : 'Unlock';

  return (
    <ScrollView
      accessibilityViewIsModal
      importantForAccessibility="yes"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        elevation: 1000,
        backgroundColor: colors.paper,
      }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingHorizontal: 28,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontFamily: 'InstrumentSerif-Regular', fontSize: 40, color: colors.ink }}>
        {BRAND.appName}
      </Text>
      <Text
        accessibilityLiveRegion={preferenceRecovery ? 'polite' : undefined}
        style={{
          maxWidth: 340,
          fontFamily: 'HankenGrotesk-Regular',
          fontSize: 15,
          lineHeight: 22,
          textAlign: 'center',
          color: colors.muted,
        }}
      >
        {repairRequired
          ? "The app-lock setting couldn't be read. Unlock this phone to reset only that setting."
          : retryRequired
            ? APP_LOCK_READ_COPY.body
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
              fontFamily: 'HankenGrotesk-Regular',
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
        accessibilityState={{ disabled: retrying }}
        disabled={retrying}
        onPress={onUnlock}
        style={{
          marginTop: 8,
          minHeight: 48,
          width: '100%',
          maxWidth: 340,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.ink,
          borderRadius: 999,
          paddingHorizontal: 28,
          paddingVertical: 14,
          opacity: retrying ? 0.68 : 1,
        }}
      >
        <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: colors.paper }}>
          {actionLabel}
        </Text>
      </Pressable>
    </ScrollView>
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
      <Text style={{ fontFamily: 'InstrumentSerif-Regular', fontSize: 40, color: colors.ink }}>
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
  const [preferenceRecovery, setPreferenceRecovery] = useState<AppLockPreferenceRecovery>(null);
  const [preferenceRetrying, setPreferenceRetrying] = useState(false);
  const [photoTimelineUnlocked, setPhotoTimelineUnlocked] = useState(false);

  useEffect(() => {
    if (loaded) markStartupPhase('app_lock_decision_complete');
  }, [loaded]);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const appUnlockLease = useRef<SingleFlightLease<void>>({ current: null });
  const photoTimelineUnlockLease = useRef<SingleFlightLease<AppLockAuthStatus>>({ current: null });
  const mounted = useRef(true);
  const preferenceReadAttempt = useRef(0);
  const preferenceReadInFlight = useRef(false);
  const enabledRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const interactionOwner = useRef(createAppLockInteractionOwnerToken());
  const interactionLifecycle = useRef(createAppLockInteractionLifecycle());
  const settingMutationInFlight = useRef(false);
  const preferenceRefreshPending = useRef(false);
  const autoPromptAttemptedForLock = useRef(false);

  const isInteractionCurrent = useCallback((interaction: AppLockInteractionLease) => {
    return isAppLockInteractionLeaseCurrent(
      interactionLifecycle.current,
      interactionOwner.current,
      interaction,
      appStateRef.current,
    );
  }, []);

  const releaseInteraction = useCallback((interaction: AppLockInteractionLease) => {
    interactionLifecycle.current = releasePreservedAppLockInteractionLease(
      interactionLifecycle.current,
      interactionOwner.current,
      interaction,
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    updateAppLockAuthenticationAppState(appStateRef.current);
    return () => {
      mounted.current = false;
      preferenceReadAttempt.current += 1;
      invalidatePendingAppLockAuthentication();
    };
  }, []);

  const applyPreferenceResult = useCallback(
    (result: AppLockPreferenceReadResult, isRetry: boolean) => {
      const decision = decideAppLockPreference(result);
      enabledRef.current = decision.enabled;
      preferenceReadInFlight.current = false;
      setPreferenceRetrying(false);
      setLoaded(true);
      setLockFeedback(
        isRetry && decision.recovery === 'retry' ? APP_LOCK_READ_COPY.retryFailed : null,
      );
      setPreferenceRecovery(decision.recovery);
      setEnabledState(decision.enabled);
      if (decision.locked) autoPromptAttemptedForLock.current = false;
      setLocked(decision.locked);
    },
    [],
  );

  const loadPreference = useCallback(
    (isRetry: boolean): Promise<void> => {
      const attempt = ++preferenceReadAttempt.current;
      preferenceReadInFlight.current = true;
      interactionLifecycle.current = transitionAppLockInteractionLifecycle(
        interactionLifecycle.current,
        interactionOwner.current,
        'preference_read',
        null,
      );
      invalidatePendingAppLockAuthentication();
      setPreferenceRetrying(true);
      setLocked(true);

      return readAppLockPreferenceForCurrentAccount((result) => {
        if (!mounted.current || preferenceReadAttempt.current !== attempt) return;
        applyPreferenceResult(result, isRetry);
      })
        .then(() => undefined)
        .catch(() => {
          if (!mounted.current || preferenceReadAttempt.current !== attempt) return;
          applyPreferenceResult(
            { status: 'unavailable', enabled: null, reason: 'storage_unavailable' },
            isRetry,
          );
        });
    },
    [applyPreferenceResult],
  );

  const startPreferenceLoad = useCallback(
    (isRetry: boolean) => {
      if (!mounted.current) return;
      void loadPreference(isRetry).catch(() => undefined);
    },
    [loadPreference],
  );

  const reconcilePreferenceWhenActive = useCallback(() => {
    if (!mounted.current) return;
    preferenceRefreshPending.current = true;
    if (appStateRef.current !== 'active') return;
    preferenceRefreshPending.current = false;
    startPreferenceLoad(false);
  }, [startPreferenceLoad]);

  useEffect(() => {
    const timer = setTimeout(() => {
      startPreferenceLoad(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [startPreferenceLoad]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      appStateRef.current = s;
      updateAppLockAuthenticationAppState(s);
      setAppState(s);
      let promptOwnedTransition = false;
      let promptOwnedInactive = false;
      if (s !== 'active') {
        const presentedAuthentication = getPresentedAppLockAuthenticationToken();
        interactionLifecycle.current = transitionAppLockInteractionLifecycle(
          interactionLifecycle.current,
          interactionOwner.current,
          s,
          presentedAuthentication as AppLockInteractionLease | null,
        );
        promptOwnedTransition =
          presentedAuthentication !== null &&
          interactionLifecycle.current.preservedLease === presentedAuthentication;
        promptOwnedInactive = s === 'inactive' && promptOwnedTransition;
        if (!promptOwnedTransition) {
          invalidatePendingAppLockAuthentication();
        }
        if (!promptOwnedInactive) {
          setPhotoTimelineUnlocked(false);
        }
      }
      if (
        !promptOwnedInactive &&
        shouldLockForAppState(s, enabledRef.current || settingMutationInFlight.current)
      ) {
        if (!promptOwnedTransition) autoPromptAttemptedForLock.current = false;
        setLocked(true);
      }
      if (s === 'active' && preferenceRefreshPending.current) {
        preferenceRefreshPending.current = false;
        startPreferenceLoad(false);
      }
    });
    return () => sub.remove();
  }, [startPreferenceLoad]);

  const requestUnlock = useCallback((): Promise<void> => {
    return runSingleFlight(appUnlockLease.current, async () => {
      if (preferenceReadInFlight.current) return;
      const preferenceAttempt = preferenceReadAttempt.current;
      const interaction = captureAppLockInteractionLease(
        interactionLifecycle.current,
        interactionOwner.current,
        appStateRef.current,
      );
      if (!interaction) return;
      const requestIsCurrent = () =>
        mounted.current &&
        !preferenceReadInFlight.current &&
        preferenceReadAttempt.current === preferenceAttempt &&
        isInteractionCurrent(interaction);
      const repairRequested = preferenceRecovery === 'repair';
      try {
        const result = await attemptAppUnlockForCurrentAccount({
          promptMessage: BRAND.appLockPrompt,
          repairRequired: repairRequested,
          authenticationToken: interaction,
          isInteractionCurrent: requestIsCurrent,
          publish: (result) => {
            if (!requestIsCurrent()) return;
            if (result.status === 'reset_failed') {
              setLockFeedback('App lock could not be reset. Try again.');
              return;
            }

            if (result.status === 'success') {
              if (result.repaired) {
                setPreferenceRecovery(null);
                enabledRef.current = false;
                setEnabledState(false);
              }
              setLockFeedback(null);
              setLocked(false);
            } else if (result.status === 'unavailable') {
              setLockFeedback(appLockUserMessage());
            }
          },
        });
        if (
          repairRequested &&
          !requestIsCurrent() &&
          (result.status === 'reset_failed' || (result.status === 'success' && result.repaired))
        ) {
          reconcilePreferenceWhenActive();
        }
      } catch (error) {
        if (!(error instanceof AccountGenerationLeaseError) && requestIsCurrent()) {
          setLockFeedback(appLockUserMessage());
        }
      } finally {
        releaseInteraction(interaction);
      }
    });
  }, [isInteractionCurrent, preferenceRecovery, reconcilePreferenceWhenActive, releaseInteraction]);

  const authenticate = useCallback(() => {
    setLockFeedback(null);
    void requestUnlock();
  }, [requestUnlock]);

  const retryPreferenceRead = useCallback(() => {
    if (preferenceRetrying || preferenceReadInFlight.current) return;
    setLockFeedback(null);
    startPreferenceLoad(true);
  }, [preferenceRetrying, startPreferenceLoad]);

  const unlockPhotoTimeline = useCallback(async (): Promise<AppLockAuthStatus> => {
    try {
      return await runSingleFlight(photoTimelineUnlockLease.current, async () => {
        if (preferenceReadInFlight.current) return 'not_authenticated';
        const preferenceAttempt = preferenceReadAttempt.current;
        const interaction = captureAppLockInteractionLease(
          interactionLifecycle.current,
          interactionOwner.current,
          appStateRef.current,
        );
        if (!interaction) return 'not_authenticated';
        const requestIsCurrent = () =>
          mounted.current &&
          !preferenceReadInFlight.current &&
          preferenceReadAttempt.current === preferenceAttempt &&
          isInteractionCurrent(interaction);
        try {
          const result = await attemptAppUnlockForCurrentAccount({
            promptMessage: PHOTO_TIMELINE_PROMPT,
            repairRequired: false,
            authenticationToken: interaction,
            isInteractionCurrent: requestIsCurrent,
            publish: (attempt) => {
              if (attempt.status === 'success' && requestIsCurrent()) {
                setPhotoTimelineUnlocked(true);
                if (interactionLifecycle.current.preservedLease === interaction) {
                  // The same successful native authentication also satisfies
                  // the global relock caused by its prompt-owned inactive hop.
                  setLocked(false);
                }
              }
            },
          });
          if (!requestIsCurrent()) {
            return 'not_authenticated';
          }
          return result.status === 'reset_failed' ? 'unavailable' : result.status;
        } finally {
          releaseInteraction(interaction);
        }
      });
    } catch (error) {
      if (error instanceof AccountGenerationLeaseError) return 'not_authenticated';
      return 'unavailable';
    }
  }, [isInteractionCurrent, releaseInteraction]);

  // Auto-prompt whenever we are active and locked. Do not launch biometrics while
  // the OS is taking an app-switcher snapshot or the app is backgrounded.
  useEffect(() => {
    if (
      enabled &&
      locked &&
      appState === 'active' &&
      preferenceRecovery === null &&
      !preferenceRetrying &&
      interactionLifecycle.current.preservedLease === null &&
      !settingMutationInFlight.current &&
      !autoPromptAttemptedForLock.current
    ) {
      autoPromptAttemptedForLock.current = true;
      void requestUnlock();
    }
  }, [enabled, locked, appState, preferenceRecovery, preferenceRetrying, requestUnlock]);

  const setEnabled = useCallback(
    async (v: boolean) => {
      if (preferenceReadInFlight.current) throw new Error('App lock unavailable');
      const preferenceAttempt = preferenceReadAttempt.current;
      const interaction = captureAppLockInteractionLease(
        interactionLifecycle.current,
        interactionOwner.current,
        appStateRef.current,
      );
      if (!interaction) throw new Error('App lock unavailable');
      const requestIsCurrent = () =>
        mounted.current &&
        !preferenceReadInFlight.current &&
        preferenceReadAttempt.current === preferenceAttempt &&
        isInteractionCurrent(interaction);
      const lockedBeforeMutation = locked;

      try {
        settingMutationInFlight.current = true;
        let result: Awaited<ReturnType<typeof setAppLockPreferenceForCurrentAccount>> | undefined;
        let didFail = false;
        let failure: unknown;
        try {
          result = await setAppLockPreferenceForCurrentAccount({
            enabled: v,
            authenticationToken: interaction,
            isInteractionCurrent: requestIsCurrent,
            publish: (attempt) => {
              if (!requestIsCurrent()) return;
              if (attempt.status === 'write_uncertain') {
                applyPreferenceResult(attempt.preference, true);
                return;
              }
              if (attempt.status !== 'saved') {
                if (v && !enabledRef.current) setLocked(lockedBeforeMutation);
                return;
              }
              setLockFeedback(null);
              setPreferenceRecovery(null);
              enabledRef.current = attempt.enabled;
              setEnabledState(attempt.enabled);
              setPhotoTimelineUnlocked(false);
              if (!attempt.enabled || interactionLifecycle.current.preservedLease === interaction) {
                setLocked(false);
              }
            },
          });
        } catch (error) {
          didFail = true;
          failure = error;
        } finally {
          settingMutationInFlight.current = false;
        }

        if (!requestIsCurrent()) {
          reconcilePreferenceWhenActive();
          return;
        }
        if (didFail) throw failure;
        if (result?.status === 'unavailable' || result?.status === 'write_uncertain') {
          throw new Error('App lock unavailable');
        }
      } finally {
        releaseInteraction(interaction);
      }
    },
    [
      applyPreferenceResult,
      isInteractionCurrent,
      locked,
      reconcilePreferenceWhenActive,
      releaseInteraction,
    ],
  );

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
  const hideAppContent = !loaded || locked || showPrivacyShield;

  return (
    <AppLockContext.Provider value={value}>
      <View
        accessibilityElementsHidden={hideAppContent}
        importantForAccessibility={hideAppContent ? 'no-hide-descendants' : 'auto'}
        style={{ flex: 1, pointerEvents: hideAppContent ? 'none' : 'auto' }}
      >
        {loaded ? children : null}
      </View>
      {showPrivacyShield || !loaded ? <PrivacyShield /> : null}
      {!showPrivacyShield && loaded && locked ? (
        <LockOverlay
          feedback={lockFeedback}
          onUnlock={preferenceRecovery === 'retry' ? retryPreferenceRead : authenticate}
          preferenceRecovery={preferenceRecovery}
          retrying={preferenceRetrying}
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
