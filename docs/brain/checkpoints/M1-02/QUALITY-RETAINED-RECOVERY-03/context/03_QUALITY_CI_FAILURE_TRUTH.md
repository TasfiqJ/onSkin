# Final-head Quality and Security, 2026-10-24 UTC

Actual PR11 final evidence-head `704d3df5...` GitHub Actions:

- Quality run **40048160616 FAILURE**: `https://github.com/TasfiqJ/onSkin/actions/runs/40048160616`.
- Repository quality job **120734493735 FAILURE**: after passing many original checks, `npm run phase4:source-worklist:check` reported that `docs/phase-4/generated/source-worklist.json` and `.md` were stale, exit 1. The unchanged generator is `scripts/phase4/build-source-worklist.mjs`. Existing source references now have changed bytes.
- Canonical database job **120734493583 FAILURE**: `H01_SQL_PROBE_FAILED: exit-nonzero`, registry `Data limit exceeded` during required canonical image acquisition. No local substitute/image tag, credentials, paid retry, or protected workflow change is authorized. PG15 and PG17 account deletion rehearsals SUCCESS but not replacements for canonical job.
- iOS launch contract run **40048160574 SUCCESS (source-only)**. Not a device/build/archive signing authority.
- Security run **40048160572 FAILURE**: original secret/code/static and automated source-only acceptance jobs failed. No change to protected original G97/DB; no scan GO.

The previous PR11 head `21ceb8c...` had Quality #40045123185 SUCCESS; source-worklist drift followed new referenced source/doc changes. The true remaining Quality external database registry blocker is independent of the source-worklist problem. Check CURRENT runs again after next push; do not borrow old green.

**Warning about local reproduction:** The founder's available sparse Windows checkout omits some `docs/phase-*` and `supabase/tests/**` inputs. Running strict Phase4 check there additionally reports *missing* paths, which is not the same as the full GitHub checkout's stale-output root cause. For authentic generator results use an adequately complete clean source checkout/materialized exact inputs (non-destructively). Do not encode sparse omission as a source-deletion proof.
