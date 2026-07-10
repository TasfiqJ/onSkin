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
- Record at least five raw samples for every metric on both platforms. Do not
  enter only a precomputed summary.
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
- Progress photo capture analysis from shutter confirmation until both framing
  and lighting labels reach terminal measured or unavailable states; and
- photo timeline first render, restart first render, compare open, and peak
  memory.

For `photo_capture_analysis_ms`, use the same ordinary single-face, even-light
capture protocol for every sample and record the terminal result in the raw
evidence. Start at the shutter confirmation and stop only when both review
quality labels have left `Checking`. A timeout or analyzer failure is a failed
functional observation, not a successful seven-second timing sample. Keep the
separate diverse-condition matrix in the device QA checklist for accuracy and
failure-state coverage.

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
   `docs/phase-5/performance-evidence.template.json`. Put every observation in
   the measurement's `samples` array.
4. Point the summarizer to the artifact. It atomically writes the calculated
   `sampleCount`, `p50`, `p95`, and `max` fields only when every measurement has
   at least five positive observations:

   ```bash
   PHASE5_PERFORMANCE_EVIDENCE_PATH=/path/to/performance-evidence.json \
   npm run phase5:performance-evidence:summarize
   ```

5. Run strict mode against that same artifact:

   ```bash
   PHASE5_PERFORMANCE_EVIDENCE_PATH=/path/to/performance-evidence.json \
   npm run phase5:performance-evidence:strict
   ```

6. Attach the passing artifact, raw profiler/timing exports, build IDs, and
   named signoff to the beta evidence workspace. The JSON result is a summary,
   not a substitute for raw measurements.

The validator calculates nearest-rank p50 and p95 plus max from the raw samples,
rejects any declared summary that differs, and calculates threshold failures
from the calculated p95. A typed `pass` decision cannot override a failed
metric, unsupported device, post-hoc threshold, missing platform, one-off
sample, invalid observation, crash, or OS termination.
