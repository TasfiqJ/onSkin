# Startup, Consent, and Owner-Lifecycle Checkpoint

Date: 2026-07-14 (America/Toronto)
Branch: `optimization`
Implementation SHA: `e90cb26a7868c43c18ee7dcc3b52e317cf59b2dc`
Evidence class: `command` and `decision`

This checkpoint closes another owner-boundary group across startup authority, anonymous-session handoff, consent reads and enforcement, Ask quota reads, and photo action callbacks. Reads that cannot be safely cancelled detach from an invalidated owner generation, while writes that may have committed remain inside the destructive account drain.

## Implemented Contract

- Startup onboarding authority now comes from a strict owner-bound query. Missing local state remains the only local false result; unavailable, corrupt, future, and malformed server-count states fail closed without rewriting bytes. Cached true or false data is not trusted during a refresh, every mount revalidates, and the retained error surface remains mounted for retry. Durable skin-profile publication synchronously patches the exact owner cache to true.
- Anonymous onboarding handoff is provider-owned from a synchronous `resolving` phase through exact session publication. Request identity, auth-transition epoch, and latest-target arbitration coalesce duplicate same-target requests while preventing a delayed account-A response from overriding account B. Focus, `SessionBoundaryGate`, and StrictMode lifecycle handling prevent hidden Welcome navigation, stale busy state, and abandoned handoffs.
- General, Ask, Commerce, and Community consent reads now reuse one owner/account-generation lease across abortable Supabase reads and detached local fallbacks. Equal-timestamp ledger rows resolve revocation-first. Management surfaces retain the last verified choice after an error but disable changes while truth is unknown or refreshing; enforcement hooks require a fresh successful read. Replenishment adds owner, mounted, latest-request, and single-flight fences so late consent results cannot navigate or publish state.
- Ask grounded-turn quota reads and photo action callbacks enter the captured owner operation before publication or mutation. Delayed and never-resolving account-A reads reject at the boundary without populating account-B cache, while photo writes that may have committed remain drain-held. Real `QueryClient` and `MutationObserver` tests cover owner-key isolation, same-owner refresh/write behavior, cancellation precedence, exact invalidation, and late-result suppression.

## Commands And Results

| Command or action | Result |
| --- | --- |
| Twenty-one-file startup/consent/Ask/photo lifecycle Vitest matrix | Pass, 21 files / 199 tests |
| `npm test` | Pass, 260 files / 3,278 tests |
| `npm --workspace @layerwell/mobile run typecheck` | Pass |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm --workspace @layerwell/mobile run lint` | Pass, zero warnings |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| Scoped and staged `git diff --check` | Pass |

Independent startup review found hidden resolving-handoff publication, stale auth-response arbitration, cached-false authority, retry-remount, and blur-state defects. All were corrected before the final rerun; the final re-review found no remaining P0/P1/P2 in that tranche. Consent re-review found no P0/P1 while retaining explicit P2 coverage gaps. Independent Ask-quota and photo-callback reviews were clean, and a final staged-diff audit confirmed that only the intended 41 files were included.

## Verification Boundary And Follow-Up

No physical-device, native transport, protected-storage, account-switch, photo process-death, or notification-delivery evidence is claimed. No new human-simulated UI pass is claimed for Welcome, Ask consent, You privacy controls, or Replenish. `AuthProvider` and route components were not mounted because the repository lacks React Native Testing Library or `react-test-renderer` support; Replenish lifecycle is covered by helper tests and source contracts, and consent enforcement-hook tests mock `useQuery` rather than exercising a mounted observer.

The separately audited future Ask provider/reservation lifecycle remains a subsequent tranche and is not claimed complete by this checkpoint.
