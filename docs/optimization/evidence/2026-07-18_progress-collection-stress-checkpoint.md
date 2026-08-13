# Progress Collection Stress Checkpoint

Date: 2026-07-18 (America/Toronto)

Branch: `optimization`

Implementation SHA: `a53cfeca994e242b7e45fd43279909b1d59f2041`

Evidence class: `command` and web `e2e`

Status: OPT-104 and PERF-P0-004 remain `investigating`. Deterministic stress capability plus 50/100-photo web behavior are implemented and human-checked; encrypted native frame, memory, filesystem, lifecycle, and signed-device proof remains open.

## Baseline, Hypothesis, And Implementation

Progress already used a virtualized `SectionList` and comparison-picker `FlatList`, but its development fixture exposed only three photos. That could verify interaction semantics, not collection-scale recycling or oldest-boundary behavior.

The committed slice:

- accepts explicit development-only cardinalities from 0 through 250 while rejecting invalid and over-ceiling values;
- preserves the historical `populated` three-photo identities, dates, scores, and capture-session contract;
- generates deterministic oldest-to-newest weekly records with unique IDs, one reference, no notes, local-only metadata, and one shared tiny image;
- covers 0, 1, 2, 10, 50, 100, and 250 records plus exact 100/250 timeline and comparison derivations;
- adds stable, content-free native IDs to the timeline and comparison picker for sanitized measurement;
- leaves the production photo store, storage format, encryption path, and release behavior unchanged.

## Environment And Artifact Identity

| Field | Value |
| --- | --- |
| Host | Windows development workspace |
| Surface | Expo web through the Codex in-app Browser |
| Build mode | Development (`expo start --web --clear`) |
| Viewport | 390 x 844 |
| Datasets | Deterministic 50-photo and 100-photo front series; pure matrix through 250 |
| Network | No external service required |
| Device/OS class | Desktop-hosted web emulating a supported-phone viewport |
| Thermal/power/storage state | Not available for web development evidence |
| 100-photo raw sanitized metrics | `test-results/human-e2e/2026-07-18/progress-100-photo-stress-current/metrics.json` |
| 50-photo raw sanitized metrics | `test-results/human-e2e/2026-07-18/progress-collection-stress-current/metrics.json` |

## Human-Simulated Results

For 100 photos, the Timeline traversed from Jun 24 through the unique Jul 31 oldest row. Mounted photo rows stayed between 34 and 51 during the traversal and settled at 42, with six image elements mounted. The oldest viewport contained six real photo rows, never blanked, and had zero document-level horizontal overflow.

The 100-photo comparison picker traversed its 9,858 px horizontal range to the unique Jul 31 oldest choice. Cards peaked at 22 and settled at 15 with three mounted images. The visible boundary contained Aug 21, Aug 14, Aug 7, and Jul 31, with no blank state or page overflow. Selecting Aug 7 closed the dialog and updated exactly one comparison control while preserving Jun 24 as the after photo.

For 50 photos, the Timeline traversed to the unique Jul 16 oldest row. It settled with 44 mounted photo rows and eight images; eight real rows filled the oldest viewport, with no blank state or horizontal overflow.

The attempted browser reload for the 250-photo build was rejected by the browser local-URL security policy before the surface loaded. No 250-photo UI claim is made. The exact 250-record fixture, unique dates/IDs, reference graph, metadata, complete series derivation, and comparison endpoint remain deterministically covered by the passing unit suite.

## Commands And Reviews

| Command or review | Result |
| --- | --- |
| Progress fixture/timeline/route matrix | Pass, 3 files / 38 tests |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| `npm test` | Pass, 345 files / 4,102 tests |
| `git diff --check` | Pass |
| Independent P0/P1 review | No scoped P0/P1 finding; recommended fixture hardening was applied before final gates |

One attempted focused test invocation used Vitest's unsupported `--runInBand` option and exited before tests ran. The corrected repository-native command passed; this was a command-harness error, not an app failure.

## Privacy, Tradeoffs, And Rollback

Only deterministic non-user dates, opaque fixture IDs, cardinalities, geometry, and generated tiny-image screenshots are retained. No real photo, note, health data, account identifier, credential, path, or private content appears in the packet.

Web-mounted DOM counts demonstrate recycler behavior but are not native memory or frame measurements. The v1 fixture deliberately reuses a tiny unencrypted data URI and cannot exercise encrypted thumbnails, full-size native decode pressure, file protection, process death, or OS eviction. The 50-photo recycler may mount all 50 rows transiently under React Native Web's current window; that is not evidence of a native regression or a native bound.

Rollback this slice if `populated` route identities change, an invalid environment value bypasses the production store, fixture rows become nondeterministic or content-bearing, references become cyclic/missing, list identity changes, oldest rows duplicate/disappear, a viewport blanks, comparison selection fails to close, or production behavior observes the fixture.

## Remaining Gates

OPT-104 is locally stronger but remains `investigating`. Verification still requires the plan's signed release-mode 50-encrypted-photo minimum and representative 100-photo stress run on supported iOS hardware, with Instruments measurements for frame pacing, decoded memory, encrypted thumbnail/full-image demand, filesystem residue, background/lock recovery, lowest-device behavior, Dynamic Type, and VoiceOver. Photo v2 and encrypted thumbnail work remain governed by OPT-DEC-001/009 and were not speculated into this slice.
