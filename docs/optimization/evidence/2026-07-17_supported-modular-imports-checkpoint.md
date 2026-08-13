# Supported Modular Imports And Artifact Diff Checkpoint

Date: 2026-07-17

Branch: `optimization`

Checkpoint parent: `523eacc077ff7e078b4106e76896d9f342d94e35`

Item: `OPT-209`

## Invariant

Large dependency groups may be reduced only through package-supported configuration or imports, with identical app behavior and a real production export comparison. Do not deep-import private implementation files, patch `node_modules`, remove reliability or subscription SDKs for chart optics, change navigation architecture for size alone, or claim signed-binary savings from a Metro export.

## Supported-Surface Review

### Sentry 7.11.0

The installed public Metro type declares `includeWebReplay?: boolean` and documents its default as true. Its resolver implementation returns an empty module for `@sentry/replay` and `@sentry-internal/replay` imports when the option is false. The existing runtime import remains the package-root namespace form recommended by the [official Sentry React Native repository](https://github.com/getsentry/sentry-react-native).

The current privacy contract prohibits session replay. The application never configures replay sample rates, and its Sentry policy test already fixes tracing, screenshots, view hierarchy, failed-request capture, breadcrumbs, and raw event fields off. Setting `includeWebReplay: false` therefore removes prohibited unused code without removing crash reporting or changing the event scrubber.

The installed 7.11 Metro API does not expose a supported Feedback exclusion flag. Feedback markers remain in the candidate artifact. No private `dist/js` import or SDK upgrade was introduced to remove them.

### RevenueCat 10.4.1

The installed package maps `main`, `module`, `browser`, and `react-native` to the same `dist/index.js`, publishes no runtime subpath map, and the [official React Native installation guide](https://www.revenuecat.com/docs/getting-started/installation/reactnative) documents only `import Purchases from 'react-native-purchases'`.

The application already has the safe shape: runtime loading occurs behind one dynamic package-root import, while top-level `CustomerInfo`, offerings, package, listener, eligibility, offer, and store imports are type-only and erase from the artifact. There is no supported modular RevenueCat candidate to measure or adopt.

### Expo Router 56.2.14

Current Expo documentation recommends named imports from the package root for [Stack](https://docs.expo.dev/versions/v56.0.0/sdk/router/stack/) and the normal Router APIs. The SDK 56 migration guide identifies `expo-router/js-tabs` as the public replacement surface for React Navigation bottom-tab APIs. Runtime route imports already follow the named package-root contract.

The one type-only import from `expo-router/build/react-navigation/bottom-tabs` was a private build path. It now imports `BottomTabBarProps` from `expo-router/js-tabs`. Because the import is type-only, this is a supportability cleanup with no byte claim. Experimental stacks, native tabs, private build paths, and router replacement were rejected as unjustified architectural changes.

Expo's [tree-shaking guidance](https://docs.expo.dev/guides/tree-shaking/) also confirms that ESM imports/exports are optimized in production and that side-effect/CommonJS boundaries constrain removal. Package-root named imports are therefore retained unless an official subpath has a measured benefit.

## Implementation

- Passed `{ includeWebReplay: false }` to `getSentryExpoConfig` with a privacy-contract comment.
- Added a source contract assertion to the Sentry privacy suite so replay packages cannot silently return.
- Replaced the Router private build-path type import with the public `expo-router/js-tabs` type surface and added a tab-bar contract assertion prohibiting `expo-router/build/`.
- Kept Sentry runtime, RevenueCat runtime, and Router runtime imports on their documented public roots.

## Controlled Artifact Method

The baseline and candidate were exported from the same dirty worktree and the same checkpoint parent. Pre-existing user-owned changes were identical in both runs. Each production export used a cleared Metro cache:

```text
npx.cmd expo export --platform ios --output-dir <baseline-or-candidate-ios> --clear
npx.cmd expo export --platform web --output-dir <baseline-or-candidate-web> --clear
```

Only `includeWebReplay: false` differed between the baseline and candidate bundle graphs. The later Router change is type-only and the test changes are outside the production graph. The repository export analyzer measured raw, gzip, and Brotli bundle bytes. Raw exports are not committed; compact generated statistics and the comparison are retained in `test-results/optimization/2026-07-17/opt209/`.

## Actual Artifact Diff

| Platform / metric | Baseline | Candidate | Delta |
| --- | ---: | ---: | ---: |
| iOS Hermes bundle | 10,858,809 B | 10,623,734 B | -235,075 B (-2.1648%) |
| iOS bundle gzip | 4,672,068 B | 4,549,060 B | -123,008 B (-2.6328%) |
| iOS bundle Brotli | 3,647,926 B | 3,539,544 B | -108,382 B (-2.9711%) |
| Web JavaScript | 6,881,856 B | 6,742,247 B | -139,609 B (-2.0287%) |
| Web JavaScript gzip | 1,774,554 B | 1,730,619 B | -43,935 B (-2.4758%) |
| Web JavaScript Brotli | 1,370,574 B | 1,336,378 B | -34,196 B (-2.4950%) |

The iOS module count fell from 2,835 to 2,834 and the web client count from 2,605 to 2,604. Assets were byte-identical, the web export retained ten JavaScript bundles, and all 83 static routes remained present. A UTF-8 string probe of the Hermes bytecode found `rrweb` four times before and zero after; `FeedbackWidget` remained three times in both. The measured reduction is therefore replay-specific rather than removal of Sentry crash diagnosis or Feedback code.

## Deterministic Verification

```text
npm.cmd --workspace apps/mobile test -- \
  src/lib/observability/sentry.test.ts \
  src/features/navigation/tabBar.test.ts \
  src/lib/iap/revenuecat.test.ts \
  src/lib/iap/revenuecat.ownerLifecycle.test.ts
4 files / 11 tests PASS

npm.cmd test
324 files / 3,960 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

iOS production Hermes export
PASS

Web production static export
PASS; 83 routes retained
```

The sandboxed Expo dependency checker attempted a network lookup and failed with an environment `EACCES`; it was not used as acceptance evidence. Package compatibility remains pinned by the repository lockfile, successful TypeScript/tests/lint, and both production exports.

## Result And Remaining Work

`OPT-209` is `verified` against its named proof: an actual artifact diff. The supported Sentry configuration produces a material, privacy-aligned reduction while retaining required crash reporting behavior. RevenueCat and Router were reviewed and left on documented public runtime surfaces because no supported size-reducing modular variant exists in the installed versions.

This is a Metro/Hermes and web-export result, not a signed IPA download/installed-size claim. Re-run the review after an Expo-compatible Sentry upgrade that offers supported Feedback exclusion, after a RevenueCat package-surface change, or after a material Expo Router upgrade. Android-native size remains outside the active iOS-only release scope and is not inferred from the iOS result.

## Rollback Trigger

Rollback or repair if Sentry replay becomes an approved product feature, crash reporting or source-map/debug-ID behavior regresses, the resolver removes non-replay Sentry modules, the 83-route static export changes unexpectedly, a private package path returns, RevenueCat stops lazy-loading, or a clean repeated export no longer reproduces the material reduction.
