# Independent Campaign09 verdict and exact measured checks

Verdict: `ACCEPTED_SCOPED / QUALITY_INTEGRATION_BLOCKED`. The Brain independently inspected all nine authorized source paths and intermediate commits; PR13 remains draft/open/unmerged. After final HEAD, independently reran:
- `python -B docs/brain/checkpoints/RELEASE-09/SOURCE-PACKET-CONSUMER/verify_checkpoint.py --expected-manifest-sha256 1f96dc0489a2665a1adb3e24b8e3726a1c4da9ba53dac770a33d097d8dfc0863` exit 0, 23,015 protected file identities and 151 retained negatives authenticated.
- `npm run docs:source-packet-audit:check` exit 0; five `authorizedSupersession` documents retain `identical=false`, original 12 imported packet files byte-authenticated. All old releases and checkpoints untouched.
- `python -B scripts/release/full-app-j01/source_consumer09.test.py` exit 0 with 23 source-scope controls; `node scripts/docs/source-packet-supersession09.test.mjs` exit 0, 30 Windows rejections and explicit Windows NOT_RUN symlink/collision cases. Linux CI logs confirm 35 rejections; semantic 151 negatives pass at candidate step.
- `npm run phase4:source-worklist:check` exit 1 with stale `docs/phase-4/generated/source-worklist.json` and `.md`.
- `node scripts/docs/readiness-status-audit.mjs --strict --check` exit 1: stale `docs/generated/readiness-status-audit.json/.md` AND `Readiness status audit inputs drifted during check mode`.
- `npm run phase9:governed-publication-coverage:test` exit 0 (six tests).

Release09 measured source SHA/tree `3d951357163d2abd1b02b456c6f52cfb0dbf70ce / 02c58ff4cc87f7a9feb1b1fd5828ac4406cd0f5e`; final HEAD SHA/tree `8ac97c32901272d97d1bff05f2abc294811055a6 / a59fc7ea1cc57901f6d848ff5009734f446bdff2`. Do NOT update older checkpoints, claim they re-pass at a changed HEAD, or overwrite external gates.

New Campaign10 task is *not* a broad full release/runtime cutover. Original Release08 contract `onskin-full-app-j01-release08-v1` remains a proposed product-scope planning baseline until separately approved source consumer migration; existing legacy `lean-v1` technical guard continues unchanged. Exact product decision is immutable; no new admissions.
