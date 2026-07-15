import {
  authSessionFingerprintMatches,
  type AccountProvider,
  type AuthSessionFingerprint,
} from './accountUpgrade';

export const PROVIDER_SIGN_IN_IN_FLIGHT = 'PROVIDER_SIGN_IN_IN_FLIGHT';
export const PROVIDER_SIGN_IN_SUPERSEDED = 'PROVIDER_SIGN_IN_SUPERSEDED';

export class ProviderSignInInFlightError extends Error {
  readonly code = PROVIDER_SIGN_IN_IN_FLIGHT;

  constructor() {
    super(PROVIDER_SIGN_IN_IN_FLIGHT);
    this.name = 'ProviderSignInInFlightError';
  }
}

export class ProviderSignInRequestSupersededError extends Error {
  readonly code = PROVIDER_SIGN_IN_SUPERSEDED;

  constructor() {
    super(PROVIDER_SIGN_IN_SUPERSEDED);
    this.name = 'ProviderSignInRequestSupersededError';
  }
}

type ProviderTokenResult = { idToken: string } | null;

export type ProviderTokenRequester = (
  assertRequestCurrent: () => void,
) => Promise<ProviderTokenResult>;

type ProviderSignInRequest = Readonly<{
  authTransitionEpoch: number;
  expectedSession: AuthSessionFingerprint;
  requestId: number;
}>;

export type ProviderSignInRunDependencies = {
  authenticate: (
    provider: AccountProvider,
    token: string,
    expectedSession: AuthSessionFingerprint,
    assertRequestCurrent: () => void,
  ) => Promise<void>;
  getAuthTransitionEpoch: () => number;
  getPublishedSessionFingerprint: () => AuthSessionFingerprint;
  isSessionStable: () => boolean;
};

export type ProviderSignInCoordinator = {
  isInFlight: () => boolean;
  run: (
    provider: AccountProvider,
    requestToken: (assertRequestCurrent: () => void) => Promise<ProviderTokenResult>,
    dependencies: ProviderSignInRunDependencies,
  ) => Promise<boolean>;
};

export type ProviderAuthTransitionTracker = {
  getEpoch: () => number;
  observe: (fingerprint: AuthSessionFingerprint) => boolean;
};

/**
 * Keeps provider implementation modules out of AuthProvider root evaluation.
 * The coordinator invokes this only after installing its synchronous request
 * lock. Reasserting after the module await prevents a stale load from opening
 * native provider UI for a newer auth owner.
 */
export async function requestTokenFromLazyProviderModule(
  loadRequestToken: () => Promise<ProviderTokenRequester>,
  assertRequestCurrent: () => void,
): Promise<ProviderTokenResult> {
  const requestToken = await loadRequestToken();
  assertRequestCurrent();
  return requestToken(assertRequestCurrent);
}

function copyFingerprint(fingerprint: AuthSessionFingerprint): AuthSessionFingerprint {
  if (fingerprint.status === 'signed_out') return Object.freeze({ status: 'signed_out' });
  return Object.freeze({
    identity: fingerprint.identity,
    status: 'signed_in',
    userId: fingerprint.userId,
  });
}

/**
 * Tracks only owner/identity transitions. Access-token refreshes preserve the
 * exact fingerprint and must not supersede a valid native provider prompt.
 */
export function createProviderAuthTransitionTracker(
  initialFingerprint: AuthSessionFingerprint,
): ProviderAuthTransitionTracker {
  let currentFingerprint = copyFingerprint(initialFingerprint);
  let epoch = 0;

  return {
    getEpoch: () => epoch,
    observe(fingerprint) {
      if (authSessionFingerprintMatches(currentFingerprint, fingerprint)) return false;
      currentFingerprint = copyFingerprint(fingerprint);
      epoch += 1;
      return true;
    },
  };
}

/**
 * Owns provider prompt lifecycle independently from the auth mutation itself.
 * The active request is installed synchronously, before the first native await,
 * so Apple and Google cannot overlap or apply a token to a newer auth owner.
 */
export function createProviderSignInCoordinator(): ProviderSignInCoordinator {
  let activeRequest: ProviderSignInRequest | null = null;
  let nextRequestId = 0;

  function assertCurrent(
    request: ProviderSignInRequest,
    dependencies: ProviderSignInRunDependencies,
  ): void {
    if (
      activeRequest?.requestId !== request.requestId ||
      dependencies.getAuthTransitionEpoch() !== request.authTransitionEpoch ||
      !dependencies.isSessionStable()
    ) {
      throw new ProviderSignInRequestSupersededError();
    }
  }

  return {
    isInFlight: () => activeRequest !== null,
    run(provider, requestToken, dependencies) {
      if (activeRequest) return Promise.reject(new ProviderSignInInFlightError());
      if (!dependencies.isSessionStable()) {
        return Promise.reject(new ProviderSignInRequestSupersededError());
      }

      const request = Object.freeze({
        authTransitionEpoch: dependencies.getAuthTransitionEpoch(),
        expectedSession: copyFingerprint(dependencies.getPublishedSessionFingerprint()),
        requestId: ++nextRequestId,
      });
      activeRequest = request;

      return (async () => {
        try {
          const assertRequestCurrent = () => assertCurrent(request, dependencies);
          assertRequestCurrent();
          const result = await requestToken(assertRequestCurrent);
          assertRequestCurrent();
          if (!result) return false;

          await dependencies.authenticate(
            provider,
            result.idToken,
            request.expectedSession,
            assertRequestCurrent,
          );
          return true;
        } finally {
          if (activeRequest?.requestId === request.requestId) activeRequest = null;
        }
      })();
    },
  };
}
