# Earliest fail-closed predicate

At the exact baseline, the unchanged original `contract.source()` first checks the proposal/manifest bytes and the manifest's policy digest. Those checks pass. It then computes:

```text
expected = paths(source-manifest.json) union {proposal.json, source-manifest.json}
require(tracked union nonignored_untracked == expected, SOURCE_INVENTORY_DRIFT)
```

`diagnose_inventory.py` invoked that original function in the new clean disposable clone, captured process exit **1**, and verified `contract.Rejected: SOURCE_INVENTORY_DRIFT`. The original provider static job `120231424552` independently records the same traceback at `2026-10-23T03:58:47Z`. See `evidence/inventory-reproducer.json` and `evidence/provider-log-excerpts.json`.

The original `collect.py` calls `source()` before `scan_coverage()`, coupled-source checks, installed-tool verification, npm/OSV/secrets collection, rule acquisition or Semgrep. This is the earliest collector failure. The separate automated admission job `120232409649` has its own earlier policy refusal: original decision artifact says `PROPOSAL_EXPIRED_OR_CHANGED`. These are different entrypoints, not contradictory failures.

| Comparison | Count |
| --- | ---: |
| Reviewed manifest rows | 11,920 |
| Reviewed expected paths, including two contract documents | 11,922 |
| Current tracked paths | 20,230 |
| Nonignored untracked paths in diagnostic clone | 0 |
| Unchanged reviewed bytes | 11,833 |
| Changed reviewed bytes | 89 |
| Missing reviewed paths | 0 |
| Extra current paths | 8,308 |

The set mismatch alone fails; the collector never reaches the subsequent per-file SHA256 loop, which would additionally refuse the 89 changes. Of those changes, 68 are under apps/packages and 21 elsewhere. Extras include 8,192 `docs/brain` paths, 11 apps/packages paths and 105 elsewhere. There are no database changes in the reviewed comparison. File suffix counts and every changed/extra path, current SHA256, byte count and diagnostic kind are in `SCAN_COVERAGE_MATRIX.json`. The 11,833 unchanged paths inherit the byte-pinned original manifest and partition; they are not silently removed from the denominator.

The frozen partition accounts for all 11,922 reviewed paths: **7,755 required + 1,451 auxiliary + 2,716 exclusions = 11,922**. Targets total 9,206. The 26 explicit SQL targets remain fixed. Auxiliary files include JPEG bytes with `.png` names selected by generic rules; counting them as supported language coverage would be wrong. The original Semgrep `minimumFiles=9150` is only one admission predicate, not a coverage denominator.

Applying the unchanged classifier diagnostically to current bytes yields 13,623 required, 1,451 auxiliary, 5,095 excluded and 61 refused paths, totaling 20,230. Refusals are 60 unreviewed gzip sources and one 5,975,899-byte JSON file exceeding the 4 MiB bound. Every refusal and path is listed in the matrix. Its class labels are inherited mechanical results, not approved new exclusions or proof of parser support. Other unsupported/parser-specific dispositions remain UNKNOWN because no current SAST report exists. In particular, a small opaque input classified as generic-required is not proof Semgrep parsed it.

No frozen inventory, classifier, size bound, SQL target, exclusion or scanner was changed. No absent scan is called zero findings. Current scanned paths and coverage percentage remain null. Updating only the manifest would conceal a materially changed source set and would still encounter coverage, tool, finding and expiry refusals. A genuine renewed source/coverage review must establish each path disposition and independently bound owner pins; this task cannot supply that authority.

Five current app source samples were independently compared to their exact Git blobs and working bytes (`evidence/current-source-samples.json`). This authenticates the sampled inputs; it grants no SAST result. Rerun the helper against a separate clean clone of the measured baseline; running it against a later evidence tail intentionally changes its inventory.
