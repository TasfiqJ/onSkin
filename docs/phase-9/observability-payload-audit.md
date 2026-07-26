# Phase 9 Observability Payload Audit

## Sentry

The app initializes Sentry with `sendDefaultPii: false`, failed request capture disabled, screenshots disabled, view hierarchy disabled, performance tracing disabled, and breadcrumbs disabled. It does not set a stable account or device user identifier, and the global `beforeSend` hook unconditionally removes any SDK-supplied `user` object. This avoids creating a per-account remote event set that Sentry cannot erase without deleting an entire issue. `captureException` passes context through `sanitizeObservabilityContext` before sending `extra`, and passes the throwable through `sanitizeCapturedException` so Sentry receives a generic `redacted_exception` instead of raw exception messages, stacks, causes, or attached fields. The context scrubber keeps only small integer counters from numeric context values and drops app-supplied dates. The global hook also strips request, context, transaction, fingerprint, log entry, thread, span, module, measurement, debug, server-name, SDK-processing, and transaction-source metadata before upload.

The scrubber drops route params, URLs, query strings, product data, barcodes, OCR text, notes, photo paths, receipt-like values, profile/skin/health-adjacent keys, and free-text-looking values. Captured exception names are reduced to safe names, and sensitive names fall back to `Error`.

## PostHog

Direct mobile PostHog construction, capture, identify, and flush are disabled.
`apps/mobile/src/lib/analytics/publicationGate.ts` is default closed and accepts
only an injected transport for an exact nonempty owner and an externally
verified, owner-bound receipt at the current gate generation. It has no event
buffer, persistence, retry, or replay path. `track(...)` sanitizes first and
drops calls unless the gate remains open at the same generation. There is no
non-test production caller of `openAnalyticsPublication(...)`, no
authoritative analytics receipt verifier, and no vendor transport.

Close synchronously discards the current transport and receipt and increments
the generation. Account-deletion admission closes through the synchronous
deletion barrier; Auth account, background, and deletion boundaries close
before prior-owner cleanup or publication drains. Analytics reset closes
before awaiting persistence purge and remains closed if purge fails. Events
attempted before open or after close are dropped, not queued for later replay.

Account-boundary cleanup deletes both PostHog React Native persistence files
and both AsyncStorage fallback keys; it fails closed if any available backend
cannot be cleared. That cleanup addresses legacy SDK residue. The current
publication gate itself never creates queued analytics events.

Analytics props are allowlisted in `apps/mobile/src/lib/analytics/eventRegistry.ts`. No mobile analytics identity helper or identify export remains, so a future caller cannot accidentally bind the raw account UUID through the current API. `sanitizeAnalyticsProps` drops keys not in the registry, sensitive keys, complex values, app-supplied dates, contact-looking strings, URL/path/token-looking strings, prose-like strings that are not compact bucket tokens, sensitive-looking strings, and numeric values that are not small finite integers.

Allowed props must remain buckets or opaque IDs only. Product IDs, rule IDs, content IDs, quiz axes, skin profile outputs, local paths, barcodes, notes, OCR text, scores, and free text are not approved telemetry.

CAT-09 coarse measurement is limited to the fixed vocabularies and formulas in
`docs/phase-10/beta-event-schema.md`: bounded lookup/OCR result and latency
buckets, bounded ingredient-parse result/source/unknown-count buckets, true
search no-match recovery, accepted correction workload, and directional
support impact. Exact duration, timestamp, query, barcode, OCR or ingredient
content, product identity, and free text remain prohibited. Since no transport
is enabled, those formulas are definitions only and have no live values.

## Development Logs

Development/QA warning paths use `devWarn()` and `redactedErrorForLog()` so exception messages, stacks, URLs, tokens, paths, user IDs, and attached fields are not printed when PostHog, Sentry, or RevenueCat setup/capture paths fail.

## Release Requirement

Before enabling analytics or public launch, implement and verify a separate
approved analytics-consent record, an authoritative owner/receipt verifier,
and a reviewed deletion/session-bound injected transport. Complete vendor and
processor terms, region, retention, privacy/legal, and App Privacy review.
Then capture live Sentry and PostHog payload plus withdrawal, account-switch,
deletion, purge-failure, and no-replay evidence from the exact release
candidate and attach screenshots/JSON exports to the release-candidate folder.
Strict scripts fail until `PHASE9_OBSERVABILITY_PAYLOAD_PASS=true`; the current
source gate is not production analytics, dashboard, legal, or App Review
evidence.
