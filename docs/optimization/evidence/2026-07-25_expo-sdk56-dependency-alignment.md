# Expo SDK 56 Dependency Alignment

Date: 2026-07-25 (America/Toronto)

Branch: `optimization`

Baseline SHA: `85eab193db9bf463370ea8d89987bdd41c529f09`

Evidence class: dependency, command, production export

## Finding

A fresh `npx expo-doctor` run passed 20 of 21 checks and failed Expo dependency compatibility. Twelve Expo packages and `react-native-screens` were below the exact SDK-56 compatibility ranges reported by Expo. This contradicted the dependency-lifecycle gate and the older 21/21 snapshot.

The mobile manifest and lockfile were clean before this slice. The user-owned root `package.json` changes contain unrelated Phase 2/9 scripts and were preserved.

## Implementation

The mobile manifest now uses Expo's expected compatible ranges:

- `expo` 56.0.17;
- Router 56.2.16 and React Native Screens 4.26;
- current SDK-56 patch releases of build-properties, constants, dev-client, image-manipulator, linking, local-authentication, notifications, sharing, splash-screen, and web-browser.

The lockfile was regenerated through npm. Compatible transitive updates move:

- `js-yaml` from 4.2.0 to 4.3.0;
- `postcss` from 8.5.16 to 8.5.23;
- `shell-quote` from 1.8.4 to 1.10.0.

Those updates remove every high/critical finding from the production-only audit.

## Verification

| Check | Result |
| --- | --- |
| `npx.cmd expo install --check` | Pass, dependencies up to date |
| `npx.cmd expo-doctor` | Pass, 21/21; expected missing Sentry build-environment warning only |
| Mobile and root type-check | Pass |
| Mobile and root lint | Pass, zero warnings |
| Native/config focused matrix | Pass, 7 files / 59 tests |
| Launch-contract verifier | Pass, iOS-only all-features contract |
| Production iOS export | Pass, 2,862 modules; 10,821,295-byte Hermes bundle |
| Production web export | Pass, 2,621 modules; 83 static routes retained |
| Full preserved-dirty-worktree suite | 350 files / 4,180 tests pass; same four unrelated notification/Shelf failures |

The Phase 5 native-config command still reports two obsolete cloud-backup source assertions from the preserved user-owned script diff; the dependency update did not introduce them. The source-packet check also retains its pre-existing stale generated/source-copy findings.

## Vulnerability Boundary

`npm audit --omit=dev` now reports zero high/critical and 14 moderate findings. They are rooted in the Expo/config-plugin toolchain, including `xcode`'s `uuid@7` dependency. `npm audit fix --dry-run` cannot resolve the graph and advertises incompatible downgrades such as Expo 46 and pre-SDK-56 module versions. No forced downgrade, unsafe override, audit suppression, or unsupported `node_modules` patch was introduced.

Re-evaluate the remaining findings when Expo publishes a compatible config-plugin/xcode chain or during the next controlled SDK upgrade. A signed iOS artifact and native runtime proof remain separate release gates.
