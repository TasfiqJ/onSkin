# Roadmap

> Active scope (2026-09-27): iOS lean V1 supersedes earlier all-features launch requirements. Required feature IDs: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11. See `docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md` and `docs/hugeToDo/launch-contract.json`. Manual Shelf/local ingredient parsing, reviewed guidance, routine/cycle, Today, private Progress, local reminders and standard subscriptions remain required. Catalog/search/barcode, custom grants/reverse trial/win-back, recommendations, Ask, public sharing, commerce, community, trends, widgets and growth experiments are post-launch and must stay closed. Existing Apple/email account functionality and all current privacy, payment, persistence, accessibility and owner-isolation safeguards are preserved. Historical sections below do not add deferred features back to the V1 launch gate.


This roadmap executes the iOS-only, all-features contract. Every feature in
`docs/FEATURE_INDEX.md` is required before public launch; phases describe
dependency order, not permission to defer an indexed feature.

## Phase 0: Brand And Strategy Reset

Goal: remove the biggest avoidable launch risk.

Features:

- name shortlist
- trademark/domain/social research
- brand decision memo
- public identity migration plan

Done criteria:

- final name chosen or counsel-cleared
- bundle/package/scheme/domain decided
- no production account is created under conflicted identity

Risks:

- name decision stalls
- social/domain unavailable

## Phase 1: Trust And Launch Gates

Goal: make core guidance legally and clinically credible.

Features:

- clinical/cosmetic reviewer workflow
- reviewed conflict/routine copy
- final privacy, terms, consumer health privacy, support, deletion/export URLs
- data source license posture

Done criteria:

- reviewed rules have reviewer metadata
- legal/privacy copy finalized
- copy audit passes strict mode

Risks:

- reviewer changes invalidate existing copy
- legal review slows launch

## Phase 2: Core Product Loop

Goal: make shelf -> insight -> routine -> check-off excellent.

Features:

- shelf add friction pass
- manual add polish
- product detail clarity
- first useful insight surface
- AM/PM routine generation
- Today check-off persistence

Done criteria:

- beta user can add 3 products in under 5 minutes
- first useful insight visible
- check-off persists after relaunch
- human-simulated E2E evidence attached

Risks:

- catalog misses make product feel broken
- routine feels generic

## Phase 3: Payments, Analytics, Backend

Goal: make revenue and measurement real.

Features:

- live Supabase staging
- RevenueCat sandbox
- entitlement mirror
- PostHog funnel
- Sentry release health
- reverse trial

Done criteria:

- purchase/restore/refund/expiry matrix passes
- first-insight to paywall funnel tracked
- RLS smoke tests pass

Risks:

- store product setup delayed by brand
- entitlement edge cases

## Phase 4: Closed Beta

Goal: prove the production-real all-features iOS candidate before public scale.

Features:

- beta onboarding
- feedback capture
- catalog miss reporting
- churn interviews
- support workflow
- native OCR and catalog coverage
- photos and trend calibration
- cloud Ask safety and cost
- commerce and creator handoff
- community posting, moderation, and expert workflow
- widgets, Live Activities, notifications, links, and sharing
- admin/operator queues and launch dashboards

Done criteria:

- 50-100 users
- D7/D14 data
- catalog miss/wrong-match report
- willingness-to-pay signal

Risks:

- weak first insight
- low product-add completion
- trust objections

## Phase 5: Public Launch

Goal: controlled store launch with honest claims.

Features:

- ASO page
- store screenshots
- review prompt
- support pages
- release candidate evidence packet

Done criteria:

- App Store metadata reviewed
- privacy labels match behavior
- physical-iPhone QA attached
- launch ring gates passed

Risks:

- store rejection
- support overload
- competitor confusion

## Phase 6: Growth To $30k/Month

Goal: reach 10,000+ active subscribers over time.

Features:

- optimize the launch share-card loop
- creator seeding
- ASO iteration
- content/SEO
- pricing tests
- retention experiments

Done criteria:

- repeatable acquisition channel found
- paid conversion and retention support scaling
- churn reasons are understood

Risks:

- paid UA uneconomic
- creator content does not convert
- retention too weak
