# Independently reproduced defects

## R1 — original Security CI cleanup

GitHub [run 39545262842](https://github.com/TasfiqJ/onSkin/actions/runs/39545262842), original secret job `119041893805`, has 10 tests: nine pass, the last errors from Python `TemporaryDirectory.cleanup -> shutil.rmtree -> os.rmdir('.git')` with `[Errno 39] Directory not empty`. The scanner steps were skipped. Brain ran 3 independent prepared Linux repetitions of the ten original tests; all passed. This is intermittent and unclosed; do not simply sleep or swallow `OSError`. Source: `scripts/phase9/security_acceptance/test_secret_scan.py`. Preserve all negative fixtures.

## R2 — candidate bytecode drift false acceptance

With `scripts/security_readiness/m103/candidate.py` loaded on Linux, create a disposable root with `example.py` and `__pycache__/example.cpython-312.pyc`. Capture `installed_tree(root)`, change only the cache `.pyc`, and capture again. Brain observed **identical outputs** (`record_count=1`) despite changed bytecode. Any replacement must distinguish generated, executable and disabled caches rather than ignoring them in trusted input verification.

## R3 — post-export scan-source drift false acceptance

Create a disposable Git repository with one committed `source.py`, snapshot using `source_scan.snapshot(repo, exact_sha, target)`, then modify `target/source.py` and run `source_scan.validate_inventory`. Brain observed **PASS** after modifying source, with two different SHA-256 contents. The current scanner runner does not rehash exported files after invoking the engine. Include a real negative that detects mutation/rename/link before or during/after scan and preserves raw failure, with no source leak.

## R4 — current measured SAST completeness

At prior measured `3c063dfe47d887e7aa3e27d05da41658b69a59dc`: all four pinned bundles ran, zero raw nonzero scanner exits, but `execution_complete=false`. Source partition **18,782 tracked**: 12,176 covered; 6,580 unsupported; 26 SQL files failed/blocked. OWASP had one timeout and one PartialParsing; TypeScript had PartialParsing. Three Python finding records in new scanner code remain UNREVIEWED. A newer delivery must resnapshot/measure, not substitute old completeness.

## R5 — original current Security still blocked

Exact delivery Quality [39545262835](https://github.com/TasfiqJ/onSkin/actions/runs/39545262835) passed its credential-free DB test; Security [39545262842](https://github.com/TasfiqJ/onSkin/actions/runs/39545262842) failed original secret fixture, frozen inventory and expired/unreviewed review gates. Do not touch frozen acceptance to get green. G97 proposal expiry `2026-10-21T00:00:00Z` remains past and binding.
