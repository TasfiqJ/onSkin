import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { pseudonymousUserId } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { devWarn } from '@/lib/observability/safeLog';
import { sanitizeCapturedException, sanitizeObservabilityContext } from '@/lib/observability/scrub';

let initialized = false;
let sentryUserUpdate = 0;

function canUseSentry(): boolean {
  return env.sentryDsn.length > 0;
}

export function initSentry(): void {
  if (initialized || !canUseSentry()) return;

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.appEnvironment,
    sendDefaultPii: false,
    tracesSampleRate: env.appEnvironment === 'production' ? 0.05 : 0.1,
    enableNative: Platform.OS !== 'web',
    enableCaptureFailedRequests: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
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
