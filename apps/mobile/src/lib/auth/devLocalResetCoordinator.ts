export type DevLocalResetCoordinator = Readonly<{
  consumeRedirectAfterSuccessfulPublication: () => boolean;
  isPublicationBlocked: () => boolean;
  requestSingleFlight: (operation: () => Promise<void>) => Promise<void>;
  runIfRequired: (
    targetUserId: string | null,
    canCommitTarget?: () => boolean,
  ) => Promise<boolean>;
}>;

export function latestSessionForDevLocalReset<T>(
  pending: Readonly<{ session: T | null }> | null,
  published: T | null,
): T | null {
  return pending ? pending.session : published;
}

export function createDevLocalResetCoordinator(dependencies: Readonly<{
  claimOwnership: (userId: string) => Promise<void>;
  clearAccountState: () => Promise<void>;
}>): DevLocalResetCoordinator {
  let requestSequence = 0;
  let resetRequired = false;
  let redirectPending = false;
  let requestInFlight: Promise<void> | null = null;

  return {
    requestSingleFlight(operation) {
      if (requestInFlight) return requestInFlight;
      requestSequence += 1;
      resetRequired = true;
      redirectPending = true;
      const request = Promise.resolve().then(operation);
      requestInFlight = request;
      const clearIfCurrent = () => {
        if (requestInFlight === request) requestInFlight = null;
      };
      void request.then(clearIfCurrent, clearIfCurrent);
      return request;
    },

    isPublicationBlocked() {
      return resetRequired;
    },

    async runIfRequired(targetUserId: string | null, canCommitTarget = () => true) {
      if (!resetRequired) return false;
      const requestAtStart = requestSequence;
      await dependencies.clearAccountState();
      if (!canCommitTarget()) return false;
      if (targetUserId) await dependencies.claimOwnership(targetUserId);
      if (!canCommitTarget()) return false;
      if (requestSequence === requestAtStart) resetRequired = false;
      return true;
    },

    consumeRedirectAfterSuccessfulPublication() {
      if (resetRequired || !redirectPending) return false;
      redirectPending = false;
      return true;
    },
  };
}
