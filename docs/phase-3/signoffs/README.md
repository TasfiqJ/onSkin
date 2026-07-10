# Phase 3 Detached Signoffs

This directory holds one machine-readable signoff per Phase 3 review-worklist
item with an `Approved` or `Deferred` release disposition. No professional
review has been completed merely because this directory or its template exists.

## Evidence Boundary

The machine gate proves that a committed signoff is complete, internally
consistent, current for the exact source-hash snapshot, and unchanged since the
worklist was generated. It cannot prove the attestor's identity, credential,
authority, or quality of judgment. Tas must verify those facts and retain the
original signed memo, email export, counsel record, or review-system artifact.
Store only its non-secret reference in `evidenceReference`; do not commit
privileged advice, personal contact details, credentials, or secrets.

## Workflow

1. Finalize and commit the source being reviewed.
2. From a clean tree, run `npm run phase3:review-worklist` and give the reviewer
   the relevant item details, source hashes, and `reviewSnapshotSha256`.
3. After a real decision, copy `docs/phase-3/review-signoff.template.json` to a
   unique JSON file in this directory. Use a Windows-safe filename; replace the
   colon in the item ID with `--`.
4. Replace every placeholder. `itemId` and `reviewSnapshotSha256` must exactly
   match the generated item. The attestor name and review date must exactly
   match the review-log row.
5. For `approved`, record every condition, set `conditionsSatisfied` to `true`,
   and keep `productionGate` as `null`. An approval with an open condition is
   not release evidence.
6. For `deferred`, use a structured production gate with state `hidden`,
   `inert`, `disabled`, `excluded`, or `not_exposed`, plus a real reason and
   owner. The matching review-log behavior must also document that exclusion.
7. Commit the signoff and matching review-log disposition together. Regenerate
   the worklist, operator queue, and review packet from the clean commit.
8. Run `npm run phase3:review-worklist:check`,
   `npm run phase3:review-operator-queue:check`,
   `npm run phase3:check-production-release`, and
   `npm run phase3:audit-copy:strict` before setting
   `PHASE3_RELEASE_CLEARANCE=cleared` in production.

The worklist rejects missing, duplicate, orphaned, malformed, placeholder,
stale, mismatched, or tampered signoffs. Never alter a source hash or generated
artifact to make a review pass; changed source requires a new review snapshot
and, when material, a new professional decision.
