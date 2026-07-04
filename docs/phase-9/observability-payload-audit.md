# Phase 9 Observability Payload Audit

## Sentry

The app initializes Sentry with `sendDefaultPii: false`, failed request capture disabled, screenshots disabled, and view hierarchy disabled. `captureException` passes context through `sanitizeObservabilityContext` before sending `extra`.

The scrubber drops route params, URLs, query strings, product data, barcodes, OCR text, notes, photo paths, receipt-like values, profile/skin/health-adjacent keys, and free-text-looking values.

## PostHog

Analytics props are allowlisted in `apps/mobile/src/lib/analytics/eventRegistry.ts`. `sanitizeAnalyticsProps` drops keys not in the registry, sensitive keys, complex values, contact-looking strings, and sensitive-looking strings.

Allowed props must remain buckets or opaque IDs only. Product IDs, rule IDs, content IDs, quiz axes, skin profile outputs, local paths, barcodes, notes, OCR text, scores, and free text are not approved telemetry.

## Release Requirement

Before public launch, capture live Sentry and PostHog payload samples from the exact release candidate and attach screenshots/JSON exports to the release-candidate folder. Strict scripts fail until `PHASE9_OBSERVABILITY_PAYLOAD_PASS=true`.
