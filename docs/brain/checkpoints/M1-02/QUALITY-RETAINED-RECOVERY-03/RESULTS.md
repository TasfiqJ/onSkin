# Measured results

This candidate is submitted for independent review; it does not accept itself.

## Authentic worklist repair first

The external manifest anchor verified all ten declared context files, including
the verifier. The orientation prompt copy is excluded and not authoritative.
Live branch, tree, main base, accepted ancestor and PR10 matched the supplied
anchors before editing. The sole stage checkout was clean; other worktrees and
the unrelated WeddingCards repository were preserved.

The sparse Windows check initially refused with missing inputs as well as stale
outputs. `git sparse-checkout disable` safely materialized the complete tracked
checkout, without changing any source bytes. The complete clean check then
refused only the same two stale outputs seen in GitHub job 120734493735.

The unchanged `scripts/phase4/build-source-worklist.mjs` produced both outputs
with `npm run phase4:source-worklist:strict`. Commit 219af21c4 contains exactly
those two generated files. It hashes 416 source occurrences, with no missing
inputs; item statuses remain seven blocked and seven local-scaffold. Changed
Shelf bytes, two added Shelf regression paths and USER_FLOW_TREE were real drift
from the accepted earlier implementation, not source deletions or approvals.

The strict check passed in the clean complete checkout and an independent
source-complete disposable clone. Appending a comment to a referenced Shelf
input in that clone made the original check refuse both outputs, exit 1. The
real input was untouched. The disposable path, hashes and exits are recorded.

After the new flow documentation changed, the strict check again refused.
Commit 4d8ef8a02 refreshes the same two outputs with the same unchanged producer
from clean product commit 3bcc21fe8. Clean measured source passes the original
strict check. Only these two Phase4 outputs were edited; no generator, policy,
source signature, approval, date, scanner or SQL input was changed.

## Notification preference publication

A real QueryClient can retain a pending read that captured old preferences.
When a later save commits and scheduling fails, the hook correctly reports
saved/unconfirmed but previously published the saved cache without cancelling
that read. Its late result then replaced the saved opt-in or opt-out on screen.
The new tests reproduce both directions on original production source.

Commit de1509560 retires that pending read before publishing the saved intent,
and reasserts the existing health lease after cancellation. Successful save and
withdrawal settlement safeguards remain intact. Storage, scheduling policy,
retry intent and owner primitives are unchanged. The browser reproduces the
late-background-read branch using actual encrypted preferences and a controlled
scheduling bridge refusal, then touches and keyboard-retries the visible UI.

## Offline private diary dispatch

The production QueryClient defaults to online network mode. `usePhotos` and
the capture-add mutation omitted the local-only override already used by diary
detail writes. Cold offline reads paused before encrypted storage; the loading
gate could remain pending. Local capture saves paused too, and an offline
delete could leave its refreshed source pending despite a committed deletion.

Commit 3bcc21fe8 sets `networkMode: 'always'` for those two local operations.
It preserves existing health/owner checks, encryption, cleanup outcome, query
authority, cache quarantine and separately governed replay. Tests exercise cold
read, explicit storage retry, capture refusal/retry and post-delete refresh with
the real hooks, QueryClient and health leases, using synthetic storage ports.
Closed authority remains closed. The crossing-withdrawal test on original
source fails at its offline-read prerequisite; it is not evidence of a separate
withdrawal leak in the original source.

## Scope and evidence boundary

Exactly seven source paths differ from the starting anchor: two production
hooks, two new test files, USER_FLOW_TREE and two generated worklists. SHA-256
comparison of all 20,951 baseline regular files found 20,946 unchanged and the
five expected existing-file changes. The two tests are additive. Protected Git
trees and explicitly retained earlier repairs match the anchor. The raw hashes
and exact Git objects are in the manifests; source working bytes match commits.

Eleven focused checks pass. The identical final overlay on commit 219af21c4
(same production bytes as 704d3df5e) has eight expected failures and three passes.
Those failures expose two product families, not eight independent defects.
Eight retained families pass 2,029 tests in 168 files. Clean measured source
passes 6,101 forced root tests (6,077 mobile/470 files + 24 console/7 files),
forced typecheck, forced lint and strict worklist. Source authored diff check
passes. Raw logs retain their own whitespace and warnings.

No shared auth/consent/storage/encryption, dependency, native configuration,
workflow, original Security/DB or approved Brain-state path changed. Earlier
scoped Brain acceptance remains separately attributed to the prior source;
this new candidate has no independent acceptance yet. No paid positive,
native/device, signing, deployment, provider, clinical or release proof.
