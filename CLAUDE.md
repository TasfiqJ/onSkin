# OnSkin - Skincare Routine App

## What This Is

Cross-platform iOS and Android skincare routine app built with Expo,
Supabase, and local-first product logic. The business target is a paid
subscription app with optional post-launch commerce, but the current project is
not production-ready until the launch gates in `BLOCKERS.md` and
`LAUNCH_READINESS.md` are cleared.

## Source-Of-Truth Docs

Read the relevant source doc before changing a feature. These files are
authoritative for product behavior, schema, privacy posture, and launch scope:

- `docs/MASTER_PLAN.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_INDEX.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/TESTING_STRATEGY.md`
- `docs/CODE_REVIEW.md`
- `docs/CODEX_IMPLEMENTATION_PROMPT.md`
- `docs/DEVICE_SUPPORT_POLICY.md`
- `docs/UPDATE_DELIVERY_POLICY.md`
- `docs/MASTER_PLAN_UPDATE_PATCH.md`
- `docs/rebrand-and-core-loop-migration-checklist.md`
- `docs/FOR_TAS_TO_DO.md`
- `docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md`
- `docs/hugeToDo/2026-07-12-ios-all-features-master-plan-update.md`
- `docs/hugeToDo/launch-contract.json`
- `docs/00-architecture.md`
- `docs/01-auth-onboarding.md`
- `docs/02-ingredient-intelligence.md`
- `docs/03-routine-builder.md`
- `docs/04-smart-shelf.md`
- `docs/05-actives-scheduler.md`
- `docs/06-photo-progress.md`
- `docs/07-reminders-streaks-widgets.md`
- `docs/08-subscriptions-paywall.md`
- `docs/09-personalized-recommendations.md`
- `docs/10-creator-stacks-build-spec.md`
- `docs/11-community-layer.md`
- `docs/12-ai-trend-analysis.md`
- `docs/13-ask-onskin-assistant.md`
- `docs/14-growth-to-seven-figures.md`
- `docs/legal-readiness.md`
- `LAUNCH_READINESS.md`
- `docs/v1-scope-freeze.md`
- `docs/brand-decision-memo.md`
- `docs/brand-evidence.md`
- `docs/seven-figure-readiness.md`
- `docs/phase-2-readiness-checklist.md`
- `docs/phase-2-production-infrastructure-runbook.md`
- `docs/phase-2-status.md`
- `docs/store-privacy-inventory.md`
- `docs/phase-3/regulatory-positioning-memo.md`
- `docs/phase-3/legal-regulatory-review-log.md`
- `docs/phase-3/clinical-review-log.md`
- `docs/phase-3/cosmetic-chemistry-review-log.md`
- `docs/phase-3/privacy-security-review-log.md`
- `docs/phase-3/ip-fto-review-log.md`
- `docs/phase-3/review-packet-index.md`
- `docs/phase-3/review-signoff.schema.json`
- `docs/phase-3/review-signoff.template.json`
- `docs/phase-3/signoffs/README.md`
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
- `docs/phase-4/phase-4-exit-review.md`

The previous `docs/design-spec.pdf` reference is obsolete. The design handoff
source in this workspace is the local `dx*` handoff folders and their `.dc.html`
files. Do not claim a PDF design spec exists unless it is restored to `docs/`.

## Hard Rules

- Do not call a surface production-ready because a screen exists. Use the
  readiness statuses in `LAUNCH_READINESS.md`: `implemented`, `stubbed`,
  `simulated`, `inert`, `needs-device-verification`, or `launch-blocked`.
- If the source docs do not specify behavior, schema, privacy copy, or medical
  guidance, stop and record the gap in `BLOCKERS.md`.
- Never weaken Row-Level Security. Every user table remains owner-scoped.
- Privacy is a product rule: photos are local-only by default, health-data
  consent is unbundled, and analytics/sharing require explicit authorization.
- Keep commerce independent from recommendations. Commission data must never
  influence ranking or client-readable recommendation logic.
- Treat catalog fixture imports as test data only. Product-specific
  recommendations require source-approved, reviewed, correction-free products
  with `verified` or `usable` quality.
- Do not promise Open Beauty Facts contribution-back or display source images
  until ODbL/source/image-rights review and the queue operation are approved.
- Do not market AI skin scores, skin age, disease diagnosis, percentage
  improvement, or unreviewed clinical recommendations.

## Commands

Repository-level commands:

```bash
npm run typecheck
npm run lint
npm test
npm run phase2:check-env
npm run phase2:rls-smoke
npm run phase3:audit-copy
npm run phase3:review-packet
npm run phase3:review-signoff-template -- --list
npm run phase4:check-source-env
npm run phase4:import-obf-fixture
npm run phase4:qa-report
```

Mobile workspace commands:

```bash
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test
```

Useful development commands:

```bash
npm --workspace apps/mobile run start
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run android
npm --workspace apps/mobile run web
```

## Workflow

- Read the relevant docs and blockers before changing code.
- Keep implementation tightly scoped to the requested feature or launch gate.
- After each slice, run typecheck, lint, and tests when feasible, then update
  `PROGRESS.md` and any affected readiness docs.
- Do not configure Apple, Google, Supabase, RevenueCat, Sentry, PostHog, or
  domains under the `OnSkin` identity until `docs/brand-decision-memo.md` is
  resolved by counsel/founder decision.
