# Final Decision-Free Slice Audit

Date: 2026-07-21 (America/Toronto)

Branch: `optimization`

Implementation checkpoint: `24ad841ef3fc1e5cf3f067a6d942157e04b44540`

Evidence class: source audit and focused command verification

## Result

No further measured, decision-free repository implementation slice remains after the incremental mobile export writer.

Two independent agents audited the remaining optimization-plan gaps. One ranked an immutable paged Ask transcript first from stale status text that said repeated mixed-height anchoring remained open. The current source-of-truth evidence invalidates that premise: the committed 202-message run traversed every expected start index across all 12 prepend boundaries, retained one prior anchor at each boundary, reached the oldest row without a blank viewport, mounted roughly 16 message rows near that boundary, caused zero history commits or row renders while typing, and reset to the latest 16 messages after submission.

The second audit rejected the Ask rewrite. An immutable in-memory page container could reduce shallow array copying but would not bound retained question/answer content. Persisting transcript pages would change product and privacy behavior because the current Ask store deliberately writes no question or answer text; durable storage needs explicit retention, consent, purge, export, and account-deletion contracts. A bounded bidirectional presentation window would add page eviction, downward reload, mixed-height removal compensation, focus/accessibility restoration, and native lifecycle risk without a measured frame, heap, blank-cell, or interaction failure.

The complete ephemeral transcript in route state is therefore recorded as an explicit tradeoff rather than misclassified as a virtualization defect. If signed native profiling later demonstrates a source-copy or heap failure, the implementation must remain ephemeral unless the separate transcript-retention policy is approved, and it must preserve chronological IDs, report state, exact prepend/removal anchors, latest-window recovery, keyboard behavior, and accessibility focus.

## Verification

| Check | Result |
| --- | --- |
| Ask history, stress-fixture, and route-contract matrix | Pass, 3 files / 39 tests |
| Latest mixed-height prepend evidence | 12 / 12 boundaries, zero blank viewports |
| Oldest-boundary recycler observation | Roughly 16 mounted rows for 202 logical messages |
| Typing at oldest boundary | Zero history commits and row renders |
| Post-submit recovery | Latest 16 messages restored |

Command:

```text
npm.cmd --workspace apps/mobile test -- src/features/ask/historyWindow.test.ts src/features/ask/stressHistoryFixture.test.ts src/features/ask/routeContract.test.ts
```

## Rejected Local Candidates

- Ask durable transcript paging: requires retention/privacy/product decisions and does not follow from a measured recycler failure.
- Ask bidirectional presentation eviction: introduces unmeasured anchor, focus, accessibility, and lifecycle behavior without a current defect.
- Scanner terminal-frame gating: a theoretical source improvement with no measured regression.
- Catalog result persistence: requires owner, privacy, TTL, and staleness policy.
- Progress/Shelf storage paging and encrypted thumbnails: require the approved photo/native-storage design and physical-device ceilings.
- Completion-history outbox adoption: requires authoritative server routine/step UUID mapping.
- Retention, abuse, cleanup, scheduling, budgets, alerts, and signoff: require named owners, policy, hosted authority, or approved thresholds.

## Remaining Closure Boundary

The remaining work is external or decision-gated: approved photo-v2/cache/thumbnail and startup-shield architecture; hosted Supabase/provider deployment and recovery exercises; retention/abuse/scheduler/alert ownership; exact signed release artifacts and approved budgets; and supported physical-device performance, filesystem, lifecycle, keyboard, accessibility, account-switch, and OS-kill evidence. Web and unit evidence do not substitute for those gates.
