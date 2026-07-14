# Phase 9 Observability Payload Audit

## Sentry

The app initializes Sentry with `sendDefaultPii: false`, failed request capture disabled, screenshots disabled, view hierarchy disabled, performance tracing disabled, and breadcrumbs disabled. It does not set a stable account or device user identifier, and the global `beforeSend` hook unconditionally removes any SDK-supplied `user` object. This avoids creating a per-account remote event set that Sentry cannot erase without deleting an entire issue. `captureException` passes context through `sanitizeObservabilityContext` before sending `extra`, and passes the throwable through `sanitizeCapturedException` so Sentry receives a generic `redacted_exception` instead of raw exception messages, stacks, causes, or attached fields. The context scrubber keeps only small integer counters from numeric context values and drops app-supplied dates. The global hook also strips request, context, transaction, fingerprint, log entry, thread, span, module, measurement, debug, server-name, SDK-processing, and transaction-source metadata before upload.

The scrubber drops route params, URLs, query strings, product data, barcodes, OCR text, notes, photo paths, receipt-like values, profile/skin/health-adjacent keys, and free-text-looking values. Captured exception names are reduced to safe names, and sensitive names fall back to `Error`.

## PostHog

Direct mobile PostHog construction, capture, identify, and flush are launch-gated. This is fail-closed while an approved analytics configuration and durable consent state are absent, as required by `USW1-ENG-03`. The public analytics call sites and sanitizer remain so a later barrier-aware server transport cannot bypass the event/field contract. Account-boundary cleanup deletes both PostHog React Native persistence files and both AsyncStorage fallback keys; it fails closed if any available backend cannot be cleared. This prevents previously queued identified events or logs from being replayed after remote account deletion.

Analytics props are allowlisted in `apps/mobile/src/lib/analytics/eventRegistry.ts`. No mobile analytics identity helper or identify export remains, so a future caller cannot accidentally bind the raw account UUID through the current API. `sanitizeAnalyticsProps` drops keys not in the registry, sensitive keys, complex values, app-supplied dates, contact-looking strings, URL/path/token-looking strings, prose-like strings that are not compact bucket tokens, sensitive-looking strings, and numeric values that are not small finite integers.

Allowed props must remain buckets or opaque IDs only. Product IDs, rule IDs, content IDs, quiz axes, skin profile outputs, local paths, barcodes, notes, OCR text, scores, and free text are not approved telemetry.

## Development Logs

Development/QA warning paths use `devWarn()` and `redactedErrorForLog()` so exception messages, stacks, URLs, tokens, paths, user IDs, and attached fields are not printed when PostHog, Sentry, or RevenueCat setup/capture paths fail.

## Release Requirement

Before enabling analytics or public launch, implement and verify an approved consent ledger plus a deletion-barrier-aware transport. Then capture live Sentry and PostHog payload samples from the exact release candidate and attach screenshots/JSON exports to the release-candidate folder. Strict scripts fail until `PHASE9_OBSERVABILITY_PAYLOAD_PASS=true`; the current PostHog gate is not production analytics evidence.
