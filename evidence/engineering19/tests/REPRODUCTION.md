# Reproduction

Use the exact existing checkout and already installed dependencies. No credentials, installs, external services or native attempts are required. Restore the source from the session or cumulative patch against its exact base, and verify its tree before running.

- Run `python -X utf8 run_check.py <fresh-label> npm.cmd run test -- --force` from the repository, placing this evidence folder beside `c16-candidate`, or adapt the two explicit path constants for another existing local clone.
- Root typecheck/lint use the same runner with `npm.cmd run typecheck -- --force` and `npm.cmd run lint -- --force`.
- `builds.py` supplies a sanitized blocked-provider Expo export environment. Professional build is `npm.cmd --workspace apps/professional-web run build`.
- Copy `consumer-flow.mjs`, `continuity17.mjs` and `recovery-browser.mjs` into the checkout's ignored `.tmp/engineering19/` directory so their existing relative imports resolve. Use fresh evidence directories; drivers refuse to overwrite acceptance output. Browser checks require existing Chrome/Edge. `browser_checks.py consumer` / `professional` run375×667 and430×932. The recovery script's output path should be set to another fresh directory before repeating.
- Professional driver source is already in `scripts/e2e/professional-reconciliation.mjs` and `professional-owner.mjs`. Positive HTTP responses are synthetic, default API503 is real local behavior. No real professional/provider service is installed.
- `verify_ancestry.py COMMIT_ANCESTRY_WITNESS.json` works offline with Python standard library and does not need Git or the private checkout. `package_checkpoint.py` documents exact patch/index/ancestry packaging; it refuses to overwrite the delivered archive.

Each command writes a separate immutable log and receipt. Existing labels are never overwritten. Executed final commands/counts are in TEST_MANIFEST.json. Native/physical/provider qualification is NOT_RUN.
