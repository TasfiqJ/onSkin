# PHOTO-05A Trend Admission Source Checkpoint

Date: 2026-07-29

Status: `in_progress` source checkpoint; literal zero Trend-insight admission

## Outcome

PHOTO-05A removes the historical simulated-Trend path and establishes the
boundary that must exist before a real PHOTO-05 engine is built. It does not
complete PHOTO-05, produce a skin observation, validate an algorithm, approve
consent copy, close a fairness or legal review, enable a launch surface, or
make Trend a proven revenue feature.

The current source contract keeps both of these values literal and immutable:

- `phase7Capabilities.trendEngine=false`; and
- `phase7Flags.trend=false`.

The machine-readable `trendInsightAdmission` contract records no real engine,
result issuer, calibration authority, fairness authority, simulated metric,
content analytics, or admitted side effect. Environment variables, development
or E2E settings, a final domain, caller-supplied consent, a forged positive
delta, a Monk tone, a historical local or database row, a fixture, or a QA
boolean cannot override that boundary.

Its exact current keys are all literal `false`:

| Key                                | Value   |
| ---------------------------------- | ------- |
| `trendInsightAdmitted`             | `false` |
| `validatedOnDeviceEngineAvailable` | `false` |
| `resultIssuerAvailable`            | `false` |
| `calibrationAuthorityAvailable`    | `false` |
| `fairnessAuthorityAvailable`       | `false` |
| `simulatedMetricsAllowed`          | `false` |
| `contentAnalyticsAllowed`          | `false` |
| `disabledPathSideEffectsAllowed`   | `false` |
| `cloudPhotoProcessingAllowed`      | `false` |
| `scoreAgeGradePercentageAllowed`   | `false` |

The correct current user-facing result is the private photo timeline and the
existing no-score explanation. It is never a fabricated `consistent`,
`change_observed`, `inconclusive_lighting`, or `insufficient_data` Trend
result.

## Current Source Boundary

### No result without a real issuer

The historical pure classifier and copy catalogue are not an image-analysis
engine. A deterministic default delta is not evidence that two photographs
were registered, measured, calibrated, or compared. PHOTO-05A therefore
withholds every Trend result instead of turning missing measurement authority
into reassuring copy.

The current boundary requires:

- no Trend card or Trend call-to-action on Progress;
- no active Trend consent control or fairness-content surface;
- direct `/trend/optin` and `/trend/fairness` entries render only the truthful
  unavailable recovery state;
- no route, hook, component, fixture, or caller can construct a positive
  result while the capability is false;
- Trend hooks return a nonloading, nonconsented, no-insight state without
  invoking caller photo getters or reading consent, profile, Monk-tone, Trend
  storage, or network state; and
- positive consent grant fails with the bounded
  `TREND_ENGINE_UNAVAILABLE` result before any consent-ledger mutation,
  analytics, or engine work.

An explicit withdrawal or privacy cleanup may still delete legacy Trend state.
That cleanup is a data-rights path, not positive feature admission. It must not
create a current grant, preserve a result for display, or emit content
analytics.

### Side effects stay closed

Before a future positive admission receipt exists, a Trend attempt must not:

- evaluate simulated deltas, Minimal-Detectable-Change thresholds, Monk-tone
  adjustments, fairness bands, or narrative keys;
- read or decrypt photographs for Trend processing;
- persist a Trend result or a positive Trend grant;
- call a network, cloud model, general multimodal model, native analysis,
  file-export, cryptographic-export, or sharing service;
- send a result, condition, photo identifier, tone, derived health inference,
  or content-state event to analytics or crash reporting; or
- render a score, age, grade, percentage, redness/erythema metric, diagnosis,
  disease label, treatment claim, accuracy claim, or superiority claim.

The existing `photo_trend` database shape and any legacy local data remain
data-lifecycle liabilities for export, withdrawal, deletion, retention, and
incident review. Their existence is not a publication or processing
authority.

## Decision Crosswalk And Supersession

The feature document and root decision log use two deliberate numbering
systems. They govern the same five decisions:

| Feature-document decision | Root decision | Governing rule                                                                                                                 |
| ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `D-046`                   | `D-068`       | No populatilayerwell score, skin age, grade, or percentage; Trend is not a seven-figure pillar.                                  |
| `D-047`                   | `D-069`       | Any future engine is on-device only; cloud and general multimodal models are not a phase.                                      |
| `D-048`                   | `D-070`       | A future output is within-person descriptive change above a validated noise floor, never a population verdict.                 |
| `D-049`                   | `D-071`       | Fairness is a launch gate, redness is not the metric, and claimed performance requires predeclared diverse-condition evidence. |
| `D-050`                   | `D-072`       | Trend processing requires separate, explicit, revocable, default-off consent and installed-base reconsent.                     |

PHOTO-05A does not renumber these decisions. It supersedes only the former
implementation note under root `D-069` that treated a conservative stub as
authority to render `consistent`. The on-device-only architecture decision
remains. Until a real engine and the downstream gates exist, no Trend output is
admitted at all.

## Future Positive Admission Contract

This checkpoint intentionally defines no positive runtime path. A successor
must use a new versioned admission contract and bind, at minimum:

1. the exact signed source and production archive containing the real on-device
   engine;
2. an issuer-authenticated result receipt tied to the exact input-pair
   identities, capture metadata, engine/model version, preprocessing and
   registration version, measurement definition, calibration version, device
   class, output, limitations, and expiry;
3. proof that only the intentionally selected same-user, same-view,
   sufficiently separated, successfully decrypted photographs were processed
   and that no image or feature vector left the device;
4. a predeclared measurement-validity and repeatability protocol, including
   known failure states for lighting, pose, focus, occlusion, capture interval,
   unsupported device, storage/key failure, and insufficient data;
5. a predeclared fairness protocol across skin tone, lighting, hair, glasses,
   ordinary environments, supported iPhones, and other material conditions,
   with a named independent reviewer and explicit false-positive,
   false-negative, inconclusive, and abstention results;
6. a separately reviewed exact consent disclosure, withdrawal and deletion
   lifecycle, installed-base reconsent, retention rule, export treatment,
   backup behavior, incident plan, and App Privacy answers;
7. exact user-facing and store copy reviewed for express and implied health,
   medical, cosmetic, accuracy, objectivity, and performance claims;
8. archive-identical network, analytics, crash, filesystem, backup, and
   process-death evidence;
9. supported-physical-iPhone performance, memory, thermal, battery,
   accessibility, Dynamic Type, Reduce Motion, lifecycle, failure, and
   cancellation evidence; and
10. current professional, privacy/security, regulatory, and release signoffs
    bound to the exact source, archive, evidence, markets, and copy.

Apple Vision face-landmark and capture-quality APIs and Accelerate/vImage image
operations may be useful implementation primitives. Their availability does
not validate a skincare measurement, define a clinical or cosmetic claim,
establish fairness, or issue a Trend-admission receipt.

## Independent Blocker Registry

These blockers are independent and all remain launch-blocking:

| Blocker         | What must be supplied                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `B-AI-ONDEVICE` | A real on-device engine, measurement definition, calibration, supported-device performance, failure behavior, and exact-source evidence.                                   |
| `B-AI-FAIRNESS` | A consented, predeclared, independently reviewed, diverse-condition cohort and signed parity/abstention/drift report.                                                      |
| `B-AI-LEGAL`    | Market-specific regulatory/privacy/consumer-protection review of the exact feature, data flow, consent, policies, App Privacy answers, and every express or implied claim. |

`B-AI-ONDEVICE` cannot absorb fairness or legal review. Likewise, copy review
cannot manufacture engine validity, and a fairness report cannot authorize
cloud processing or a medical claim. PHOTO-06 and PHOTO-07 remain downstream
of the unfinished PHOTO-05 engine.

## Primary-Source Research Basis

Accessed 2026-07-29. These primary sources support a conservative engineering
boundary. They do not determine every law's applicability, provide legal or
medical advice, approve Layerwell, or guarantee App Review.

| Authority                                                                                                                                                                                                                                                                                                                                                                 | Current engineering implication                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)                                                                                                                                                                                                                                                                                   | Guidelines 1.4.1 and 2.3 require support for health-measurement accuracy/methodology claims and accurate feature/metadata descriptions. Guidelines 5.1.1 and 5.1.2 require transparent purposes, consent, minimization, withdrawal, retention/deletion disclosure, and restrictions on personal and facial-mapping data use. Inference: a flag or polished card cannot substitute for a validated engine or an accurate submission. Apple decides the submitted build.                                                                          |
| [Apple App privacy details](https://developer.apple.com/app-store/app-privacy-details/) and [App Store Connect privacy management](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)                                                                                                                                         | Apple classifies health, photos/videos, sensitive information, identifiers, usage, and diagnostics separately and requires disclosure of first- and third-party collection. Apple says data processed only on device is not “collected” for the label, while an off-device derivative must be assessed separately. Inference: the local-only answer must come from the archive, SDK inventory, configuration, and observed traffic, not source copy alone.                                                                                      |
| [Apple Vision face landmarks](https://developer.apple.com/documentation/vision/vndetectfacelandmarksrequest), [face-capture quality](https://developer.apple.com/documentation/vision/selecting-a-selfie-based-on-capture-quality), and [Accelerate/vImage](https://developer.apple.com/documentation/accelerate/vimage-library)                                          | Vision can locate facial features and compare capture attributes such as lighting, blur, occlusion, pose, and focus; vImage supplies optimized transformations, histograms, morphology, and color conversion. Inference: these are capture/image-processing primitives, not an Apple-validated skin-change engine, fairness report, medical device clearance, or accuracy claim.                                                                                                                                                                |
| [FDA General Wellness: Policy for Low Risk Devices, January 2026](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices) and the [final guidance PDF](https://www.fda.gov/media/90652/download)                                                                                                               | The guidance is nonbinding and covers low-risk general-wellness intended uses. It distinguishes wellness values/trends from outputs intended for screening, diagnosis, monitoring, clinical action, or disease management, and identifies clinical-accuracy/grade claims and specific disease/threshold language as outside the described wellness boundary. Inference: no-score cosmetic positioning reduces risk but does not itself classify or approve this exact feature; qualified counsel must analyze the finished function and claims. |
| [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)                                                                                                                                                                                                                                            | Express and implied objective health or safety claims need adequate prior substantiation, generally competent and reliable scientific evidence appropriate to the claim. Inference: “descriptive,” “AI,” a disclaimer, or an on-device implementation does not cure an unsubstantiated net impression of accurate skin measurement or improvement.                                                                                                                                                                                              |
| [FTC Health Breach Notification Rule compliance guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)                                                                                                                                                                                                               | The FTC explains that the amended rule can cover health apps outside HIPAA and that unauthorized disclosures, not only intrusions, can trigger duties for unsecured identifiable health information. Counsel must determine the exact PHR/multiple-source and encryption applicability; zero admission also reduces the current derived-data and disclosure surface.                                                                                                                                                                            |
| [Washington My Health My Data Act, RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true) and [Washington Attorney General FAQ](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy)                                                                                                                                    | The statute includes inferred or derived health information, treats collection broadly, requires a consumer-health privacy policy and purpose-specific consent subject to exceptions, and provides access, withdrawal, and deletion rights. Inference: an on-device derived skin observation may still require data-lifecycle and consent analysis; local processing is not a universal legal exemption.                                                                                                                                        |
| [California Civil Code § 1798.140](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140.), the [current CCPA statute](https://cppa.ca.gov/regulations/pdf/20260101_ccpa_statute.pdf), and the [CPPA regulations effective January 1, 2026](https://cppa.ca.gov/regulations/pdf/ccpa_updates_cyber_risk_admt_appr_text.pdf) | The CCPA definitions include personal information collected and analyzed concerning health as sensitive personal information, and the current regulations require qualifying businesses to assess processing that presents significant privacy risk, including sensitive-personal-information processing. Exact business-threshold, exemption, permitted-use, notice, limit, rights, risk-assessment, and ADMT applicability require California counsel; this checkpoint makes no conclusion.                                                   |

## Source And Verification Boundary

The aggregate source contract is expected at:

- `scripts/photo05/trend-admission-source-contract.mjs`; and
- `scripts/photo05/trend-admission-source-contract.test.mjs`.

It is expected to be mandatory in Phase 7, Phase 9, and launch verification,
with the complete Trend authority inventory bound into both governed packet
source snapshots.

Source-level acceptance must include:

```bash
npm run launch:contract:smoke
npm run photo05:trend-admission-source-contract:test
npm run phase7:check-core-loop-smoke
npm run phase9:release-smoke
```

Executed against the integrated worktree on 2026-07-29:

- `launch:contract:smoke` passed;
- `photo05:trend-admission-source-contract:test` passed all 12 adversarial
  cases;
- `phase7:check-core-loop-smoke` passed; and
- `phase9:release-smoke` reached the existing unrelated missing
  `test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current/summary.json`
  blocker, alongside its expected unset release-evidence warnings. It did not
  report a PHOTO-05A source-contract failure.

These are working-tree results, not signed-archive evidence. The passing checks
prove only the bounded zero-admission source structure; the Phase 9 command
remains failing and no packet or release status is promoted.

Human-simulated E2E must still exercise direct `/trend/optin` and
`/trend/fairness` entry with every historical environment, development, E2E,
consent, positive-delta, tone, and legacy-state override enabled; verify the
private photo timeline remains usable; verify no consent control, Trend result,
or Trend entry point mounts; return to Progress; and retain screenshots, route
snapshots, console logs, storage/ledger snapshots, and network/analytics
absence evidence at all supported iPhone viewports. Historical enabled-fixture
screenshots are regression context only.

## Remaining Work

1. Build the real PHOTO-05 on-device engine and versioned result issuer.
2. Complete PHOTO-06 calibration/fairness and PHOTO-07 disclosure/data-
   lifecycle work.
3. Obtain exact-source privacy/security, clinical/cosmetic, regulatory, legal,
   and release signoffs.
4. Complete exact-current human-simulated, native, hosted, archive, network,
   accessibility, performance, and incident evidence.
5. Submit the exact release build and receive Apple's actual decision.

Therefore PHOTO-05 remains `in_progress` and Trend insights remain
launch-blocked. This checkpoint is not engine validation, fairness validation,
medical or legal advice, privacy compliance, Apple approval, product-market
fit, a seven-figure plan, or any revenue proof.
