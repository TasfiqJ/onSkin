import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { pseudonymousUserId } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { devWarn } from '@/lib/observability/safeLog';
import { sanitizeCapturedException, sanitizeObservabilityContext } from '@/lib/observability/scrub';

let initialized = false;
let sentryUserUpdate = 0;

type SentryInitOptions = Parameters<typeof Sentry.init>[0];
type SentryBeforeSend = NonNullable<SentryInitOptions['beforeSend']>;
type SentryErrorEvent = Parameters<SentryBeforeSend>[0];

function canUseSentry(): boolean {
  return env.sentryDsn.length > 0;
}

function sanitizeSentryTags(tags: SentryErrorEvent['tags']): SentryErrorEvent['tags'] {
  const safeContext = sanitizeObservabilityContext(tags as Record<string, unknown> | undefined);
  const safeTags: Record<string, string> = {};
  for (const [key, value] of Object.entries(safeContext)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safeTags[key] = String(value).slice(0, 80);
    }
  }
  return Object.keys(safeTags).length ? safeTags : undefined;
}

function sanitizeSentryUser(user: SentryErrorEvent['user']): SentryErrorEvent['user'] {
  const id = typeof user?.id === 'string' ? user.id : undefined;
  return id && /^u_[a-f0-9]{32}$/.test(id) ? { id } : undefined;
}

export function sanitizeSentryEvent(event: SentryErrorEvent): SentryErrorEvent {
  const rawType = event.exception?.values?.[0]?.type;
  const rawException = new Error('redacted_exception');
  rawException.name = typeof rawType === 'string' ? rawType : 'Error';
  const safeName = sanitizeCapturedException(rawException).name;
  const safeExtra = sanitizeObservabilityContext(event.extra as Record<string, unknown> | undefined);
  return {
    ...event,
    debug_meta: undefined,
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
    tags: sanitizeSentryTags(event.tags),
    threads: undefined,
    transaction: undefined,
    transaction_info: undefined,
    type: undefined,
    user: sanitizeSentryUser(event.user),
    exception: {
      values: [{ type: safeName, value: 'redacted_exception' }],
    },
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

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    devWarn('[sentry] capture skipped because Sentry is not configured', error);
    return;
  }
  const safeContext = sanitizeObservabilityContext(context);
  const safeError = sanitizeCapturedException(error);
  Sentry.captureException(safeError, Object.keys(safeContext).length ? { extra: safeContext } : undefined);
}

export function capturePhase2TestError(): void {
  captureException(new Error('phase2_sentry_smoke_test'), { source: 'phase2-runbook' });
}
