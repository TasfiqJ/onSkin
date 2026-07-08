# For Tas To Do

Date: 2026-07-07

Purpose: track work Codex must not guess or fake. These items require a founder decision, account owner, credential, payment method, counsel/reviewer signoff, physical device, or real beta users. Codex can keep building around them, but launch readiness cannot close until evidence is attached.

## P0 - Brand And Identity

Status: launch-blocked

- Decide whether to keep `OnSkin` only with written trademark counsel clearance. Default path is rebrand.
- Treat `RoutineKind` as the current working candidate, not final clearance.
- Web-indexed App Store/Google Play spot checks on 2026-07-06 and
  2026-07-07 did not surface an exact app listing for `RoutineKind`, and
  2026-07-07 DNS checks returned no answer for `routinekind.app` or
  `routinekind.com`, but that is not trademark clearance, registrar
  availability, or a store-console reservation.
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
- Supabase anonymous auth and consent-ledger QA for the local-first
  `photo_capture` path: attach evidence that first-use photo capture can save
  a local proof offline/pre-account and that staging/production sessions insert
  immutable `photo_capture` consent rows with the shown version/hash under RLS.
  Repeat the same live-auth/RLS evidence for `photo_trend_insights` grant and
  withdrawal rows; Codex can verify the Trend UI recovery branch locally with
  `EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER=local_only`, but cannot prove the live
  ledger without Tas-owned Supabase/auth credentials.
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

- Signed review logs in `docs/phase-3/`.
- Strict Phase 3 audit passing or explicitly accepted with recorded exceptions.
- File hashes or generated review packets tied to the exact reviewed build.

## P1 - Physical Device QA

Status: needs-device-verification

- Create EAS development or staging builds for iOS and Android.
- Test on at least one physical iPhone and one physical Android device.
- Provide real EAS build UUIDs or `expo.dev` build URLs, physical device model
  names with OS versions, and a named tester/reviewer signoff. Generic labels
  like `iPhone model / iOS version`, local build notes, pending IDs, and
  placeholder signoff names are rejected by `phase5:qa-packet:strict`.
- Verify barcode scan, label capture/manual fallback, progress photo capture, encrypted photo save/restart/delete, notifications, share sheet, RevenueCat sandbox smoke, Sentry native smoke, and Supabase catalog calls.
- Verify populated Progress comparison on physical iOS and Android devices with
  real encrypted photo thumbnails: Compare/Timeline, No scores, Side-by-side,
  date-change chips, comparison photo-picker dismiss/selection, app-lock, and
  VoiceOver/TalkBack traversal must remain readable, private, and tappable on
  short screens.
- Verify first-use Progress photo consent failure/retry sequencing on native:
  failed local save does not open the camera or permission prompt, retry saves
  consent before permission, and the app remains past the consent gate after
  restart.
- Verify first-use Progress photo consent, camera-unavailable, and permission
  recovery overlays on physical iOS and Android devices with real safe-area
  insets: notch/status bar, home indicator/gesture nav, and short-screen
  layouts must keep the primary action and `Not now` exit fully visible and
  tappable.
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

- Build IDs.
- Device names and OS versions.
- Named tester signoff.
- Updated `docs/phase-5/generated/device-qa-packet.md`.

## P1 - Catalog And Source Quality

Status: launch-blocked

- Approve CosIng access/licensing route.
- Approve Open Beauty Facts ODbL/source/image-rights posture.
- Import real product data from approved sources.
- Curate the first launch batch from beta shelves and common products.
- Track barcode match rate, search miss rate, wrong-match rate, parser unknown-token rate, and support tickets.
- Keep product images disabled unless image rights are cleared.

Evidence needed:

- Reviewed source memos.
- QA report with zero launch blockers.
- Beta coverage report with acceptable match/miss outcomes.

## P1 - Closed Beta And Business Proof

Status: launch-blocked

- Recruit 50-100 real users who own 5+ skincare products.
- Observe first-session onboarding and shelf add.
- Measure product add completion, first useful insight, first check-off, D7/D14/D30 retention, baseline photo, reminders, trial starts, trial-to-paid, cancel/refund reasons, catalog misses, and support tickets.
- Run willingness-to-pay tests for annual pricing.
- Interview churned or confused users within 48 hours.

Evidence needed:

- Cohort metrics.
- Churn interview notes.
- Catalog issue summary.
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

| Gate                                                        | Evidence Tas must provide                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase2:check-env:strict`                                   | Final app identity, production HTTPS policy URLs, production Supabase project URL, RevenueCat, OAuth, production PostHog host, production Sentry DSN, Turnstile, body-limit, rate-limit, and secret-storage values configured outside git.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `phase3:audit-copy:strict`                                  | Final legal/privacy/consent copy plus clinical and cosmetic reviewer signoff for rules, routines, PAO defaults, recommendations, Skin Notes, Ask, community, and commerce-adjacent copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `phase4:check-source-env`                                   | Final catalog/source identity values: `CATALOG_APP_NAME`, `CATALOG_APP_VERSION`, production `CATALOG_CONTACT_EMAIL`, production HTTPS `CATALOG_ATTRIBUTION_URL`, and `OBF_USER_AGENT` with a production contact email. These must not use the uncleared legacy brand and should match the final support/domain identity.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `phase5:check-native-config:strict`                         | iOS and Android build IDs, physical device names/OS versions, native camera/OCR/photo/notification/share-sheet QA, and named tester signoff.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `phase6:check-payments-env:strict`                          | Final RevenueCat annual/monthly/reverse-trial product IDs plus sandbox evidence for purchase, restore, trial/reverse-trial, expiry, refund/grace states, win-back eligibility/ineligible fallback, webhook verification, finance reconciliation, and store product setup. Evidence flags are trimmed/case-normalized, but only `true` passes, and `PHASE6_SIGNED_OFF_BY` must be a real named signoff, not a placeholder or `example.com` email.                                                                                                                                                                                                                                                                                             |
| `phase7:check-core-loop:strict` / `phase7:qa-packet:strict` | Final brand domain, production privacy/terms/support/export/delete/consumer-health URLs, final privacy and consent copy, reviewed conflict/routine/recommendation evidence, Supabase RLS evidence, catalog beta import evidence, physical-device QA, RevenueCat QA, privacy export/delete QA, beta dashboard readiness, and named Phase 7 signoff via `PHASE7_SIGNED_OFF_BY`. Evidence flags are trimmed/case-normalized, but only `true` passes. Generic signoffs like `Tester Name`, `TBD`, or `example.com` emails are rejected.                                                                                                                                                                                       |
| `phase8:verify` strict gates                                | Final brand domain, production marketing/support URLs, App Store and Play URLs, DNS, Universal Links/App Links, share-card device QA, attribution privacy review, store packets, creator compliance, support responses, launch dashboard, dry run, Apple Team ID, Android release certificate fingerprint, and named signoff. Evidence flags are trimmed/case-normalized, but only `true` passes. Apple Team ID must be a real 10-character non-placeholder team ID, Android release certificate evidence must be real SHA-256 fingerprint(s), and generic signoffs are rejected.                                                                                                                                         |
| `phase9:verify` strict gates                                | Live Supabase, RLS staging/production, Edge auth, public forms, catalog rate limits, order-report polling, data export/delete, consent withdrawal, observability payload approval, store build inspection, dependency audit, rollback drill, incident response, and beta evidence. Phase 9 release evidence, individual Phase 9 sub-gates, and the production Phase 7 surface bridge use the same normalized evidence rule: whitespace/case are tolerated, but only `true` passes. Real named signoffs are required where requested, and placeholder signoffs are rejected.                                                                                                                                                                      |
| `phase10:verify` strict gates                               | Final beta identity/policy values (`EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_SUPPORT_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL`, `EXPO_PUBLIC_DATA_EXPORT_URL`, `EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL`, `EXPO_PUBLIC_FINAL_BRAND_DOMAIN`, `EXPO_PUBLIC_MARKETING_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`), closed beta identity, TestFlight, Play closed test including 12 testers for 14 days where required, recruiting, beta terms, dashboards, support desk, privacy-payload approval, payment QA, catalog beta report, retention report, public-launch decision (`go` or `limited`), and real named signoff. Phase 10 readiness, beta analytics, and packet gates all require normalized `true`; generic signoffs like `Tester Name`, `TBD`, or `example.com` emails are rejected. |
| `phase11:verify` strict gates                               | Final public launch values (`EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_SUPPORT_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL`, `EXPO_PUBLIC_DATA_EXPORT_URL`, `EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL`, `EXPO_PUBLIC_FINAL_BRAND_DOMAIN`, `EXPO_PUBLIC_MARKETING_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_APP_STORE_URL`, `EXPO_PUBLIC_PLAY_STORE_URL`), Phase 10 exit review, RC signoff, store approval, production environment, RevenueCat production verification, monitoring, support readiness, incident/rollback drill, launch ring reports, ASO review, creator disclosure review, revenue reconciliation, week-1 decision, and real named launch signoff. Generic signoffs are rejected. |

## How Codex Should Use This

- Do not invent credentials, legal copy, reviewer names, account IDs, or device evidence.
- Continue engineering work that does not require these items.
- When a task blocks on this file, record the exact missing evidence in the affected readiness doc and keep working on the next unblocked launch gate.
