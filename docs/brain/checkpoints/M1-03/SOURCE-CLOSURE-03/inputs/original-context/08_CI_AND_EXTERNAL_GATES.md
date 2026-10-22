# Original CI, live provider and protected gate distinctions

Observed live by Brain on 2026-10-21 at stage `aa598d0c93fcc416ba02cbda9333953430bb2ede` (these are historical snapshots; refresh on new head):

- Quality: GitHub Actions run `39640880564`, **FAILURE**. Repository quality Expo patch compatibility FAIL; original canonical credential-free DB job `119363767814` FAIL from Docker/ECR `toomanyrequests: Data limit exceeded`. Original PG15 and PG17 rehearsals PASS, exports SKIPPED. At prior `3600db9b`, the canonical DB job passed; never substitute old pass for current failure.
- Security: run `39640880489` **FAILURE**. Static/SARIF/OSV and code/secret gates red, live adversarial skipped; previously original Security-contract70/70 and secret-fixture12/12 passed but do not resolve inventory or findings. Frozen original source inventory drift is an authorized owner/custodian problem, not a signal to silently change scanner inventories.
- iOS source-only contract: run `39640880616`, **SUCCESS**. No installed device/signed build/TestFlight or clinical permission.

For final implementation and final evidence head inspect GitHub PR #9, exact workflow run IDs, attempt, job IDs, decisive steps and stage-vs-merge checkout/tree. Never infer HEAD from title or provider UI. Distinguish code source head, evidence tail and provider event merge ref.

**Protected refusal inventory:** original source-only G97 proposal expired 2026-10-21T00:00:00Z; four candidate SAST observations; original secret records unreviewed, no credential testing; npm/OSV advisories not waived; DB06 unconditional replay refusal; DB08 linked-target identity parity; R2B independently authorized `supabase_admin` ACL issuer/receipt. No new operator signing, paid spend, production/provider mutation, hosted replay, SQL, migration, clinical/research or M2/J05 work. If only protected authority remains, provide one minimal exact source-bound custodian review packet and STOP; no green simulation.
