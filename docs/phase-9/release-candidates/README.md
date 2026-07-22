# Release Candidates

Create one folder per release candidate, for example `rc-2026-07-04-b001`, by copying `_template` after the production build-source commit has been fixed. The copied `evidence-chain.json` is an invalid placeholder. Do not hand-edit it into evidence; the bounded ledger builder replaces it from the staged Git index.

The active release contract is iOS-only. This packet accepts one exact
production iOS build; Android and Google Play evidence are not applicable until
the launch contract explicitly restores that platform.

The copied folder must include a completed
`ios-archive-privacy-evidence.json`. That template is deliberately invalid and
cannot be used as evidence until every referenced file, hash, size, timestamp,
build identity, toolchain value, attestation, and distinct named approval
metadata value is replaced and validated.

The JSON template starts in `xcarchive_zip` mode. If the exact retained EAS
application artifact is an IPA, change `archive.format` to `ipa` and record its
real `.ipa` path; never rename one container type to imitate the other.

Raw archives and reports under an RC folder's `evidence/` directory are
Git-ignored because they can be large or sensitive. Retain them in the approved
immutable evidence store and mount the exact hash-matching files at their
recorded repository-relative paths for validation. The committed JSON is a
hash-bound index, not a backup of those artifacts.

Passing the index validator proves internal path/hash/identity/timestamp
consistency; strict bounded ZIP structure, CRC, and DEFLATE consistency; safe
non-link and collision-free paths; one expected IPA or xcarchive app layout;
parsed bundle/version/build/executable/team/application-path identity; and
structured provisioning-profile team, App-ID prefix, distribution, platform,
and validity fields. It also proves the presence of named approval metadata. It
does not authenticate reviewers, prove that an approval is truthful,
cryptographically verify the app code signature, trust the provisioning-profile
CMS signature, validate DER-Encoded-Profile, interpret privacy/API reports, or
machine-interpret any opaque report. Reviewers remain accountable for the
actual merged privacy, API, SDK/signature, signing, symbol/processing,
traffic/storage, App Privacy, TestFlight, and App Store contents.

The manifest `Build-source Git SHA`, `PHASE9_IOS_SOURCE_GIT_SHA`, and EAS
metadata identify the exact commit that produced the binary. Call that commit
`S`. All committed direct evidence is recorded in one non-merge evidence
commit `E` whose sole parent is `S`. The selected RC ledger binds `S`, the RC
directory, the role, repository path, and SHA-256 of every other path changed
from `S` to `E`; the ledger deliberately excludes itself to avoid a recursive
self-hash. The `S..E` diff must equal the ledger plus its entries exactly.

After `E`, commits may change only the exact generated-output paths exported by
`scripts/launch/governed-evidence-chain.mjs`. Direct evidence, application
source, dependencies, configuration, scripts, and policy cannot change. Every
commit remains single-parent and the worktree and complete index must be clean
and normal. At least one post-`E` generated-packet commit must exist; the last
pre-readiness commit is `R`. The final readiness commit `F` is the sole direct
child of `R`, is the last commit, and changes only its two governed readiness
outputs. A collapsed `S -> E -> F` chain is invalid. A new direct evidence file, corrected raw
evidence, or changed build input requires a new source/build/evidence chain;
never append it after `E`.

## Evidence Commit Procedure

1. Record the full 40-character build-source SHA as `S` and check out that exact
   clean commit. Create the selected non-template RC directory after `S` is
   fixed.
2. Collect and validate the direct evidence. Stage every direct evidence file
   that must be committed, including the selected RC metadata and required
   Phase 5 or human-simulated evidence. Use `git add -f` only for evidence paths
   intentionally ignored by repository policy. Do not stage
   `evidence-chain.json`.
3. Leave no unstaged tracked changes or nonignored untracked files other than
   the ledger output. Do not use skip-worktree, assume-unchanged, sparse, merge,
   symlink, submodule, executable, or hardlinked evidence entries.
4. Build the ledger from the exact staged index:

   ```text
   node scripts/phase9/build-evidence-chain-ledger.mjs --source-git-sha <S> --release-candidate-dir docs/phase-9/release-candidates/<rc-id>
   ```

5. Review the canonical ledger, stage that one output, and commit all staged
   evidence and the ledger together as `E`. `E` must be the sole direct child
   of `S` in the release history.
6. Generate the human-E2E manifest pair, commit that pair alone as the direct
   child of `E`, and run `npm run e2e:human:manifest:check` from the clean
   committed checkout. Phase 5 consumes this committed manifest, so generating
   Phase 5 first is invalid.
7. Generate the Phase 5 device-QA pair, commit that pair alone, and run
   `npm run phase5:qa-packet:check`. Then do the same for the Phase 7 core-loop
   pair with `npm run phase7:qa-packet:check`; Phase 7 consumes Phase 5.
8. Generate and individually commit any other upstream packet pairs required
   by Phase 9, including the Phase 4 beta-coverage pair. The beta pair binds the
   exact ignored mounted aggregate input and must pass
   `npm run phase4:beta-coverage-report:check`. Generate the Phase 9
   release-engineering pair only after its Phase 5, Phase 7, beta, and direct
   evidence inputs have passed at their committed prefixes, then run
   `npm run phase9:qa-packet:check`.
9. Commit every remaining governed packet as one exact JSON/Markdown pair in
   dependency order. Each packet records its pre-publication prefix; its pair
   must be the complete diff of that prefix's sole child, and neither output
   may change later. The last such commit is `R`.
10. Run the governed chain and all packet check modes from clean `R`. Generate
    and commit only the readiness JSON/Markdown pair as `F`, then run the final
    readiness check from clean `F`. Finish with
    `npm run release:governed-packets:check`, which runs all 16 implemented
    deterministic packet replays in dependency order without writing output.
    The central chain still structurally verifies every other governed unit;
    it does not pretend that a unit lacking a reviewed replay command was
    semantically regenerated. Store-build inspection remains a separate
    non-replay current-state check.

The required dependency order is therefore `E -> human manifest -> Phase 5 ->
Phase 7 -> Phase 9 prerequisites -> Phase 9/remaining packets -> R -> readiness
F`. Every arrow is a single-parent commit boundary; a generator run is not a
substitute for its subsequent committed check.

The builder and verifier use a trusted absolute Git executable, fixed Git
configuration, bounded files and aggregate bytes, canonical collision-free
paths, stable root/ancestor/file identities, normal `100644` blobs, exact index
and worktree comparisons, and atomic ledger publication. A passing chain proves
repository provenance and immutability only. It does not authenticate people,
validate externally retained raw artifacts that are not ledger entries, prove
legal compliance, guarantee App Review acceptance, or predict revenue.

The tracked `signoff.md` approval chain is cross-bound to the JSON review: its
Security/privacy owner and date must match `review.privacy`, while its Release
manager owner and date must match `review.release` and the exact
`PHASE9_SIGNED_OFF_BY` identity. After outer whitespace is removed, the exact
name bytes are hash-compared; this prevents contradictory packet identities but
still does not authenticate the people or prove the review occurred.

Each RC folder must be immutable once signed. If the SHA, native build, env, store metadata, policy URL, catalog, entitlement config, or release channel changes, create a new RC folder.

Set `PHASE9_RELEASE_CANDIDATE_DIR` to the signed folder path, for example `docs/phase-9/release-candidates/rc-2026-07-04-b001`, before setting any `PHASE9_*_PASS=true` value or `PHASE9_SIGNED_OFF_BY`. `phase9:release-smoke` rejects dirty Git worktrees, nonconforming RC IDs, `_template`, untracked or HEAD-mismatched metadata, template-identical files, unresolved placeholders, invalid signoff rows, and a mismatched build-source SHA. The strict command also runs the non-writing store inspector, which validates the evidence index and cross-checks the manifest and store-packet release identity.
