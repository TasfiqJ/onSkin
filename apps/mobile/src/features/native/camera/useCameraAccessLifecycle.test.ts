import { createElement, useLayoutEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCameraAccessLifecycle,
  type CameraAccessLifecycle,
  type CameraAccessLifecycleOptions,
} from './useCameraAccessLifecycle';

const h = vi.hoisted(() => ({
  appState: 'active' as 'active' | 'background' | 'inactive',
  appStateListener: null as ((state: 'active' | 'background' | 'inactive') => void) | null,
  removeAppStateListener: vi.fn(),
  getPermission: vi.fn(),
  requestPermission: vi.fn(),
}));

vi.mock('expo-camera', () => ({
  useCameraPermissions: () => [null, h.requestPermission, h.getPermission],
}));

vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return h.appState;
    },
    addEventListener: vi.fn(
      (_event: string, listener: (state: 'active' | 'background' | 'inactive') => void) => {
        h.appStateListener = listener;
        return { remove: h.removeAppStateListener };
      },
    ),
  },
}));

type PermissionStatus = 'denied' | 'granted' | 'undetermined';

function permission(status: PermissionStatus, canAskAgain = status !== 'denied') {
  return {
    status,
    expires: 'never' as const,
    granted: status === 'granted',
    canAskAgain,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

let current: CameraAccessLifecycle | null = null;
let renderer: ReactTestRenderer | null = null;

function Probe(props: CameraAccessLifecycleOptions) {
  const lifecycle = useCameraAccessLifecycle(props);
  useLayoutEffect(() => {
    current = lifecycle;
  }, [lifecycle]);
  return null;
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
  });
}

async function mount(options: CameraAccessLifecycleOptions): Promise<void> {
  await act(async () => {
    renderer = create(createElement(Probe, options));
  });
  await flushEffects();
}

async function update(options: CameraAccessLifecycleOptions): Promise<void> {
  await act(async () => renderer?.update(createElement(Probe, options)));
  await flushEffects();
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  current = null;
  h.appState = 'active';
  h.appStateListener = null;
  h.removeAppStateListener.mockReset();
  h.getPermission.mockReset().mockResolvedValue(permission('denied', false));
  h.requestPermission.mockReset().mockResolvedValue(permission('denied', false));
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('camera access lifecycle', () => {
  it('requires a fresh successful foreground query before reopening camera admission', async () => {
    h.getPermission.mockResolvedValueOnce(permission('granted'));
    await mount({ available: true, isFocused: true });

    expect(current?.permissionVerified).toBe(true);
    expect(current?.cameraActive).toBe(true);
    const readyGeneration = current!.cameraGeneration;
    await act(async () => {
      expect(current?.markCameraReady(readyGeneration)).toBe(true);
    });
    expect(current?.canCapture).toBe(true);
    const lease = current!.beginCameraOperation();
    expect(lease).not.toBeNull();

    await act(async () => h.appStateListener?.('background'));
    expect(current?.permissionVerified).toBe(false);
    expect(current?.cameraActive).toBe(false);
    expect(current?.canCapture).toBe(false);
    expect(current?.isCameraOperationCurrent(lease!)).toBe(false);

    h.getPermission.mockRejectedValueOnce(new Error('NATIVE_PERMISSION_QUERY_FAILED'));
    await act(async () => h.appStateListener?.('active'));
    await flushEffects();

    expect(current?.permission?.granted).toBe(true);
    expect(current?.permissionVerified).toBe(false);
    expect(current?.permissionPhase).toBe('query_error');
    expect(current?.cameraActive).toBe(false);
    expect(current?.canCapture).toBe(false);
  });

  it('does no permission or camera work when native camera is unavailable', async () => {
    await mount({ available: false, isFocused: true });

    expect(h.getPermission).not.toHaveBeenCalled();
    let result: unknown;
    await act(async () => {
      result = await current?.requestPermission();
    });
    expect(result).toBeNull();
    expect(h.requestPermission).not.toHaveBeenCalled();
    expect(current?.permissionVerified).toBe(false);
    expect(current?.shouldMountCamera).toBe(false);
    expect(current?.beginCameraOperation()).toBeNull();
  });

  it('accepts an explicit post-consent request while mounting is still disallowed', async () => {
    h.requestPermission.mockResolvedValueOnce(permission('granted'));
    await mount({ available: true, isFocused: true, mountAllowed: false });
    expect(h.getPermission).not.toHaveBeenCalled();

    await act(async () => {
      await current?.requestPermission();
    });
    expect(current?.permissionGranted).toBe(true);
    expect(current?.permissionVerified).toBe(true);
    expect(current?.cameraActive).toBe(false);

    h.getPermission.mockResolvedValueOnce(permission('granted'));
    await update({ available: true, isFocused: true, mountAllowed: true });
    expect(h.getPermission).toHaveBeenCalledOnce();
    expect(current?.permissionVerified).toBe(true);
    expect(current?.cameraActive).toBe(true);
  });

  it('preserves a pending explicit request when the committed consent gate opens', async () => {
    const pendingRequest = deferred<ReturnType<typeof permission>>();
    h.requestPermission.mockReturnValueOnce(pendingRequest.promise);
    await mount({ available: true, isFocused: true, mountAllowed: false });

    let requestResult: ReturnType<CameraAccessLifecycle['requestPermission']>;
    await act(async () => {
      requestResult = current!.requestPermission();
      await Promise.resolve();
    });
    expect(current?.permissionPhase).toBe('requesting');

    await update({ available: true, isFocused: true, mountAllowed: true });
    expect(h.getPermission).not.toHaveBeenCalled();
    expect(current?.permissionPhase).toBe('requesting');

    await act(async () => pendingRequest.resolve(permission('granted')));
    await expect(requestResult!).resolves.toMatchObject({ granted: true });
    await flushEffects();

    expect(h.requestPermission).toHaveBeenCalledOnce();
    expect(h.getPermission).not.toHaveBeenCalled();
    expect(current?.permissionVerified).toBe(true);
    expect(current?.permissionGranted).toBe(true);
    expect(current?.cameraActive).toBe(true);
  });

  it('invalidates a pending operation when an open business gate closes', async () => {
    h.getPermission.mockResolvedValueOnce(permission('granted'));
    await mount({ available: true, isFocused: true, mountAllowed: true });
    expect(current?.cameraActive).toBe(true);

    const pendingRefresh = deferred<ReturnType<typeof permission>>();
    h.getPermission.mockReturnValueOnce(pendingRefresh.promise);
    let refreshResult: ReturnType<CameraAccessLifecycle['refreshPermission']>;
    await act(async () => {
      refreshResult = current!.refreshPermission();
      await Promise.resolve();
    });

    await update({ available: true, isFocused: true, mountAllowed: false });
    await act(async () => pendingRefresh.resolve(permission('granted')));
    await expect(refreshResult!).resolves.toBeNull();
    await flushEffects();

    expect(current?.permissionVerified).toBe(false);
    expect(current?.cameraActive).toBe(false);
  });

  it('re-verifies a granted permission after the iOS system prompt makes AppState inactive', async () => {
    const pendingRequest = deferred<ReturnType<typeof permission>>();
    const foregroundQuery = deferred<ReturnType<typeof permission>>();
    h.requestPermission.mockReturnValueOnce(pendingRequest.promise);
    h.getPermission.mockReturnValueOnce(foregroundQuery.promise);
    await mount({ available: true, isFocused: true, mountAllowed: false });

    let requestResult: ReturnType<CameraAccessLifecycle['requestPermission']>;
    await act(async () => {
      requestResult = current!.requestPermission();
      await Promise.resolve();
    });
    await update({ available: true, isFocused: true, mountAllowed: true });

    await act(async () => h.appStateListener?.('inactive'));
    expect(current?.permissionVerified).toBe(false);
    expect(current?.cameraActive).toBe(false);

    await act(async () => h.appStateListener?.('active'));
    expect(h.getPermission).toHaveBeenCalledOnce();
    await act(async () => foregroundQuery.resolve(permission('granted')));
    await flushEffects();
    expect(current?.permissionVerified).toBe(true);
    expect(current?.permissionGranted).toBe(true);
    expect(current?.cameraActive).toBe(true);

    await act(async () => pendingRequest.resolve(permission('denied', false)));
    await expect(requestResult!).resolves.toBeNull();
    await flushEffects();
    expect(current?.permissionGranted).toBe(true);
  });

  it('keeps the foreground denial authoritative when the invalidated prompt request resolves late', async () => {
    const pendingRequest = deferred<ReturnType<typeof permission>>();
    h.requestPermission.mockReturnValueOnce(pendingRequest.promise);
    h.getPermission.mockResolvedValueOnce(permission('denied', false));
    await mount({ available: true, isFocused: true, mountAllowed: false });

    let requestResult: ReturnType<CameraAccessLifecycle['requestPermission']>;
    await act(async () => {
      requestResult = current!.requestPermission();
      await Promise.resolve();
    });
    await update({ available: true, isFocused: true, mountAllowed: true });
    await act(async () => h.appStateListener?.('inactive'));
    await act(async () => h.appStateListener?.('active'));
    await flushEffects();

    expect(current?.permissionVerified).toBe(true);
    expect(current?.permissionGranted).toBe(false);
    expect(current?.canAskAgain).toBe(false);
    await act(async () => pendingRequest.resolve(permission('granted')));
    await expect(requestResult!).resolves.toBeNull();
    await flushEffects();
    expect(current?.permissionGranted).toBe(false);
    expect(current?.cameraActive).toBe(false);
  });

  it('exposes a recoverable refresh failure after the iOS prompt lifecycle', async () => {
    const pendingRequest = deferred<ReturnType<typeof permission>>();
    h.requestPermission.mockReturnValueOnce(pendingRequest.promise);
    h.getPermission
      .mockRejectedValueOnce(new Error('NATIVE_PERMISSION_QUERY_FAILED'))
      .mockResolvedValueOnce(permission('granted'));
    await mount({ available: true, isFocused: true, mountAllowed: false });

    let requestResult: ReturnType<CameraAccessLifecycle['requestPermission']>;
    await act(async () => {
      requestResult = current!.requestPermission();
      await Promise.resolve();
    });
    await update({ available: true, isFocused: true, mountAllowed: true });
    await act(async () => h.appStateListener?.('inactive'));
    await act(async () => h.appStateListener?.('active'));
    await flushEffects();

    expect(current?.permissionVerified).toBe(false);
    expect(current?.permissionFailure).toBe('refresh_failed');
    expect(current?.canAskAgain).toBe(true);
    expect(current?.cameraActive).toBe(false);
    await act(async () => pendingRequest.resolve(permission('granted')));
    await expect(requestResult!).resolves.toBeNull();

    await act(async () => {
      await current?.refreshPermission();
    });
    expect(current?.permissionVerified).toBe(true);
    expect(current?.permissionGranted).toBe(true);
    expect(current?.cameraActive).toBe(true);
  });

  it('suppresses stale permission and stale CameraView generations', async () => {
    const firstQuery = deferred<ReturnType<typeof permission>>();
    const secondQuery = deferred<ReturnType<typeof permission>>();
    h.getPermission
      .mockReturnValueOnce(firstQuery.promise)
      .mockReturnValueOnce(secondQuery.promise);
    await mount({ available: true, isFocused: true });
    await update({ available: true, isFocused: false });
    await update({ available: true, isFocused: true });

    await act(async () => secondQuery.resolve(permission('granted')));
    await flushEffects();
    await act(async () => firstQuery.resolve(permission('denied', false)));
    await flushEffects();
    expect(current?.permission?.granted).toBe(true);

    const oldReady = current!.onCameraReady;
    await act(async () => {
      expect(current?.onCameraMountError()).toBe(true);
    });
    expect(current?.cameraUnavailable).toBe(true);
    await act(async () => current?.retryCameraMount());
    expect(current?.cameraUnavailable).toBe(false);
    await act(async () => {
      expect(oldReady()).toBe(false);
      expect(current?.onCameraReady()).toBe(true);
    });
    expect(current?.canCapture).toBe(true);
  });

  it('allows a focused review screen to reset a failed camera before reopening preview', async () => {
    h.getPermission.mockResolvedValue(permission('granted'));
    await mount({ available: true, isFocused: true, mountAllowed: true });
    await act(async () => {
      expect(current?.onCameraReady()).toBe(true);
      expect(current?.onCameraMountError()).toBe(true);
    });
    expect(current?.cameraUnavailable).toBe(true);

    await update({ available: true, isFocused: true, mountAllowed: false });
    const failedGeneration = current!.cameraGeneration;
    await act(async () => current?.retryCameraMount());

    expect(current?.cameraUnavailable).toBe(false);
    expect(current!.cameraGeneration).toBeGreaterThan(failedGeneration);
    expect(current?.cameraActive).toBe(false);

    await update({ available: true, isFocused: true, mountAllowed: true });
    expect(current?.cameraActive).toBe(true);
  });

  it('rejects a mount error racing with route blur before effects reset the generation', async () => {
    h.getPermission.mockResolvedValueOnce(permission('granted'));
    await mount({ available: true, isFocused: true });
    const racingMountError = current!.onCameraMountError;

    await act(async () => {
      const synchronousRenderer = renderer as ReactTestRenderer & {
        unstable_flushSync: (update: () => void) => void;
      };
      synchronousRenderer.unstable_flushSync(() => {
        renderer?.update(createElement(Probe, { available: true, isFocused: false }));
      });
      expect(racingMountError()).toBe(false);
    });

    expect(current?.cameraUnavailable).toBe(false);
    expect(current?.cameraActive).toBe(false);
  });

  it('rejects an old permission closure between refocus layout and passive effects', async () => {
    h.getPermission.mockResolvedValue(permission('granted'));
    await mount({ available: true, isFocused: true });
    await update({ available: true, isFocused: false });
    const staleRefresh = current!.refreshPermission;
    const callsBeforeRefocus = h.getPermission.mock.calls.length;

    let staleResult!: ReturnType<CameraAccessLifecycle['refreshPermission']>;
    await act(async () => {
      const synchronousRenderer = renderer as ReactTestRenderer & {
        unstable_flushSync: (update: () => void) => void;
      };
      synchronousRenderer.unstable_flushSync(() => {
        renderer?.update(createElement(Probe, { available: true, isFocused: true }));
        // This models the prior AppState subscription firing after layout has
        // committed the new generation but before passive resubscription.
        staleResult = staleRefresh();
      });
      for (let index = 0; index < 4; index += 1) await Promise.resolve();
    });

    await expect(staleResult).resolves.toBeNull();
    expect(h.getPermission).toHaveBeenCalledTimes(callsBeforeRefocus + 1);
    expect(current?.permissionVerified).toBe(true);
    expect(current?.cameraActive).toBe(true);
  });

  it('auto-requests an undetermined permission once and only on focused entry', async () => {
    h.getPermission.mockResolvedValue(permission('undetermined'));
    h.requestPermission.mockResolvedValueOnce(permission('granted'));
    await mount({ available: true, isFocused: true, autoRequestOnUndetermined: true });

    expect(h.getPermission).toHaveBeenCalledOnce();
    expect(h.requestPermission).toHaveBeenCalledOnce();
    expect(current?.permissionGranted).toBe(true);
    expect(current?.permissionVerified).toBe(true);

    await act(async () => h.appStateListener?.('background'));
    await act(async () => h.appStateListener?.('active'));
    await flushEffects();
    expect(h.getPermission).toHaveBeenCalledTimes(2);
    expect(h.requestPermission).toHaveBeenCalledOnce();
  });
});
