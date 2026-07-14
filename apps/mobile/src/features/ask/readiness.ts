export type AskDependencySnapshot = Readonly<{
  isSuccess: boolean;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
}>;

type AskReadinessInput = Readonly<{
  local: readonly AskDependencySnapshot[];
  /** Dev-only route fixture that makes private-quota recovery directly observable. */
  quotaFixtureEnabled: boolean;
  turns: AskDependencySnapshot;
}>;

export type AskReadiness = Readonly<{
  isSuccess: boolean;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
}>;

/**
 * Resolve deterministic route readiness without letting cloud state pause the on-device advisor.
 * Production entitlement/quota failures only disable grounded delivery. The explicit dev fault
 * fixture may still replace the route so its recovery interaction can be exercised end to end.
 */
export function deriveAskReadiness(input: AskReadinessInput): AskReadiness {
  const localSuccess = input.local.every((dependency) => dependency.isSuccess);
  const fixturePending =
    input.quotaFixtureEnabled && !input.turns.isSuccess && !input.turns.isError;
  const fixtureError = input.quotaFixtureEnabled && input.turns.isError;
  const isSuccess = localSuccess && !fixturePending && !fixtureError;
  const isError =
    input.local.some((dependency) => dependency.isError) || fixtureError;

  return {
    isSuccess,
    isError,
    isLoading:
      input.local.some((dependency) => dependency.isLoading) ||
      (input.quotaFixtureEnabled && input.turns.isLoading) ||
      (!isSuccess && !isError),
    isFetching:
      input.local.some((dependency) => dependency.isFetching) ||
      (input.quotaFixtureEnabled && input.turns.isFetching),
  };
}
