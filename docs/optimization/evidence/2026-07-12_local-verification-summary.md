# Local Optimization Verification Summary

Date: 2026-07-12 (America/Toronto)
Branch: `optimization`
Baseline/current HEAD: `fc5d512f7e0ccbab8d3b5a2beb4268dd8a24595f`
Build state: dirty worktree; pre-existing user changes were preserved

This content-free summary records local code and web-compatible behavior checks. It is not a signed native artifact, physical-device performance result, staging deployment, production result, or release approval.

## Reproducible Export Baseline

Direct production Expo exports and `scripts/optimization/export-stats.mjs` completed for both platforms.

| Platform | Hermes bundle | Export bytes | Gzip bytes | Brotli bytes | Fonts | Font bytes |
| -------- | ------------: | -----------: | ---------: | -----------: | ----: | ---------: |
| iOS      |     8,163,624 |   29,889,365 |  3,412,102 |    2,642,407 |    34 |  3,328,116 |
| Android  |     8,346,380 |   31,323,718 |  3,503,996 |    2,709,052 |    35 |  4,284,532 |

The reports are:

- `2026-07-12_phase0_ios_dirty-worktree_export-stats.json` and `.md`
- `2026-07-12_phase0_android_dirty-worktree_export-stats.json` and `.md`

Android includes one additional Material Symbols font of approximately 956 KiB. These values are diagnostic baselines only; no absolute or regression budget is approved.

### Minimal-font current-worktree comparison

After native embedding was configured for the eight intentional faces, the production Expo export comparison recorded:

| Platform | App font assets removed | App font bytes removed | Total export change | Hermes change |
| -------- | ----------------------: | ---------------------: | ------------------: | ------------: |
| iOS      |                      34 |              3,328,116 |          -3,400,335 |       -25,124 |
| Android  |                      34 |              3,328,116 |          -3,363,348 |       -10,972 |

iOS now carries no app-family fonts in the JavaScript export. Android retains only the unrelated 956,416-byte Material Symbols asset. Native config embeds eight app faces totaling 675,112 bytes, but the signed native-binary net remains unmeasured. Current reports use the `2026-07-13_OPT-106_*_dirty-worktree_font-export-stats` names.

## Focused Code Verification

The following local checks passed:

- export-statistics analyzer smoke, including deterministic output, safe relative paths, compression statistics, font grouping, and self-contaminating input rejection;
- deterministic empty/median/stress fixture smoke;
- six mobile test files and 46 tests covering private-KV timing, bounded operation timing, sensitive-image cache policy/lifecycle purge, the `PhotoImage` source contract, and account-isolation purge;
- Edge Function manifest check and negative-fixture smoke;
- rate-limit cleanup-index smoke;
- Phase 9 Edge Function Deno checks;
- Phase 9 data-rights smoke;
- eight Deno tests covering 1,205-row database pagination, 1,205-object storage pagination, truncation, unstable inventory, count changes, duplicate ordering keys, canonical checksums, and bounded concurrency.

The data-rights smoke retained its expected warning that live data export/delete evidence is absent.

## Human-Simulated Web E2E

The Progress sensitive-image boundary was exercised in Expo web at a 390-by-844 viewport with deterministic populated fixtures:

1. The unlocked Progress surface displayed two photo frames.
2. Enabling the app-wide lock removed all private images and private timeline-count copy.
3. Returning to the unlocked fixture restored both images.
4. Controls observed in the flow met the 48-point minimum target.
5. No flow-specific browser errors were observed.

Local evidence lives under `test-results/human-e2e/2026-07-12/optimization-sensitive-image-cache/`. That test-results directory is intentionally not treated as committed native evidence.

## Verification Boundary

- Web E2E does not prove SDWebImage, Coil, iOS/Android cache-directory contents, native decoded-memory release, camera staging cleanup, Keychain/Keystore behavior, or backup exclusion.
- The exports were created from the dirty working tree and are not signed release artifacts.
- No thresholds or signoff owners have been approved.
- No Supabase function or migration was deployed, and no live provider credential was used.
