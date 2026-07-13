# Optimization Fixtures

`generate-fixtures.mjs` creates deterministic, synthetic datasets for local
correctness, export, list, storage, and profiling work. The fixtures contain no
real account, product, search, photo, file-path, or identity data. Photo rows
are metadata-only placeholders and contain no image bytes.

Available scales:

- `empty`: a new account with no records;
- `median`: ordinary local collections and 120 export rows;
- `stress`: 750 Shelf rows, one year of AM/PM completions, 250 photo metadata
  rows, 1,000 outbox operations, 200 Ask messages, and 1,205 export rows.

Each generated document includes the fixture version, seed, record counts, and
SHA-256 digest of its data. Generate artifacts outside Git unless a focused test
requires a committed fixture:

```bash
node scripts/optimization/generate-fixtures.mjs --scale stress --output .expo/optimization/stress.json
node scripts/optimization/generate-fixtures-smoke.mjs
```

Generated metadata does not establish native performance. Official evidence
still requires the supported-device protocol and build identity.
