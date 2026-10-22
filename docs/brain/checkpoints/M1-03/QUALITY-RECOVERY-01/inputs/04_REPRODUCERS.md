# Exact reproductions and meaningful blockers

**Original final-head GitHub Quality:** `https://github.com/TasfiqJ/onSkin/actions/runs/39715993772`; repository Quality job ID `119618228381`, 'Check Expo dependency compatibility' FAIL, SDK57 expectation `expo@57.0.30 → ~57.0.31`, `expo-network@57.0.2 → ~57.0.3`; subsequent doctor/typecheck/lint/test SKIP. This is an independent confirmed source-level technical failure. `apps/mobile/package.json` and `package-lock.json` remained unchanged in previous SC01-SC03 13-commit interval.

**Exact canonical database unrelated blocker:** Quality job `119618228002`, bounded immutable Docker ECR image pull: `Error response from daemon: error from registry: Data limit exceeded`, rejects cleanly, no alternative image permitted; PG15/17 account deletion successful. Do not modify Docker workflow/config, image digest, registry auth or DB06. Owner's authorized infrastructure quota/provenance resolution, or legitimate provider return to service, required for a Quality green canonical reset.

**Original final-head Security:** `https://github.com/TasfiqJ/onSkin/actions/runs/39715993860`. Secret original scanner enforcement failed after tools executed. Original code/advisory and static/OSV controls failed, current findings unreviewed. Candidate scan at `66ba3219549d426cbb66c7497a37948aa7d8f12e` was incomplete and non-admitting. Do not try to "fix Security" by updating frozen exception lists or changing scanner source in this task.

**Baseline independent reproduction commands (Linux x86-64):**

```bash
# In an isolated no-hardlink clone at the exact stage head, not a shared worktree:
node --version
npm --version
npm ci --no-audit --no-fund
npm test -- --force
npm run typecheck -- --force
npm run lint -- --force
npm run phase4:source-worklist:check
python3 -B -m unittest discover -s scripts/brain -p 'test_*.py' -v
python3 -B -m unittest discover -s scripts/phase9/security_acceptance -p test_secret_scan.py -v
```

For source-only app compatibility use the existing repo's actual original quality workflow command (`npx expo install --check` or its canonical equivalent) followed by Expo Doctor; bind environment, versions, exits, and no drift. No clean env dependency installs outside the project or bypassed package scripts. Do not call original Security GREEN because unit tests pass.

**Observed local independent counts at old head:** 6,067 root PASS, typecheck/lint PASS, governance69 PASS+2 expected platform skips, secret12 PASS, nonadmitting private candidate9 PASS, strict report/worklist PASS. Actual final-head CI Security/Quality remain FAILED.
