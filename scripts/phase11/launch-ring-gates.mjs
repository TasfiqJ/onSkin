#!/usr/bin/env node
import {
  block,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  has,
  phase11RequiredDocs,
  printResult,
  requiredPhase11EvidenceKeys,
  warn,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();

for (const file of phase11RequiredDocs()) block(errors, exists(file), `${file} is missing.`);

block(
  errors,
  has('docs/phase-11/launch-command-center.md', /Ring 0/i),
  'Launch command center must define Ring 0.',
);
block(
  errors,
  has('docs/phase-11/launch-command-center.md', /Ring 1/i),
  'Launch command center must define Ring 1.',
);
block(
  errors,
  has('docs/phase-11/launch-command-center.md', /Ring 2/i),
  'Launch command center must define Ring 2.',
);
block(
  errors,
  has('docs/phase-11/ring-0-release-checklist.md', /approved and controllable/i),
  'Ring 0 checklist must keep launch unpromoted until smoke passes.',
);
block(
  errors,
  has('docs/phase-11/ring-0-release-checklist.md', /first-release percentage rollout/i),
  'Ring 0 checklist must reject first-release percentage rollout assumptions.',
);
block(
  errors,
  has('docs/phase-11/ring-1-soft-launch.md', /72-Hour Review/i),
  'Ring 1 plan must require 72-hour review.',
);
block(
  errors,
  has('docs/phase-11/week-1-expansion-decision.md', /D7 activated retention/i),
  'Week 1 decision must include D7 activated retention.',
);
block(
  errors,
  has('docs/phase-11/creator-disclosure-pack.md', /material connection/i),
  'Creator disclosure pack must require material connection disclosure.',
);
block(
  errors,
  has('docs/phase-11/creator-disclosure-pack.md', /may not request or reward app-store reviews/i),
  'Creator disclosure pack must ban review rewards.',
);
block(
  errors,
  has('docs/phase-11/aso-store-conversion-review.md', /Banned Claim Themes/i),
  'ASO review must list banned claim themes.',
);
block(
  errors,
  has('docs/phase-11/launch-72-hour-report.md', /continue, hold, rollback, no-go/i),
  '72-hour report must force a continue/hold/rollback/no-go decision.',
);

for (const key of [
  'PHASE11_RING0_PASS',
  'PHASE11_RING1_72H_REPORT_PASS',
  'PHASE11_WEEK1_DECISION_PASS',
]) {
  warn(warnings, evidenceFlagEnabled(env[key]), `Missing launch ring evidence: ${key}=true.`);
}
for (const key of requiredPhase11EvidenceKeys()) {
  if (
    ['PHASE11_RING0_PASS', 'PHASE11_RING1_72H_REPORT_PASS', 'PHASE11_WEEK1_DECISION_PASS'].includes(
      key,
    )
  )
    continue;
  warn(warnings, evidenceFlagEnabled(env[key]), `Missing launch readiness evidence: ${key}=true.`);
}

printResult('Phase 11 launch ring gates', errors, warnings);
