# Verified post-merge state and why this task exists

- `main` and new `stage/m1-gate-recovery` start at `d9912f4c8b30358593569c5b9b4e84773c6f463e`; tree `389c2a09b62e78a225a2b41c8a1965a1b0e1ab80`. PR #9 was merged.
- Post-merge Quality run [39833311194](https://github.com/TasfiqJ/onSkin/actions/runs/39833311194) FAILED, but its repository source job, PG15/17 rehearsals, and iOS/Android Expo exports all passed. Canonical original database reset failed pulling `public.ecr.aws/supabase/postgres:15.8.1.085`: `Data limit exceeded`. The original image pin is not substitutable.
- Post-merge Security run [39833311172](https://github.com/TasfiqJ/onSkin/actions/runs/39833311172) FAILED in original code/static/secret/admission jobs. Original G97 source-only proposal expired `2026-10-21T00:00:00Z`; old unreviewed findings, scanner coverage, and SBOM receipt failures are still open. Original technical suite does not grant source GO.
- Post-merge iOS source contract [39833311278](https://github.com/TasfiqJ/onSkin/actions/runs/39833311278) succeeded, but no native device, signing, TestFlight, clinical, or release was admitted.
- Prior Codex already fixed source Expo SDK compatibility and governance (103 checks: 101 pass, two expected Windows-only skips); 6,067 root tests pass. **Do not redo those already completed repairs.**
- Current roadmap: 47 tasks/27 JANUS modules. Accepted roadmap tasks only M0-01/M0-02/M1-01/M1-02. Whole M1-03 remains blocked; M2-01 depends on M1-03.
- `docs/brain/state/*` and `docs/brain/current.json` are historical/approved and may be stale relative to merged source; **do not silently edit or auto-accept them**.

This task is a single *causal remediation experiment*, not a rerun of the previous owner handoff. If no deeper new result is established, report that truthfully and stop.
