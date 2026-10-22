# Original CI observed by new Brain, not candidate tool

Repository `https://github.com/TasfiqJ/onSkin`; source/delivery head `3600db9b5812acebd718111b6bf58efcb554487d`. Snapshot at Brain's live connector review on 2026-10-21 (final Quality may still change; fetch again).

| Workflow | Run | Actual observed |
|---|---|---|
| Quality | [39628029199](https://github.com/TasfiqJ/onSkin/actions/runs/39628029199) | in_progress; repo job exposed Expo patch mismatch; canonical DB job in progress at earlier check; PG15/17 successful; exports skipped. Prior implementation run [39624910233](https://github.com/TasfiqJ/onSkin/actions/runs/39624910233) FAILED from Expo patch compatibility and ECR `toomanyrequests` |
| Security | [39628029041](https://github.com/TasfiqJ/onSkin/actions/runs/39628029041) | FAILURE: code, static/OSV, secrets, automatic admission failure; original supported Python Security contract 70/70 PASS but then `SOURCE_INVENTORY_DRIFT`; original secret fixture 12/12 PASS then scanner findings red; npm/OSV and expired review unresolved |
| iOS launch contract | [39628029045](https://github.com/TasfiqJ/onSkin/actions/runs/39628029045) | SUCCESS source-contract only |

The synthetic PR checkout can be a merge ref with same/different tree. Confirm real checkout ref, tree and run head; earlier implementation merge `a0d3db0051b45bced10b06417b0bbaf3d8a7ef0b` had identical tree to implementation `760745...`, but that does not prove final delivery checkout identity. Explicitly compare stage head/evidence-only tail/measured implementation and workflow merge tree.

Never upgrade failing original Security simply because its fixture unit tests pass, nor infer success from 70 provider unit tests. No owner/custodian signing is granted by this context.
