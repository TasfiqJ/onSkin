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
Store only its non-secret reference in `evidenceReference`; record a concise
qualification label in `credentialOrRole`, but do not commit privileged advice,
personal contact details, licence numbers, credential documents, or secrets.

## Workflow

1. Finalize and commit the source being reviewed.
2. From a clean tree, run `npm run phase3:review-worklist` and give the reviewer
   the relevant item details, source hashes, and `reviewSnapshotSha256`.
3. Run `npm run phase3:review-signoff-template -- --list` to inspect exact item
   IDs, snapshot digests, statuses, and safe output filenames.
4. After a real decision, print a prefilled draft with
   `npm run phase3:review-signoff-template -- --item <id> --disposition approved`
   or replace `approved` with `deferred`. Add `--output` with a direct path such
   as `docs/phase-3/signoffs/<safe-name>.json` to write it. The command refuses
   dirty source, stale worklists, duplicate signoffs, overwrites, path traversal,
   nested output, and contradictory dispositions. The static
   `docs/phase-3/review-signoff.template.json` remains a manual fallback and is
   intentionally schema-invalid until every placeholder is replaced.
5. Replace every placeholder. `itemId` and `reviewSnapshotSha256` must exactly
   match the generated item. The attestor name and review date must exactly
   match the review-log row.
6. Replace the generated condition placeholder with every condition, or remove
   its array entry when there are none. For `approved`, set
   `conditionsSatisfied` to `true` only after every recorded condition is
   satisfied, and keep `productionGate` as `null`. An approval with an open
   condition is not release evidence.
7. For `deferred`, use a structured production gate with state `hidden`,
   `inert`, `disabled`, `excluded`, or `not_exposed`, plus a real reason and
   owner. The matching review-log behavior must also document that exclusion.
8. Commit the signoff and matching review-log disposition together. Regenerate
   the worklist, operator queue, and review packet from the clean commit.
9. Run `npm run phase3:review-signoff-template:smoke`,
   `npm run phase3:review-worklist:check`,
   `npm run phase3:review-operator-queue:check`,
   `npm run phase3:check-production-release`, and
   `npm run phase3:audit-copy:strict` before setting
   `PHASE3_RELEASE_CLEARANCE=cleared` in production.

The worklist rejects missing, duplicate, orphaned, malformed, placeholder,
stale, mismatched, or tampered signoffs. Never alter a source hash or generated
artifact to make a review pass; changed source requires a new review snapshot
and, when material, a new professional decision. Generating a draft is not a
review, approval, deferral, credential check, or release disposition.
