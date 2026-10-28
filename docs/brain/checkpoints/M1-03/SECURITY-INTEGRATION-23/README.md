# Campaign23 frozen source submission

Authority: BRAIN-M1X-SECURITY-INTEGRATION23-REPAIR-01. SUBMITTED_REVIEW_REQUIRED; NO_GO; acceptanceGranted=false.

The immutable base is PR26 `34fac69f3ba527724ecdf2d1cef69f27372756ad`, tree `832baeae6421bfaa6fb668b025932d2c49a4f33c`. Runtime `1bd95e82cc3c8dbcc16afaf839f2adeaed628105`, tree `a56098ae58100d74b453c2be2748008be5201e16`, precedes the sole unchanged-producer worklist child `e012c309b06df2274bc1c00c4f25265077352823`, tree `5078d0aa41c552e20c11b93cdbc3c5ca639c4a93`. Exactly one evidence-only child contains these five files and the handoff append. The final head/tree are externally supplied, avoiding circular hashes.

`FINAL_REPORT.md` records frozen-source implementation, current/historical qualifications, preserved failures and required blockers. `payload.zip` contains only explicitly selected public JSON/Markdown evidence. `manifest.json` binds the four other files and every payload member; it excludes its own hash. `verify23.py` is an independent bounded standard-library verifier. No original private Security log, finding artifact, private workspace, credential or provider data is included.

Obtain the manifest/verifier hashes and exact final head/tree independently from the external return anchors. Authenticate verifier bytes before execution. From a full independent clean final checkout, run:

```text
python -I -B verify23.py --root CHECKPOINT_DIRECTORY --expected-manifest-sha256 EXTERNAL_MANIFEST_SHA256 --expected-verifier-sha256 EXTERNAL_VERIFIER_SHA256 --git-root FINAL_CHECKOUT --expected-head FINAL_HEAD --expected-tree FINAL_TREE --execute-source-checks
```

Full execution checks exact source ancestry/finite scope, worklist-only child, sole evidence tail, public changed blobs, independent object storage, current Release23 source governance and the unchanged strict Phase4 producer. Artifact-only VERIFIED does not prove technical readiness. The source governance check can take several minutes; its fixed deadline is 900 seconds. Qualified native, private Security, provider and release acceptance remain closed.

Final-head CI, two independent final checkout proofs, source/artifact 0/1/0 controls, semantic no-admission, downloadable ZIP and downloaded-byte anchors are returned externally after this tail. They must not be inserted through another tail. Required Zod/deepmerge findings and custody/coverage gaps remain open. G97 FAIL/NO_GO; DB06/DB08/R2B NOT_ACCEPTED; M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED. USD0; no merge.
