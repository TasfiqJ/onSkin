import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { pseudonymousUserId } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { devWarn } from '@/lib/observability/safeLog';
import {
  type ObservabilityContext,
  sanitizeCapturedException,
  sanitizeObservabilityContext,
} from '@/lib/observability/scrub';

let initialized = false;
let sentryUserUpdate = 0;

type SentryInitOptions = Parameters<typeof Sentry.init>[0];
type SentryBeforeSend = NonNullable<SentryInitOptions['beforeSend']>;
type SentryErrorEvent = Parameters<SentryBeforeSend>[0];

function canUseSentry(): boolean {
  return env.sentryDsn.length > 0;
}

function safeDataProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeSentryTags(tags: SentryErrorEvent['tags']): SentryErrorEvent['tags'] {
  const appEnvironment = safeDataProperty(tags, 'app_environment');
  return appEnvironment === 'development' ||
    appEnvironment === 'staging' ||
    appEnvironment === 'production'
    ? { app_environment: appEnvironment }
    : undefined;
}

function sanitizeSentryUser(user: SentryErrorEvent['user']): SentryErrorEvent['user'] {
  const rawId = safeDataProperty(user, 'id');
  const id = typeof rawId === 'string' ? rawId : undefined;
  return id && /^u_[a-f0-9]{32}$/.test(id) ? { id } : undefined;
}

function safeArrayValues(value: unknown, maximum: number): unknown[] {
  try {
    if (!Array.isArray(value)) return [];
    const length = safeDataProperty(value, 'length');
    if (!Number.isSafeInteger(length) || Number(length) < 0) return [];
    const items: unknown[] = [];
    for (let index = 0; index < Math.min(Number(length), maximum); index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor)) return [];
      items.push(descriptor.value);
    }
    return items;
  } catch {
    return [];
  }
}

function safeInteger(value: unknown, maximum = 2_147_483_647): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum
    ? Number(value)
    : undefined;
}

function safeToken(value: unknown, pattern: RegExp, maximum: number): string | undefined {
  return typeof value === 'string' && value.length <= maximum && pattern.test(value)
    ? value
    : undefined;
}

const SAFE_GENERATED_BUNDLE_PATH =
  /^(?:(?:app|webpack):\/\/\/)?(?:index(?:\.(?:android|ios|native|web))?\.(?:bundle|js|jsbundle)|main\.(?:bundle|js|jsbundle))$/;
const SAFE_HEX_ADDRESS = /^0x[0-9a-f]{1,16}$/i;
const SAFE_DEBUG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_EXCEPTION_TYPES = new Set([
  'AggregateError',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);

function sanitizeSentryFrame(frame: unknown): Record<string, unknown> | undefined {
  const filename = safeToken(safeDataProperty(frame, 'filename'), SAFE_GENERATED_BUNDLE_PATH, 80);
  const absPath = safeToken(safeDataProperty(frame, 'abs_path'), SAFE_GENERATED_BUNDLE_PATH, 80);
  const instructionAddress = safeToken(
    safeDataProperty(frame, 'instruction_addr'),
    SAFE_HEX_ADDRESS,
    18,
  );
  if (!filename && !absPath && !instructionAddress) return undefined;

  const clean: Record<string, unknown> = {};
  if (filename) clean.filename = filename;
  if (absPath) clean.abs_path = absPath;
  if (instructionAddress) clean.instruction_addr = instructionAddress;
  const lineNumber = safeInteger(safeDataProperty(frame, 'lineno'));
  const columnNumber = safeInteger(safeDataProperty(frame, 'colno'));
  const inApp = safeDataProperty(frame, 'in_app');
  if (lineNumber !== undefined) clean.lineno = lineNumber;
  if (columnNumber !== undefined) clean.colno = columnNumber;
  if (typeof inApp === 'boolean') clean.in_app = inApp;
  return clean;
}

function sanitizeSentryStacktrace(stacktrace: unknown): Record<string, unknown> | undefined {
  const frames = safeArrayValues(safeDataProperty(stacktrace, 'frames'), 256)
    .map(sanitizeSentryFrame)
    .filter((frame): frame is Record<string, unknown> => Boolean(frame));
  return frames.length ? { frames } : undefined;
}

function sanitizeSentryException(exception: unknown): Record<string, unknown> {
  const values = safeArrayValues(safeDataProperty(exception, 'values'), 4).map((value) => {
    const rawType = safeDataProperty(value, 'type');
    const clean: Record<string, unknown> = {
      type: typeof rawType === 'string' && SAFE_EXCEPTION_TYPES.has(rawType) ? rawType : 'Error',
      value: 'redacted_exception',
    };
    const stacktrace = sanitizeSentryStacktrace(safeDataProperty(value, 'stacktrace'));
    if (stacktrace) clean.stacktrace = stacktrace;
    return clean;
  });
  return { values: values.length ? values : [{ type: 'Error', value: 'redacted_exception' }] };
}

function sanitizeSentryDebugImage(image: unknown): Record<string, unknown> | undefined {
  const imageType = safeDataProperty(image, 'type');
  const debugId = safeToken(safeDataProperty(image, 'debug_id'), SAFE_DEBUG_ID, 36);
  if (imageType === 'sourcemap') {
    const codeFile = safeToken(
      safeDataProperty(image, 'code_file'),
      SAFE_GENERATED_BUNDLE_PATH,
      80,
    );
    return debugId && codeFile
      ? { type: 'sourcemap', code_file: codeFile, debug_id: debugId }
      : undefined;
  }
  if (imageType !== 'macho') return undefined;
  const imageAddress = safeToken(safeDataProperty(image, 'image_addr'), SAFE_HEX_ADDRESS, 18);
  const imageSize = safeInteger(safeDataProperty(image, 'image_size'));
  if (!debugId || !imageAddress || imageSize === undefined) return undefined;

  const clean: Record<string, unknown> = {
    type: 'macho',
    debug_id: debugId,
    image_addr: imageAddress,
    image_size: imageSize,
  };
  const codeId = safeToken(safeDataProperty(image, 'code_id'), /^[0-9a-f]{8,64}$/i, 64);
  const rawCodeFile = safeDataProperty(image, 'code_file');
  if (codeId) clean.code_id = codeId;
  if (typeof rawCodeFile === 'string') {
    const codeFile = rawCodeFile.split(/[\\/]/).at(-1);
    if (codeFile && /^[A-Za-z0-9_.-]{1,80}$/.test(codeFile)) clean.code_file = codeFile;
  }
  return clean;
}

function sanitizeSentryDebugMeta(debugMeta: unknown): Record<string, unknown> | undefined {
  const images = safeArrayValues(safeDataProperty(debugMeta, 'images'), 4096)
    .map(sanitizeSentryDebugImage)
    .filter((image): image is Record<string, unknown> => Boolean(image));
  return images.length ? { images } : undefined;
}

export function sanitizeSentryEvent(event: SentryErrorEvent): SentryErrorEvent {
  const safeExtra = sanitizeObservabilityContext(safeDataProperty(event, 'extra'));
  const eventId = safeToken(safeDataProperty(event, 'event_id'), /^[0-9a-f]{32}$/i, 32);
  const timestamp = safeDataProperty(event, 'timestamp');
  const level = safeToken(
    safeDataProperty(event, 'level'),
    /^(?:debug|info|warning|error|fatal|log)$/,
    7,
  );
  const platform = safeToken(safeDataProperty(event, 'platform'), /^(?:javascript|cocoa)$/, 10);
  const release = safeToken(
    safeDataProperty(event, 'release'),
    /^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+\+[A-Za-z0-9_.-]+$/,
    160,
  );
  const dist = safeToken(safeDataProperty(event, 'dist'), /^(?:dev|[A-Za-z0-9_.-]{1,40})$/, 40);
  const environment = safeDataProperty(event, 'environment');
  const safeEnvironment =
    environment === 'development' || environment === 'staging' || environment === 'production'
      ? environment
      : undefined;

  return {
    type: undefined,
    event_id: eventId,
    timestamp:
      typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0
        ? timestamp
        : undefined,
    level: level as SentryErrorEvent['level'],
    platform,
    release,
    dist,
    environment: safeEnvironment,
    debug_meta: sanitizeSentryDebugMeta(safeDataProperty(event, 'debug_meta')),
    logentry: undefined,
    message: 'redacted_exception',
    breadcrumbs: undefined,
    contexts: undefined,
    extra: Object.keys(safeExtra).length ? safeExtra : undefined,
    fingerprint: undefined,
    measurements: undefined,
    modules: undefined,
    request: undefined,
    sdkProcessingMetadata: undefined,
    server_name: undefined,
    spans: undefined,
    start_timestamp: undefined,
    tags: sanitizeSentryTags(safeDataProperty(event, 'tags') as SentryErrorEvent['tags']),
    threads: undefined,
    transaction: undefined,
    transaction_info: undefined,
    user: sanitizeSentryUser(safeDataProperty(event, 'user') as SentryErrorEvent['user']),
    exception: sanitizeSentryException(safeDataProperty(event, 'exception')),
  };
}

export function initSentry(): void {
  if (initialized || !canUseSentry()) return;

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.appEnvironment,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableNative: Platform.OS !== 'web',
    enableCaptureFailedRequests: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeSentryEvent,
  });

  Sentry.setTag('app_environment', env.appEnvironment);
  initialized = true;
}

export function setSentryUser(userId: string | null): void {
  if (!initialized) return;
  const update = ++sentryUserUpdate;
  if (!userId) {
    Sentry.setUser(null);
    return;
  }

  void pseudonymousUserId(userId)
    .then((id) => {
      if (initialized && update === sentryUserUpdate) Sentry.setUser({ id });
    })
    .catch(() => {
      if (update === sentryUserUpdate) Sentry.setUser(null);
    });
}

export function captureException(error: unknown, context?: ObservabilityContext): void {
  if (!initialized) {
    devWarn('[sentry] capture skipped because Sentry is not configured', error);
    return;
  }
  const safeContext = sanitizeObservabilityContext(context);
  const safeError = sanitizeCapturedException(error);
  Sentry.captureException(
    safeError,
    Object.keys(safeContext).length ? { extra: safeContext } : undefined,
  );
}

export function capturePhase2TestError(): void {
  captureException(new Error('phase2_sentry_smoke_test'), { source: 'phase2-runbook' });
}
