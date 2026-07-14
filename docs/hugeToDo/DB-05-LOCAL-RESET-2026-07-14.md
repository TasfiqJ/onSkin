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

The 2026-07-14 run used Node `24.14.0`, Docker Engine `29.2.1`, the CLI's local
PostgreSQL 15 image, and exact Supabase CLI `2.109.1`. It recorded:

- local-only structural contract: pass;
- independent reset-only replay: pass;
- two consecutive explicit migration-plus-seed resets: pass;
- exact local history: 51 unique versions through `20260713000052`;
- structural pgTAP: 16 assertions pass, including Auth, Storage, extension
  namespaces, the 70-table/RLS inventory, seed invariants, and sealed-table
  grants;
- `supabase db lint --local --schema public --level error --fail-on error`:
  pass;
- local schema versus fresh migration shadow for `public`, `auth`, and
  `storage`: semantically empty diff;
- temporary local type generation: 4,556 lines, SHA-256
  `710b86ee8acba569a3258d22479db911672029d2aefd06afffd71526d02a10ec`;
- repository database types unchanged and DB-08 still open; and
- no remaining DB-05-named container or volume after cleanup.

The policy lint and rate-limit cleanup-index smoke also passed. The adversarial
RLS harness passed its source gates while correctly warning that live staging
and production evidence is absent.

CI reruns `phase2:db-local-contract` and `phase2:db-local-verify` from the
accepted lockfile; that clean-revision run is the durable acceptance evidence.

## Boundary And Remaining Gates

No project was linked. No access token, project ref, database password,
database URL, or hosted credential was required or used. No remote migration
list, push, repair, reset, diff, type generation, or other mutation was run.

Accordingly, “empty diff” in this evidence means only local replay versus a
local migration shadow. It is not hosted drift parity. DB-06 must still capture
reviewed staging migration/checksum/deployment evidence. DB-08 must reconcile
local generated types with reviewed staging before deliberately replacing the
hand-authored repository types. DB-09/DB-10 hosted, provider, concurrency, and
device gates also remain open.

The local CLI has no supported leaked-password-protection config key. Hosted
staging and production must still enable and evidence Auth's
`password_hibp_enabled` control on a supported plan before launch.
