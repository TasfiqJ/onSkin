# Independent readiness and downstream source-provenance issue

At clean PR13 final HEAD:
```
node scripts/docs/readiness-status-audit.mjs --strict --check
FAIL docs/generated/readiness-status-audit.json is stale. Run npm run docs:readiness-status-audit:strict.
FAIL docs/generated/readiness-status-audit.md is stale. Run npm run docs:readiness-status-audit:strict.
FAIL Readiness status audit inputs drifted during check mode.
```

This is NOT proven to be a harmless stale pair. The unchanged producer enforces a pinned Git HEAD snapshot, exact source input inventory/`headSha`, governed evidence-chain bindings, clean zero-output-excluded status, mobile test inventory, and atomic publication. The drift message comes from `verifyReadinessStatusSnapshot(sourceSnapshot)`, `inventoryStabilityErrors()`, or `governedEvidenceChainStabilityErrors()` just before final `--check` exit. Diagnose WHICH invariant fails on a clean pinned source; do not delete/ignore the condition. A further generated pair or provenance chain may need a separately scoped block. In CI PR merge refs may differ from branch HEAD; don't use merge-ref tricks or blind hash rotation to call it PASS.

Current exact candidate: `docs/generated/readiness-status-audit.json` and `.md` may be regenerated only by the actual producer. Original `scripts/docs/readiness-status-audit.test.mjs` has 33 passing controls on Release09 according to receipts, and `scripts/launch/governed-publication-coverage.test.mjs` has 6. Do not weaken them. Original `scripts/docs/readiness-status-audit.mjs`, `scripts/launch/governed-evidence-chain.mjs`, `scripts/launch/governed-publication-coverage.mjs`, `scripts/phase9/**`, `.github/**`, and the launch contract remain READ-ONLY by default. A surgical change to the readiness producer and paired existing readiness test is **conditionally authorized** ONLY if you independently demonstrate a genuine deterministic bug (not a missing signoff or expected dirty-tree defense) and prove new negative cases preserve all old safeguards. If not proven, leave script immutable and report `BLOCKED_OUTSIDE_SCOPE` with exact additional paths; still finish independent worklist task.

IMPORTANT NEW INTERACTION: Release09 `scripts/release/full-app-j01/check.py` currently pins a finite path allowlist from Release08 through Release09 HEAD. New worklist/readiness writes will legitimately violate that OLD current-tail constraint unless you add a separate, narrowly verified Release10 segment. Preserve the existing Release09 exact segment, all prior checks and historical evidence; conditionally adapt only the source-scope logic in the new live checker, not the immutable Release09 checkpoint. Prove unchanged original semantic validator functions and all 151 negatives.

Full legacy `scripts/launch/contract.mjs` and dozens of read-only consumers still interpret Lean V1; do not switch them or invent completed features. Prepare a machine-readable/unapplied consumer map and concrete next roadmap sequence without writing their sources.
