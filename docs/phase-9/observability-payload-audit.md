# Phase 9 Observability Payload Audit

## Sentry

The app initializes Sentry with `sendDefaultPii: false`, failed request capture disabled, screenshots disabled, view hierarchy disabled, performance tracing disabled, and breadcrumbs disabled. `setSentryUser` uses a pseudonymous account ID. `captureException` passes context through `sanitizeObservabilityContext` before sending `extra`, and passes the throwable through `sanitizeCapturedException` so Sentry receives a generic `redacted_exception` instead of raw exception messages, stacks, causes, or attached fields. The context scrubber keeps only small integer counters from numeric context values and drops app-supplied dates. The global `beforeSend` hook also strips request, context, transaction, fingerprint, log entry, thread, span, module, measurement, debug, server-name, SDK-processing, and transaction-source metadata before upload.

The scrubber drops route params, URLs, query strings, product data, barcodes, OCR text, notes, photo paths, receipt-like values, profile/skin/health-adjacent keys, and free-text-looking values. Captured exception names are reduced to safe names, and sensitive names fall back to `Error`.

## PostHog

Analytics props are allowlisted in `apps/mobile/src/lib/analytics/eventRegistry.ts`. `identify` uses a pseudonymous account ID. `sanitizeAnalyticsProps` drops keys not in the registry, sensitive keys, complex values, app-supplied dates, contact-looking strings, sensitive-looking strings, and numeric values that are not small finite integers.

Allowed props must remain buckets or opaque IDs only. Product IDs, rule IDs, content IDs, quiz axes, skin profile outputs, local paths, barcodes, notes, OCR text, scores, and free text are not approved telemetry.

## Development Logs

Development/QA warning paths use `devWarn()` and `redactedErrorForLog()` so exception messages, stacks, URLs, tokens, paths, user IDs, and attached fields are not printed when PostHog, Sentry, or RevenueCat setup/capture paths fail.

## Release Requirement

Before public launch, capture live Sentry and PostHog payload samples from the exact release candidate and attach screenshots/JSON exports to the release-candidate folder. Strict scripts fail until `PHASE9_OBSERVABILITY_PAYLOAD_PASS=true`.
