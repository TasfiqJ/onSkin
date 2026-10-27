# Campaign22 frozen engineering evidence

Authority BRAIN-M1X-SECURITY-RECOVERY22-CANDIDATE-01. Source acceptance is
SUBMITTED_REVIEW_REQUIRED; G97 FAIL/NO_GO. No acceptance or release authority.

The source/worklist freeze is 6872e740385ff7bf2cd57221c31dd55a687ba45a,
tree c79ed177927c016a6bb32b032fa8400f80be2489. Its substantive parent is
ecadc050ce03c89dd9d5d77e962c62fb744b74fc,
tree 458f20311fe4e4ce709fb0d2e96b3f1d5d946712. PR26 is draft, stacked on
unchanged PR25 2cffa9e92be101af4e3b371f1815ec9f458d8da4.

Run the standalone verifier with the externally supplied checkpoint manifest
SHA256: python -B verify22.py --expected-manifest-sha256 EXTERNAL_ANCHOR
Add --git-root FULL_CLEAN_CHECKOUT for finite source/history/freeze/tail and
changed-public-working-byte verification. Artifact-only verification does not
claim full checkout execution. Neither mode executes returned application code,
opens unrelated protected finding contents, or grants Security acceptance.

payload.zip contains exact-inventoried sanitized engineering evidence. The
complete final return adds the minimal Git delta, post-tail final-head CI and
independent final checkout controls externally. Those cannot be placed in this
single evidence tail without a circular hash or another tail.
