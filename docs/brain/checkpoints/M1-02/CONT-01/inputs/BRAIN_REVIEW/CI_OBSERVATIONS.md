# Current exact-head CI — independent provider observations

Head `8c1149116df00f34314357d10929b32f52f6d118`, tree `58ad583815b55736f1e907e02d9c46853f0d1a11`; PR9 checkout `444e3d7cec085637cebe442b4cad7c216a249c93` has the same tree and main+head parents. Main remains `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`. No merge occurred.

| Workflow | Run | Status | Result |
|---|---:|---|---|
|Quality|39496961034|completed|failure|
|Security|39496961082|completed|failure|
|iOS launch contract|39496960969|completed|success; source-only|

Quality repository118884388226, PostgreSQL15/17 rehearsals118884388339/118884388004, iOS/Android exports118887076397/118887076412 passed. Canonical DB118884388306 failed before SQL while preparing canonical Postgres: `H01_SQL_PROBE_FAILED: exit-nonzero. Error response from daemon: toomanyrequests: Data limit exceeded`. The preceding171 local contract tests passed, not the DB replay. The types diagnostic found no generated artifact. Raw provider logs were read independently; no current DB success is inferred.

Security code118884388072 and secrets118884388439 passed; static118884388573 and automated source-only acceptance118887473162 failed; live Supabase118884391774 skipped. The static job's individual continued steps can look successful in the summary while raw source/OSV commands exit1. Actual refusals:

```text
SOURCE_INVENTORY_DRIFT
braces: review is expired or dates are invalid
node-forge: review is expired or dates are invalid
unreviewed OSV advisory: vite@8.1.3:GHSA-587h-7wmj-h5pm
unreviewed OSV advisory: vite@8.1.3:GHSA-698v-4r3x-3vcv
unreviewed OSV advisory: vite@8.1.3:GHSA-r825-w8mm-5pxw
unreviewed OSV advisory: certifi@2026.10.18:GHSA-6q48-6c7w-9gw2
unreviewed OSV advisory: mcp@1.29.0:GHSA-84m7-p3x7-pcfv
```

These are observed scanner/gate refusals, not independent vulnerability exploitability conclusions. No scanner, coverage, inventory, exception, owner pin or date may be changed here. Source proposal notAfter stays2026-10-21T00:00:00Z; crossing it requires preserving refusal, not renewal. Main promotion remains false. M1-03 retains the protected reconciliation task; it is not issued by this continuation.

Read endpoints used: repository actions/runs and jobs/logs via the authenticated GitHub connector, plus git/commits for merge tree/parent verification. Refresh actual new head before making future claims. No background monitoring is promised.
