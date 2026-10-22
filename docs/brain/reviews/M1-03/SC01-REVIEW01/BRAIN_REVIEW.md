# Independent Brain review of SOURCE-CLOSURE-01

**Review decision:** `PARTIAL_ACCEPTED_FIX_REQUIRED` for the bounded fixture implementation and safe evidence retention. Whole M1-03, source diagnostic closure and protected G97 Security remain **NOT ACCEPTED**. Current task SOURCE-CLOSURE-02 is separately authorized, not approval of prior claims.

## Exact identities

- Prior independently reviewed base `49a39b7f5b194d5c356a21c690e3f1bdb09edfa1`, tree `1ca412f1fc6550124445adae7d4b0e748429b11e`.
- GitHub-connected comparison shows five additive commits, 141 changed paths; no protected `.github`, SQL, `supabase`, `packages/types`, locked tool/rule or package edits within interval. Code implementation `760745cfe321c0453a17f7fe2340d49098c849e6` tree `4024679b0e55e0ec2d2b1380c6bdf097fa0fb8ba`; measured source `9cc9a1245a1defedcba095254e0eca495f4f4438` tree `ae619db20e0d7742b76ee3e87bd6ddb83a702bb8`; delivery `3600db9b5812acebd718111b6bf58efcb554487d` tree `fe6148d303adcaf3092c073cefca8ee92065c10e`.
- PR #9 draft/unmerged, `main` `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` at last direct read. Re-fetch live before any edits.
- SHA256 verified against actual GitHub source at old base: `scripts/brain/test_m103_overnight01_profile.py` = `9aee4fe96c474edbc58fb3e63d48912b5eb6bc7718da51cdb4cf31f36fc3c46e`; original M1-03 SOURCE-CLOSURE-01 auth had wrong `bbd4d4e7...`. Correctly not edited. New preimage authority at current base is in this ZIP; old authority remains immutable.
- At current base `scripts/security_readiness/m103/hydrate_history.py`, the `for key` verifier invokes `git cat-file blob` **before** the optional `object_source` acquisition block. Missing expected historical objects therefore fail before the intended healing path. Provide a new regression that starts with an incomplete object pool and resolves ONLY from an authorized local real Git object source, proving Git blob and SHA256 and refusing tamper/absence. Never fabricate witness values.
- `history_custody.py` copies live Git object content into a private bare repo; tests for historical endpoint fixture isolation were exploratory only (CONT 2/2, SH01 3/3 on dirty overlay), not the full clean exact-head suite. The 68-case Windows governance run aborted with disk error, raw exit 4294967295 and no complete counts. Supported independent Linux70 / candidate9 / final scan NOT_RUN.
- Seven representative reported evidence artifacts were fetched from GitHub and SHA256 matched declared hashes; a full 40-artifact check and fresh isolated independent test replay were **not completed**.
- Read-only direct host check found **~0.11 GiB available on C:**. Previously recorded WSL distro `onskin-r6-verification` failed to relaunch with `Wsl/Service/CreateInstance/E_FAIL`, code6/step2. No file cleanup was attempted; rejected cleanup policy remains binding.

## Current original CI (head 3600db9b5812acebd718111b6bf58efcb554487d)

- [Quality #39628029199](https://github.com/TasfiqJ/onSkin/actions/runs/39628029199): **IN_PROGRESS** at latest Brain reading. Repository job showed Expo compatibility failure; canonical DB image acquisition recurrent `toomanyrequests: Data limit exceeded`; PG15/17 clean rehearsals passed; source exports skipped when Repo red. Do not silently call overall Quality success.
- [Security #39628029041](https://github.com/TasfiqJ/onSkin/actions/runs/39628029041): **FAILURE**. Original Security contract suite 70/70 passed within original Static/OSV job, then frozen source inventory drift and unreviewed OSV/expired advisories refused. Original secret fixture tests 12/12 passed, but original secret scanning gate failed on current-source evidence. The private candidate does **not** replace original Security.
- [iOS #39628029045](https://github.com/TasfiqJ/onSkin/actions/runs/39628029045): **SUCCESS — source-contract only**, not native installed device/TestFlight.
- New tool files + frozen inventory are a **real original-Security gate conflict requiring qualified custodian authority**, not a local tool process exit to suppress. G97 source-only proposal expired 2026-10-21T00:00:00Z. DB06 replay, DB08 linked parity, R2B ACL issuer remain closed.
