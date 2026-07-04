# Phase 9 Dependency And SBOM Review

`npm run phase9:dependency-sbom` writes generated dependency inventory artifacts to `docs/phase-9/generated/`.

Strict release signoff requires:

- lockfile present and generated from the release SHA
- no unapproved high or critical vulnerabilities
- SDK privacy manifests/signatures reviewed for iOS submission
- Android native dependencies checked for target API and 16 KB compatibility
- Sentry source maps/symbolication plan recorded
- generated inventory attached to the RC packet

Set `PHASE9_DEPENDENCY_AUDIT_PASS=true` only after the release owner has reviewed the generated inventory and vulnerability results.
