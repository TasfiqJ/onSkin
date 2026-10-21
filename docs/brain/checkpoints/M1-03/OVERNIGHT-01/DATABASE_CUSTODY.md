# Current source custody — NON_ADMITTING

The measured implementation is `3c063dfe47d887e7aa3e27d05da41658b69a59dc`.
`scripts/phase2`, `supabase`, `packages/types`, `package-lock.json` and `.github`
have no changes from reviewed endpoint `7305ff24c`. No new local DB verifier was
necessary or executed: original Quality run **39532208765**, job **119000585680**,
already completed the guarded credential-free verifier successfully. Its checkout
was PR merge `211f56ec1e80275a3b4e95b9c6161af372ddefc3`, tree
`8857cbcaa26c28b434235a53521636af77cb6b36`, identical to the submitted stage tree.
Safe provider excerpts are in `evidence/original-db-job-excerpts.txt`; this is
provider evidence, not a new local execution. It reports 97 migrations through
0081, both resets, structural tests, lint, empty drift, CAT08 and 7,381-line type
parity, SHA256 `2b475803f0ea143681de2912637e61b1cf26e271043a84a1692e7d1d6b87a795`.

The fresh measured-head Quality run **39543844814**, job **119037719258**, is
different: it failed before SQL verification with
`H01_SQL_PROBE_FAILED: exit-nonzero` and Docker `toomanyrequests: Data limit exceeded`.
The current provider result stays failed; the older pass above is not borrowed as
a current green result. No retry, registry authentication, image substitution or
additional local verifier was attempted. This exact external acquisition failure
is in `evidence/current-db-acquisition-failure.txt`.

| Boundary | Actual producer and consumer | Issuer/scope/expiry and remaining refusal |
|---|---|---|
| Disposable local verification | `scripts/phase2/local-supabase-reset.mjs` produces guarded reset/test/type results; `.github/workflows/quality.yml:141` and `:144` invoke local contract and verifier | Existing credential-free disposable scope only. No hosted target, image replacement, registry authentication or additional verifier run occurred in this assignment. A provider job pass has no human approval or renewable authority. |
| DB06 | `scripts/phase2/staging-deployment-evidence-lib.mjs:808`, `assertPinnedMigrationRunnerCompatibility`, is consumed by `deploy-supabase-staging.mjs:800` before the hosted route | CLI must equal 2.117.0, then the producer unconditionally throws `DB06_CURRENT_CHAIN_REPLAY_REQUIRED`. A local/CI pass cannot change this source refusal. The adjacent comment's 94 count is historical text, not permission to rotate current 97/0081 pins. |
| DB06 cutover | `validateCutoverRecord` in the evidence library validates a supplied operator packet; deployment orchestration revalidates before and after mutation | `privacy-reviewer`, `release-owner`, `rollback-owner`, `security-reviewer`; exact staging target fingerprint, source, rollback, migration plan and closed-ingress evidence. `reviewedAt <= now < validUntil`, validity at most seven days, retention later than expiry and enough completion budget. These are required role labels, not verified identities. No current issuer-attested packet is supplied or fabricated. |
| DB08 | Local runner `:1257` generates temporary canonical types and `:1300` refuses stale repository types; evidence library `:1520` compares linked/local then repository/local types | Current original CI proves local/repository equality only. Linked staging equality and the target-bound DB06 issuer packet remain absent. No types source change is authorized. |
| R2B | Migration `supabase/migrations/20261010000081_db06_acl_r2a_client_nonrow_privileges.sql:2`, introduced by `e2ec482dac554392a19a5c085898bae0f9704713`, explicitly leaves **R2B (supabase_admin defaults)** open | This establishes what that historical residual refers to. It does not supply an executable R2B admission producer, authoritative issuer, receipt, scope or expiry. The pgTAP default-ACL baseline is evidence, not an R2B approval. Those authority fields remain UNKNOWN. |

Additive local migration development requires a separate M2-01 issuance after
independent Brain review. Hosted replay requires the protected DB06 producer review,
current linked parity and an actual qualified cutover packet. Integration/main and
release each need their own exact authority. `protected_source_go=false` and
`main_promotion_authorized=false`; original Security expiry `2026-10-21T00:00:00Z`
remains expired. No one of these four permissions is inferred from another.

## One residual review action

**Recipient: independent Brain / protected database custodian.** Before issuing any
protected replay work, review the unchanged producer `assertPinnedMigrationRunnerCompatibility`
against the original job above and identify the canonical R2B issuer/receipt for
the `supabase_admin` default-ACL residual. A subsequent, separately authorized source
packet must bind its exact implementation head, current replay/type evidence and
the target-bound role/expiry requirements before replacing the unconditional
refusal. Missing R2B authority remains unknown. This packet requests review and
precise subsequent issuance; it requests no founder credentials, hosted execution,
schema change or automatic M2 work.

Current canonical image acquisition is also externally blocked by the provider's
data limit. Any later bounded verification must follow restored canonical-image
availability and a new explicit decision to rerun; it must not authenticate,
substitute another image or retry until green under this issuance.
