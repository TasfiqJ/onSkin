const OBSERVABILITY_CONTEXT_VALUES = {
  source: new Set(['phase2-runbook']),
} as const;

const SAFE_GENERATED_BUNDLE_LOCATION =
  /(?:(?:app|webpack):\/\/\/)?(?:index(?:\.(?:android|ios|native|web))?\.(?:bundle|js|jsbundle)|main\.(?:bundle|js|jsbundle)):[1-9]\d{0,9}:[1-9]\d{0,9}/;
const MAX_STACK_SOURCE_LENGTH = 32_768;
const MAX_STACK_FRAMES = 256;

export type ObservabilityContext = {
  source?: 'phase2-runbook';
};

export type ScrubbedContext = Partial<Record<keyof ObservabilityContext, string>>;

function safeDataEntries(value: unknown): [string, unknown][] {
  if (!value || typeof value !== 'object') return [];

  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Object.entries(descriptors).flatMap(([key, descriptor]) =>
      'value' in descriptor && descriptor.enumerable ? [[key, descriptor.value]] : [],
    );
  } catch {
    return [];
  }
}

function safeExceptionName(error: unknown): string {
  try {
    if (error instanceof AggregateError) return 'AggregateError';
    if (error instanceof EvalError) return 'EvalError';
    if (error instanceof RangeError) return 'RangeError';
    if (error instanceof ReferenceError) return 'ReferenceError';
    if (error instanceof SyntaxError) return 'SyntaxError';
    if (error instanceof TypeError) return 'TypeError';
    if (error instanceof URIError) return 'URIError';
    if (error instanceof Error) return 'Error';
  } catch {
    return 'Error';
  }
  return 'Error';
}

function safeGeneratedBundleStack(error: unknown): string[] {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) return [];

  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, 'stack');
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') return [];

    const frames: string[] = [];
    for (const line of descriptor.value
      .slice(0, MAX_STACK_SOURCE_LENGTH)
      .split(/\r?\n/, MAX_STACK_FRAMES + 1)) {
      const location = line.match(SAFE_GENERATED_BUNDLE_LOCATION)?.[0];
      if (location) frames.push(`    at ${location}`);
      if (frames.length === MAX_STACK_FRAMES) break;
    }
    return frames;
  } catch {
    return [];
  }
}

export function sanitizeObservabilityContext(context?: unknown): ScrubbedContext {
  const clean: ScrubbedContext = {};

  for (const [key, value] of safeDataEntries(context)) {
    if (key !== 'source' || typeof value !== 'string') continue;
    if (OBSERVABILITY_CONTEXT_VALUES.source.has(value as 'phase2-runbook')) clean.source = value;
  }

  return clean;
}

export function sanitizeCapturedException(error: unknown): Error {
  const safe = new Error('redacted_exception');
  safe.name = safeExceptionName(error);
  const frames = safeGeneratedBundleStack(error);
  safe.stack = `${safe.name}: redacted_exception${frames.length ? `\n${frames.join('\n')}` : ''}`;
  return safe;
}
