# Original-owner ingress and production authority dependencies

Engineering30 specification only. Production adapters, backend policy/data changes, authentic identity provisioning and intended-to-actual production application are not authorized or implemented. Independent Brain review and separate founder authorization remain prerequisites.

## Minimum authenticated inputs

An authenticated owner binding needs independently verified subject/session identity, a monotonic binding revision, adult eligibility and current explicit health-consent/lifecycle epoch. A lawful owner-link proof must establish the same owner; email equality, a browser flag, a hash, or fixture data is insufficient. One-time provider proofs need explicit consumption and revocation behavior. Owner A→B→A must change the binding revision. Staff needs the existing AAL2/TOTP policy. See professional `serverSession.ts` VerifiedIdentity/IdentityVerifier/ServerSessions and `serverAuthentication.ts`.

Professional operations additionally require genuine practice membership, exact selected-owner assignment/generation, verified current licence, provider-verified billing and an explicit field/purpose/permission grant. Consumer Plus, practice ownership and billing administration confer no content authority. Owner rights remain independent of practice access. Grant acceptance/switch/revocation needs explicit owner confirmation, expected revision and the exact previous grant. See professional `authority.ts`, `grants.ts`, `workspaceService.ts` and `encryptedWorkspaceRepository.ts`.

## Original immutable records and custody

Authenticated same-owner ingress must preserve original record IDs, schema versions, complete payload hashes, actual predecessor evidence, correction/retraction targets and original device times. Server receipt/transaction times are separate facts. Unknown fields remain unknown. Validate complete retained chains before publishing projections. Do not reconstruct history or source authority from current Shelf contents. Relevant source interfaces are `previsitRecords.ts` PrevisitRecordSource and `reconciliationService.ts` ReconciliationSource; consumer validation includes `actualRoutine.ts` decodeActualRoutine and `ownedBottleVersion38.ts` validateOwnedBottleHistory38.

Custody requires an approved encrypted serializable durable driver and a lawful key custodian. Lock the dynamic read/write set, stage writes, re-resolve provider/session/lifecycle/grant/licence/assignment under that lock, and commit atomically. Resolve only after durable commit. Lost acknowledgement produces an unknown outcome, not automatic rerun. Purpose/key-version-bound AEAD and retained-key readback are required; no memory fallback. See `encryptedCustody.ts`, `encryptedWorkspaceRepository.ts` and WorkspaceTrust's planSource/reconciliationSource/previsitRecords.

Explicit first provisioning must be separate from absent/corrupt/key-loss recovery. Missing private records or keys cannot authorize empty replacement history, key creation or deletion of ambiguous ciphertext. Read projections through original immutable owner records inside the same transaction and constrain them to exact granted fields. An unrelated retained copy is not source authority.

## Intended-to-actual owner application

The owner must separately review and explicitly confirm one exact immutable intended plan. The command needs its ID/hash, received-copy proof, original projection identity/hash, owner/practice/grant epochs, exact template revision and mapping provenance where applicable, actual owned-product/formula-version mapping, expected actual-plan predecessor, stable command ID and full payload. Atomically append the owner actual version and its provenance/outcome receipt. Applying a plan records no use. Professional issuance, delivery/receipt, owner application and actual check-off remain separate transactions and facts.

Current professional ClientPlanSource carries owner/practice/grant identity, product ID/name rows and a projection hash; it does not bind imported immutable bottle/formula revisions. A versioned source contract must add those original references. Current consumer PlanSourceSnapshot44 is deliberately `source:'local'` and carries an original in-memory WeakMap proof over exact local bytes. Casting a professional intended plan into it would invent authority. A separately reviewed source variant and lawful application transaction are needed. See `intendedPlans.ts`, `workspaceService.ts`, consumer `planSourceFence44.ts`, `actualRoutine.ts` and `completionsStore.ts`.

## Migration and recovery requirements

1. Approve lawful collection/retention, jurisdiction, owner linking, source schemas, authenticated provisioning and offboarding custody before enabling adapters.
2. Preserve original local histories, ciphertext, uncertain outcomes and key ownership. No implicit upload, rekey or import.
3. Bind ingress idempotency to exact command/payload and original predecessor. Preserve E23 outer CAS plus inner-event predecessor proof.
4. Make deletion/tombstone priority cover ingress, retry, restore, pending application and projection publication. Withdrawal/regrant never lends a newer epoch to older work.
5. Provide observational outcome inspection and identical-command retries. Missing predecessor proof remains a refusal; matching current content is not proof that a prior command succeeded.
6. Test foreign-owner, changed source/grant/licence, stale parent, acknowledgement loss, replay, concurrent deletion and incomplete retained history. Retain exact failed records without destructive repair.
7. Independently qualify real provider lifecycle, durable custody, native key behavior and physical devices. Positive local synthetic tests remain synthetic.

The default professional API503 remains required until these dependencies exist. Template reads/writes remain refused after licence/billing retirement until an approved retained-copy and custodian policy exists. Unresolved/unshelved items do not become Shelf products or durable owner-linked proposals without authentic source authority and an approved retention purpose.
