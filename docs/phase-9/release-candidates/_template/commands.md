# Commands

Record exact command output or immutable CI/workflow links for the release
candidate. This packet has three ordered stages. Do not mix generated source
packet writes into the final RC-only evidence commit.

Every all-caps value prefixed with `REPLACE` below is an intentionally rejected
placeholder, not an example value. Replace each token in the copied RC file and
shell environment before running strict acceptance.

## 1. Freeze the build-source commit

Run the complete source and packet-builder sweep before selecting the commit to
upload to EAS:

```bash
npm run phase9:verify
```

Review and commit every intended generated packet change. Then rerun the
non-writing launch gate from the clean commit that will be uploaded, and retain
its CI run and exact SHA:

```bash
npm run launch:verify
git status --short
git rev-parse HEAD
```

The final `git status --short` output must be empty. Do not run
`phase9:verify` after creating the RC evidence commit because that command
contains packet writers outside the RC folder.

## 2. Collect exact build and external evidence

Build from the frozen source SHA. Download the exact EAS application artifact
and available Xcode logs with the pinned CLI and build UUID before hashing:

```bash
npx eas-cli@21.0.1 build:download --build-id REPLACE_WITH_EAS_BUILD_UUID --all-artifacts --non-interactive --json
```

Run the applicable strict service and security checks against that same source
and iOS build. Run both live commands through the protected manual `Security`
workflow with destructive-staging confirmation and environment review:

```bash
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
npm run phase9:dependency-sbom:strict
```

Retain immutable workflow run, attempt, source SHA, uploaded redacted artifact,
and exact iOS build ID. Never paste credentials or deletion capabilities into
this packet. If a strict command writes a generated report, archive the report
as evidence before creating the RC commit; do not carry that write into the
clean acceptance checkout.

## 3. Commit and validate the immutable RC packet

Complete every RC metadata file and the archive evidence index, then create
exactly one non-merge commit whose direct parent is the build-source SHA and
whose changed paths are all inside the selected RC folder. Mount the ignored
raw evidence at the hash-recorded `evidence/ios/` paths, then validate from a
clean checkout of that evidence commit:

```bash
export PHASE9_RELEASE_CANDIDATE_DIR=docs/phase-9/release-candidates/REPLACE_WITH_RC_ID
export PHASE9_IOS_ARCHIVE_PRIVACY_EVIDENCE_PATH=docs/phase-9/release-candidates/REPLACE_WITH_RC_ID/ios-archive-privacy-evidence.json
export PHASE9_IOS_SOURCE_GIT_SHA=REPLACE_WITH_BUILD_SOURCE_GIT_SHA
export PHASE9_IOS_EAS_BUILD_ID=REPLACE_WITH_EAS_BUILD_UUID
export PHASE9_IOS_BUILD_NUMBER=REPLACE_WITH_IOS_BUILD_NUMBER
export PHASE9_APPLE_TEAM_ID=REPLACE_WITH_APPLE_TEAM_ID
```

Set the remaining reviewed production identity, Phase 9 evidence, and named
signoff environment values required by strict release smoke.
`PHASE9_SIGNED_OFF_BY` must be the exact trimmed Release manager identity
used in both `signoff.md` and the archive JSON release review. Then run only
non-writing acceptance gates:

```bash
npm run phase9:view-shot-privacy:check
npm run phase9:ios-privacy-source-audit:check
npm run phase9:ios-archive-privacy-evidence:test
npm run phase9:release-candidate-git-contract:test
npm run phase9:verification-wiring:test
npm run phase9:store-build-inspect:strict
npm run phase9:release-smoke:strict
git status --short
```

The final status output must remain empty. `phase9:store-build-inspect:check`
is the ordinary non-writing CI mode. It validates a real archive index only
when the exact evidence context is supplied; without that context it reports
the missing production evidence as a non-strict warning.
