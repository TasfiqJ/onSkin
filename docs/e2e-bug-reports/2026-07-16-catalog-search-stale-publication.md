# E2E Bug Report: Superseded catalog response could publish under a new draft

Severity: High
Surface: Expo web and native source path
Environment: Development build with deterministic delayed catalog fixture
Feature: Shelf catalog search
Date: 2026-07-16
Tester: Codex

## Reproduction Steps

1. Open `/shelf/search`, submit an eligible catalog query, and keep the request pending.
2. Edit the input to a different query before the response completes.
3. Wait for the original response.

## Expected Result

Editing the submitted draft cancels the obsolete request. Only a request associated with the current controller may publish results, no-match state, feedback reset, or analytics. Browser counters cover UI publication; production-used coordinator tests cover exact-controller acceptance for both success and error paths.

## Actual Result

Before the fix, input edits changed route-owned `query` state but did not abort the active controller. The old response could publish its result cards beneath the visibly newer draft. The pending `searching` state also prevented the replacement query from being submitted until the obsolete request settled.

## Evidence

- Screenshot: Source behavior was identified before the post-fix app pass; the valid post-fix pending-state image is `test-results/human-e2e/2026-07-16/catalog-search-input-isolation-current/04-pending-cancellation.png`. Cancellation completion is proved by the before/after/after-delay counters.
- Video: Not captured.
- Trace: Content-free request lifecycle counters are in `metrics.json` in the same folder.
- Logs: The initial in-session browser summary reported no error entries and only documented placeholder-environment warnings. A fresh post-coordinator regression retained a sanitized console artifact with zero errors and zero unexpected warnings.
- UI snapshot: The post-fix pending state exposes disabled Search, then the edited state re-enables Search without publishing cards.
- Terminal transcript: Focused catalog/query/route tests and final repository gates are recorded in the optimization checkpoint.

## Frequency

- Always when a pending transport completed after the user changed the route-owned query.

## Scope

- Affected route/screen: `/shelf/search`
- Affected account or fixture: Any account; reproduced deterministically with the dev catalog fixture.
- External service involved: The production path uses the catalog Edge Function, but the deterministic reproduction requires none.
- Destructive action involved: None.

## Suspected Cause

The parent route owned keystroke state and an `AbortController`, but input edits only called `setQuery`. Publication checked whether the controller was aborted, not whether it was still the route's current request. The busy-state guard also depended on asynchronously rendered state instead of a synchronous active-request identity.

## Minimal Fix Recommendation

Move the draft into a leaf composer, retain only a synchronous latest-draft ref in the route, abort when a normalized draft supersedes the active query, ignore duplicate active submissions, and require exact current-controller identity before every publication or busy-state clear.

## Verification Flow After Fix

1. Start a deterministic five-second search at 390 x 844.
2. Edit the draft while Search is disabled.
3. Confirm cancellation increments once and publication stays zero immediately and after 5.2 seconds.
4. Issue two rapid Return actions and confirm one request start plus one duplicate suppression.
5. Submit the replacement and confirm one publication with 12 result cards.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-16/catalog-search-input-isolation-current/04-pending-cancellation.png`
- Screenshot limitation: Capture attempts `02-80-character-draft.png`, `05-cancelled-draft.png`, and `06-replacement-12-results.png` contain opaque occlusion, are excluded as standalone visual proof, and are intentionally not committed. Their numeric DOM metrics remain usable.
- Trace: `test-results/human-e2e/2026-07-16/catalog-search-input-isolation-current/metrics.json`
- Post-review trace: `test-results/human-e2e/2026-07-16/catalog-search-input-isolation-current/post-coordinator-regression.json`
- Sanitized console artifact: `test-results/human-e2e/2026-07-16/catalog-search-input-isolation-current/browser-console-post-coordinator.json`
- Focused tests: 5 files / 69 tests passed after the coordinator refactor.
- Root gates: 312 files / 3,873 tests, two-workspace typecheck, and two-workspace zero-warning lint passed.

## Remaining Risk

- Untested branches in this slice: blur/unmount/back/re-entry; no-match/empty/reporting; wrong-match/use-match; the visible Search button; refresh/relaunch; and accessibility/native-keyboard behavior.
- Analytics evidence: No browser analytics-transport artifact was captured; exact-current-request tracking is enforced by production-used coordinator tests plus route wiring contracts.
- Checklist status: This scoped pass is not full human-simulated E2E checklist acceptance.
- Missing fixtures: Production-sized catalog corpus and real controlled-network loss.
- Follow-up needed: Native iOS/Hermes keyboard and request-timing evidence; broader OPT-118 failure matrix.
