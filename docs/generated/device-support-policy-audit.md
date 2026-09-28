# Device Support Policy Audit

Generated: 2026-09-28T03:23:44.542Z
Status: pass
Strict mode: yes

This generated audit keeps the contract-required device cutoff explicit: iOS 17.0+,
375 pt width or wider as the supported iPhone layout floor, and 320-wide browser sizes as
stress/resilience evidence unless real device or review evidence elevates
them.
Android release evidence: not_applicable.

## Summary

- Config contracts: 2
- Docs checked: 8
- Human-E2E manifest gates: 43
- Blockers: 0
- Warnings: 0

## Native Config

| Contract                | Expected | Actual | Pass |
| ----------------------- | -------- | ------ | ---- |
| iOS deployment target   | 17.0     | 17.0   | yes  |
| iOS tablet launch scope | false    | false  | yes  |

## Docs

| Doc                                 | Needles | Missing |
| ----------------------------------- | ------- | ------- |
| docs/DEVICE_SUPPORT_POLICY.md       | 4       | none    |
| docs/DECISIONS.md                   | 4       | none    |
| docs/FOR_TAS_TO_DO.md               | 4       | none    |
| LAUNCH_READINESS.md                 | 3       | none    |
| BLOCKERS.md                         | 2       | none    |
| docs/TESTING_STRATEGY.md            | 3       | none    |
| docs/HUMAN_SIMULATED_E2E_TESTING.md | 2       | none    |
| docs/USER_FLOW_TREE.md              | 3       | none    |

## Human-E2E Manifest

- Launch gate: iphone-375-667-200-text-pressure / pass
- 320 x 480 misclassified gates: 0

## Blockers

- None.

## Warnings

- None.
