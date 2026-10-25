# Final-head CI: exact observed workflows (not release admission)

At `14805e7f708297e72419035f517acc41ba52da70`:
- Quality `40143371769` COMPLETED/SUCCESS; repository gates `121019681742` success; canonical credential-free DB `121019681930` success (local reset twice, structural pgTAP, schema drift empty, 7381-line public-types parity); PG15 `121019681896` and PG17 `121019681965` success; Expo Android `121021261838` and iOS `121021261875` success as source exports, not installed phones.
- iOS contract `40143371750` success SOURCE ONLY.
- Security `40143371706` failure: secret scanning `121019549036` failure, code security `121019549072` failure, static/OSV `121019549173` failure, automated source-only Security acceptance `121020432344` failure; live Supabase adversarial job skipped.

Canonical DB previously failed `H01_SQL_PROBE_FAILED` with registry `Data limit exceeded` on older heads; this final job is genuinely green. However, original DB06/DB08/R2B *protected custody acceptance* and M1-03 are not admitted by this CI observation. Do not rewrite historical failures or exact-source source-of-truth labels until an independent later decision.

Live Security log examples: expired `braces` and `node-forge` reviews, unreviewed npm `zod@3.25.76:GHSA-mrhx-c7xc-m3w5`, `@vitest/mocker@4.1.11:GHSA-qxg6-89mg-rqv8` and `GHSA-xp26-3454-mjgp`. OSV also identified `opentelemetry-api@1.37.0:GHSA-xcq7-p3pf-p88h`, `certifi@2026.10.18:PYSEC-2026-4320` / `GHSA-6q48-6c7w-9gw2`, `mcp@1.29.0:GHSA-84m7-p3x7-pcfv`, and reviewed `braces` identity drift. Claims must be rechecked with actual fresh scanner/source output, not presumed true for a future candidate. Workflows retain original OWASP tool/rules/secret/source acceptance, review signatures and expiry. No manual whitelist or exception extension may masquerade as remediation.

`docs/brain/state/**`, Security PR10, scanners, rules, proposal expiry, `.github` (except explicitly granted in a later task), original Security acceptance scripts and source manifests remain read-only in this campaign.
