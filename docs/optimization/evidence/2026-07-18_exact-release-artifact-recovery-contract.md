# Exact-Release Artifact Recovery Contract

Date: 2026-07-18 (America/Toronto)

Implementation SHA: `95221abb74f602c1b9f00babf43cd22e368faf9a`

Branch: `optimization`

## Outcome

Phase 9 now has a fail-closed local contract that binds one clean commit and one iOS EAS build to its Phase 5 performance evidence, signed IPA identity, App Store provisioning material, complete Mach-O inventory, canonical dSYM DWARF inventory, external Hermes source map, Sentry release/dist, upload receipt, and provider-retrieved JavaScript/native recovery events.

This is release-gate implementation evidence. It is not a claim that a real signed candidate, live Sentry recovery exercise, physical-device performance packet, or launch signoff already exists.

## Enforced invariants

- `release-artifacts.json` has an exact versioned schema and must match the clean Git SHA, RC manifest, EAS build, app version/build/runtime, Apple team, Sentry release/dist, and every attached digest.
- The macOS inspector checks every shipped Mach-O/fat file and rejects an empty or unparseable `dwarfdump` UUID result.
- Root and `.appex` signatures must satisfy Apple generic-anchor, WWDR, iOS Distribution, certificate-team, and exact-bundle requirements.
- Embedded profile CMS signatures are evaluated with the object-signer trust policy; profile expiry, App Store shape, team/app identity, debugger prohibition, and entitlement coverage must match every signed bundle.
- dSYMs are accepted only from canonical `.dSYM/Contents/Resources/DWARF/` files with non-empty `__debug_info` and `__debug_abbrev` sections; their UUIDs must cover every shipped binary UUID.
- The exact external Hermes map must be valid JSON with a UUID debug ID. Named, inline, indexed, structurally recognizable, gzip, zlib, and Brotli source maps are rejected from the IPA; inspection ceilings fail closed.
- Live Sentry verification retrieves two distinct recent events, matches release/dist, requires exact debug-ID source-map status, and rejects symbol/source-map errors.
- Native recovery uses only provider top-level debug metadata. Both instruction and symbol addresses must fall inside an exact app image; image-plus-offset fallbacks are rejected.
- Sentry must report a `macho` debug-information file with the `debug` feature for every exact binary UUID.
- Provider payloads stay in memory. Committed evidence is content-free and rejects URLs, paths, credentials, contact data, and raw diagnostic fields.
- Android is exactly `not_applicable` under the active iPhone-only contract and fails until a versioned Android branch exists if the launch contract reactivates Android.
- Any Phase 9 evidence/signoff claim requires every artifact and receipt, direct macOS inspection, live provider recovery, a clean immutable RC folder, and strict release smoke. The QA packet cannot become ready while release-smoke warnings remain.

## Verification

- `node scripts/phase9/release-artifact-contract-smoke.mjs`: pass, 1 positive and 22 negative cases.
- `node scripts/phase9/ios-artifact-inspection-smoke.mjs`: pass.
- `node scripts/phase9/sentry-recovery-verification-smoke.mjs`: pass, 1 positive and 17 negative cases.
- `node scripts/phase9/release-smoke.mjs`: code gates pass; expected external release values/evidence remain warnings.
- QA packet ordinary mode: exit 0 with explicit incomplete-evidence warnings.
- QA packet with one claimed Phase 9 evidence flag and no exact artifacts: exit 1 with ten fail-closed blockers.
- Root typecheck: pass, two workspaces.
- Root lint: pass, two workspaces, zero warnings.
- Root tests: pass, 345 files / 4,102 tests.
- Prettier and `git diff --check`: pass.

Three independent review passes targeted false positives. The final pass found no remaining fail-open path in the bounded Apple signature/profile, dSYM, source-map, Sentry recovery, or QA-packet contract.

## External closure boundary

The following still require real external authority or artifacts:

- a clean signed App Store/TestFlight IPA plus matching dSYM and Hermes map on macOS;
- live Sentry upload and distinct JavaScript/native recovery event IDs;
- a complete Phase 5 performance evidence file from that exact EAS build;
- the immutable customized RC packet and named signoff; and
- the exact section 19 launch-readiness link and digest.

`LAUNCH_READINESS.md` was not changed because its current worktree edits belong to the user and no real signed packet exists to link.
