# Launch Readiness

Date: 2026-07-07

This is the fast source of truth for what exists, what is simulated, and what
still blocks a paid public launch.

Phase 3 local governance scaffolding exists: regulatory/data/consent/store
metadata packets, clinical and chemistry review logs, policy-link wiring, review
packet generation, and claim/gate tests. This is not legal, clinical, chemistry,
privacy, or IP clearance.

Phase 4 catalog scaffolding exists: catalog schema/RLS, source memos, parser and
quality logic, OBF fixture import/QA tooling, catalog lookup/search/report Edge
Functions, and mobile source/quality disclosure. This is not source/legal
clearance and not a real launch catalog.

Fresh verification on 2026-07-07:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 153 mobile test files, 1515 tests.
- `npm --workspace apps/mobile run typecheck` passed.
- `npm --workspace apps/mobile run lint` passed.
- `npm --workspace apps/mobile run test` passed: 153 test files, 1515 tests.
- `npm run brand:audit:strict` passed with 0 public launch-risk and 0
  review-needed hits.

Re-run all three after any production-readiness change.

## Launch Gates

1. RoutineKind is the working local/native identity, but legal clearance,
   domain/store reservation, and production identity evidence are unresolved.
   Existing public `OnSkin` surfaces remain a direct customer-confusion and
   trademark risk if the app reverts to the legacy name.
2. Supabase project is not live, migrations are not applied to production, and
   RLS has not been tested with real users.
3. RevenueCat is not live; purchases, restore, renewal, refunds, and webhook
   entitlement sync are not production-real.
4. Apple Developer and Google Play Console apps are not verified under a
   counsel-cleared brand/package identity.
5. Clinical review is not complete for conflict rules, routine guidance, PAO
   defaults, recommendations, Skin Notes, and Ask copy.
6. Legal/privacy copy is not final for terms, privacy, consumer health data,
   subscription, commerce, photo, community, and AI/Ask consents.
7. Real product and ingredient catalog seed is not imported; source/license
   review, ODbL posture, curated batch, and beta coverage are not complete.
8. Native camera, barcode, guided photo capture, and encrypted local photo file
   storage are implemented in repo but not verified in a custom dev build;
   native OCR remains gated off.
9. Native notification delivery and Android 14+ behavior are not verified on
   physical devices.
10. Closed beta has not proven activation, retention, catalog usefulness, and
    willingness to pay.

## Readiness Table

| Area                           | Status                    | Production risk                                                                                                             | Owner                                           | Next action                                                                                                             | Exit criteria                                                                                         |
| ------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Brand and app identity         | launch-blocked            | RoutineKind defaults reduce the legacy `OnSkin` conflict, but the candidate is not counsel-cleared or reserved              | Founder + trademark counsel                     | Clear or reject `RoutineKind`; reserve final domain/store/package IDs and provide production identity evidence          | Written clearance, final domain, final bundle/package IDs, and store/domain reservation evidence      |
| Architecture and app shell     | implemented               | Dev foundation exists, but release build not verified                                                                       | Engineering                                     | Keep typecheck/lint/test green                                                                                          | Release candidate builds on iOS and Android                                                           |
| Auth and onboarding foundation | stubbed                   | Account linking, Turnstile, final quiz/legal copy not production-verified                                                   | Engineering + counsel                           | Configure live auth providers after brand decision                                                                      | Anonymous, Apple, Google, deletion, and export flows pass live QA                                     |
| Supabase backend               | stubbed                   | Local migrations, deploy wrapper, and RLS smoke script exist; no live project/RLS adversarial pass                          | Engineering                                     | Create staging/production Supabase projects, run `phase2:check-env:strict`, deploy staging, then run `phase2:rls-smoke` | Two-user RLS test, Edge Functions deployed, advisors clean or accepted                                |
| Ingredient conflict engine     | launch-blocked            | Deterministic logic exists; unreviewed guidance could be unsafe or misleading                                               | Dermatologist + cosmetic chemist + engineering  | Clinical review and reviewed-content gating                                                                             | Only reviewed rules exposed by production gates                                                       |
| Smart Shelf manual flows       | implemented               | Local-first manual/no-match flows are useful; no real catalog match rate yet                                                | Engineering                                     | Keep manual fallback honest while catalog imports are built                                                             | Beta users can add real products even when scans miss                                                 |
| Barcode/OCR shelf intake       | needs-device-verification | Live barcode camera path and editable label-capture path exist; native OCR is intentionally disabled until ML Kit/Vision QA | Engineering                                     | Run barcode device matrix, then add/review on-device OCR if it remains a launch claim                                   | Barcode match rate tracked; OCR claim hidden unless real OCR passes beta labels                       |
| Product catalog                | launch-blocked            | Phase 4 schema/API/parser/source disclosure exists, but no source-cleared launch catalog or beta coverage yet               | Engineering + founder + counsel                 | Clear OBF/CosIng/ODbL posture, run export-based imports, curate beta-driven launch batch, review QA                     | Meaningful beta scan match rate, attribution obligations satisfied, only eligible products drive recs |
| Routine builder and scheduler  | implemented               | Local deterministic generation exists; server persistence/drag-drop are deferred                                            | Engineering + clinical reviewers                | Review rules; persist cycle anchor where needed                                                                         | Users can generate, follow, adapt, and recover routines without fake claims                           |
| Today check-off and streaks    | implemented               | Local-first loop exists; device notification and server sync need QA                                                        | Engineering                                     | Verify offline/online completion persistence                                                                            | Day-level check-off and streak behavior remain correct across reinstall/upgrade                       |
| Guided photo progress          | needs-device-verification | Front-camera still capture and encrypted local file storage exist; face/pose signals are coarse preview estimates           | Engineering + privacy counsel                   | Run physical-device capture/encryption/restart/delete QA; add reviewed face/pose module before precise framing claims   | Physical-device capture passes lighting/framing/local-only tests                                      |
| Reminders                      | needs-device-verification | Scheduling code exists; physical iOS/Android delivery not verified                                                          | Engineering                                     | Device QA on iOS latest, older iOS, Android latest, Android 14+                                                         | Quiet hours, timezone changes, reinstall, and notification copy pass                                  |
| Widgets and live activities    | inert                     | In-app previews exist; native WidgetKit/Glance/ActivityKit not built                                                        | Engineering                                     | Keep post-launch unless native build is funded                                                                          | Removed from launch claims or implemented and device-verified                                         |
| Paywall and entitlement UI     | stubbed                   | Screens/gates and guarded RevenueCat SDK wiring exist; native products/restores are not verified                            | Engineering + founder                           | Configure RevenueCat after brand/account setup and test in custom dev builds                                            | Purchase, restore, refund, expiry, renewal, and webhook matrix passes                                 |
| Recommendations                | launch-blocked            | Type-first engine exists; real products and goal-active recs need catalog/review                                            | Clinical reviewers + engineering                | Seed catalog and review goal-active recommendation types                                                                | Recommendation claims are reviewed and commerce-independent                                           |
| Commerce/affiliate             | inert                     | Consent, disclosure, and attribution scaffolds exist; no live rail                                                          | Founder + counsel + engineering                 | Decide launch vs post-launch; resolve ShopMy or alternative                                                             | If launch: rail, consent, FTC disclosure, and order reports work; else hidden                         |
| Community/Skin Notes           | launch-blocked            | Expert read-mostly scaffold exists; peer posting needs moderation and legal floor                                           | Founder + clinical reviewers + moderation owner | Recruit experts and define moderation operations                                                                        | No open UGC until report/block/contact/EULA/human moderation are live                                 |
| Trend analysis                 | launch-blocked            | No-score posture and deferred route recovery are correct; real CV/fairness/legal review absent                               | Engineering + counsel + fairness reviewer       | Keep as post-launch unless validation is funded                                                                         | No score/age/percentage claims; fairness and legal signoff complete                                   |
| Ask assistant                  | launch-blocked            | Deterministic local advisor exists; cloud Ask is deferred                                                                   | Engineering + counsel + clinical reviewers      | Keep deterministic; do not launch cloud RAG until vendor/safety/legal gates pass                                        | Grounded, bounded answers; no unreviewed medical claims                                               |
| Growth share card              | needs-device-verification | Card and export path exist; final domain/store fallback/attribution blocked by final identity and device QA                 | Engineering + founder                           | Final identity/domain and universal link                                                                                | Shared card opens app or web fallback and tracks attribution                                          |
| Analytics/crash reporting      | stubbed                   | PostHog/Sentry runtime wiring exists; projects, source maps, dashboards, deletion, and privacy review not live              | Engineering + founder                           | Configure after brand/account setup                                                                                     | Production dashboards, deletion, source maps, and crash privacy review pass                           |
| Policies/support/deletion      | launch-blocked            | Copy and functions are not final/live                                                                                       | Counsel + engineering                           | Finalize policy URLs and deploy account deletion/export                                                                 | Store listing URLs work; deletion/export verified against live backend                                |
| Phase 3 signoff packet         | launch-blocked            | Review packets and gates exist, but professional signoffs are absent                                                        | Founder + counsel + clinical reviewers          | Run review packet, retain reviewers, close signoff logs                                                                 | Counsel, dermatologist, cosmetic chemist, privacy, and IP signoffs attached to exact file hashes      |
| Closed beta                    | launch-blocked            | No real cohort metrics yet                                                                                                  | Founder + engineering                           | Recruit 50-100 users for V1 loop                                                                                        | Activation, D7/D14/D30 retention, trial starts, and willingness-to-pay measured                       |

## Practical V1

The V1 that can plausibly earn paid subscribers is narrow:

- onboarding with age gate and health/privacy consent
- shelf intake with manual fallback
- conflict detection for real owned products
- routine builder and Today check-off
- baseline photo timeline
- local reminders
- paywall and privacy controls
- shareable conflict card after final brand/domain

Everything else should serve this loop or remain post-launch.

## Owner Map

| Blocker                  | Owner                                      |
| ------------------------ | ------------------------------------------ |
| Final identity clearance | Founder + trademark counsel                |
| Supabase                 | Engineering                                |
| RevenueCat               | Engineering + founder account owner        |
| Apple/Google accounts    | Founder                                    |
| Clinical review          | Founder + dermatologist + cosmetic chemist |
| Legal/privacy copy       | Founder + privacy/app counsel              |
| Catalog seed             | Engineering                                |
| Native camera/OCR/photos | Engineering                                |
| Device notification QA   | Engineering                                |
| Commerce rail            | Founder + counsel + engineering            |
| Community moderation     | Founder + moderation owner                 |
| Store listing and ASO    | Founder + design/marketing                 |
| Closed beta              | Founder + engineering                      |

## Completion Rule

Do not call the app complete because screens exist. It is complete only when real
users can safely complete the V1 loop with real products, real payments, real
privacy controls, reviewed guidance, and measured retention.
