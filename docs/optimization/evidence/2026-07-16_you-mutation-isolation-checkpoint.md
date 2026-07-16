# You Mutation-Isolation Checkpoint

Date: 2026-07-16 (America/Toronto)
Plan item: OPT-115
Status: Investigating

## Outcome

The You route is now a thin render-counted shell around a memoized layout owner. Account, entitlement, static routine/For You content, Commerce, Security, Privacy, Policies, and Data each have explicit memoized ownership. App-lock pending/feedback stays in Security, policy pending/feedback stays in Policies, and neither mutation can rerender the route, account, subscription, or static overview owners.

Consent state is centralized below the layout owner in a host-node-free coordinator with exactly the general-consent and resolved-commerce observers. Its synchronous request ref serializes both data-sharing surfaces, its account-generation scope fences cache and feedback publication, and all consent switches share one disabled boundary while a choice is active. Fast consent, app-lock, policy, and export settlements retain their ref/state claim through the next animation frame, so one browser double-click cannot enter twice between asynchronous settlement and the pending-state paint.

Export, withdrawal, and deletion share one pure state machine: idle, exact destructive confirmation, and operation-ID-bound running state. The coordinator claims that state synchronously before counters, React state, lazy imports, or external actions. Lazy action imports recheck the captured owner scope before invoking export/deletion/withdrawal. Matching destructive confirmation remains visibly mounted as disabled `Working...` UI while execution is pending, and delayed confirmation-scroll work is cancelled on dismissal, running transition, replacement, and unmount.

Development diagnostics are content-free numeric render/action counters published on the You scroll owner. Production builds retain no diagnostic payload. The existing development-only export delay now fences the operation before local collection, making early failure paths deterministic without changing production behavior.

## Focused Validation

```text
npm --workspace apps/mobile exec vitest run -- src/features/settings/settingsRoutes.test.ts src/features/settings/applyPrivacyChoice.test.ts src/features/settings/actions.test.ts src/lib/applock/authenticate.test.ts src/lib/query/queryKeys.test.ts src/lib/navigation/externalOpen.test.ts src/features/photos/qualityProvenance.test.ts src/features/settings/youDataRightsState.test.ts src/features/settings/youRenderDiagnostics.test.ts
PASS: 9 files / 118 tests

npm --workspace apps/mobile run typecheck
PASS

scoped ESLint from apps/mobile
PASS: zero warnings
```

```text
npm run typecheck
PASS: 2 workspaces

npm run lint
PASS: 2 workspaces, zero warnings

npm test
PASS: 316 files / 3,892 tests
```

The source contracts assert synchronous guard/ref/counter/await ordering for consent, app lock, policy, export, and destructive actions; no static settings-action import; owner rechecks after lazy imports; matching-operation settlement; duplicate confirmation/export exclusion; visibly mounted destructive pending UI; and end-to-end privacy-layout callback wiring.

## Human-Simulated E2E

- Surface: Expo web development build, Codex in-app browser
- Route: `/you?section=privacy`
- Primary viewport: requested 390 x 844, observed 390 x 845
- Compact viewport: requested 375 x 667, observed 376 x 668
- Tall viewport: requested and observed 430 x 932
- Evidence: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/`
- Run report: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/report.md`

### Ownership and single-flight matrix

| Measured gesture | Starts | Allowed render deltas | Protected render deltas |
| --- | ---: | --- | --- |
| Consent double-click | +1 | Consent coordinator +4; Commerce +3; Privacy +3 | Route, layout shell, Account, Subscription, static overview, and unrelated sections 0 |
| App-lock double-click | +1 | Security +3 | Every other owner 0 |
| Stable Terms double-click | +1 | Policies +3 | Every other owner 0 |
| Delayed export double-click | +1 | Pending coordinator/Privacy/Data +1 each; settled +3 each | Route, layout shell, Account, Subscription, static overview, Commerce, Security, Policies 0 |
| Withdrawal prompt double-click + Cancel | Destructive +0 | Open coordinator/Privacy/Data +1 each; cancelled +2 each | Every other owner 0 |
| Delete prompt double-click + Cancel | Destructive +0 | Open coordinator/Privacy/Data +1 each; cancelled +2 each | Every other owner 0 |

The delayed export showed disabled `Preparing...` and Delete controls for the configured 2.5-second boundary, then rendered one sanitized inline failure because native/local export support is unavailable on this web fixture. App lock and policy failures also remained inline. No JavaScript dialog appeared.

### Layout and browser health

- Horizontal overflow was 0 px at all three supported-phone viewports.
- At the compact viewport, destructive Delete and Cancel controls were each about 56 px high and fully visible; the destructive confirm control was never activated.
- At the tall viewport, direct entry placed the Privacy heading at about y=35.9 px and retained Security → Privacy → Policies → Data source order.
- Console error count was zero. Six warnings across two reloads matched only the known placeholder-Supabase and Expo-notifications-on-web signatures.

## E2E-Found Bugs And Fixes

The initial consent double-click produced two starts because a fast local completion reopened the ref guard before the gesture ended. Keeping the claim through the next animation frame reduced the repeated gesture to exactly one start and one synchronized choice. See `docs/e2e-bug-reports/2026-07-16-you-fast-mutation-double-activation.md`.

The initial export run settled before the configured pending window because the existing E2E delay followed local snapshot collection. Moving that development-only delay to the export operation boundary made the early-failure path deterministic. See `docs/e2e-bug-reports/2026-07-16-data-export-delay-skipped-local-failure.md`.

## Claim Boundary

This checkpoint supports scoped development Expo-web state ownership, rapid-gesture serialization, shared consent and data-right exclusion, exact action-start counts, visible pending/confirmation feedback, direct-entry geometry, and sanitized failures. It is not full human-simulated E2E checklist acceptance.

It does not prove production Hermes commit duration, native LocalAuthentication/SecureStore behavior, authenticated consent success, native share sheets, live export/deletion/withdrawal, VoiceOver/TalkBack, physical-device frames/CPU/memory, or backend/store behavior. Destructive execution was deliberately not invoked; its single-flight behavior is source- and pure-state-machine-tested.

OPT-115 remains `investigating`. Ask, catalog, OCR, and You ownership are implemented and web-checked. Progress note ownership still needs persisted-reload/runtime/native evidence; combined analytics transport, native keyboard/accessibility, and production Hermes frame/memory evidence remain open.
