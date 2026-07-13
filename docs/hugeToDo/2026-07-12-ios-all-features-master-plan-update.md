# Master Plan Update Patch: iOS All-Features Launch

Date: 2026-07-12
Author: Founder directive, prepared by Codex
Status: Accepted

## Change Proposed

Replace the smaller cross-platform V1 public-launch scope with one iOS-only
release that includes every current feature in `docs/FEATURE_INDEX.md` and all
currently gated Phase 7 and Phase 8 surfaces. Android source health remains
desirable, but Android credentials, builds, store records, device evidence,
payments, links, performance results, beta evidence, and launch approval are
not requirements for this release.

This patch changes scope, not safety standards. A required feature is not
complete merely because a route, fixture, flag, preview, or simulated response
exists. Each feature must become production-real and satisfy every applicable
live, device, professional-review, production, and store evidence gate.

## Reason / Evidence

- [Confirmed] The founder explicitly directed an iOS-only, all-features launch
  on 2026-07-12 and assigned every safely executable task to Codex.
- [Confirmed] The repository currently contains all 20 indexed features, but
  several advanced surfaces are gated, simulated, inert, or launch-blocked.
- [Confirmed] Existing validators require Android release evidence even though
  Android is not part of the directed release.
- [Confirmed] `docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md` defines
  the ownership, evidence, launch, and completion contract.
- [Assumption] A broader first release increases schedule, review, moderation,
  reliability, and operational cost; the founder has accepted that scope risk.
- [Open Question] Final launch countries, pricing, brand, vendors, paid budgets,
  and professional reviewers still require the recorded human decisions.

## Affected Docs

- `docs/MASTER_PLAN.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_INDEX.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/TESTING_STRATEGY.md`
- `docs/CODEX_IMPLEMENTATION_PROMPT.md`
- `docs/DEVICE_SUPPORT_POLICY.md`
- `docs/v1-scope-freeze.md`
- `LAUNCH_READINESS.md`
- `BLOCKERS.md`
- `docs/FOR_TAS_TO_DO.md`
- Phase 2-11 validators, packet builders, runbooks, and generated evidence.

The mirrored strategy files under `04_repo_docs/docs/` must be updated with
their active `docs/` counterparts so source-packet validation stays exact.

## Affected Features

All features 1-20 in `docs/FEATURE_INDEX.md`, plus commerce, community posting
and aggregates, trend insights, cloud Ask, widgets, Live Activities, share
cards, reviewed-conflict sharing, goal-active recommendations, public links,
review prompts, creator links, and paid measurement.

## Risk

- Product risk: breadth can weaken the core shelf-to-routine explanation.
- Market risk: more scope delays genuine demand validation.
- Technical risk: native targets, live vendors, and networked surfaces expand
  the failure and incident footprint.
- Privacy/legal risk: AI, health-adjacent guidance, UGC, photos, commerce, and
  attribution require distinct consent, policy, review, and operational gates.
- Revenue risk: larger fixed and variable costs may precede product-market fit.
- UX risk: more features can increase onboarding and navigation complexity.

## Recommendation

Accept now, as directed, with dependency-aware delivery and fail-closed launch
gates. Do not replace missing implementation or evidence with hidden features,
fake pass flags, unsupported legal conclusions, or simulated production data.

## Validation Plan

1. Validate `docs/hugeToDo/launch-contract.json` in CI and every Phase 2-11 gate.
2. Inventory every route, flag, native target, store, Edge Function, vendor
   call, operator surface, and generated packet against feature IDs 1-20.
3. Require unit/integration/contract tests plus human-simulated E2E for UI work.
4. Require real staging, physical-iPhone, professional, production, and App
   Store evidence wherever applicable.
5. Run an all-features TestFlight beta and close every P0/P1 before submission.
6. Keep every public/networked high-risk feature behind an incident kill switch
   after it has first passed its complete enabled-state launch gate.

## Implementation Notes

- The launch contract is `docs/hugeToDo/launch-contract.json`.
- Google Sign-In remains in scope as an iPhone authentication feature; Google
  Play release work does not.
- The prohibited-claims, local-photo, consent, commerce-independence, and
  owner-scoped RLS rules remain unchanged.
- Old references to a V1 cutoff, post-launch feature list, Android release
  evidence, or “hide instead of implement” are superseded for this program.
- Human, reviewer, vendor, and Apple-controlled outcomes remain explicit gates;
  Codex owns all preparation, implementation, verification, and follow-through
  around them.
