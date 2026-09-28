import { useCameraPermissions, type PermissionResponse } from 'expo-camera';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type CameraPermissionPhase =
  | 'idle'
  | 'querying'
  | 'requesting'
  | 'query_error'
  | 'request_error';
export type CameraPermissionOperation = 'idle' | 'refreshing' | 'requesting';
export type CameraPermissionFailure = 'refresh_failed' | 'request_failed';

export type CameraOperationLease = Readonly<{
  cameraGeneration: number;
  sessionGeneration: number;
}>;

export type CameraAccessLifecycleOptions = Readonly<{
  available: boolean;
  isFocused: boolean;
  mountAllowed?: boolean;
  autoRequestOnUndetermined?: boolean;
}>;

export type CameraAccessLifecycle = Readonly<{
  appState: AppStateStatus;
  permission: PermissionResponse | null;
  permissionGranted: boolean;
  permissionVerified: boolean;
  canAskAgain: boolean;
  permissionPhase: CameraPermissionPhase;
  permissionBusy: boolean;
  permissionOperation: CameraPermissionOperation;
  permissionFailure: CameraPermissionFailure | null;
  isForegroundFocused: boolean;
  shouldMountCamera: boolean;
  cameraActive: boolean;
  cameraReady: boolean;
  cameraUnavailable: boolean;
  canCapture: boolean;
  cameraGeneration: number;
  cameraKey: string;
  requestCameraPermission: () => Promise<PermissionResponse | null>;
  refreshCameraPermission: () => Promise<PermissionResponse | null>;
  requestPermission: () => Promise<PermissionResponse | null>;
  refreshPermission: () => Promise<PermissionResponse | null>;
  clearPermissionFailure: () => void;
  markCameraReady: (cameraGeneration: number) => boolean;
  markCameraUnavailable: (cameraGeneration: number) => boolean;
  onCameraReady: () => boolean;
  onCameraMountError: () => boolean;
  retryCamera: () => void;
  retryCameraMount: () => void;
  resetCameraSession: () => void;
  acquireCameraOperationLease: () => CameraOperationLease | null;
  isCameraOperationLeaseCurrent: (lease: CameraOperationLease) => boolean;
  beginCameraOperation: () => CameraOperationLease | null;
  isCameraOperationCurrent: (lease: CameraOperationLease) => boolean;
}>;

type CameraRouteRenderState = Readonly<{
  available: boolean;
  isFocused: boolean;
  mountAllowed: boolean;
  generation: number;
}>;

type PermissionVerification = Readonly<{
  routeGeneration: number;
  verifiedWhileMountClosed: boolean;
}>;

type PermissionOperationState = Readonly<{
  operation: CameraPermissionOperation;
  routeGeneration: number;
}>;

type PermissionFailureState = Readonly<{
  failure: CameraPermissionFailure;
  routeGeneration: number;
}>;

type ActivePermissionOperation = Readonly<{
  id: number;
  operation: Exclude<CameraPermissionOperation, 'idle'>;
  routeGeneration: number;
  startedWhileMountClosed: boolean;
}>;

/**
 * Owns camera permission refresh and camera-session admission for a focused route.
 * Permission responses are copied out of Expo's hook under an operation fence so
 * a late query cannot overwrite a newer request or a foreground refresh.
 */
export function useCameraAccessLifecycle({
  available,
  isFocused,
  mountAllowed = available,
  autoRequestOnUndetermined = false,
}: CameraAccessLifecycleOptions): CameraAccessLifecycle {
  const [, requestPermission, getPermission] = useCameraPermissions({ get: false, request: false });
  const [routeRenderState, setRouteRenderState] = useState<CameraRouteRenderState>(() => ({
    available,
    isFocused,
    mountAllowed,
    generation: 0,
  }));
  if (
    routeRenderState.available !== available ||
    routeRenderState.isFocused !== isFocused ||
    routeRenderState.mountAllowed !== mountAllowed
  ) {
    const invalidatesRoute =
      routeRenderState.available !== available ||
      routeRenderState.isFocused !== isFocused ||
      (routeRenderState.mountAllowed && !mountAllowed);
    setRouteRenderState({
      available,
      isFocused,
      mountAllowed,
      generation: routeRenderState.generation + (invalidatesRoute ? 1 : 0),
    });
  }
  const routeGeneration = routeRenderState.generation;
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [permissionVerification, setPermissionVerification] =
    useState<PermissionVerification | null>(null);
  const [permissionOperationState, setPermissionOperationState] =
    useState<PermissionOperationState>(() => ({ operation: 'idle', routeGeneration }));
  const [permissionFailureState, setPermissionFailureState] =
    useState<PermissionFailureState | null>(null);
  const [cameraReadyState, setCameraReadyState] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [cameraGeneration, setCameraGeneration] = useState(0);

  const mountedRef = useRef(true);
  const focusedRef = useRef(isFocused);
  const availableRef = useRef(available);
  const mountAllowedRef = useRef(mountAllowed);
  const appStateRef = useRef(appState);
  const permissionRef = useRef<PermissionResponse | null>(null);
  const permissionVerifiedRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const cameraUnavailableRef = useRef(false);
  const cameraGenerationRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const permissionOperationIdRef = useRef(0);
  const permissionOperationRef = useRef<CameraPermissionOperation>('idle');
  const activePermissionOperationRef = useRef<ActivePermissionOperation | null>(null);
  const autoRequestAttemptedRef = useRef(false);
  const routeGenerationRef = useRef(routeGeneration);

  // Layout synchronization closes native callback admission before a committed
  // focus/business-gate transition can yield to queued CameraView callbacks.
  // React state is keyed to the render generation below, so this safety fence
  // does not need a cascading state update from an effect.
  useLayoutEffect(() => {
    focusedRef.current = isFocused;
    availableRef.current = available;
    mountAllowedRef.current = mountAllowed;
    if (routeGenerationRef.current === routeGeneration) return;
    routeGenerationRef.current = routeGeneration;
    permissionOperationIdRef.current += 1;
    permissionOperationRef.current = 'idle';
    activePermissionOperationRef.current = null;
    permissionVerifiedRef.current = false;
    cameraReadyRef.current = false;
    sessionGenerationRef.current += 1;
    cameraGenerationRef.current += 1;
  }, [available, isFocused, mountAllowed, routeGeneration]);

  const invalidatePermissionOperation = useCallback(() => {
    permissionOperationIdRef.current += 1;
    permissionOperationRef.current = 'idle';
    activePermissionOperationRef.current = null;
    setPermissionOperationState({ operation: 'idle', routeGeneration });
  }, [routeGeneration]);

  const resetCameraSession = useCallback(() => {
    cameraReadyRef.current = false;
    sessionGenerationRef.current += 1;
    cameraGenerationRef.current += 1;
    setCameraReadyState(false);
    setCameraGeneration(cameraGenerationRef.current);
  }, []);

  const isRouteActive = useCallback(
    () =>
      mountedRef.current &&
      availableRef.current &&
      focusedRef.current &&
      appStateRef.current === 'active',
    [],
  );

  const invalidatePermissionVerification = useCallback(() => {
    permissionVerifiedRef.current = false;
    setPermissionVerification(null);
    invalidatePermissionOperation();
    resetCameraSession();
  }, [invalidatePermissionOperation, resetCameraSession]);

  const runPermissionOperation = useCallback(
    async (
      operation: Exclude<CameraPermissionOperation, 'idle'>,
    ): Promise<PermissionResponse | null> => {
      // A passive AppState subscription can briefly retain a callback from the
      // previous committed route generation. Never let that stale closure open
      // an operation after the layout fence has advanced.
      if (!isRouteActive() || routeGenerationRef.current !== routeGeneration) return null;
      const operationId = ++permissionOperationIdRef.current;
      permissionOperationRef.current = operation;
      activePermissionOperationRef.current = {
        id: operationId,
        operation,
        routeGeneration,
        startedWhileMountClosed: !mountAllowedRef.current,
      };
      permissionVerifiedRef.current = false;
      setPermissionVerification(null);
      resetCameraSession();
      setPermissionOperationState({ operation, routeGeneration });
      setPermissionFailureState(null);
      try {
        const response =
          operation === 'requesting' ? await requestPermission() : await getPermission();
        if (
          operationId !== permissionOperationIdRef.current ||
          activePermissionOperationRef.current?.id !== operationId ||
          routeGenerationRef.current !== routeGeneration ||
          !isRouteActive()
        ) {
          return null;
        }
        permissionRef.current = response;
        permissionVerifiedRef.current = true;
        setPermission(response);
        setPermissionVerification({
          routeGeneration,
          verifiedWhileMountClosed: !mountAllowedRef.current,
        });
        setPermissionFailureState(null);
        return response;
      } catch {
        if (operationId === permissionOperationIdRef.current && isRouteActive()) {
          setPermissionFailureState({
            failure: operation === 'requesting' ? 'request_failed' : 'refresh_failed',
            routeGeneration,
          });
        }
        return null;
      } finally {
        if (operationId === permissionOperationIdRef.current && mountedRef.current) {
          permissionOperationRef.current = 'idle';
          activePermissionOperationRef.current = null;
          setPermissionOperationState({ operation: 'idle', routeGeneration });
        }
      }
    },
    [getPermission, isRouteActive, requestPermission, resetCameraSession, routeGeneration],
  );

  const requestCameraPermission = useCallback(
    () => runPermissionOperation('requesting'),
    [runPermissionOperation],
  );
  const refreshCameraPermission = useCallback(
    () => runPermissionOperation('refreshing'),
    [runPermissionOperation],
  );

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      permissionOperationIdRef.current += 1;
      activePermissionOperationRef.current = null;
      sessionGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      setAppState(nextState);
      if (nextState !== 'active') {
        invalidatePermissionVerification();
        return;
      }
      if (focusedRef.current && mountAllowedRef.current) {
        if (permissionOperationRef.current === 'idle') void refreshCameraPermission();
      }
    });
    return () => subscription.remove();
  }, [invalidatePermissionVerification, refreshCameraPermission]);

  useEffect(() => {
    if (!available || !isFocused || !mountAllowed) return;
    // Consent/business-gate state can be committed by the same action that
    // immediately starts the OS request. Preserve that in-flight operation:
    // its accepted result is the fresh verification needed to mount.
    const activeOperation = activePermissionOperationRef.current;
    const preservesOpeningConsentRequest =
      activeOperation?.operation === 'requesting' &&
      activeOperation.routeGeneration === routeGeneration &&
      activeOperation.startedWhileMountClosed;
    if (preservesOpeningConsentRequest) return;
    if (permissionOperationRef.current !== 'idle') {
      // Replace refreshes (or requests from another route generation) rather
      // than letting their ignored result strand this generation unverified.
      permissionOperationIdRef.current += 1;
      permissionOperationRef.current = 'idle';
      activePermissionOperationRef.current = null;
    }
    if (appStateRef.current === 'active') {
      void refreshCameraPermission().then((response) => {
        if (
          response?.status === 'undetermined' &&
          autoRequestOnUndetermined &&
          !autoRequestAttemptedRef.current &&
          isRouteActive()
        ) {
          autoRequestAttemptedRef.current = true;
          void requestCameraPermission();
        }
      });
    }
  }, [
    autoRequestOnUndetermined,
    available,
    isFocused,
    isRouteActive,
    mountAllowed,
    refreshCameraPermission,
    requestCameraPermission,
    routeGeneration,
  ]);

  const permissionOperation =
    permissionOperationState.routeGeneration === routeGeneration
      ? permissionOperationState.operation
      : 'idle';
  const permissionFailure =
    permissionFailureState?.routeGeneration === routeGeneration
      ? permissionFailureState.failure
      : null;
  const permissionVerified =
    permissionVerification?.routeGeneration === routeGeneration &&
    available &&
    isFocused &&
    appState === 'active' &&
    (!mountAllowed || !permissionVerification.verifiedWhileMountClosed);
  const permissionGranted = permissionVerified && Boolean(permission?.granted);
  const isForegroundFocused = isFocused && appState === 'active';
  const shouldMountCamera =
    available &&
    mountAllowed &&
    permissionVerified &&
    permissionGranted &&
    isForegroundFocused &&
    !cameraUnavailable;
  const cameraActive = shouldMountCamera;
  const cameraReady = cameraReadyState && cameraActive;
  const canCapture = cameraActive && cameraReady;

  const markCameraReady = useCallback((generation: number): boolean => {
    if (
      generation !== cameraGenerationRef.current ||
      !mountedRef.current ||
      !availableRef.current ||
      !focusedRef.current ||
      !mountAllowedRef.current ||
      appStateRef.current !== 'active' ||
      !permissionVerifiedRef.current ||
      !permissionRef.current?.granted ||
      cameraUnavailableRef.current
    ) {
      return false;
    }
    cameraReadyRef.current = true;
    setCameraReadyState(true);
    return true;
  }, []);

  const markCameraUnavailable = useCallback((generation: number): boolean => {
    if (
      generation !== cameraGenerationRef.current ||
      !mountedRef.current ||
      !availableRef.current ||
      !focusedRef.current ||
      !mountAllowedRef.current ||
      appStateRef.current !== 'active' ||
      !permissionVerifiedRef.current ||
      !permissionRef.current?.granted ||
      cameraUnavailableRef.current
    ) {
      return false;
    }
    cameraReadyRef.current = false;
    cameraUnavailableRef.current = true;
    sessionGenerationRef.current += 1;
    setCameraReadyState(false);
    setCameraUnavailable(true);
    return true;
  }, []);

  const onCameraReady = useCallback(
    () => markCameraReady(cameraGeneration),
    [cameraGeneration, markCameraReady],
  );
  const onCameraMountError = useCallback(
    () => markCameraUnavailable(cameraGeneration),
    [cameraGeneration, markCameraUnavailable],
  );

  const retryCamera = useCallback(() => {
    if (!isRouteActive()) return;
    cameraUnavailableRef.current = false;
    setCameraUnavailable(false);
    resetCameraSession();
  }, [isRouteActive, resetCameraSession]);

  const acquireCameraOperationLease = useCallback((): CameraOperationLease | null => {
    if (
      !mountedRef.current ||
      !availableRef.current ||
      !focusedRef.current ||
      !mountAllowedRef.current ||
      appStateRef.current !== 'active' ||
      !permissionVerifiedRef.current ||
      !permissionRef.current?.granted ||
      !cameraReadyRef.current ||
      cameraUnavailableRef.current
    ) {
      return null;
    }
    return Object.freeze({
      cameraGeneration: cameraGenerationRef.current,
      sessionGeneration: sessionGenerationRef.current,
    });
  }, []);

  const isCameraOperationLeaseCurrent = useCallback((lease: CameraOperationLease): boolean => {
    return (
      lease.cameraGeneration === cameraGenerationRef.current &&
      lease.sessionGeneration === sessionGenerationRef.current &&
      mountedRef.current &&
      availableRef.current &&
      focusedRef.current &&
      mountAllowedRef.current &&
      appStateRef.current === 'active' &&
      permissionVerifiedRef.current &&
      Boolean(permissionRef.current?.granted) &&
      cameraReadyRef.current &&
      !cameraUnavailableRef.current
    );
  }, []);

  return useMemo(
    () => ({
      appState,
      permission,
      permissionGranted,
      permissionVerified,
      canAskAgain: permissionVerified ? (permission?.canAskAgain ?? true) : true,
      permissionPhase:
        permissionFailure === 'refresh_failed'
          ? 'query_error'
          : permissionFailure === 'request_failed'
            ? 'request_error'
            : permissionOperation === 'refreshing'
              ? 'querying'
              : permissionOperation,
      permissionBusy: permissionOperation !== 'idle',
      permissionOperation,
      permissionFailure,
      isForegroundFocused,
      shouldMountCamera,
      cameraActive,
      cameraReady,
      cameraUnavailable,
      canCapture,
      cameraGeneration,
      cameraKey: `camera-${cameraGeneration}`,
      requestCameraPermission,
      refreshCameraPermission,
      requestPermission: requestCameraPermission,
      refreshPermission: refreshCameraPermission,
      clearPermissionFailure: () => setPermissionFailureState(null),
      markCameraReady,
      markCameraUnavailable,
      onCameraReady,
      onCameraMountError,
      retryCamera,
      retryCameraMount: retryCamera,
      resetCameraSession,
      acquireCameraOperationLease,
      isCameraOperationLeaseCurrent,
      beginCameraOperation: acquireCameraOperationLease,
      isCameraOperationCurrent: isCameraOperationLeaseCurrent,
    }),
    [
      acquireCameraOperationLease,
      appState,
      cameraActive,
      cameraGeneration,
      cameraReady,
      cameraUnavailable,
      canCapture,
      isCameraOperationLeaseCurrent,
      isForegroundFocused,
      markCameraReady,
      markCameraUnavailable,
      onCameraMountError,
      onCameraReady,
      permission,
      permissionFailure,
      permissionGranted,
      permissionOperation,
      permissionVerified,
      refreshCameraPermission,
      requestCameraPermission,
      resetCameraSession,
      retryCamera,
      shouldMountCamera,
    ],
  );
}
