# Device Support Policy Audit

Generated: 2026-08-10T01:43:29.137Z
Status: blocked
Strict mode: no

This generated audit keeps the contract-required device cutoff explicit: iOS 17.0+,
375 pt width or wider as the supported iPhone layout floor, and 320-wide browser sizes as
stress/resilience evidence unless real device or review evidence elevates
them.
Android release evidence: not_applicable.

## Summary

- Config contracts: 2
- Docs checked: 8
- Human-E2E manifest gates: 48
- Blockers: 9
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

- Launch gate: iphone-375-667-200-text-pressure / fail
- 320 x 480 misclassified gates: 0

## Blockers

- iPhone 375 x 667 launch-floor gate must pass.
- iphone-375-667-200-text-pressure must pass.
- iphone-375-200-text-pressure must pass.
- modern-390-200-text-pressure must pass.
- boundary-414-896-200-text-pressure must pass.
- modern-430-200-text-pressure must pass.
- skipped-routes-375-667-200-text-pressure must pass.
- skipped-routes-390-844-200-text-pressure must pass.
- skipped-routes-430-932-200-text-pressure must pass.

## Warnings

- None.
