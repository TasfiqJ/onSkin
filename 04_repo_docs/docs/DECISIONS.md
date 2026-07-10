# Decisions

## Decision Log Format

Use this format for every significant product, architecture, pricing, privacy, or launch decision:

```markdown
## YYYY-MM-DD - Decision Title

- Decision:
- Type: Product / Architecture / Stack / Pricing / Privacy / Growth / Legal / Launch
- Alternatives:
- Criteria:
- Evidence:
- Risk:
- Status: Proposed / Accepted / Rejected / Superseded
- Owner:
- Review date:
```

## Product Decisions

### 2026-07-06 - Rebrand Before Launch

- Decision: Do not launch publicly as `OnSkin` unless counsel gives strong written clearance.
- Alternatives: keep name, add modifier, acquire/coordinate with incumbent, full rebrand.
- Criteria: customer confusion, App Store search, support, trademark risk, rework cost.
- Evidence: existing public OnSkin app/site in same category with scanner language and claimed 8M users/2M products.
- Risk: rebrand delays launch, but keeping name is higher risk.
- Status: Accepted.

### 2026-07-06 - Position As Shelf And Routine, Not Scanner

- Decision: The primary promise is "Add your skincare shelf. Get a routine that knows what not to mix."
- Alternatives: beauty scanner, AI skin analysis, ingredient safety app, shopping assistant.
- Criteria: differentiation, trust, daily use, subscription retention.
- Evidence: scanner competitors are crowded; repo has stronger shelf/routine/progress loop.
- Risk: users still search for scanner terms, so ASO must include them without leading with them.
- Status: Accepted.

### 2026-07-06 - Keep Full Product, Gate Public Exposure

- Decision: Keep the full feature set in code, but expose/market only reviewed production-real surfaces.
- Alternatives: cut to V1 only, launch everything, freeze advanced surfaces.
- Criteria: founder preference, safety, app review, trust.
- Evidence: existing repo already contains many surfaces and launch gates.
- Risk: feature complexity can dilute focus.
- Status: Accepted.

### 2026-07-09 - Launch Device Support Floor

- Decision: Launch support floor is iOS 17.0+ and Android 10 / API 29+; launch-blocking layout QA starts at 360 x 640 for Expo web-compatible compact-phone coverage, while 320-wide browser viewports and sub-640 browser-only heights remain stress-only unless reproduced on a supported native device or required by app review/accessibility.
- Alternatives: support Expo's lower Android 7+ default, require Android 12+, keep the earlier 320 x 480 browser floor as launch-blocking, or drop compact Android phones entirely.
- Criteria: paid consumer market reach, QA burden, current Expo SDK support, App Store/Play submission requirements, camera/photo reliability, accessibility, and launch speed.
- Evidence: Expo SDK 56 supports iOS 16.4+ and Android compile/target SDK 36; Apple and Google current submission rules require modern build SDK/target API; the repo has passing 360 x 640, 360 x 740, 375 x 667/812, 390 x 844, 412 x 915, and 430 x 932 evidence plus extensive 320-wide stress evidence.
- Risk: Android 9-or-older and iOS 16 users cannot install; users on sub-360 width or sub-640 height browser/device states may still hit polish bugs that are recorded but not launch-blocking unless real device/app-review evidence elevates them.
- Status: Accepted.

### 2026-07-09 - Fail Closed Before Unreviewed Production Builds

- Decision: Production Expo config requires `PHASE3_RELEASE_CLEARANCE=cleared`; development and staging remain available for implementation and reviewer QA.
- Alternatives: rely only on runtime content filters, reuse brand clearance, or allow production builds while Phase 3 copy/review findings remain open.
- Criteria: prevent placeholder consent copy from reaching a store artifact, preserve a practical reviewer workflow, separate brand identity approval from health/privacy/content approval, and keep the release condition auditable.
- Evidence: Phase 3 currently reports unresolved legal, privacy, clinical, chemistry, and IP findings; runtime filters already withhold unreviewed conflict, cadence, and medical-adjacent recommendation content but do not block core draft consent copy.
- Risk: production builds remain blocked until Tas obtains real named signoff against a clean exact-source-hash packet and the strict copy audit passes.
- Status: Accepted.

### 2026-07-09 - Bind Phase 3 Decisions To Detached Item Snapshots

- Decision: Require one source-controlled JSON signoff for every `Approved` or `Deferred` Phase 3 item, bound to a deterministic digest of its review context and exact source hashes.
- Alternatives: trust only the Markdown row, reference the self-changing overall packet manifest, accept one global clearance boolean, or store reviewer assertions only in environment variables.
- Criteria: explicit credentials and conditions, stale-evidence invalidation, no circular packet hash, independent production verification, and a workable external-review handoff.
- Evidence: the prior worklist verified names, dates, dispositions, and source hashes but did not represent the approval template's credential or conditions fields and could not re-read a detached decision artifact.
- Risk: machine validation cannot authenticate reviewer identity, credential, authority, or judgment; Tas must verify those externally and retain the original signed artifact under a non-secret evidence reference.
- Status: Accepted.

## Architecture Decisions

### 2026-07-10 - Preserve Identity During Anonymous Account Upgrades

- Decision: An active anonymous Supabase user upgrades in place. Native Apple/Google tokens use `linkIdentity`; email uses `updateUser({ email })` followed by `verifyOtp(..., type: 'email_change')` when confirmation is required. If Supabase auto-confirms that same-user update, the route completes immediately instead of entering code mode. Every successful upgrade must return the original user ID and a non-anonymous identity. Linking errors fail closed without a `signInWithIdToken` fallback. Sessions that are not anonymous keep the normal provider/email sign-in path.
- Alternatives: call `signInWithIdToken` or `signInWithOtp` for every account action, rely on automatic email matching, switch to an existing account and wipe device data, or build a server-side merge before launch.
- Criteria: preserve the plan created before signup, avoid silent local-private-data deletion at the value moment, follow the current installed Supabase contract, make conflicts explicit, and keep returning-user sign-in available.
- Evidence: `accountUpgrade.ts` asserts same-user and permanent-identity invariants; focused tests cover provider linking, email-change OTP, immediate auto-confirm completion, returning-user sign-in, link failure without fallback, stale sessions, user-ID mismatch, and incomplete conversion. Real Apple/Google/email staging proof remains `B-VERIFY-AUTH-LINKING`.
- Risk: manual identity linking and email templates must be configured in each Supabase project; a provider/email already owned by another account cannot be merged automatically and remains a safe recovery path until a reviewed merge policy exists.
- Status: Accepted.

### 2026-07-10 - Isolate Every Account Transition Before Rendering

- Decision: Sign-out, a changed Supabase user ID, a signed-out restore with retained owner metadata, or a cold-start local-owner mismatch unmounts the complete data-bearing app tree before cleanup. A domain-separated hash, never the raw user ID, binds local records to their owner. A separate cleanup-required control is written before deletion and survives until every authoritative store succeeds, preventing partial cleanup from becoming an unclaimed device. Rapid auth events serialize and publish the latest same-user session; explicit sign-out removes encrypted persisted auth; private-KV reads/writes/removals and encrypted-photo mutations/marker writes are blocked or drained; TanStack Query is cancelled and cleared before and after registered persisted cleanup; native key/file/notification and vendor-reset failures stay closed; and the next session plus route are published only after cleanup and owner claim succeed. Account deletion calls this root boundary once after server deletion. Session-restore or cleanup failure keeps both accounts behind one retryable gate. Same-user refresh and verified anonymous in-place upgrade do not clear data.
- Alternatives: clear only AsyncStorage/files, rely on account-agnostic query keys to refetch, key every query by user without clearing local stores, publish account B while cleanup runs, or sign out permanently when one cleanup backend fails.
- Criteria: no cross-account health/photo/shelf disclosure, no late account A write after deletion, no false empty-state flash, deterministic recovery, preservation of same-user guest value, cold-start mismatch detection, and no raw owner identifier at rest.
- Evidence: hashed-owner, durable-cleanup-control, partial-retry, and boundary-decision tests, including a signed-out cold start; delayed private-KV read/write/removal and encrypted-photo write/marker tests; strict multi-store deletion tests; serialized provider, persisted-auth, and restore-retry contracts; root-owned account deletion integration; and the 360 x 640 failure/retry plus signed-out direct-route pass in `test-results/human-e2e/2026-07-10/onboarding-account-isolation-current/`.
- Risk: local proof does not replace live Supabase sign-out, token-expiry, cold-start, and A-to-B testing on supported iOS/Android builds. A genuine cleanup failure intentionally blocks app data access until retry succeeds.
- Status: Accepted.

### 2026-07-10 - Compose Account Exports From Both Data Authorities

- Decision: The mobile account export wraps the required owner-scoped Supabase export and an exhaustive, path-sanitized snapshot of the current device's encrypted private records. Progress image files and thumbnails remain excluded; sanitized Progress metadata and decrypted notes are included when available. Configured server failures abort instead of returning a partial bundle, while backend-free builds identify their bundle as device-only.
- Alternatives: export only Supabase, silently fall back to local-only data on a configured server failure, mirror every local store before launch, or export raw encrypted storage envelopes.
- Criteria: literal data-portability claims, offline-first architecture, no silent omissions, readable output, credential/key isolation, and current launch scope.
- Evidence: local shelf/profile/cycle/ramp/completion stores are V1 authorities and their server mirrors are best effort or deferred; `localDeviceExport.ts` has a registry-coverage test against `LOCAL_PRIVATE_DATA_KEYS` plus media-path/ciphertext redaction tests.
- Risk: the same device must perform the export to include its local-first records; multi-device reconciliation remains deferred, and native share/cache behavior still requires physical-device staging evidence.
- Status: Accepted.

### 2026-07-10 - Fail Closed On Unreadable Device Encryption Keys

- Decision: Native private-record keys remain SecureStore-only, except for read-only migration of an existing legacy fallback; Expo web uses its explicit AsyncStorage path. Missing, malformed, unavailable, or non-authenticating keys never delete ciphertext or create replacement key material on a read. A failed encrypted read blocks a same-snapshot fallback write until the record is read successfully or explicitly removed. Progress writes require a persisted non-sensitive key-history marker, scan legacy encrypted photo files before first-key creation, reject malformed or previously lost keys, and share one in-flight key creation across concurrent first writes.
- Alternatives: delete unreadable envelopes and return defaults, rotate keys automatically, write new native keys into AsyncStorage when SecureStore fails, rely on every feature store to distinguish storage failures, or add cloud key recovery before launch.
- Criteria: no silent local data loss, native key confidentiality, deterministic recovery, concurrency safety, backwards-compatible web and legacy-key behavior, explicit user deletion, and testability without claiming unavailable OS evidence.
- Evidence: `privateKVContentKey.test.ts`, `privateKV.test.ts`, `encryptedStorage.test.ts`, and `store.test.ts` cover native/web storage boundaries, legacy migration, missing/invalid/wrong keys, transient read failure, failed-marker persistence, stale-write refusal, ciphertext preservation, Progress note propagation, and concurrent first writes.
- Risk: ciphertext is unrecoverable after genuine OS key loss because V1 intentionally has no cloud backup or recovery escrow. Physical iOS/Android keychain/keystore, reinstall, restore, locked-device, and storage-pressure behavior still requires staging-device evidence; the app must surface retry/recovery rather than claim recovery it cannot perform.
- Status: Accepted.

### 2026-07-10 - Gate Every Sensitive Progress Entry With Shared App-Lock State

- Decision: When app lock is enabled, the app tree does not mount until its encrypted preference resolves; an unreadable preference fails closed as enabled and locked. The app-wide unlock must finish before the separate photo-timeline prompt can start. Progress tab, capture, review, and single-photo detail all use one provider-owned timeline unlock inside their Pro gates; navigation reuses that unlock only while the app remains active, and every non-active AppState transition clears it. The generic no-score explainer remains outside the second lock.
- Alternatives: keep a tab-local gallery gate, authenticate independently on every nested screen, put the timeline gate outside entitlement checks, treat unreadable lock preference as disabled, or rely only on the app-wide overlay.
- Criteria: direct-link privacy, no pre-lock content mount/flash, prompt ordering, usable in-session navigation, background relock, free-user paywall ordering, and deterministic browser/native verification.
- Evidence: `PhotoTimelineLockGate.tsx`, `AppLockProvider.tsx`, app-lock and Progress route contracts, plus 360 x 640 and 390 x 844 direct-route/session evidence in `test-results/human-e2e/2026-07-10/progress-direct-route-lock-current/`.
- Risk: Expo web proves routing, mounting, geometry, and state transitions but not native biometric security. Physical iOS/Android LocalAuthentication ordering, background transitions, cancellation, and VoiceOver/TalkBack focus restoration remain release QA.
- Status: Accepted.

### 2026-07-10 - Treat Progress Read Failure As Blocked, Never Empty

- Decision: After entitlement and any configured biometric gates pass, the Progress tab, capture, review, and single-photo detail must still complete one successful encrypted photo-metadata query before route content or photo mutations mount. Pending reads show a neutral privacy state. Failed reads show one shared, non-destructive recovery surface with a real query retry; direct routes also expose `Back to Progress`. Empty-timeline and missing-photo UI are valid only after a successful read proves those states.
- Alternatives: let each route interpret `undefined` as empty, catch storage failure in the store and return `[]`, show route-specific errors while still mounting content, or permit capture/save against cached defaults.
- Criteria: preserve ciphertext, avoid false deletion/loss signals, prevent stale/default overwrites, keep camera/review/detail content private, make transient SecureStore/Keychain/Keystore failure recoverable, and keep route behavior consistent.
- Evidence: `PhotoStorageGate.tsx`, `usePhotos.ts`, photo store and route contracts, plus persistent and one-shot supported-phone evidence in `test-results/human-e2e/2026-07-10/progress-storage-recovery-current/`.
- Risk: Expo web proves query state, content gating, retry, layout, and network absence but cannot inject real native keychain/keystore faults. Physical iOS/Android staging builds must prove ciphertext remains byte-identical and retry succeeds after key access returns.
- Status: Accepted.

### 2026-07-06 - Keep Expo/Supabase/RevenueCat

- Decision: Continue current stack unless beta/device/compliance evidence says otherwise.
- Alternatives: native apps, Flutter, Firebase, custom backend.
- Criteria: speed, current repo fit, camera/IAP support, TypeScript reuse, RLS.
- Evidence: current implementation and docs already use Expo, Supabase, RevenueCat.
- Risk: native camera/OCR and widgets require custom build QA.
- Status: Accepted.

### 2026-07-06 - Deterministic Rules Over AI For Safety

- Decision: Conflict, pregnancy, routine sequencing, PAO, and safety guidance must be deterministic and reviewer-backed.
- Alternatives: GPT-generated guidance, cloud RAG only, broad AI advisor.
- Criteria: liability, explainability, repeatability, testability.
- Evidence: competitor AI claims are crowded; repo already gates rules with `reviewedBy`.
- Risk: slower content expansion.
- Status: Accepted.

## Stack Decisions

### 2026-07-06 - Local-First Photos And Shelf

- Decision: Keep privacy-sensitive data local by default.
- Alternatives: cloud sync first, cloud photo analysis.
- Criteria: privacy differentiation, MHMDA/privacy risk, trust.
- Evidence: repo and positioning already emphasize photos stay on device.
- Risk: multi-device sync and backup deferred.
- Status: Accepted.

## Pricing Decisions

### 2026-07-06 - Annual-First Subscription

- Decision: Test $49.99/year annual Pro with monthly anchor and no weekly plan.
- Alternatives: $29.99/year, $59.99/year, weekly subscription, one-time purchase.
- Criteria: $30k/month target, competitor pricing, retention, subscription norms.
- Evidence: HadaBuddy publicly lists $29.99/year; Think Dirty premium reported at $59.99/year; RevenueCat reports subscription conversion is unforgiving and first-session value matters.
- Risk: premium price must be justified by trust and retention.
- Status: Proposed.

### 2026-07-06 - Reverse Trial

- Decision: Use a no-card reverse trial after value, then downgrade to useful free tier.
- Alternatives: hard paywall, carded trial only, freemium only.
- Criteria: discovery-channel fit, trust, first-session value.
- Evidence: RevenueCat reports hard paywalls convert better but first-session aha is critical; this category benefits from experiencing value.
- Risk: if users do not engage during the trial, value is given away.
- Status: Proposed.
