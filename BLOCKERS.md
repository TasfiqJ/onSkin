# Blockers - Founder Do-Not-Guess List

Date: 2026-07-07

Everything here needs a founder decision, account, API key, payment method,
legal/clinical signoff, production service, real-device verification, or beta
proof. The app has substantial implemented surfaces, but it is not
production-ready.

Read this with:

- `docs/MASTER_PLAN.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/FEATURE_INDEX.md`
- `docs/ROADMAP.md`
- `docs/rebrand-and-core-loop-migration-checklist.md`
- `docs/FOR_TAS_TO_DO.md`
- `LAUNCH_READINESS.md`
- `docs/brand-decision-memo.md`
- `docs/brand-evidence.md`
- `docs/v1-scope-freeze.md`
- `docs/phase-2-readiness-checklist.md`
- `docs/phase-2-production-infrastructure-runbook.md`
- `docs/phase-2-status.md`
- `docs/store-privacy-inventory.md`
- `docs/seven-figure-readiness.md`
- `docs/phase-3/regulatory-positioning-memo.md`
- `docs/phase-3/clinical-review-log.md`
- `docs/phase-3/cosmetic-chemistry-review-log.md`
- `docs/phase-3/quiz-fto-summary.md`
- `docs/phase-3/data-inventory.md`
- `docs/phase-3/consent-matrix.md`
- `docs/phase-3/store-metadata-review.md`
- `docs/phase-3/app-review-notes.md`
- `docs/phase-3/google-play-health-declaration-notes.md`
- `docs/phase-3/launch-claims-vocabulary.md`
- `docs/phase-4/catalog-source-memo-cosing.md`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md`
- `docs/phase-4/odbl-compliance-memo.md`
- `docs/phase-4/ingredient-tag-taxonomy.md`
- `docs/phase-4/curated-product-curation-sheet.md`
- `docs/phase-4/first-curated-product-batch.md`
- `docs/phase-4/observability-dashboard.md`
- `docs/phase-4/beta-coverage-report.md`
- `docs/phase-4/phase-4-exit-review.md`

## Status Key

- `implemented`: production-shaped code exists, still verify in release QA.
- `stubbed`: code exists around placeholders or local/dev substitutes.
- `simulated`: UX or pure logic exists, but real native/device/data input is not
  implemented.
- `inert`: scaffold exists but is intentionally non-operational.
- `needs-device-verification`: code exists but has not passed physical-device QA.
- `launch-blocked`: must not ship publicly until the blocker clears.

## Current Launch Gates

1. RoutineKind working identity is implemented locally, but legal/store/domain
   clearance and production identity evidence are unresolved.
2. Supabase project not live.
3. RevenueCat not live.
4. Apple/Google accounts and store records not verified.
5. Clinical review not complete.
6. Legal/privacy copy not final.
7. Real catalog seed not imported and source/license review not complete.
8. Native camera/barcode/photo capture are implemented but not physical-device
   verified; native OCR remains intentionally gated off.
9. Native notification/device verification incomplete.
10. Closed beta not run.

## Source-Of-Truth Status

The old `B-MISSING-DOCS` blocker is closed. The docs folder now contains
`docs/00-architecture.md` through `docs/14-growth-to-seven-figures.md`, plus
`docs/legal-readiness.md`.

The `04_repo_docs` strategy packet has also been copied into active docs as
`docs/MASTER_PLAN.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/ARCHITECTURE.md`,
`docs/FEATURE_INDEX.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`,
`docs/TESTING_STRATEGY.md`, `docs/CODE_REVIEW.md`,
`docs/MASTER_PLAN_UPDATE_PATCH.md`, and
`docs/CODEX_IMPLEMENTATION_PROMPT.md`. Future strategy, pricing, launch,
privacy, or architecture changes should use the master-plan patch process
instead of silently editing implementation around the plan.

Fresh verification on 2026-07-08: `npm run typecheck`, `npm run lint`,
`npm test`, `npm --workspace apps/mobile run typecheck`,
`npm --workspace apps/mobile run lint`, `npm --workspace apps/mobile run test`,
`npm run phase5:verify`, `npm run phase7:verify`, `npm run brand:audit:strict`,
`npm run phase8:verify`, `npm run phase9:verify`, and
`npm run phase10-11:verify` pass non-strict code gates. The Phase 7 core-loop
packet has been refreshed for the current Today and Progress route hashes; the
Phase 8 growth/store packet has been refreshed for the current share-card and
conflict-share route hashes; the Phase 5 native-device packet has been
refreshed for the current progress capture route hash; strict Phase 5, Phase 7,
and Phase 8 still require the founder/reviewer/device evidence listed in
`docs/FOR_TAS_TO_DO.md`. The Phase 9
privacy payload audit now accepts the route-owned progress-photo share
confirmation instead of requiring a native alert. The mobile suite currently
covers 170 test files and 1743 tests. The 2026-07-08 Expo web shortest-phone
rerun at 320 x 480 passed 49 direct-entry routes with zero failed routes,
visible clipped controls, sub-44 user-facing controls, blocked hit-tests,
horizontal overflow, or disallowed browser logs. The Shelf manual category
picker also passed fresh 320 x 480 and 320 x 568 Expo web evidence for its named
bottom sheet, scrollable lower category options, 52 px rows, `Other` selection,
`/shelf/opened` continuation, and zero disallowed browser logs. Additional
320 x 440 / 320 x 430 Shelf intake evidence verifies the ultra-short manual
add, OCR capture-failure/manual-text continuation, and labeled no-match fallback
paths without horizontal overflow, blocked user-facing controls, or
current-origin warn/error logs.
Strict beta/public-launch gates still require the external evidence listed in
`docs/FOR_TAS_TO_DO.md`. Re-run the relevant checks after any
readiness-changing work.

The previous `docs/design-spec.pdf` reference is obsolete. The available design
handoff source in this workspace is the local `dx*` folders and `.dc.html`
artifacts.

Phase 3 local governance scaffolding exists, but it is not professional
clearance. The repo now has Phase 3 review logs, regulatory/data/consent/store
metadata packets, `scripts/phase3/audit-copy.mjs`,
`scripts/phase3/build-review-packet.mjs`, a policy-link registry, store metadata
claim tests, and production gate tests. The strict Phase 3 audit must remain
blocking until counsel, dermatologist, and cosmetic-chemist signoffs are real.

## B-BRAND - RoutineKind candidate clearance and launch identity

Status: `launch-blocked`

There is already a public skincare/cosmetic scanner branded `OnSkin` at
`onskin.com`, with App Store and Google Play presence. This repo no longer uses
the legacy identity for local/native launch defaults: the current working
candidate is `RoutineKind`, with `routinekind://` and `com.routinekind.app`
development/staging defaults. `npm run brand:audit:strict` passes with zero
public launch-risk and zero review-needed legacy-brand hits; remaining legacy
hits are deliberate guard rails, internal namespaces, fixtures, or historical
context.

This is not legal clearance, trademark clearance, domain registration, App
Store name reservation, Google Play package reservation, or final production
identity evidence. Production native config still fails closed unless
`BRAND_LEGAL_CLEARANCE=cleared` and explicit final identity env values are set.

Risk:

- trademark/customer-confusion exposure if the app reverts to `OnSkin` or uses
  a confusingly similar identity
- users downloading or contacting the wrong app if public surfaces are created
  before final reservation
- App Store / Play review confusion if bundle/package/name records are created
  under an uncleared identity
- paid-search and ASO conflict
- support/domain/policy URL confusion
- rework if Apple, Google, RevenueCat, Supabase, policy URLs, or beta users are
  created under a candidate that later changes

Next action:

- Give counsel `docs/brand-evidence.md`.
- Ask counsel to clear or reject `RoutineKind` as the final app identity; do not
  revert to `OnSkin` unless counsel explicitly clears it.
- Run registrar, App Store Connect, Google Play Console, social-handle, paid
  search, and common-law checks for the final candidate.
- Use `docs/brand-decision-memo.md` to record the final identity decision.

Exit criteria:

- written counsel recommendation exists;
- founder decision is recorded;
- final app name, domain, bundle ID, Android package, scheme, support URL, and
  policy URLs are chosen;
- store-console and domain reservation evidence is attached;
- code/copy/share-card/policy/env references match the final identity and
  typecheck/lint/tests pass.

Default until cleared: do not launch as `OnSkin`, and do not treat
`RoutineKind` as final until counsel and store/domain reservation evidence are
attached.

## B-SUPABASE - Live backend

Status: `stubbed`

The repo contains migrations, Supabase client code, generated types, Edge
Functions, a staging deploy wrapper, and a live-project RLS smoke script. There
is no live staging/production Supabase project verified for release.

Next action:

- create staging and production projects after the brand decision;
- fill `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`;
- run `npm run phase2:check-env:strict`;
- apply all migrations with `scripts/phase2/deploy-supabase-staging.ps1`;
- regenerate `packages/types/src/database.types.ts`;
- deploy `revenuecat-webhook`, `account-deletion`, `data-export`, and
  `order-report-poll`;
- run Security Advisor and Performance Advisor;
- run `npm run phase2:rls-smoke` with at least two users plus anonymous account
  flows.

Exit criteria:

- current user can only read/write their own data;
- account deletion and data export work against live backend;
- Edge Functions return correct status and logs;
- generated DB types match live schema.

## B-APPLE - Apple Developer and App Store Connect

Status: `stubbed`

Apple account and App Store records should be created only under the
counsel-cleared final identity. Do not use legacy `OnSkin` identifiers.

Next action:

- create App ID under cleared bundle ID;
- configure Sign in with Apple;
- create server-side token revocation credentials for account deletion;
- create App Store Connect app;
- prepare privacy nutrition labels and required support/policy URLs.

Exit criteria:

- TestFlight build installs and auth/deletion flows pass;
- subscription metadata and policy links are accurate;
- app identity matches brand memo.

## B-GOOGLE - Google Sign-In and Play Console

Status: `stubbed`

Play package and OAuth records should be created only under the counsel-cleared
final identity. Do not use legacy `com.onskin.app` identifiers.

Next action:

- create Play Console app under cleared package ID;
- configure OAuth client IDs and Android SHA fingerprints;
- verify Google sign-in, account linking, deletion, and restore behavior.

Exit criteria:

- internal test build installs;
- Google sign-in works without `DEVELOPER_ERROR`;
- account deletion/revocation behavior is verified.

## B-REVENUECAT - Live purchases and entitlements

Status: `stubbed`

Paywall and entitlement surfaces exist. The native RevenueCat SDK is installed
and guarded purchase/restore runtime wiring exists, bound to the Supabase user
ID, but real products, offerings, sandbox purchases, localized pricing, webhook
reconciliation, and account deletion cleanup are not live.

Next action:

- create RevenueCat project after final app identity;
- configure monthly/annual products, offerings, and entitlements;
- bind RevenueCat `appUserID` to Supabase user ID;
- fetch localized prices from RevenueCat;
- wire purchase, restore, intro eligibility, cancellation/manage links;
- deploy and verify webhook reconciliation;
- confirm subscriber-deletion API for account deletion.

Exit criteria:

- no local stub can grant paid access in production;
- purchase/restore/renewal/refund/expiry/grace/upgrade/downgrade matrix passes;
- entitlement state is correct offline and reconciles online;
- account deletion handles active subscribers correctly.

## B-POSTHOG - Analytics

Status: `stubbed`

PostHog runtime wiring exists with JSON-safe event properties and session replay
disabled, but the production project, consent/privacy review, dashboards, and
deletion behavior are not live.

Exit criteria:

- PostHog project exists under cleared brand;
- event taxonomy matches V1 loop;
- person deletion works with account deletion;
- no health/photo content is sent without explicit consent.

## B-SENTRY - Crash reporting

Status: `stubbed`

Sentry runtime wiring exists with privacy-conservative defaults, but the
production project, source-map upload, release health, and crash privacy review
are not live.

Exit criteria:

- Sentry project exists under cleared brand;
- source maps upload for release builds;
- crash/log privacy review confirms no sensitive health/photo content leaks.

## B-TURNSTILE - Abuse prevention

Status: `stubbed`

Turnstile account and keys are not configured.

Exit criteria:

- site key and secret are configured where needed;
- flows pass without locking out legitimate users.

## B-QUIZ-COPY - Onboarding quiz and scoring copy

Status: `launch-blocked`

Quiz questions, scoring, and skin-profile labels need legal review, especially
to avoid copying or implying proprietary skin typing frameworks.

Current implementation note:

- `apps/mobile/src/features/onboarding/quiz.ts` is still explicitly
  placeholder-gated.
- `docs/phase-3/quiz-fto-summary.md` is the review packet entry point.

Exit criteria:

- final quiz copy is counsel-reviewed;
- age gate/minors policy is clear;
- copy avoids diagnosis and unsupported claims;
- reviewed copy version is recorded.

## B-PRIVACY-COPY - Policies and consent copy

Status: `launch-blocked`

Required final URLs:

- Terms
- Privacy Policy
- Consumer Health Data Privacy Policy
- Support
- Account deletion instructions
- Data export instructions

Current implementation note:

- The app now has a central policy URL registry at
  `apps/mobile/src/lib/legal/policyLinks.ts`.
- The You tab exposes the required privacy, consumer health privacy, support,
  deletion, export, and terms links.
- `.env.example` and `phase2:check-env` include the required URL contract.
- The copy and URLs are still placeholders until counsel supplies final text and
  the final brand/domain.

Exit criteria:

- counsel-reviewed policies are live at final brand/domain URLs;
- health data, photo, cloud backup, commerce, community, Ask, analytics, and
  subscription consents are unbundled where required;
- account deletion and export copy matches live behavior.

## B-PRIVACY - Health data, photos, commerce, and AI privacy review

Status: `launch-blocked`

The app touches sensitive wellness/skin, face/photo, subscription, and possible
commerce data. Washington MHMDA, FTC health-app guidance, GDPR/UK/EU if
applicable, Apple/Google data policies, and affiliate disclosure rules need
review before launch.

Exit criteria:

- DPIA or equivalent review complete for health data and photos;
- "photos never leave your device" is literally true unless explicit cloud
  backup consent is implemented;
- data-sharing consent is separate from collection consent where required;
- commerce disclosure language is counsel-approved;
- Ask/cloud transmission consent is final if cloud Ask ever launches.

## B-LEGAL - Store, subscription, claims, and commerce legal review

Status: `launch-blocked`

Current implementation note:

- `docs/phase-3/store-metadata-review.md`,
  `docs/phase-3/app-review-notes.md`, and
  `docs/phase-3/google-play-health-declaration-notes.md` are draft review
  packets, not submission-ready artifacts.
- `apps/mobile/src/lib/legal/storeMetadata.ts` centralizes conservative draft
  store metadata, and tests scan it for Phase 3 claim risks.

Exit criteria:

- auto-renewal and cancellation copy reviewed;
- App Store / Play listing claims reviewed;
- affiliate disclosures reviewed;
- no unbuilt, simulated, or unreviewed feature is marketed as live;
- UGC/community/legal floor is approved before any peer posting launches.

## B-DERM-REVIEW - Clinical and cosmetic chemistry review

Status: `launch-blocked`

Review required for:

- conflict rules;
- pregnancy-related suppression/cautions;
- sequencing rules;
- retinoid ramp and active frequency caps;
- skin-cycling recovery logic;
- PAO category defaults;
- recommendation catalog;
- expert/derm stacks and Skin Notes;
- deterministic Ask answer corpus.

Current implementation note:

- `docs/phase-3/clinical-review-log.md` and
  `docs/phase-3/cosmetic-chemistry-review-log.md` are ready for reviewer
  signoff entries.
- Production gates are tested so unreviewed rules, PAO defaults, stacks, and
  Skin Notes stay hidden until reviewer metadata is recorded.

Exit criteria:

- reviewed rows/content have reviewer metadata or an equivalent record;
- production gates expose only reviewed rules/content;
- unsafe or uncertain guidance escalates to clinician language.

## B-PHASE3-SIGNOFF - Legal, clinical, chemistry, privacy, and IP signoff packet

Status: `launch-blocked`

Phase 3 implementation scaffolding is present, but no final signoff has been
obtained. This blocker exists to prevent a false "Phase 3 complete" label after
only local code/docs work.

Exit criteria:

- counsel signs the regulatory positioning, privacy/data inventory, policies,
  store metadata, subscription copy, commerce disclosure, and AI/Ask posture;
- dermatologist signs the rule/recommendation/Ask/Skin Notes corpus or records
  required changes;
- cosmetic chemist signs PAO defaults, ingredient taxonomy, product type
  caveats, and routine compatibility assumptions;
- IP counsel signs the onboarding quiz/FTO review;
- `npm run phase3:audit-copy:strict` passes because placeholders and blocker
  markers have been removed or formally closed;
- generated review packet hashes are archived with the signoff record.

## B-CATALOG-SEED - Product and ingredient catalog

Status: `launch-blocked`

The shelf and recommendation system needs real product data to become useful.

Current implementation note:

- Phase 4 catalog schema, source metadata, import batches, barcode tables,
  ingredient-list parse tables, quality grades, correction reports,
  contribution queue, and lookup observability tables exist locally.
- Mobile shelf rows now carry catalog source/quality/parse metadata, product
  detail shows source and quality, catalog search is wired through an Edge
  Function, and users can report catalog issues.
- `scripts/phase4/*` can run a fixture import and generated QA report. The
  fixture is not a production catalog.
- Open Beauty Facts contribution-back is intentionally not promised in the UI
  until the source workflow is legally and operationally approved.

Next action:

- verify CosIng access/licensing route;
- import Open Beauty Facts dumps with ODbL attribution/share-alike obligations;
- ingest barcode, brand, product name, category, INCI list, ingredient tags,
  PAO/expiry where available, and commerce links if commerce ships;
- hand-curate top products for launch quality;
- add match-rate observability.

Exit criteria:

- beta users get meaningful barcode/OCR/manual match outcomes;
- catalog miss/wrong-match reports are tracked;
- recommendations can reference real products where appropriate;
- OBF contribution-back obligations are handled or not promised.

## B-CATALOG-SOURCE-REVIEW - Catalog source, attribution, and API identity

Status: `launch-blocked`

Exit criteria:

- final app name, version, support email, domain, and attribution URL exist;
- `npm run phase4:check-source-env:strict` passes;
- CosIng source memo is reviewed;
- Open Beauty Facts source memo is reviewed;
- source attribution copy is approved under final brand.

## B-ODBL-REVIEW - Open Beauty Facts / ODbL posture

Status: `launch-blocked`

Exit criteria:

- counsel signs the ODbL/database-contents/image-license posture;
- any public derivative database/share-alike obligations have an owner;
- product images remain disabled unless image-rights handling is approved;
- bulk imports use exports, not API crawling;
- attribution is visible in product detail and policy/source pages.

## B-CURATED-CATALOG - First reviewed launch batch

Status: `launch-blocked`

Exit criteria:

- first curated batch is built from approved sources and beta shelves;
- product rows have source/ref/snapshot/provenance;
- recommendable rows are `verified` or `usable`, reviewed, and correction-free;
- sunscreen/OTC-adjacent products have separate review and expiry handling;
- import QA has zero blockers.

## B-CATALOG-COVERAGE - Beta catalog usefulness

Status: `launch-blocked`

Exit criteria:

- closed beta captures barcode/search/OCR/manual add paths;
- match rate, miss rate, wrong-match rate, parser unknown-token rate, and support
  tickets are reviewed;
- priority gaps are fed back into curation;
- users can complete the shelf-to-routine loop even when catalog matching fails.

## B-SHELF-CONTRIB - Unmatched product contribution-back

Status: `launch-blocked`

Exit criteria:

- unmatched product workflow is legally and operationally defined;
- user-facing copy does not promise contribution unless the pipeline exists;
- OBF obligations are satisfied if using OBF-derived data.

## B-CAMERA - Native camera, barcode, OCR, and guided photos

Status: `simulated`

Guided photo UI and quality logic exist over mock signals. Barcode/OCR/native
capture are not production-real.

Exit criteria:

- custom dev build exists;
- camera permission, barcode, OCR, and progress photo capture work on real iOS
  and Android devices;
- pose/alignment/luminance/white-balance checks drive real auto-capture;
- photo files are encrypted/local by default;
- no faceprint/template is stored;
- optional cloud backup is behind explicit consent if included.

## B-NOTIF-VERIFY - Physical notification verification

Status: `needs-device-verification`

Scheduling code exists, but physical-device behavior is not verified.

Exit criteria:

- iOS latest and older supported version pass;
- Android latest and Android 14+ alarm behavior pass;
- timezone changes, quiet hours, reinstall, and lock-screen privacy pass;
- notification config plugin assets are included in native build.

## B-WIDGETS - Native widgets and live activities

Status: `inert`

In-app previews exist. Native WidgetKit, Android widgets, and live activities are
not V1-critical.

Exit criteria:

- either remove from launch claims, or implement and verify on devices.

## B-ROUTINE-PERSIST - Server routine/cycle persistence

Status: `stubbed`

Local-first routine generation exists. Server authority and multi-device sync are
not V1-critical unless the product claims cross-device persistence.

Current implementation note:

- V1 routine, cycle, ramp, and completion surfaces are intentionally
  local-first. Active launch copy must keep that posture and must not promise
  cross-device routine sync until Supabase routine authority is implemented and
  tested.

Exit criteria:

- either V1 copy clearly states local-first behavior, or server persistence is
  implemented and tested.

## B-DRAG-DND - Full routine drag/drop

Status: `inert`

Full drag/drop is not a V1 launch claim. The routine reorder route now uses
tap-to-select plus `Earlier` / `Later` controls over the generated plan, with
the docs/03 non-blocking sequencing nudge. It no longer needs a drag gesture to
be honest or usable.

Current implementation note:

- Keep public, paywall, store, and in-app copy from promising full
  drag-and-drop routine editing.
- If true drag gestures become a future claim, reopen this blocker for native
  gesture implementation, accessibility review, and device QA.

Exit criteria:

- V1: keep the tap-based reorder surface and no drag/drop public claim.
- Future true drag/drop: implement, test, and device-verify before marketing it.

## B-COMMERCE-RAIL - ShopMy or alternative commerce rail

Status: `inert`

Commerce can be a supplement, not the V1 proof. It must not influence rankings.

Exit criteria if commerce launches:

- rail selected and working;
- data-sharing consent finalized;
- FTC "paid link" style disclosure reviewed;
- attribution/order-report pipeline works;
- ranking remains independent from commission.

Exit criteria if commerce is post-launch:

- commerce surfaces remain hidden or clearly preview-only;
- revenue claims are removed from launch materials.

## B-COMMUNITY-MOD - Human moderation and store floor

Status: `launch-blocked`

Peer posting must not launch without moderation operations.

Exit criteria:

- report, block, contact, EULA, content filter, human pre-moderation, and
  response SLA are staffed and tested;
- Apple/Google UGC requirements are satisfied;
- health/medical claim moderation is reviewed.

## B-EXPERT-NETWORK - Reviewed expert content

Status: `launch-blocked`

Exit criteria:

- paid expert network recruited;
- expert notes and stacks reviewed;
- reviewer metadata recorded;
- stale or unreviewed content is gated out.

## B-AI-ONDEVICE - Real trend analysis engine

Status: `launch-blocked`

The safe current posture is no score, no age, no disease, no percentage
improvement. Do not market trend analysis as AI skin scoring.

Exit criteria:

- real on-device CV exists;
- MDC calibration and fairness validation pass;
- FDA/FTC/EU/app-store counsel review is complete;
- copy remains descriptive and no-score.

## B-AI-ASSISTANT - Cloud Ask vendor, safety, and legal gates

Status: `launch-blocked`

The deterministic local advisor can remain bounded. Cloud-grounded Ask must not
launch until vendor, RAG, safety, abuse/cost, and legal gates clear.

Exit criteria:

- zero-retention/no-training vendor contract;
- grounded RAG source corpus;
- layered safety guard;
- red-team eval thresholds;
- server-side cost caps;
- legal/privacy consent review;
- medical escalation behavior verified.

## B-GROWTH-LINK - Share-card domain and attribution

Status: `needs-device-verification`

The Shelf Conflict Card is a strong organic loop, but final brand/domain and
app/web fallback are blocked by `B-BRAND`.

Exit criteria:

- final domain and universal/app links work;
- non-users reach a useful web fallback and store path;
- UTM/channel attribution works;
- card export works in a native build;
- card copy remains claim-safe.

## B-CLOSED-BETA - Real demand proof

Status: `launch-blocked`

The seven-figure thesis is conditional until real users prove the V1 loop.

Exit criteria:

- 50-100 real users complete beta;
- onboarding completion, product add rate, first useful insight, routine
  generation, Today check-off, baseline photo, reminders, trial starts,
  trial-to-paid, cancel/refund reasons, catalog miss rate, and support tickets
  are measured;
- no launch-blocking privacy, clinical, legal, payment, catalog, or trust issue
  remains.

## B-NATIVE-DEVICE-QA - Physical iOS/Android verification

Status: `needs-device-verification`

Phase 5 native code exists in repo, but no public or paid beta claim can rely on
it until installable iOS and Android builds pass the physical-device matrix.

Exit criteria:

- EAS development and staging iOS/Android builds have recorded build IDs;
- at least one physical iPhone and one physical Android device install and run
  the app;
- barcode, label capture, progress photo, encrypted save/restart/delete,
  notifications, share sheet, RevenueCat native smoke, Sentry native smoke, and
  Supabase catalog calls pass;
- generated `docs/phase-5/generated/device-qa-packet.md` has no blockers and
  is signed by a named tester.

## B-NATIVE-OCR - On-device text recognition

Status: `launch-blocked`

The current label path captures a real image and requires editable user text.
It does not claim native OCR while `EXPO_PUBLIC_NATIVE_OCR_ENABLED=false`.

Exit criteria:

- reviewed ML Kit or Apple Vision text-recognition module is selected;
- iOS and Android native builds include the module without missing-native-module
  errors;
- clear, curved, tiny, multilingual, and glare-heavy INCI labels pass beta QA;
- low-confidence words and user corrections remain visible;
- launch copy is updated only after device QA passes.

## B-FACE-POSE-SIGNALS - Reviewed guided-photo signal detector

Status: `needs-device-verification`

Progress photo capture uses real front-camera stills and encrypted storage, but
the current guidance signal is a coarse preview estimate. Do not market precise
face/pose/framing detection until a reviewed detector passes privacy and device
QA.

Exit criteria:

- selected detector processes transient face bbox/pose/lighting only;
- no faceprint, embedding, identity vector, tracking ID, or raw frame stream is
  persisted;
- device matrix confirms no route crashes or repeatable false-ready behavior;
- legal/privacy review approves any persisted coarse quality metadata.

## Practical V1 Rule

Build and launch only the V1 loop in `docs/v1-scope-freeze.md` until beta data
shows it works. Defer commerce, peer community, cloud Ask, widgets, advanced
trend analysis, and referral mechanics unless they directly clear a V1 launch
gate.
