# M1 Major Retained Campaign 05

**SUBMITTED_REVIEW_REQUIRED. Independent Brain acceptance required.**

Authorization `M1X-RETAINED-MAJOR-CAMPAIGN05-CLIENT-CANDIDATE-01`. Continue the existing draft [PR11](https://github.com/TasfiqJ/onSkin/pull/11) on `stage/m1-retained-resilience`.

Starting anchor `99596bfceac782d740415503bc25452cac623254`, tree `d45b9c1257c74ab61328600af0ac5a7d1350e388`.
Measured implementation **`d76cbd2742920895522e3e9018d554319c777741`**, tree **`44bd5a747df37f46e8d4b49475648c00f7857905`**.
The following checkpoint/handoff commit is evidence only. Its actual SHA/tree and authentic final-head CI are read after push and reported in PR11 and the final relay; no future self-hash is invented here.

Shelf, capture and reminder callbacks now retain their accepted owner/grant. Reminder settings distinguish unavailable private storage, isolate query generations, reread on entry and expose accessible retry + Back. You now links to **Local recovery**, which independently reads existing device evidence and opens existing feature recovery controls without new persistence, provider requests, permission prompts or automatic repair.

- [Design and five-stream investigation](DESIGN_DECISIONS.md)
- [Before/after results](RESULTS.md), [commands and raw exits](TEST_MATRIX.md)
- [Exact paths](SOURCE_SCOPE.md), [pre/post blobs + SHA-256, history and protected witnesses](source-scope.json)
- [Synthetic Expo web evidence and limits](E2E_SUMMARY.md), [remaining blockers](BLOCKERS.md)
- [Machine completion report](completion-report.json), [evidence hashes](evidence-manifest.json)

Forced clean measured-source root tests **6,157/6,157** (mobile 6,133; console 24), typecheck and lint pass with zero cached tasks. All eight retained families plus Recovery/settings pass **2,312/2,312**. Original production independently reproduces **21 failing vectors + one passing safeguard**, not 21 independent bugs. Sixteen new-feature cases pass. The unchanged original worklist producer passes **0/1/0** in a complete independent checkout.

Actual headless Chrome passes 375×667 and 390×844, 430×932, 360×640 with direct text ×2, and A→B→A with a delayed Recovery read. Twenty-six changed-flow snapshots have zero horizontal/visible-control issues. The selection keeps **32 screenshots**, including three genuine failed attempts; omitted duplicates are hash-indexed.

Original Security/G97 remains FAIL/NO_GO; M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2-01 and dependent/native/clinical/paid/provider/release work remain unauthorized. Native filesystem/camera, OS permission/delivery, physical accessibility, installed offline cold start and paid-positive/provider behavior are NOT_RUN. Spend USD 0.

From repository root after commit: `python -B docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05/verify_checkpoint.py`.
