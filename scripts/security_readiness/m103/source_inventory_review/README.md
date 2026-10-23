# Non-admitting source inventory review

This independent reviewer reads exact Git objects, validates regular modes and
object hashes using the original `source_scan.snapshot` semantics, and directly
calls the byte-pinned original `contract.coverage_kind`, JSON parser, safe input
reader and frozen coverage validator. It never invokes scanners or writes original
Security inputs. No output grants source admission or owner approval.

Run in a clean, independent `git clone --no-hardlinks` checkout, with byte-preserving
checkout configuration (`core.autocrlf=false`). Output must be outside that checkout:

```text
python -B scripts/security_readiness/m103/source_inventory_review/review.py generate --repo . --commit FULL_COMMIT --out ABSOLUTE_NEW_EXTERNAL_DIRECTORY
python -B scripts/security_readiness/m103/source_inventory_review/review.py verify --repo . --out ABSOLUTE_EXTERNAL_DIRECTORY
python -B -m unittest discover -s scripts/security_readiness/m103/source_inventory_review -p test_review.py -v
```

The frozen baseline is the Brain-issued `455e359` source. The last frozen-manifest
commit supplies previous blob/size witnesses, validated against each frozen SHA256.
The two self-binding documents are tracked separately. Current paths include every
checkpoint and review artifact. Untracked nonignored paths refuse generation;
ignored regular files are separately inventoried. Tracked working bytes must equal
Git bytes. Dirty source, symlinks/reparse points, hardlinks and nonregular Git modes
refuse. Gzip checking has a 64 MiB inflation limit; unknown gzip paths retain the
original refusal. The exact reviewed scanner-engine archive is identified, never
expanded or executed. Git objects over 512 MiB refuse the entire review.

Each inventory row is also its target-disposition row: required, auxiliary,
excluded, or REFUSED. Shards have at most 512 rows, in canonical path order.
Verification independently regenerates every row, sidecar and summary from Git,
so rehashing a forged shard does not make an omission or exclusion authentic.
All 26 SQL identities and 189 historical failures/368 fixpoint events remain open.

A zero utility exit means reconciliation completed, including any explicit
REFUSED rows. It never means SAST completed. Tests deliberately reject forged
GO. No candidate can be directly wired into G97. The original two binding-document
exemptions avoid directly hashing the live proposal and manifest into themselves.
Candidate copies under a checkpoint have no such exemption: updating them to
describe their own live tree creates a custody cycle. Append-only evidence also
changes the inventory denominator. See the task checkpoint for the concrete proof
and proposed immutable measured-source custody design.
