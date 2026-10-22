# Exact edit authority: `M103-SOURCE-CLOSURE03-CLOUD-SOURCE-EDIT-01`

`04_SOURCE_EDIT_AUTHORIZATION.json` is authoritative for the path allowlist, *individual* Git blob IDs and SHA256 preimages (10 existing paths and two optional derived paths). At `aa598d0c93fcc416ba02cbda9333953430bb2ede` verify with `git rev-parse HEAD^{tree}`, `git rev-parse <base>:<path>`, `git show <base>:<path> | sha256sum` and the working tree. If any mismatch STOP; no implicit union with old SC01/SC02 allowances.

Allowed existing file edits are limited to the 10 listed preimages. New files must match the explicit new path patterns. The old SC02 handoff/context/evidence/review and older SC01 files are **immutable**. No protected Security inventory, policies, execution rules, source scanner pin/derivative, tool capsule, owner signatures, exception expiry, workflow, dependency lock, SQL/types/Edge/provider code or main may change.

The current `scripts/brain/m103_profile.py` defaults to SC01; new profile must be an additive **SC03** interval, preserve prior conditional authorities and explicitly refuse Codex self-acceptance. Previous immutable endpoints must not incorrectly validate successor commits as part of old grants. Tests prove valid old interval plus unauthorized later commits fail by the correct exact-source rules. Do not create alternate, weaker validator. Keep 47 tasks, 27 modules, 51 ADRs unchanged.

`docs/phase-4/generated/source-worklist.{json,md}` are permitted **only derived generated** files, with exact current preimages supplied; do not alter generator or use them as a source of policy permission. Each path outside JSON authority must be treated as forbidden, even if an earlier task allowed it.
