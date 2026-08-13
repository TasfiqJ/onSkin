# OPT-209 Supported Import And Artifact Comparison

- Date: 2026-07-17
- Checkpoint parent: `523eacc077ff7e078b4106e76896d9f342d94e35`
- Baseline and candidate: same dirty worktree except the candidate's Sentry Metro option
- Candidate: `getSentryExpoConfig(projectRoot, { includeWebReplay: false })`

## Result

| Platform / metric | Baseline | Candidate | Delta |
| --- | ---: | ---: | ---: |
| iOS Hermes bundle | 10,858,809 B | 10,623,734 B | -235,075 B (-2.1648%) |
| iOS bundle gzip | 4,672,068 B | 4,549,060 B | -123,008 B (-2.6328%) |
| iOS bundle Brotli | 3,647,926 B | 3,539,544 B | -108,382 B (-2.9711%) |
| Web JavaScript | 6,881,856 B | 6,742,247 B | -139,609 B (-2.0287%) |
| Web JavaScript gzip | 1,774,554 B | 1,730,619 B | -43,935 B (-2.4758%) |
| Web JavaScript Brotli | 1,370,574 B | 1,336,378 B | -34,196 B (-2.4950%) |

The iOS module count changed from 2,835 to 2,834 and the web client count from 2,605 to 2,604. Assets, ten web JavaScript bundles, and all 83 static routes remained present. A string probe of the Hermes bytecode found four `rrweb` markers before and zero after; `FeedbackWidget` markers remained three in both artifacts, so this result is specifically replay exclusion rather than broad Sentry removal.

## Package Surface Review

- `@sentry/react-native` 7.11 documents `includeWebReplay` on its public Metro configuration type and implements `false` through its resolver. Runtime documentation still recommends the package root; no private runtime path was adopted.
- `react-native-purchases` 10.4.1 maps `main`, `module`, `browser`, and `react-native` to the same `dist/index.js` and publishes no runtime subpath map. The application already uses the documented default root import behind one dynamic import; all top-level SDK references are type-only.
- Expo Router 56.2.14 documentation recommends named imports from `expo-router`. Runtime imports already follow that contract. The sole internal build-path type import was changed to the public SDK 56 `expo-router/js-tabs` surface; because it is type-only, no artifact-size claim is attached to that cleanup.

## Evidence Files

- `baseline-ios-stats.json` / `baseline-ios-stats.md`
- `no-web-replay-ios-stats.json` / `no-web-replay-ios-stats.md`
- `baseline-web-stats.json` / `baseline-web-stats.md`
- `no-web-replay-web-stats.json` / `no-web-replay-web-stats.md`
- `comparison.json`

The raw export directories are intentionally not committed because the compact statistics and comparison retain the required byte evidence without adding approximately 40 MB of generated artifacts.
