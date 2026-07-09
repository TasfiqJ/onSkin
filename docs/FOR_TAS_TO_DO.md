# For Tas To Do

Date: 2026-07-09

Purpose: track work Codex must not guess or fake. These items require a founder decision, account owner, credential, payment method, counsel/reviewer signoff, physical device, or real beta users. Codex can keep building around them, but launch readiness cannot close until evidence is attached.

## P0 - Brand And Identity

Status: launch-blocked

- Decide whether to keep `OnSkin` only with written trademark counsel clearance. Default path is rebrand.
- Treat `RoutineKind` as the current working candidate, not final clearance.
- Web-indexed App Store/Google Play spot checks on 2026-07-06, 2026-07-07,
  and 2026-07-09 did not surface an exact app listing for `RoutineKind`;
  the 2026-07-09 Apple public app search API returned 18 routine-related
  software results with zero exact `RoutineKind` `trackName` matches; the
  2026-07-09 Google Play exact quoted search had no exact rendered-title
  marker; and 2026-07-09 DNS checks returned NXDOMAIN for
  `routinekind.app` and `routinekind.com`. This is not trademark clearance,
  registrar availability, App Store Connect name reservation, Google Play
  package/app reservation, social-handle availability, or paid-search/common-law
  clearance.
- Counsel/founder review should explicitly evaluate adjacent public app names
  surfaced during the 2026-07-09 screening, including `Routine`,
  `Routinery`, `MyRoutine`, and `Kind App`, before treating `RoutineKind` as
  launchable.
- Run formal trademark, App Store, Google Play, domain, social handle, and paid-search checks for the final candidate.
- Choose final app name, legal entity display, domain, support email, bundle ID, Android package ID, URL scheme, policy URL root, and share-card watermark.
- Record the decision in `docs/brand-decision-memo.md`.
- After the 2026-07-07 native-default migration, `apps/mobile/app.base.json`
  and development/staging resolved Expo config now use `RoutineKind`,
  `routinekind`, and `com.routinekind.app` defaults. `supabase/config.toml` now
  uses `routinekind` and `routinekind://auth/callback` for local/project
  placeholders. `npm run brand:audit:strict` passes with 0 public launch-risk
  and 0 review-needed references. The 6 remaining `guard-rail` hits are
  deliberate legacy-brand detection patterns in `app.config.js`,
  `phase2:check-env`, and `phase4:check-source-env`; internal namespaces and
  historical/context docs are still counted separately by the audit.
- Final Supabase project refs, auth callback allow-lists, Apple/Google OAuth
  settings, and hosted URLs still need to be recreated under the cleared
  identity before staging/production evidence can pass.
- Annual, monthly, and local reverse-trial RevenueCat product IDs are env-driven
  with neutral local placeholders; replace them only after the final identity is
  cleared and matching Apple, Google, RevenueCat, Supabase, domain, and OAuth
  console changes are ready.
- Production native config now normalizes `APP_VARIANT` casing/whitespace,
  rejects blank or unknown variants, and fails fast unless
  `APP_VARIANT=production` has `BRAND_LEGAL_CLEARANCE=cleared` plus explicit
  final native identity env values for display name, slug, scheme, iOS bundle
  ID, and Android package. Tas still needs to provide legally cleared final
  values and account evidence; Codex did not reserve the name, domain, store
  app, or package IDs.

Evidence needed:

- Counsel recommendation.
- Founder decision.
- Domain and social availability record.
- Final identifiers and policy URL list.

## P0 - Production Accounts And Secrets

Status: launch-blocked

- Supabase staging and production projects.
- Supabase live Shelf scan-log evidence: attach staging/production proof that
  barcode outcomes insert owner-scoped `shelf_scans` rows for matched,
  no-match, and offline/queued outcomes under RLS. The 2026-07-08 Codex pass can
  prove the local Expo web fallback UI, but it cannot prove live Supabase writes
  without Tas-owned Supabase/auth credentials.
- Supabase live catalog-report evidence: attach staging/production proof that
  `catalog-report` accepts privacy-safe `missing_product` reports from search
  no-match and barcode no-match recovery, rejects unsafe payloads, stores only
  allowlisted product/report fields under the intended auth/RLS model, and
  returns a clean client response. The 2026-07-09 Codex pass proves local
  offline UI feedback and client payload contracts, but it cannot prove live
  Edge Function insertion without Tas-owned Supabase/auth credentials.
- Supabase anonymous auth and consent-ledger QA for the local-first
  `photo_capture` path: attach evidence that first-use photo capture can save
  a local proof offline/pre-account and that staging/production sessions insert
  immutable `photo_capture` consent rows with the shown version/hash under RLS.
  Repeat the same live-auth/RLS evidence for `photo_trend_insights` grant and
  withdrawal rows; Codex can verify the Trend UI recovery branch locally with
  `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only`, but cannot prove the live
  ledger without Tas-owned Supabase/auth credentials.
- Supabase consent-ledger and native QA for `photo_cloud_backup`: attach
  staging/production proof that turning encrypted cloud backup on persists the
  `photo_cloud_backup` consent row under RLS before the app shows the inline
  device-loss tradeoff, and that failure leaves the switch off with route-owned
  recovery. Codex verified the local Expo web fail-closed branch on 2026-07-08,
  but cannot prove the live ledger or native encrypted-photo backup behavior
  without Tas-owned Supabase/auth credentials and physical builds.
- Apple Developer and App Store Connect app under cleared bundle ID.
- Google Play Console app and OAuth clients under cleared package ID.
- RevenueCat project, products, offerings, entitlements, and webhook secret.
- Final RevenueCat annual, monthly, and reverse-trial product IDs for
  `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID`,
  `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`, and
  `EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID`.
- RevenueCat win-back offer setup and sandbox users/accounts covering eligible
  and ineligible states if win-back offers remain in the launch plan.
- PostHog project and deletion process.
- Sentry project and source-map upload credentials.
- Turnstile site key and secret if kept for abuse prevention.
- Domain, DNS, Universal Links, App Links, support page, deletion page, and data-export page.

Evidence needed:

- Environment variables filled in secure deployment storage, not committed.
- `phase2:check-env:strict`, RevenueCat sandbox checks, analytics/crash privacy checks, and live RLS smoke evidence.

## P0 - Legal, Privacy, And Reviewer Signoff

Status: launch-blocked

- Terms.
- Privacy Policy.
- Consumer Health Data Privacy Policy.
- Subscription and cancellation copy.
- Store metadata and privacy labels.
- Photo, health data, analytics, commerce, community, and Ask consent copy.
- Commerce paid-link launch packet: approve ShopMy or a fallback affiliate rail,
  confirm whether RoutineKind can mint first-party recommendation links under the
  chosen account model, source-clear the retailer/catalog links, approve the
  final `Paid link` disclosure and separate commerce data-sharing consent copy,
  and provide real HTTPS retailer URLs for native handoff/failure QA.
- ODbL/Open Beauty Facts and CosIng source posture.
- Onboarding quiz FTO review.
- Clinical review for conflict rules, routine sequencing, pregnancy cautions, PAO defaults, recommendations, Skin Notes, and Ask corpus.
- Cosmetic chemistry review for ingredient taxonomy, PAO defaults, routine compatibility assumptions, and product caveats.

Evidence needed:

- Signed review rows in `docs/phase-3/legal-regulatory-review-log.md`,
  `docs/phase-3/clinical-review-log.md`,
  `docs/phase-3/cosmetic-chemistry-review-log.md`,
  `docs/phase-3/privacy-security-review-log.md`, and
  `docs/phase-3/ip-fto-review-log.md`.
- Strict Phase 3 audit passing or explicitly accepted with recorded exceptions.
- Generated `docs/phase-3/generated/review-packet.md` with clean Git status,
  current source hashes, and reviewer signoff tied to the exact reviewed build.

## P1 - Physical Device QA

Status: needs-device-verification

- Use `docs/DEVICE_SUPPORT_POLICY.md` as the V1 support floor: iOS 17.0+,
  Android 10 / API 29+, iPhone width 375 pt or wider, Android smallest width
  360 dp or wider, and the 360 x 640 Expo web-compatible shortest-phone
  layout floor. Android compile/target SDK remain pinned to API 36 while the
  install floor stays Android 10 / API 29+. Do not spend launch-blocking QA
  time on iOS 16, Android 9-or-older, sub-360 dp width, 320-wide browser-only
  viewports, or sub-640 px/dp browser-only heights unless a supported physical device,
  app-review requirement, or real beta/support evidence reproduces the same
  issue.
- After the Play Console app exists, export Reach and devices data for Android
  version, screen metrics, RAM, and issue-rate peerset. Revisit the Android 10 /
  API 29 floor only if paid-user reach or issue-risk evidence justifies it.
- Create EAS development or staging builds for iOS and Android.
- Test on at least one physical iPhone and one physical Android device.
- Provide real EAS build UUIDs or `expo.dev` build URLs, physical device model
  names with OS versions, and a named tester/reviewer signoff. Generic labels
  like `iPhone model / iOS version`, local build notes, pending IDs, and
  placeholder signoff names are rejected by `phase5:qa-packet:strict`.
- Verify barcode scan, label capture/manual fallback, progress photo capture, encrypted photo save/restart/delete, notifications, share sheet, RevenueCat sandbox smoke, Sentry native smoke, and Supabase catalog calls.
- Verify Shelf scan/OCR camera permission recovery on physical iOS and Android:
  deny camera permission, select "Don't ask again" / OS equivalent where
  available, tap Open Settings, confirm the real Settings handoff works, and
  record the behavior if the OS refuses to open Settings. The 2026-07-08 Expo
  web fixture proves inline app recovery for denied/no-retry plus failed
  Settings handoff, but it cannot prove native permission sheets or
  `Linking.openSettings()` success.
- Verify Shelf OCR label capture recovery on physical iOS and Android:
  permission denied, camera mount failure, real `takePictureAsync` rejection,
  retry, and manual text continuation must stay inline/route-owned with no
  duplicate native alert and no short-screen control overlap.
- Verify populated Progress comparison on physical iOS and Android devices with
  real encrypted photo thumbnails: Compare/Timeline, No scores, Side-by-side,
  date-change chips, comparison photo-picker dismiss/selection, app-lock, and
  VoiceOver/TalkBack traversal must remain readable, private, and tappable on
  short screens.
- Verify first-use Progress photo consent failure/retry sequencing on native:
  failed local save does not open a native/system alert, camera, or permission
  prompt; retry saves consent before permission; and the app remains past the
  consent gate after restart.
- Verify first-use Progress photo consent, camera-unavailable, and permission
  recovery overlays on physical iOS and Android devices with real safe-area
  insets: notch/status bar, home indicator/gesture nav, and short-screen
  layouts must keep the primary action and `Not now` exit fully visible and
  tappable. Expo web fixtures now cover denied/no-retry camera permission plus
  failed Settings handoff inline recovery; physical iOS/Android must still prove
  the real OS permission sheet, real `Linking.openSettings()` handoff, and
  Settings failure behavior.
- Verify real Progress still-photo capture rejection on physical iOS and
  Android: `takePictureAsync` failure must show inline `Photo wasn't captured`
  recovery, leave the timeline unchanged, keep retry/exit actions tappable, and
  avoid duplicate native/system alerts.
- Verify shared bottom sheets on physical iOS and Android devices with real
  safe-area insets and screen readers: no-match, opened-date, replenish,
  cycle/disruption, cycle/phased-intro, routine/tolerance, and upsell sheets
  must keep visible exits/choices tappable and must not expose tiny hidden
  backdrop strips to VoiceOver/TalkBack or keyboard focus.
- Verify paywall and subscription-settings policy, Restore, and OS billing
  management handoff branches on physical iOS and Android builds with real
  RevenueCat sandbox configuration: Terms/Privacy failures, Restore empty/active
  states, StoreKit/Play manage-subscription sheet success, and manage-link
  fallback failure must all keep visible recovery copy and tappable 44 pt+
  controls.
- Verify the custom Settings reminder time-picker sheet on physical iOS and
  Android devices with real safe-area insets and screen readers: AM/PM and quiet
  hours pickers must keep the outside dismiss target, 48 px time rows, bottom
  safe-area clearance, and VoiceOver/TalkBack traversal intact on short screens.
- Verify RevenueCat win-back eligible and ineligible states on native builds, including the fallback to the current Pro plan when no native offer exists.
- Decide whether native OCR is in V1. Default is hidden unless real OCR passes device QA.

Evidence needed:

- Build IDs via `PHASE5_IOS_BUILD_ID` and `PHASE5_ANDROID_BUILD_ID`.
- Device names and OS versions via `PHASE5_IOS_DEVICE` and
  `PHASE5_ANDROID_DEVICE`.
- Named tester signoff via `PHASE5_QA_SIGNOFF=true` and
  `PHASE5_SIGNED_OFF_BY=<real tester/reviewer name>`.
- Strict Phase 5 evidence flags:
  `PHASE5_DEVICE_QA_PASS`, `PHASE5_INSTALL_QA_PASS`,
  `PHASE5_CAMERA_PERMISSION_QA_PASS`, `PHASE5_BARCODE_QA_PASS`,
  `PHASE5_LABEL_CAPTURE_QA_PASS`, `PHASE5_PROGRESS_PHOTO_QA_PASS`,
  `PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS`, `PHASE5_NOTIFICATION_QA_PASS`,
  `PHASE5_SHARE_SHEET_QA_PASS`, `PHASE5_REVENUECAT_NATIVE_QA_PASS`,
  `PHASE5_SENTRY_NATIVE_QA_PASS`, `PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS`,
  and `PHASE5_ACCESSIBILITY_QA_PASS`. Set `PHASE5_NATIVE_OCR_QA_PASS=true`
  only if native OCR is enabled and real-label QA passes on physical iOS and
  Android.
- Updated `docs/phase-5/generated/device-qa-packet.md`.

## P1 - Catalog And Source Quality

Status: launch-blocked

- Approve CosIng access/licensing route.
- Approve Open Beauty Facts ODbL/source/image-rights posture.
- Import real product data from approved sources.
- Curate the first launch batch from beta shelves and common products.
- Track barcode match rate, search miss rate, wrong-match rate, parser unknown-token rate, and support tickets.
- Provide a real closed-beta catalog export for
  `PHASE4_BETA_COVERAGE_INPUT` or `docs/phase-4/beta-coverage-input.json` so
  `npm run phase4:beta-coverage-report:strict` can generate a clean
  `docs/phase-4/generated/beta-coverage-report.{json,md}`. The export must
  follow `docs/phase-4/beta-coverage-input.template.json` and include 50-100
  real target users, users with 3+ products, barcode/search/OCR and
  manual-fallback counts, category coverage, top no-matches, wrong-match
  reports, parser unknown-token rate and top tokens, recommendation eligibility
  proof, support ticket counts, real catalog/analytics/support dashboard URLs,
  a non-placeholder source export hash, `evidence.realBetaData=true`, and a
  named beta coverage signoff. The template is intentionally blocked evidence
  until every placeholder is replaced with real beta data. Codex will not fake
  this input.
- Keep product images disabled unless image rights are cleared.

Evidence needed:

- Reviewed source memos.
- Generated `docs/phase-4/generated/catalog-qa-report.md` with
  `Git status: clean`, current source hashes, zero launch blockers, and the
  exact approved import artifact attached.
- Beta coverage report with acceptable match/miss outcomes.

## P1 - Closed Beta And Business Proof

Status: launch-blocked

- Recruit 50-100 real users who own 5+ skincare products.
- Observe first-session onboarding and shelf add.
- Measure product add completion, first useful insight, first check-off, D7/D14/D30 retention, baseline photo, reminders, trial starts, trial-to-paid, cancel/refund reasons, catalog misses, and support tickets.
- Configure the live beta support desk to accept the app handoff query params
  `source=beta_feedback`, `category`, and `severity`, map the categories to
  the Phase 10 support taxonomy, and prove the URL is set in
  `EXPO_PUBLIC_SUPPORT_URL`.
- Attach the Phase 4 generated beta coverage packet after the real beta export
  passes strict mode.
- Run willingness-to-pay tests for annual pricing.
- Interview churned or confused users within 48 hours.

Evidence needed:

- Cohort metrics.
- Churn interview notes.
- Catalog issue summary.
- Support desk category/SLA screenshot showing beta feedback tickets routed by
  category and severity.
- Public launch decision memo.

## P2 - Launch And Growth Operations

Status: blocked by P0/P1

- Final ASO page, screenshots, app preview, and store review notes under the cleared brand.
- Creator seeding plan and disclosure pack.
- Support response playbook.
- Launch command center and incident rollback drill.
- Share-card attribution and final domain fallback.

Evidence needed:

- Store metadata review.
- Support readiness signoff.
- Ring-gate launch checklist.
- 72-hour launch report template filled after launch.

## Current Command-Gate Evidence Needed

These are the exact external proof switches surfaced by the local launch gates on 2026-07-07. Do not set any of them to `true` until the matching evidence exists.

| Gate                                                            | Evidence Tas must provide                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase2:check-env:strict`                                       | Final app identity, production HTTPS policy URLs, production Supabase project URL, RevenueCat, OAuth, production PostHog host, production Sentry DSN, Turnstile, body-limit, rate-limit, and secret-storage values configured outside git.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `phase3:audit-copy:strict`                                      | Final legal/privacy/consent copy plus clinical and cosmetic reviewer signoff for rules, routines, PAO defaults, recommendations, Skin Notes, Ask, community, and commerce-adjacent copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `phase4:check-source-env`                                       | Final catalog/source identity values: `CATALOG_APP_NAME`, `CATALOG_APP_VERSION`, production `CATALOG_CONTACT_EMAIL`, production HTTPS `CATALOG_ATTRIBUTION_URL`, and `OBF_USER_AGENT` with a production contact email. These must not use the uncleared legacy brand and should match the final support/domain identity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `phase5:check-native-config:strict` / `phase5:qa-packet:strict` | iOS and Android build IDs, physical device names/OS versions, native camera/OCR/photo/notification/share-sheet QA, and named tester signoff. Evidence flags are trimmed/case-normalized, but only `true` passes, and `PHASE5_SIGNED_OFF_BY` must be a real named signoff, not a placeholder or generic tester label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `phase6:check-payments-env:strict`                              | Final RevenueCat annual/monthly/reverse-trial product IDs plus sandbox evidence for purchase, restore, trial/reverse-trial, expiry, refund/grace states, win-back eligibility/ineligible fallback, webhook verification, finance reconciliation, and store product setup. Evidence flags are trimmed/case-normalized, but only `true` passes, and `PHASE6_SIGNED_OFF_BY` must be a real named signoff, not a placeholder or `example.com` email.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `phase7:check-core-loop:strict` / `phase7:qa-packet:strict`     | Final brand domain, production privacy/terms/support/export/delete/consumer-health URLs, final privacy and consent copy, reviewed conflict/routine/recommendation evidence, Supabase RLS evidence, catalog beta import evidence, physical-device QA, RevenueCat QA, privacy export/delete QA, beta dashboard readiness, and named Phase 7 signoff via `PHASE7_SIGNED_OFF_BY`. Strict scenario evidence must also set `PHASE7_ONBOARDING_CONSENT_QA_PASS`, `PHASE7_SHELF_INTAKE_QA_PASS`, `PHASE7_REVIEWED_GUIDANCE_QA_PASS`, `PHASE7_ROUTINE_BUILDER_QA_PASS`, `PHASE7_TODAY_CHECKOFF_QA_PASS`, `PHASE7_PHOTOS_PRIVACY_QA_PASS`, `PHASE7_REMINDERS_QA_PASS`, `PHASE7_PAYMENTS_LIFECYCLE_QA_PASS`, `PHASE7_PRIVACY_CONTROLS_QA_PASS`, `PHASE7_SHARE_CARD_QA_PASS`, `PHASE7_DEFERRED_SURFACES_QA_PASS`, and `PHASE7_ANALYTICS_QA_PASS`. Evidence flags are trimmed/case-normalized, but only `true` passes. Generic signoffs like `Tester Name`, `TBD`, or `example.com` emails are rejected. |
| `phase8:verify` strict gates                                    | Final brand domain, production marketing/support URLs, App Store and Play URLs, DNS, Universal Links/App Links, share-card device QA, attribution privacy review, store packets, creator compliance, support responses, launch dashboard, dry run, Apple Team ID, Android release certificate fingerprint, and named signoff. Evidence flags are trimmed/case-normalized, but only `true` passes. Apple Team ID must be a real 10-character non-placeholder team ID, Android release certificate evidence must be real SHA-256 fingerprint(s), and generic signoffs are rejected.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `phase9:verify` strict gates                                    | Live Supabase, RLS staging/production, Edge auth, public forms, catalog rate limits, order-report polling, data export/delete, consent withdrawal, observability payload approval, store build inspection, dependency audit, rollback drill, incident response, and beta evidence. Phase 9 release evidence, individual Phase 9 sub-gates, and the production Phase 7 surface bridge use the same normalized evidence rule: whitespace/case are tolerated, but only `true` passes. Real named signoffs are required where requested, and placeholder signoffs are rejected.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `phase10:verify` strict gates                                   | Final beta identity/policy values (`EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_SUPPORT_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL`, `EXPO_PUBLIC_DATA_EXPORT_URL`, `EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL`, `EXPO_PUBLIC_FINAL_BRAND_DOMAIN`, `EXPO_PUBLIC_MARKETING_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`), closed beta identity, TestFlight, Play closed test including 12 testers for 14 days where required, recruiting, beta terms, dashboards, support desk, beta feedback category/severity routing from the in-app support handoff, privacy-payload approval, payment QA, catalog beta report, retention report, public-launch decision (`go` or `limited`), and real named signoff. Phase 10 readiness, beta analytics, and packet gates all require normalized `true`; generic signoffs like `Tester Name`, `TBD`, or `example.com` emails are rejected.                                                                                                          |
| `phase11:verify` strict gates                                   | Final public launch values (`EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_SUPPORT_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL`, `EXPO_PUBLIC_DATA_EXPORT_URL`, `EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL`, `EXPO_PUBLIC_FINAL_BRAND_DOMAIN`, `EXPO_PUBLIC_MARKETING_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_APP_STORE_URL`, `EXPO_PUBLIC_PLAY_STORE_URL`), Phase 10 exit review, RC signoff, store approval, production environment, RevenueCat production verification, monitoring, support readiness, incident/rollback drill, launch ring reports, ASO review, creator disclosure review, revenue reconciliation, week-1 decision, and real named launch signoff. Generic signoffs are rejected.                                                                                                                                                                                                                                                                   |

## Exact Strict Evidence Key Inventory

The generated Tas audit also checks that this handoff names every strict
external evidence key verbatim. These keys are not values, approvals, or
evidence. Tas must provide real values, live console configuration, named
signoff, or captured proof before any matching gate can be closed.

### Phase 2 environment and RLS

Tas must provide real values/evidence for these exact keys before this gate can close:

- `APPLE_SIWA_CLIENT_ID`
- `APPLE_SIWA_KEY_ID`
- `APPLE_SIWA_PRIVATE_KEY`
- `APPLE_SIWA_SERVICE_ID`
- `APPLE_TEAM_ID`
- `EXPO_PUBLIC_APP_DISPLAY_NAME`
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_APP_SCHEME`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_POSTHOG_HOST`
- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY`
- `PHASE2_ALLOW_PRODUCTION_SMOKE`
- `POSTHOG_API_HOST`
- `POSTHOG_DELETION_APPROVED_ALTERNATE`
- `POSTHOG_PERSONAL_API_KEY`
- `POSTHOG_PROJECT_ID`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_WEBHOOK_AUTH`
- `REVENUECAT_WEBHOOK_MAX_BYTES`
- `REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`
- `REVENUECAT_WEBHOOK_SIGNING_SECRET`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

### Phase 4 catalog source posture

Tas must provide real values/evidence for these exact keys before this gate can close:

- `CATALOG_RATE_LIMIT_MAX`
- `CATALOG_RATE_LIMIT_WINDOW_SECONDS`
- `OBF_API_ENABLED`
- `OBF_CONTRIBUTION_ENABLED`
- `PHASE4_BETA_COVERAGE_REPORT`

### Phase 6 payments and RevenueCat

Tas must provide real values/evidence for these exact keys before this gate can close:

- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY`
- `PHASE6_ANDROID_LICENSE_TEST_PASS`
- `PHASE6_FINANCE_SIGNOFF`
- `PHASE6_IOS_SANDBOX_RESTORE_PASS`
- `PHASE6_RC_OFFERING_REVIEWED`
- `PHASE6_WEBHOOK_HMAC_TEST_PASS`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_WEBHOOK_AUTH`
- `REVENUECAT_WEBHOOK_MAX_BYTES`
- `REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`
- `REVENUECAT_WEBHOOK_SIGNING_SECRET`

### Phase 7 core loop launch gates

Tas must provide real values/evidence for these exact keys before this gate can close:

- `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED`
- `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED`
- `EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED`
- `EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED`
- `EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED`
- `EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED`
- `EXPO_PUBLIC_PHASE7_TREND_ENABLED`
- `EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED`
- `PHASE7_BETA_DASHBOARD_READY`
- `PHASE7_BRAND_READY`
- `PHASE7_CATALOG_BETA_IMPORT_PASS`
- `PHASE7_CLINICAL_REVIEW_PASS`
- `PHASE7_DEVICE_QA_PASS`
- `PHASE7_PRIVACY_EXPORT_DELETE_PASS`
- `PHASE7_REVENUECAT_QA_PASS`
- `PHASE7_SUPABASE_RLS_PASS`

### Phase 8 growth and store readiness

Tas must provide real values/evidence for these exact keys before this gate can close:

- `ANDROID_CERT_SHA256_FINGERPRINTS`
- `APPLE_TEAM_ID`
- `EXPO_PUBLIC_PHASE8_CREATOR_LINKS_ENABLED`
- `EXPO_PUBLIC_PHASE8_PAID_MEASUREMENT_ENABLED`
- `EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED`
- `EXPO_PUBLIC_PHASE8_REVIEW_PROMPT_ENABLED`
- `PHASE8_ANDROID_APP_LINKS_PASS`
- `PHASE8_APP_STORE_PACKET_PASS`
- `PHASE8_ATTRIBUTION_PRIVACY_PASS`
- `PHASE8_BRAND_SOURCE_OF_TRUTH_PASS`
- `PHASE8_CREATOR_COMPLIANCE_PASS`
- `PHASE8_DOMAIN_DNS_PASS`
- `PHASE8_DRY_RUN_PASS`
- `PHASE8_IOS_UNIVERSAL_LINKS_PASS`
- `PHASE8_LAUNCH_DASHBOARD_READY`
- `PHASE8_PLAY_STORE_PACKET_PASS`
- `PHASE8_SHARE_CARD_DEVICE_QA_PASS`
- `PHASE8_SIGNED_OFF_BY`
- `PHASE8_SUPPORT_RESPONSE_PASS`

### Phase 9 release engineering

Tas must provide real values/evidence for these exact keys before this gate can close:

- `PHASE9_ALLOW_PRODUCTION_LIVE_CATALOG_RATE_LIMIT`
- `PHASE9_ALLOW_PRODUCTION_LIVE_CONSENT_WITHDRAWAL`
- `PHASE9_ALLOW_PRODUCTION_LIVE_DATA_RIGHTS`
- `PHASE9_ALLOW_PRODUCTION_LIVE_EDGE_AUTH`
- `PHASE9_ALLOW_PRODUCTION_LIVE_ORDER_REPORT_POLL`
- `PHASE9_ALLOW_PRODUCTION_LIVE_PUBLIC_FORMS`
- `PHASE9_ALLOW_PRODUCTION_LIVE_REVENUECAT_WEBHOOK`
- `PHASE9_ALLOW_PRODUCTION_LIVE_SUPABASE_ADVERSARIAL`
- `PHASE9_ANDROID_16KB_PASS`
- `PHASE9_ANDROID_ARTIFACT`
- `PHASE9_ANDROID_CLOSED_TEST_PASS`
- `PHASE9_ANDROID_TARGET_API_PASS`
- `PHASE9_APP_STORE_PACKET_PASS`
- `PHASE9_BETA_EVIDENCE_PASS`
- `PHASE9_CATALOG_RATE_LIMIT_PASS`
- `PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX`
- `PHASE9_CONSENT_WITHDRAWAL_PASS`
- `PHASE9_DATA_EXPORT_DELETE_PASS`
- `PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX`
- `PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK`
- `PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS`
- `PHASE9_DEPENDENCY_AUDIT_PASS`
- `PHASE9_DEVICE_QA_PASS`
- `PHASE9_EDGE_AUTH_PASS`
- `PHASE9_FINAL_IDENTITY_PASS`
- `PHASE9_INCIDENT_RESPONSE_PASS`
- `PHASE9_IOS_ARTIFACT`
- `PHASE9_IOS_PRIVACY_REPORT_PASS`
- `PHASE9_IOS_TESTFLIGHT_PASS`
- `PHASE9_LIVE_SUPABASE_PASS`
- `PHASE9_OBSERVABILITY_PAYLOAD_PASS`
- `PHASE9_ORDER_REPORT_POLL_ACTIVATED_EXPECTED`
- `PHASE9_ORDER_REPORT_POLL_PASS`
- `PHASE9_PLAY_PACKET_PASS`
- `PHASE9_PUBLIC_FORMS_PASS`
- `PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX`
- `PHASE9_REVENUECAT_NATIVE_QA_PASS`
- `PHASE9_REVENUECAT_WEBHOOK_PASS`
- `PHASE9_RLS_PRODUCTION_PASS`
- `PHASE9_RLS_STAGING_PASS`
- `PHASE9_ROLLBACK_DRILL_PASS`
- `PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT`
- `PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL`
- `PHASE9_RUN_LIVE_DATA_RIGHTS`
- `PHASE9_RUN_LIVE_EDGE_AUTH`
- `PHASE9_RUN_LIVE_ORDER_REPORT_POLL`
- `PHASE9_RUN_LIVE_PUBLIC_FORMS`
- `PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK`
- `PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL`
- `PHASE9_RUN_LIVE_SUPABASE_CHECK`
- `PHASE9_RUN_NPM_AUDIT`
- `PHASE9_SIGNED_OFF_BY`
- `PHASE9_TURNSTILE_VALID_TOKEN`

### Phase 10 closed beta

Tas must provide real values/evidence for these exact keys before this gate can close:

- `PHASE10_BETA_IDENTITY_PASS`
- `PHASE10_BETA_TERMS_PASS`
- `PHASE10_CATALOG_BETA_PASS`
- `PHASE10_DASHBOARDS_PASS`
- `PHASE10_PAYMENT_QA_PASS`
- `PHASE10_PHASE9_BETA_CANDIDATE_PASS`
- `PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED`
- `PHASE10_PLAY_CLOSED_TEST_READY`
- `PHASE10_PRIVACY_PAYLOAD_PASS`
- `PHASE10_PUBLIC_LAUNCH_DECISION`
- `PHASE10_RECRUITING_PASS`
- `PHASE10_RETENTION_REPORT_PASS`
- `PHASE10_SIGNED_OFF_BY`
- `PHASE10_SUPPORT_DESK_PASS`
- `PHASE10_TESTFLIGHT_READY`

### Phase 11 public launch

Tas must provide real values/evidence for these exact keys before this gate can close:

- `PHASE11_ASO_REVIEW_PASS`
- `PHASE11_CREATOR_DISCLOSURE_PASS`
- `PHASE11_INCIDENT_ROLLBACK_PASS`
- `PHASE11_MONITORING_PASS`
- `PHASE11_PHASE10_EXIT_PASS`
- `PHASE11_PHASE9_RC_SIGNOFF_PASS`
- `PHASE11_PRODUCTION_ENV_PASS`
- `PHASE11_REVENUE_RECON_PASS`
- `PHASE11_REVENUECAT_PROD_PASS`
- `PHASE11_RING0_PASS`
- `PHASE11_RING1_72H_REPORT_PASS`
- `PHASE11_SIGNED_OFF_BY`
- `PHASE11_STORE_APPROVAL_PASS`
- `PHASE11_SUPPORT_READY`
- `PHASE11_WEEK1_DECISION_PASS`

## How Codex Should Use This

- Do not invent credentials, legal copy, reviewer names, account IDs, or device evidence.
- Continue engineering work that does not require these items.
- When a task blocks on this file, record the exact missing evidence in the affected readiness doc and keep working on the next unblocked launch gate.
- Run `npm run docs:tas-todo-audit:strict` after readiness-gate changes. It
  verifies this handoff still covers the Phase 2-11 external evidence gates and
  writes the exact machine-extracted key inventory to
  `docs/generated/tas-todo-audit.{json,md}`. Use
  `npm run docs:tas-todo-audit:check` in verification-only passes to confirm
  the committed generated inventory is current without rewriting timestamps.
