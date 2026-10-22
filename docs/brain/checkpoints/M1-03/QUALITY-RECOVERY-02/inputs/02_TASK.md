# Exact engineering task

## Target
Close the remaining feasible Expo SDK57 **source-only compatibility** blockers on existing stage, while preserving original owner-controlled Security and DB red gates. Source edits are limited by `SOURCE_EDIT_AUTHORIZATION.json`, SHA256/Git blob preimages and implementation-specific restrictions. No union with QUALITY-RECOVERY-01 or other past grants.

### A — Four legitimate SDK patch resolutions
From `apps/mobile/package.json` at `b74c0efa23828bcdaa3fbe49e43177dcc69331b9`, change *only*:

- `@expo/ui` `~57.0.25` → `~57.0.26`;
- `expo-router` `~57.0.28` → `~57.0.29`;
- `expo-sharing` `~57.0.23` → `~57.0.24`;
- `expo-widgets` exact `57.0.26` → exact `57.0.27`.

Only take these version updates if authenticated installed SDK57 `expo install --check` independently confirms, npm official registry resolves them, and their actual lock graph can be regenerated legitimately. Preserve expo57.0.31, expo-network57.0.3 and React Native0.86.3; no major jump, overrides, exclusion, bypass or broad install/lock refresh unrelated to these patches. Regenerate `package-lock.json` with reviewed npm, preserve integrity URLs and inspect whole nested dependency delta. Require clean `npm ci` and zero cache-skipped tests; do not hand-edit lock data.

### B — Native widget provenance, **no native payload rewrite**
Read `04_UPSTREAM_WIDGET_EQUIVALENCE.md`, `UPSTREAM_WIDGET_WITNESSES.json` and existing `scripts/phase5/patch-expo-widgets-lifecycle.mjs`, current 11 reviewed payload hashes and native tests. Acquire *only* official `expo-widgets@57.0.27` tarball/SRI via normal reviewed npm registry, independently verify 10/10 native upstream target bytes match the frozen `original` descriptors; custom eleventh is absent upstream as designed. The existing `scripts/phase5/expo-widgets-57.0.26/` payload is an immutable source-equivalent patched payload and **MUST NOT BE EDITED OR COPIED**. Change only package provenance constants for version, official tarball URL and integrity (existing target hashes/guard code/payload path unchanged). If even one native source differs or a guard requires editing, STOP this track for a new Brain issuance: no guessed Swift change, fake hash or disable postinstall check.

### C — Narrow iOS privacy evidence rebind
After final lock is created, rehash every `lockIntegrity.entries[]` for the three mapped packages against their unchanged **version + integrity**, and rehash all `notes.sourcePins[]` installed sources. Prove mappings' baseline, Apple matches, notes, `evidenceLevel=source_candidate`, absent Podfile/archive/manifest inventories and `archiveRequired` remain byte-equivalent. Only if **all** exact witnesses match may the three `lockIntegrity.packageLockSha256` strings be changed to the *final true whole-lock SHA* in `docs/phase-9/ios-sdk-package-mapping.json`. No mapping creator, audit validator or native release policy change. Reproduce real privacy audit and canonical regenerated derived JSON/Markdown. Do not claim source candidate equals compiled archive/physical device evidence. Any mapped source or lock entry drift invalidates this allowance.

### D — Clean governed evidence and external gates
Append one disjoint QR02 exact-source profile and 6+ adversarial cases (wrong head/branch, old interval, unauthorized source, stale preimage, old native hashes changed, fake mapping, false Security/DB/acceptance, extra writer/expiry, artifact tamper). Preserve prior 77 tests and all old refusals. Re-run `postinstall`, widget native lifecycle tests, iOS privacy checks, official Expo check/Doctor, forced 6,067 root/type/lint, unchanged original secret fixtures, original Security contract tests and strict report/worklist, documenting actual failures. For original Security, do not refresh original `scripts/phase9/security_acceptance/**`, original policy, frozen source manifests/owners or exception handling. Capture a **sanitized exact-source mismatch report** for qualified Security custodian review. Never pass a synthetic vector as original source green.

### E — Stop/delivery
Keep PR9 draft/unmerged; on completion normally PUSH safe commits to existing stage, no force, no main merge. Capture exact implementation source/tree, measured source/tree, evidence-only tail, final stage SHA/tree, separate final-head Quality/Security/iOS run+job outcomes (including pending if truly pending), raw exits and hashes. Make strict `completion-report.json`, SHA256SUMS, README/RESULTS/BLOCKERS and truthful root handoff. Source-only accepted remains **pending Brain**. Stop and hand back; no M2, hosted replay, sign/TestFlight/deploy/clinical/provider activity.
