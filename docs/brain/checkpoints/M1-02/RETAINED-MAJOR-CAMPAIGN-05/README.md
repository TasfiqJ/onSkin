# M1 Major Retained Campaign 05

**SUBMITTED_REVIEW_REQUIRED. Independent Brain acceptance required.**

Authorization `M1X-RETAINED-MAJOR-CAMPAIGN05-CLIENT-CANDIDATE-01`. Continue the existing draft [PR11](https://github.com/TasfiqJ/onSkin/pull/11) on `stage/m1-retained-resilience`.

Starting anchor `99596bfceac782d740415503bc25452cac623254`, tree `d45b9c1257c74ab61328600af0ac5a7d1350e388`.
Measured implementation **`74c08a37a761d3bb44601c2d6b4b52a8f9e9c6b7`**, tree **`02f5a55250b0fbf4b924314f8c4aac7ee6f46bc5`**.
The following checkpoint/handoff commit is evidence only. Its actual SHA/tree and authentic final-head CI are read after push and reported in PR11 and the final relay; no future self-hash is invented here.

Shelf, capture and reminder callbacks now retain their accepted owner/grant. Reminder settings distinguish unavailable private storage, isolate query generations, reread on entry and expose accessible retry + Back. You now offers expandable **Local recovery**, which independently reads existing device evidence and opens existing feature recovery controls without new persistence, provider requests, permission prompts or automatic repair.

- [Design and five-stream investigation](DESIGN_DECISIONS.md)
- [Before/after results](RESULTS.md), [commands and raw exits](TEST_MATRIX.md)
- [Exact paths](SOURCE_SCOPE.md), [pre/post blobs + SHA-256, history and protected witnesses](source-scope.json)
- [Synthetic Expo web evidence and limits](E2E_SUMMARY.md), [remaining blockers](BLOCKERS.md)
- [Machine completion report](completion-report.json), [evidence hashes](evidence-manifest.json)

Forced clean measured-source root tests **6,158/6,158** (mobile 6,134; console 24), typecheck and lint pass with zero cached tasks. All eight retained families plus Recovery/settings pass **2,313/2,313**. Original production independently reproduces **21 failing vectors + one passing safeguard**, not 21 independent bugs. Seventeen new-feature cases pass. The unchanged original worklist producer passes **0/1/0** in the clean complete final checkout; the earlier independent-checkout proof remains historical.

Actual headless Chrome passes 375×667 and 390×844, 430×932, 360×640 with direct text ×2, and A→B→A with a delayed Recovery read. Twenty-six changed-flow snapshots have zero horizontal/visible-control issues. The selection keeps **34 screenshots**, including five genuine failed attempts; omitted duplicates are hash-indexed.

Original Security/G97 remains FAIL/NO_GO; M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2-01 and dependent/native/clinical/paid/provider/release work remain unauthorized. Native filesystem/camera, OS permission/delivery, physical accessibility, installed offline cold start and paid-positive/provider behavior are NOT_RUN. Spend USD 0.

From repository root after commit: `python -B docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05/verify_checkpoint.py`.

Measured-source CI is complete: repository gates, PG15/PG17 deletion rehearsals, iOS/Android Expo exports and source-only iOS contract PASS. Quality FAILS canonical DB image acquisition (ECR Data limit exceeded); Security FAILS protected acceptance/advisory/expiry/current-source obligations. See measured-source-final-ci-observation.json and EXTERNAL_OWNER_PACKET.md. Final evidence-tail CI is observed separately after push.
