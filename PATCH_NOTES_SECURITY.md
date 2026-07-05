# Security Patch Notes

## RevenueCat webhook

- File: `supabase/functions/revenuecat-webhook/index.ts`
- Change: Requests now return `503 webhook verification not configured` when neither `REVENUECAT_WEBHOOK_AUTH` nor `REVENUECAT_WEBHOOK_SIGNING_SECRET` exists.
- Why safe: The function is intended to be deployed without Supabase JWT verification, so it must fail closed unless an external webhook verifier is configured.
- Regression: `scripts/phase9/edge-auth-smoke.mjs` now checks this fail-closed condition.

## Service-role scheduler activation gates

- Files: `supabase/functions/order-report-poll/index.ts`, `supabase/functions/revenuecat-webhook/index.ts`, `scripts/phase9/live-order-report-poll.mjs`, `.env.example`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/live-revenuecat-webhook.mjs`, `scripts/phase9/release-smoke.mjs`.
- Change: RevenueCat webhook now rejects non-`POST` methods before raw body parsing. The ShopMy order-report poll now rejects non-`POST` methods, remains a no-op without `SHOPMY_BRAND_API_KEY`, and fails closed with `scheduler_secret_not_configured` or `unauthorized` once the brand key is configured unless `ORDER_REPORT_POLL_SECRET` is supplied by the scheduler.
- Why safe: Both functions are intended to run without Supabase user JWTs. The webhook should only accept provider deliveries, and the scheduled service-role poll must not become a public trigger for external API spend or order-attribution writes after ShopMy approval.
- Regression: Phase 9 Edge auth smoke requires POST-only webhook/poll behavior, scheduler secret checks, fail-closed poll activation, pre-ShopMy-call authorization, and a live order-report-poll harness that does not read/send the real scheduler secret. Release smoke blocks `SHOPMY_BRAND_API_KEY` without `ORDER_REPORT_POLL_SECRET`; the live RevenueCat harness includes a non-POST no-write check.

## Live order-report-poll scheduler harness

- Files: `scripts/phase9/live-order-report-poll.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`, `.github/workflows/security.yml`, `.env.example`, `package.json`.
- Change: Added an explicit-flag live harness for deployed `order-report-poll`. It verifies non-`POST` rejection, verifies missing and wrong scheduler secrets do not write `order_attributions`, supports a staging activation expectation flag, refuses production unless separately allowed, writes evidence artifacts, and intentionally avoids the authorized scheduler success path so it cannot call the ShopMy Order Report API.
- Why safe: The order-report poll is a service-role path. This gives staging proof of inert/fail-closed behavior without exposing `ORDER_REPORT_POLL_SECRET` to CI or triggering external commerce ingestion.
- Regression: Phase 9 Edge auth smoke requires the harness, production guard, no real scheduler-secret access, no-write checks, and activated-env expectations. Security CI smoke requires the manual workflow step and rejects passing the real scheduler secret into that job. Release smoke adds `PHASE9_ORDER_REPORT_POLL_PASS`.

## Notification lock-screen privacy

- Files: `apps/mobile/src/features/notifications/copy.ts`, `apps/mobile/src/features/notifications/deliver.ts`, `apps/mobile/src/features/notifications/store.ts`, `apps/mobile/src/features/notifications/useNotifications.ts`, `apps/mobile/src/app/settings/timing.tsx`, `supabase/migrations/20260705000033_phase9_notification_lock_screen_privacy.sql`, `scripts/phase9/privacy-payload-audit.mjs`.
- Change: OS notification payloads for routine, photo-capture, shelf, ramp, and winback nudges now always use the generic lock-screen copy helper. Legacy or modified-client attempts to save `lockscreenDiscreet: false` are coerced to true locally and in the Supabase mirror, the settings screen no longer exposes a discretion-off switch, and the database now rejects `notification_preferences.lockscreen_discreet = false`.
- Why safe: Lock-screen text is visible outside the authenticated app context. Progress-photo, product, ingredient, skin, or escalation language should stay inside the app even if a user previously disabled discretion or restores an old local preference.
- Regression: Notification claims-safety tests prove all OS notification payloads use `OnSkin` plus generic body copy and deny sensitive reminder terms. Notification store tests prove legacy and new false discretion values cannot persist or mirror. Phase 9 privacy payload audit now fails if delivery stops using the generic helper, the discretion-off settings switch returns, or the database constraint disappears.

## Local private data wipe

- Files: `apps/mobile/src/features/settings/localPrivateData.ts`, `localPrivateDataKeys.ts`, `settings/actions.ts`, `lib/auth/AuthProvider.tsx`.
- Change: Sign-out and successful account deletion clear registered local storage keys, SecureStore content keys, encrypted photo files, generated export/share cache files, and scheduled local notifications.
- Why safe: Prevents stale health-adjacent data from a deleted/signed-out account appearing to the next user on the same device.
- Regression: `localPrivateDataKeys.test.ts` scans source for `onskin.*` storage keys and requires them to be in the wipe registry.

## Auth session boundary wipe

- Files: `apps/mobile/src/lib/auth/AuthProvider.tsx`, `apps/mobile/src/lib/auth/sessionBoundary.ts`, `apps/mobile/src/lib/auth/sessionBoundary.test.ts`.
- Change: Auth state changes now compare the last accepted Supabase user ID to the next session. If a known session disappears or the user ID changes without using the explicit sign-out path, the provider holds UI in `initializing`, clears local private data, and only then accepts the new session. If cleanup fails, the provider signs out and does not accept the replacement session.
- Why safe: Supabase provider sign-in, remote invalidation, or a modified client can replace the current session without calling the app's `signOut()`. The previous account's local shelf, skin profile, photo metadata, routine, notification, and entitlement stores must not be visible to the next active account.
- Regression: `sessionBoundary.test.ts` proves initial restore and first sign-in are preserved, same-user refresh does not wipe stores, and sign-out/user-ID replacement requires a wipe.

## App-switcher privacy shield

- Files: `apps/mobile/src/lib/applock/AppLockProvider.tsx`, `apps/mobile/src/lib/applock/privacyState.ts`, `apps/mobile/src/lib/applock/privacyState.test.ts`.
- Change: `AppLockProvider` now renders a neutral full-screen privacy shield whenever app state is not `active`, regardless of whether biometric app lock is enabled. When biometric app lock is enabled, inactive/background transitions set the app lock immediately, and biometric prompts are deferred until the app returns active.
- Why safe: The OS app switcher can snapshot the current React Native view while the app is transitioning through `inactive` or `background`. A health-adjacent app should not expose photos, routines, product shelf, or Ask/community screens in that snapshot.
- Regression: `privacyState.test.ts` proves every non-active app state shows the privacy shield and that app-lock only locks on non-active states when enabled.

## Android backup disabled

- Files: `apps/mobile/app.base.json`, `scripts/phase9/store-build-inspect.mjs`.
- Change: Android Auto Backup is explicitly disabled with `expo.android.allowBackup=false`. The Phase 9 store-build inspection now blocks if the base app config or any resolved dev/staging/prod variant enables Android backup, and the generated inspection artifact records the resolved backup posture.
- Why safe: The app stores health-adjacent encrypted local records, encrypted progress-photo envelopes, session ciphertext, generated cache files, and consent/entitlement state on device. Disabling Android Auto Backup prevents those app-owned files from being copied to and restored from Google Drive backup.
- Regression: `phase9:store-build-inspect` verifies the setting in base and resolved app configs. Binary QA must still inspect the built Android manifest for `android:allowBackup="false"`.

## Encrypted local private KV

- File: `apps/mobile/src/lib/storage/privateKV.ts`.
- Change: Added XChaCha20-Poly1305 encrypted storage wrapper with a SecureStore-held content key.
- Migrated: onboarding skin profile, shelf, completions, routine/cycle/ramp, recommendations, photo metadata/consents, Ask/trend/commerce/community state, notification prefs/logs, entitlement cache, review prompt, app lock flag, and offline completion queue.
- Why safe: Values already in plaintext remain readable for migration; future writes are encrypted envelopes in AsyncStorage.
- Remaining risk: Native platform backup behavior needs device QA and policy documentation.

## Authenticated Supabase session storage

- Files: `apps/mobile/src/lib/supabase/largeSecureStore.ts`, `apps/mobile/src/lib/supabase/largeSecureStoreCrypto.ts`, `apps/mobile/src/lib/supabase/largeSecureStoreCrypto.test.ts`.
- Change: Supabase session persistence now stores an authenticated XChaCha20-Poly1305 envelope in AsyncStorage with the content key kept in SecureStore. Legacy AES-CTR session blobs are read only as a migration source and are rewritten as authenticated envelopes after successful decrypt. Tampered, malformed, plaintext, or keyless stored values are removed and return `null`.
- Why safe: Supabase access and refresh tokens must have integrity as well as confidentiality at rest. AES-CTR does not authenticate ciphertext, so local tampering could produce corrupted session JSON instead of a hard failure.
- Regression: `largeSecureStoreCrypto.test.ts` proves authenticated round-trip without raw token strings, tamper rejection, malformed/plaintext rejection, and legacy AES-CTR migration detection.

## Pseudonymous observability identity

- Files: `apps/mobile/src/lib/analytics/track.ts`, `apps/mobile/src/lib/observability/sentry.ts`, `apps/mobile/src/lib/analytics/track.test.ts`, `scripts/phase9/privacy-payload-audit.mjs`.
- Change: PostHog `identify` and Sentry `setUser` now receive a deterministic SHA-256 pseudonymous ID instead of the raw Supabase user ID. Dev analytics logs no longer print the raw user ID. Account deletion deletes both the current pseudonymous PostHog identity and the legacy raw user ID identity used by earlier builds.
- Why safe: Observability still has a stable account-level join key, but account identifiers are minimized before reaching third-party SDKs or logs.
- Regression: Analytics unit tests assert pseudonymous ID shape/stability; Phase 9 privacy audit fails if PostHog/Sentry identity paths stop using pseudonymous IDs; Phase 9 data-rights smoke fails if PostHog deletion stops targeting the pseudonymous identity.

## Public form Turnstile gate

- Files: `supabase/functions/waitlist/index.ts`, `supabase/functions/growth-event/index.ts`, `.env.example`, `scripts/phase2/check-env.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/live-public-forms.mjs`.
- Change: Production waitlist and growth-event requests must pass Cloudflare Turnstile. Functions fail closed with `503 turnstile not configured` when the server secret is missing and return `403` for missing or failed challenge tokens.
- Why safe: These endpoints use service-role inserts and are intentionally public, so production must not accept anonymous bulk writes without a challenge.
- Regression: Phase 9 edge auth smoke now requires Turnstile verification and fail-closed handling on both public endpoints; live public-form harness verifies missing/invalid token rejection and optional valid-token writes.

## Public form rate limits

- Files: `supabase/migrations/20260705000029_phase9_edge_rate_limits.sql`, `supabase/functions/waitlist/index.ts`, `supabase/functions/growth-event/index.ts`, `.env.example`, `scripts/phase2/check-env.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/edge-auth-smoke.mjs`.
- Change: Public waitlist and growth-event POSTs now call `consume_edge_rate_limit` before Turnstile verification. Request identity is HMAC-keyed with the server-only Supabase secret before storage; raw IPs and user agents are not persisted. Over-limit callers receive `429 rate limited` with `Retry-After`, and limiter errors fail closed with `503 rate limit unavailable`.
- Why safe: The functions write through a service-role client, so abuse control must survive Edge Function scaling and cannot rely on in-memory counters.
- Regression: Phase 9 edge auth smoke verifies both handlers use the RPC, keyed-hash request identity, rate-limit before Turnstile, return 429, and that the SQL function is RLS-backed, `SECURITY DEFINER`, empty-search-path, and service-role-only.

## Public form body limit

- Files: `supabase/functions/waitlist/index.ts`, `supabase/functions/growth-event/index.ts`, `.env.example`, `.github/workflows/security.yml`, `scripts/phase9/live-public-forms.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/security-ci-smoke.mjs`.
- Change: Added `PUBLIC_FORMS_MAX_BYTES`, defaulting to 8,192 bytes and bounded from 1,024 to 65,536 bytes. Waitlist and growth-event now reject oversized `Content-Length` before the rate-limit RPC, read bodies through a bounded stream, accept only JSON/text JSON or URL-encoded form posts, and return `413 payload too large` or `415 unsupported media type` before Turnstile verification or writes.
- Why safe: Public marketing endpoints need only small text fields. Bounding body size prevents anonymous memory/cost amplification and rejects file-like submissions that are outside the endpoint contract.
- Regression: Static Edge auth smoke enforces the body cap, ordering, and `413` path. Release smoke validates the env range, CI passes the staging value into strict evidence, and the live public-form harness sends oversized waitlist/growth canaries and proves no rows are written.

## Edge Function Deno check

- Files: `scripts/phase9/edge-functions-check.mjs`, `supabase/functions/deno.lock`, `.github/workflows/security.yml`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/security-ci-smoke.mjs`, `package.json`.
- Change: Added a Deno type/syntax check for every `supabase/functions/*/index.ts` entrypoint using `--no-config`, a scoped frozen lock, and Deno npm resolution for Supabase JSR dependencies. Security CI now installs Deno from a pinned action before `phase9:verify`.
- Fixes found by the check: account deletion/data export/RevenueCat helper Supabase client parameter types no longer collapse table writes to `never`; reverse-trial cleanup no longer calls `.catch()` on a PostgREST RPC builder.
- Why safe: This verifies the Deno runtime surface directly instead of relying only on app TypeScript checks, and the scoped lock avoids dragging the mobile app dependency graph into Edge Function verification.
- Regression: `phase9:verify` now runs `phase9:edge-functions-check`; `phase9:security-ci-smoke` requires pinned Deno setup in CI.

## Catalog report payload minimization

- Files: `supabase/functions/catalog-report/index.ts`, `apps/mobile/src/features/catalog/client.ts`, `apps/mobile/src/app/shelf/[id].tsx`, `scripts/phase9/edge-auth-smoke.mjs`.
- Change: Catalog correction reports now reject unknown top-level request fields, allowlist proposed payload and client context keys, reject invalid object shapes, filter sensitive support text, normalize `sourceUrl` values without query strings, reject non-finite numeric values, and persist only sanitized objects. The mobile caller no longer sends local shelf product IDs in report context.
- Why safe: The endpoint is authenticated and owner-scoped, but support/catalog rows should not become an arbitrary store for tokens, local file paths, notes, health details, or durable local identifiers from modified clients.
- Regression: Phase 9 Edge auth smoke fails if catalog-report drops the schema allowlists, sensitive filter, URL normalization, finite-number guard, sanitized persistence, or mobile context ID minimization. Deno check validates the Edge Function runtime surface.

## Live Edge auth harness

- Files: `scripts/phase9/live-edge-auth.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `.github/workflows/security.yml`, `.env.example`, `package.json`.
- Change: Added an explicit-flag live harness for deployed user-JWT Edge Functions. It creates a temporary staging user, checks missing and invalid JWT rejection for account deletion, data export, subscription grants, and catalog functions, verifies data-rights functions reject valid-JWT non-POST methods without deleting the user, verifies malformed subscription actions do not write grants, verifies catalog lookup/search malformed inputs do not create lookup events, verifies catalog-report bad JSON/unknown/nested payload rejection, verifies sanitized catalog-report persistence, writes evidence artifacts, and cleans up created rows/users.
- Why safe: The script refuses to run unless `PHASE9_RUN_LIVE_EDGE_AUTH=true`; production requires `PHASE9_ALLOW_PRODUCTION_LIVE_EDGE_AUTH=true`. It avoids account-deletion success and subscription-grant success paths, and only writes a temporary catalog correction row that it deletes.
- Regression: `phase9:verify` now includes the not-run harness gate; Edge auth and CI smoke gates require the harness, production guard, evidence artifacts, coverage strings, and manual staging workflow step.

## User-JWT Edge body limits

- Files: `supabase/functions/_shared/body.ts`, `supabase/functions/account-deletion/index.ts`, `supabase/functions/consent-withdrawal/index.ts`, `supabase/functions/subscription-grants/index.ts`, `supabase/functions/catalog-search/index.ts`, `supabase/functions/catalog-lookup/index.ts`, `supabase/functions/catalog-report/index.ts`, `.env.example`, `scripts/phase2/check-env.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/live-edge-auth.mjs`, `scripts/phase9/release-smoke.mjs`.
- Change: Added `USER_EDGE_BODY_MAX_BYTES`, defaulting to 16,384 bytes and bounded from 1,024 to 65,536 bytes. Body-parsing user-JWT Edge Functions now reject oversized `Content-Length` values before auth/body parsing and use a streaming capped JSON reader that cancels oversized bodies and returns `413 payload_too_large`.
- Why safe: These endpoints only need small JSON command bodies. Bounding them closes a memory/cost amplification path for authenticated or token-stuffing attackers and prevents sensitive service-role flows from reading unbounded bodies.
- Regression: Phase 9 Edge auth smoke enforces the shared helper, per-function ordering, and `413` path. Live Edge auth now sends oversized bodies to every body-parsing user-JWT function and proves no user deletion, entitlement/grant, catalog telemetry, or consent side effects occur.

## External provider fetch bounds

- Files: `supabase/functions/_shared/fetch.ts`, `supabase/functions/account-deletion/index.ts`, `supabase/functions/catalog-lookup/index.ts`, `supabase/functions/waitlist/index.ts`, `supabase/functions/growth-event/index.ts`, `supabase/functions/order-report-poll/index.ts`, `.env.example`, `scripts/phase2/check-env.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/data-rights-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`.
- Change: Added `EDGE_EXTERNAL_FETCH_TIMEOUT_MS`, defaulting to 5,000 ms and bounded from 1,000 to 30,000 ms, plus `EDGE_EXTERNAL_RESPONSE_MAX_BYTES`, defaulting to 262,144 bytes and bounded from 1,024 to 1,048,576 bytes. Apple, RevenueCat, PostHog, Open Beauty Facts, Cloudflare Turnstile, and ShopMy calls now use `fetchWithTimeout` and capped response text/JSON readers instead of raw `fetch`, direct `.json()`, or direct `.text()`.
- Why safe: These provider responses are outside the app's trust boundary. Timeouts prevent hung outbound calls from tying up Edge Function work, and capped response reads prevent oversized provider or network-error responses from creating memory/cost amplification before the function returns a stable failure.
- Regression: Phase 9 Edge auth smoke enforces the shared helper, timeout/response env ranges, and raw provider fetch/parse bans across provider-backed functions. Data-rights smoke enforces the account-deletion provider paths. Release smoke and Phase 2 env checks require explicit staging/production values.

## Data-rights method enforcement

- Files: `supabase/functions/account-deletion/index.ts`, `supabase/functions/data-export/index.ts`, `scripts/phase9/data-rights-smoke.mjs`, `scripts/phase9/live-edge-auth.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `docs/phase-9/edge-function-auth-matrix.md`.
- Change: Account deletion and data export now return early for CORS `OPTIONS` and reject every non-`POST` execution request with `405 METHOD_NOT_ALLOWED` before parsing bodies, resolving auth, or performing service-role work.
- Why safe: These are sensitive privacy-rights actions. Requiring `POST` prevents unexpected `GET`, crawler, prefetch, proxy, or client-bug invocations from reaching deletion/export logic even when a valid bearer token is present.
- Regression: Phase 9 data-rights smoke requires the method guards before sensitive work; live Edge auth now verifies valid-JWT `GET` calls to both data-rights functions return `METHOD_NOT_ALLOWED` and do not delete the test user.

## Consent withdrawal enforcement

- Files: `supabase/functions/consent-withdrawal/index.ts`, `supabase/migrations/20260705000032_phase9_consent_withdrawal.sql`, `apps/mobile/src/lib/consent/withdrawal.ts`, `apps/mobile/src/features/photos/consent.ts`, `apps/mobile/src/features/trend/consent.ts`, `apps/mobile/src/features/community/consent.ts`, `apps/mobile/src/features/commerce/consent.ts`, `apps/mobile/src/features/ask/consent.ts`, `scripts/phase9/consent-withdrawal-smoke.mjs`, `scripts/phase9/live-supabase-adversarial.mjs`, `scripts/phase9/rls-adversarial.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/live-edge-auth.mjs`, `docs/phase-9/edge-function-auth-matrix.md`.
- Change: Added a JWT-gated, POST-only `consent-withdrawal` Edge Function that validates body shape, appends a false consent ledger row, and performs caller-scoped cleanup: cloud photo storage paths are removed only when they belong to the caller and photo metadata is relocalized; Ask safety-audit content, photo trend rows, community questions/reactions/reports/blocks, and commerce click rows are deleted; order attributions are detached from caller click tokens. Mobile revocation helpers now call this server path after local relocking. A new migration adds `has_current_consent()` and restrictive RLS/storage policies so modified clients cannot create cloud photo objects/metadata, photo trend rows, commerce clicks, community reactions, Ask sessions, Ask turn audit rows, or Ask safety audit rows without a current latest grant.
- Why safe: Revocation can no longer be only a local flag. The function derives the user from the caller JWT, never accepts a user ID in the request body, returns aggregate cleanup counts only, and uses stable public/log error codes. The RLS/storage policies close future-collection paths even if a user modifies the app bundle after withdrawing consent.
- Regression: `phase9:consent-withdrawal` checks the Edge Function cleanup and mobile call paths, requires stable `CONSENT_WITHDRAWAL_FAILED` logging, and rejects raw exception-message logging. `phase9:rls-adversarial` checks the current-consent policies. The live Supabase harness now grants then revokes each consent and proves follow-up sensitive writes are blocked. Live Edge auth verifies non-POST `consent-withdrawal` calls do not write consent rows.

## Live consent-withdrawal harness

- Files: `scripts/phase9/live-consent-withdrawal.mjs`, `scripts/phase9/consent-withdrawal-smoke.mjs`, `.github/workflows/security.yml`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`, `.env.example`, `package.json`, `scripts/phase9/live-data-rights.mjs`.
- Change: Added an explicit-flag live harness for deployed `consent-withdrawal`. It creates a temporary staging user, seeds cloud photo backup, Ask safety audit, photo trend, community rows, commerce clicks, and order attributions, invokes each granular withdrawal type, verifies a false revocation ledger row with `revoked_at`, verifies promised cleanup occurred, writes redacted evidence artifacts, and refuses production unless separately allowed. The live data-rights harness now creates `photo_cloud_backup` and `data_sharing` grants before cloud photo and commerce seed writes so it matches the new consent-enforced RLS.
- Why safe: The live harness gives privacy-rights evidence without requiring production data or real customer rows. It uses only temporary synthetic records and cleans up auth users, storage objects, order-attribution rows, and synthetic community content.
- Regression: `phase9:verify` now includes `phase9:live-consent-withdrawal` in not-run mode; `phase9:consent-withdrawal` requires the harness, artifact path, production guard, and cleanup checks; `phase9:security-ci-smoke` requires a manual strict staging workflow step.

## User-JWT Edge Function method enforcement

- Files: `supabase/functions/catalog-lookup/index.ts`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/live-edge-auth.mjs`, `docs/phase-9/edge-function-auth-matrix.md`.
- Change: Catalog lookup no longer supports barcode lookup through `GET` query strings and now rejects non-`POST` methods before auth resolution, service-role catalog reads, lookup-event writes, or optional Open Beauty Facts calls. The live Edge auth harness now checks valid-JWT non-POST rejection across all user-JWT Edge Functions.
- Why safe: Catalog lookup is authenticated but side-effecting: it writes caller lookup telemetry and may trigger an external catalog request. GET support increases prefetch/crawler/proxy and accidental invocation risk without being used by the mobile app.
- Regression: Phase 9 Edge auth smoke fails if any user-JWT Edge Function advertises side-effecting GET, resolves auth before method rejection, or reintroduces catalog lookup query-string barcodes. The live harness verifies valid-JWT GET requests do not delete the user or create subscription grants, entitlements, or catalog lookup events.

## Authenticated catalog rate limits

- Files: `supabase/functions/catalog-search/index.ts`, `supabase/functions/catalog-lookup/index.ts`, `.env.example`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `docs/phase-9/edge-function-auth-matrix.md`.
- Change: Catalog search and lookup now call `consume_edge_rate_limit` after JWT validation but before request parsing, service-role catalog reads, lookup telemetry writes, or Open Beauty Facts fetches. The limiter stores an HMAC keyed by the server-only Supabase secret over `scope|userId`; raw user IDs are not persisted. Limiter failures fail closed with `503 rate_limit_unavailable`, and over-limit callers receive `429 rate_limited` with `Retry-After`.
- Why safe: These functions are authenticated, but a modified client could still create cost, telemetry noise, or third-party catalog load. The shared Postgres limiter survives Edge Function scaling and keeps abuse-control state server-side.
- Regression: Phase 9 Edge auth smoke requires catalog-specific limiter env vars, HMAC key hashing, the shared RPC, fail-closed errors, `429` behavior, and ordering before request body parsing or catalog work. Release smoke requires explicit catalog limit configuration.

## Live catalog rate-limit harness

- Files: `scripts/phase9/live-catalog-rate-limit.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`, `.github/workflows/security.yml`, `.env.example`, `package.json`.
- Change: Added an explicit-flag live harness for deployed catalog search/lookup rate limits. It creates a temporary staging user, exhausts `catalog-search` with a too-short query and `catalog-lookup` with an invalid barcode so no catalog lookup telemetry or Open Beauty Facts calls are needed, verifies deployed `429 rate_limited` responses, checks keyed-hash-only `edge_rate_limits` rows, writes redacted evidence artifacts, and refuses production unless separately allowed.
- Why safe: The previous static gate proved the code path existed, but public launch needs deployed behavior evidence. The harness is bounded by `PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX` and uses safe request bodies that stop after the limiter/body-validation path.
- Regression: Phase 9 Edge auth smoke requires the harness, production guard, safe probes, HMAC-derived keyed-hash checks, and redacted artifacts. Security CI smoke requires a manual-only strict workflow step. Release smoke adds `PHASE9_CATALOG_RATE_LIMIT_PASS` and probe-cap validation.

## External URL handoff guard

- Files: `apps/mobile/src/lib/navigation/externalUrl.ts`, `apps/mobile/src/features/commerce/attribution.ts`, `apps/mobile/src/features/commerce/links.ts`, `apps/mobile/src/features/commerce/WhereToBuy.tsx`, `apps/mobile/src/features/subscription/store.ts`, `apps/mobile/src/lib/iap/revenuecat.ts`, `apps/mobile/src/features/subscription/ComplianceRow.tsx`, `apps/mobile/src/app/settings/subscription.tsx`, `apps/mobile/src/app/(tabs)/you.tsx`.
- Change: Added a shared URL boundary for external handoffs. The app now opens or caches only normalized HTTPS URLs with no embedded credentials, strips fragments before handoff, filters unsafe where-to-buy rows before rendering, returns `null` instead of appending attribution tokens to unsafe retailer URLs, avoids click-event writes when the tap target is unsafe, sanitizes RevenueCat/Supabase subscription management URLs, and applies the same guard to policy links.
- Why safe: Commerce/catalog and subscription-management URLs can originate outside the static mobile bundle. A malformed URL should not deep-link into the app, open custom schemes, carry credentials, or receive an opaque attribution token. The fallback behavior keeps subscription management functional through Apple/Google store URLs.
- Regression: `externalUrl.test.ts` covers allowed/rejected URL forms and fragment stripping. Commerce attribution/resolution tests prove unsafe URLs fail closed and only the opaque `oref` parameter is added to validated URLs.

## Stable user-facing error copy

- Files: `apps/mobile/src/lib/errors/userFacing.ts`, `apps/mobile/src/app/onboarding/account.tsx`, `apps/mobile/src/app/(tabs)/you.tsx`, `apps/mobile/src/app/share/conflict/[ruleId].tsx`.
- Change: Added a small stable error-copy mapper and replaced raw `Error.message` display in onboarding auth, data export, health-data withdrawal, account deletion, app-lock enablement, and share-card export. Known auth cases still get useful copy for invalid/expired OTPs, rate limits, network issues, and cancellations; unknown/provider/backend failures use generic copy.
- Why safe: Supabase, OAuth, local-auth, filesystem, and Edge Function exceptions can include table names, provider codes, paths, tokens, user IDs, or stack-adjacent text. These values should not be shown in customer-facing alerts or onboarding screens.
- Regression: `userFacing.test.ts` proves raw backend/provider details are not reflected, and a source scan confirms alert paths no longer interpolate caught exception messages.

## Redacted dev exception logging

- Files: `apps/mobile/src/lib/observability/safeLog.ts`, `apps/mobile/src/lib/analytics/track.ts`, `apps/mobile/src/lib/observability/sentry.ts`, `apps/mobile/src/lib/auth/AuthProvider.tsx`, `scripts/phase9/privacy-payload-audit.mjs`.
- Change: Added `devWarn()` and `redactedErrorForLog()` so development/QA warnings log only a safe error kind/name. PostHog initialization/capture/identify failures, Sentry skipped-capture warnings, and RevenueCat setup failures no longer pass raw exception objects to `console.warn`.
- Why safe: Raw exception objects can carry message, stack, signed URLs, JWT fragments, local file paths, user IDs, provider response bodies, or arbitrary attached fields. Development logs often get copied into bug reports and screenshots, so they need the same minimization stance as vendor telemetry.
- Regression: `safeLog.test.ts` verifies messages, stacks, URLs, tokens, paths, user IDs, and attached fields are not logged. `phase9:privacy-payload-audit` now fails if raw exception-object console logging returns in mobile source.

## Analytics dev-console minimization

- Files: `apps/mobile/src/lib/analytics/track.ts`, `scripts/phase9/privacy-payload-audit.mjs`, `scripts/phase9/build-release-qa-packet.mjs`.
- Change: Removed development `console.log` calls from `track()` and `identify()`. Analytics events and sanitized props still go through the PostHog sanitizer/vendor path when configured, but local dev/QA consoles no longer print event names or props.
- Why safe: Even sanitized event names can reveal health-adjacent behavior such as photo capture, Ask usage, skin-note viewing, routine activity, commerce taps, subscription events, or consent changes. Development logs are commonly attached to support and QA tickets, so they should not contain routine telemetry.
- Regression: `phase9:privacy-payload-audit` now fails if analytics tracking reintroduces `console.log`, and the release QA packet now hashes that audit script. `track.test.ts` continues to verify sensitive analytics keys/values are dropped and raw user IDs are pseudonymized before vendor identity calls.

## Sentry throwable sanitization

- Files: `apps/mobile/src/lib/observability/scrub.ts`, `apps/mobile/src/lib/observability/sentry.ts`, `apps/mobile/src/lib/observability/scrub.test.ts`, `scripts/phase9/privacy-payload-audit.mjs`, `docs/phase-9/observability-payload-audit.md`.
- Change: Added `sanitizeCapturedException()` and changed `captureException()` to send Sentry a generic `redacted_exception` error with a safe name instead of the original throwable. Sentry context is still passed through `sanitizeObservabilityContext`.
- Why safe: Even when `extra` context is scrubbed, raw exception objects can include sensitive messages, stack text, URLs, local file paths, provider responses, tokens, user identifiers, OCR/product text, or attached fields. Crash reporting should not receive those values for a health-adjacent app.
- Regression: `scrub.test.ts` proves captured exceptions do not carry sensitive messages, stack fragments, or sensitive names. `phase9:privacy-payload-audit` now requires throwable sanitization and fails if `Sentry.captureException(error, ...)` returns.

## Data export cache cleanup

- Files: `apps/mobile/src/features/settings/actions.ts`, `apps/mobile/src/features/settings/localPrivateDataKeys.ts`, `scripts/phase9/data-rights-smoke.mjs`.
- Change: Mobile data export now requires a real cache directory, writes the JSON bundle to a unique `onskin-export-*` cache file inside a cleanup `try/finally`, hands that file to the OS share sheet, and deletes it after the write/share attempt. The local private-data cleanup registry now also removes stale one-time export cache files.
- Why safe: The export bundle contains the user's health-adjacent account data. It should not remain as a stable plaintext file in app cache after the intentional share handoff, and stale files should be swept during sign-out/account deletion cleanup.
- Regression: `phase9:data-rights-smoke` fails if the mobile export path returns to the legacy stable filename, writes outside the cleanup block, or stops deleting the plaintext cache file after sharing.

## Generated share cache cleanup

- Files: `apps/mobile/src/features/photos/encryptedStorage.ts`, `apps/mobile/src/app/progress/[id].tsx`, `apps/mobile/src/features/growth/shareCard.ts`, `scripts/phase9/privacy-payload-audit.mjs`.
- Change: Decrypted photo share files now use sanitized, unique `onskin-share-*` cache filenames and a scoped cleanup helper that deletes only generated cache files, never the original source photo URI. Photo detail sharing deletes generated share files in a `finally` block. Shelf share-card PNG tmpfiles are also deleted in a `finally` block when sharing succeeds, fails, or is unavailable.
- Why safe: Progress photos are sensitive health-adjacent data. Even when a user intentionally opens a share sheet, the app should not leave a decrypted copy or generated social image in local cache after the handoff.
- Regression: `phase9:privacy-payload-audit` fails if photo/share-card cache cleanup, cache-directory guards, filename sanitization, or scoped deletion disappears.

## Photo share redaction promise removal

- Files: `apps/mobile/src/app/progress/[id].tsx`, `apps/mobile/src/features/photos/copy.ts`, `scripts/phase9/privacy-payload-audit.mjs`.
- Change: The progress-photo detail screen no longer labels the export action as "Share with redaction." Before exporting, it now shows an explicit confirmation that the user is sharing the selected photo image, the image is not blurred, and notes are not included.
- Why safe: A redaction promise is a privacy guarantee. Until face blur/crop is implemented and verified on device, the app must not imply that exported progress photos are redacted.
- Regression: `phase9:privacy-payload-audit` fails if the old redaction wording returns, if the image-only confirmation disappears, or if the confirmation stops disclosing the unblurred/no-notes behavior.

## Photo EXIF/GPS metadata stripping

- Files: `apps/mobile/src/features/photos/metadata.ts`, `apps/mobile/src/features/photos/encryptedStorage.ts`, `apps/mobile/src/features/photos/metadata.test.ts`, `scripts/phase9/privacy-payload-audit.mjs`.
- Change: Added a dependency-free metadata scrubber for JPEG and PNG image bytes. Captured photos are stripped before encryption, and decrypted legacy encrypted photos are stripped again before generated share files are written.
- Why safe: Camera `exif: false` is useful but should not be the only privacy boundary. If a platform preserves metadata despite that flag, or if a legacy/imported image reaches the helper, GPS/location/camera metadata must not persist in encrypted storage or leave through the OS share sheet.
- Regression: `metadata.test.ts` proves JPEG EXIF/IPTC/comment and PNG EXIF/text/time chunks are removed. `phase9:privacy-payload-audit` fails if storage/share no longer call the metadata stripper.

## OTA and build channel isolation

- Files: `apps/mobile/eas.json`, `scripts/phase9/store-build-inspect.mjs`, `docs/phase-9/generated/store-build-inspection.json`.
- Change: Production EAS builds now explicitly use `distribution: store`. Store build inspection validates fingerprint runtime policy, local app version source, channel/env parity for development/staging/production, internal distribution for non-production, no production development client, and resolved app config isolation for display name, scheme, iOS bundle identifier, Android package, `extra.appVariant`, and `extra.appEnvironment`.
- Why safe: A staging or development OTA update must not be able to target production binaries, and native-incompatible updates must stay scoped by the fingerprint runtime policy.
- Regression: `phase9:store-build-inspect` now fails if a build profile can publish to the wrong channel or if resolved variant identifiers collapse back to production values.

## Cross-owner FK RLS hardening

- Files: `supabase/migrations/20260705000030_phase9_cross_owner_fk_rls.sql`, `scripts/phase9/live-supabase-adversarial.mjs`, `scripts/phase9/rls-adversarial.mjs`.
- Change: Added final RLS policy overrides so `routine_steps` and `cycle_nights` must prove referenced `user_product_id` ownership, `ask_safety_audit` must prove the referenced Ask turn belongs to the caller, and `community_reports` can only target the caller's own question or an approved visible question.
- Why safe: Parent-row ownership is not enough when a child row also points at another user-owned object. These checks close modified-client paths where a leaked UUID could poison a user's routine/cycle/Ask/community records with another user's resource reference.
- Regression: The static RLS gate fails if these policy overrides disappear, and the live two-user harness has negative insert/update checks for cross-user products, Ask turns, and private pending community questions.

## Photo path and community reaction RLS

- Files: `supabase/migrations/20260705000031_phase9_photo_community_reference_rls.sql`, `supabase/functions/data-export/index.ts`, `scripts/phase9/rls-adversarial.mjs`, `scripts/phase9/live-supabase-adversarial.mjs`, `scripts/phase9/data-rights-smoke.mjs`, `scripts/phase9/live-data-rights.mjs`.
- Change: Added restrictive photo metadata policies so local-only photo rows cannot carry a cloud `storage_path`, and cloud-backed photo rows must use the caller's storage prefix. `data-export` now checks photo path ownership before creating a signed URL and records `INVALID_STORAGE_PATH` omissions for malformed legacy rows. Community reactions now require a non-null published, claim-safe note.
- Why safe: Storage RLS protects object access, but service-role export signing must not trust a user-owned metadata row if a malformed path exists. Community engagement rows also should not let clients reference hidden editorial content.
- Regression: Static RLS/data-rights gates require the path policies, export guard, and community reaction publication gate. The live Supabase harness tests blocked cross-user/local-only photo paths and unpublished/null-note reactions; the live data-rights harness tests malformed legacy photo metadata omission.

## Live Supabase adversarial harness

- Files: `scripts/phase9/live-supabase-adversarial.mjs`, `scripts/phase9/rls-adversarial.mjs`, `scripts/phase9/release-smoke.mjs`, `package.json`, `.env.example`.
- Change: Added and expanded an explicit-flag live harness for two-user owner isolation, append-only consent/completion behavior, service-only entitlement and reverse-trial denial, private photo metadata/path checks, `photos` storage upload/download/delete isolation, routine conflicts, active ramps, shelf scans, cycles/nights, streak freezes, notification preferences/logs, recommendation preferences/recommendations, photo trend metadata, catalog corrections/lookups, commerce clicks, community blocks/questions/reports/reactions, and Ask sessions/turn/safety audit rows.
- Why safe: The script refuses to run unless `PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL=true`; production requires an additional `PHASE9_ALLOW_PRODUCTION_LIVE_SUPABASE_ADVERSARIAL=true` guard.
- Regression: Static Phase 9 RLS gate now requires this harness, proves it covers private photo storage, and fails if newer user-owned table coverage is removed.

## Supabase security-definer policy lint

- Files: `supabase/migrations/20260705000034_phase9_security_definer_hardening.sql`, `scripts/phase9/supabase-policy-lint.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`, `package.json`, `docs/phase-9/generated/release-engineering-qa-packet.json`, `docs/phase-9/generated/release-engineering-qa-packet.md`.
- Change: Added a final hardening migration that replaces `owns_photo` and `expire_app_granted_reverse_trials` with empty-search-path `SECURITY DEFINER` definitions. The reverse-trial expiry RPC now explicitly revokes execute from `public`, `anon`, and `authenticated`, and grants execute only to `service_role`. Added a Phase 9 SQL lint that checks effective definer definitions, execute grants, permissive policy allowlists, and public view `security_invoker` posture.
- Why safe: `owns_photo` remains callable by authenticated users only as an RLS helper. `expire_app_granted_reverse_trials` is still callable from the service-role Edge Function, but modified clients can no longer invoke the global maintenance RPC directly if Postgres default function privileges would otherwise allow it.
- Regression: `phase9:verify` now runs `phase9:supabase-policy-lint`; release smoke and the QA packet require/hash the new linter and hardening migration.

## Security CI workflow

- Files: `.github/workflows/security.yml`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `package.json`.
- Change: Added a read-only Security workflow for Phase 9 gates, high/critical npm audit, Gitleaks, TruffleHog, Semgrep, OSV, manual live Edge auth evidence, manual live Supabase adversarial evidence, manual live data-rights evidence, and manual live public-form Turnstile evidence.
- Why safe: Checkout credentials are not persisted, `pull_request_target` is forbidden, and live Supabase service-role secrets are only used in a manual workflow-dispatch job.
- Regression: `phase9:security-ci-smoke` statically checks the workflow cannot drop scanner coverage, loosen the event model silently, or reintroduce floating `@main`/`@master` action refs.

## GitHub Actions supply-chain pinning

- Files: `.github/workflows/security.yml`, `scripts/phase9/security-ci-smoke.mjs`.
- Change: Pinned Security workflow actions to immutable commit SHAs for `actions/checkout`, `actions/setup-node`, Gitleaks, TruffleHog, Semgrep, and OSV.
- Why safe: Mutable tags can change outside this repository; immutable SHAs make workflow code review and provenance explicit.
- Regression: `phase9:security-ci-smoke` now fails if any `uses:` ref in the Security workflow is not pinned to a 40-character SHA.

## Security scanner evidence artifacts

- Files: `.github/workflows/security.yml`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`, `scripts/phase9/release-smoke.mjs`, `docs/phase-9/security-scanner-evidence.md`, `docs/phase-9/generated/release-engineering-qa-packet.json`, `docs/phase-9/generated/release-engineering-qa-packet.md`.
- Change: Added per-job scanner outcome manifests, captured high/critical npm audit JSON, uploaded code/secret/static scanner evidence artifacts with pinned `actions/upload-artifact`, and added final enforcement steps after artifact upload so failing gates or scanners still fail the workflow. The release packet now hashes the workflow, scanner runbook, dependency SBOM gate, and CI smoke gate.
- Why safe: Release owners no longer have to rely on transient job logs for scanner proof. `continue-on-error` is used only to keep evidence upload alive after a gate/scanner failure, then each job explicitly fails unless every recorded outcome is `success`.
- Regression: `phase9:security-ci-smoke` now fails if artifact uploads, evidence manifests, or post-upload gate/scanner enforcement disappear.

## Live data-rights harness

- Files: `scripts/phase9/live-data-rights.mjs`, `scripts/phase9/data-rights-smoke.mjs`, `.github/workflows/security.yml`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `package.json`, `.env.example`.
- Change: Added an explicit-flag live harness that seeds two users with health, routine, photo, entitlement, commerce click, and order-attribution data; verifies `data-export` returns only caller data, omits `commission_cents`, and omits signed URLs for malformed cross-user photo paths; then invokes `account-deletion` and verifies caller rows/storage are removed while the other user remains intact.
- Why safe: The script refuses to run unless `PHASE9_RUN_LIVE_DATA_RIGHTS=true`; production requires an additional `PHASE9_ALLOW_PRODUCTION_LIVE_DATA_RIGHTS=true` guard.
- Regression: Static data-rights and CI smoke gates now require the live data-rights harness and workflow step.

## Edge Function error hygiene

- Files: `supabase/functions/account-deletion/index.ts`, `supabase/functions/data-export/index.ts`, `supabase/functions/subscription-grants/index.ts`, `scripts/phase9/data-rights-smoke.mjs`, `scripts/phase9/edge-auth-smoke.mjs`.
- Change: Account deletion, data export, and subscription grant failures now return/log stable error codes instead of raw provider response bodies or Supabase error messages.
- Why safe: Users still get actionable failure categories, while internal provider responses, SQL/table details, and backend messages are not exposed to clients or routine logs.
- Regression: Phase 9 data-rights and Edge auth smoke checks fail if raw account-deletion/data-export/subscription-grant error paths return.

## Data export abuse rate limit

- Files: `supabase/functions/data-export/index.ts`, `.env.example`, `scripts/phase9/data-rights-smoke.mjs`, `scripts/phase9/release-smoke.mjs`.
- Change: Added a per-user data-export rate limit using the existing service-role-only `consume_edge_rate_limit` RPC. The stored rate-limit key is an HMAC of `data-export|userId`, not the raw user ID. The check runs after JWT auth and before broad export table reads, service-role filtered reads, order-attribution reads, or photo signed URL generation.
- Why safe: Data export is a privacy-rights path, so the limit is conservative and configurable with `DATA_EXPORT_RATE_LIMIT_MAX` and `DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS`. If the limiter is unavailable, the function fails closed with `RATE_LIMIT_UNAVAILABLE`; if a caller exceeds the cap, it returns `RATE_LIMITED` with `Retry-After`.
- Regression: `phase9:data-rights-smoke` now fails if the limiter markers disappear or move after export reads/signed URL generation; `phase9:release-smoke` validates the new server-side env values.

## Live data export rate-limit evidence

- Files: `scripts/phase9/live-data-rights.mjs`, `scripts/phase9/data-rights-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`, `.github/workflows/security.yml`, `.env.example`.
- Change: Expanded the explicit-flag live data-rights harness to exhaust deployed `data-export` for a temporary staging user until it returns `429 RATE_LIMITED`, assert a numeric `Retry-After`, verify `edge_rate_limits` stores only the keyed HMAC for `data-export|userId`, and write a redacted sample into `docs/phase-9/generated/live-data-rights.*`.
- Why safe: The probe is bounded by `PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX`, refuses production unless `PHASE9_ALLOW_PRODUCTION_LIVE_DATA_RIGHTS=true`, uses temporary users, and does not print raw user IDs or limiter hashes into release artifacts.
- Regression: Static data-rights, release-smoke, security-CI, and QA-packet gates now require the bounded live data-export rate-limit evidence path and hash it into the release packet inputs.

## Live data export signed URL expiry evidence

- Files: `supabase/functions/data-export/index.ts`, `scripts/phase9/live-data-rights.mjs`, `scripts/phase9/data-rights-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/security-ci-smoke.mjs`, `.github/workflows/security.yml`, `.env.example`.
- Change: Made photo export signed URL TTL explicit with `DATA_EXPORT_PHOTO_URL_TTL_SECONDS`, preserving the one-hour default, and added an opt-in live data-rights check that downloads the synthetic photo before expiry, waits past the configured TTL, then proves the same signed URL fails after expiry. The generated artifact records only TTL, wait, and HTTP statuses.
- Why safe: Production can keep the one-hour TTL while staging sets a short TTL for timed evidence. The live check refuses long TTL evidence runs, does not persist signed URLs, and remains behind `PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK=true`.
- Regression: `phase9:data-rights-smoke` now fails if the export function stops using the named TTL or if the live harness loses the expiry proof. `phase9:release-smoke` validates the TTL and wait settings, and the manual security workflow passes the staging expiry vars into `phase9:live-data-rights:strict`.

## RevenueCat signature replay tolerance

- Files: `supabase/functions/revenuecat-webhook/index.ts`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/live-revenuecat-webhook.mjs`.
- Change: Replaced raw numeric parsing of `REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` with a bounded parser that accepts only 1-3600 seconds and otherwise falls back to 300 seconds. Public HMAC failures now return stable `bad signature` text instead of `missing_signature`, `mismatch`, or `stale_signature` reason details.
- Why safe: A malformed or zero tolerance can no longer silently disable replay protection, and callers do not need oracle-like detail about which signature check failed.
- Regression: `phase9:edge-auth-smoke` requires the bounded parser and stable public error. The live webhook harness still proves invalid and stale signatures are rejected with no event writes.

## RevenueCat webhook payload minimization

- Files: `supabase/functions/revenuecat-webhook/index.ts`, `scripts/phase9/live-revenuecat-webhook.mjs`, `scripts/phase9/edge-auth-smoke.mjs`.
- Change: `subscriptions_events.payload` and `entitlements.raw_status` now persist only a sanitized allowlist of event fields: event ID/type, product/store/environment, entitlement IDs, expiry/original-purchase timestamps, period type, sandbox flag, and offering ID. RevenueCat app user identifiers remain in explicit columns instead of duplicated inside JSON blobs.
- Why safe: Webhook payloads can contain customer attributes, receipts, request metadata, or provider-specific fields that are not needed for entitlement mirroring or support export. Persisting only reviewed fields reduces breach and export scope without weakening entitlement resolution.
- Regression: Static Edge auth smoke rejects raw `payload: body` and `raw_status: event` persistence. The live webhook harness injects subscriber-attribute, customer-info, raw-receipt, auth, and API-key canaries and proves they are absent from persisted JSON while explicit identity columns still work.

## RevenueCat webhook error minimization

- Files: `supabase/functions/revenuecat-webhook/index.ts`, `scripts/phase9/edge-auth-smoke.mjs`.
- Change: Entitlement mirror failures now update `subscriptions_events.error` with `ENTITLEMENT_WRITE_FAILED` instead of the raw Supabase error message.
- Why safe: Operators still see that the webhook event failed during entitlement mirroring, but table names, constraints, schema details, and backend error text are not retained in payment event rows or exported support evidence.
- Regression: Static Edge auth smoke requires stable `ENTITLEMENT_WRITE_FAILED` persistence and rejects `error?.message` retention in the RevenueCat webhook.

## Mobile app environment fail-closed default

- Files: `apps/mobile/src/lib/env.ts`, `apps/mobile/src/lib/env.test.ts`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`.
- Change: `env.appEnvironment` is now normalized through `readAppEnvironment()`. Missing or unsupported `EXPO_PUBLIC_APP_ENV` values default to `development` only in the actual dev runtime; non-dev bundles default to `production`.
- Why safe: Payment and release behavior use `env.appEnvironment` to decide whether RevenueCat can fall back to development previews or must fail closed. A release-like bundle with a missing or misspelled public env var no longer gets development fallback behavior.
- Regression: `env.test.ts` proves missing/invalid non-dev app env values resolve to production, dev runtime values still resolve to development, and supported values normalize correctly. Release smoke blocks the old `process.env.EXPO_PUBLIC_APP_ENV ?? 'development'` pattern, requires the fail-closed helper/tests, and the QA packet hashes the env helper and test.

## Production Phase 7 surface evidence gates

- Files: `apps/mobile/src/lib/launch/phase7.ts`, `apps/mobile/src/lib/launch/phase7.test.ts`, `scripts/phase7/check-core-loop.mjs`, `scripts/phase7/build-core-loop-qa-packet.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`.
- Change: Added a `productionSurfaceReady` guard so production bundles keep deferred Phase 7 surfaces closed unless the final brand domain is real. Phase 9 release smoke now blocks production builds that enable commerce, community posting, trend insights, cloud Ask, widgets, share cards, or goal-active recommendations unless the matching Phase 7 evidence vars and `PHASE7_SIGNED_OFF_BY` are present.
- Why safe: `EXPO_PUBLIC_*` flags are public bundle values and can be mis-set. The runtime guard prevents production placeholder identity from opening sensitive surfaces, while the CI/release gate keeps clinical, privacy, device, catalog, and brand evidence as non-public release controls instead of app-bundle trust.
- Regression: `phase7.test.ts` proves production fail-closed behavior, staging exercise behavior, final-domain enablement, and share-card eligibility constraints. Phase 7 and Phase 9 smoke/QA packet scripts require and hash the launch guard/test. A production negative release-smoke probe with Cloud Ask enabled now exits with hard blockers when evidence is absent.

## Live Phase 9 harness environment fail-closed default

- Files: `scripts/phase9/lib.mjs`, all `scripts/phase9/live-*.mjs` harnesses, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/build-release-qa-packet.mjs`.
- Change: Added `readScriptAppEnvironment()` for live Phase 9 scripts. It reads only real `.env` plus process env, ignores `.env.example`, normalizes supported app environments, and defaults missing/invalid values to `production`. Every live harness now uses the helper before its existing `PHASE9_ALLOW_PRODUCTION_*` guard.
- Why safe: The live harnesses can create users, write rows, delete accounts, exhaust rate limits, and call deployed Edge Functions. A missing app env should never inherit `.env.example`'s development value and accidentally bypass production refusal checks.
- Regression: Release smoke now fails if a live harness stops using `readScriptAppEnvironment()` or reintroduces `?? 'development'`. The QA packet hashes the helper and every live harness, and the expected-failure probe proves a missing real app env refuses live Edge auth execution as production.

## Onboarding quiz completion profile guard

- Files: `apps/mobile/src/features/onboarding/quiz.ts`, `apps/mobile/src/features/onboarding/quizCompletion.test.ts`, `apps/mobile/src/features/onboarding/OnboardingContext.tsx`, `apps/mobile/src/app/onboarding/analyzing.tsx`, `apps/mobile/src/app/onboarding/reveal.tsx`, `apps/mobile/src/app/onboarding/paywall.tsx`, `docs/USER_FLOW_TREE.md`.
- Change: Added `getQuizCompletionState()` and `isQuizQuestionAnswered()` so profile scoring is treated as complete only when every quiz question has a valid current option. `persistSkinProfile()` now rejects incomplete answers; analyzing redirects incomplete state back to the quiz; reveal shows a recovery screen instead of a computed default; paywall personalization waits for completion.
- Why safe: A direct route, stale local answer, or modified navigation path can no longer create a health-adjacent skin profile or personalized paywall copy from default quiz-score fallbacks.
- Regression: `quizCompletion.test.ts` covers empty answers, complete answers, stale option IDs, and empty multi-select answers. Mobile workspace typecheck and lint pass with the guard.

## Subscription price display unavailable-state guard

- Files: `apps/mobile/src/features/subscription/priceDisplay.ts`, `apps/mobile/src/features/subscription/priceDisplay.test.ts`, `apps/mobile/src/lib/iap/revenuecat.ts`, onboarding/contextual paywall screens, `apps/mobile/src/features/subscription/ProGate.tsx`, `docs/USER_FLOW_TREE.md`.
- Change: Added a shared price-display helper for annual/monthly labels. Unavailable store pricing renders as `Price unavailable` with no slash-period suffix, while loading/development fallback states use approved fallback labels. `getSubscriptionOffering()` now catches offering-fetch failures and returns an explicit unavailable offering with stable copy.
- Why safe: Subscription pricing is a payment/store-review surface; missing or failed store pricing must not look like a real billed amount or expose raw RevenueCat failure details.
- Regression: `priceDisplay.test.ts` covers loading fallback labels, RevenueCat package labels, development fallback labels, and unavailable pricing. Mobile workspace typecheck and lint pass with the shared helper.

## Direct-entry navigation recovery guard

- Files: `apps/mobile/src/lib/navigation/safeBack.ts`, `apps/mobile/src/lib/navigation/safeBack.test.ts`, `apps/mobile/src/features/subscription/dismissPaywall.ts`, `apps/mobile/src/features/subscription/dismissPaywall.test.ts`, Ask/deferred/shelf/progress/paywall route screens, `docs/USER_FLOW_TREE.md`.
- Change: Added shared direct-entry navigation helpers. Ask, deferred, and paywall close controls now fall back to Today when no history exists; Shelf subroutes fall back to Shelf; progress capture falls back to Progress.
- Why safe: Deep links, web refreshes, and cold route entries should not trap users on consent, deferred, shelf detail, progress capture, or paywall screens with a Back/Close action that cannot go anywhere.
- Regression: `safeBack.test.ts` and `dismissPaywall.test.ts` prove history-preserving and no-history replacement behavior. `useToday.test.ts` also covers removal of the hard-coded Today header clock placeholder.

## Public growth attribution sanitizer parity

- Files: `apps/mobile/src/lib/growth/attribution.ts`, `apps/mobile/src/lib/growth/attribution.test.ts`, `supabase/functions/growth-event/index.ts`, `supabase/functions/waitlist/index.ts`, `scripts/phase9/edge-functions-check.mjs`.
- Change: Mobile attribution parsing now ignores malformed percent-encoded query pairs instead of throwing. Public waitlist and growth-event functions now restrict attribution values to URL-safe opaque metadata and drop non-opaque `share_id` values before service-role writes.
- Why safe: Public links and public-form endpoints are attacker-controlled input. The server cannot rely on the mobile client to pre-sanitize campaign fields, and a malformed public link should degrade to no attribution rather than crashing the route.
- Regression: `attribution.test.ts` covers malformed encoded URLs, and `phase9:edge-functions-check` fails if either public-form Edge Function drops the opaque `share_id` or URL-safe attribution guards.

## RevenueCat webhook body limit

- Files: `supabase/functions/revenuecat-webhook/index.ts`, `.env.example`, `.github/workflows/security.yml`, `scripts/phase9/live-revenuecat-webhook.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `scripts/phase9/security-ci-smoke.mjs`.
- Change: Added `REVENUECAT_WEBHOOK_MAX_BYTES`, defaulting to 65,536 bytes and bounded from 1,024 to 262,144 bytes. The webhook now rejects missing verification configuration and bad shared auth before reading the body, reads the raw body through a bounded stream, and returns `413 payload too large` before HMAC work, JSON parsing, or database writes when the limit is exceeded.
- Why safe: The function intentionally runs without Supabase JWT verification, so unbounded pre-auth request bodies could amplify memory/cost. The limit preserves exact raw-body HMAC verification for legitimate webhooks while bounding abuse.
- Regression: Static Edge auth smoke enforces the bounded reader, ordering, and `413` path. Release smoke validates the env range, CI passes the staging setting into strict evidence, and the live webhook harness sends an oversized signed/authenticated canary and proves no subscription event is written.

## Account deletion preflight

- Files: `supabase/functions/account-deletion/index.ts`, `scripts/phase9/data-rights-smoke.mjs`.
- Change: Account deletion now checks Apple, RevenueCat, and PostHog deletion prerequisites before purging photo storage or deleting the auth user. RevenueCat and PostHog deletion run before local storage cleanup.
- Why safe: A missing provider secret or Apple authorization code can no longer leave the account active while deleting local/backend storage first.
- Regression: Phase 9 data-rights smoke checks the preflight and provider-before-storage sequencing.

## Live public-form Turnstile and rate-limit harness

- Files: `scripts/phase9/live-public-forms.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `.github/workflows/security.yml`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `package.json`, `.env.example`.
- Change: Added and expanded an explicit-flag live harness that calls deployed `waitlist` and `growth-event`, verifies missing/invalid Turnstile token rejection, verifies oversized public-form body rejection without writes, optionally verifies valid-token writes, checks sensitive attribution/payload keys are not persisted, exhausts DB-backed public-form limits with missing-token probes, verifies `429 rate limited` plus `Retry-After`, checks keyed-hash-only `edge_rate_limits` samples, and proves rate-limit probes do not write waitlist/growth rows.
- Why safe: The script refuses to run unless `PHASE9_RUN_LIVE_PUBLIC_FORMS=true`; production requires an additional `PHASE9_ALLOW_PRODUCTION_LIVE_PUBLIC_FORMS=true` guard.
- Regression: Static Edge auth and CI smoke gates now require the live public-form harness, Turnstile evidence paths, oversized-body no-write evidence, bounded `PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX`, 429/keyed-hash checks, and the manual workflow step. Release smoke adds `PHASE9_PUBLIC_FORMS_PASS`.

## Live RevenueCat webhook harness

- Files: `scripts/phase9/live-revenuecat-webhook.mjs`, `scripts/phase9/edge-auth-smoke.mjs`, `.github/workflows/security.yml`, `scripts/phase9/security-ci-smoke.mjs`, `scripts/phase9/release-smoke.mjs`, `package.json`, `.env.example`.
- Change: Added and expanded an explicit-flag live harness that calls deployed `revenuecat-webhook`, verifies invalid shared auth rejection, invalid/stale HMAC rejection, oversized body rejection, initial-purchase entitlement grant, renewal, cancellation, billing-issue grace/recovery state, expiration deactivation, duplicate event idempotency, refund revocation, and raw-payload minimization.
- Why safe: The script refuses to run unless `PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK=true`; production requires an additional `PHASE9_ALLOW_PRODUCTION_LIVE_REVENUECAT_WEBHOOK=true` guard.
- Regression: Static Edge auth and CI smoke gates now require the live RevenueCat webhook harness, oversized body coverage, the full grant/stop-renew/revoke lifecycle coverage, raw-payload minimization, and the manual staging workflow step.

## Expo dependency alignment

- File: `apps/mobile/package.json`.
- Change: `expo-store-review` pinned to `~56.0.3`, matching Expo SDK 56.
- Why safe: `npx expo-doctor` now passes all checks.

## Vite/esbuild advisory removal

- Files: `apps/mobile/package.json`, `package-lock.json`, `docs/phase-9/generated/dependency-inventory.json`, `docs/phase-9/generated/dependency-inventory.md`.
- Change: Upgraded Vitest to `^4.1.9`, which resolves Vite to `8.1.3` and removes the vulnerable transitive `esbuild@0.27.7` dependency from the development/test toolchain. The dependency inventory was regenerated with `PHASE9_RUN_NPM_AUDIT=true`, recording `0` high and `0` critical vulnerabilities while leaving the Expo `xcode -> uuid@7.0.3` moderate advisory for upstream fix or explicit risk acceptance.
- Why safe: The test-tool major bump stays inside the supported local Node engine and was validated against the full Vitest suite, typecheck, lint, npm audit, and Phase 9 dependency SBOM.

## Dependency SBOM audit mode

- Files: `scripts/phase9/dependency-sbom.mjs`, `docs/phase-9/generated/dependency-inventory.json`, `docs/phase-9/generated/dependency-inventory.md`.
- Change: Uses the current Node executable plus `npm_execpath` when running `npm audit --json`, then records advisory-level findings with package, severity, directness, via chain, fix target, and node paths. The generated markdown now includes an `Audit Findings` table, so the remaining Expo config-tooling moderate advisories can be reviewed without rerunning npm audit.
- Why safe: This makes the Phase 9 dependency inventory work on Windows shells and turns a vague moderate count into explicit release evidence. High and critical advisories remain blocking code gates; moderate advisory acceptance still requires `PHASE9_DEPENDENCY_AUDIT_PASS=true`.

## Dependency lifecycle script inventory

- Files: `scripts/phase9/dependency-sbom.mjs`, `scripts/phase9/security-ci-smoke.mjs`, `docs/phase-9/generated/dependency-inventory.json`, `docs/phase-9/generated/dependency-inventory.md`.
- Change: Added a lockfile-derived `Install Scripts` inventory to the dependency SBOM and an allowlist gate for the current lifecycle-script packages: `@sentry/cli@2.58.4`, optional `fsevents@2.3.3`, and `unrs-resolver@1.12.2`. Tightened Security CI smoke checks so every checkout must disable persisted credentials and the workflow cannot switch from `npm ci` to `npm install`.
- Why safe: Dependency lifecycle hooks are a supply-chain execution boundary. New install-script packages now require explicit review before Phase 9 dependency evidence can pass.
