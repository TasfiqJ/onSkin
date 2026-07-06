# For Tas To Do

Date: 2026-07-06

Purpose: track work Codex must not guess or fake. These items require a founder decision, account owner, credential, payment method, counsel/reviewer signoff, physical device, or real beta users. Codex can keep building around them, but launch readiness cannot close until evidence is attached.

## P0 - Brand And Identity

Status: launch-blocked

- Decide whether to keep `OnSkin` only with written trademark counsel clearance. Default path is rebrand.
- Treat `RoutineKind` as the current working candidate, not final clearance.
- Web-indexed App Store/Google Play spot checks on 2026-07-06 did not surface an exact app listing for `RoutineKind`, but that is not trademark clearance and not a store-console reservation.
- Run formal trademark, App Store, Google Play, domain, social handle, and paid-search checks for the final candidate.
- Choose final app name, legal entity display, domain, support email, bundle ID, Android package ID, URL scheme, policy URL root, and share-card watermark.
- Record the decision in `docs/brand-decision-memo.md`.
- After the 2026-07-06 runtime, Phase 8 public-copy, and RevenueCat product-ID
  config sweeps, `npm run brand:audit` reports 18 remaining public launch-risk
  references. They are intentionally limited to native app config
  (`apps/mobile/app.base.json` display/slug/scheme/bundle/package/permission
  strings) and Supabase redirect/project config. Annual, monthly, and local
  reverse-trial RevenueCat product IDs are now env-driven with neutral local
  placeholders; replace them only after the final identity is cleared and
  matching Apple, Google, RevenueCat, Supabase, domain, and OAuth console
  changes are ready.

Evidence needed:

- Counsel recommendation.
- Founder decision.
- Domain and social availability record.
- Final identifiers and policy URL list.

## P0 - Production Accounts And Secrets

Status: launch-blocked

- Supabase staging and production projects.
- Apple Developer and App Store Connect app under cleared bundle ID.
- Google Play Console app and OAuth clients under cleared package ID.
- RevenueCat project, products, offerings, entitlements, and webhook secret.
- Final RevenueCat annual, monthly, and reverse-trial product IDs for
  `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID`,
  `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`, and
  `EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID`.
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
- Verify barcode scan, label capture/manual fallback, progress photo capture, encrypted photo save/restart/delete, notifications, share sheet, RevenueCat sandbox smoke, Sentry native smoke, and Supabase catalog calls.
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

These are the exact external proof switches surfaced by the local launch gates on 2026-07-06. Do not set any of them to `true` until the matching evidence exists.

| Gate                                | Evidence Tas must provide                                                                                                                                                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase2:check-env:strict`           | Final app identity, policy URLs, Supabase, RevenueCat, OAuth, PostHog, Sentry, Turnstile, body-limit, rate-limit, and secret-storage values configured outside git.                                                                                                                                  |
| `phase3:audit-copy:strict`          | Final legal/privacy/consent copy plus clinical and cosmetic reviewer signoff for rules, routines, PAO defaults, recommendations, Skin Notes, Ask, community, and commerce-adjacent copy.                                                                                                             |
| `phase5:check-native-config:strict` | iOS and Android build IDs, physical device names/OS versions, native camera/OCR/photo/notification/share-sheet QA, and named tester signoff.                                                                                                                                                         |
| `phase6:check-payments-env:strict`  | Final RevenueCat annual/monthly/reverse-trial product IDs plus sandbox evidence for purchase, restore, trial/reverse-trial, expiry, refund/grace states, webhook verification, finance reconciliation, and store product setup.                                                                      |
| `phase9:verify` strict gates        | Live Supabase, RLS staging/production, Edge auth, public forms, catalog rate limits, order-report polling, data export/delete, consent withdrawal, observability payload approval, store build inspection, dependency audit, rollback drill, incident response, and beta evidence.                   |
| `phase10:verify` strict gates       | Closed beta identity, TestFlight, Play closed test including 12 testers for 14 days where required, recruiting, beta terms, dashboards, support desk, privacy-payload approval, payment QA, catalog beta report, retention report, public-launch decision, and named signoff.                        |
| `phase11:verify` strict gates       | Phase 10 exit review, RC signoff, store approval, production environment, RevenueCat production verification, monitoring, support readiness, incident/rollback drill, launch ring reports, ASO review, creator disclosure review, revenue reconciliation, week-1 decision, and named launch signoff. |

## How Codex Should Use This

- Do not invent credentials, legal copy, reviewer names, account IDs, or device evidence.
- Continue engineering work that does not require these items.
- When a task blocks on this file, record the exact missing evidence in the affected readiness doc and keep working on the next unblocked launch gate.
