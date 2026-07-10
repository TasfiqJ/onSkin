# Phase 5 Performance Evidence Runbook

Performance is a launch gate, but target numbers must not be invented after a
slow or fast run is observed.
A named owner must define every threshold before measurement.
The contract ties results to supported physical devices, real EAS
builds, the exact source commit, repeated samples, and a separate named
signoff.

## Support And Evidence Floor

- iOS evidence must use a physical iPhone on iOS 17+ with a logical width of
  at least 375 pt and at least 640 pt usable portrait height.
- Android evidence must use a physical phone on Android 10+ with a smallest
  logical width of at least 360 dp and at least 640 dp usable portrait height.
- Use at least five repeated samples for every metric on both platforms.
- Use a native profiler for photo-timeline peak memory. Instrumented timers or
  a manual stopwatch are accepted for end-to-end timings when the method is
  recorded consistently.
- Test the photo timeline with at least 50 encrypted local photos. Record zero
  crashes and zero OS terminations; delete plaintext import sources after use.

## Required Metrics

The template requires both iOS and Android evidence for:

- cold app startup to the first usable route;
- adding three products through manual, search, barcode, and OCR/manual
  fallback paths;
- barcode camera acquisition, decode, lookup, and no-match recovery;
- routine generation with 3, 5, and 10 products;
- photo timeline first render, restart first render, compare open, and peak
  memory.

## Workflow

1. Generate or refresh the blocked template:

   ```bash
   npm run phase5:performance-evidence:template
   ```

2. Before measuring, fill every `maxP95`, rationale,
   `thresholdsDefinedAt`, and `thresholdsDefinedBy` field. Do not revise a
   failed threshold after measurement without recording a new review decision
   and rerunning the complete baseline.
3. Fill real build/device/source evidence and every iOS/Android measurement in
   a separate JSON artifact based on
   `docs/phase-5/performance-evidence.template.json`.
4. Point the validator to the artifact and run strict mode:

   ```bash
   PHASE5_PERFORMANCE_EVIDENCE_PATH=/path/to/performance-evidence.json \
   npm run phase5:performance-evidence:strict
   ```

5. Attach the passing artifact, raw profiler/timing exports, build IDs, and
   named signoff to the beta evidence workspace. The JSON result is a summary,
   not a substitute for raw measurements.

The validator calculates threshold failures from the recorded p95 values. A
typed `pass` decision cannot override a failed metric, unsupported device,
post-hoc threshold, missing platform, one-off sample, crash, or OS termination.
