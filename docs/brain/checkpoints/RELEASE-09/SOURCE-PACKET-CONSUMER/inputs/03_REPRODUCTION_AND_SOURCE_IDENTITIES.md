# Exact old source-packet QA defect / approved additive notice identities

At PR12 head `d08347f...`, unchanged script `scripts/docs/source-packet-audit.mjs` Git blob `c9087e63e9063e9a3d514d7d57175d30f2ae7bf8` enforces strict equality of every original `04_repo_docs/docs/*.md` with active `docs/*.md`. That was valid for the old unchanged packet, but the separately authorized Release08 scope inserted one exact supersession notice immediately AFTER the original first `# Title` line in FIVE active docs. The imported packet was rightly not edited, so strict audit exits1 and two derived outputs are stale. The generated JSON currently marks byte-different as `identical:false`, and downstream consumers may require exact `identicalMirrorCount` semantics. Preserve honest reporting; authorize a distinct `authorizedSupersession` indicator without changing meanings of `identical` or original packet counts.

Exact five base-postimage Git blob SHA-1 anchors, verified via GitHub at immutable refs:

| Path | PR11 base 50f25 blob | Release08 measured f0f743 blob |
|---|---|---|
| docs/MASTER_PLAN.md | 06f008a38c5851826f03ca8e27fcef13a9a02dac | 86404ee2fa26849e80e4ff6be1b86dbab5f28c60 |
| docs/PRODUCT_REQUIREMENTS.md | 36cdc11c8be73d38ead93215a2e7f8d4eefd5a97 | fba13dfc486c5afc0a6a6620c8c38e63997e0998 |
| docs/FEATURE_INDEX.md | 637ec987ab02551319c177fd353c21b956e15498 | b5969077354d0e29c165c15f1bec2c5476da0213 |
| docs/ROADMAP.md | 9056745150b2eb9eb7bab0a8bb752f8019ecf782 | 36079c2c3b482a44a31c612804eb25031f7f093d |
| docs/DECISIONS.md | 59e377d15683390e185402ac701096f9ba433845 | 52e3ca679ab8b3e1948959e93939400427d75d10 |

All five notices have identical 16-line introductory section headed `## Release08 proposed public-product scope — 2026-10-24`, authority `BRAIN-RELEASE-FULLAPP-J01-REBASE08-CANDIDATE-01`, F01–F17/F19–F20 + V2-C01..12 + P01..P06 + J01 only, F18 and J02–J27/J05 deferred, F09 history/comparison preserved, safety gates closed and `NOT_DONE` legacy cutover. Everything after this insertion must match the authentic imported original byte-for-byte. The task must derive exact insert bytes from Git, not reconstruct them from this prose.

Actual independently reproduced command:
```
npm.cmd run docs:source-packet-audit:check
... FAIL docs/generated/source-packet-audit.json is stale
... FAIL docs/generated/source-packet-audit.md is stale
... FAIL docs/DECISIONS.md differs from 04_repo_docs/docs/DECISIONS.md in strict mode
... FAIL docs/FEATURE_INDEX.md differs ...
... FAIL docs/MASTER_PLAN.md differs ...
... FAIL docs/PRODUCT_REQUIREMENTS.md differs ...
... FAIL docs/ROADMAP.md differs ...
AUDIT_EXIT=1
```

The intended repair must NOT globally skip these files, treat arbitrary inserted copy as allowed, set `identical=true` falsely, copy the active changed docs back into the old packet, or simply rewrite hash manifests. Exact SOURCE-bound deviation only; unchanged mirrors remain exact.
