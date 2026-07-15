import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import {
  cleanupPlaintextStaging,
  markPlaintextStagingState,
  reservePlaintextStaging,
  type PlaintextStagingHandle,
  type PlaintextStagingState,
} from '@/lib/storage/plaintextStaging';

import type { ConflictShareLink } from './shareLinks';

export const SHARE_CARD_EXPORT_SIZE = { width: 1080, height: 1920 } as const;

const SHARE_OPTIONS = {
  mimeType: 'image/png',
  dialogTitle: 'Share your shelf check',
  UTI: 'public.png',
} as const;

function e2eShareCardExportFailure(): 'unavailable' | 'capture_failure' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const fixture = process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT?.trim().toLowerCase();
  if (fixture === 'unavailable' || fixture === 'share_unavailable') return 'unavailable';
  if (fixture === 'capture_failure' || fixture === 'capture_error') return 'capture_failure';

  return null;
}

class ConflictShareRequestInvalidError extends Error {
  constructor() {
    super('CONFLICT_SHARE_REQUEST_INVALID');
    this.name = 'ConflictShareRequestInvalidError';
  }
}

function assertRequestCurrent(lease: AccountGenerationLease, signal: AbortSignal): void {
  lease.assertCurrent();
  if (signal.aborted) throw new ConflictShareRequestInvalidError();
}

/**
 * Detach a non-mutating native read when either its account lease or its route
 * request is invalidated. The underlying native promise is still observed, but
 * its late value cannot resume the owner-scoped action.
 */
function awaitRequestOperation<T>(
  lease: AccountGenerationLease,
  signal: AbortSignal,
  operation: () => PromiseLike<T>,
): Promise<T> {
  return awaitAccountGenerationLease(lease, () => {
    if (signal.aborted) return Promise.reject(new ConflictShareRequestInvalidError());

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        callback();
      };
      const onAbort = () => finish(() => reject(new ConflictShareRequestInvalidError()));

      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) {
        onAbort();
        return;
      }

      let pending: PromiseLike<T>;
      try {
        pending = operation();
      } catch (error) {
        finish(() => reject(error));
        return;
      }

      void Promise.resolve(pending).then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error)),
      );
    });
  });
}

type ConflictShareCardExporterDependencies = {
  capture: (
    ref: RefObject<View | null>,
    options: {
      width: number;
      height: number;
      format: 'png';
      quality: number;
      result: 'base64';
    },
  ) => Promise<string>;
  cleanup: (handle: PlaintextStagingHandle) => Promise<void>;
  isAvailable: () => Promise<boolean>;
  markState: (handle: PlaintextStagingHandle, state: PlaintextStagingState) => Promise<void>;
  reserve: (purpose: 'conflict_share_png') => Promise<PlaintextStagingHandle>;
  share: (uri: string, options: typeof SHARE_OPTIONS) => Promise<void>;
  writeBase64: (uri: string, value: string) => Promise<void>;
};

/**
 * Build the native export boundary separately so delayed ownership and ordered
 * plaintext cleanup are executable in tests without mounting a React route.
 */
export function createConflictShareCardExporter(deps: ConflictShareCardExporterDependencies) {
  return async function exportConflictShareCard(
    lease: AccountGenerationLease,
    ref: RefObject<View | null>,
    requestSignal: AbortSignal,
  ): Promise<boolean> {
    assertRequestCurrent(lease, requestSignal);
    if (!ref.current) return false;

    const e2eFailure = e2eShareCardExportFailure();
    if (e2eFailure === 'unavailable') return false;
    if (e2eFailure === 'capture_failure') {
      throw new Error('E2E_SHARE_CARD_EXPORT_CAPTURE_FAILURE');
    }

    // view-shot's base64 result is memory-only. A hung capture can therefore
    // detach at the account boundary without leaving an unmanaged tmpfile.
    const base64 = await awaitRequestOperation(lease, requestSignal, () =>
      deps.capture(ref, {
        ...SHARE_CARD_EXPORT_SIZE,
        format: 'png',
        quality: 1,
        result: 'base64',
      }),
    );
    assertRequestCurrent(lease, requestSignal);

    let staging: PlaintextStagingHandle | null = null;
    try {
      staging = await deps.reserve('conflict_share_png');
      assertRequestCurrent(lease, requestSignal);

      await deps.writeBase64(staging.uri, base64);
      assertRequestCurrent(lease, requestSignal);
      await deps.markState(staging, 'plaintext_written');
      assertRequestCurrent(lease, requestSignal);

      let available: boolean;
      try {
        available = await awaitRequestOperation(lease, requestSignal, deps.isAvailable);
      } catch (error) {
        if (lease.signal.aborted || requestSignal.aborted) throw error;
        lease.assertCurrent();
        return false;
      }
      assertRequestCurrent(lease, requestSignal);
      if (!available) return false;

      await deps.markState(staging, 'sharing');
      assertRequestCurrent(lease, requestSignal);
      try {
        // The visible OS share sheet is deliberately drain-held. Owner B must
        // not publish beneath an open sheet that externalizes owner A's card.
        await deps.share(staging.uri, SHARE_OPTIONS);
        assertRequestCurrent(lease, requestSignal);
        return true;
      } catch (error) {
        if (lease.signal.aborted || requestSignal.aborted) throw error;
        lease.assertCurrent();
        return false;
      }
    } finally {
      if (staging) {
        await deps.cleanup(staging);
        assertRequestCurrent(lease, requestSignal);
      }
    }
  };
}

const defaultExporter = createConflictShareCardExporter({
  capture: captureRef,
  reserve: reservePlaintextStaging,
  writeBase64: (uri, value) =>
    FileSystem.writeAsStringAsync(uri, value, {
      encoding: FileSystem.EncodingType.Base64,
    }),
  markState: markPlaintextStagingState,
  isAvailable: Sharing.isAvailableAsync,
  share: Sharing.shareAsync,
  cleanup: cleanupPlaintextStaging,
});

// One-tap watermarked export of the Shelf Conflict Card. Capture stays in
// memory until the initiating owner and route request are revalidated; only
// then is an exact journal-owned PNG created for the native share sheet.
export function shareConflictCard(
  lease: AccountGenerationLease,
  ref: RefObject<View | null>,
  requestSignal: AbortSignal,
): Promise<boolean> {
  return defaultExporter(lease, ref, requestSignal);
}

export type ConflictSharePublication =
  | { type: 'busy'; value: boolean }
  | { type: 'started' }
  | { type: 'link_unavailable' }
  | { type: 'link_created'; link: ConflictShareLink }
  | { type: 'shared'; link: ConflictShareLink }
  | { type: 'share_unavailable'; link: ConflictShareLink }
  | { type: 'failure' };

type RunOwnerOperation = <T>(
  scope: OwnerQueryScope,
  operation: (lease: AccountGenerationLease) => T | Promise<T>,
) => Promise<T>;

type ConflictShareActionCoordinatorDependencies = {
  createLink: () => Promise<ConflictShareLink | null>;
  nextFrame: () => Promise<void>;
  runOwnerOperation?: RunOwnerOperation;
  shareCard: (
    lease: AccountGenerationLease,
    ref: RefObject<View | null>,
    requestSignal: AbortSignal,
  ) => Promise<boolean>;
};

type ConflictShareActionInput = {
  isRouteCurrent: () => boolean;
  ownerScope: OwnerQueryScope;
  publish: (publication: ConflictSharePublication) => void;
  ref: RefObject<View | null>;
};

/**
 * Own one exact route request from the synchronous press through link, capture,
 * native share, and cleanup. Invalidating focus aborts detachable reads while a
 * native share already in progress remains drain-held until its cleanup ends.
 */
export function createConflictShareActionCoordinator(
  deps: ConflictShareActionCoordinatorDependencies,
) {
  const runOwnerOperation = deps.runOwnerOperation ?? runOwnerQueryOperation;
  let requestSequence = 0;
  let activeRequest: { controller: AbortController; id: number } | null = null;

  return {
    invalidate(): void {
      requestSequence += 1;
      activeRequest?.controller.abort();
    },

    isRunning(): boolean {
      return activeRequest !== null;
    },

    start(input: ConflictShareActionInput): Promise<void> | null {
      if (activeRequest || !input.isRouteCurrent()) return null;

      const request = {
        controller: new AbortController(),
        id: ++requestSequence,
      };
      activeRequest = request;
      const canPublish = () =>
        activeRequest === request &&
        requestSequence === request.id &&
        !request.controller.signal.aborted &&
        input.isRouteCurrent();
      const publish = (publication: ConflictSharePublication) => {
        if (canPublish()) input.publish(publication);
      };

      // These publications happen only after the exact single-flight request is
      // installed, and before any native or async operation can complete.
      publish({ type: 'busy', value: true });
      publish({ type: 'started' });

      return runOwnerOperation(input.ownerScope, async (lease) => {
        const link = await awaitRequestOperation(lease, request.controller.signal, deps.createLink);
        assertRequestCurrent(lease, request.controller.signal);
        if (!canPublish()) return;
        if (!link) {
          publish({ type: 'link_unavailable' });
          return;
        }

        publish({ type: 'link_created', link });
        await awaitRequestOperation(lease, request.controller.signal, deps.nextFrame);
        assertRequestCurrent(lease, request.controller.signal);
        if (!canPublish()) return;

        const shared = await deps.shareCard(lease, input.ref, request.controller.signal);
        lease.assertCurrent();
        if (!canPublish()) return;
        publish(shared ? { type: 'shared', link } : { type: 'share_unavailable', link });
      })
        .catch((error: unknown) => {
          if (
            error instanceof AccountGenerationLeaseError ||
            error instanceof ConflictShareRequestInvalidError ||
            !canPublish()
          ) {
            return;
          }
          publish({ type: 'failure' });
        })
        .finally(() => {
          const publishRelease = canPublish();
          if (publishRelease) input.publish({ type: 'busy', value: false });
          if (activeRequest === request) activeRequest = null;
        });
    },
  };
}
