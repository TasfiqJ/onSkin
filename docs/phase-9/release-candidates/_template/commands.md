# Commands

Record exact command output or CI links for the RC.

```bash
npm run phase9:verify
npm run phase9:release-smoke:strict
npm run phase9:rls-adversarial-smoke
npm run phase9:rls-adversarial:strict
npm run phase9:edge-auth-smoke:strict
npm run phase9:live-edge-auth:strict
npm run phase9:data-rights-smoke:strict
npm run phase9:live-data-rights:strict
npm run phase9:data-export-contract-smoke
npm run phase9:account-provider-deletion-smoke
npm run phase9:account-service-scrub-smoke
npm run phase9:account-deletion-durable-smoke
npm run phase9:account-deletion-work-lane-smoke
npm run phase9:order-attribution-integrity-smoke
npm run phase9:privacy-payload-audit:strict
npm run phase9:store-build-inspect:strict
npm run phase9:dependency-sbom:strict
```

Run both `phase9:live-*` commands through the protected manual `Security`
workflow with the destructive staging confirmation and environment review.
Record the immutable workflow run, attempt, Git SHA, uploaded redacted artifact,
and exact iOS build identifier when one was supplied. Never paste staging
credentials or deletion capabilities into this packet.
