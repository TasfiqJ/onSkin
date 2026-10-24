# Campaign10 live Git pins — observed 2026-10-24

Repository: `TasfiqJ/onSkin` (GitHub). Codex must re-fetch before any work; this file is a dated observation, not live acceptance.

| Item | Exact commit | Tree | Constraint |
| --- | --- | --- | --- |
| PR13 `stage/full-app-j01-source-packet-ci09` | `8ac97c32901272d97d1bff05f2abc294811055a6` | `a59fc7ea1cc57901f6d848ff5009734f446bdff2` | exact NEW task base; open/draft/unmerged |
| PR12 `stage/full-app-j01-release-contract08` | `d08347f0011672cd309d835628c094b5e9f4725d` | `0998881bc543840395dca375769ea1b7c9a8d4c7` | read-only |
| PR11 `stage/m1-retained-resilience` | `50f25abeafaa6127e105e2a9d825e6d15dc1dcdb` | `f623b5bbd220fd6d9d10f967400081489a5dd7e0` | read-only |
| PR10 `stage/m1-gate-recovery` | `cd2bd51997f283c0b446bf2124f427f482550fa8` | `4c2617588111aeb976913e5c73a5c7b998bc672e` | read-only |
| `main` | `d9912f4c8b30358593569c5b9b4e84773c6f463e` | `389c2a09b62e78a225a2b41c8a1965a1b0e1ab80` | read-only |
| Campaign09 measured source | `3d951357163d2abd1b02b456c6f52cfb0dbf70ce` | `02c58ff4cc87f7a9feb1b1fd5828ac4406cd0f5e` | read-only historical evidence |

PR13 URL https://github.com/TasfiqJ/onSkin/pull/13 — target PR12 branch, auto-merge off. Branch `stage/full-app-j01-quality-projections10` is NEW and must be created from the exact PR13 final HEAD only. PR13 and all predecessors remain pinned. The existing checkout was clean and C: free space roughly 756MB at independent observation; never assume this capacity still exists, never force a full clone or delete unknown data.

Final-head PR13 GitHub workflows:
* Quality `40136838582`: **FAIL**. Repository quality gates job `121000271690` fails unchanged `Check catalog promotion, curation, and receipt contracts` because nested `phase4:source-worklist:check` reports two stale projections. Candidate Release09 guard passed earlier; original `Check source packet` was SKIPPED after the worklist stop. PostgreSQL 15/17 account deletion rehearsals PASSED; separate canonical database reset job `121000271707` FAILED, registry `Data limit exceeded` / `H01_SQL_PROBE_FAILED`. Expo export job SKIPPED due failed job dependency.
* Security `40136838598`: **FAIL** (secret, static/OSV, source, and code gates; live Supabase adversarial SKIPPED). Do not touch or claim closure.
* iOS source-only `40136838669`: **PASS SOURCE ONLY** — not a signed build, physical iPhone, VoiceOver or App Store approval.

Check exact new-head CI after your push; a source commit's workflow is not the evidence-head CI. Do not assert Quality overall PASS merely because worklist passes; other original source gate failures may surface.
