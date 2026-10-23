# REISSUED R1 — recover from the verified stale-local-checkout STOP

**This R1 ZIP and its new external manifest supersede the earlier SECURITY-SOURCE-COVERAGE-TRIAGE-01 ZIP/prompt. Do not combine packets.** The former ZIP verified correctly; the prior attempt stopped because its chosen local checkout was too old, not because the issued stage source or source preimages were wrong.

Brain independently created an entirely separate clean checkout and verified its exact Git head/tree, 20 Git blob+SHA256+size preimages and working file bytes, no alternates, clean status, branch and GitHub origin:

`C:\Users\jasim\Documents\ChatGPT\MasterV2Code\onSkin_M103_COVERAGE_TRIAGE01_EXACT_4f6a2d2`

**The OLD checkout is still at the stale SHA and must NOT be used:** `C:\Users\jasim\Documents\ChatGPT\MasterV2Code\postmerge-gate-triage01-stage`. Never reset, overwrite or rebase it. Codex must explicitly change to the new workspace before its own preflight and stop again if it cannot access or authenticate it. The 20-path preimage fingerprint is `4954012441f89c16902e8de3a55ef75403034bfaa23da413cacb614d3a79113c`. Read `06_EXACT_CHECKOUT_RECOVERY.md` and `CHECKOUT_WITNESS.json` before running any scanner diagnostic.

The reissuance does **not** change the authorized head `'4f6a2d2c84a06ba9b794967fb76a5f9b6fc994fe'`, task, source read-only constraints, single writer, or $0 policy. An unrelated source or main change is a fresh STOP, not authority to refresh hashes.

---

# OnSkin M1-03 — SECURITY-SOURCE-COVERAGE-TRIAGE-01

**Authority:** `M103-SECURITY-SOURCE-COVERAGE-TRIAGE01-READONLY-01-R1`. **Branch only:** `stage/m1-gate-recovery`. **Exact HEAD/tree:** `4f6a2d2c84a06ba9b794967fb76a5f9b6fc994fe` / `791580347993487bd3920727ee7b0e31668eed4e`. `main` is `d9912f4c8b30358593569c5b9b4e84773c6f463e`.

Verify the externally supplied manifest SHA256 before doing work, then read all numbered instructions and strict JSON. Nothing from prior scopes can be combined with this issuance. All 20 preimage Git objects are bound, including the precise corrected protected source-manifest digest. Wrong branch, wrong HEAD, wrong main, dirty tracked source, missing blob or digest drift => STOP. Read AGENTS.md/CLAUDE.md and applicable nested rules.

Only root handoff and new checkpoint evidence may change. This is a **read-only Security coverage diagnosis**; not a source Security review renewal, scanner bypass or release admission.
