# Release Candidates

Create one folder per release candidate, for example `rc-2026-07-04-b001`, by copying `_template`.

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
metadata identify the exact commit that produced the binary. Evidence is
recorded in exactly one non-merge commit whose direct parent is that source
commit and whose changed paths all stay inside the selected RC folder. Every
RC metadata file must be a normal, single-link tracked file matching HEAD;
ignored or untracked metadata outside the permitted raw `evidence/` subtree,
skip-worktree/assume-unchanged flags, later RC edits, or any app, dependency,
config, script, or policy change invalidate the packet.

The tracked `signoff.md` approval chain is cross-bound to the JSON review: its
Security/privacy owner and date must match `review.privacy`, while its Release
manager owner and date must match `review.release` and the exact
`PHASE9_SIGNED_OFF_BY` identity. After outer whitespace is removed, the exact
name bytes are hash-compared; this prevents contradictory packet identities but
still does not authenticate the people or prove the review occurred.

Each RC folder must be immutable once signed. If the SHA, native build, env, store metadata, policy URL, catalog, entitlement config, or release channel changes, create a new RC folder.

Set `PHASE9_RELEASE_CANDIDATE_DIR` to the signed folder path, for example `docs/phase-9/release-candidates/rc-2026-07-04-b001`, before setting any `PHASE9_*_PASS=true` value or `PHASE9_SIGNED_OFF_BY`. `phase9:release-smoke` rejects dirty Git worktrees, nonconforming RC IDs, `_template`, untracked or HEAD-mismatched metadata, template-identical files, unresolved placeholders, invalid signoff rows, and a mismatched build-source SHA. The strict command also runs the non-writing store inspector, which validates the evidence index and cross-checks the manifest and store-packet release identity.
