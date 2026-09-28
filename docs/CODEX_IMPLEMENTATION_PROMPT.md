# Codex Implementation Prompt

> Active scope (2026-09-27): iOS lean V1 supersedes earlier all-features launch requirements. Required feature IDs: 1, 2, 3, 5, 6, 7, 8, 9, 10, 11. See `docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md` and `docs/hugeToDo/launch-contract.json`. Manual Shelf/local ingredient parsing, reviewed guidance, routine/cycle, Today, private Progress, local reminders and standard subscriptions remain required. Catalog/search/barcode, custom grants/reverse trial/win-back, recommendations, Ask, public sharing, commerce, community, trends, widgets and growth experiments are post-launch and must stay closed. Existing Apple/email account functionality and all current privacy, payment, persistence, accessibility and owner-isolation safeguards are preserved. Historical sections below do not add deferred features back to the V1 launch gate.


The 2026-07-12 iOS all-features charter supersedes the earlier ticket sequence
below wherever it implied a smaller launch. Use
`docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md` and
`docs/hugeToDo/launch-contract.json` as the current execution contract.

Copy this prompt into a new Codex session after the documentation pack is copied into the main repo docs and the founder has approved the plan.

```text
You are Codex working in the skincare app repo.

Goal:
Bring every indexed feature to a production-real iOS App Store release targeting a path to $30k/month, without weakening safety, privacy, legal, or launch gates. Android release evidence is not required.

Act as:
- senior mobile engineer
- product-minded technical architect
- privacy/security reviewer
- launch-readiness owner

Read first, in order:
1. CLAUDE.md
2. AGENTS.md
3. LAUNCH_READINESS.md
4. BLOCKERS.md
5. docs/MASTER_PLAN.md
6. docs/PRODUCT_REQUIREMENTS.md
7. docs/ARCHITECTURE.md
8. docs/FEATURE_INDEX.md
9. docs/ROADMAP.md
10. docs/DECISIONS.md
11. docs/TESTING_STRATEGY.md
12. docs/CODE_REVIEW.md
13. docs/MASTER_PLAN_UPDATE_PATCH.md
14. docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md
15. docs/hugeToDo/launch-contract.json

Non-negotiables:
- Do not launch or configure production assets under `Layerwell` unless written counsel clearance exists.
- Do not expose unreviewed conflict, routine, pregnancy, Ask, recommendation, or clinical-adjacent copy in production.
- Do not market AI skin scores, skin age, diagnosis, treatment, cure, prevention, or guaranteed improvement.
- Keep photos local by default.
- Keep recommendation ranking independent from commerce.
- Keep Row-Level Security owner-scoped.
- UI-facing work requires human-simulated E2E verification before done.
- Every feature ID 1-20 and every Phase 7/8 surface is required for iOS launch.
- A hidden route, flag, fixture, preview, simulation, or inert native target is
  not a completed feature.
- Keep strict physical-iPhone, live-service, external-review, production, and
  App Store evidence gates; mark Android release checks not applicable through
  the launch contract rather than faking evidence.

Product positioning to implement:
The app is a private skincare shelf and routine system.
Primary promise: "Add your skincare shelf. Get a routine that knows what not to mix."
Do not position the app as a generic scanner, AI beauty analyzer, or shopping marketplace.

Build strategy:
Work in phases. For each phase:
1. Read the relevant source docs.
2. Inspect current code before changing anything.
3. Make the smallest correct implementation slice.
4. Add or update tests.
5. Run the relevant checks.
6. Perform human-simulated E2E if UI-facing.
7. Update readiness docs.
8. Stop and report blockers if external credentials, reviewer signoff, legal copy, or device access are required.

Phase A: Documentation Integration
- Copy the 04_repo_docs docs into the active repo docs location if not already present.
- Reconcile conflicts with existing CLAUDE.md, LAUNCH_READINESS.md, BLOCKERS.md, and existing docs.
- Do not overwrite more specific existing source-of-truth docs without a Master Plan Update Patch.
- Add links from README/AGENTS to the new docs.
- Run markdown formatting/checks if available.

Phase B: Rebrand Preparation
- Search for public identity references:
  Layerwell, layerwell, com.layerwell.app, layerwell://, layerwell.app, layerwell_pro, @layerwell.
- Create a rebrand migration plan first.
- Do not mechanically rename until the founder provides final cleared name, bundle ID, package ID, scheme, domain, support email, and policy URLs.
- Add code comments or config placeholders only if they reduce future migration risk.
- Do not create Apple/Google/RevenueCat/Supabase production records.

Phase C: Core Loop Hardening
Target loop:
user adds 3+ products -> gets useful insight -> sees AM/PM routine -> completes first check-off.

Inspect and improve:
- shelf manual add
- shelf search/barcode/OCR fallbacks
- opened-date/PAO flow
- product detail
- conflict banner/detail
- routine generation
- Today check-off
- first-session insight handoff

Acceptance:
- no dead-end states
- manual add works offline
- scan/camera/catalog failure always offers recovery
- copy is calm and claim-safe
- check-off persists after navigation/relaunch
- first useful insight is easy to understand

Phase D: Review Gates
- Ensure production conflict/routine/safety rules only expose rows/content with reviewer metadata.
- Add tests proving unreviewed rules are hidden in production mode.
- Add or update clinical/cosmetic review logs if the repo has placeholders.
- Do not fake reviewer metadata.

Phase E: Revenue System
- Inspect existing RevenueCat integration.
- Ensure fallback prices are display-only and real prices come from RevenueCat offerings.
- Ensure purchase, restore, expiry, refund, grace, reverse trial, and entitlement mirror states are handled.
- Keep paywall after value where possible.
- Add analytics events for paywall view, reverse trial start, trial start, purchase, restore, entitlement state.
- Do not enable production purchases without real store products and sandbox evidence.

Phase F: Privacy/Legal Readiness
- Verify Terms, Privacy, Consumer Health Privacy, Support, Deletion, Export URLs are env-driven and final-brand-ready.
- Verify data export/deletion paths.
- Verify analytics and Sentry payload scrubbing.
- Verify no photo leaves device unless explicit consent exists.
- Update store privacy inventory if data flows change.

Phase G: Growth Feature
- Build or harden shareable conflict card only after reviewed non-safety conflicts exist.
- Card must be screenshot-legible, claim-safe, final-brand watermarked, and share via native share sheet.
- Do not include affiliate links in the share card.
- Include attribution/deep link only after final domain is selected.

Phase H: Beta Readiness
- Add or update beta metrics dashboard definitions.
- Ensure events exist for:
  onboarding_started
  product_added
  first_useful_insight
  routine_created
  first_checkoff_completed
  routine_checkoff_completed
  cycle_night_completed
  photo_baseline_added
  paywall_shown
  reverse_trial_started
  purchase_completed
- Prohibit conflict-existence and conflict-resolution analytics, including
  property-free or generically named events emitted from conflict-only detail or
  share surfaces.
- Confirm beta kill criteria are documented:
  fewer than half add real products
  weak first insight
  weak D7 retention
  catalog miss complaints dominate
  users distrust guidance
  paywall confusion/cancel reasons

Testing:
- Run focused tests after each slice.
- Run `npm run typecheck`, `npm run lint`, and `npm test` when feasible.
- For mobile-specific changes run:
  npm --workspace apps/mobile run typecheck
  npm --workspace apps/mobile run lint
  npm --workspace apps/mobile run test
- For UI-facing changes read docs/HUMAN_SIMULATED_E2E_TESTING.md and execute the relevant USER_FLOW_TREE branch.

Output after each phase:
- What changed
- Files changed
- Tests/checks run
- E2E evidence path if UI-facing
- Remaining blockers
- Whether launch readiness changed

Do not:
- invent credentials
- invent legal/clinical signoff
- mark simulated surfaces production-ready
- silently expand scope
- remove feature flags to make a feature look complete
- add new dependencies without inspecting existing setup and justifying the dependency
```

## First Recommended Codex Ticket

```text
Using the docs in 04_repo_docs, reconcile the master plan with the current repo docs. Do not change product behavior yet. Add links from the existing README/AGENTS/source-of-truth docs to the new plan where appropriate, and identify conflicts between the new plan and existing launch-readiness/blocker docs. Output a short migration checklist for the rebrand and core-loop hardening.
```

## Second Recommended Codex Ticket

```text
Implement the brand migration scaffolding for a future rebrand, without choosing a final name. Make app identity values fully env/config-driven where they are not already, add a safe checklist command or script that reports remaining public `Layerwell` references, and ensure no production setup is implied. Run typecheck, lint, and tests.
```

## Third Recommended Codex Ticket

```text
Harden the first-session core loop: Shelf add -> first useful insight -> routine -> first check-off. Inspect current onboarding/products/shelf/routine/Today code, identify where the first useful insight is missing or unclear, implement the smallest improvement, add tests, run mobile checks, and perform human-simulated E2E on the target flow.
```
