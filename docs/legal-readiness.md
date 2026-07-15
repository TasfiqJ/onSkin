# OnSkin — Legal & Regulatory Readiness Checklist

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

- You are **probably NOT building a regulated medical device**, and you do **not**
  need FDA pre-approval to launch — **provided** the app stays in the _cosmetic /
  general-wellness_ lane, never _diagnoses/treats_ a condition, and carries a
  standing "not medical advice" disclaimer. Under the FD&C Act, what makes
  something a regulated drug/device is the **claims**, not the app itself.
- The app's architecture was **deliberately designed** to stay in that lane:
  cosmetic language, evidence-graded + non-alarmist conflict copy, a separate
  conservative **safety** class that _defers to a clinician_, on-device-first
  photos, and a standing disclaimer.
- The exposures that actually have teeth are **(1) privacy / health-data law**
  (Washington MHMDA — per-violation penalties + private right of action) and
  **(2) false reassurance on a genuine safety item** — both mitigated by design.
- Four professional sign-offs are **mandatory, not optional** before launch (see
  the checklist). None is a government "permit"; they are professional reviews
  that keep you out of trouble (and double as trust/marketing assets).

---

## 1. Are we a "medical device"? (the founder's core worry)

**Short answer: almost certainly not — if we stay disciplined.**

- The FDA regulates _Software as a Medical Device (SaMD)_ when software is intended
  to **diagnose, treat, cure, mitigate, or prevent a disease**, or to **affect the
  structure/function of the body**. General-wellness and low-risk informational
  tools that make **no disease claims** are not actively regulated as devices.
- OnSkin gives **general cosmetic information + routine organisation**, surfaces
  ingredient interactions with **evidence grades** (and says "contested"/"myth"
  when true), and **routes genuine medical questions to a clinician**. That is the
  textbook way to stay _out_ of device territory.
- **The line you must not cross:** the moment copy says "diagnoses your acne,"
  "treats your rosacea," or "clinically proven to…", you risk reclassification.
  This is enforced in code by the **claim-safety regression test**
  (`apps/mobile/src/features/intelligence/claimsafety.test.ts`), which blocks
  drug/disease verbs and alarm words from shipping in rule copy.

> Action: have a regulatory-aware attorney confirm the cosmetic/wellness
> positioning in writing once before launch. This is a confirmation, not a filing.

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

Skin photos + skin-health inferences are sensitive/health data. Applicable:

- **Washington MHMDA** (in force since 2024): standalone **Consumer Health Data
  Privacy Policy** linked on the homepage; **opt-in consent for collection that is
  "separate and distinct" from consent for sharing**; **private right of action**;
  civil penalties up to **$7,500 per violation**; deletion right with few
  exceptions. _(This is the single most likely thing to get a startup sued —
  treat it as priority #1.)_
- **GDPR Art. 9** (EU users): _explicit_ consent for health data; a DPIA is
  advisable for large-scale health-data processing.
- **CCPA/CPRA** (California), **COPPA** (age gate — neutral DOB, gate at 13/16).
- **Illinois BIPA**: avoided by doing **on-device** face detection and storing
  **no faceprint/biometric template** — keep it that way.
- **Status:** consent ledger + unbundled consent screens + on-device-first photos
  are built; the **policy/ToS/consent text + DPIA need a privacy lawyer**. Tracked
  under **B-PRIVACY-COPY**.

### C. The conflict-rules content — clinical sign-off · (docs/02 §9)

This is the "suggestions from research, not a doctor" concern directly. The
mitigation is layered: evidence grades on every rule, non-alarmist
resolution-first copy, a separate maximally-conservative **safety** class that
_defers to a clinician_, the standing disclaimer, **and** professional sign-off.

- **Status:** the ~14 starter rules are authored from the literature in docs/02
  but every row is `reviewed_by = NULL`. **A board-certified dermatologist + a
  cosmetic chemist/pharmacist must review & sign off the entire rule set
  (especially every `safety` rule) before any rule reaches users.** Enforced in
  code by `shippableRules()` (only reviewed rules surface in production). Tracked
  under **B-DERM-REVIEW** (LAUNCH GATE).

### D. The skin-type quiz — patent/copyright · (docs/01 §2)

The validated **Baumann Skin Type Indicator is patented + copyrighted.** You may
implement the _concept_ of a 4-axis assessment but must author **original**
questions + scoring and avoid the protected "16 types" branding.

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

| Gate                                          | Is it a government permit?                        | What's required                                                                                                             |
| --------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| FDA clearance / medical-device registration   | **No** (if cosmetic/wellness + no disease claims) | A confirming legal opinion on positioning                                                                                   |
| Standing **not-medical-advice disclaimer**    | No                                                | Counsel-drafted; shown in onboarding, Settings, and on conflict/safety screens                                              |
| **Apple App Store review**                    | Vendor gate (standard)                            | Guidelines 4.8 (SIWA), 5.1.1(v) (account deletion), 3.1.2 (no trial toggle), health-app scrutiny — all already designed for |
| **Google Play review**                        | Vendor gate (standard)                            | Data-safety form, account/data deletion route                                                                               |
| **Dermatologist + cosmetic-chemist sign-off** | No — professional review                          | Mandatory before launch (B-DERM-REVIEW)                                                                                     |
| **Privacy/health-data legal review**          | No — professional review                          | Mandatory before launch (B-PRIVACY-COPY)                                                                                    |
| **Patent/trademark opinion** (quiz)           | No — professional review                          | Before shipping the real quiz (B-QUIZ-COPY)                                                                                 |

So: **no FDA/government pre-approval to launch a cosmetic-info app** — but the
App/Play store reviews plus the three professional sign-offs above are real and
should be budgeted and scheduled.

---

## 4. Cost estimates — order-of-magnitude, NOT quotes

Costs vary enormously by jurisdiction, scope, and whether you use a lean
startup-focused service vs. a full-service firm. **Get 2–3 real quotes.**

| Item                                                                                                         | Rough estimate                                          | Notes                                                                           |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Apple Developer Program                                                                                      | **$99 / year**                                          | Certain                                                                         |
| Google Play Developer                                                                                        | **$25 one-time**                                        | Certain                                                                         |
| Privacy/health-data lawyer (Consumer Health Data Privacy Policy + ToS + MHMDA/GDPR/CCPA consent text + DPIA) | **~$3k–$15k+** one-time                                 | Specialised privacy service cheaper; full-service firm more                     |
| Dermatologist + cosmetic-chemist sign-off of the rule set                                                    | **~$2k–$10k+**                                          | One-time review; ongoing derm advisory costs more but is also a marketing asset |
| Patent/trademark freedom-to-operate opinion (Baumann)                                                        | **~$2k–$5k**                                            |                                                                                 |
| Trademark registration for "OnSkin" (optional, advisable)                                                    | **~$250–350 USPTO filing per class + ~$1k–2k attorney** |                                                                                 |
| **Realistic lean total to be launch-ready**                                                                  | **~$8k–$30k+** in professional fees                     | Heavily dependent on providers; treat as a budget line, not a quote             |

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

> Everything above is wired into the codebase so that clearing each item is a
> drop-in, not a re-architecture: populate `conflict_rules.reviewed_by`, set the
> consent `version`/`consent_text_hash`, and fill the `.env` keys — the launch
> gates (`shippableRules()`, the consent ledger, env placeholders) flip without
> code changes.

---

_Cross-references: `docs/00-architecture.md` §7 (compliance checklist),
`docs/01-auth-onboarding.md` §4 (privacy/consent), `docs/02-ingredient-intelligence.md`
§9 (legal/liability framing). Open items live in `BLOCKERS.md`
(B-DERM-REVIEW, B-PRIVACY-COPY, B-QUIZ-COPY, B-CATALOG-SEED)._
