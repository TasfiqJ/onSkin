# Engineering23 optional draft proof-scope compatibility

**COMPLETE_LOCAL_CHECKPOINT** — local implementation and validation completed. Independent acceptance remains with Brain. No unresolved implementation blocker was found. The retained first-run regression failure and its bounded diagnosis are below; it is not hidden or waived.

Authorization: BRAIN-ONSKIN-OPTIONAL-DRAFT-PROOF-COMPAT-23. Host [LOCAL_HOST]. Worktree `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\c16-candidate`. Mode LOCAL_ONLY / DEFENSIVE / ZERO_NEW_PAID_OPERATIONS.

## Exact Git identity

| State | HEAD | Tree | Status |
| --- | --- | --- | --- |
| Start | `08da2f379c487f8b56d470c7093eb6045b700204` | `ad60f0499cef4e39f906bf451d2898307b08d46d` | Clean |
| End | `8b63185db4400d43517c7e05a2e8ad8371e984ca` | `8c9a1409dbcfbfbcc5923f41382263364a5bf6fd` | Clean |

Branch remains `stage/m1-native-runtime47`. Starting direct parent `16fdc6101bd43a1a70dec51fc5a832fa580c8d4d` verified. Final direct parent is the starting HEAD. PR48 ancestor `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d` remains preserved. Exactly one append-only local source commit: `8b63185db4400d43517c7e05a2e8ad8371e984ca fix: preserve optional draft predecessor proof domains`. No competing writer was observed at admission or finalization. The final staged inventory contained only the eight expected files.

## Implemented behavior and data flow

`sourceProof` continues to hash the full raw optional-history source for exact outer CAS. The new private draft `eventPredecessorProof` comes from the same validated canonical snapshot: v5 uses its exact inner `completionBytes`; other supported sources use the existing raw completion bytes. These are intentionally distinct proof domains for v5. The canonical append/journal, `sameOptionalChangeInput41`, event hash/codec, v4 history and v5 actual-routine envelope are unchanged.

Explicit Save/Refresh captures both proofs under the existing authority-first transaction and original admitted health-write capability. Before canonical append, the accepted attempted factual content is durably saved with both proofs; submission verifies the exact saved draft, outer source/revision and both independently derived proofs in the original transaction. An existing event is recognized only with complete factual equality and exact predecessor proof. Canonical readback and the retirement transaction recheck the exact event proof, source bytes and saved-draft CAS before deleting that revision. Failed or uncertain outcomes retain recovery; no automatic duplicate append or retirement is introduced.

Private collection schema v3 supports new records and unchanged legacy v1 records. Version 2 remains unsupported because existing protected tests require refusal. Strict bounds, exact field validation, stable IDs, owner/epoch binding and content integrity remain in force. Legacy hashes are validated against their original representation. Reads never migrate, add proof, or alter historical bytes. A proof-only explicit upgrade preserves factual values, identity, target/hash, draft revision and timestamps; full-content CAS still retires older callbacks. Normal history refresh or attempted-state reset continues to advance the ordinary draft revision. Unrelated legacy records retain their original hashes and absent proof fields.

Exact legacy decision: an existing event with complete old factual equality and exact original proof can recover without another append. A matching-facts event with unprovable predecessor returns distinct `PROOF_UNVERIFIABLE`, retains the original draft, closes confirmation and allows exact-CAS explicit discard without changing history. A legacy attempted draft with no existing event cannot gain proof through Save/retry: explicit Refresh reads fresh canonical history, revalidates the exact target, clears attempted for renewed review, and requires another explicit confirmation. No proof is invented from IDs, factual text or reconstructed history. See `LEGACY_ATTEMPT_DECISION.md` for the complete matrix.

The existing panel only maps these two recovery statuses into its current refresh/review/inventory flow. No new UI journey, manual-intake feature or professional work was added. Its existing in-memory test adapter now supplies the ordinary equal-domain proof; all original assertions remain intact.

## Changed-file inventory

- `apps/mobile/src/features/today/optionalChangeDraftCodec.ts`: additive strict private schema and proof-aware reconciliation.
- `apps/mobile/src/features/today/optionalChangeDraftProof.ts`: pure, owner-bound snapshot proof derivation and explicit refresh/upgrade.
- `apps/mobile/src/features/today/optionalChangeDraftStore.ts`: explicit capture, selected-record upgrade and legacy attempted refusal.
- `apps/mobile/src/features/today/completionsStore.ts`: original-transaction proof verification before durable append; existing canonical readback/retirement preserved.
- `apps/mobile/src/features/today/OptionalChangePanel41.tsx`: distinct legacy refusal/refresh feedback.
- `apps/mobile/src/features/today/OptionalChangePanel41.test.tsx`: in-memory adapter fields only; assertions unchanged.
- `apps/mobile/src/features/today/optionalChangeDraftProof23.test.ts`: 17 pure in-memory post-fix invariants.
- `PROGRESS.md`: scoped local checkpoint entry.

`CHANGED_FILES.json` includes exact Git blob identities and SHA-256 values. `SOURCE.diff` is the exact starting-to-final patch, including new files.

## Privacy, cleanup and rights export

The existing purpose-bound key `layerwell.optionalChangeDrafts.v1`, encryption, adult eligibility, health consent, exact owner/processing epoch, lifecycle and original capability admission are unchanged. No plaintext migration, new recovery key, provider, network or telemetry behavior was introduced. Cleanup inventories already own this same key and erase opaque collection bytes; withdrawal/deletion behavior and visible retryable failures remain unchanged. Rights export uses the shared strict codec and its existing verified account-owner authority while processing is paused. It therefore accepts v1/v3 records under exact owner validation and preserves existing identity redaction; exports do not become importable backups. The directly relevant privacy/storage/export/cleanup suites passed without edits.

## Validation and retained failures

| Receipt | Result |
| --- | --- |
| focused-r1 | 98 tests, 5 required optional-change files, PASS |
| privacy-r1 | 271 tests, 7 privacy/storage/export/cleanup files, PASS |
| optional-adapter-r1 | 35 existing editor/observation tests, PASS |
| proof-invariants-r1 / r2 | 15 then final 17 pure in-memory tests, PASS |
| mobile-types-r1 | Workspace typecheck PASS |
| root-tests-r1 | FAIL: one unchanged bottle-history beforeEach setup assertion; full receipt retained |
| formula-journey-diagnostic-r1 | Same unchanged file, all 23 tests PASS |
| root-tests-r2 | Full uncached root, 8,544 tests / 577 files PASS; 3 tasks, 0 cached |
| root-typecheck-r1 | Root typecheck, 4 tasks PASS, 0 cached |
| root-lint-r1 | Configured root lint, 4 tasks PASS, 0 cached |

Final root test breakdown: mobile 7,869 / 552 files; professional 651 / 18 files; catalog operator 24 / 7 files. Root commands used `--cache=local:w --concurrency=1`, disabling cache reads and remote caching. Installed local scripts only; validation environment excluded secrets/public service settings and used offline/no-telemetry settings with a blocked service placeholder. Configured lint is mobile ESLint, tsc for the two web workspaces, and the existing types-workspace no-lint placeholder. No stronger lint coverage is claimed.

The first root run overlapped typecheck/lint and failed at the unchanged bottle-history setup's fixed 25 ms wait before a control became available. The unchanged focused file passed; the same full root command then passed alone, with no code/assertion/timeout/worker changes. This supports a resource-sensitive async setup diagnosis; it is not proof that the fixture can never flake. `VALIDATION_DIAGNOSIS.md`, both full logs and the focused diagnostic remain preserved. No protected failure is waived. All 17 final new invariants were included in both root runs. Expected existing renderer/act warnings remain in raw logs.

The protected v5 test “preserves check-offs and actual-routine bytes while adding a durable optional record inside the v5 wrapper” passes unmodified. The five requested existing test files, canonical event/journal/routine modules, frozen J01 contracts/matrices/precedence and launch contract are byte-identical to baseline, verified in `PROTECTED_SOURCE_AND_CONTRACTS.json`.

## Evidence and limits

Evidence is local only in `[LOCAL_USER_HOME]\Documents\ChatGPT\MasterV2Code\ENGINEERING23_EVIDENCE`. `BASELINE.json`, `GIT_IDENTITY.json`, `CHANGED_FILES.json`, `SOURCE.diff`, validation logs/receipts/index, proof decision, failure diagnosis, protected-source verification, prohibited-operation confirmation and this report are covered by `SHA256SUMS.txt`. Engineering22's original manifest SHA-256 and every listed file were verified unchanged; see `ENGINEERING22_INTEGRITY.json`. Its rejected source patch was not restored.

No browser journey was required by the bounded data-layer assignment. No native/physical-device, external-provider, production, independently witnessed security or release qualification is claimed. No new dependency, download, external service, cloud execution, hosted CI, push/upload/publication, paid operation, access/account change, merge/deployment/release, exploit test or crafted persisted-record injection was performed. The exact full list is `PROHIBITED_OPERATIONS.json`. No unexpected external download was observed.

All 38 requirements remain **UNACCEPTED**. All 18 gates remain **UNACCEPTED**. J01 Visible Pores remains the only Korean assessment and remains inactive/refusing positive results. Release remains **NO_GO**. Brain retains independent review and acceptance authority.
