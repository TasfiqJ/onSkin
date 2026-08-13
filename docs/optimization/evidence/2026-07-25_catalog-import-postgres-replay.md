# Catalog Import PostgreSQL Replay Checkpoint

Date: 2026-07-25 (America/Toronto)
Branch: `optimization`
Checkpoint parent SHA: `e84ac8565f2aa3b27571688d2ce12464a558398d`
Evidence class: command, decision, agent review, migration execution, failure
injection, and PostgreSQL query plans

This checkpoint strengthens OPT-117 with local production-code database
evidence. It does not claim a hosted staging deployment, an approved Open Beauty
Facts artifact, a complete OBF-scale run, migration-CLI compatibility, a signed
client visibility trace, or an operator rollback drill.

## Correctness Defects Closed

The prior import identity key allowed one source revision label to be paired
with multiple artifact hashes, and it did not reject a changed importer
version. That conflicted with the architecture contract that a source revision
is bound to one immutable artifact/importer interpretation.

The importer also marks products absent from a replacement snapshot as
`retired`, while catalog search continued to accept every status except
`blocked`. Barcode intake could follow an existing mapping to an inactive
product and then fall through to live OBF, potentially resurrecting a known
retired or blocked catalog row as an external candidate.

Forward migration
`20260725000054_catalog_import_identity_and_visibility.sql` now:

- fails before migration if historical `(source_id, source_revision)` duplicates
  exist;
- creates and validates a concurrent unique two-column revision index;
- returns the same import for an exact identity replay;
- rejects changed artifact or importer identity with content-free typed errors
  before changing URI, status, checkpoint, or timestamps;
- creates and validates active-only name trigram, brand trigram, deterministic
  bigram, and ranking indexes;
- replaces the three effective search predicates with `status = 'active'`; and
- drops the four broader legacy search indexes after their active replacements
  are ready.

Barcode lookup source now filters the mapped product to active status. A
focused pure/source-contract test proves the branch contract: a known mapping
whose product is inactive returns `no_match` with manual fallback before live
OBF, while an unmapped barcode retains the existing bounded external fallback.
This is not a hosted Edge-handler execution. Historical product rows and barcode
mappings remain available for Shelf foreign keys, audit, tombstone behavior,
and rollback reconstruction.

## Executed Migration Closure

The replay harness applies these migrations, in order, to a clean
`postgres:15-alpine` container:

1. `20260612000001_extensions_and_helpers.sql`
2. `20260612000003_catalog.sql`
3. `20260612000005_user_products.sql`
4. `20260614000026_phase4_catalog.sql`
5. `20260713000042_catalog_search_indexed_rpc.sql`
6. `20260718000045_catalog_import_pipeline.sql`
7. `20260718000052_catalog_search_bigram_index.sql`
8. `20260725000054_catalog_import_identity_and_visibility.sql`

The local bootstrap supplies only the Supabase-compatible roles, `auth.users`,
`auth.uid()`, and `extensions` schema required by that isolated migration
closure. The completed forward migration is then applied a second time to prove
that a nontransactional retry after function replacement is safe. Production
import functions execute through `SET ROLE service_role` and a safe
base64-backed `psql` adapter. Equivalent anon and authenticated begin/search
calls are rejected for missing function permission.

## Strict 50,000-Record Result

Environment:

- Docker Engine: 29.2.1
- PostgreSQL: 15.18
- image: cached `postgres:15-alpine`
- synthetic input records: 50,000
- accepted records: 49,950
- rejected records: 50
- canonical staged products: 49,949

The fixture includes one later duplicate canonical GTIN so latest-line-wins
behavior is exercised. Reports contain only counts, timings, migration/index
names, statuses, and query-plan node types. They contain no product payload,
barcode, source path, credential, or reject content.

## Real Failure And Replay Proof

The first batch commits in PostgreSQL and the adapter then loses its response.
The production importer's exact retry receives the durable batch receipt and
does not duplicate counters, rows, or receipts.

For the second batch, each of the importer's two attempts runs the real staging
function inside a database transaction and then rolls it back before the
adapter reports failure. The first worker stops with:

- checkpoint line: 500
- batch receipts: 1

The local checkpoint is removed to simulate a different worker. A fresh adapter
resumes solely from server truth, completes the remaining 49,500 records,
reconciles accepted/rejected/staged counts, marks the version ready, and
promotes it. Separate real database calls prove that a running version cannot
promote and that a ready version from an unapproved source cannot promote.

Identity assertions then prove:

- exact begin replay returns the same import ID;
- changed artifact hash returns
  `CATALOG_IMPORT_REVISION_ARTIFACT_MISMATCH`;
- changed importer returns
  `CATALOG_IMPORT_REVISION_IMPORTER_MISMATCH`;
- both mismatch paths leave the complete import state unchanged; and
- the unique index is ready, valid, unique, and exactly two keys.

## Replacement And Visibility Proof

A second source revision promotes a two-product replacement snapshot.
PostgreSQL proves:

- the first import becomes `superseded`;
- the second import becomes `active`;
- the active pointer references the replacement;
- exactly two source-owned products remain active;
- 49,948 products absent from the replacement become retired; and
- the predecessor ID is returned by promotion.

Active, retired, and blocked sentinels then exercise both two-character and
long-query RPC paths. Each returns only the active sentinel, while a search for
a product retired by the replacement returns zero rows.

Before replacement, with the realistic active set still present, natural
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans prove:

| Path                    | Index                                   | Products sequential scan |
| ----------------------- | --------------------------------------- | ------------------------ |
| Two-character candidate | `products_catalog_active_bigram_idx`    | No                       |
| Long substring          | `products_catalog_active_name_trgm_idx` | No                       |
| Stable top-20 ranking   | `products_catalog_active_rank_idx`      | No                       |

The brand trigram index is also valid, ready, and guarded to its exact GIN
expression/opclass, one-key nonunique shape, and active predicate. Equivalent
exact guards cover the other three indexes. The search function definition
contains exactly three active predicates and no legacy nonblocked predicate.

## Commands And Results

| Command                                                                                                    | Result                               |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `node scripts/phase4/catalog-import-postgres-replay.mjs --strict`                                          | PASS, 50,000 records                 |
| `node scripts/phase4/catalog-import-postgres-replay-smoke.mjs`                                             | PASS                                 |
| `node scripts/phase4/catalog-import-production-smoke.mjs`                                                  | PASS, existing 8-line failure matrix |
| `deno test --allow-env --allow-net --allow-read supabase/functions/catalog-lookup/catalogContract.test.ts` | PASS, 3 tests                        |
| Node syntax checks for both new replay scripts                                                             | PASS                                 |
| Exact Prettier checks for changed TypeScript/JavaScript/JSON                                               | PASS                                 |
| `git diff --check`                                                                                         | PASS                                 |

Canonical content-free report:
`docs/optimization/reports/2026-07-25_catalog-import-postgres-replay-report.json`

Because the tested files were not committed when the run started, the report
labels `e84ac8565...` as `checkpoint_parent_sha` and records SHA-256 identities
for the exact tested forward migration, importer core, and replay harness.

## Verification Boundary

OPT-117 remains `implemented`, not `verified`. The plan requires a full-scale
production-like staging rehearsal. Remaining proof includes the hosted
migration and RLS/function grants, minimum supported nontransactional Supabase
CLI behavior for concurrent indexes, a complete approved OBF artifact,
duration/storage/index-build budgets, client visibility during promotion,
production search distribution after ingestion, and an operator-owned rollback
drill that reconstructs and re-promotes the predecessor.
