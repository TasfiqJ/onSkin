type SafeLogError = {
  kind: 'error';
  name: string;
};

const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,48}$/;

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  return SAFE_ERROR_NAME.test(error.name) ? error.name : 'Error';
}

export function redactedErrorForLog(error: unknown): SafeLogError {
  return {
    kind: 'error',
    name: safeErrorName(error),
  };
}

export function devWarn(scope: string, error?: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  if (error === undefined) {
    console.warn(scope);
    return;
  }
  console.warn(scope, redactedErrorForLog(error));
}
