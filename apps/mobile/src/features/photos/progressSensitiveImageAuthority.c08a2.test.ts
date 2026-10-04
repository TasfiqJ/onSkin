import * as React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isSensitiveImageRequestCancelled,
  SensitiveImageDecryptCoordinator,
} from './sensitiveImageCoordinatorCore';
import { PhotoImage } from './PhotoImage';
import { PhotoTimelineLockGate } from './PhotoTimelineLockGate';

const mocks = vi.hoisted(() => ({
  appUnlocked: true,
  enabled: true,
  photoTimelineUnlocked: true,
  identityAvailable: true,
  identityGeneration: 7,
  lifecycleActive: true,
  lifecycleListener: null as null | ((event: 'purge' | 'resume') => void),
  purgeSensitiveImageMemory: vi.fn(async () => true),
  requestSensitiveImage: vi.fn(),
  unlockPhotoTimeline: vi.fn(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('expo-image', async () => {
  const ReactModule = await import('react');
  return {
    Image: (props: Record<string, unknown>) => ReactModule.createElement('ExpoImage', props),
  };
});

vi.mock('@/components/ui', () => ({
  StateNotice: 'StateNotice',
  Text: 'Text',
}));

vi.mock('@/theme/tokens', () => ({
  colors: {
    cream: '#fff',
    greigeDeep: '#aaa',
  },
}));

vi.mock('@/lib/applock/AppLockProvider', () => ({
  useAppLock: () => ({
    appUnlocked: mocks.appUnlocked,
    enabled: mocks.enabled,
    photoTimelineUnlocked: mocks.photoTimelineUnlocked,
    unlockPhotoTimeline: mocks.unlockPhotoTimeline,
  }),
}));

vi.mock('@/lib/auth/accountGeneration', () => ({
  captureAccountIdentityGeneration: () => {
    if (!mocks.identityAvailable) throw new Error('IDENTITY_UNAVAILABLE');
    return mocks.identityGeneration;
  },
}));

vi.mock('@/lib/errors/userFacing', () => ({
  appLockUserMessage: () => 'Authentication unavailable',
}));

vi.mock('./encryptedStorage', () => ({
  isEncryptedPhotoUri: (uri: unknown) => typeof uri === 'string' && uri.endsWith('.layerwellphoto'),
}));

vi.mock('./sensitiveImageCoordinator', () => ({
  requestSensitiveImage: (...args: unknown[]) => mocks.requestSensitiveImage(...args),
}));

vi.mock('./sensitiveImageDiskCache', () => ({
  isSensitiveImageDiskCacheMigrationComplete: () => true,
  prepareSensitiveImageDiskCacheMigration: async () => true,
}));

vi.mock('./sensitiveImageMemory', () => ({
  isSensitiveImageLifecycleActive: () => mocks.lifecycleActive,
  purgeSensitiveImageMemory: () => mocks.purgeSensitiveImageMemory(),
  subscribeToSensitiveImageLifecycle: (listener: (event: 'purge' | 'resume') => void) => {
    mocks.lifecycleListener = listener;
    return () => {
      if (mocks.lifecycleListener === listener) mocks.lifecycleListener = null;
    };
  },
}));

vi.mock('./sensitiveImagePolicy', () => ({
  SENSITIVE_IMAGE_CACHE_POLICY: 'none',
  SENSITIVE_IMAGE_TRANSITION_MS: 0,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function sensitiveRequest(promise: Promise<string>, cancel = vi.fn()) {
  return {
    promise,
    cancel,
    promote: vi.fn(),
  };
}

function encryptedPhoto(extra: Record<string, unknown> = {}) {
  return React.createElement(PhotoImage, {
    uri: 'file://photos/photo-a.layerwellphoto',
    photoId: 'photo-a',
    ...extra,
  });
}

function privateProgressSurface() {
  return React.createElement(
    PhotoTimelineLockGate,
    null,
    React.createElement('SensitiveChild', null, encryptedPhoto()),
  );
}

let renderer: ReactTestRenderer | null = null;

async function flush(operation: () => void | Promise<void> = () => undefined) {
  await act(async () => {
    await operation();
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

async function mount(element: React.ReactElement) {
  await flush(() => {
    renderer = create(element);
  });
}

function nodes(type: string): ReactTestInstance[] {
  return renderer?.root.findAll((node) => node.type === type) ?? [];
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  renderer = null;
  mocks.appUnlocked = true;
  mocks.enabled = true;
  mocks.photoTimelineUnlocked = true;
  mocks.identityAvailable = true;
  mocks.identityGeneration = 7;
  mocks.lifecycleActive = true;
  mocks.lifecycleListener = null;
  mocks.purgeSensitiveImageMemory.mockReset();
  mocks.purgeSensitiveImageMemory.mockResolvedValue(true);
  mocks.unlockPhotoTimeline.mockReset();
  mocks.unlockPhotoTimeline.mockResolvedValue('not_authenticated');
  mocks.requestSensitiveImage.mockReset();
  mocks.requestSensitiveImage.mockImplementation(() =>
    sensitiveRequest(Promise.resolve('data:image/jpeg;base64,current')),
  );
});

afterEach(async () => {
  if (renderer) {
    await flush(() => {
      renderer?.unmount();
    });
  }
  renderer = null;
  mocks.lifecycleListener = null;
});

describe.sequential('C-08A2 Progress lock and sensitive-image authority', () => {
  it('withholds a locked direct Progress entry before unlock succeeds and never starts decrypt work', async () => {
    mocks.photoTimelineUnlocked = false;
    mocks.unlockPhotoTimeline.mockReturnValue(new Promise(() => undefined));

    await mount(privateProgressSurface());

    expect(nodes('SensitiveChild')).toHaveLength(0);
    expect(nodes('ExpoImage')).toHaveLength(0);
    expect(mocks.requestSensitiveImage).not.toHaveBeenCalled();
    expect(mocks.purgeSensitiveImageMemory).toHaveBeenCalled();
  });

  it('restores current sensitive content only after a successful timeline unlock', async () => {
    mocks.photoTimelineUnlocked = false;
    const unlock = deferred<'success'>();
    mocks.unlockPhotoTimeline.mockImplementation(async () => {
      const status = await unlock.promise;
      mocks.photoTimelineUnlocked = true;
      return status;
    });

    await mount(privateProgressSurface());
    expect(nodes('SensitiveChild')).toHaveLength(0);
    expect(nodes('ExpoImage')).toHaveLength(0);

    unlock.resolve('success');
    await flush();

    expect(nodes('SensitiveChild')).toHaveLength(1);
    expect(nodes('ExpoImage')).toHaveLength(1);
    expect(nodes('ExpoImage')[0]!.props.source).toEqual({
      uri: 'data:image/jpeg;base64,current',
    });
  });

  it('relock immediately removes visible children, cancels image demand, and purges sensitive memory', async () => {
    const cancel = vi.fn();
    mocks.requestSensitiveImage.mockReturnValue(
      sensitiveRequest(Promise.resolve('data:image/jpeg;base64,current'), cancel),
    );

    await mount(privateProgressSurface());
    expect(nodes('ExpoImage')).toHaveLength(1);
    mocks.purgeSensitiveImageMemory.mockClear();

    mocks.photoTimelineUnlocked = false;
    await flush(() => {
      renderer!.update(privateProgressSurface());
    });

    expect(nodes('SensitiveChild')).toHaveLength(0);
    expect(nodes('ExpoImage')).toHaveLength(0);
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.purgeSensitiveImageMemory).toHaveBeenCalledOnce();
  });

  it('decrypt pending then relock cannot publish a late plaintext result through PhotoImage itself', async () => {
    const completion = deferred<string>();
    const cancel = vi.fn();
    mocks.requestSensitiveImage.mockReturnValue(sensitiveRequest(completion.promise, cancel));

    await mount(encryptedPhoto());
    expect(mocks.requestSensitiveImage).toHaveBeenCalledOnce();
    expect(nodes('ExpoImage')).toHaveLength(0);

    mocks.photoTimelineUnlocked = false;
    await flush(() => {
      renderer!.update(encryptedPhoto());
    });

    expect(cancel).toHaveBeenCalledOnce();
    expect(nodes('ExpoImage')).toHaveLength(0);
    expect(mocks.purgeSensitiveImageMemory).toHaveBeenCalled();

    completion.resolve('data:image/jpeg;base64,stale-after-lock');
    await flush();

    expect(nodes('ExpoImage')).toHaveLength(0);
  });

  it('a decrypt completion is rejected when account identity generation changes before native work returns', async () => {
    let ownerGeneration = 40;
    const completion = deferred<string>();
    const coordinator = new SensitiveImageDecryptCoordinator(() => completion.promise, {
      maxConcurrent: 1,
      getOwnerGeneration: () => ownerGeneration,
    });
    const request = coordinator.request(
      'photo-a:legacy-full:v1',
      'file://photos/photo-a.layerwellphoto',
      'interactive',
      40,
    );
    const outcome = request.promise.catch((error: unknown) => error);

    ownerGeneration = 41;
    completion.resolve('owner-a-plaintext');

    expect(isSensitiveImageRequestCancelled(await outcome)).toBe(true);
    expect(coordinator.snapshot()).toEqual({
      active: 0,
      queued: 0,
      running: 0,
      subscribers: 0,
    });
  });

  it('owner-A PhotoImage demand cannot publish into owner-B after the render generation changes', async () => {
    const ownerA = deferred<string>();
    const ownerB = deferred<string>();
    const ownerACancel = vi.fn();
    const ownerBCancel = vi.fn();

    mocks.identityGeneration = 50;
    mocks.requestSensitiveImage
      .mockImplementationOnce(() => sensitiveRequest(ownerA.promise, ownerACancel))
      .mockImplementationOnce(() => sensitiveRequest(ownerB.promise, ownerBCancel));

    await mount(encryptedPhoto());
    expect(mocks.requestSensitiveImage).toHaveBeenNthCalledWith(
      1,
      'photo-a:legacy-full:v1',
      'file://photos/photo-a.layerwellphoto',
      50,
      expect.objectContaining({ photoId: 'photo-a', rendition: 'original' }),
      'interactive',
    );

    mocks.identityGeneration = 51;
    await flush(() => {
      renderer!.update(encryptedPhoto());
    });

    expect(ownerACancel).toHaveBeenCalledOnce();
    expect(mocks.requestSensitiveImage).toHaveBeenNthCalledWith(
      2,
      'photo-a:legacy-full:v1',
      'file://photos/photo-a.layerwellphoto',
      51,
      expect.objectContaining({ photoId: 'photo-a', rendition: 'original' }),
      'interactive',
    );

    ownerA.resolve('data:image/jpeg;base64,owner-a');
    await flush();
    expect(nodes('ExpoImage')).toHaveLength(0);

    ownerB.resolve('data:image/jpeg;base64,owner-b');
    await flush();
    expect(nodes('ExpoImage')).toHaveLength(1);
    expect(nodes('ExpoImage')[0]!.props.source).toEqual({
      uri: 'data:image/jpeg;base64,owner-b',
    });
  });

  it('coordinator purge cancels consumers and suppresses the old native result before a fresh same-key request runs', async () => {
    const stale = deferred<string>();
    const fresh = deferred<string>();
    const load = vi
      .fn<(uri: string) => Promise<string>>()
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => fresh.promise);
    const coordinator = new SensitiveImageDecryptCoordinator(load, {
      maxConcurrent: 1,
      getOwnerGeneration: () => 60,
    });

    const first = coordinator.request('same-photo', 'encrypted://same');
    const firstOutcome = first.promise.catch((error: unknown) => error);
    coordinator.purge();
    const second = coordinator.request('same-photo', 'encrypted://same');

    expect(isSensitiveImageRequestCancelled(await firstOutcome)).toBe(true);
    expect(load).toHaveBeenCalledOnce();

    stale.resolve('stale');
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    fresh.resolve('fresh');

    await expect(second.promise).resolves.toBe('fresh');
  });

  it('identity-unavailable encrypted photos fail closed without requesting plaintext', async () => {
    const onDisplayError = vi.fn();
    mocks.identityAvailable = false;

    await mount(encryptedPhoto({ onDisplayError }));

    expect(mocks.requestSensitiveImage).not.toHaveBeenCalled();
    expect(nodes('ExpoImage')).toHaveLength(0);
    expect(onDisplayError).toHaveBeenCalledOnce();
  });

  it('a sensitive lifecycle purge immediately removes a resolved native image and requires fresh demand after resume', async () => {
    mocks.requestSensitiveImage
      .mockImplementationOnce(() =>
        sensitiveRequest(Promise.resolve('data:image/jpeg;base64,before-purge')),
      )
      .mockImplementationOnce(() =>
        sensitiveRequest(Promise.resolve('data:image/jpeg;base64,after-resume')),
      );

    await mount(encryptedPhoto());
    expect(nodes('ExpoImage')).toHaveLength(1);
    expect(nodes('ExpoImage')[0]!.props.source).toEqual({
      uri: 'data:image/jpeg;base64,before-purge',
    });

    mocks.lifecycleActive = false;
    await flush(() => {
      mocks.lifecycleListener?.('purge');
    });

    expect(nodes('ExpoImage')).toHaveLength(0);

    mocks.lifecycleActive = true;
    await flush(() => {
      mocks.lifecycleListener?.('resume');
    });

    expect(mocks.requestSensitiveImage).toHaveBeenCalledTimes(2);
    expect(nodes('ExpoImage')).toHaveLength(1);
    expect(nodes('ExpoImage')[0]!.props.source).toEqual({
      uri: 'data:image/jpeg;base64,after-resume',
    });
  });

  it('global app-lock loss hides a still-mounted PhotoImage even if timeline unlock state has not reset yet', async () => {
    await mount(privateProgressSurface());
    expect(nodes('ExpoImage')).toHaveLength(1);
    mocks.purgeSensitiveImageMemory.mockClear();

    mocks.appUnlocked = false;
    await flush(() => {
      renderer!.update(privateProgressSurface());
    });

    expect(nodes('SensitiveChild')).toHaveLength(1);
    expect(nodes('ExpoImage')).toHaveLength(0);
    expect(mocks.purgeSensitiveImageMemory).toHaveBeenCalled();
  });
});
