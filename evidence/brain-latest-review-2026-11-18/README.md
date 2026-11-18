# onSkin MasterV2 — latest independent Brain review

Authorization **BRAIN-ONSKIN-LATEST-EVIDENCE-RELAY-001**. Latest completed local source: **Engineering27R**.

- HEAD: `efd3af803a2a71bd2fdd644ecfd500c619fb996c`
- Tree: `83670a073910a840c69368f1760d5cb59d021054`
- Branch: `stage/m1-native-runtime47`; clean, source/index preserved.
- Published PR48 ancestor: `d292743c99c1fb98f5714789f4fd60fb1e7d5a5d`; draft PR48/main/application remote ref preserved.
- Engineering19 ancestor: `2f699f6157c1d6414b7e74661a4e11e89a77ed92`;11 later commits,144 verified raw commit objects/143 parent edges.
- All38 required requirements and18 gates **UNACCEPTED**. Release **NO_GO**. Exactly one Korean assessment: **J01 Visible Pores**, positive result admission closed.

## Review documents

| Evidence | Readable file |
| --- | --- |
| Exact source identity/lineage | [CHECKPOINT.json](CHECKPOINT.json) |
| Complete engineering/architecture/current-state report | [FINAL_REPORT.md](FINAL_REPORT.md) |
| Individual38 requirements and18 gates | [ALL38_ALL18_MATRIX.md](ALL38_ALL18_MATRIX.md), [JSON](ALL38_ALL18_MATRIX.json) |
| Security/privacy inspection, repairs and potential risks | [SECURITY_PRIVACY_REVIEW.md](SECURITY_PRIVACY_REVIEW.md) |
| Defects, failures and release blockers | [OPEN_DEFECTS_AND_RELEASE_BLOCKERS.md](OPEN_DEFECTS_AND_RELEASE_BLOCKERS.md) |
| Real test/build/browser logs and receipts | [TEST_EVIDENCE_INDEX.md](TEST_EVIDENCE_INDEX.md), [combined current receipts](CURRENT_RUN_RECEIPTS.json) |
| Native/physical/external qualification | [NATIVE_AND_EXTERNAL_QUALIFICATION.md](NATIVE_AND_EXTERNAL_QUALIFICATION.md), [complete existing native ledger](frozen-reference/NATIVE_EXECUTION_LEDGER47.md) |
| Actual current code | [Ordered cumulative and recent patch parts](PATCH_INDEX.md) |
| Forward/reverse exact Git tree verification | [PATCH_VERIFICATION.json](PATCH_VERIFICATION.json), [verifier](verify_trees.py) |
| Portable raw commit ancestry | [COMMIT_ANCESTRY_WITNESS.json](COMMIT_ANCESTRY_WITNESS.json), [all commit/tree/parent index](ANCESTRY_INDEX.md), [independent verifier](verify_ancestry.py), [local result](ANCESTRY_VERIFICATION.json) |
| Complete technical changed-file inventory | [CHANGED_FILES.json](CHANGED_FILES.json), [all11 newer commits](COMMITS_SINCE_ENGINEERING19.json) |
| Safety and sanitization | [PUBLICATION_SAFETY_REVIEW.md](PUBLICATION_SAFETY_REVIEW.md), [JSON](PUBLICATION_SAFETY_REVIEW.json) |
| Original evidence inventories | See complete payload indexes below for HISTORICAL_ORIGINAL_INVENTORY parts; [historical manifest verification](HISTORICAL_MANIFEST_VERIFICATION.json), [current original inventory](CURRENT_ORIGINAL_INVENTORY.json) |
| Publication safeguards | [initial GitHub preflight](publication/GITHUB_PREFLIGHT.json), [recheck](publication/GITHUB_RECHECK.json) |
| Next Brain decision / continuation prompt | [BRAIN_NEXT_DECISION.md](BRAIN_NEXT_DECISION.md) |

## Integrity and reconstruction

All new files are readable UTF-8 with no NUL, each at most240KiB (245760bytes). Larger files are fully split into ordered parts. **No source patch is truncated or altered**. [MANIFEST.json](MANIFEST.json) pins each shard's size/SHA256; shards pin every original/reassembled file, its original/published size/SHA256, redactions, part order and every part's size/SHA256. The manifest root itself is authenticated by its immutable Git commit/blob; it cannot recursively hash itself. No large binary ZIP is added. Previous evidence blobs are preserved unchanged.

Download this directory keeping relative paths, then run with installed Python (standard library only):

```text
python verify_evidence.py /path/to/evidence/root /new/reconstructed/directory
python verify_ancestry.py /new/reconstructed/directory/COMMIT_ANCESTRY_WITNESS.json
python verify_trees.py /path/to/existing/onskin/repository /new/reconstructed/directory
```

First command validates every manifest shard/file/part, complete file set, byte-exact reassembly and original hashes for unmodified files. Second verifies Git commit-object bytes/hash/tree/all parents/selected path offline without Git/network. Third uses isolated temporary Git indexes to verify both patches forward and reverse against the exact base/current trees, without checkout/reset/branch/index changes. It requires exact base objects locally; no network or active source mutation is used. Preserve raw newlines when fetching text.

Current clean-source root8652tests/579files and focused490/13 PASS; typecheck/lint and consumer/professional web builds PASS. Consumer manual/optional/recovery375/390/430 and professional queue/owner375/430 PASS in actual local Edge. The original optional driver failed on an obsolete collapsed-heading navigation predicate; its full failure and the external evidence-only adaptation/pass remain. Initial invalid Turbo argument failures and every selected historical failure/NOT_RUN remain. No full native/device/security/clinical acceptance follows from these results.

Historical E20–E27R text is complete, with explicit source identity/dirty-state limits. E21–E27R original manifests verify; E20 snapshot is independently hashed. Binary screenshot files are omitted with original size/hash inventory; existing actual text DOM/state/network receipts remain. Original hash fields inside historical/current receipts refer to original unsanitized bytes; manifest records explicitly map to sanitized publication hashes. No real patient/customer/credential material is selected.

## Complete readable file index

The following ordered pages link **every payload file and every split part**, including historical reports, scripts, test/build/browser logs, failures and receipts. This README, the index pages themselves and all manifest shards are directly linked here, completing the publication file index.

- [Payload file index 1](indexes/FILES-001.md)
- [Payload file index 2](indexes/FILES-002.md)
- [Payload file index 3](indexes/FILES-003.md)
- [Payload file index 4](indexes/FILES-004.md)
- [Payload file index 5](indexes/FILES-005.md)
- [Payload file index 6](indexes/FILES-006.md)
- [Payload file index 7](indexes/FILES-007.md)
- [Payload file index 8](indexes/FILES-008.md)
- [Payload file index 9](indexes/FILES-009.md)
- [Payload file index 10](indexes/FILES-010.md)

Manifest shards (ordered; exact hashes in MANIFEST.json):

- [FILES-001.json](manifests/FILES-001.json)
- [FILES-002.json](manifests/FILES-002.json)
- [FILES-003.json](manifests/FILES-003.json)
- [FILES-004.json](manifests/FILES-004.json)
- [FILES-005.json](manifests/FILES-005.json)
- [FILES-006.json](manifests/FILES-006.json)
- [FILES-007.json](manifests/FILES-007.json)
- [FILES-008.json](manifests/FILES-008.json)
- [FILES-009.json](manifests/FILES-009.json)
- [FILES-010.json](manifests/FILES-010.json)
- [FILES-011.json](manifests/FILES-011.json)
- [FILES-012.json](manifests/FILES-012.json)
- [FILES-013.json](manifests/FILES-013.json)

## Permanent link semantics and publication checks

Open this README through the **full final evidence commit SHA** supplied in the delivery response. Every relative file link above then resolves to that same immutable commit. A commit cannot embed its own final hash without changing that hash; commit-context relative links avoid mutable branch URLs. The founder delivery response supplies absolute commit-pinned URLs to the index, report, matrix, patches, ancestry and tests.

All preparation and checks precede the one evidence-only `[skip ci]` commit on `brain-latest-review-2026-11-18`, parent303538aadb990e0f6f5e56c926b874ca54ec1085. Evidence tree contains no workflows; default-main push filters, no create trigger, visible rules/hooks and existing local hooks were inspected. No PR, hosted/manual CI, native job, paid API/storage service, LFS, Codespace, deployment, merge, release or account/billing/permission change is initiated. Actual postpublication full API/raw readback, manifest reassembly/ancestry, source/PR48 preservation and all-event Actions observations are independently performed before COMPLETE delivery. Postpublication receipts remain local to avoid a second self-referential evidence commit; the final response reports actual outcomes and exact final SHA. Evidence is for review only; no next engineering campaign starts here.
