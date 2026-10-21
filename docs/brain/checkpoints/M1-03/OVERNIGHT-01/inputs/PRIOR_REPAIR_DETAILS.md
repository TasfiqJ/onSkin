# Carried-forward mandatory repairs

These semantic limits and exact identities are unchanged; new iteration/path are OVERNIGHT-01.

## 1. Exact native mapping and generated outputs

Recheck the current whole-lock SHA-256 `7a98ddc5ba1ac26e0fa0682b0681de4502c2e5dd85630cdbc691e535f07be77c`. Prove that mapped Google Sign-In, expo-image, React Native and Hermes lock entries and installed native source pins are unchanged from `c14a3105640034a9d7a47d34533f9bd40faa4cc4`. Change only the three `lockIntegrity.packageLockSha256` values from the old lock digest to the current one.

Use the unchanged native audit generator with `--write --strict`, then `--check --strict`. Both generated audit files are authorized. Match all three expected postimage hashes in `NATIVE_AND_FIXTURE_BINDINGS.json`. Preserve mapping versions, artifact integrity, source pins, Apple baseline and admission statuses. Investigate unexpected postimages rather than updating pins until checks pass.

Run applicable postinstall, native source, archive and verification-wiring checks, plus stale-one-hash and unrelated-native-drift controls. Regenerate only the two authorized source-worklist outputs through the unchanged generator when needed. Preserve fourteen meanings and 414 reference identities. This is source binding, not a native build or archive review.

## 2. Self-contained historical SBOM fixture

The active suite has 27 passes and one failure because an immutable historical packet is paired with the current lock. Preserve the old packet and production validator. Derive the exact `c14a3105640034a9d7a47d34533f9bd40faa4cc4:package-lock.json` Git blob into the one authorized gzip fixture. Its raw and compressed sizes/hashes and deterministic compression method are in `NATIVE_AND_FIXTURE_BINDINGS.json`.

Update only historical fixture loading and regressions in `workflow_contract.test.mjs`. Check compressed/raw hashes and raw size. Preserve every original test. Add rejection of the historical packet paired with the current lock, missing/corrupt fixture negatives, and proof that tests work without Git or historical objects at runtime. Do not use the earlier inert runtime `git show` proposal, change frozen archives, add a production fallback to an old lock, weaken expiry/unknown checks, or change current dependencies. Brain's private candidate passed 29 tests; implement and measure your own committed candidate.

## 3. Exact evidence recovery and publication enforcement

Read `EVIDENCE_PUBLICATION.md`. Twelve logs were ignored and not committed, despite all 829 local hashes matching. Recover only the listed safe, unchanged 485,093 bytes at their original paths. Record original execution, omission from H and the later recovery commit. Preserve old reports and issuance. Force-add only these twelve exact paths after content review; do not change global ignores, force-push or regenerate logs to mimic old executions.

Add an anchored OVERNIGHT-01 guard in `m103_profile.py`: every declared artifact must exist as a matching regular committed Git blob at delivery HEAD. Matching ignored or untracked local files must fail. Preserve existing measurement and authority rules. Test missing/ignored/untracked artifacts, mismatched committed blobs, local-only matches, wrong source/branch/digest, expiry extension and false authority. Verify the actual pushed report in a fresh clone without ignored-file overlays. Recovery must not be described as retroactive publication.

