# Source-Map Group Attribution Checkpoint

Date: 2026-07-25
Scope: OPT-120 release-export reporting
Status: local implementation complete; signed-native artifact budgets and historical deltas remain open

## Outcome

`scripts/optimization/export-stats.mjs` now fulfills the source-map portion of the plan's “largest 50 modules or source groups” requirement. Schema version 2 keeps the existing bundle, map, asset, font, and largest-file fields and adds deterministic source-content attribution for the largest 50 privacy-safe groups.

The analyzer:

- requires complete one-to-one bundle/external-map coverage;
- accepts the current flat Metro source-map v3 shape and fails closed on missing, stale, indexed, malformed, oversized, or content-free maps;
- decodes and validates v3 VLQ segments, source/name indices, and cumulative positions, then requires every attributed source to be referenced by mappings;
- counts every source occurrence and UTF-8 `sourcesContent` byte, while reporting a separate content-bound unique-source count;
- groups checked-in dependencies only through the `package-lock.json` allowlist;
- emits fixed workspace, Metro-polyfill, and unattributed categories;
- never emits raw source paths, source roots, host/home/drive names, query hashes, source text, or internal fingerprints;
- reports the top 50 groups plus exact reported/omitted group and byte totals;
- preserves `largestFiles` for schema-v1 consumer continuity.

Mapped source-content bytes identify investigation targets. They are not generated JavaScript, Hermes bytecode, download, installed, or runtime-memory bytes.

## Fresh Current-Head Export Results

Both exports were regenerated after the Expo SDK 56 dependency alignment with external source maps and an empty Metro cache.

| Platform | Metro modules | Hermes bytes | Gzip bytes | Brotli bytes | External map bytes | Source-content bytes | Groups | Unattributed sources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| iOS | 2,862 | 8,910,488 | 3,713,269 | 2,854,010 | 19,887,727 | 14,293,595 | 124 | 0 |
| Android | 2,953 | 9,109,508 | 3,807,073 | 2,945,444 | 20,209,951 | 14,554,357 | 128 | 0 |

The iOS export contained 23 non-font assets totaling 23,136 bytes. The Android export contained 27 assets totaling 984,762 bytes, including the already-tracked 962,012-byte Material Symbols font. Native app fonts are embedded by the Expo config and therefore do not appear as iOS Metro assets.

The largest fresh iOS groups are:

| Group | Sources | UTF-8 source-content bytes |
| --- | ---: | ---: |
| `npm:react-native` | 439 | 2,423,334 |
| `workspace:mobile/features` | 249 | 1,474,581 |
| `npm:expo-router` | 377 | 1,221,403 |
| `workspace:mobile/app` | 94 | 1,053,549 |
| `npm:react-native-reanimated` | 287 | 891,499 |
| `npm:@sentry/core` | 176 | 783,085 |
| `npm:@revenuecat/purchases-js-hybrid-mappings` | 1 | 749,392 |
| `workspace:mobile/lib` | 98 | 592,784 |
| `npm:@sentry/react-native` | 107 | 422,446 |
| `npm:@supabase/auth-js` | 18 | 412,467 |

These results preserve the plan's measured dependency investigations while making them reproducible and content-free.

## Verification

Passed:

```text
node --check scripts/optimization/export-stats.mjs
node --check scripts/optimization/export-stats-smoke.mjs
node scripts/optimization/export-stats-smoke.mjs
npx prettier --check scripts/optimization/export-stats.mjs scripts/optimization/export-stats-smoke.mjs
npm run typecheck
npm run lint
npx expo export --platform ios --source-maps external --dump-assetmap --clear
npx expo export --platform android --source-maps external --dump-assetmap --clear
node scripts/optimization/export-stats.mjs ... # fresh iOS export
node scripts/optimization/export-stats.mjs ... # fresh Android export
```

The smoke covers:

- scoped/unscoped lockfile-approved packages and unknown-package redaction;
- fixed mobile/workspace/virtual/unattributed groups;
- Windows, webpack, file-URL, URI, absolute, relative, and query-suffixed sources;
- exact Unicode UTF-8 bytes;
- duplicate occurrence versus unique-source accounting;
- deterministic top-50 ordering and exact omitted totals;
- raw source/content/host/query sentinel non-disclosure;
- missing-map, orphan-map, malformed-map, missing-content, and indexed-map failures;
- zero-source, unmapped-source, and out-of-range source-index failures;
- byte-stable repeated JSON and Markdown output.

The fresh iOS and Android reports also passed an explicit scan for raw Windows home paths, the local username, `sourcesContent`, `sourceRoot`, and private-source sentinels.

The full preserved-dirty-worktree test run remains at 350 passing files / 4,180 passing tests with the same four unrelated user-owned baseline failures: one notification behavioural snapshot and three Shelf metadata/expiry-provenance expectations. No export-statistics test failed.

## Remaining OPT-120 Scope

This checkpoint does not claim OPT-120 verified. The following remain:

- signed IPA/AAB download and installed sizes;
- per-ABI Android size if Android release scope is reactivated;
- merge-base and last-production-tag deltas;
- two clean signed release baselines;
- approved absolute/regression budgets, owners, and signoff.
