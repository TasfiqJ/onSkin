# Final Ledger Terminal Classification

Date: 2026-07-26 (America/Toronto)

Branch: `optimization`

Parent implementation checkpoint:
`95274596fb302477e6c1aceb8f763b9f02585e5c`

## Finding

The assignment's final condition requires every optimization-ledger item to be
`verified`, precisely `blocked-external`, or justified `not-applicable`.
The first terminal classification exposed 53 provisional rows. Independent
review then found two real decision-free exceptions inside that set:

- `OPT-116` lacked an enforced Supabase CLI identity/version and the exact
  nontransactional linked migration runner.
- `OPT-119` lacked a guarded forward concurrent replacement for its historical
  blocking-built cleanup index.

Both local gaps were implemented and realistically exercised before final
classification. Their independent re-reviews found no remaining must-fix. That
left no provisional row and no hidden safe local implementation slice.

## Change

The final ledger now has one terminal classification for every plan item:

| Status             |  Count | Meaning at this checkpoint                                                                                                                                                              |
| ------------------ | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verified`         |      4 | The exact acceptance evidence named by the item is complete.                                                                                                                            |
| `blocked-external` |     55 | No safe repository-local action remains; the row names the exact external decision, authority, hosted system, signed artifact, owner/threshold, or physical-device input required next. |
| `not-applicable`   |      2 | The accepted iOS-only launch contract makes the Android-specific task precondition false for this release.                                                                              |
| **Total**          | **61** | Exact one-to-one coverage of every `PERF-P0-###` and `OPT-###` item in the plan.                                                                                                        |

`blocked-external` does not erase completed local implementation. Each row
retains its implementation files, test/evidence files, command results, and
remaining gate. It supersedes a provisional status only at the final local
closure checkpoint, after current-source and independent audits establish that
the next valid action depends on an unavailable external input.

No row was promoted to `verified`.

## Executable Contract

`apps/mobile/src/lib/optimization/implementationStatusFinality.test.ts`
enforces:

- exact one-to-one coverage of all 61 plan items;
- no provisional status at the final local checkpoint;
- explicit blocker text for every `blocked-external` row;
- nonempty implementation, evidence, and command fields for every `verified`
  row; and
- an explicit scope/precondition rationale for every `not-applicable` row.

The test initially failed with exactly 53 provisional rows, then passed after
the terminal classifications were applied. It was deliberately reopened for
the two local exceptions, failed with exactly `OPT-116` and `OPT-119`, and
passed again only after both implementations and evidence were complete.

## Photo-v2 Compatibility Finding

The independent source review for `OPT-101`/`OPT-102` confirmed the exact local
boundary rather than treating `not-started` as self-evident:

- Expo built-ins could bounded-chunk encrypt only after the complete photo had
  entered JS as base64/hex; that does not satisfy the plan's off-JS
  file-to-file or opaque native-display requirements.
- The current v1 path captures JPEG at quality `0.76`, strips metadata in JS,
  encrypts XChaCha20-Poly1305 bytes into a hex/JSON envelope, and displays a
  complete decrypted data URI.
- The metadata journal already reserves primary and thumbnail URIs, but current
  production writes keep `thumbnailLocalUri` null.
- No local Expo module, native crypto dependency, or opaque protected image
  view exists in the repository.

A narrow local Expo native module, binary envelope, migration journal, and
dual-reader rollout are viable candidates, but selecting their crypto suite,
key/AAD contract, renditions, display boundary, migration/rollback behavior,
and supported v1 window is exactly the unapproved `OPT-DEC-001`/`009` scope.
Production integration or generated visual fixtures before those decisions
would invent architecture and acceptance policy.

## External Boundaries Preserved

The largest remaining implementation unlocks are still real:

- `OPT-DEC-001` and `OPT-DEC-009` must approve the photo-v2 binary envelope,
  native/streaming boundary, rendition dimensions/format/quality, migration,
  rollback, and v1 retention period.
- Completion-history outbox adoption needs authoritative routine/step UUIDs.
  Onboarding publication and the consent ledger need approved operation
  identity, ordering, and terminal reconciliation semantics.
- Hosted Supabase/provider rehearsals require an authorized disposable
  environment and credentials.
- Exact linked-staging replay of CLI `2.109.0` `migration up --linked` remains
  external; the local wrapper pins that runner without fabricating hosted
  history/idempotency proof.
- Native verification requires canonical signed artifacts, supported physical
  devices, predeclared thresholds, named owners, and independent signoff.
- Retention, abuse-window, scheduler, alert, and final-brand gates require
  their recorded legal/product/operations authorities.

These are terminal external classifications for this repository checkpoint,
not claims that the plan's literal "maximized" definition has been met.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/optimization/implementationStatusFinality.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile run lint
npm.cmd test
git diff --check
```

Results:

- Finality contract: 1 file / 3 tests passed.
- Exact plan/ledger coverage: 61/61, with no duplicate or missing item.
- Supabase runner source contract: 1 file / 3 tests passed.
- Strict PostgreSQL 15 concurrent-index replay: 250,000 rows, zero validation
  failures.
- Root type-check: PASS, 2/2 workspaces.
- Root lint: PASS, 2/2 workspaces, zero warnings.
- Preserved dirty-worktree root suite: 372/374 files and 4,567/4,571 tests
  passed. The four failures are the unchanged unrelated user-owned
  notification behavioural snapshot and three Shelf PAO/provenance
  expectations.
- Final independent terminal-status review: PASS.
