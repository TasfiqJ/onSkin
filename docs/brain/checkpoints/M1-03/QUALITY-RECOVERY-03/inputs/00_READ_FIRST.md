# onSkin V2 — M1-03 / QUALITY-RECOVERY-03

**New independent exact source-only issuance:** `M103-QUALITY-RECOVERY03-SOURCE-EDIT-01`. This task repairs one additional upstream Expo SDK57 patch mismatch. It does not renew previous source authorizations or admit original Security or hosted DB gates.

1. Verify this one extracted package with `python -B verify_context.py --expected-manifest-sha256 <64_HEX_EXTERNAL_PROMPT_ANCHOR>`. **Do not derive the expected SHA from any file inside this ZIP.** A mismatch stops all work.
2. Read `01_BRAIN_AUDIT.md`, `02_TASK.md`, `03_SOURCE_EDIT_AUTHORIZATION.md`, `04_REPRODUCERS.md`, `05_TEST_AND_ACCEPTANCE.md`, `06_PROTECTED_GATES.md`, `07_DELIVERY_PROTOCOL.md`, `08_STOP_RULES.md`, then the three JSON companions.
3. In the live repo confirm existing `stage/m1-retained-safety` HEAD `3dcaf50633024ec652fe7b14a5c9072eac92642e`, tree `fd98eedb0cef6644d8e1538047aacbe44f10d837`, PR9 draft/unmerged, main `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`, and a clean worktree. If different, `STALE_ISSUANCE` and STOP source edits.
4. Validate **every** Git-blob/SHA256/byte-count preimage in `SOURCE_EDIT_AUTHORIZATION.json` against the exact base commit, including unchanged Security records. Preserve original protected source and prior review bytes. Do not proceed on even one incorrect digest.
5. Install only this exact context under `docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-03/inputs/`, and the independent Brain review under `docs/brain/reviews/M1-03/QR02-REVIEW01/`. The review is a frozen copy of this Brain-issued decision, not a new Codex-issued permission.

Only normal commits/pushes on the existing stage. No rebase, reset, force-push, PR merge, or `main` mutation. All spends $0. No raw patient reference/JANUS material, personal photos, secrets, credentials, or unapproved provider interaction.
