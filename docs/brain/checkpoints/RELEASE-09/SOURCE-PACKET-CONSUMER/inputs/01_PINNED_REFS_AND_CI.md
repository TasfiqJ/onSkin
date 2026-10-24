# Immutable observed source identities (2026-10-24, 17:11–17:xx America/Toronto)

- Repo `TasfiqJ/onSkin`, `main`: d9912f4c8b30358593569c5b9b4e84773c6f463e; tree 389c2a09b62e78a225a2b41c8a1965a1b0e1ab80.
- Security PR10 `stage/m1-gate-recovery`: cd2bd51997f283c0b446bf2124f427f482550fa8; tree 4c2617588111aeb976913e5c73a5c7b998bc672e.
- Accepted Campaign07 PR11 `stage/m1-retained-resilience`: 50f25abeafaa6127e105e2a9d825e6d15dc1dcdb; tree f623b5bbd220fd6d9d10f967400081489a5dd7e0. Draft/open/unmerged, auto-merge off.
- Current Release08 PR12 `stage/full-app-j01-release-contract08`: d08347f0011672cd309d835628c094b5e9f4725d; tree 0998881bc543840395dca375769ea1b7c9a8d4c7. Draft/open/unmerged; base branch is PR11. No rewrite allowed.
- Release08 measured source: f0f743e5d8db586a1f9d98e417adb36416ede9fa; tree 54d5645866d25681cae42a2a7a2869e12362edfa. Exact 23 source paths versus accepted PR11 base, followed by three evidence commits to final head; whole PR12 has 65 changed paths.
- New branch to create from Release08 FINAL: `stage/full-app-j01-source-packet-ci09`; new DRAFT PR targeting PR12 branch. Not PR11/main.

Exact final-head GitHub Actions:
- Quality `40132485372`: FAIL overall; repository quality gates job `120986962019` FAIL at "Check source packet"; canonical DB job `120986961948` FAIL `H01_SQL_PROBE_FAILED` because registry `Data limit exceeded`; PG15/PG17 isolated deletion rehearsals PASS; Expo export job `120988274884` SKIPPED (depends on quality checks).
- Security `40132485378`: FAIL secret scan, code gates, static/OSV, source-only acceptance; live Supabase skipped.
- iOS launch contract `40132485379`: PASS SOURCE-ONLY; this is not an installed/native App Store build.

The new job must independently re-fetch all refs and exact CI at its new final head. PR12 and all ancestors are immutable during its work. Host C: capacity previously fluctuated near full; do not destroy data or claim a new independent 0/1/0 checkout. Keep USD0.
