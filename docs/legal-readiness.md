# OnSkin — Legal & Regulatory Readiness Checklist

> **Historical checklist, not legal clearance.** The active iOS-only,
> provisional U.S.-only launch contract, `docs/hugeToDo/US_WAVE1_PRIVACY_AND_CONSUMER_HEALTH_LAW_GATE.md`,
> the Phase 3 review packet, and `BLOCKERS.md` supersede categorical statements
> in this file. Medical-device, HIPAA, CCPA/CPRA, consumer-health, biometric,
> minors, subscription, and claims classifications depend on the final entity,
> relationships, intended use, functions, data flows, thresholds, users,
> storefronts, and exact copy. A disclaimer is supporting disclosure, not a
> classification safe harbor.

> **This is not legal advice, and it was not written by a lawyer.** It's a
> practical map of the legal/regulatory surface for OnSkin, synthesised from the
> research already in `docs/00 §7`, `docs/01 §4`, and `docs/02 §9`, plus the
> common-sense framing below. OnSkin handles skin photos + skin-health inferences
> and carries exposure under a law with a **private right of action** (Washington
> MHMDA) and under FDA/FTC claims rules — so **before any public launch you must
> engage real attorneys** (privacy/health-data + patent) and a **board-certified
> dermatologist + cosmetic chemist**. The dollar figures here are
> **order-of-magnitude estimates, not quotes** — get 2–3 real quotes.

---

## TL;DR

- The repository is designed toward a cosmetic/general-wellness posture, but no
  source file can conclude that the final app is not a regulated medical device.
  FDA classification turns on intended use, claims, and actual functions; a
  standing "not medical advice" disclaimer does not cure diagnostic, treatment,
  mitigation, measurement, or recommendation functionality. Preserve the
  regulated-device and professional-review launch gates until qualified counsel
  reviews the exact release and App Store Connect declaration.
- The app's architecture was **deliberately designed** to stay in that lane:
  cosmetic language, evidence-graded + non-alarmist conflict copy, a separate
  conservative **safety** class that _defers to a clinician_, on-device-first
  photos, and a standing disclaimer.
- The exposures that actually have teeth are **(1) privacy / health-data law**
  (Washington MHMDA — per-violation penalties + private right of action) and
  **(2) false reassurance on a genuine safety item** — both mitigated by design.
- Every named professional and regulatory gate in the active review packet is
  **mandatory before the associated surface launches**. Professional review is
  neither a government permit nor a marketing asset by default, and it cannot
  guarantee compliance, safety, App Review acceptance, or commercial results.

---

## 1. Are we a "medical device"? (the founder's core worry)

**Current answer: unresolved until the exact release is classified.**

- FDA oversight turns on the exact software function and intended use, including
  claims to diagnose, treat, cure, mitigate, or prevent disease or affect body
  structure/function. The FDA's general-wellness and device-software guidance
  must be applied to the final functions and claims, not to the app category or
  disclaimer in isolation.
- The intended launch posture is **general cosmetic information + routine
  organisation**, with exact-hash reviewed content and clinician routing.
  Trend analysis, photos, Ask, safety guidance, measurements, recommendations,
  metadata, and marketing must each remain disabled until their function-specific
  review gate closes.
- **The line you must not cross:** the moment copy says "diagnoses your acne,"
  "treats your rosacea," or "clinically proven to…", you risk reclassification.
  This is enforced in code by the **claim-safety regression test**
  (`apps/mobile/src/features/intelligence/claimsafety.test.ts`), which blocks
  drug/disease verbs and alarm words from shipping in rule copy.

> Action: obtain a function-specific written FDA/device-positioning opinion tied
> to the exact release hashes and intended-use/claims inventory, then complete
> the truthful App Store Connect regulated-medical-device declaration. Counsel
> must determine whether any regulator interaction, filing, clearance, or other
> action is required.

---

## 2. The four exposures (each maps to a BLOCKERS.md item)

### A. Cosmetic-vs-drug claims — FDA/FTC · (docs/02 §9)

In-app copy is a **claims surface**. Keep everything cosmetic ("reduce the
appearance of," "may minimise irritation," "supports the barrier"); never
"treats / cures / heals / stimulates collagen / prevents [disease]." The FTC
separately polices advertising for truthfulness/substantiation.

- **Status:** enforced by the claim-safety test guard; final wording needs a
  counsel pass. Tracked under **B-PRIVACY-COPY** (copy review).

### B. Privacy / health-data law — _the one with teeth_ · (docs/00 §7, docs/01 §4)

Skin photos and skin-health inferences are treated as sensitive consumer-health
data by the launch controls. Actual legal applicability remains fact-specific:

- **Washington MHMDA** is a conservative U.S. Wave 1 launch gate: standalone **Consumer Health Data
  Privacy Policy** linked on the homepage; **opt-in consent for collection that is
  "separate and distinct" from consent for sharing**; **private right of action**;
  civil penalties up to **$7,500 per violation**; deletion right with few
  exceptions. _(This is the single most likely thing to get a startup sued —
  treat it as priority #1.)_
- **GDPR and Canadian/Quebec regimes** remain later-market gates; those
  storefronts are closed rather than assumed covered or cleared.
- **CCPA/CPRA** depends on statutory scope and thresholds. **COPPA** and other
  minors rules depend on the final audience, knowledge, collection, and age
  policy; the current product threshold is not a legal conclusion.
- **Illinois BIPA and other biometric laws** require fact-specific review.
  On-device framing with no retained faceprint/template minimizes exposure but
  does not itself prove non-applicability.
- **Status:** consent ledger + unbundled consent screens + on-device-first photos
  are built; the **policy/ToS/consent text + DPIA need a privacy lawyer**. Tracked
  under **B-PRIVACY-COPY**.

### C. The conflict-rules content — clinical sign-off · (docs/02 §9)

This is the "suggestions from research, not a doctor" concern directly. The
mitigation is layered: evidence grades on every rule, non-alarmist
resolution-first copy, a separate maximally-conservative **safety** class that
_defers to a clinician_, the standing disclaimer, **and** professional sign-off.

- **Status:** 13 candidate rows are recorded for review, not approved for use.
  Production admits zero rules. Before any exact corpus reaches users, it needs
  independent board-certified-dermatologist and cosmetic-chemist/pharmacist
  approvals plus separate regulatory-counsel claims/jurisdiction clearance,
  all bound to the exact corpus, source registry, per-rule hashes, market scope,
  reviewer credentials, and detached signatures. A legacy `reviewed_by` string
  is display metadata and cannot authorize publication. Tracked under
  **B-DERM-REVIEW** and the Phase 3 legal/clinical/chemistry gates.

### D. The skin-type quiz — patent/copyright · (docs/01 §2)

The rights and freedom-to-operate posture around the Baumann system is
**unresolved**. Public records reviewed in
`docs/phase-3/quiz-fto-summary.md` include abandoned and expired-fee-related
statuses, but those labels do not resolve continuations, related families,
territories, copyrights, trademarks, contracts, or claim scope. Do not infer
permission from a public status. Any four-axis assessment must use original
questions/scoring and avoid protected branding unless qualified IP counsel
clears the exact release.

- **Status:** the quiz engine is built with clearly-labelled placeholder
  questions; final questions + a patent/trademark **freedom-to-operate** opinion
  are needed. Tracked under **B-QUIZ-COPY**.

---

### E. Account deletion versus unresolved store billing — counsel + App Review gate

Apple requires account-creation apps to offer in-app deletion, remove associated
data not legally required, explain how subscription billing/cancellation is
handled, and keep an immediate deletion option even if later deletion is also
offered. See Apple's current developer guidance:
https://developer.apple.com/support/offering-account-deletion-in-your-app.

The client therefore does not require a user to resolve a possible store charge
before deletion intake. After server-verified terminal deletion, it removes the
exact owner correlation and, only when commerce safety still requires it, keeps
one ownerless/actionless/productless device bit with a fresh timestamp and a
30-day review marker. That bit offers Restore, Manage subscription, and configured
Support; Manage/Support and verified-empty Restore do not count as resolution.
The same marker is anchored to the original native-call journal timestamp for an
exact RevenueCat payment-pending record. Because device wall time is not trusted,
neither marker automatically deletes data or reopens checkout; persisted active
provider proof is currently required.

- **Status:** implemented and unit/contract tested, but **not legally approved**.
  Privacy/consumer counsel must approve the disclosure and retention basis for
  launch jurisdictions. App Review/TestFlight must validate deletion copy and
  subscription management. Physical-device Ask-to-Buy approval/decline, one
  subscription group, and live RevenueCat restore/transfer/alias behavior remain
  release gates. Resolution-bound retention and any future trusted-time/provider
  release policy require explicit counsel and native/provider review; the review
  marker is not a legal safe harbor or guarantee of Apple acceptance.
- **Open deletion-recovery gate:** a malformed or unavailable local store journal
  currently blocks deletion intake and terminal local finalization rather than
  overwriting possibly relevant commerce state. Apple/counsel must approve a
  tested recovery path that does not make in-app account deletion unavailable;
  the current fail-closed behavior is not launch-ready evidence.

## 3. What "approvals" actually means here

| Gate                                          | Is it a government permit?           | What's required                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FDA clearance / medical-device registration   | **Unresolved for the exact release** | Function-specific intended-use/device opinion; counsel determines regulator action, and App Store declaration must be truthful                                                                        |
| Standing **not-medical-advice disclaimer**    | No                                   | Counsel-drafted; shown in onboarding, Settings, and on conflict/safety screens                                                                                                                        |
| **Apple App Store review**                    | Vendor gate (standard)               | Guidelines 4.8 (SIWA), 5.1.1(v) (account deletion), and 3.1.2 subscription value, truthful offer/price/eligibility terms, restoration, and functional management; exact-build review remains required |
| **Google Play review**                        | Vendor gate (standard)               | Data-safety form, account/data deletion route                                                                                                                                                         |
| **Dermatologist + cosmetic-chemist sign-off** | No — professional review             | Mandatory before launch (B-DERM-REVIEW)                                                                                                                                                               |
| **Privacy/health-data legal review**          | No — professional review             | Mandatory before launch (B-PRIVACY-COPY)                                                                                                                                                              |
| **Patent/trademark opinion** (quiz)           | No — professional review             | Before shipping the real quiz (B-QUIZ-COPY)                                                                                                                                                           |

No document in this repository can conclude that government action is
unnecessary for the final build. The current source posture keeps
medical/clinical content and functions fail-closed while qualified counsel,
independent professionals, Apple, and any applicable regulator resolve their
separate gates.

---

## 4. Cost estimates — order-of-magnitude, NOT quotes

Costs vary enormously by jurisdiction, scope, and whether you use a lean
startup-focused service vs. a full-service firm. **Get 2–3 real quotes.**

| Item                                                                                                         | Rough estimate                                          | Notes                                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Apple Developer Program                                                                                      | **$99 / year**                                          | Certain                                                                                                             |
| Google Play Developer                                                                                        | **$25 one-time**                                        | Certain                                                                                                             |
| Privacy/health-data lawyer (Consumer Health Data Privacy Policy + ToS + MHMDA/GDPR/CCPA consent text + DPIA) | **~$3k–$15k+** one-time                                 | Specialised privacy service cheaper; full-service firm more                                                         |
| Dermatologist + cosmetic-chemist sign-off of the rule set                                                    | **~$2k–$10k+**                                          | Independent professional review; never imply endorsement or marketing approval beyond the exact authenticated scope |
| Patent/trademark freedom-to-operate opinion (Baumann)                                                        | **~$2k–$5k**                                            |                                                                                                                     |
| Trademark registration for "OnSkin" (optional, advisable)                                                    | **~$250–350 USPTO filing per class + ~$1k–2k attorney** |                                                                                                                     |
| **Realistic lean total to be launch-ready**                                                                  | **~$8k–$30k+** in professional fees                     | Heavily dependent on providers; treat as a budget line, not a quote                                                 |

---

## 5. Recommended order of operations

1. **First and cheapest-leverage:** a 1-hour consult with a lawyer who knows
   **consumer health-data privacy (MHMDA/GDPR)** — this is where the design choices
   and the real exposure intersect most, and it's the exposure with teeth.
2. Engage the **dermatologist + cosmetic chemist** to review the conflict matrix
   (B-DERM-REVIEW). They can also drive the expansion from ~14 to ~40 rules.
3. Patent/trademark **freedom-to-operate** opinion on the quiz (B-QUIZ-COPY);
   author original questions.
4. Have counsel draft the **policies + consent text + disclaimer**; drop the
   `version` + `consent_text_hash` into the consent ledger (already wired).
5. Keep all copy cosmetic (the claim-safety test guard protects this on every edit).
6. Submit to App Store / Play with accurate privacy nutrition labels / data-safety
   forms reflecting the _actual_ (on-device-first) data flows.

> None of these gates closes by filling a string or environment variable.
> Legacy clinical tables are sealed and non-authoritative. Release requires
> exact-hash review evidence, trusted reviewer authority and signature
> verification, final consent/policy bytes, exact production configuration,
> hosted/device evidence, and the active launch contracts. Any source or scope
> change reopens the affected review.

---

_Cross-references: `docs/00-architecture.md` §7 (compliance checklist),
`docs/01-auth-onboarding.md` §4 (privacy/consent), `docs/02-ingredient-intelligence.md`
§9 (legal/liability framing). Open items live in `BLOCKERS.md`
(B-DERM-REVIEW, B-PRIVACY-COPY, B-QUIZ-COPY, B-CATALOG-SEED)._
