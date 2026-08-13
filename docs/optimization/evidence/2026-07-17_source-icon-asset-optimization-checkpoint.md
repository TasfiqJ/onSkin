# OPT-210 Source Icon And Asset Optimization Checkpoint

Date: 2026-07-17 (America/Toronto)

Parent SHA: `c3656e0e1b9d5033bf7485ee3afa863d8e6f0381`

Status: `implemented`; visual fidelity is proven exactly, while signed-artifact
size evidence and final cleared artwork remain external release gates.

## Outcome

The seven PNG files referenced by the resolved Expo app configuration were
losslessly recompressed. Their combined source size fell from 957,617 to
888,877 bytes: **-68,740 bytes (-7.1782%)**.

The implementation deliberately changes only the PNG `IDAT` compression
stream. Decoded scanlines remain byte-identical, and every other PNG chunk,
including `sRGB`, gamma, physical-resolution metadata, ordering, and CRCs,
remains byte-identical. This is an exact visual comparison rather than a
perceptual-similarity estimate.

## Source Results

| Configured source                    |        Before |         After |         Delta | Decoded pixels    |
| ------------------------------------ | ------------: | ------------: | ------------: | ----------------- |
| `images/icon.png`                    |     799,005 B |     740,396 B |     -58,609 B | identical         |
| `images/splash-icon.png`             |       3,317 B |       3,017 B |        -300 B | identical         |
| `images/android-icon-foreground.png` |      78,796 B |      76,689 B |      -2,107 B | identical         |
| `images/android-icon-background.png` |      17,549 B |      17,066 B |        -483 B | identical         |
| `images/android-icon-monochrome.png` |       4,140 B |       3,944 B |        -196 B | identical         |
| `images/favicon.png`                 |       1,129 B |       1,065 B |         -64 B | identical         |
| `expo.icon/Assets/grid.png`          |      53,681 B |      46,700 B |      -6,981 B | identical         |
| **Total**                            | **957,617 B** | **888,877 B** | **-68,740 B** | **7/7 identical** |

`scripts/optimization/optimize-png-assets.mjs` owns an exact allowlist of these
configured sources and supports two explicit modes:

- `--write` applies only verified smaller zlib streams;
- `--check` fails when any allowlisted file still has removable lossless bytes.

The companion smoke test covers pixel-stream preservation, non-`IDAT` chunk
preservation, deterministic output, idempotence, invalid signatures, and
truncated inputs. It has no image-library dependency.

## Production Export Comparison

The candidate passed fresh iOS and web production exports. The previously
captured OPT-209 candidate is the controlled baseline: the working tree and
Sentry replay exclusion are the same, and only these source PNGs plus tooling
outside the Metro graph differ.

| Surface                     | Baseline assets | Candidate assets | Attributable asset delta |
| --------------------------- | --------------: | ---------------: | -----------------------: |
| iOS Expo production export  |   23 / 23,136 B |    23 / 23,136 B | 0 B; manifests identical |
| Web Expo production export  |  26 / 695,373 B |   26 / 695,373 B | 0 B; manifests identical |
| Generated web `favicon.ico` |        14,510 B |         14,510 B |   0 B; SHA-256 identical |

The full export totals changed by -1 byte on iOS and -902 bytes on web, but the
configured image outputs and exported asset manifests did not change. Those
small bundle deltas are not attributed to PNG recompression.

This is expected: Expo treats configured icons and splash images as build
inputs, and native resources are normalized/compiled during prebuild and native
build. Expo's documentation likewise says static assets are embedded in the
native binary and recommends lossless image optimization where pixels must not
change. See [Splash screen and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
and [Assets](https://docs.expo.dev/develop/user-interface/assets/).

## Honest Acceptance Boundary

OPT-210 names `signed artifact/visual comparison` as acceptance evidence.

- Visual comparison: complete at exact decoded-pixel equality for all seven
  changed sources.
- Signed artifact: unavailable. A production-signed IPA cannot be generated in
  this Windows workspace, and production signing/identity gates are not
  satisfied. No download-size or installed-size claim is made.
- Final artwork: unavailable. The current sources still contain the Expo
  scaffold mark (`expo-symbol 2.svg` and its grid), while `RoutineKind` remains
  a provisional engineering identity pending the recorded founder/counsel and
  reservation gates. Lossless optimization does not convert placeholder art
  into launch-approved branding.

After the final cleared icon set replaces these files, rerun the optimizer,
visual/device matrix, and signed-IPA comparison. Expo's SDK 56 configuration
reference supports the current `.icon` directory path under `ios.icon`; no
unsupported native asset-catalog edits were made. See the
[SDK 56 app configuration reference](https://docs.expo.dev/versions/v56.0.0/config/app/).

## Verification

- `node scripts/optimization/optimize-png-assets-smoke.mjs` — PASS.
- `node scripts/optimization/optimize-png-assets.mjs --check --json` — PASS;
  zero further removable bytes.
- Direct `git show HEAD:<asset>` baseline comparison — PASS; seven identical
  decoded scanline streams, total -68,740 source bytes.
- `npx expo config --type public --json` — PASS; all seven paths are active in
  the resolved configuration.
- Focused source-asset contract — 1 file / 1 test PASS.
- Full root tests — 325 files / 3,961 tests PASS.
- Root typecheck — 2 workspaces PASS.
- Root lint — 2 workspaces PASS with zero warnings.
- `npx expo export --platform ios --clear` — PASS.
- `npx expo export --platform web --clear` — PASS; 83 routes retained.

Compact evidence:

- `test-results/optimization/2026-07-17/opt210/source-comparison.json`
- `test-results/optimization/2026-07-17/opt210/artifact-comparison.json`
- `test-results/optimization/2026-07-17/opt210/candidate-ios-stats.json`
- `test-results/optimization/2026-07-17/opt210/candidate-web-stats.json`
- `test-results/optimization/2026-07-17/opt210/report.md`
