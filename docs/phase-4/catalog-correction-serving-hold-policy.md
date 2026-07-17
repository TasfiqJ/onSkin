# Catalog correction serving-hold policy

## Decision

A caller-created correction with status `open` is untrusted intake and does not
globally suppress an otherwise reviewed catalog product. A product is held from
barcode lookup, search, recommendation/direct reads, and child-evidence reads
only when a service-only review transition records all of the following:

- status `triaged` or `accepted`;
- a database-generated review timestamp that is not in the future;
- a bounded operational reviewer alias; and
- a non-empty operator review note.

`accepted` remains a hold until an operator closes the correction after the
catalog record has been repaired and re-reviewed. `rejected` and `closed` do not
hold serving.

## Threat model and tradeoff

Treating every open report as a global hold gives one ordinary account a
cross-user product-takedown primitive. Even with a per-account rate limit, one
account could suppress up to 20 products per 15-minute window, and account
farming could multiply the effect. The selected policy removes that availability
authority from user input: authenticated and service API roles have no direct
`INSERT`, `UPDATE`, or `DELETE` privilege on correction rows, intake is fixed to
`open`, and only the audited review RPC can create a hold.

The safety tradeoff is that a genuine new report does not immediately withdraw a
previously source-approved product for every user. This is preferable to letting
unverified user content override reviewed catalog evidence. Operations must
triage safety-relevant reports promptly; once verified, the database fails closed
across every serving lane even if the denormalized product counter is stale.

## Abuse and privacy controls

- Correction intake is bound to the caller's exact active health-processing
  epoch and current account state.
- Intake accepts only bounded, allowlisted, minimized fields and fixes workflow
  and operator fields server-side.
- Intake is account-serialized and limited to 20 rows per 15 minutes.
- Review is service-only, follows constrained status transitions, and is bound
  to the report owner's exact active health-processing epoch.
- Legacy statuses cannot create holds because the operator-audit columns did not
  exist before this migration and begin as `NULL`.
- Database tests cover open-report non-suppression, audited-hold suppression,
  stale projection defense, RPC ACLs, and denial of direct table mutation.

This policy does not replace the CAT-08 requirement for an authorized operator
tool, alerting, queue SLAs, and review evidence. Those remain launch gates; the
database boundary prevents the future tool from relying on direct table edits.
