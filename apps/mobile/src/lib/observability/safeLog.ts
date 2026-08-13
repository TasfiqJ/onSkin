type SafeLogError = {
  kind: 'error';
  name: string;
};

function safeErrorName(error: unknown): string {
  try {
    if (error instanceof AggregateError) return 'AggregateError';
    if (error instanceof EvalError) return 'EvalError';
    if (error instanceof RangeError) return 'RangeError';
    if (error instanceof ReferenceError) return 'ReferenceError';
    if (error instanceof SyntaxError) return 'SyntaxError';
    if (error instanceof TypeError) return 'TypeError';
    if (error instanceof URIError) return 'URIError';
    if (error instanceof Error) return 'Error';
    return typeof error;
  } catch {
    return 'unknown';
  }
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
