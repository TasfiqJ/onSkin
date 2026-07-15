export const ANONYMOUS_ONBOARDING_REQUEST_SUPERSEDED =
  'ANONYMOUS_ONBOARDING_REQUEST_SUPERSEDED';

export class AnonymousOnboardingRequestSupersededError extends Error {
  readonly code = ANONYMOUS_ONBOARDING_REQUEST_SUPERSEDED;

  constructor() {
    super(ANONYMOUS_ONBOARDING_REQUEST_SUPERSEDED);
    this.name = 'AnonymousOnboardingRequestSupersededError';
  }
}

export function isAnonymousOnboardingRequestSuperseded(error: unknown): boolean {
  return (
    error instanceof AnonymousOnboardingRequestSupersededError ||
    (error instanceof Error && error.message === ANONYMOUS_ONBOARDING_REQUEST_SUPERSEDED)
  );
}

export type ResolvingAnonymousOnboardingHandoff = Readonly<{
  authTransitionEpochAtStart: number;
  phase: 'resolving';
  requestId: number;
}>;

export type AwaitingAnonymousOnboardingHandoff = Readonly<{
  expectedUserId: string;
  minimumSessionPublication: number;
  phase: 'awaiting_publication';
  requestId: number;
}>;

export type PendingAnonymousOnboardingHandoff =
  | AwaitingAnonymousOnboardingHandoff
  | ResolvingAnonymousOnboardingHandoff;

export type AnonymousOnboardingHandoffDecision = 'cancel' | 'navigate' | 'wait';

export function anonymousHandoffNeedsSessionPublication(
  expectedUserId: string,
  publishedUserId: string | null,
  sessionBoundaryActive: boolean,
): boolean {
  return sessionBoundaryActive || publishedUserId !== expectedUserId;
}

export function createPendingAnonymousOnboardingHandoff(input: {
  completedSessionPublication: number;
  expectedUserId: string;
  requestId: number;
  requiresSessionPublication: boolean;
}): AwaitingAnonymousOnboardingHandoff {
  return Object.freeze({
    expectedUserId: input.expectedUserId,
    minimumSessionPublication:
      input.completedSessionPublication + (input.requiresSessionPublication ? 1 : 0),
    phase: 'awaiting_publication',
    requestId: input.requestId,
  });
}

export type AnonymousSessionResolutionDecision =
  | 'apply_returned_session'
  | 'coalesce_same_target'
  | 'superseded_by_newer_target';

/**
 * A getSession/sign-in result may race an auth callback. A callback for the
 * same target is the expected publication and can be coalesced. Once a newer
 * callback names a different target, the returned session is stale and must
 * never be applied over that target.
 */
export function decideAnonymousSessionResolution(input: {
  authTransitionEpochAtStart: number;
  currentAuthTransitionEpoch: number;
  expectedUserId: string;
  latestAuthTargetUserId: string | null;
}): AnonymousSessionResolutionDecision {
  if (input.latestAuthTargetUserId === input.expectedUserId) {
    return 'coalesce_same_target';
  }
  if (input.currentAuthTransitionEpoch !== input.authTransitionEpochAtStart) {
    return 'superseded_by_newer_target';
  }
  return 'apply_returned_session';
}

type WelcomeHandoffCoordinatorOptions = {
  onChange: (handoff: PendingAnonymousOnboardingHandoff | null) => void;
  scheduleAbandonment?: (callback: () => void) => void;
};

export type WelcomeHandoffCoordinator = Readonly<{
  advanceToAwaitingPublication: (input: {
    completedSessionPublication: number;
    expectedUserId: string;
    requestId: number;
    requiresSessionPublication: boolean;
  }) => AwaitingAnonymousOnboardingHandoff | null;
  begin: (authTransitionEpochAtStart: number) => ResolvingAnonymousOnboardingHandoff;
  getCurrent: () => PendingAnonymousOnboardingHandoff | null;
  isCurrent: (requestId: number) => boolean;
  registerConsumer: (isSessionBoundaryActive?: () => boolean) => () => void;
  settle: (requestId: number) => boolean;
}>;

/**
 * Provider-owned lifecycle for Welcome's handoff. The resolving state is
 * published before auth I/O starts, so it survives SessionBoundaryGate's tree
 * remount. Ordinary route blur abandons it after a microtask; that grace keeps
 * React StrictMode effect replay from cancelling a live request. Account-boundary
 * unmounts are retained until the new owner tree registers its consumer.
 */
export function createWelcomeHandoffCoordinator({
  onChange,
  scheduleAbandonment = (callback) => {
    void Promise.resolve().then(callback);
  },
}: WelcomeHandoffCoordinatorOptions): WelcomeHandoffCoordinator {
  let requestSequence = 0;
  let current: PendingAnonymousOnboardingHandoff | null = null;
  let consumerSequence = 0;
  let consumerEpoch = 0;
  const consumers = new Set<number>();

  const publish = (handoff: PendingAnonymousOnboardingHandoff | null) => {
    current = handoff;
    onChange(handoff);
  };

  const isCurrent = (requestId: number) =>
    requestSequence === requestId && current?.requestId === requestId;

  const settle = (requestId: number) => {
    if (!isCurrent(requestId)) return false;
    requestSequence += 1;
    publish(null);
    return true;
  };

  return Object.freeze({
    begin(authTransitionEpochAtStart) {
      const requestId = ++requestSequence;
      const resolving = Object.freeze({
        authTransitionEpochAtStart,
        phase: 'resolving' as const,
        requestId,
      });
      publish(resolving);
      return resolving;
    },
    advanceToAwaitingPublication(input) {
      if (!isCurrent(input.requestId) || current?.phase !== 'resolving') return null;
      const awaiting = createPendingAnonymousOnboardingHandoff(input);
      publish(awaiting);
      return awaiting;
    },
    getCurrent() {
      return current;
    },
    isCurrent,
    registerConsumer(isSessionBoundaryActive = () => false) {
      const consumerId = ++consumerSequence;
      consumers.add(consumerId);
      consumerEpoch += 1;
      let registered = true;

      return () => {
        if (!registered) return;
        registered = false;
        consumers.delete(consumerId);
        const abandonedAtEpoch = ++consumerEpoch;
        if (consumers.size > 0 || isSessionBoundaryActive()) return;

        scheduleAbandonment(() => {
          if (abandonedAtEpoch !== consumerEpoch || consumers.size > 0) {
            return;
          }
          const abandoned = current;
          if (abandoned) settle(abandoned.requestId);
        });
      };
    },
    settle,
  });
}

type AnonymousOnboardingHandoffInput = {
  completedSessionPublication: number;
  initializing: boolean;
  mounted: boolean;
  onboardingGate: 'checking' | 'error' | 'redirect_today' | 'welcome';
  ownerScopeCurrent: boolean;
  pending: AwaitingAnonymousOnboardingHandoff;
  publishedUserId: string | null;
  requestIsLatest: boolean;
};

/**
 * Pure startup handoff state machine. A result from sign-in is only permission
 * to wait: navigation requires a completed publication of the exact requested
 * user under the current account-generation scope.
 */
export function decideAnonymousOnboardingHandoff({
  completedSessionPublication,
  initializing,
  mounted,
  onboardingGate,
  ownerScopeCurrent,
  pending,
  publishedUserId,
  requestIsLatest,
}: AnonymousOnboardingHandoffInput): AnonymousOnboardingHandoffDecision {
  if (!mounted || !requestIsLatest) return 'wait';
  if (initializing || completedSessionPublication < pending.minimumSessionPublication) {
    return 'wait';
  }
  if (!ownerScopeCurrent) return 'wait';
  if (onboardingGate === 'redirect_today') return 'cancel';
  if (onboardingGate !== 'welcome') return 'wait';
  return publishedUserId === pending.expectedUserId ? 'navigate' : 'cancel';
}
