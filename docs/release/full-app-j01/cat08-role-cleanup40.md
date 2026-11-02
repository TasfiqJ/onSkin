# Campaign40 CAT-08 deterministic cleanup source candidate

Authority: BRAIN-M1X-CAT08-ROLE-CLEANUP40-SOURCE-REPAIR-01.

**PARTIAL_BLOCKED / BRAIN_REVIEW_REQUIRED / NO_GO.**
The bounded cleanup source and independent controls are implemented. Real local
CAT-08 execution remains NOT_RUN because the installed Docker engine cannot
start and the registered Ubuntu WSL disk is missing. This source report records
the pre-seal local evidence cutoff; hosted outcomes and final delivery identities
must be recorded in the external FINAL_REPORT.md without modifying sealed source.
No technical result grants Security, database, owner or release acceptance.

## Original failure and diagnosis

The original [Quality41373530784](https://github.com/TasfiqJ/onSkin/actions/runs/41373530784)
attempt1 remains FAILURE. Its canonical DB job125048823397 completed two local
Supabase resets, all97 migrations, structural/control pgTAP, lint and empty
schema drift before the CAT-08 two-connection rehearsal. All10 race assertions
passed, but original SQL line661 failed with role dependency
`pg_temp_34.cat08_revoke_then_latch(uuid,bigint)`. SQL exited3; wrapper exited1;
the following type-parity step did not execute. The other five Quality jobs
passed. Original [iOS41373530748](https://github.com/TasfiqJ/onSkin/actions/runs/41373530748)
passed. Original Security41373530836 and candidate2941373530770 remain FAILED.

The real original DB job log was freshly fetched; its SHA256 matches the
authenticated failure fact:
`7d14c20cc4c67018790fa275731a809a43947bfa590361bbde4ae32803804c46`.
An external serialization attempt appended one newline; that failed serialized
copy is retained separately, and the exact API bytes were restored and verified
against the independent anchor. No historical failure was edited or retried.

Exact PR41/PR42 SQL is the same Git blob
`3b8bd9ea2e5336ddf92a551c561609f7b52e4b24`, SHA256
`93c9d03488f945e36887cb0f6a40cd2b254119ea593b00a07b02a6cdfd55314f`.
The original code drains remote results and disconnects, then immediately drops
the login. PostgreSQL's dblink/libpq disconnect implementation sends termination
and closes the client connection without acknowledging that the server has
removed owned temporary catalog objects. That missing synchronization boundary
is consistent with the observed role dependency and explains how disconnect
alone can be insufficient. The exact hosted scheduler timing was not locally
reproduced; it is not asserted as a measured intermittent failure mechanism.

Primary implementation references:
[dblink](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/contrib/dblink/dblink.c),
[libpq connection teardown](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/interfaces/libpq/fe-connect.c),
[shared dependency catalog](https://www.postgresql.org/docs/17/catalog-pg-shdepend.html),
[SET/RESET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html),
[dblink result draining](https://www.postgresql.org/docs/17/contrib-dblink-get-result.html).

## Bounded correction

The original first17,689 SQL bytes remain byte-identical, SHA256
`04dafe0d1769ec2ebf42cbe532d5f423c3c58b6c4d6697e078ad1bc10060663a`.
That prefix includes all10 existing assertions, exact gateway entry points,
authentication, grants, advisory locks, barriers, revocation order and four
completed asynchronous queries with their four final empty-result drains.
The protected contract still sees exactly eight dblink_get_result calls.

Only final post-assertion cleanup changes:

1. A synchronously RESET ROLEs to its session login. Both remote commands check
   session_user/current_user, actual pg_proc owner, exact regprocedure signatures
   and their own pg_my_temp_schema namespace before dropping A's queue/session
   helpers and B's revoke helper.
2. The original controller helper and exact privileges/membership are removed.
3. The controller reads pg_shdepend and requires zero references to the temporary
   role while both named connections remain alive. An omitted helper drop cannot
   be concealed by later asynchronous connection shutdown.
4. Both named dblink handles disconnect, DROP ROLE executes, and a final readback
   requires the role and both handles absent.
5. The original password/host/port clearing, controller membership revocation,
   runtime freeze and finish() suffix remains byte-identical.

Repaired SQL SHA256:
`ca5e93879ba109c5932ac1549e4b33294a279c3df3c9b2021d9529fd73c4ed89`.

No new production permission, broad cleanup, DROP OWNED/CASCADE, REASSIGN OWNED,
backend termination, arbitrary sleep, masked IF EXISTS, error suppression,
fixture-result change, removed assertion or database command change is used.
SQL errors remain fatal under the original ON_ERROR_STOP setting and default
dblink fail_on_error=true.

PostgreSQL17's role-membership implementation records a membership's grantor
as its shared ACL dependency. The implicit administration grant to a non-superuser
creator uses the bootstrap superuser as grantor; the temporary login grants no
memberships. Its creator administration lane can remain intact without making
the zero-dependency check spuriously fail. This is a primary-source analysis,
not executed canonical evidence; see the
[role implementation](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/commands/user.c).

## Independent controls and preserved attempts

The new cleanup controls pass23/23 source/verdict/environment tests. They reject
omitted A/B drops, stale signatures, wrong A role/session/function owner,
undrained commands, live dependencies, readback after disconnect, suppressed
remote errors, broad cleanup and missing post-drop absence checks. Prefix edits
to the assertion plan, expected denial, advisory lock, ON_ERROR_STOP or final
drain fail. Actual disposable child processes retain nonzero refusal exits even
when all10 protected assertion bytes remain present.

The optional hosted behavioral command runs only in the genuine checks job's
existing credential-free PostgreSQL15 service. It uses a fresh disposable
database per case, exact actual cleanup bytes, two fresh positive runs and eight
negative injections. Every case requires completed setup after actual owner
readbacks. Negative verdicts require the intended specific cleanup error, exit3
and a still-present role; setup errors cannot be counted as intended refusals.
These are cleanup-only probes, not the full10-assertion race fixture. Local
behavioral execution is NOT_RUN. Genuine hosted outcomes are required separately.

The first23-control version developed from earlier21/22-control runs. Independent
review found that generic exit3 could misclassify a setup error; explicit setup
and failure-stage binding corrected that new harness before seal. All authentic
earlier logs remain in the return. A pure verdict regression rejects setup
errors, wrong cleanup stages and wrong exits. The psql environment allowlist
excludes inherited tokens, secrets, database settings and preload flags.

Current40 passes22 unit/boundary and12 actual Git/source controls. It checks
exact parent/plan/preimages/history, finite source hashes, protected SQL prefix,
unchanged original programs and downstream Quality, complete object/index/modes/
physical working bytes, clean status, sole final two-file seal, false admissions,
real PR event/live draft/unmerged metadata, exact refs and GitHub service merge.
Synthetic events are pure test fixtures; they never approve an actual source.
Original39 CURRENT verification runs only in its separate exact PR42 checkout;
the authentic nested38/37/36/35/34/33/32/29 replay preserves historical refusals.

The actual fresh exact PR42 original39 current/source/scope proof and authentic
nested38/37/36/35/34/33/32/29 replay completed PASS, exit0, in3,077.906seconds.
The original39 nested command itself took2,659.906seconds. Full outer log SHA256
is 3d2bc453a61cde81cd1db50a5bdfc0eb6187369800ebc6378b69e50cc1d56535.
Original39 readiness refused2; original38 stale inventory refused1; original32
CURRENT on its successor refused R32_HISTORY_PHASES; original29 on its
successor refused R29_AFTER_EVIDENCE_TAIL. The genuine pinned29 checkout passed
its own checker and17positive/127refusal source controls. Original151-negative
suites retain their bundle-fixture-only qualification. No historical source,
GitHub event context or original checker was rewritten or spoofed.

Only Quality's first existing source-governance block advances to current40 and
the cleanup probes. Every downstream step, canonical database command, PG15/17,
exports and original iOS/Security/candidate workflow remains unchanged. Historical
checkers, migrations, all other tests, launch contract/inventory/producer, app,
providers, dependency locks and private F09 sources remain unchanged.

## Actual local regression evidence

Normal Node22.21.0/npm11.20.0 npm ci with mandatory hooks exited0; postinstall
checks passed all four installed patches. Root typecheck and lint passed3/3
tasks each with zero cache hits. Root tests passed6,562/6,562:6,538 mobile across
501 files and24 console across7 files, with zero cached Turbo test tasks.
Original iOS launch contract, execution-baseline check and smoke all exited0.

The unchanged local-only database source contract passed171/171. SQL policy30,
catalog authority35, canonical mirror63, share14, PAY07 admission18, trusted
entitlement21, RLS10 and recommendation DB-contract12 controls passed. These
source controls do not establish actual database execution.

Original protected core04/core06 literal-contract checks remain red10/11 and
14/15. Their assertions and privateKV source were not weakened. The initial
catalog Edge typecheck failed TS2339 at unchanged index.ts92/93 using its existing
cache; the exact command passed typecheck and40/40 tests with a new task-owned
DENO_DIR. Both outcomes remain recorded. No existing or denied cache was deleted.
A first bare-Deno-shim diagnostic failed to launch; the corrected native-Deno
test half passed40/40, separately qualified.52 protected inputs are byte-identical
to exact PR42.

The root npm test itself exited0; the external log wrapper then exited1 while
printing a Unicode check mark to a cp1252 stream. Its authentic successful test
log/receipt and wrapper failure remain distinct. Only the external display helper
was corrected; the tests were not rerun to replace their outcome.

A pre-commit whitespace check refused an extra final blank line in this new
report (diff-check exit2, commit helper exit1). It was corrected before commit.
A prematurely launched current40 SOURCE_PENDING invocation correctly refused
the still-plan-only HEAD with R40_SOURCE_REQUIRED, exit1; its log remains intact.
That refusal is not current-source approval and does not replace the later
committed-source verification.

## Source custody, seal and delivery

Exact parent HEAD `d5f3b4b46bb12a666fa793b5eaa641442db94c8e`, tree
`4ebbe4124e7aa695a4f5172ba83ebf9479ef5207`.
Immutable first plan commit `cfc2888f4baa4df58550ce1c77aa94dabd715b3c`,
plan SHA256 `cff7305b06430f80b7cc12c09af0f44b3df6d098d7f388f638fc2a07c4349865`.
All23,630 original tracked files matched raw Git blobs/index before work.
The exact12-path grant and each base mode/blob/SHA256 preimage are in that plan.

Before sealing, TASK binds stable source hashes and genuine command exits/log
hashes, including reds/NOT_RUN. The unchanged strict source-worklist writing
producer may run exactly once on clean committed source; the sole last commit
may change only its two output files. No source edit/reseal/amend/rebase may
follow. Hosted results occur after that immutable source cutoff and belong in
external final evidence, not a rewritten source report.

Only stage/m1-cat08-role-cleanup40 may be pushed. Exactly one new draft,
unmerged PR targets stage/m1-formula-route-inventory39; maintainer modifications
and auto-merge remain off. Main/predecessor branches and existing runs stay intact.
A compact return must include the factual final report, source/patches/commit
proofs, authentic logs/history/custody and an independent manifest/verifier with
external hashes. Upload and fresh read/download must be verified; otherwise
DELIVERY_BLOCKED must be reported with the real local alternative.

## Closed gates

All38 full-app/J01 obligations remain complete=false and all18 owner gates
admitted=false. V2-C02 remains a source candidate, not qualified acceptance.
G97 FAIL/NO_GO; original Security FAILED; DB06/DB08/R2B NOT_ACCEPTED;
M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED. J01 optical/
longitudinal, signed physical iPhone/VoiceOver, clinical/rights/cosmetic chemistry,
Apple, payments, providers, professional services and public release remain
CLOSED. F09 private diary/compare remains preserved; F18/J02-J27 including J05
remain deferred. No merge, deployment or release readiness is claimed.
