# Engineering29R recovery, driver repairs and final validation

**COMPLETE_VALIDATED_CHECKPOINT** — required local checks completed at the repaired exact checkpoint. Product/release acceptance remains closed.

Authorization: BRAIN-ONSKIN-ENGINEERING29R-VALIDATION-001. Local only; no new paid operations.

## Source identity

| Identity | Starting checkpoint | Final checkpoint |
|---|---|---|
| HEAD | b29e731097984be98f5b06024d11255dbb732809 | 68dc086743f6c7f8b2ea8706aa973b27328b7814 |
| Tree | bb63940c79e1fde4c946c8162f401baeac2b90c1 | 613b11c549f4a46901c2ba819fb3db5a3d40ba61 |
| Branch | stage/m1-native-runtime47 | stage/m1-native-runtime47 |

The worktree was clean initially and after each commit; every final command records clean before/after source identities. PR48 baseline d292743c99c1fb98f5714789f4fd60fb1e7d5a5d remains an ancestor. Two append-only local source commits were necessary:

- db5f6ed1acacdb9e8dafb28615913f818891cd8b — align the Diary driver with the existing truthful incomplete-storage refusal.
- 68dc086743f6c7f8b2ea8706aa973b27328b7814 — explicitly open optional history and handle confirmed absent prior completion bytes.

Only four files under scripts/e2e changed: onboarding-first-session.mjs, onboarding-first-session35.test.mjs, optional-change41.mjs and optional-change41.test.mjs. Application runtime, configuration, authority, storage, encryption, grants and product behavior are unchanged. All125 consumer build artifacts and all4 professional build artifacts are byte-identical between resumed b29 and the final checkpoint; see [comparison](BUILD_RUNTIME_COMPARISON.json).

No reset, rebase, amend, source replacement, competing worktree, application-source push, PR48/main change, merge, deployment or release occurred. App thread/process/lock observations found no competing candidate writer; this is an observation, not an OS-enforced editor lock. The active index is unchanged by isolated patch verification and publication.

The immutable [Engineering29 evidence](https://github.com/TasfiqJ/onSkin/blob/3e52d582c88310e664fbcb777496468195407742/evidence/engineering29-review-2026-11-18/README.md) remains the prior source/failure record. Because source repairs were necessary, this packet includes complete current cumulative PR48-to-final and b29-to-final session patches, updated exact Git-tree verification, and the portable raw ancestry witness.

## Storage recovery

Before owner intervention C: had311,701,504 free bytes. At resume on November19,2026 at11:24 Toronto, C: had **140,042,207,232 free bytes** of999,045,459,968. Immediately before the first resumed Expo export:158,855,897,088 free bytes. Before the final68dc root suite:157,982,093,312. Final local-validation observation: **157625724928 free bytes**. Capacity varied during the session.

No automated capacity-recovery deletion or relocation, cache clearing, dependency reinstall or permission/security change occurred. Normal harness cleanup only stops owned processes and removes newly created temporary browser profiles; protected existing source/evidence/user files were not cleaned. Only C: and protected EFI/reserved/recovery partitions were present. Fresh Engineering29R paths hold new build outputs and evidence. Installed CLI help confirms Expo --output-dir and Vite --outDir are output-location options; build mode and app semantics are unchanged. No --clear or --emptyOutDir was used; Vite declined to empty its external output directory. A10-GiB margin was enforced before every validation command. Offline/no-telemetry/no-dotenv settings and removal of inherited external credentials keep these runs local. Independent browser groups use distinct local ports and fresh browser profiles.

## Demonstrated harness defects and repairs

1. **Diary copy assertion.** The b29 extended375 run stopped before optional changes because an obsolete assertion required “Your photos and notes were not changed.” The actual screen correctly warned that private storage could not confirm a complete timeline and recovery work might be unfinished; its retry was enabled and hittable. The driver now requires that exact existing truthful refusal, rejects the obsolete unconditional claim, retains both no-paywall checks and strengthens retry role/enabled/hit checks. Nine additive cases cover the current state and refusal branches. No app copy was changed.
2. **Collapsed entry mistaken for history.** The collapsed teaser and expanded history share a heading. The driver now explicitly opens history and waits for the existing Refresh changes control, present for both empty and populated history. The original Nothing recorded assertion remains. Five additive IO cases require actual open/wait and preserve read/open/wait failures. A search-field readiness probe failed because that field exists only for nonempty history; that failed probe is retained.
3. **Absent journal dereference.** For a fresh owner, actual prior completion bytes can be null. The driver now treats only confirmed null as no prior events, refuses unsupported/non-array evidence and retains every original-event preservation check when a prior journal exists. Five additive cases cover first check-off, preserved originals, missing/changed originals and malformed evidence. The real later checkbox interaction supplies the new journal; no original records or authority are fabricated.

RED results: Diary72 cases/2 failures; entry15 cases/3 failures; absent journal20 cases/1 failure. Final GREEN:96/96 driver/retained-safety cases. A complete targeted375 browser passed against a recorded stable working diff before the second commit. Every required test/build/affected browser suite was then rerun at the clean final68dc HEAD/tree; earlier b29/db5 or dirty diagnostics were not substituted.

A supplemental --daily-loop probe stopped at its manual-intake setup with Add to shelf disabled. It remains a failed separate setup probe, prompted no broad product repair, and supplies no required acceptance evidence. Final optional-history runs use --optional-change41 --optional-history-recovery15; they verify genuine fresh-owner journal absence and the subsequent actual visible check-off. The separate daily-loop/manual-intake driver is not claimed passing and needs setup review before reuse.

No timeout was increased, test skipped, security/authority gate loosened or synthetic professional/provider authority converted into production authority. Existing lineage, ownership, no-paywall, encrypted-storage and privacy assertions remain; the changes correct driver assumptions and add negative cases.

## Final exact-source results

| Check | Actual result |
|---|---|
| Uncached root tests, --force | PASS:8,708 cases /584 files;0 cached tasks |
| Root typecheck, --force | PASS:4 tasks;0 cached |
| Configured root lint, --force | PASS:4 tasks;0 cached; types package explicitly has no lint configured |
| Consumer Expo web export | PASS, exit0 |
| Professional Vite production build | PASS, exit0 |
| Original focused privacy/storage/consent subset | PASS:532 cases /17 files |
| Professional source/mapping/authority/custody suite | PASS:688 cases /21 files |
| Consumer actual routine/optional history/navigation/recovery/consent/commit-fence suite | PASS:361 cases /25 files |
| Driver/retained-safety regressions | PASS:96 cases |
| Connected exact template mapping | PASS:375×667,390×844,430×932 |
| Consumer uncertain-apply outcomes | PASS:375×667,390×844,430×932 |
| Professional owner | PASS:375×667,430×932 |
| Consumer durable optional drafts/history | PASS:375×667,390×844,430×932 |
| Extended consumer optional changes/history/navigation/recovery | PASS:375×667,390×844,430×932 |
| Practice template library | PASS:375×667,430×932 |
| Professional intended history | PASS:375×667,430×932 |
| Professional queue | PASS again at final source:375×667,430×932; original b29 logs and summaries remain unchanged |

Focused suites overlap; do not sum their counts as unique additional cases. Original b29 root/typecheck/lint/queue receipts were initially authenticated against actual log hashes, exact source, clean status and exit and reused while source was unchanged. The final checkpoint received fresh full required validation after the repairs; final receipts above are authoritative.

Browser drivers operate actual local Edge/Chrome UI. Connected mapping uses real UI/API/domain/encrypted custody with synthetic trust/key/serial ports. Professional owner/history/queue positives are explicitly synthetic HTTP contracts; default actual professional APIs still refuse with503. Consumer flows perform explicit synthetic adult/consent onboarding and use real encrypted local stores. Acknowledgement/read failures are disclosed test faults. No production professional/provider, native durability, physical device or scientific qualification is implied.

The runs retain keyboard activation, visible focus, target reachability and overflow assertions. Coverage includes exact immutable template revisions, ordered product/omission decisions, unresolved/unshelved issuance refusal, source/licence/template retirement, cancelled/detached controls, unknown-save identical retry, reload, read-only uncertain-apply inspection with unchanged ciphertext/key and original command/predecessor/facts, exact correction/retraction lineage, conflict refresh/review, discard cancellation, unavailable/unsupported storage, browser back/forward, tab reentry and owner/consent retirement. Outcome inspection records no use. Selected images received direct visual inspection; full original images/traces remain local by hash.

## Failures, remaining blockers and scope

Engineering29 ENOSPC failures, zero-byte receipts and incomplete owner attempt remain in the immutable parent evidence. This session preserves the b29 Diary failure, db5 entry failure, search-field timeout, absent-journal failure, supplemental daily-loop/manual-intake failure, all RED/GREEN logs and corrected final browser runs. A publication-preflight helper initially requested the repository metadata endpoint with an invalid trailing slash and received404; the failure is retained and corrected read-only preflight passed. No app defect was demonstrated by these driver/setup/helper failures.

Expo's existing forced-exit-after-success diagnostic and module-resolution/terminal-colour warnings remain in full actual build logs; export completed with exit0. No unrelated source repair was made.

Genuine original-owner ingress/application writer, production professional authority/custody and lawful template offboarding remain unavailable. Security/G97/DB/candidate29/SDK/Doctor/native findings remain unwaived. M1-03 remains unaccepted; M2-01 unauthorized; native/macOS attempts79–86 unused. Exactly J01 Visible Pores is in assessment scope; positive scientific admission stays closed. **All38 requirements and all18 gates remain UNACCEPTED; release NO_GO.** No new paid operation, hosted/manual Actions/CI, provider/account/billing mutation, merge, deployment or release was initiated. Engineering30 was not started.

Next substantial priority: independent Brain review of this repaired checkpoint and evidence, then a separately authorized choice about original-owner ingress and production professional authority/custody. Local validation does not accept those gaps.

## Evidence index and offline verification

- [Initial storage/source](INITIAL_PREFLIGHT.json), [final identity](FINAL_IDENTITY.json), [writer observations](WRITER_EXCLUSIVITY.json)
- [Actual final receipts](CURRENT_FINAL_RECEIPTS.json), [repair/RED-GREEN identities](SOURCE_REPAIR.json), [build comparison](BUILD_RUNTIME_COMPARISON.json)
- [Earlier resumed b29 receipts](B29_RESUME_RECEIPTS.json), [authenticated original b29 receipts](REUSED_FINAL_RECEIPTS.json), [unchanged original queue summaries](REUSED_QUEUE_SUMMARIES.json)
- [Consumer build log](logs/consumer-build.log), [professional build log](logs/professional-build.log); other final logs under logs/. Reassemble the large root log through PARTS_INDEX.json.
- Retained failures and diagnostics under retained/, including each command receipt/log and available failure DOM; original screenshots/verbose traces remain local.
- Final browser summaries/canonical/source/navigation receipts under browser/; [selected visual review](VISUAL_REVIEW.json)
- [Exact Git-tree proof](PATCH_VERIFICATION.json), [raw ancestry verifier result](ANCESTRY_VERIFICATION.json), [patch/witness/log parts](PARTS_INDEX.json)
- [SHA-256 manifest](MANIFEST.json), [publication screen](PUBLICATION_SCREEN.json), [source-screen binding](CUMULATIVE_PRIOR_SCREEN_BINDING.json), [local original artifact identity](LOCAL_ARTIFACT_IDENTITY.json)
- [Final workflow/ref safety preflight](PUBLICATION_FINAL_PREFLIGHT.json)

All published files are readable UTF-8 without NUL and at most245,760 bytes. Ordered parts reconstruct complete byte-exact cumulative/session patches and raw ancestry witness:153 authentic raw commit objects verify152 selected parent links. Git SHA-1 identifies repository objects; SHA-256 authenticates evidence transport, not authorship/signature/security acceptance. Only home paths in derived logs/receipts are sanitized, with original/published identities. Source patches and witness remain exact. Repetitive accessibility-role arrays are omitted with original hashes and substantive assertions retained. Scanner matches already present in the screened source are explicitly reviewed; raw commit identities already occur in the published prior witness.

Download this directory preserving paths, then run:

```text
python verify_bundle.py /downloaded/evidence /fresh/reconstructed
python verify_ancestry.py /fresh/reconstructed/COMMIT_ANCESTRY_WITNESS.json
```

PATCH_VERIFICATION.json records actual forward/reverse application against exact cumulative/session base trees in isolated retained indexes, preserving active source/index. Publication uses a separate evidence-only branch from immutable workflow-free Engineering29 evidence. Visible hooks/rules, default workflow identities/triggers and protected refs are rechecked before publication. No PR/manual dispatch or application-source push occurs. The final return supplies the immutable index and independent remote byte/hash/ref/Actions readback, including fresh reconstruction, ancestry and exact patch-tree checks from downloaded remote bytes.
