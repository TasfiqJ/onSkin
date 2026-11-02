# Campaign39 exact formula-history route inventory

Authority: BRAIN-M1X-MASTERV2-FORMULA-ROUTE-INVENTORY39-CORRECTION-01.
Disposition: source synchronization candidate; independent Brain review required.
acceptanceGranted=false; release=NO_GO.

Exact parent is draft PR41, stage/m1-owned-formula-version38,
92f62f60e47237dd1f06750d8f7d9d2006b82617 / tree
aea947d237d49cfcdad72ced54213b1f3a6ddf4e. Its parent PR40 remains
530da5d8af8c3b74a1675a4cfdffc03dca2ec9c1 / tree
034cd0b1708362f377a88dbef24e6fe0ddfbd1e3. Main remains
53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6. The immutable plan-only first child
is 317a1c29ad2bd6dddd601317bbd317654bb9ed11, SHA256
1aee05427968151eddd96d6d59546ade5ef2def324d16765e0f23be3cc59947f.

## Exact correction and evidence

Campaign38 introduced an owner-local bottle/formula-history route. Its unchanged
launch validator correctly refused the old generated inventory. A fresh C39
reproduction at exact PR41 exited 1; its log SHA256
a43646213f2a6d0d5f80b6826ad70e563238e2ce941f7e6f08a0a346f15bafe3 matches the
authenticated C38 stale-inventory receipt. That refusal remains a historical
failure, not a passing iOS gate.

The unchanged pure buildFeatureInventory() and stableJson() independently produce
the authenticated expected bytes. The sole correction is categoryCounts.route
93 to 94 plus this one canonically ordered items row:

```json
{
  "id": "route:shelf/formula-history.tsx",
  "category": "route",
  "source": "apps/mobile/src/app/shelf/formula-history.tsx",
  "featureIds": ["F-03", "F-04"],
  "readiness": "needs-device-verification"
}
```

Original inventory SHA256:
620d798e86c2fd0f8adb810cac1b11eaa3a1d9551f14db474454bb49f6148178.
Corrected inventory SHA256:
166193bb73f389565aa141848546ee56e6f76967c0fdee3086dcc935772cf8a3.
Removing that row and restoring integer 93 recovers the exact original structure.
Every other inventory member, count, feature flag, grouped surface, feature ID,
readiness and admission is unchanged. All app source and existing tests retain
exact PR41 bytes. No route, implementation, native permission or provider is added.

The unchanged default producer's other output, task-graph.json, recomputes to its
original committed bytes. The default producer preserves existing execution
status. Its optional reset-only status builder differs from recorded progress;
that reset is not applied. Original launch contract, status, credentials,
evidence governance and worktree boundary remain byte-identical. The protected
execution-baseline writing producer is never run in the C39 source checkout.
Original validator and smoke pass with the narrow inventory correction.

## Independent source controls

Current39 validates exact parent/plan/grant/preimages, source SHA256 ledger,
complete Git object/index/working bytes, allowed source interval and sole final
two-worklist seal. Hosted validation requires the genuine pull_request event,
live open/draft/unmerged PR, exact head/base/main chain and actual GitHub service
merge ref/parents/tree. Local validation is explicitly not hosted CI evidence.

Only Quality's initial source-governance block changes. All later Quality jobs,
DB/PG15/17/exports, original iOS launch and original Security/candidate workflows
remain byte-identical. Original38 controls run only at pinned PR41 in a separate
full named checkout, with its actual stale-inventory refusal and genuine nested
37-through-29 replay. An original38 refusal on new C39 is retained as a refusal.

Hostile tests cover missing/duplicate/wrong route mappings, readiness/admission
upgrades, stale/excess counts, every unrelated inventory field, changed protected
artifacts/readers, forged approvals/events/service merges, stale refs, dirty
index/working bytes, modes/flags/links/object-store substitutions and invalid
history/seal extensions. Actual tampering and exact restoration occur only in
disposable fixtures, never in protected C39 checkout paths.

The TASK ledger records actual local commands/exits/log SHA256. Hosted results
occur after the immutable final seal and are recorded in the external final
report/evidence return, including failed attempts and terminal run/job IDs.
Browser reruns use the unchanged C38 harness with synthetic local owners and
blocked provider endpoints. Their new evidence is distinct from authenticated
C38 receipts and never substitutes for signed native/device qualification.

Local regression passed 6,562/6,562 tests (6,538 mobile and 24 operator), with
zero Turbo test cache hits; typecheck and lint each passed all three tasks with
zero cache hits. Focused Shelf/formula/storage/consent tests passed 233/233;
retained browser-driver controls passed 103/103. Current39 boundary, real-source
and inventory suites passed 20/20, 13/13 and 5/5 respectively. Both actual new
375x667 and 390x844 Expo web journeys exited 0; the latter also used the existing
2x CSS text stress, without claiming native Dynamic Type or VoiceOver proof.

An additional exploratory execution of the unchanged older33/34 opt-in suites
on the new interval exited 1 (123/154 passed, 31 failed). Those historical
source-scope readers refuse newer source intervals. Exact PR41's original
opt-in CLI also exited 1 with R33_SOURCE_HASH. These actual refusals are retained,
not relabelled as current successes or repaired outside this grant. The current
default Lean V1 exports/loaders/snapshots retain their exact technical meanings;
current39 full-app obligation projection supplies no external admission.

Current39 metadata reads use the workflow's built-in ephemeral token only inside
GitHub Actions. Existing contents:read permission is sufficient for public PR
GETs; no permission is expanded. The initial step alone supplies GH_TOKEN;
historical child environments strip it. Local execution never consumes a
personal token. This prevents current checks from exhausting the anonymous API
budget needed by unchanged historical programs.

The first local historical replay reached exact PR40 and failed before network
reads because its original Windows reader could not open a 279-character nested
path. Extended Win32 readback proved the tracked file exists with exact Git
bytes. Only the new39 wrapper's temporary-directory placement was corrected:
historical child workspaces share the flat external temp parent. Original
historical programs and their path/refusal checks remain unchanged; the failed
attempt and the subsequent full rerun have separate custody records.

## Permanent remaining gates

All 38 required full-app/J01 obligations remain complete=false and all 18 qualified
owner gates admitted=false. Whole V2-C02 remains NOT_ACCEPTED. G97 FAILED/NO_GO;
original Security and candidate29 FAILED; DB06/DB08/R2B NOT_ACCEPTED; M1-03
BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED. Full app plus J01 Visible
Pores is only a separately qualified candidate. The old Lean V1 JSON remains a
protected technical safeguard and supplies no new release authority.

J01 G1-G5, rights, clinical/statistical evidence, signed iPhone/VoiceOver,
provider/paid/professional, legal/IP/Apple and public gates stay CLOSED. F18 and
J02-J27, including J05, remain deferred. F09 encrypted private diary, manual
comparison and deletion are preserved. Formula-history remains a local factual
source candidate with needs-device-verification pending independent Brain review
and actual device qualification. No medical/cosmetic efficacy claim, cloud photo
upload, paid unlock, user data, merge, release or deployment is authorized.

Historical reference only: [Campaign38 return](https://drive.google.com/file/d/1BuldasgxzDxYOPJF-MIqJoXOTqYDZaDY/view),
70,097,862 bytes, SHA256
4c0904aee95f623754569b3ffa6987daec6a6266f786fe641557af7e169350ef.
The large historical ZIP is not downloaded again or bundled in this return.
