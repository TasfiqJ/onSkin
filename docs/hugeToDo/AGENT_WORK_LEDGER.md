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
| db08_type_parity | DB-08 prerequisite | Database-type parity scripts and type overlay/contracts | In progress | Root diff review and focused parity tests |
| native01_widgets | NATIVE-01 prerequisite | Widget/native source, tests, and task-specific evidence | In progress | Root diff review, native source checks, device evidence remains separate |
| link01_universal_links | LINK-01 prerequisite | Universal-link/share-landing routing source, tests, and task-specific evidence | In progress | Root diff review and routing tests; final domain remains separate |

## Coordination rules

1. Agents do not edit `execution-status.json` or mark tasks complete.
2. Agents do not commit or push; root reviews and integrates every change.
3. File ownership is disjoint. Overlap is stopped and reassigned before merge.
4. A source checkpoint is not launch, device, hosted, legal, or App Review
   evidence.
5. Every accepted batch records focused checks, repository-wide checks where
   relevant, the pushed commit, and the updated complete/remaining count.
