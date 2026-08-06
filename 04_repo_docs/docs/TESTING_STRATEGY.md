# Testing Strategy

## Principles

- Test safety-relevant logic with deterministic fixtures.
- Test launch gates so unreviewed features cannot leak into production.
- UI-facing work requires human-simulated E2E evidence.
- Device-dependent launch features require physical iPhone QA before public
  claims. Android checks are source-health/resilience work, not release evidence.
- Every Phase 2-11 validator and evidence builder reads the iOS all-features
  contract at `docs/hugeToDo/launch-contract.json`.
- Device and viewport support floors are defined in
  `docs/DEVICE_SUPPORT_POLICY.md`.

## Unit Tests

Required for:

- ingredient parsing
- tag normalization
- conflict rules and severity modulation
- PAO/expiry badges
- routine generation
- check-off persistence
- independent RevenueCat/no-card entitlement projection and reconciliation helpers
- durable store-transaction admission and recovery journal
- exact-session remote admission, controlled refresh, and synchronous closure
- privacy/consent logic
- Apple native state/nonce generation and echo, ID-token/capture composite
  admission, exact one-use authorization-code routing, lifecycle response
  bounds, and credential-state fail-closed behavior
- Apple JWS/JWKS verification, event replay/staleness ordering, encrypted vault
  AAD/key-version behavior, daily validation classification, worker secret
  authentication, and account-access coverage
- Apple terminal-event races: no-lifecycle exact Auth-identity closure,
  pre-identity keyed `unknown_subject` capture reconciliation before code
  dispatch, audience/HMAC/version mismatch rejection, no raw-subject storage,
  and duplicate promotion treated as opportunistic rather than required
- claim-safety copy scans

Example commands:

```bash
npm test
npm --workspace apps/mobile run test
```

## Integration Tests

Required for:

- shelf add -> conflict detection
- shelf add -> routine builder
- routine check-off -> progress/adherence
- RevenueCat webhook -> ordered `entitlements` projection
- subscription grant -> independent `reverse_trial_grants` lane
- bounded authenticated RevenueCat reconciliation using provider `request_date`
- owner-derived no-argument entitlement projection RPC -> combined client evidence
- purchase/restore -> durable transaction journal -> confirmed promotion or blocked retry
- Supabase RLS owner isolation
- account deletion/export, including delayed export versus sign-out/A-to-B,
  exact server owner, post-write invalidation, same-user refresh, central remote-admission
  closure, RevenueCat drain, and durable deletion handoff
- Apple capture -> encrypted lifecycle -> daily validation -> access fence;
  native/server-event invalidation -> session denial -> durable deletion
- catalog lookup/search/report
- catalog operator session/queue/detail/claim/transition/release, including
  nonanonymous `aal2`, live Auth-session and verified-factor checks, exact
  immutable capability grants, ten-minute work sessions, five-minute leases,
  UUIDv4 idempotency, compare-and-swap/advisory-lock races, role separation,
  immutable minimized audit, reporter erasure with persistent independent
  holds, exact current CAT-02 plus signed staged CAT-03 successor authority,
  four-person repair/release separation, and post-release CAT-03 reactivation
- catalog operator gateway isolation, including the dedicated transaction-
  pooler login's exact schema/function ACLs, nonsuperuser and membership/
  ownership-free state, absence of raw table/sequence/Auth/control access,
  verified-full hosted TLS, default-frozen exact deployment admission, and
  all-action global plus per-action class rate budgets
- catalog approved-transform -> sealed staging -> complete row review ->
  transactional promotion -> serving verification -> non-destructive rollback,
  including exact replay, changed replay, duplicate keys, partial chunks,
  source withdrawal, and retained shelf/correction references
- catalog promoted projection -> signed CAT-03 curation -> non-serving product
  authorization staging -> exact-set atomic campaign release -> signed readback ->
  positive serving authorization -> retirement, including target-policy and
  pre-holdout commitment tampering, incomplete four-scope CAT-02 membership,
  holdout tampering, privacy suppression/differencing, reviewer conflicts,
  inventory/category-floor/priority shortfalls, incomplete ingredient dependencies,
  sunscreen/US-OTC review gaps, direct flag mutation, direct service-role table
  access, authenticated RLS allow/deny regressions, successor-campaign leakage,
  omission/supersession races, projection drift,
  correction/source-withdrawal races, and changed replay. Adversarial coverage must
  also reject duplicate target-lineage artifacts, product-fact memberships assigned
  to a secondary artifact, activation-first or backdated review signatures, a
  tampered reviewer-signature-set root, reviewed barcode aliases, mutations and
  insertions/deletions in every client-readable served-state relation, and a true
  two-session record-insert-versus-release race. Correction-hold close, source
  reapproval, and batch restoration must not resurrect an invalidated record.
  Tests must race each invalidating mutation against record insertion and campaign
  release under the global-then-campaign lock order, then prove that only a newly
  reviewed successor record/campaign/readback can recover serving. The same rule
  applies to arbitrary exact mutation-and-restoration of every sealed served-state
  relation and to mutation/withdrawal that occurs before record insertion: an old
  reviewer-signed mutation root must be rejected, while a newly reviewed current
  root may recover.
  Vary the database session `TimeZone` and require identical product, dependency,
  campaign, record, and mutation authority hashes. Correction tests must prove
  that user identity, barcode, free text, arbitrary JSON, and resolution-only
  edits do not enter or advance the permanent mutation chain, while every change
  to the bounded serving-hold projection does.
  Direct `public`, `anon`, `authenticated`, and `service_role` probes must all
  fail against unreviewed `conflict_rules`, `sequencing_rules`, `creator_stacks`,
  and `creator_stack_items`; a future reviewed-content lane needs its own positive
  publication contract and may not inherit any legacy active-row policy.

CAT-03 report tests must use integer-only bounded aggregates, participant-capped
observations, small-cell plus complementary suppression, a release-overlap guard,
prospectively fixed targets, and one-sided confidence bounds with minimum sample
sizes. Tests must prove that the legacy beta report, dashboard URLs, typed names,
hash-shaped strings, raw shelf labels, and beta demand cannot authorize catalog
facts or serving. Production acceptance additionally requires the sealed untouched
holdout, real consented cohort evidence, at least 2,000 reviewed/eligible records
with every category floor and at least 100 prioritized rows, an independently signed
exact database readback, and a reviewed two-session hosted staging/release/
supersession/retirement/concurrency drill.
Tests must also prove that retirement, successor release, dependency withdrawal,
or review expiry makes the prior point-in-time readback historical and requires a
new exact campaign/readback before final-clear can be reported again.

The checked-in `phase4:catalog-serving-contract:test` Deno gate must execute in
local Phase 4 verification and CI. It statically proves that barcode/search use
only the bounded service RPCs, every serving lane reconstructs the exact global
campaign release plus product authorization, `service_role` has no direct-table
read, authenticated safe-table reads retain their positive RLS grants, barcode
access is primary-only, and every live served-state hash covers the complete exact
readable projection rather than a hand-picked subset of fields.

## 2026-07-15 Source Checkpoint

The prior fully verified source checkpoint passes:

- PostgreSQL 15 and 17 account-publication and entitlement-authority rehearsals.
- The combined database run completed two clean local Supabase resets across all 53
  migrations through `20260715000054_health_consent_withdrawal_lifecycle.sql`, plus 261
  pgTAP assertions (46 schema + 215 health-consent lifecycle), 77/77 public tables with RLS,
  an exact 54-private-table classification (40 directly queryable + 14 sealed), database lint,
  and an empty shadow diff.
- Subscription reconciliation 20/20, subscription grants 8/8, atomic RevenueCat webhook
  20/20, durable account deletion 215/215, and the focused mobile server contract 2/2.
- Health-consent Phase 9 verification: 104 Deno tests plus 7 evidence tests.
- Mobile workspace verification: 266 test files / 3,026 tests, typecheck, and lint.

These results prove the prior source contracts only. They do not close hosted migration/Cron/Vault,
live Supabase or RevenueCat, App Store sandbox/TestFlight, provider interruption and
recreation, physical-iPhone, professional-review, privacy/legal, or App Review gates.

The subsequent migration-0055 source candidate implements initial Apple
authorization-code plus state/nonce capture, owner/subject/client-bound
encrypted token storage, daily refresh-token validation, canonical signed
server-notification ingress, native invalidation, and an authoritative exact-session
access fence. Focused tests cover the mobile permit/capture contract, Apple network and
worker classifications, signed-event verification/idempotency, encrypted keyrings,
database lifecycle/RLS behavior, authenticated Edge coverage, account-deletion vault
reuse, and the 60-second export URL bound. Apple `TRANSFERRED` remains a tested
fail-closed `credential_transferred` result, not an approved transfer policy.

The current post-0055 local gate passed two clean resets, exact 54-migration
history, the full structural pgTAP suite plus 114/114 Apple lifecycle
assertions, schema lint, an empty migration shadow diff, temporary type
generation, 20/20 focused Apple event/lifecycle Edge tests, and the 47-test
Apple auth work lane. That post-0055 checkpoint's full mobile suite also passed
282 test files / 3251 tests. The race assertions include terminal-before-lifecycle,
terminal-before-identity, capture-time no-retry reconciliation, and no code
dispatch after the committed `blocked` result.

Release testing must still deploy the coherent candidate to a reviewed hosted project
and prove fresh and existing-account capture, real Apple code exchange, registered event
delivery, Vault/Cron continuity, key rotation/rollback, exact stale-JWT denial across
RLS/Storage/Edge/direct RPCs, provider outage recovery, physical-iPhone/TestFlight, and
deletion. Vault and subject-HMAC keyrings allow up to three overlapping versions, and
each successful daily validation must atomically re-derive the current subject digest
and freshly seal the token under the current vault key. Dormant, deferred, and failing
rows do not advance from configuration alone, so old-key retirement still needs
zero-row evidence or fail-closed recapture/reauthentication. Subject-key
retirement must also prove zero unresolved terminal `unknown_subject` rows for
that version, or a reviewed reconciliation/disposition, so the no-retry bridge
cannot be orphaned. The non-destructive health-consent withdrawal source
contract now has local two-reset and focused test evidence;
reviewed hosted worker/Storage/backup, two-device, physical-iPhone, and professional evidence
remain open. The exact privacy report, policy/support URLs, and
non-expiring demo review access also remain launch blockers.

## 2026-07-29 CORE-06A Source Checkpoint

The current 2026-08-04 mobile verification passes TypeScript and 336 mobile
test files / 4,183 tests. The prior full repository baseline also passed strict
lint and the catalog operator console's 7 files /
24 tests. Focused recommendation-admission verification additionally passes
the CORE-06 source and static database contracts, the complete recommendation
mobile slice, the launch contract, the Phase 7 packet-inventory contract, and
the Phase 9 RLS/policy code gates.

These counts and code gates are local source facts. They do not establish a
clean release-candidate evidence chain, hosted Supabase behavior, native iOS
archive or physical-device behavior, professional legal/clinical/privacy
clearance, App Review acceptance, market demand, or revenue.

## E2E Tests

Human-simulated E2E is required for UI-facing work.

Priority flows:

1. First-run onboarding.
2. Shelf product add.
3. Conflict detail and override.
4. Today routine completion.
5. Progress photo capture/review.
6. Paywall purchase/restore.
7. Settings privacy/export/delete.
8. Apple sign-in/linking cancellation and success, capture ambiguity, relaunch,
   revoked/not-found/transferred state, same-owner recovery, account switching,
   and deletion.
9. Cloud Ask consent, refusal, citation, quota, and outage recovery.
10. Commerce consent, safe retailer handoff, and disclosure.
11. Community post/report/block/contact and moderator recovery.
12. Trend opt-in, processing limits, fairness disclosure, and withdrawal.
13. Widgets, Live Activities, notifications, links, sharing, creator links,
    review prompt, and operator workflows.

The CAT-08 operator workflow requires a separate internal-console pass. Cover
email OTP plus mandatory TOTP, denied/expired/revoked access, queue empty/
loading/error states, bounded cursor navigation, claim/reclaim, stale CAS,
triage and immediate serving hold, accepted and rejected dispositions without
release, reporter erasure with the hold retained, exact repair receipt handoff,
fourth-person release, post-release non-serving and fresh CAT-03 reactivation,
visible verified operator/capabilities/environment/build revision,
server-authoritative incident/freeze denial, relaunch, and sign-out. Inspect
the private append-only audit through a separately authorized backend evidence
procedure; schema v1 exposes no console audit-export action. Expo web or
the consumer iOS app is not the CAT-08 console surface.

Reference:

- `docs/HUMAN_SIMULATED_E2E_TESTING.md`
- `docs/USER_FLOW_TREE.md`
- `docs/E2E_TESTING_CHECKLIST.md`

## Manual QA

Manual QA must cover:

- supported compact iPhone layout from `docs/DEVICE_SUPPORT_POLICY.md`
- large text / Dynamic Type
- dark/light mode
- network offline
- camera permission denied
- notification permission denied
- direct-entry route back/close behavior
- relaunch persistence
- accessibility labels and touch targets
- stress-only 320 x 568 / 480 / 430 / 390 / 370 / 360 browser viewports when
  they protect critical flows, without treating those sub-floor sizes as launch
  blockers

## Security Checks

Run or maintain:

- RLS smoke/adversarial tests.
- Two-reset full migration replay, pgTAP, database lint, and empty shadow diff.
- Catalog lifecycle ACL and lineage tests: fixture/candidate rejection,
  zero-warning QA binding, exact clean-HEAD authority-file inventory,
  SQL/JavaScript canonical normalized-record parity, per-field receipt-tamper
  rejection, contiguous stage digests, immutable reviews and revisions,
  advisory-lock ordering, all-or-nothing promotion, direct service-role DML
  denial, positive ingredient/source read gates, and non-destructive batch
  rollback. Hosted evidence must add two independent sessions and retry
  complete transactions on serialization failure.
- CAT-08 operator-authority tests: deny `anon`, ordinary authenticated,
  anonymous, `aal1`, stale/revoked Auth session, missing verified factor,
  inactive/expired/wrong-capability grant, expired operator session, wrong or
  expired claim, stale CAS, and role overlap; deny raw protected-table access to
  every API role and the dedicated gateway login, revoke legacy service-role
  correction read/review, and prove only the dedicated role can execute the six
  non-Data-API gateway functions under an exact open runtime tuple. Prove the
  login is nonsuperuser, membership/ownership-free, has no Auth-schema lane,
  and uses CA/hostname-verified hosted transport. Prove an all-action committed
  global preflight and per-action class limits, including ungranted-session
  attempts. The isolated local two-reset gate must execute the committed
  two-connection `dblink` rehearsal and prove action-first plus
  session-revocation-first gateway commit ordering. Retain a separate real hosted
  renewal/action/revocation-ordering transcript;
  preserve a reporter-free hold and served-state mutation event after personal
  correction erasure; and reject release without an exact current product,
  CAT-02 repair receipt, signed structurally valid staged CAT-03 successor over
  the active-hold root, no competing hold, and four distinct people. Prove
  release advances the root without activation and requires a fresh CAT-03
  owner campaign/activation/readback before serving. Run the same lease,
  transition, erasure, and release cases with independent hosted sessions.
- Sealed Apple table/function ACL tests; active/non-Apple/blocked/stale-session
  RLS and Storage tests; direct authenticated RPC fence tests; and terminal
  Apple-event-to-deletion assertions.
- Apple lifecycle Edge tests for exact request/response schemas, nonce and
  subject verification, code single use, vault AAD/tampering/key overlap,
  worker secret negatives, daily validation/defer/invalidate outcomes, signed
  event JWKS caching/replay/staleness, and account-deletion vault reuse.
- Database tests for event-before-lifecycle and event-before-identity races must
  prove one owner under the account-deletion lock, a terminal no-vault lifecycle,
  six-step deletion reuse, session destruction, losing-capture `blocked` before
  exchange dispatch, exact audience plus paired HMAC/key-version matching, and
  no plaintext subject in lifecycle/event rows. The test must not assume Apple
  delivers a duplicate event.
- Central exact-session remote-admission tests covering controlled refresh, synchronous
  closure, child-request settlement, account replacement, and deletion handoff.
- Independent entitlement-lane, owner-derived projection, provider-watermark, and durable
  transaction-journal adversarial tests.
- privacy payload audit.
- edge auth smoke.
- dependency inventory/SBOM.
- account deletion and data export smoke.

Hosted Apple verification must additionally retain redacted evidence for the
registered primary-App-ID endpoint, actual signed event delivery, exactly one
one-minute Vault-backed Cron job, worker interruption and recovery, 72-hour
fail-closed behavior, existing-account recapture, and 60-second photo signed
URL expiry. Source mocks or manually posted lookalike JWS values cannot satisfy
Apple-delivery evidence.

## Generated Evidence Checks

Generated launch packets record whether source files were dirty when the packet
was produced. A packet builder may exclude only its own exact output path or
pair; every other dirty governed output remains visible. Phase 3/4 source
snapshot builders retain their dedicated pre-S semantics. After final
readiness commit `F`, run:

```bash
npm run docs:generated-packet-status-audit:check
```

That audit is the final non-writing gate that proves committed generated packet
hashes are current and no packet records dirty source evidence.

The packet-writing `phase9:verify` workflow is pre-S evidence collection.
`phase10:verify`, `phase11:verify`, and `phase10-11:verify` are source-safe,
non-writing readiness workflows and never batch governed packet writers.
Publish each Phase 10/11 post-E unit separately, in evidence-DAG order, from the
required clean committed prefix: `phase10:support-handoff:strict`, then
`phase10:beta-packet:strict`, then `phase11:launch-packet:strict`. Commit each
unit before invoking its dependent writer so exact-own-output Git filtering
cannot conceal a dirty upstream packet.

## Non-Mutating Launch Readiness Sweep

Use the root readiness sweep after source changes that should not rebuild
packets:

```bash
npm run launch:verify
```

This command first checks the exact third-party privacy patch, installed-source
audit, typed archive evidence index, release-candidate Git provenance, active
package/CI wiring, and non-writing store inspector. It then runs the
source-packet, Tas-owned blocker, strict brand, performance-readiness source
snapshot, readiness/device/human source contracts, and Phase 5 evidence
template/smoke checks; the Phase 5 native config guard; the Phase 7 core-loop
and Phase 8 growth/store code gates; Phase 9 release smoke, Phase 10
beta readiness, Phase 10 beta analytics audit, Phase 11 launch readiness, and
launch ring gates; then typecheck, lint, and tests. It does not replace the
phase packet builders after generated evidence changes.

The current root sweep must include these non-mutating gates:

- `npm run docs:source-packet-audit:check`
- `npm run phase9:view-shot-privacy:check`
- `npm run phase9:view-shot-privacy:test`
- `npm run phase9:ios-privacy-source-audit:test`
- `npm run phase9:ios-privacy-source-audit:check`
- `npm run phase9:ios-archive-privacy-evidence:test`
- `npm run phase9:release-candidate-git-contract:test`
- `npm run phase9:verification-wiring:test`
- `npm run phase9:store-build-inspect:check`
- `npm run docs:tas-todo-audit:check`
- `npm run docs:readiness-status-audit:test`
- `npm run brand:audit:strict`
- `npm run docs:device-support-policy-audit:test`
- `npm run docs:performance-readiness-audit:check`
- `npm run e2e:human:manifest:contract:test`
- `npm run phase5:check-native-config`
- `npm run phase5:widget-runtime-contract:smoke`
- `npm run phase5:native-ocr-evidence:smoke`
- `npm run phase5:native-ocr-evidence:template:check`
- `npm run phase5:camera-lifecycle-evidence:smoke`
- `npm run phase5:camera-lifecycle-evidence:template:check`
- `npm run phase5:performance-evidence:smoke`
- `npm run phase5:performance-evidence:template:check`
- `npm run phase5:widget-lifecycle-evidence:smoke`
- `npm run phase5:widget-lifecycle-evidence:template:check`
- `npm run phase7:check-core-loop`
- `npm run phase8:check-growth-store`
- `npm run phase10:beta-analytics-audit`

After final readiness commit `F`, run
`npm run release:governed-packets:check`. That aggregate performs all 16
implemented deterministic non-writing replays in dependency order plus their
focused contracts. It never reruns live/mutating evidence collection. Store
build inspection remains a separately labelled current-state inspection,
because its check mode does not replay the committed singleton bytes.

## Performance Checks

Monitor:

- app startup time
- product add time
- barcode lookup latency
- routine generation time
- local photo loading
- memory use in photo timeline

Performance readiness is not closed by local unit tests. Before closed beta,
record baseline measurements on supported physical iPhones and
attach the measurement artifact, device model/OS, build ID, and named owner
signoff in `docs/FOR_TAS_TO_DO.md`. Thresholds must be defined before
measurement, and each required metric needs at least five raw samples per
required platform. The validator calculates nearest-rank p50/p95 and max from those
observations and rejects mismatched hand-entered summaries. Use the blocked
template and strict validator documented in
`docs/phase-5/performance-evidence-runbook.md`:

```bash
npm run phase5:performance-evidence:template:check
PHASE5_PERFORMANCE_EVIDENCE_PATH=/path/to/performance-evidence.json \
npm run phase5:performance-evidence:summarize
PHASE5_PERFORMANCE_EVIDENCE_PATH=/path/to/performance-evidence.json \
npm run phase5:performance-evidence:strict
```

The non-mutating documentation and contract guard is:

```bash
npm run docs:performance-readiness-audit:check
```

That audit verifies the performance evidence contract, template, validator,
smoke coverage, and launch wiring remain current. It does not replace the real
device measurements required by `phase5:performance-evidence:strict` or later
beta telemetry.

## Accessibility Checks

Required:

- minimum 44 pt tap targets
- no color-only meaning
- VoiceOver labels
- focus order
- text reflow
- Reduce Motion behavior

## Commands Placeholder

```bash
npm run typecheck
npm run lint
npm test
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test
npm run phase2:rls-smoke
npm run phase9:apple-auth-work-lane-smoke
npm run phase3:audit-copy
npm run phase4:qa-report
npm run phase4:operator-authority-contract:test
npm run phase4:catalog-operator-edge:test
npm run phase4:catalog-operator-edge:format:check
npm run phase4:catalog-operator-console:verify
npm run phase5:qa-packet
npm run phase6:qa-packet
npm run phase7:qa-packet
npm run phase8:qa-packet
npm run brand:audit:strict
npm run launch:verify
npm run phase9:verify
npm run phase10:verify
npm run phase11:verify
```

Use strict variants only when live environment variables and evidence are available.
