# Device Support Policy Audit

Generated: 2026-07-09T18:30:42.125Z
Status: pass
Strict mode: yes

This generated audit keeps the V1 device cutoff explicit: iOS 17.0+,
Android 10 / API 29+, Android compile/target API 36, 360 x 640 as the
launch-blocking Expo web layout floor, and 320-wide browser sizes as
stress/resilience evidence unless real device or review evidence elevates
them.

## Summary

- Config contracts: 5
- Docs checked: 8
- Human-E2E manifest gates: 14
- Blockers: 0
- Warnings: 0

## Native Config

| Contract                      | Expected | Actual | Pass |
| ----------------------------- | -------- | ------ | ---- |
| iOS deployment target         | 17.0     | 17.0   | yes  |
| iOS tablet launch scope       | false    | false  | yes  |
| Android min SDK install floor | 29       | 29     | yes  |
| Android compile SDK           | 36       | 36     | yes  |
| Android target SDK            | 36       | 36     | yes  |

## Docs

| Doc                                 | Needles | Missing |
| ----------------------------------- | ------- | ------- |
| docs/DEVICE_SUPPORT_POLICY.md       | 9       | none    |
| docs/DECISIONS.md                   | 4       | none    |
| docs/FOR_TAS_TO_DO.md               | 5       | none    |
| LAUNCH_READINESS.md                 | 4       | none    |
| BLOCKERS.md                         | 3       | none    |
| docs/TESTING_STRATEGY.md            | 3       | none    |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | 3       | none    |
| docs/USER_FLOW_TREE.md              | 4       | none    |

## Human-E2E Manifest

- Launch gate: support-floor-360-640-200-text-pressure / pass
- 320 x 480 misclassified gates: 0

## Blockers

- None.

## Warnings

- None.
