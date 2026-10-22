# Baseline and V1 → V2 reconciliation
## Exact starting line
**Starting record:** Oct19 source pack, commit `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`, tree `a7e406303c0c865a2563a0d6f1ab1db80e3bb653`.
**Older inspectable code:** Oct14 V2 snapshot, commit `473bad3a7d7d434383b44fc102cd2666a79c06a0`, tree `39ca1dbab5b3136c66844af1b9a05643a082867b`.
**Freshness rule:** Bootstrap observed the Oct19 SHA as the latest main Actions head. Codex must fetch main again, capture `git rev-parse HEAD` and `HEAD^{tree}`, compare ancestry and every intervening change, then audit before editing. Do not reset main to either historical pin.

| Current observation | Evidence | Meaning |
|---|---|---|
| Quality: failure | Run 39330376557, head bbc28dc; failing job 118333051806, credential-free Supabase reset/database tests | Root cause unavailable from public authenticated-job logs; diagnose before fix. |
| Security: success | Run 39330376548, same head; single-owner automated source-only acceptance | Retained scanner exit annotations remain. This is not zero findings, replay permission or release clearance. |
| iOS launch contract: success | Run 39330376531, same head | Source contract check, not a signed native build or device test. |
| Source acceptance time bound | `scripts/phase9/security_acceptance/proposal.json` at same SHA | Mode SINGLE_OWNER_AUTOMATED_SOURCE_ONLY; `notAfter=2026-10-21T00:00:00Z`; replay/integration/release authority false. |
| Offline snapshot identity | Re-ran independent audit supplied in Round2 | 1,753 blobs, 139 Git objects, zero identity errors. Historical text identity only. |

The Quality page includes platform migration warnings (Ubuntu runner/Node action runtime). They are diagnostic leads, NOT a proven failure cause. Do not blindly downgrade runners, migrations or dependencies. A clean clone/full test run/current authenticated logs were not available in bootstrap; no such success is claimed.

## What is genuinely retained
The Oct19 raw inventory retains manual-first Shelf/local parsing/optional OCR, owned routine, Today check-offs and cycle persistence. The source history describes owner/session-generation isolation, anonymous ownership, Apple/email portability, consent/withdrawal, encrypted local persistence, local private photo deletion and publication fences, RevenueCat exact-owner entitlement boundaries, outbox/recovery, local reminders and closed legacy surfaces. Preserve these and their tests as the substrate. Source availability is not proof that native flows, clinical content, vendors or release are accepted.
The September27 source integration report records 421 mobile test files/4,883 tests plus operator/type/lint/UI work. These numbers are historical report evidence, not freshly executed tests at bbc28dc. Do not repeat them as today's green suite.

## Active governance is unfinished even where reusable code exists
The supplied active task state has 25 items: 8 in progress, 7 not started, 10 external pending, and 0 complete. This does NOT mean the app has no working code. C-item closure requires more evidence than a reusable implementation slice. The raw feature inventory has 376 items; the legacy disposition list has 202 records. Preserve every ID and original status. `legacy_feature_crosswalk.json` and `legacy_task_crosswalk.json` assign explicit migration handling without laundering source status into release status.

| V1 work | New handling | Gate / phase |
|---|---|---|
| C-01 scope/validators/mirrors | Replace planning authority additively, retain closed runtime contract until a bounded capability is admitted | P0–P1 |
| C-02 UI; C-03 closed surfaces | Repair current supported-size paths, preserve four-tab core; keep catalog/growth/Ask/commerce closed | P1 |
| C-04 account/guest; C-11 rights | Reuse owner-generation fences and Apple/email lifecycle; align adult gate; add V2 text sync only with consent | P1–P2 |
| C-05 Shelf | Keep manual fallback and optional local OCR; extend formula identity and provenance, not remote catalog dependence | P1–P2 |
| C-06 reviewed guidance | Keep positive unreviewed advice unavailable; produce exact reviewer packet; factual record works while blocked | P1, P4 expert gate |
| C-07 Today/routine/cycle | Finish durability/recovery, then record actual/intended/version events without punitive adherence assumptions | P1–P2 |
| C-08 private Progress | Finish local encrypted diary first; add capture metadata and separately gated analyses | P1–P3/P5 |
| C-09 reminders | Local-only delivery/cleanup and actual-device proof; remote push is not required | P1–P2 |
| C-10 payments | Preserve fail-closed runtime; source/sandbox completion; free quota remains independent of paid receipt | P2/P4 |
| C-12 policy/brand; C-13 infra; C-14 QA | Fail-closed placeholders, real cohort disclosures, minimum configured services, build-specific evidence | P1–P4 and release |
| C-15 final verification | Superseded as the only roadmap terminal; retain original acceptance lineage and require new release-specific packets | M2-04, M3-04, P4/P5 release gates |
| H-01–H-08, V-01–V-02 | Preserve real-world owners; produce precise action packets only when blocking an actual gate | Never auto-complete |

## Unfinished work does not force a V1 detour
Do not finish the superseded all-features launch or resurrect every legacy task before V2. Retained safety, privacy, data integrity and baseline CI must be repaired. Closed speculative/growth/catalog surfaces remain closed. Build reusable V2 additions in place; obsolete presentation or aggregate-plan semantics can be replaced behind tested adapters. No destructive migration, historical formula rewrite, forced login, automatic practitioner ownership, or subscription reset.

## V2 scope crosswalk
V2-C01 access/consent/rights → P1/P2; C02 formula-aware intake → P2; C03 change ledger → P2; C04 optional exceptions → P2; C05 current plan/version → P2; C06 product decisions → P4; C07 private capture → P2/P3; C08 appointment brief → P4; C09 reminders → P1/P2; C10 packaging/billing → P4; C11 accessible recovery/IA → every phase; C12 support/measurement → P2/P4.
V2-P01 workspace roles → P4; P02 client grants/web → P4; P03 plans/templates → P4; P04 reconciliation queue → P4; P05 pre-visit/offboarding → P4; P06 workspace billing/capacity → P4, commercial admission separately blocked.
Original EP-V2-00/01 → P0/P1; EP02/03/04 → P2; EP06 capture portion → P3 and brief → P4; EP05/07/08/09/10/11/12 → P4; EP13 → release-specific admission after P4 with any clinical claim additionally gated in P5+. `v2_feature_crosswalk.csv` preserves all 38 original F/V2 feature rows.

## Evidence sources
S1 = `90_Provenance/V1_Oct19/` (especially integrity README, active state/graph, launch contract, feature inventory, Sept27 integration and founder gates).
S2 = `90_Provenance/V2_Oct14/` and its exact original archive; source claim map locates bounded Oct14 code.
S3 = `90_Provenance/Review_Round2/` and bootstrap reproduction outputs.
S4 = original Product Priorities PDF, especially pages 6–9.
S5 = complete J05 research under `04_Clinical/J05/source_research/` plus restricted reports.
W1–W12 = `90_Provenance/external_sources.json`, fresh public observations and official platform information.
