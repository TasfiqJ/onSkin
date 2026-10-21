# Source and external observation labels

**Independently checked at new Brain review:**
- Repo `TasfiqJ/onSkin` PR #9 `stage/m1-retained-safety` head `aa598d0c93fcc416ba02cbda9333953430bb2ede`, Git tree `6dd2010073d913ca400c201f6d58ed1212fa97d4`, main `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`, draft/unmerged.
- Original pinned `scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt`: 66 pinned requirements, no `casadi` and no Tcl/Tk package. `scripts/security_readiness/m103/capsule.py:runtime_inputs` traverses entire interpreter sys.path and checks ELF closure with `ldd` (fail on 'not found'). This makes ambient unrelated libraries a plausible explanation, but the prior stop raw log is not accessible through the GitHub repo.
- GitHub workflow runs for this code head: Quality `39640880564` FAILED, Security `39640880489` FAILED, iOS source-contract `39640880616` SUCCESS. These are independent original GitHub CI, not candidate execution/acceptance.

**Founder-provided Codex Cloud stop report (not independently replayed):**
- Node22.23.4 selected, both package verifiers + 12 preimages passed, network-denial preflight passed, 66-wheel installation and pip check passed.
- Baseline governance: 61 passed, 3 failed, 2 errors, 2 skipped (68 total), actual case names missing in pasted founder message; use preserved task logs or rerun, no assumptions.
- `BLOCKED_CLOUD_CAPABILITY`: capsule missing Tcl/Tk9 and CasADi native dependencies; nine candidate tests and 4-bundle scan NOT_RUN. No source changes/commits/pushes.
- Developer workspace artifact links `/workspace/sc03-node22-continuation/evidence/README.md` and `/workspace/sc03-node22-continuation/SC03-Node22-stop-evidence.zip` are **task-local**, not public GitHub URLs, and were not accessible to Brain. Do not cite them as independently inspected.

Previous source issues: `hydrate_history.py` verification-before-acquisition (actual GitHub source inspected); past Windows local disk/WSL failure is irrelevant to this Cloud task. Keep all failures independent, with actual commands/exit/log identity.
