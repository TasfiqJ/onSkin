# Task: QUALITY-RECOVERY-03 — finalize mobile SDK57 patch compatibility

## A. Exact source work

Under the new `M103-QUALITY-RECOVERY03-SOURCE-EDIT-01` interval, change ONLY mobile manifest `expo-notifications` from `~57.0.23` to `~57.0.24`; preserve installed Expo `~57.0.31`, Expo Network `~57.0.3`, `@expo/ui ~57.0.26`, router `~57.0.29`, sharing `~57.0.24`, widgets exact `57.0.27`, React Native `0.86.3`, root package manifest, all application and native source. Verify official registry metadata/SRI and complete tarball provenance. `UPSTREAM_NOTIFICATIONS_WITNESS.json` supplies a Brain-observed reference, not substitute for independent verification. Rebuild `package-lock.json` through npm 11.20.0 from exact current source. Inspect each lock-entry/peer/optional/transitive diff, preserve real integrity/registry identity and unchanged install scripts. Do not hand-edit lock entries, add overrides or exclusions, run broad `expo install --fix`, or upgrade the Expo/RN major.

If the actual official **mobile-app** Expo check reveals any other incompatibility, or npm source/SRI provenance is wrong, record the precise BLOCKER after no more than two meaningful bounded approaches. Never weaken package tests or fabricate green. The specific command must execute from `apps/mobile`: `npx --no-install expo install --check` (or the exact equivalent installed Expo CLI from that working directory). Run Expo Doctor against the mobile app as well.

## B. Privacy and native provenance, conditional

After the new lock is final, re-verify the three existing mapped native package identities: Google Sign-In, expo-image, and react-native/Hermes; all four exact mapped lock package-entry paths, versions and integrity fields; and all ten installed source-pin SHA256 bytes. They MUST match the previous immutable mapping. Only if every witness is unchanged, replace exactly the THREE `lockIntegrity.packageLockSha256` fields in `docs/phase-9/ios-sdk-package-mapping.json` with the new real full-lock SHA256. All other mapping fields remain identical to the base. Do not modify widget installer or native Swift, `scripts/phase9/ios-privacy-contract.mjs`, privacy baseline, any source-pin bytes, `evidenceLevel=source_candidate`, `archiveRequired=true`, missing Podfile/archive claims, or reviewer signoffs.

Regenerate only the two canonical generated iOS privacy audit outputs through the original producer; ensure strict read-only check/tests are green. This binds SOURCE provenance, not archive/device/privacy qualification.

## C. Versioned governance and phase worklist

Build new immutable `QUALITY-RECOVERY-03` profile, retaining exact predecessor QR02/QR01 intervals as historical fixed endpoints and preserving negative guards. One source edit allowance only: current stage base + exact issued preimages + finite additional changes. Add at least six genuinely adverse tests (wrong base/branch, protected changes, altered bytes/issued manifest, out-of-scope source edit then reverted commit, forbidden new accepted task/GO/expiry, report forged acceptance or source evidence). No merging older permissions, weakened old validators, self-acceptance or mutation of previous checkpoints. Preserve 47 tasks/27 modules/51 previous ADRs.

Generate Phase4 source worklist outputs only with original canonical generator from a clean measured source. The first dirty exploratory state must not be relabeled clean. Both output files may be changed only as producer-derived records.

## D. Evidence and stopping

Run every test in `05_TEST_AND_ACCEPTANCE.md` with actual exit code and source SHA/tree. Preserve original Security errors and owner status without editing `scripts/phase9/security_acceptance/**`, policy/exception files, scanners/rules/workflows or expired authorizations. Original SBOM test fixture errors are genuine and should be recorded. Preserve canonical ECR acquisition refusal without substitution or paid retries. Commit and push only safe changes to stage; stop after independently auditable evidence, PR9/CI inspection and handoff to Brain. No full M1 acceptance, M2, `main`, or release.
