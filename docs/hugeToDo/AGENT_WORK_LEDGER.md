# Agent Work Ledger

This is a coordination ledger, not a completion authority. Task status remains
authoritative only in `execution-status.json` after the required acceptance
evidence passes.

## Current baseline

- Codex-owned plan items: 131
- Complete: 16
- Remaining: 115
- Active critical path: DB-05 current 93-migration replay

## Active assignments

| Lane | Task | Owned file surface | State | Integration gate |
| --- | --- | --- | --- | --- |
| Root | DB-05 / OPS-07 | DB replay repair, package lock, Phase 9 dependency/privacy evidence | In progress | Full CI replay plus security and quality workflows |
| share01_cards | SHARE-01 prerequisite | Share-card/share-sheet source, focused tests, and source evidence | In progress | Root diff review, privacy-boundary tests, and user-flow verification |
| grow01_review_prompt | GROW-01 prerequisite | Review-prompt policy source, focused tests, and source evidence | In progress | Root diff review, policy tests, and user-flow verification |

## Reviewed integration queue

| Lane | Task | Commit | Review state | Remaining non-source gates |
| --- | --- | --- | --- | --- |
| db08_type_parity | DB-08 prerequisite | `8c85e313a` | Root-reviewed; focused contracts and types package typecheck passed | Current 93-migration generation and linked staging parity |
| native01_widgets | NATIVE-01 prerequisite | `052262926` | Root-reviewed; widget lifecycle, extension, and runtime suites passed | macOS/Xcode, signed archive, and physical-device evidence |
| native02_live_activity | NATIVE-02 prerequisite | `2ca6b0a49` | Root-reviewed; widget lifecycle, extension, and runtime suites passed | macOS/Xcode, signed archive, and physical-device evidence |
| link01_universal_links | LINK-01 prerequisite | `e4edec404` | Root-reviewed; routing, AASA, CORE-07A, and Phase 8 checks passed | Final domain/AASA deployment, signing, and physical-device evidence |
| Root | OPS-07 security repair | `ac803cc82` | Audit is clean locally; privacy/source checks passed | Replacement GitHub security and quality workflows after push |
| auth02_email_change | AUTH-02 prerequisite | `63d82d3dc` | Root-reviewed; focused auth tests and source configuration checks passed | Hosted SMTP/template, delivery, and physical-device evidence |
| ios11_containment | IOS-11 prerequisite | `f5e67459d` | Root-reviewed after fail-open inventory/identity fixes; 12 store-only and 7 evidence-contract checks passed | Signed staging containment and store-hotfix drill |
| native03_notifications | NATIVE-03 prerequisite | `574e8e95c` | Root-reviewed after owner-race, bootstrap, and repo-wide token-boundary hardening; 321 focused checks passed | Remote-push authorization, APNs/EAS, signed archive, and physical-device evidence |

## Coordination rules

1. Agents do not edit `execution-status.json` or mark tasks complete.
2. Agents do not commit or push; root reviews and integrates every change.
3. File ownership is disjoint. Overlap is stopped and reassigned before merge.
4. A source checkpoint is not launch, device, hosted, legal, or App Review
   evidence.
5. Every accepted batch records focused checks, repository-wide checks where
   relevant, the pushed commit, and the updated complete/remaining count.
