# PostHog Persisted Queue Retention Checkpoint

Date: 2026-07-21

Scope: local PostHog persisted and live in-memory queue retention, queue/retry bounds, and compatibility with the existing account-deletion storage barrier. This checkpoint does not claim provider-side retention, live release payloads, signed-device lifecycle behavior, or dashboard evidence.

## Implemented

- The custom storage boundary recognizes the installed `posthog-react-native` 4.54.4 event and log file envelopes before the SDK preloads them.
- Event rows older than seven days, more than five minutes ahead of the local clock, or missing a parseable timestamp are discarded.
- A retained row must have the installed SDK's exact queue/message shape, an allowlisted application event and property payload or the narrow internal `$identify` shape, SDK-generated UUIDv7 or the app's `u_` pseudonymous hash, and bounded SDK metadata. Raw account UUIDv4, unknown events, properties, metadata, top-level fields, and person-property writes are discarded.
- Custom application metadata excludes the SDK defaults for device name, manufacturer, locale, timezone, and app display name. Only numeric/dotted release/build and OS values, device class, emulator status, bounded screen dimensions, SDK version, UUIDv7 session identity, person-processing flags, and GeoIP-disable state can persist with an event.
- Prohibited legacy registered super-properties, person/group properties, feature-flag caches, surveys, replay state, and remote configuration are removed before preload and from every later persistence write. This prevents an upgraded installation's disabled SDK caches from adding unreviewed properties to otherwise valid new events.
- Only the newest 256 valid FIFO event rows are retained. Canonical in-bound SDK envelopes without prohibited legacy caches remain byte-for-byte unchanged.
- Persisted event envelopes over 1 MiB, malformed JSON, and unknown versions fail closed to an empty opted-out envelope. The opt-out is intentionally durable and disables later capture until an explicit opt-in.
- The independent PostHog logs queue is always rewritten empty; runtime log capture is also rejected before buffering.
- Preload sanitation is persisted before sanitized bytes are published to the SDK. A concurrent later SDK write is serialized after that repair and cannot be overwritten by stale preload bytes.
- Every SDK persistence write passes through the same age, size, schema, and log-queue boundary.
- The live in-memory SDK queue is revalidated immediately before every SDK flush. This intercepts threshold, periodic, React Native app-state, manual, and shutdown flush calls, preventing a long-running offline process from sending rows that aged out after persistence.
- Runtime transport is fixed to a 20-event flush threshold, 50-event maximum batch, 30-second interval, 256-event queue, one retry after one second, and an eight-second request timeout.
- Session replay, automatic lifecycle-event capture, remote flags, surveys, GeoIP, error autocapture, exception steps, and logs remain disabled. The installed SDK still flushes event persistence on React Native app-state changes.

## Automated Evidence

- Focused PostHog storage, runtime-policy, capture, and deletion-freeze matrix: 4 files / 38 tests pass.
- Mobile TypeScript check passes.
- Targeted lint for the changed analytics files passes with zero warnings.
- Phase 9 analytics source audit and privacy-payload code gates pass; the expected live-payload evidence warning remains.
- Full repository matrix: 4,124 of 4,128 tests pass. The four failures remain isolated to pre-existing dirty-worktree expiry/provenance changes in `behaviouralSnapshot.test.ts` and `useShelf.test.ts`; all 38 changed-slice tests pass.
- The storage matrix covers exact retention/skew boundaries, expiry, event/property/metadata bypasses, raw UUIDv4 rejection, the internal identify shape, legacy-cache cleanup, 300-row truncation, malformed/future/oversized envelopes, cross-file and missing queues, log suppression, durable preload repair, later-write ordering, direct SDK-write sanitation, live pre-flush expiry, and deletion freeze compatibility.

## Evidence Boundary

- This local contract controls only the device-side persisted queue. It does not establish or change PostHog project retention policy.
- The pinned installed SDK routes threshold, timer, app-state, manual, and shutdown delivery through its overridable `flush()` method; the local pre-flush retention wrapper is behaviorally tested. Signed-device background/termination exercise is still required for release evidence.
- Live exact-release payload samples, provider dashboard links, ownership, retention approval, and production alerting remain external gates.
- This slice has no UI behavior change, so the repository's human-simulated UI E2E gate is not applicable.
