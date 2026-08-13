# Optimization Evidence

Date established: 2026-07-12 (America/Toronto)
Baseline SHA: `fc5d512f7e0ccbab8d3b5a2beb4268dd8a24595f`

Current checkpoint parent SHA: `a53cfeca994e242b7e45fd43279909b1d59f2041`

This directory is the index for sanitized, content-free optimization evidence. It contains deterministic dirty-worktree Expo export reports and a local verification summary. Native traces, signed artifacts, credentials, and private-content artifacts are not committed here.

## Naming

Use:

```text
YYYY-MM-DD_<phase-or-opt-id>_<platform>_<build-sha-short>_<fixture>_<scenario>_<artifact>.<ext>
```

Examples describe the format only and are not evidence:

```text
2026-07-12_OPT-106_ios_fc5d512_median_cold-export_asset-summary.md
2026-07-12_PERF-P0-001_android_fc5d512_stress_resume_perfetto-summary.md
```

Each committed summary must record:

- full source SHA, branch, build mode, and artifact identity;
- platform, device model/class, OS, storage/free-space class, network condition, and dataset version/checksum;
- thermal/power state when available;
- exact command or action script;
- cold, warm, or resume classification;
- declared warmups and exclusions;
- raw sample values, p50, p95 where supported, maximum, failures, crashes, and OS kills;
- baseline, hypothesis, implementation, result, tradeoffs, regression test, and rollback trigger;
- raw-artifact location when the raw artifact is intentionally kept outside Git.

## Privacy Rules

Do not store or emit:

- real photos or decoded private image content;
- search text, product/routine/health content, notes, barcodes, or notification content;
- names, email addresses, complete user/account IDs, tokens, secrets, keys, nonces, ciphertext, or credentials;
- raw route parameters, private filenames/paths, photo IDs, or stable personal identifiers;
- screenshots, view hierarchies, traces, logs, heap dumps, or crash reports that contain private content.

Use deterministic non-user fixtures. Use content-free enums and opaque fixture IDs. Commit only sanitized summaries. Keep raw Instruments, Perfetto, heap, backup, filesystem, and device artifacts outside Git whenever they can contain private values, and record only their controlled location and sanitization status.

## Evidence Classes

- `command`: typecheck, lint, test, audit, dependency, export, and configuration transcripts.
- `bundle`: Hermes, source-map, asset, font, native artifact, and per-ABI summaries.
- `e2e`: human-simulated action script, starting state, expected/actual result, screenshots/video/log references, and bug/retest links.
- `native`: signed-build Instruments, Perfetto, memory, energy, frame, storage, backup, accessibility, and lifecycle summaries.
- `backend`: query plans, load distributions, migration/RLS, export/deletion, webhook, retention, and recovery evidence.
- `decision`: threshold declarations, architecture decisions, independent approvals, and external blockers.

## Verification Boundary

- Development mode, Expo Go, web-only, unit-only, simulator-only, or emulator-only observations cannot verify native performance.
- Web E2E can verify only web-compatible behavior.
- Physical-device claims require signed/release-mode device evidence.
- Suggested plan thresholds are not approved gates until recorded before the official run by authorized owners.
- Missing hardware, credentials, store access, production authority, or external approval must be recorded as `blocked-external`; evidence must never be fabricated.
