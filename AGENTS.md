# OnSkin Agent Instructions

This repo is an Expo React Native skincare app. Read `CLAUDE.md` before changing behavior, then read the source-of-truth docs for the feature area being touched. Keep changes scoped to the requested feature or launch gate.

## Strategy And Launch Docs

The `04_repo_docs` strategy packet has been integrated into the active `docs/` tree. Before work that affects product scope, launch positioning, pricing, architecture, growth, or readiness, read:

- `docs/MASTER_PLAN.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/FEATURE_INDEX.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/TESTING_STRATEGY.md`
- `docs/CODE_REVIEW.md`
- `docs/MASTER_PLAN_UPDATE_PATCH.md`
- `docs/rebrand-and-core-loop-migration-checklist.md`
- `docs/FOR_TAS_TO_DO.md`

## Commands

Repository-level checks:

```bash
npm run typecheck
npm run lint
npm test
```

Mobile workspace checks:

```bash
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test
```

Useful app start commands:

```bash
npm --workspace apps/mobile run start
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run android
npm --workspace apps/mobile run web
```

## Human-Simulated E2E Testing

Codex must use human-simulated E2E verification before marking UI-facing work done. Unit and integration tests are required where relevant, but they are not enough to prove a real user can complete the flow.

For UI-facing work:

1. Read `docs/HUMAN_SIMULATED_E2E_TESTING.md`.
2. Check `docs/USER_FLOW_TREE.md` for the target feature. If the branch is missing, update the tree before testing.
3. Start or open the actual app surface. For OnSkin this is usually Expo iOS Simulator, Android emulator/device, or Expo web when the flow is web-compatible.
4. Confirm the expected starting screen is visible before interacting.
5. Drive the app like a user: tap, click, type, scroll, navigate back/forward, refresh/relaunch where relevant, and exercise critical error or empty-state branches.
6. Capture evidence such as screenshots, videos, Playwright traces, simulator logs, console logs, UI snapshots, or terminal transcripts.
7. If a bug is found, record it with `docs/E2E_BUG_REPORT_TEMPLATE.md`, make the smallest correct fix, and re-run the same surface flow.
8. Use `docs/E2E_TESTING_CHECKLIST.md` as the acceptance gate before saying UI work is complete.

Do not install new E2E dependencies unless the repo's package manager and test setup have been inspected and the change is explicitly part of the task. Do not invent unavailable credentials, devices, or services. Mark unknowns as Open Questions.
