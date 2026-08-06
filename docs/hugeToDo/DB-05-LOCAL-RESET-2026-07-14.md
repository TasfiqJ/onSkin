# DB-05 Credential-Free Local Supabase Reset Evidence

Date: 2026-07-14

Scope: repository-source replay in a disposable local Supabase stack only

## Outcome

DB-05's local-source gate is reproducible and passed. Supabase CLI `2.109.1`
is pinned exactly in `package.json` and the npm lockfile. The runner creates a
uniquely named temporary project and local port block, removes link/secret
state from the copied source, allowlists local commands, rejects split and
`--flag=value` remote-target forms, and supplies `--local` to every database
command that can otherwise select another target. It removes the isolated
containers, volumes, and temporary files after normal completion, caught
failure, SIGINT, or SIGTERM. Uncatchable process/host termination still needs
ordinary orphan-resource cleanup before a later run.

The first clean replay exposed two source-only historical migration defects,
which were repaired at their point of use:

- Migration `0028` now installs `citext` in `extensions` immediately before its
  first use and declares the email column as `extensions.citext`.
- Migration `0048` now calls the pinned image's
  `extensions.digest`/`extensions.gen_random_bytes` functions instead of the
  nonexistent `public` variants.

These edits make a fresh repository replay deterministic. They neither modify
nor establish the state, checksums, or history of any hosted database.

## Reproducible Commands And Recorded Result

```powershell
npm ci
npm run phase2:db-local-contract
npm run phase2:db-local-reset
npm run phase2:db-local-verify
```

The 2026-07-15 verification checkpoint used Node `24.14.0`, Docker Engine `29.2.1`, the
CLI's local PostgreSQL 15 image, and exact Supabase CLI `2.109.1`. It recorded:

- local-only structural contract: pass;
- independent reset-only replay: pass;
- two consecutive explicit migration-plus-seed resets: pass;
- exact local history: 52 unique versions through
  `20260714000053_entitlement_authority_lanes.sql`;
- structural pgTAP: pass, including Auth, Storage, extension namespaces, the
  70-table/RLS inventory, seed invariants, sealed-table grants, and the
  entitlement-authority contract;
- `supabase db lint --local --schema public --level error --fail-on error`:
  pass;
- local schema versus fresh migration shadow for `public`, `auth`, and
  `storage`: semantically empty diff;
- temporary local type generation: 4,602 lines, SHA-256
  `dae61a16d2958ccc7ddc64ed4abac96163d13c1c81a5d6d10d4da827b5ee4c17`;
- repository database types unchanged and DB-08 still open; and
- no remaining DB-05-named container or volume after cleanup.

The PostgreSQL 15/17 deletion/publication and entitlement-authority-lane
rehearsals passed. The source checkpoint also recorded the following focused
server results:

- subscription reconciliation: 20/20;
- reverse-trial subscription grants: 8/8;
- atomic RevenueCat webhook handling: 20/20;
- durable account deletion: 215/215; and
- focused mobile/server publication contract: 2/2.

Edge manifest, Deno check, policy, data-rights, RLS, and release source gates
passed. The isolated server worktree passed 227 test files / 2,430 tests. The
integrated main checkpoint passed 244 test files / 2,780 tests plus typecheck,
lint, and formatting. The policy lint and rate-limit cleanup-index smoke also
passed. The adversarial RLS harness passed its source gates while correctly
warning that live staging and production evidence is absent.

CI reruns `phase2:db-local-contract` and `phase2:db-local-verify` from the
accepted lockfile; that clean-revision run is the durable acceptance evidence.

## 2026-07-29 Current-Head Verification Update

`npm run phase2:db-local-verify` exited 0 against the complete 70-migration
chain through `20260726000071`. The isolated credential-free PostgreSQL 15 run
passed:

- all four sequential cutovers
  (`0067 -> 0068 -> 0069 -> 0070 -> 0071`);
- two complete clean resets and exact 70-version history with `0071` latest;
- the focused four-file lane with 410 planned assertions;
- 15 structural pgTAP files / 1,199 assertions, including CAT-03 99/99;
- public-schema error-level lint;
- an empty `public`/`auth`/`storage` migration-shadow comparison;
- temporary local type generation of 6,771 lines with SHA-256
  `39619a6870c33fc402323c61ffce5601c0fb1460993026b8465f0ce56a0a9a91e`;
- the CAT-08 two-connection revocation rehearsal 10/10; and
- complete teardown of that verification run's own containers, volumes,
  network, process tree, and random sandbox. Historical abandoned verifier
  roots from other interrupted runs were outside that run and are not covered.

Repository database types were deliberately not replaced, so DB-08 remains
open. This update is disposable local source evidence only. It does not prove
hosted staging/production history or drift, linked-type parity, live
role/provider/TLS/load/concurrency behavior, PostgreSQL major-version
compatibility, device behavior, professional approval, or release readiness.

## 2026-08-05 Current-Head Verification Update

`npm run phase2:db-local-verify` exited 0 in 2,149.9 seconds at clean source
commit `57da25f63` against the complete 71-migration chain through
`20260729000072`. The isolated credential-free PostgreSQL 15 run passed:

- all five sequential cutovers
  (`0067 -> 0068 -> 0069 -> 0070 -> 0071 -> 0072`), including the 0071-to-0072
  commerce zero-admission rehearsal 21/21;
- two complete clean resets and exact 71-version history with `0072` latest;
- the focused five-file lane with 433 planned assertions;
- 16 structural pgTAP files / 1,222 assertions, including CAT-03 99/99;
- public-schema error-level lint;
- an empty `public`/`auth`/`storage` migration-shadow comparison;
- temporary local type generation of 6,771 lines with SHA-256
  `39619a6870c33fc402323c61fce5601c0fb1460993026b8465f0ce56a0a9a91e`;
- the CAT-08 two-connection revocation rehearsal 10/10; and
- awaited shutdown plus recursive removal of this authoritative run's own
  random sandbox `routinekind-db05-local-1fKYbR`.

The run emitted no stderr or cleanup diagnostic, and the worktree remained
clean. Historical or hard-timeout verifier roots from other runs were not part
of this acceptance and are not claimed absent. Repository database types were
deliberately not replaced, so DB-08 remains open. This is disposable local
source evidence only. It does not prove hosted staging/production history or
drift, linked-type parity, live role/provider/TLS/load/concurrency behavior,
PostgreSQL major-version compatibility, device behavior, professional
approval, App Store acceptance, legal compliance, revenue, or release
readiness.

## 2026-08-05 DB-08 Generated-Type Parity Update

A later authoritative clean run at commit `e5588ae69` executed
`npm run phase2:db-local-verify` successfully in 2,200.4 seconds. It used the
repository-pinned Supabase CLI `2.109.1`, replayed all 71 migrations through
`20260729000072`, generated canonical public-schema types, and proved the
checked-in repository artifact was already identical to the clean-local output:
6,770 lines with SHA-256
`2c14252f882294d2ca42832405fb0fe157f855a85a9d3fc5d47999457be9b1d3`.

This later result supersedes only the earlier current-state statement that the
repository types had not been replaced; the dated 4,602-line and 6,771-line
temporary-generation results above remain historical evidence. DB-08 remains
`in_progress` because the run used no hosted link and created no staging packet.
Repository/local/linked equality still requires the reviewed linked-staging
generation and retained comparison.

## Boundary And Remaining Gates

No project was linked. No access token, project ref, database password,
database URL, or hosted credential was required or used. No remote migration
list, push, repair, reset, diff, type generation, or other mutation was run.

Accordingly, “empty diff” in this evidence means only local replay versus a
local migration shadow. It is not hosted drift parity. The historical
4,602-line 2026-07-15 and 6,771-line earlier-2026-08-05 temporary type files
remain evidence only. The later clean `e5588ae69` verifier proves that the
current 6,770-line checked-in artifact equals clean-local generation at SHA-256
`2c14252f882294d2ca42832405fb0fe157f855a85a9d3fc5d47999457be9b1d3`.
DB-06 must still capture reviewed staging migration/checksum/deployment
evidence. DB-08 remains open until linked staging generation is retained and
equality across repository, clean local, and linked output is proved.
DB-09/DB-10 hosted, provider, concurrency, and physical-iPhone gates also
remain open.

Migration `0053` and the compatible function/mobile revision must be deployed
as one ordered change. It separates RevenueCat/store entitlement snapshots from
app-granted reverse trials, adds an authenticated reconciliation lane, and
keeps both behind the exact-session publication/deletion fence. Local source
proof does not replace RevenueCat sandbox evidence, hosted exact-session
concurrency evidence, an enforceable old-client control, professional privacy
and security review, or App Store review.

The local CLI has no supported leaked-password-protection config key. Hosted
staging and production must still enable and evidence Auth's
`password_hibp_enabled` control on a supported plan before launch.
