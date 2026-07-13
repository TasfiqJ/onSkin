# Open Optimization Decision Packet

Date: 2026-07-13 (America/Toronto)
Branch: `optimization`
Status: decision input only; nothing in this packet is approved

This packet collects the choices that the optimization program cannot make from repository
evidence alone. The authoritative product, architecture, privacy, release, and device-policy
documents must be updated by the named decision process before governed implementation begins.
Safe independent work remains listed so an open choice does not stop unrelated correctness work.

## OPT-DEC-000 — Supported Platform Contract

- Choice required: reconcile the current iOS-only launch contract with older dual-platform
  product, architecture, device-policy, and optimization sources.
- Recommendation: choose one authoritative launch matrix, update every source document together,
  and keep Android implementation work only where the resulting policy requires it.
- Alternatives: iOS-first with an explicitly deferred Android release; or simultaneous iOS and
  Android launch with named device floors and evidence owners.
- User impact: determines availability, QA breadth, accessibility coverage, and support promises.
- Privacy/security impact: both platforms still require equivalent private-storage and account
  isolation guarantees; deferral cannot mean weaker dormant configuration.
- Migration/rollback: documentation and build profiles must remain reversible until a signed
  release is selected; generated policy artifacts must be regenerated from the chosen source.
- Safe work now: platform-neutral data integrity, tests, measurement tooling, and truthful per-
  platform evidence collection.

## OPT-DEC-001 And OPT-DEC-009 — Photo V2 Architecture And Renditions

- Choice required: approve the v2 envelope, narrow native/streaming boundary, associated data,
  dimensions, format, quality, thumbnail/display tiers, migration, rollback, and v1 read period.
- Recommendation: a small symmetric Expo native module that streams authenticated encryption to
  app-private protected files, creates stripped-orientation-normalized JPEG renditions, and never
  exposes production-size base64 or hexadecimal data to JavaScript. Keep v1 reads until a
  journaled migration proves every file and metadata commit.
- Alternatives: remain on the current JavaScript/base64 v1 path with explicit scale limits; or use
  a reviewed maintained native library after dependency/privacy/binary-size analysis.
- User impact: affects capture latency, visual fidelity, storage size, comparison quality, and
  migration reliability.
- Privacy/security impact: must preserve device-only defaults, authenticated envelopes, key-loss
  byte preservation, file protection, backup exclusion, metadata stripping, and zero plaintext
  cache residue.
- Migration/rollback: dual-read, v2-only-write behind a version gate; per-photo journal/checksum;
  never delete v1 until v2 authentication and metadata commit succeed; retain a tested rollback
  reader for the supported app-upgrade window.
- Safe work now: harden v1 journals and read-only behavior, deterministic synthetic fixtures,
  bounded memory measurements, sensitive-image cache policy, and native compatibility research.

## OPT-DEC-002 — Structured Encrypted Local Store

- Choice required: decide whether growing structured state moves from bounded encrypted private
  KV records to an encrypted transactional database.
- Recommendation: do not add a database until measured record growth and outbox requirements
  justify it. If approved, select a maintained Expo-compatible engine with a reviewed key,
  migration, backup, account-isolation, corruption, and rollback design.
- Alternatives: keep strict versioned atomic private-KV stores with declared size ceilings; or
  split only the measured growing entities into a narrow transactional store.
- User impact: affects offline reliability, upgrade time, disk use, and recovery behavior.
- Privacy/security impact: database pages, WAL/journal files, backups, diagnostics, and keys must be
  protected and excluded consistently; unavailable/corrupt must never become empty.
- Migration/rollback: copy-and-verify under a durable migration journal, retain source bytes until
  authenticated count/checksum equality, and support rollback to the prior reader.
- Safe work now: typed strict codecs, atomic transformations, store registry, size limits, and
  simultaneous-writer/key-loss tests.

## OPT-DEC-003 — Encrypted Transactional Outbox

- Choice required: approve entity schema, ordering key, idempotency key, coalescing, conflict
  policy, retry ownership, expiry, and server idempotency contracts.
- Recommendation: begin with one bounded entity whose server mutation is already idempotent. Commit
  local state and encrypted outbox entry atomically, lease entries to one worker, use stable
  operation IDs, and acknowledge only after the server confirms the same operation.
- Alternatives: retain feature-specific queues; or defer offline server synchronization for
  entities whose local state is already the complete product contract.
- User impact: determines offline mutation reliability and conflict presentation.
- Privacy/security impact: payloads must remain encrypted and owner-generation bound; logs and
  metrics may contain only fixed-field content-free state.
- Migration/rollback: feature flag the first entity, keep the previous queue readable, support
  replay without duplicate effects, and provide a queue export/clear recovery path reviewed for
  privacy.
- Safe work now: inventory writes, strengthen server idempotency, define typed failure taxonomy,
  and test lease expiry/duplicate workers in pure code.

## OPT-DEC-004 — Secure Bootstrap And Privacy Shield

- Choice required: approve mounted privacy shield versus full private-tree verification/remount
  behavior, including failure and recovery transitions.
- Recommendation: keep private routes unmounted until app lock, owner isolation, plaintext
  scavenging, key availability, and private-store verification resolve; use one content-free
  recovery surface and remount on a new owner generation.
- Alternatives: maintain a mounted opaque shield only if profiling proves remount cost material and
  a formal truth table proves no private render, effect, query, or accessibility exposure.
- User impact: changes launch/resume latency and recovery UX.
- Privacy/security impact: no private-content flash, stale accessibility tree, background effect,
  or owner-A publication is acceptable.
- Migration/rollback: phase markers and a kill switch must permit return to the current verified
  gate order without changing stored data.
- Safe work now: content-free startup instrumentation and independent gate tests without relaxing
  authorization.

## OPT-DEC-005 And OPT-DEC-010 — Telemetry And Performance Gates

- Choice required: approve the production performance schema and absolute/regression thresholds,
  sample method, threshold owner, and independent signoff owner.
- Recommendation: keep production telemetry disabled beyond the existing allowlist until privacy
  review approves fixed-field content-free aggregates. Establish gates from two comparable signed
  release baselines on supported physical devices.
- Alternatives: local/release-lab profiling only; or a self-hosted aggregate pipeline with the same
  allowlist and retention review.
- User impact: better regression detection versus additional telemetry and operational cost.
- Privacy/security impact: no route parameters, filenames, product/search/photo content, identity,
  tokens, view hierarchy, screenshots, or session replay.
- Migration/rollback: remote-disable schema version, bounded offline queue and expiry, and removal
  path for every new SDK/config field.
- Safe work now: local monotonic markers, deterministic fixtures, raw offline samples, and proposed
  (non-acceptance) targets clearly labeled as proposals.

## OPT-DEC-006 — EAS Update Versus Store-Only Releases

- Choice required: adopt EAS Update with runtime/version/rollback ownership or remove/correct OTA
  claims and operate store-only releases.
- Recommendation: use store-only releases until an owner approves runtime compatibility, migration
  rules, staged rollout, rollback/forward-fix drills, and incident response.
- Alternatives: fully governed EAS Update with immutable runtime versions and a tested rollback
  channel.
- User impact: delivery speed versus binary/runtime consistency and rollback confidence.
- Privacy/security impact: OTA must not bypass store-reviewed native privacy/config changes or load
  JavaScript incompatible with encrypted storage migrations.
- Migration/rollback: no OTA across incompatible storage/native boundaries; every adopted update
  needs a previous-runtime install/upgrade/rollback test.
- Safe work now: signed store-build planning and correcting documentation that implies unavailable
  OTA behavior.

## OPT-DEC-007 — Theme Scope

- Choice required: approve complete dark mode or explicit light-only launch behavior.
- Recommendation: declare light-only until every critical route, system bar, modal, image overlay,
  contrast state, and screenshot is reviewed; do not ship partial automatic dark mode.
- Alternatives: complete semantic-token dark mode with route-by-route visual/accessibility proof.
- User impact: visual preference, readability, battery behavior on OLED, and consistency.
- Privacy/security impact: lock/privacy covers and unavailable/error states must remain opaque and
  legible in either mode.
- Migration/rollback: semantic token flag with a single app-level choice; avoid persisted per-route
  state that complicates rollback.
- Safe work now: theme-independent semantic colors, contrast, system-bar correctness, and text-size
  testing.

## OPT-DEC-008 — Android Macrobenchmark And Baseline Profile Ownership

- Choice required: decide whether the supported Android build/CI setup has a durable owner for
  Macrobenchmark and Baseline Profile generation and regression maintenance.
- Recommendation: defer profile shipping until Android launch scope is authoritative and a signed
  release benchmark device/CI owner exists. Use Perfetto/manual release traces meanwhile.
- Alternatives: a maintained native benchmark module and managed device lane; or no shipped
  Baseline Profile with explicit manual performance gates.
- User impact: potential startup/navigation improvements versus maintenance and stale-profile risk.
- Privacy/security impact: benchmark fixtures must be synthetic and traces sanitized.
- Migration/rollback: profiles must be removable without app data changes and regenerated for
  relevant native/runtime updates.
- Safe work now: release profiling scripts, deterministic flows, and platform-neutral performance
  fixes.

## Required Decision Record

An approval must record the chosen option, accountable owner, date, affected authoritative files,
privacy/security review, migration and rollback plan, measurable acceptance gates, and what would
trigger reversal. Until then, the corresponding ledger item remains open or externally blocked;
passing local tests is not approval.
