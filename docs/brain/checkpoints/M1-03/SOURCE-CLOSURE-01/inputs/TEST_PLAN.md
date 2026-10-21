# Efficient test/reproduction order

1. Git identity/authority/preimage tests; do not start broad npm upgrade or scripts first.
2. Replay failing M103 historical fixture tests individually and fix their actual setup/environment, preserving exact old/new interval refusal tests. Run complete 65 and Linux70 in properly hydrated complete objects.
3. `python3.12 -B -m unittest discover -s scripts/security_readiness/m103 -p 'test_*.py' -v` with exact private `ONSKIN_TEST_CANDIDATE` for real tests. Test cache/link/inode/source restore, process kill/reap, certifi/current mcp/venv and network denial.
4. Exact-head source capsule four-rule dry run in a fresh private workdir after all mutating adverse tests. Inspect raw parser/timeout and per-rule/file matrix before any candidate-only adjustment; rerun only affected target first, then full scan if warranted.
5. Root forced tests (`npm test -- --force`), typecheck/lint (`-- --force`), original source/CI contracts, strict governed report/worklist. Mark cached/failed/skipped correctly.
6. Current GitHub Quality/Security/iOS PR job details, both exact stage head and synthetic PR merge checkout. No prior-head green borrowing. Sanitize scanner reports; never include private patient/secret data.
