# Branch and commit safety

- Repository TasfiqJ/onSkin. Existing `stage/m1-retained-safety` must be at or descendant of `49a39b7f5b194d5c356a21c690e3f1bdb09edfa1`. PR #9 draft and unmerged; main `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` observed and read-only. One writer.
- At each session end, commit all safe authorized progress plus tracked root `ONSKIN_BRAIN_HANDOFF.txt`, then normally push stage even PARTIAL/BLOCKED/red. No force push, reset, main push or unrelated worktree edit. Failure to push = PUSH_BLOCKED.
- Report code commit SHA/tree, evidence/report commit SHA/tree, remote pushed SHA and actual PR merge checkout separately. Source never self-accepts. If context HIGH/compaction, save honest checkpoint and stop.
