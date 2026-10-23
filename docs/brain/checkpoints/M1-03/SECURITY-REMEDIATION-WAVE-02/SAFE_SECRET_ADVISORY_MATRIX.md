# Safe original-provider and dependency review

Fresh original Security run `40020077385` is bound to PR merge commit `3f04e0fc6e4dff45d5095a7d6bde6872d42a4b68`; its tree exactly equals issued stage `b6b5ec635dd12e327a34904ebbd1e1252715bcd4`. It is not represented as a stage-commit checkout. Artifact API digests match the downloaded ZIP bytes. Only sanitized projections are delivered; raw provider ZIPs and scanner values stay in disposable memory.

| Evidence | Measured result | Disposition |
| --- | --- | --- |
| Gitleaks current | 1,126; exit 2 | All current paths/blob/SHA identities independently match the issued source; unreviewed |
| Gitleaks history | 4,361; exit 2 | Separate original full-history provider observation; unreviewed |
| Current rule counts | generic-api-key 1,120; jwt 4; sentry-access-token 1; private-key 1 | Rule identity is not a liveness or credential classification |
| TruffleHog current/history | 0 verified; both exit 0; no execution errors in original projection | Does not clear Gitleaks or establish issuer disposition |
| Original provider npm audit | 6 high; exit 1 | Six propagated node-forge records at provider observation time |
| Fresh installed npm audit | 7 high; exit 1 | Same node-forge roots plus newly published Zod advisory |
| Same-SDK disposable candidate | fresh ci/Expo compatibility pass; audit exit 1, 7 high; lock delta zero | Rejected; no vulnerability reduction |
| Official patched Python candidate | MCP 1.30.0 and OTel 1.45.1/0.66b1; primary OSV queries return no known advisory for candidate wheels, with vulnerable-version positive controls detected | Candidate only; no stage source remediation applied |

`evidence/triage/secret-current-bindings.json` provides a hashed path/range/blob/SHA review row for every current finding. Source classes are one app/package, 18 checkpoint/review, 10 tool/fixture, one database/Edge and 1,096 other source. Classification is by location only. No value is printed, tested, uploaded, allowlisted or declared noncredential. Repository owner TasfiqJ must obtain qualified issuer/custodian classification and, if real, arrange revocation/rotation through the issuer. No owner receipt exists.

The newly authenticated counts supersede the packet's attributed 1,121/4,351 observation at the earlier measured source. They are not a scan of this checkpoint's final evidence tail. New checkpoint growth remains unreviewed by the original provider until exact-head CI runs.

`evidence/triage/advisory-primary-matrix.json` binds every original OSV path to its current Git identity and separates historical checkpoint requirements from executable scanner dependencies and the app/development lock. Original findings include MCP `GHSA-84m7-p3x7-pcfv`, OTel `GHSA-xcq7-p3pf-p88h`, node-forge `GHSA-86w9-cpqp-85rv` and Zod `GHSA-mrhx-c7xc-m3w5`. Historical checkpoint source is immutable; its old package pins cannot be silently rewritten to make recursive OSV zero.

node-forge 1.4.0 is still the latest official release; the current advisory has no fixed release event. Current installed paths are root direct tooling and Expo 57.0.31 → CLI 57.0.32, directly and via code-signing-certificates 0.0.6. The newest certificates package 0.0.7 still requires node-forge ^1.4.0. These paths serve CLI/development signing; no absence from a compiled app binary is claimed without a native artifact. The direct root declaration is real and retained. Previously removing it did not remove Expo transitive roots; this wave additionally tests the supported same-SDK npm update plus a fresh install. It resolves to the unchanged lock, passes Expo compatibility and retains the advisory.

Zod 3.25.76 is now affected by the authenticated high-severity advisory, fixed at 4.6.6. Expo CLI's current ^3.25.76 declaration does not admit that major version. Registry latest 4.6.7 is not a justification for an unsupported transitive override. This wave does not mutate stage npm manifests, lock, overrides or application behavior. The candidate lock/parent analysis, exact primary response hashes and sanitized fresh audit records are retained. No waiver or false zero is proposed.

All Security owner/source-review/exception expiry controls remain unchanged. The proposal is expired on 2026-10-21 and exception reviews on 2026-10-17. Original source Security remains RED, with no database, native/archive/device, hosted replay, release or M2 acceptance.
