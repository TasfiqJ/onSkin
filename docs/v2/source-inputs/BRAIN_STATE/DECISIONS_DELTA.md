# Brain delta — M0-01 review / M0-02 issue

Recorded 2026-10-20T04:11:45+00:00.

- M0-01 accepted at `b9a6b093f392ced340c156f2e7dcaefc72ed58e1` **only for diagnostic truth, one fail-closed regression test and the sanitized checkpoint**. Baseline Quality/Security remains blocked; there is no G97 source GO, integration/replay/merge/release authority.
- Final Quality39366256422 and Security39366256806 failed. iOS39366256375 passed only its source contract. All are attached to the final stage head; the temporary PR checkout has the same tree.
- Retain the ECR acquisition blocker, frozen source inventory/custody restriction, expiry, and the additional OSV date/advisory refusals as separate open blockers.
- ADR-023 authorizes only independent non-runtime M0-02; ADR-024 requires a fresh Codex planning/tooling instance on the same M0 branch. No implementation sequencing or clinical/spend policy is otherwise changed.
- Commit this approved sanitized review/state under `docs/brain` during M0-02. Preserve prior records; Codex may append observations and submissions but cannot self-accept.
- All 47 roadmap IDs/dependencies and all 27 module ordering/dependencies are unchanged. No future research pack is requested.
