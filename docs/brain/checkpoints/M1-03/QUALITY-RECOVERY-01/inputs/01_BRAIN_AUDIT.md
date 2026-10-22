# Independent Brain audit — source diagnostics partially accepted; external admission remains CLOSED

Review conducted against actual GitHub PR #9 and final pushed `6c9c280669ccce07cab0b57f7b2118ec7bbd3a35` (tree `43ab1a4a7597c8572850b98fdc420080ec834b07`), from previously independently reviewed stage `49a39b7f5b194d5c356a21c690e3f1bdb09edfa1`. GitHub main stayed `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`. Draft PR9 remains open/unmerged; PR merge checkout tree matches final stage. Final code-source observation `66ba3219549d426cbb66c7497a37948aa7d8f12e` with implementation `79db3088b42e0de2671cbeda27e1cfc0bdc3c9db`; after measured source there were no functional source changes.

## Independently reproduced on isolated Linux checkout

- New no-hardlink clone from exact HEAD, no shared `node_modules`: offline npm ci installed 1,035 packages, Node 24.19/npm 11.17, forced 6,067 root tests PASS (6,043 mobile +24 console), 0 cached tasks; forced typecheck and lint both PASS.
- Governance: **71 total; 69 PASS, 2 genuine Windows-only skips, no FAIL/ERROR**; original Security secret test fixtures **12/12 PASS**; real standalone candidate diagnostic/integrity **9/9 PASS**, PRIVATE/NON_ADMITTING.
- Strict source report and Phase 4 generated worklist both PASS in fresh clone. All **75 declared report artifacts** and 74 checksum-manifest objects matched exact committed Git blob SHA256 values. Git compare from reviewed base covers 380 files; protected SQL/RLS/Edge/workflow/Security acceptance/lockfile paths unchanged, save the authorized source-only script/test/docs below. After measured `66ba3219549d426cbb66c7497a37948aa7d8f12e` evidence/handoff-only delivery.
- Original Security 70 contract suite requires authentic historical Git objects in a fresh clone. Initial unhydrated 70 execution failed with three missing-object errors. Brain independently acquired and SHA-rehashed **16,431 authentic Git objects**, verified **3,265 witnesses /112 references /67 history endpoints**, preserved all Git refs, and reran **70/70 tests PASS** after hydration. This local contract result is separate from the ORIGINAL GitHub Security provider outcome, which remains **FAILED** and grants NO protected source Security GO.

## Exact FINAL-head provider CI (not inherited old success)

- Quality run `39715993772` **FAIL**. Repository quality job `119618228381` failed its Expo compatibility step: `expo@57.0.30` expected `~57.0.31`; `expo-network@57.0.2` expected `~57.0.3`. Expo Doctor and subsequent source checks skipped because of early failure. Original canonical credential-free DB job `119618228002` **FAIL** with `Error response from daemon: error from registry: Data limit exceeded`, during immutable ECR image acquisition. PG15/17 account-deletion jobs succeeded. Never substitute a different image or borrow older green canonical job.
- Security run `39715993860` **FAIL**: original scanners ran; secret findings unreviewed; code/npm/OSV and static enforcement red; original automated Security source acceptance red. Current unreviewed OSV include `@vitest/mocker@4.1.11`, `certifi@2026.10.18`, `mcp@1.29.0` as observed in original provider logs. **Do not alter the old exceptions/inventory/policy or equate the separate private diagnostic candidate with original Security.**
- iOS contract run `39715993847` PASS, **source-only**; no native build/signing/release permission.

## Scanner remains diagnostic-only

Exact source `66ba3219549d426cbb66c7497a37948aa7d8f12e` four original pinned rules: 19,374 paths = 12,581 scanned +6,604 unsupported +**189 failed**; 368 fixpoint warnings/events, original SQL26 omissions/TS partial parsing, **eight unreviewed findings**. Four raw bundle exit codes zero, but overall coverage EXIT1/FAIL. Neither tool adoption nor original Security GO was granted. The original source-only proposal expired `2026-10-21T00:00:00Z` and has NOT been renewed.

**Brain decision:** `PARTIAL_ACCEPTED_SOURCE_DIAGNOSTICS` for the genuine Git custody/governance/candidate test/evidence work; `FIX_REQUIRED_QUALITY_EXPO_COMPATIBILITY`. M1-03 as a whole remains BLOCKED; M2, DB06/DB08/R2B authority, original Security GO and main promotion remain false. This is a new distinct narrowly authorized Quality correction, not an extension of any previous SOURCE-CLOSURE editable-file union.
