# GitHub publication and recovery protocol

Repository: TasfiqJ/onSkin. Dedicated branch: brain/masterv2. Its tree contains only control documents, tools and evidence, with no .github/workflows and no application checkout. Never merge this branch into main/application branches.

## Permissions
Brain writes START_HERE, CONTROL, plan, tasks, feature/gate state, reviews and decisions. Codex appends immutable returns and updates returns/LATEST.json after verification. These are protocol roles, not a claim GitHub ACLs independently enforce separate identities. Both agents must check allowed paths; changes outside role must stop.

## Write transaction
Read current branch SHA. Build the complete set of changed docs as one Git tree/commit whose sole parent is that SHA. Update the ref with force=false. A race requires refetch and reconcile, never a force push. Do not run two writes to the same pointer concurrently. Read back exact bytes and check hashes before reporting success.

## Fresh safety preflight
Check target branch tree, current default-branch workflow triggers, repository webhooks/rulesets and relevant integrations. No create/push handler, deployment or metered operation may be triggered by this evidence update. No PR creation or workflow dispatch. No LFS or large recurring binary archives. A skip-ci message is supplemental only. If a required check cannot be established, stop publication and produce a precise blocker. Do not change account/settings to bypass it.

## Privacy
The repository is public. Publish only screened technical docs, synthetic test evidence and code patches. No user photos, medical/customer data, private keys, access tokens, personal device identifiers or unscreened logs. Keep necessary private evidence in approved custody and publish only a locator/hash/redacted summary. Never silently redact a source patch and call it exact.

## Evidence access
Reports must include actual source deltas readable through GitHub, not only Windows paths. UTF-8 parts concatenate byte-exactly and have per-part and whole hashes. Preserve old immutable evidence, use pinned links, avoid duplicating thousands of old logs each run.

## Recovery
If GitHub is unavailable, local staging is a temporary fallback, not a new default. New Brain must disclose the gap and publish when the same safe channel returns. The bootstrap ZIP is an offline snapshot. Read current CONTROL before any later task.
