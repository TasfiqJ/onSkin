# Externally anchored Campaign20 source checkpoint

Read FINAL_REPORT.md. This is a partial-blocked, non-admitting source candidate.

Use the externally reported checkpoint manifest SHA256, never a value trusted solely from this folder:

    python -B docs/brain/checkpoints/M1-02/F09-MANUAL-COMPARE-20/verify20.py --expected-manifest-sha256 EXTERNAL_SHA256 --git-root .

Artifact-only verification omits --git-root. With a clean final checkout the verifier also checks the immutable base, all four source commit inventories, unchanged producer/checker definitions, exact worklist-only commit and exactly one evidence-only child. It derives the final HEAD and tree. Exit 0 means integrity, never acceptance.

payload.zip contains the original nine-file authenticated input plus manifest, original/new exit-coded checks, strict frozen-source worklist generation/check receipts, all old test identities, exact intermediate path/mode/blob/SHA256 inventory, source mutations and restoration, prior browser failures/diagnostics and full final synthetic PNG/geometry/console/trace evidence. Task-owned Chrome profiles, actual user photos and private Security artifacts are excluded. Export file hashes, metadata/asset maps and logs establish source export evidence; full unsigned export bytes are in the external return ZIP.

The external FINAL_REPORT.md and return manifest add the derived final HEAD/tree, final-head CI results, complete independent actual-checkout current/tamper/restored 0/1/0, final Phase4 checks in both clean checkouts, checkpoint artifact corruption/restoration and final Git/PR custody. Those observations happen after this single tail and are not predicted inside its own hash.
