# Agent Instructions

## Product Summary

This repo is a skincare shelf, routine, and progress app. The winning product is not a generic scanner. It helps users add the products they already own, detects reviewed timing/conflict issues, builds an AM/PM routine, supports daily check-off, and tracks private progress without AI scores or medical claims.

## Docs Codex Must Read First

Before changing behavior, read:

1. `CLAUDE.md`
2. `LAUNCH_READINESS.md`
3. `BLOCKERS.md`
4. `docs/MASTER_PLAN.md`
5. `docs/PRODUCT_REQUIREMENTS.md`
6. The source-of-truth doc for the feature being touched

For UI-facing work also read:

- `docs/HUMAN_SIMULATED_E2E_TESTING.md`
- `docs/USER_FLOW_TREE.md`
- `docs/E2E_TESTING_CHECKLIST.md`

## Repo Structure Rules

- Keep app code in `apps/mobile`.
- Keep shared types in `packages/types`.
- Keep Supabase schema, policies, and functions in `supabase`.
- Keep product and launch decisions in `docs`.
- Do not put large product strategy inside `AGENTS.md`; link docs instead.

## Coding Conventions

- Follow existing Expo React Native, TypeScript, NativeWind, and local helper patterns.
- Prefer deterministic, reviewable logic over black-box AI for safety-relevant guidance.
- Keep changes scoped to the requested feature or launch gate.
- Do not add new dependencies unless existing package setup has been inspected and the dependency is justified.

## Testing Expectations

- Run focused tests for the touched feature.
- Run `npm run typecheck`, `npm run lint`, and `npm test` when feasible.
- For mobile workspace work, run the mobile workspace checks when feasible.
- UI-facing work requires human-simulated E2E evidence before calling the work done.

## Security Rules

- Never weaken Row-Level Security.
- User-owned data must stay owner-scoped.
- Photos stay local by default.
- Health, photo, analytics, commerce, AI, and community consent must remain unbundled where required.
- Do not log health details, raw photo data, product notes, tokens, or private identifiers.

## Dependency Rules

- Use current repo tools unless a decision record justifies a change.
- Do not add E2E, analytics, AI, commerce, or cloud-photo dependencies casually.
- Any vendor that touches health, face/photo, payment, or recommendation data needs a privacy and legal review note.

## Decision Rules

- Label major product claims as `[Confirmed]`, `[Researched]`, `[Assumption]`, `[Decision]`, `[Needs Research]`, or `[Open Question]`.
- If a behavior is not specified, update docs or record the gap before building.
- Use `docs/MASTER_PLAN_UPDATE_PATCH.md` for significant changes to product, architecture, pricing, or launch strategy.

## Definition Of Done

- The feature works in the real app surface.
- Tests are added or updated according to risk.
- UI-facing flows have human-simulated E2E evidence.
- Privacy, copy, and launch-readiness docs are updated when affected.
- No unreviewed clinical, medical, AI, or commerce claims are introduced.

## Codex Must Not Do

- Do not launch or configure production assets under `OnSkin` without written clearance.
- Do not expose unreviewed rules in production.
- Do not market scanner, AI skin score, skin age, diagnosis, treatment, cure, prevention, or guaranteed improvement claims.
- Do not make commerce influence recommendation ranking.
- Do not call simulated, stubbed, or inert features production-ready.
