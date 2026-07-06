# Security Fix Plan

## P0/P1 closed in this pass

- SEC-P0-001: RevenueCat webhook now fails closed if verification is not configured.
- SEC-P0-002: Photo metadata RLS and data export now prevent service-role signed URLs for malformed or cross-user photo storage paths.
- SEC-P1-001: Account deletion/sign-out now clears app-owned local private data.
- SEC-P1-002: App-owned local health/routine/payment stores now write encrypted private KV envelopes instead of plaintext AsyncStorage.
- SEC-P1-003: PostHog and Sentry now receive pseudonymous account IDs instead of raw Supabase user IDs.
- SEC-P1-004: Account deletion now preflights provider deletion configuration before destructive storage/auth cleanup.
- SEC-P1-005: The ShopMy order-report service-role poll now requires POST plus a scheduler secret before activation, and the RevenueCat webhook rejects non-POST requests before body work.
- SEC-P1-006: Phase 9 now has an explicit live order-report-poll scheduler harness that proves inert or missing/wrong-secret fail-closed behavior without sending the real scheduler secret.
- SEC-P1-007: Child-table RLS now blocks cross-owner product, Ask-turn, and private community-question foreign-key references from modified clients.
- SEC-P1-008: Consent withdrawal now has a JWT-gated server cleanup function and RLS/storage policies that block future consent-gated writes after revocation.
- SEC-P1-009: Decrypted photo share files and generated shelf share-card tmpfiles are deleted after share attempts.
- SEC-P1-010: Photo sharing no longer promises redaction before face blur/crop exists; it requires explicit image-only confirmation and excludes notes.
- SEC-P1-011: Photo bytes are stripped of EXIF/GPS-style metadata before encrypted storage and before generated share exports.
- SEC-P1-012: Auth session replacement now wipes local private data before accepting a different active Supabase user ID or a known session disappearing outside explicit sign-out.
- SEC-P1-013: Phase 9 live RevenueCat webhook evidence now covers renewal, cancellation, billing issue, and expiration entitlement transitions.
- SEC-P1-014: RevenueCat webhook signature replay tolerance now falls back safely on malformed env values, and public signature failures no longer reveal validation reasons.
- SEC-P1-015: RevenueCat webhook now persists allowlisted event snapshots instead of raw provider webhook JSON in subscription/payment JSON columns.
- SEC-P1-016: RevenueCat webhook now rejects oversized raw request bodies with a bounded pre-parse reader and validates `REVENUECAT_WEBHOOK_MAX_BYTES`.
- SEC-P1-017: Onboarding health-data collection consent now fails closed; the quiz stays locked and stable retry copy appears if the immutable consent ledger write fails.
- SEC-P1-018: Photo capture and encrypted-cloud-backup consent grants now fail closed; local private flags roll back and retry UI stays locked if the immutable consent ledger write fails.
- SEC-P1-019: Account onboarding now waits for the Terms/Privacy consent ledger row before account-created analytics or paywall navigation.
- SEC-P1-020: You-tab partner-sharing grants now roll local commerce consent back off and surface retry UI when the third-party-sharing consent ledger write fails.
- SEC-P1-021: Analytics sanitization now drops photo-quality result labels so guided-capture quality metadata cannot reach PostHog through the generic `result` prop.
- SEC-P1-022: Trend analytics now sends only a generic shown event and no longer exports computed trend state labels or state-specific event names.
- SEC-P1-023: Scheduler pause/recovery analytics now stay generic and no longer export irritation reason or recovery-duration context.
- SEC-P1-024: Local private-data cleanup now resets PostHog and RevenueCat client SDK identities on sign-out, deletion, or session replacement.
- SEC-P2-002: Public waitlist/growth endpoints now require Turnstile in production or when public-form protection is explicitly enabled.
- SEC-P2-003: Phase 9 now has an explicit live Supabase two-user/storage adversarial harness.
- SEC-P2-004: Security scanner coverage is now represented by a checked GitHub Actions workflow.
- SEC-P2-005: Phase 9 now has an explicit live two-user data export/delete harness.
- SEC-P2-006: Phase 9 now has an explicit live public-form Turnstile evidence harness.
- SEC-P2-007: Phase 9 now has an explicit live RevenueCat webhook auth/HMAC/idempotency/refund harness.
- SEC-P2-008: Security workflow actions are pinned to immutable commit SHAs and enforced by a Phase 9 smoke gate.
- SEC-P2-009: Privacy-rights and subscription Edge Functions now return/log stable error codes instead of raw provider/database details.
- SEC-P2-010: Public waitlist/growth endpoints now enforce DB-backed keyed-hash rate limits before Turnstile verification.
- SEC-P2-037: Public waitlist/growth endpoints now reject oversized request bodies with `PUBLIC_FORMS_MAX_BYTES` before parsing or writes.
- SEC-P2-038: Body-parsing user-JWT Edge Functions now reject oversized JSON bodies with `USER_EDGE_BODY_MAX_BYTES` before auth/body parsing work.
- SEC-P2-039: External provider calls now use timed fetches and bounded response readers before parsing Apple, RevenueCat, PostHog, Open Beauty Facts, Turnstile, or ShopMy responses.
- SEC-P2-042: Consent withdrawal now logs only `CONSENT_WITHDRAWAL_FAILED` on cleanup failure instead of raw exception messages.
- SEC-P2-043: RevenueCat entitlement mirror failures now persist only `ENTITLEMENT_WRITE_FAILED` instead of raw database error messages.
- SEC-P2-044: Missing or invalid mobile `EXPO_PUBLIC_APP_ENV` now fails closed to production behavior outside the real dev runtime, so misbuilt release bundles cannot use development payment fallback behavior.
- SEC-P2-045: Production Phase 7 deferred surfaces now fail closed without a real final brand domain, and production release smoke blocks public commerce/community/trend/cloud Ask/widgets/share/recommendation flags unless matching Phase 7 evidence and signoff are present.
- SEC-P2-046: Live Phase 9 harnesses now derive app environment only from real `.env` plus process env, ignore `.env.example` defaults, and fail closed to production when missing or invalid.
- SEC-P2-047: Onboarding profile scoring and persistence now require a complete set of valid quiz answers, so direct reveal/analyzing routes recover to the quiz instead of fabricating a default skin profile.
- SEC-P2-048: Paywall and ProGate pricing now use a shared display helper and explicit unavailable offering state, so missing Store/RevenueCat pricing cannot render as a billable slash-period amount.
- SEC-P2-049: Ask, deferred, shelf, progress-capture, and paywall direct-entry Back/Close controls now replace to a safe app surface when no navigation history exists.
- SEC-P2-050: Public growth attribution now ignores malformed encoded query pairs on mobile and enforces the same URL-safe opaque `share_id` contract in the waitlist/growth-event service-role endpoints.
- SEC-P2-051: Scheduler, routine, commerce, community, conflict/share-card, recommendations, settings, and trend direct-entry exits now use safe tab fallbacks instead of raw history back behavior.
- SEC-P2-052: Shared `Sheet` backdrop dismissals now use typed safe route fallbacks, with shelf sheets returning to Shelf, scheduler sheets returning to Today, and paywall upsell preserving entitlement-aware dismissal.
- SEC-P2-053: Policy, subscription-management, and retailer-link external handoffs now surface invalid or failed opens instead of silently doing nothing.
- SEC-P2-054: Community Skin Note sharing now includes disclaimer/source/reviewer context and alerts if the native share sheet cannot open.
- SEC-P2-055: Progress and Shelf camera permission recovery now alerts if native Settings cannot open instead of silently doing nothing.
- SEC-P2-056: Progress photo capture and Shelf OCR now show stable camera failure recovery instead of inert capture states.
- SEC-P2-057: Onboarding analyzing now waits for local profile persistence before reveal and shows a retry path if saving fails.
- SEC-P2-058: Progress photo detail sharing now surfaces native share/export failures and still deletes temporary decrypted exports.
- SEC-P2-059: Mobile data export now reports unavailable native sharing instead of silently treating an unshared export as successful.
- SEC-P2-060: App-wide and photo-timeline biometric lock prompts now surface native prompt failures with stable copy while keeping user cancellations quiet and retryable.
- SEC-P2-061: App-lock settings and Progress lock copy now use device-neutral wording that fits iOS and Android local-auth methods.
- SEC-P2-062: Trend insight opt-in/revocation now surfaces consent save failures, refreshes stale consent state after failures, and disables the toggle while saving.
- SEC-P2-063: Progress photo capture now saves first-use `photo_capture` consent before opening camera/permission flow, fails closed on persistence errors, and keeps the consent CTA retryable.
- SEC-P2-064: Mobile analytics now blocks sensitive category values and no longer sends recommendation trigger/type, commerce product type, or Ask intent props to PostHog.
- SEC-P2-065: Recommendations now wait for local private preferences/dismissals before rendering, so dismissed "Not for me" suggestions do not flash during cold-start loading.
- SEC-P2-066: Recommendation card footers now wrap long evidence labels on phone-width screens while keeping the `See how` action visible.
- SEC-P2-067: Recommendation preference chips now save local private state before updating visible filters or analytics, disable while saving, and surface stable failure copy.
- SEC-P2-068: Analytics privacy payload audit now catches shorthand sensitive props and fails on sensitive keys; onboarding no longer attempts to send selected goals.
- SEC-P2-069: You-tab marketing, partner-sharing, and cloud-backup privacy toggles now save before visible state or analytics side effects, disable while saving, and surface stable failure copy.
- SEC-P2-070: Cloud Ask consent grant/revoke now saves before visible toggle state, disables while saving, refreshes stale consent state after failures, and records revocation analytics only after withdrawal succeeds.
- SEC-P2-071: Commerce partner-sharing decline analytics now emit only after consent withdrawal succeeds, while local-first relocking still happens before the withdrawal call.
- SEC-P2-072: Notification preference changes now save local private state before reminder rescheduling or visible query state updates, removing the optimistic toggle path on failed persistence.
- SEC-P2-073: Trend-insight revocation analytics now emit only after consent withdrawal succeeds, while local trend state still relocks before the withdrawal call.
- SEC-P2-074: Ask, commerce, community, and trend consent-grant analytics now emit only after the immutable consent ledger write succeeds.
- SEC-P2-075: Ask and Trend consent grants now relock local consent flags and rethrow when the immutable consent ledger write fails.
- SEC-P2-076: Commerce and community consent grants now relock local consent flags when the immutable consent ledger write fails.
- SEC-P2-077: Phase 9 release evidence/signoff claims now require a clean Git worktree and a non-template release-candidate evidence folder with core placeholders filled.
- SEC-P2-078: Analytics event names are now allowlisted, sanitized before vendor capture, and enforced as literal event names by the Phase 9 privacy audit.
- SEC-P2-079: PostHog automatic lifecycle capture is disabled so vendor analytics events only leave through the audited `track()` path.
- SEC-P2-080: Sentry performance tracing and automatic sensitive attachment surfaces are disabled so crash telemetry stays on the sanitized exception path.
- SEC-P2-081: Sentry before-send scrubbing now redacts automatic/unhandled error events and drops request, breadcrumb, and context fields before upload.
- SEC-P2-082: Sentry before-send scrubbing now also drops top-level log entries, thread traces, spans, modules, measurements, debug metadata, server names, and SDK processing metadata before upload.
- SEC-P2-083: Sentry/observability context now drops large or non-integer numeric values, so barcodes, identifiers, or precise derived scores cannot pass through otherwise safe keys.
- SEC-P2-084: Analytics props now drop large or non-integer numeric values, so PostHog receives only small integer counters from approved prop keys.
- SEC-P2-085: Analytics and Sentry context sanitizers now drop custom `Date` values instead of serializing precise app-supplied timestamps to vendors.
- SEC-P2-086: Analytics values now explicitly drop URL, local/content path, query-string, token, JWT, secret, and signed-URL strings even on approved prop keys.
- SEC-P2-087: Analytics string props now must be compact bucket tokens, preventing free-form prose from reaching PostHog through approved keys.
- SEC-P2-088: Phase 9 release smoke now blocks secret-looking `EXPO_PUBLIC_*` names from both `.env.example` and the actual verification environment.
- SEC-P2-089: Phase 9 release smoke now blocks obvious private-looking values from public env keys even when the key name itself is allowed.
- SEC-P2-090: Phase 2 env validation now blocks obvious private-looking values from actual public env keys even when the key name itself is allowed.
- SEC-P2-011: Supabase Edge Functions now have a frozen-lock Deno type/syntax check wired into Phase 9 verification and CI.
- SEC-P2-012: Catalog correction reports now sanitize and allowlist support payload/context JSON before persistence.
- SEC-P2-013: Phase 9 now has an explicit live Edge auth negative-test harness for deployed user-JWT functions.
- SEC-P2-014: Store build inspection now enforces OTA/runtime/channel isolation across development, staging, and production variants.
- SEC-P2-015: Account deletion and data export now reject non-POST execution methods before sensitive data-rights work.
- SEC-P2-016: Catalog lookup no longer accepts side-effecting GET/query-string requests, and live Edge auth coverage now checks valid-JWT non-POST rejection across all user-JWT functions.
- SEC-P2-017: Catalog search and lookup now enforce DB-backed per-user rate limits before request parsing, service-role catalog work, lookup telemetry, or Open Beauty Facts calls.
- SEC-P2-018: Phase 9 now has an explicit live catalog rate-limit harness for deployed 429/keyed-hash evidence.
- SEC-P2-019: Phase 9 live public-form evidence now includes deployed 429/keyed-hash rate-limit checks without writing form rows.
- SEC-P2-020: Phase 9 live Supabase adversarial coverage now includes newer user-owned Ask, community, commerce, catalog telemetry, notification, cycle/ramp/streak, recommendation, and trend tables.
- SEC-P2-021: Community reactions now require a published, claim-safe note and cannot target unpublished/null notes.
- SEC-P2-022: Phase 9 now has an explicit live consent-withdrawal harness for deployed cleanup evidence.
- SEC-P2-023: Commerce, subscription-management, and policy-link external handoffs now use a shared HTTPS/deep-link guard before opening or caching URLs.
- SEC-P2-024: Onboarding, privacy-rights, app-lock, and share-card UI failures now use stable user-facing error copy instead of raw backend/provider exception messages.
- SEC-P2-025: Analytics, Sentry, and RevenueCat dev warnings now log redacted error metadata instead of raw exception objects.
- SEC-P2-040: Analytics tracking no longer prints event names or sanitized props to the development console, and the privacy payload audit blocks reintroduction.
- SEC-P2-041: Sentry capture now scrubs the throwable itself, sending a generic redacted exception instead of raw messages, stacks, or attached error fields.
- SEC-P2-026: Mobile data export now uses a one-time cache file and deletes the plaintext JSON bundle after the share attempt.
- SEC-P2-027: Health-adjacent local notifications now always use generic lock-screen copy, and legacy discretion-off prefs are coerced back to private.
- SEC-P2-028: Supabase session persistence now uses authenticated XChaCha20-Poly1305 envelopes, migrates legacy AES-CTR ciphertext after a valid read, and deletes tampered or malformed stored session values.
- SEC-P2-029: A global neutral privacy shield now covers the app on inactive/background app states, and biometric app lock triggers on inactive/background transitions instead of waiting for `background` only.
- SEC-P2-030: Android Auto Backup is disabled in Expo config and enforced by Phase 9 store-build inspection across resolved dev/staging/prod variants.
- SEC-P2-031: The vulnerable Vite/esbuild dev-server dependency was removed by upgrading Vitest to the Vite 8 toolchain.
- SEC-P2-032: Security workflow scanner results are now uploaded as per-job release evidence artifacts and enforced after upload.
- SEC-P2-033: Security-definer functions and broad RLS policies are now covered by a Phase 9 Supabase policy lint; the reverse-trial expiry RPC is service-role-only and definer functions use empty `search_path`.
- SEC-P2-034: Data export now enforces a keyed-HMAC per-user server-side rate limit before broad export reads or photo signed URL generation.
- SEC-P2-035: The live data-rights harness now proves deployed data-export `429 RATE_LIMITED` behavior and keyed-hash-only `edge_rate_limits` samples under a bounded probe budget.
- SEC-P2-036: Data export photo signed URL TTL is explicit/configurable, and the live data-rights harness can prove deployed URLs expire without storing the signed URL in artifacts.
- SEC-P3-002: Dependency lifecycle install scripts are now inventoried and allowlisted by the Phase 9 dependency SBOM gate.

## Must fix before closed beta

| Priority | Work                                                                                                                                                                                                                                                                                                           | Owner                           | Blocker                                                                                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1       | Deploy the latest RLS/privacy migrations, including `20260705000033_phase9_notification_lock_screen_privacy.sql`, run `phase9:live-supabase-adversarial:strict` in staging/production, and archive generated evidence.                                                                                         | Engineering                     | Staging/production Supabase secrets, latest migrations, and workflow dispatch approval                                                                                                                                                                       |
| P1       | Run `phase9:live-edge-auth:strict` in staging and archive generated missing/invalid JWT, valid-JWT non-POST, oversized-body no-side-effect, and malformed request evidence before setting `PHASE9_EDGE_AUTH_PASS=true`.                                                                                        | Engineering                     | Staging Supabase secrets, deployed Edge Functions with `USER_EDGE_BODY_MAX_BYTES`, `EDGE_EXTERNAL_FETCH_TIMEOUT_MS`, and `EDGE_EXTERNAL_RESPONSE_MAX_BYTES`, and workflow dispatch approval                                                                  |
| P1       | Deploy `consent-withdrawal` plus `20260705000032_phase9_consent_withdrawal.sql`, run `phase9:live-consent-withdrawal:strict`, and archive proof that cloud photo, Ask, trend, community, and commerce cleanup works after revocation.                                                                          | Engineering/privacy owner       | Staging Supabase secrets, deployed Edge Function, latest migrations, and representative seeded rows                                                                                                                                                          |
| P1       | Configure RevenueCat webhook auth/HMAC/max-body settings, run `phase9:live-revenuecat-webhook:strict` for oversized body rejection, initial purchase, renewal, cancellation, billing issue, expiration, duplicate, refund, and raw-payload minimization evidence, and run full native sandbox purchase matrix. | Engineering/founder             | RevenueCat dashboard access, staging Supabase secrets, native test accounts                                                                                                                                                                                  |
| P1       | Deploy the latest `data-export` function, run `phase9:live-data-rights:strict`, verify malformed photo paths are omitted instead of signed, verify data-export returns `429 RATE_LIMITED` with keyed-hash-only limiter samples, and verify exported photo signed URLs expire after the configured TTL.         | Engineering/privacy owner       | Staging Supabase data, deployed Edge Functions, provider deletion secrets, `DATA_EXPORT_RATE_LIMIT_MAX`, `PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX`, short staging `DATA_EXPORT_PHOTO_URL_TTL_SECONDS`, and `PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK=true` |
| P1       | Run `phase9:live-public-forms:strict`, archive missing/invalid/valid-token, oversized-body no-write, plus 429/keyed-hash evidence, and set `PHASE9_PUBLIC_FORMS_PASS=true` only after review.                                                                                                                  | Engineering                     | Cloudflare/Supabase dashboard access, deployed rate-limit migration, valid Turnstile response token, staging `PUBLIC_FORMS_MAX_BYTES`, and staging `PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX`                                                                |
| P1       | Do not configure `SHOPMY_BRAND_API_KEY` until `ORDER_REPORT_POLL_SECRET` is provisioned, `phase9:live-order-report-poll:strict` evidence is archived, and `PHASE9_ORDER_REPORT_POLL_PASS=true` is reviewed.                                                                                                    | Engineering/founder             | ShopMy partner approval, scheduler configuration, secret rotation process, and staging Supabase secrets                                                                                                                                                      |
| P1       | Complete clinical/legal review for claims, pregnancy/irritation copy, privacy policies.                                                                                                                                                                                                                        | Founder/legal/clinical reviewer | Named reviewers                                                                                                                                                                                                                                              |
| P1       | Real-device auth-linking QA must prove anonymous-to-Apple/Google/email transitions either keep the same Supabase user ID or intentionally clear/migrate only the current device owner's local state.                                                                                                           | Engineering                     | Apple/Google app configuration, staging Supabase project, and test accounts                                                                                                                                                                                  |

## Must fix before public launch

| Priority | Work                                                                                                                                                                                                            | Owner                     | Blocker                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | Resolve or accept with rationale the remaining Expo config-tooling npm audit advisory set documented in `docs/phase-9/generated/dependency-inventory.*`.                                                        | Engineering               | Upstream Expo/xcode fix or explicit release risk acceptance                                                                                                       |
| P2       | Run the Security workflow for the RC commit, review/download `code-security-evidence-*`, `secret-scanner-evidence-*`, and `static-scanner-evidence-*`, and archive them with the release packet.                | Engineering               | GitHub Actions access and release-candidate commit selection                                                                                                      |
| P2       | Run `phase9:live-catalog-rate-limit:strict`, archive staging 429/keyed-hash evidence, and set `PHASE9_CATALOG_RATE_LIMIT_PASS=true` only after review.                                                          | Engineering               | Deployed rate-limit migration, `CATALOG_RATE_LIMIT_MAX`, `CATALOG_RATE_LIMIT_WINDOW_SECONDS`, `PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX`, and staging Supabase secrets |
| P2       | Build APK/IPA and run binary/mobile security QA, including Android manifest confirmation that `android:allowBackup="false"` is present and iOS/Android app-switcher snapshot review for the new privacy shield. | Engineering               | EAS/native build artifacts                                                                                                                                        |
| P2       | Archive EAS Update branch/channel screenshots or CLI output proving production/staging/development channel separation.                                                                                          | Engineering               | Expo/EAS project access                                                                                                                                           |
| P2       | Generate final App Store privacy labels and Google Play Data Safety from `DATA_FLOW_MAP.md`.                                                                                                                    | Founder/privacy owner     | Final third-party config                                                                                                                                          |
| P2       | Verify PostHog/Sentry deletion and payload samples.                                                                                                                                                             | Engineering/privacy owner | Vendor dashboards                                                                                                                                                 |

## Backlog hardening

- Keep the live Supabase harness aligned with every new user-owned table/RPC as features move from local-first to server sync.
- Add a Supabase CLI job once project linking and migration credentials exist.
- Add Edge Function unit tests for RevenueCat signature helper behavior if Deno test harness is introduced.
- Expand RevenueCat evidence to dashboard timeline screenshots and native StoreKit/Play Billing purchase/restore/refund/cancel/renewal scenarios.
- Set an action-update cadence so pinned GitHub Action SHAs are refreshed deliberately after changelog review.
- Review dependency install-script allowlist changes deliberately during dependency bumps; any new lifecycle-script package now fails `phase9:dependency-sbom` until reviewed.
- Document iOS backup/keychain restore behavior for encrypted local stores; Android Auto Backup is disabled in app config and checked in Phase 9.
- Add a server-backed migration story if future account linking must preserve local-only onboarding/photo/shelf state across a Supabase user ID change.
- Remove `aes-js` once enough released builds have migrated legacy Supabase session ciphertext to authenticated envelopes.
