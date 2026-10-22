# Exact reproducers (source-only)

- Fresh isolated no-hardlink checkout of the authorized stage head; verify clean status, no alternates and exact tree before doing anything.
- From the root with supported Linux Python3.12: `python3 -B -m unittest discover -s scripts/brain -p 'test_*.py' -v` (ordinary current-checkout baseline 93 with 3 failure events, 1 error, 2 genuine Windows-only skips). Preserve raw output.
- Target the individual fixture modules with `cd scripts/brain && python3 -B -m unittest test_m103_quality_recovery02_profile -v` and analogous `test_m103_quality_recovery03_profile`. Preserve the negative tamper results; a synthetic/overlay PASS is not ordinary discovery PASS.
- Determine why QR02 synthetic fixture's `.gitattributes` and `scripts/brain/m103_profile.py` are newer than its original frozen delivery. Independently compute Git blob/SHA256 at QR02 delivery and compare; test both authentic and forged historical input behavior.
- Fix original setUp source-of-truth only, retain unchanged `test_*` methods/AST and all adversarial tests. Ensure an actual direct ordinary discovery passes; do not monkeypatch `brain.ROOT` to switch current vs frozen between suites or suppress errors.
- Rerun clean `npm ci`, forced root tests/typecheck/lint, original secret12, strict worklist/report; record original Security70 separately as genuine protected RED.

Previously issued `frozen_endpoint_governance.py` uses alternate `brain.ROOT` to demonstrate correct historical inputs, but its PASS is **not** an acceptance replacement. Do not edit or rerun it as primary proof.
