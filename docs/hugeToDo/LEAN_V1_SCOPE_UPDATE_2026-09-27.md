# Lean iOS V1 Scope Update — 2026-09-27

Status: Accepted founder scope correction for the next public iOS release.

This update supersedes the 2026-07-12 requirement to ship every indexed feature in one release. The repository keeps deferred source for future use, but deferred code, routes, fixtures, feature flags, vendor integrations, and historical evidence are **not launch requirements** and must remain unavailable to ordinary V1 users.

## Why the scope changed

The prior all-features charter turned one consumer V1 into a 202-item program that required, among other things, a production catalog campaign, an AI provider, affiliate commerce, staffed community moderation, public sharing, creator/paid attribution, trend calibration, widgets/Live Activities, multiple vendor accounts, and a 50–100-user beta before the core product could ship.

That is not necessary to validate the product's differentiated promise. The V1 product is the private shelf → reviewed guidance → routine → Today → private progress loop.

The scope cut does **not** weaken privacy, RLS, claims safety, data rights, payment integrity, physical-device QA, App Store requirements, or professional review of the guidance that remains in V1.

## Required V1 product features

The release requires these indexed features only:

1. `F-01` — final brand/public identity.
2. `F-02` — onboarding, age gate, health-data consent, privacy/data-rights foundation.
3. `F-03` — Shelf intake through manual entry and local label OCR. Barcode/search/catalog-backed intake is deferred.
4. `F-05` — reviewed conflict guidance for the exact admitted corpus.
5. `F-06` — routine builder using products the user already owns.
6. `F-07` — Today check-off and adherence.
7. `F-08` — reviewed cadence/cycle scheduler and recovery behavior.
8. `F-09` — private local photo progress: capture, timeline, compare, notes, deletion. No trend scoring or cloud photo analysis.
9. `F-10` — local routine reminders. Remote push is not a V1 dependency.
10. `F-11` — honest App Store subscription/paywall/restore using StoreKit + RevenueCat. No custom reverse trial or win-back offer.

## Deferred until after public V1

These are intentionally not public-launch blockers:

- `F-04` production catalog import/curation and runtime catalog search/barcode matching.
- `F-12` reverse trial and custom no-card Pro grants.
- `F-13` product recommendations beyond the user's owned-product routine.
- `F-14` cloud Ask / model-provider path.
- `F-15` public/shareable conflict cards and public links.
- `F-16` affiliate commerce, retailer links, creator links, order attribution, replenishment commerce.
- `F-17` community posting, public aggregates, and human moderation operations.
- `F-18` photo trend/change engine, calibration, fairness result issuer.
- `F-19` widgets and Live Activities.
- `F-20` production operator/admin product as a user-visible launch feature. Minimum release/security scripts remain required, but a full operator product is not.
- Phase 7/8 growth surfaces: Cloud Ask, commerce, community posting/aggregates, trend insights, widgets, Live Activities, share cards, reviewed conflict publication, goal-active recommendations, public share links, review prompts, creator links, and paid measurement.

Deferred routes may remain in source for future work, but release navigation must not link to them and their admission flags must stay literal false. Direct-entry routes must fail closed or return to a supported V1 surface.

## Authentication integration decision

Preserve current guest-first onboarding, Apple/email account upgrade, session isolation, data export, withdrawal, deletion and subscription restore/manage. The handoff List 1 retains Apple/email; its conflicting anonymous-only payload is superseded by the authoritative current repository. Google entry is deferred. Production SMTP and Apple account configuration remain genuine external dependencies when enabled.

## Shelf and catalog simplification

V1 does not require a production product database. The supported floor is:

- add a product manually;
- optionally capture/recognize the ingredient label locally with native OCR;
- record category, ingredients, opened date, PAO/expiry only when supported by the package/user input;
- use only reviewed/admitted conflict/routine rules;
- leave unknown values unknown.

Barcode lookup, remote search, catalog promotion, 2,000-record curation campaigns, external source-rights release processes, and catalog operator tooling move to post-launch.

## Progress simplification

V1 Progress is a private visual diary. It may compare the user's own photos, but it must not output an AI skin score, skin age, percentage improvement, diagnosis, or unreviewed trend claim. Trend consent and trend result issuance remain disabled.

## Reminder simplification

V1 uses local notifications scheduled on-device. APNs remote-push infrastructure is not required for public launch. The app must still handle notification permission, quiet-hour/timing preferences, rescheduling, sign-out/owner boundaries, and local cleanup safely.

## Subscription simplification

V1 supports only the normal monthly/annual App Store products and any Apple-managed introductory offer that actually exists in App Store Connect. The custom reverse-trial grant and iOS win-back experiments remain disabled. Pricing must come from StoreKit/RevenueCat, restore must work, and free-plan behavior must stay honest.

## External evidence that still cannot be replaced by code

The following remain real launch gates because they require a human identity, authority, device, payment, professional judgment, or external decision:

- Apple Developer/App Store Connect enrollment, seller/legal/tax/banking agreements, MFA and payment.
- Final brand/trademark clearance and founder approval of the exact public identity.
- Qualified review of the exact V1 privacy/regulatory/clinical/cosmetic/IP/export facts as applicable.
- Production account approval/payment for the minimum selected services: Expo/EAS, Supabase, RevenueCat, final domain/DNS/hosting.
- Physical-iPhone evidence for camera/OCR, photo protection, notifications, accessibility, StoreKit purchase/restore, signed entitlements and actual release build behavior.
- Final pricing/country/budget/business-risk decisions.
- Apple/vendor approval outcomes.
- Explicit founder authorization to submit to App Review and later make the approved build public.

## Beta rule

A 50–100-person beta is no longer a hard public-launch prerequisite. Internal TestFlight and a small genuine usability/device cohort are strongly preferred, but the launch gate is evidence quality and absence of unresolved P0/P1 issues—not an arbitrary tester count or retention horizon that delays first-market learning.

## Safety constraints retained unchanged

- No diagnosis/treatment/cure/prevention claims.
- No AI skin scores, skin age, or percentage-improvement claims.
- No commission-influenced recommendation ranking.
- No unconsented cloud photo analysis.
- No public before/after gallery.
- No weakening owner-scoped RLS.
- Photos remain local-only by default.
- Health-data consent remains unbundled and revocable.
- Unreviewed guidance remains fail-closed.

## Superseded execution artifacts

The following remain historical evidence but are no longer active scope instructions:

- `docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md`
- `docs/hugeToDo/2026-07-12-ios-all-features-master-plan-update.md`
- the former 202-node all-features task graph/status generated from that plan

The active execution plan is `docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md` and the machine-readable contract is `docs/hugeToDo/launch-contract.json`.
