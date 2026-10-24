# Proven Phase4 source worklist issue

At exact PR13 final HEAD, real command:
```
npm run phase4:source-worklist:check
> node scripts/phase4/build-source-worklist.mjs --strict --check
FAIL docs/phase-4/generated/source-worklist.json is stale. Run npm run phase4:source-worklist.
FAIL docs/phase-4/generated/source-worklist.md is stale. Run npm run phase4:source-worklist.
```

The **unchanged** worklist producer is `scripts/phase4/build-source-worklist.mjs` (READ-ONLY). It records source hashes of 420 input paths and conservative original statuses; current outputs were last refreshed during Campaign07. Release09's authorized change to `.github/workflows/quality.yml` is included among source-bound identities. Exact old/new workflow SHA-256 was `c78ed1c9559407dd31634da1f3afaf00e887f976ff54f78c926acff7478a16c8` → `51a295770e798707507048bc56cf10765b308b18ed9ce9922c05bf699b660c49`, 13201→13714 bytes. Only source-bound worklist projections need legitimate producer refresh (unless a real additional failure is independently discovered).

Codex09 ran producer with SCRATCH output env paths only, exit 0, but it warned that the source was dirty during that scratch operation; it did **not** install the projection. New task must run legitimate producer against clean/pinned source, record exact Git tree and input hashes, and verify original strict check without overwriting the producer or suppressing freshness checks. If updates to the generated outputs shift their own source identity across commits, use coherent measured-source/evidence sequencing; never fake a source hash, rebind source to arbitrary commit or substitute worklist fixture for the original gate. Preserve blocked `sourceReview`/`curation` statuses.
