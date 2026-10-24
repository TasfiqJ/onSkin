# Design and source investigation

The existing Today retry, reminder save notices and photo deletion notices are useful within their domains. Inspection found no equivalent local-only entry point that explains these independent states together. The new You → Help → Local recovery view fills that gap without a new ledger, backend protocol, cloud sync promise, entitlement or data copy.

The view retains descriptors only. It reads the existing Shelf loader, this local day's completion loader, strict notification preferences and existing photo-deletion status. It never reads photo metadata/images/notes, opens encrypted image files, schedules notifications, requests permission or contacts a provider. “No pending cleanup” refers only to the current readable journal, not all historical deletion or photo-content availability. Reminder intent always needs separate permission/scheduling confirmation. Existing Progress paywall and lock gates remain on the feature link.

Existing account/health leases fence every await. Local adult/consent receipts are checked before and after domain reads. Lease generation, day/foreground clock and focus remount the panel; old requests cannot publish into a replacement. Feature-owned change signals and existing query invalidations retire earlier snapshots, coalesce changes and reread through one flight per domain. There is no persisted cross-domain cache and no destructive “fix all.” Reads retry independently; mutations and native convergence stay in the original feature controls.

| Stream | Inspection and disposition |
| --- | --- |
| A: first/returning session | Read onboarding provider/receipt/quiz/navigation and actual Shelf stores/hooks/routes. Existing quiz completion, duplicate submission and append-only rules remain. Fixed render-retired Shelf callbacks; actual onboarding/manual/error/reload and A→B→A paths ran. |
| B: daily/offline loop | Read completion/progress/clock/profile/ramp paths and current launch contracts. Kept accepted offline/streak/ramp repairs and deterministic DST/clock logic. New local-day and foreground status tests pass; actual AM/PM offline duplicate/write-refusal/reload journey passes. No extra algorithm defect was invented. |
| C: reminder intent | Fixed unavailable preferences, generation-isolated reads/mutations, withdrawn/old-owner display and one-minute cached-entry reuse. Existing strict permission classifier, quota/quiet-hours, cancellation compensation, billing separation and prompt policy remain unchanged and tested. |
| D: private diary | Read storage, encryption, thumbnails, publication/delete journals and sensitive cache boundaries. Reused the existing detail-mutation authority path for capture dispatch. Existing capture-session fences remain an additional protection. No crypto or filesystem change; source-port tests do not prove native capture. |
| E: accessible recovery | New generic status cards and read-error screens have 48px controls, Close or settings Back, live error notices, independent retry and visible keyboard focus. Real web geometry/text-pressure and feature/paywall return were exercised. |

The private-KV primitive already compensates ambiguous commit-then-reject writes. We retained it and its tests rather than manufacturing a feature-level mutation bug by mocking away that contract. Photo cleanup remains journal-owned, truthful and independently retryable.

The prior M1X-04 preservation list included Shelf mutations because that earlier task did not edit Shelf. Campaign05 explicitly authorizes that file; its changed bytes and retained cancellation behavior are recorded as source here. Absolute protected paths and all old checkpoints remain unchanged. This design note issues no ADR, acceptance, M2 or launch authority.

## Final existing-surface choice after authentic CI

The first pushed candidate `54033f7c150b08721779ed02e51e68de02fa5544` added a route and failed the original execution-baseline inventory check. The mechanical exception covers only the two Phase4 worklists, so the feature inventory was left byte-identical. The same device-local affordance now expands inside You → Help. Its explicit Close action collapses the section; the row exposes expanded accessibility state. Feature-owned navigation and all read/owner/consent/day guards are retained. No route or new backend/store was needed. The unchanged validator reproduces exit 1 before, exit 0 after. Source-only iOS must still be observed at each actual pushed head.
