# Release Candidates

Create one folder per release candidate, for example `rc-2026-07-04-b001`, by copying `_template`.

Each RC folder must be immutable once signed. If the SHA, native build, env, store metadata, policy URL, catalog, entitlement config, or release channel changes, create a new RC folder.

Set `PHASE9_RELEASE_CANDIDATE_DIR` to the signed folder path, for example `docs/phase-9/release-candidates/rc-2026-07-04-b001`, before setting any `PHASE9_*_PASS=true` value or `PHASE9_SIGNED_OFF_BY`. `phase9:release-smoke` rejects dirty Git worktrees, `_template`, missing RC files, RC files that are still identical to `_template`, any RC file that still contains `TBD` or `BLOCKED`, and manifests whose `Git SHA` does not match the commit being verified.

The folder's `release-artifacts.json` must also pass the [exact-release artifact evidence contract](../release-artifact-evidence.md). Raw binaries, dSYMs, source maps, and minimized attachment files stay outside Git; the immutable RC folder keeps only their hashes and content-free identifiers.
