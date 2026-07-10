# Document 12: AI Trend Analysis — Build Specification & Strategic Validation

_The honest verdict on the app's last and most-deferred feature · why the population "skin score" / "skin age" is killed outright · why the shipped refusal of AI scores (docs/06) is the asset, not a gap to fill · the only defensible form — on-device, within-person, descriptive, no-number, fairness-validated, off-by-default, and arguably not called "AI" at all — "Changes in your own photos" · the score-vs-trend scientific distinction · the Minimal-Detectable-Change noise floor · the fairness launch gate (Monk scale; the bias that physics will not fully fix) · the claim-safe, calm output copy and the forbidden patterns · why cloud is killed, not deferred-with-a-DPA · the steelman for building it, and its rebuttal · and the recommendation, made plainly: keep the door shut and market the refusal._

> This is build-order item **#12** of the 15 feature documents in docs/00 (§"Build order", item 12: _"AI trend analysis (last)"_). It is the only feature docs/00 marks **"(last)"** and **"intentionally last,"** and the only one that exists in direct tension with positions OnSkin has **already shipped and earns marketing on**. docs/06 (guided photo progress) did not merely _decline_ AI scores — it **shipped an on-screen "No scores, no AI grades" refusal as a trust artifact** (docs/06 §8, D-030) and **earns the literal-true claim "your photos never leave your device and never train AI"** (docs/06 line 177), backed by local-only/client-side-encrypted storage, on-device face detection _for framing only_, and **no faceprint ever stored** (which is what keeps OnSkin clear of BIPA's biometric-identifier trigger). docs/09 made recommendations profile- and evidence-based, _explicitly not_ AI-scan-based, and warned against ever adding an "AI skin analysis recommends…" surface "(that's the deferred, consented, fairness-validated doc #12 path, if ever)." docs/00 §4 left only a _narrow_ door: _"Phase 2 optional cloud trend analysis… gated behind explicit, revocable consent… fairness validation… honest grading, and never a hazard-style score."_ So this document does not ask "how do we build AI analysis?" It asks the prior, harder question the user is owed: **is AI trend analysis a genuine seven-figure, king-making feature; is there any execution that does not betray the trust the app is built on; and does it truly belong at all?** The short, evidence-driven, deliberately uncomfortable answer — validated against the 2026 state of skin-AI accuracy, the skin-tone fairness literature, FDA/FTC regulation, the on-device-vs-cloud reality, and the role model (Yuka, which has _no_ AI face analysis) — is: **a population skin score must be killed outright; the only defensible form is an on-device, within-person, descriptive "changes in your own photos" layer that is a modest retention assist at best, not a king-maker; even that should be deferred behind the proven pillars until an evidence bar the entire vendor field has failed to meet (as of June 2026) is met; and the highest-value move available is to keep refusing AI scores and market the refusal itself.** The rest of the document proves that verdict, then — because the founder may still choose to build the narrow exception — fully specifies the only form that does not end the trust brand.

---

## TL;DR

- **AI trend analysis is not a seven-figure pillar, and the right default is to keep the door shut.** OnSkin's two genuine king-making features are already shipped/specced — the **local-only photo timeline** (docs/06, the retention/switching-cost moat) and the **evidence-based recommendation engine** (docs/09) — with the paywall (docs/08) as the monetization engine. AI trend analysis ranks _below all three_. The role model proves the point: Yuka cleared **$7,174,710 of $7,370,646 (97.3%) from subscriptions in 2024**, tens of millions of users, zero ads, zero brand money — with **zero AI face analysis** (it is a barcode scanner). The seven-figure outcome in this category has historically come from _refusal and retention_, not from a score.

- **A cloud "skin score" / "skin age" must be killed outright — it is a trust destroyer, not a feature.** It would break three shipped promises at once (no-score, photos-never-leave-device, never-train-AI), it rests on accuracy **no consumer cosmetic vendor has ever independently benchmarked** (peer-reviewed; as of June 2026), it inherits a **documented, partly-unfixable skin-tone fairness failure**, and it walks straight into the active FTC "AI-washing" and FDA "Software as a Medical Device" fact patterns. The decision to defer/kill rests on **four HIGH-confidence grounds** — trust-promise reversal, unfixable fairness physics, the regulatory claim-surface, and the absence of any independent validation — none of which depends on the (softer) economics.

- **The only execution that does not betray the trust position is on-device, within-person, descriptive, no-number, fairness-validated, off-by-default — and arguably not called "AI."** Ship it (if at all) as **"Changes in your own photos"**: a calm narration of _change in the user's own standardized series_ (docs/06), computed **entirely on the phone**, surfaced only above a **Minimal-Detectable-Change noise floor**, in **cosmetic, descriptive, non-evaluative, non-diagnostic** language — never a grade, number, "skin age," or "we detected [condition]." This is scientifically a _different object_ from the rejected score (within-person change ≠ a population rank — Curran & Bauer 2011), and it keeps "photos never leave your device / never train AI" literally true.

- **Cloud is killed, not deferred-with-a-DPA — because it buys nothing here.** Per-image inference is a rounding error (Gemini Flash ~$0.0006/image; Claude Sonnet ~$0.0039/image; even 500K users × ~24 captures/yr ≈ $600–$5K/mo), so **cost is not the blocker — trust is the only variable**, and any upload spends it for no capability gain over a selfie's accuracy ceiling. The narrow docs/00 §4 cloud door stays shut; the 2026 on-device substrate (Apple Core ML/Vision, LiteRT/MediaPipe) is capable enough to do the honest version locally.

- **Fairness is a launch gate, not a footnote — and part of it physics will not fix.** On the DDI benchmark, leading dermatology models score **AUROC 0.50–0.57 (coin-flip) on the darkest skin** vs 0.61–0.72 on light; a Dec-2025 meta-analysis still shows **0.82 (darker) vs 0.89 (lighter), p<0.01**; and a Dec-2025 optical-physics study (>15,000 spectra) shows **hemoglobin/erythema signal is progressively masked as melanin rises — no visible-range instrument or algorithm can fully overcome it.** So redness/erythema must _not_ be the trend metric, darker Monk tones must carry equal-or-higher noise thresholds, and **no public accuracy claim may be made until a Monk 7–10-heavy validation cohort shows parity** — a bar the whole field has failed.

- **Honest about the other side: the strongest case _for_ building it is real but contingent, and it loses on the four grounds.** Personalization demand is real, an "analyze your skin" onboarding ritual is a measured conversion lever, and a within-person trend _could_ compound the photo + recommendation pillars into a retention loop. But the conversion/retention economics are soft and AI-apps-general (not skin-score-specific), the lift is largely attributable to a personalization ritual OnSkin already runs _without_ AI, and every version that would actually move revenue (a score, a cloud upload, an "AI" claim) is exactly the version that detonates the trust position. The economics are therefore explicitly **not load-bearing** to this verdict.

- **Seven-figure verdict: no — not as a feature; yes, the validation is for the _refusal_.** Built as the narrow on-device exception, it is a retention/engagement _assist_ on the docs/06 loop, deferred until an independent, peer-reviewed, Monk-stratified consumer-selfie benchmark exists (none does). Built as a score or a cloud service, it is the feature most likely to end the trust brand. The most honest and most valuable recommendation this document can make is: **keep refusing AI scores, and make the refusal a marketing asset.**

---

## Key Findings

1. **It is not a pillar; it ranks below the photo timeline, the recommendation engine, and the paywall.** The retention moat (longitudinal photos) and the personalization moat (evidence-based recs) are already shipped/specced _and already do the valid, non-AI version of what a trend layer would add_. AI trend analysis is, at most, connective tissue in a capture→payoff→recommendation→adherence loop — additive only if it never scores and never uploads. _(Confidence: high.)_

2. **The decisive proof is the role model, and there is no documented seven-figure AI-score precedent.** Yuka reached **$7.17M (97.3%) from subscriptions with zero AI face analysis**. On the other side, **no consumer AI-skin-score app is documented to have reached seven figures on AI analysis specifically** — TroveSkin (a flagship score app) shows ~259K SGD (~$190K) revenue as of 2020; Neutrogena scaled Skin360 to 1M+ analyzed faces and then **wound the mobile app down**, with a dermatologist on record calling such tools "primarily a sales tool." _(Confidence: high on Yuka; medium on the negative — it is "no documented case found," an absence-of-evidence inference, not a proof.)_

3. **A population "skin score" from an uncontrolled selfie is false precision, and no vendor has independently validated one.** Diagnostic dermatology AI degrades ~9 AUROC points moving from specialist cameras to smartphones (0.90→0.81; Medicina Kaunas meta-analysis, Dec 2025), and **no consumer cosmetic vendor (Haut.AI, Perfect Corp, Revieve) has published a single independent peer-reviewed accuracy benchmark** for its score. Perfect Corp's cited ICC>0.90 is _test-retest reliability_ (deterministic reproducibility on a fixed image), **not validity**; La Roche-Posay's published 68% overall GEA agreement was on a _controlled 3-view protocol_, not a phone selfie. _(Confidence: high on the meta-analysis and the reliability-vs-validity distinction; medium on the "no benchmark" absence-of-evidence.)_

4. **Within-person change and a population score are statistically distinct constructs that can point in opposite directions.** Surfacing _change in the user's own standardized series_ is the only scientifically defensible thing AI can add here (Curran & Bauer 2011, on the within/between-person distinction) — and it is mostly _already captured by the shipped before/after slider_ (docs/06 §4). The trend layer is therefore an enhancement of an existing valid feature, not a new king-maker. _(Confidence: high on the construct distinction; medium on the "already captured" point being a judgment.)_

5. **The skin-tone fairness gap is large, persistent into 2026, and partly unfixable by physics.** DDI-benchmark AUROC **0.50–0.57 on the darkest skin** vs 0.61–0.72 on light (Daneshjou et al., _Science Advances_, 2022); a 2025 meta-analysis still shows **0.82 vs 0.89 (p<0.01)**; GPT-4o melanoma sensitivity collapses from **100% (lightest) to 29–43% (darker)** (Cureus, 2025, small sample — wide CIs); and an optical-physics study (>15,000 spectra, Dec 2025) shows **erythema signal is masked as melanin rises**, so a phone-RGB redness trend is silently less reliable on darker skin. Fairness must be a launch gate, and redness must not be the metric. _(Confidence: high.)_

6. **Disease/severity language and accuracy claims are the regulatory trip-wires.** "We detected acne/redness/rosacea/melasma" is disease language that triggers FDA **Software as a Medical Device** classification (acne severity on the IGA scale is the FDA acne-drug endpoint — uniquely dangerous), and "AI X% accurate"/"dermatologist-grade"/"more objective than your eyes" is squarely the FTC **Operation AI Comply / Workado** fact pattern (Workado was ordered to drop a "98% accurate" claim that was actually ~53%; final order Aug 28, 2025). FDA's revised general-wellness guidance (Jan 6, 2026) _loosened_ oversight of low-risk wellness software but protects **only** strictly appearance/wellness framing — it does nothing for a score, a severity grade, or an accuracy claim. _(Confidence: high.)_

7. **The "AI" label is a measured trust tax in 2026, worst for health categories.** Across six experiments, the term "AI" _lowered_ emotional trust and purchase intent, with the largest penalty in high-risk/health contexts (Cicek, Gursoy & Lu, _J. Hospitality Marketing & Mgmt_, 2024); only ~5% of US adults say they "trust AI a lot" (YouGov, Dec 2025). For a trust-first brand, **"no creepy AI / your own eyes / on-device" is plausibly a stronger position than any AI feature** — so the honest framing is "your progress over time," not "AI analysis." _(Confidence: high that the label is a penalty; the skincare-specific applicability is a reasoned inference.)_

8. **Cloud is unnecessary and the on-device substrate is capable, so the privacy promise can survive — if the feature stays local.** Per-image cloud cost is trivial (proving cost is not the blocker), while the 2026 on-device stack (Apple Core ML/Vision; LiteRT/MediaPipe; FastVLM-0.5B running real-time on an iPhone 16 Pro) can run the honest within-person engine locally. **A general multimodal LLM (Claude/GPT/Gemini) must not be the engine** — they are not validated dermatology tools and routing through one re-imports cloud + fairness + claim risk at once. _(Confidence: high on capability; medium that a validated, accurate on-device skin-trend model exists — "runs on phone" ≠ "works on phone," and none is published.)_

9. **On-device is necessary but not sufficient for privacy: the derived insight is itself health data.** Even with no upload, an on-device trend insight is a **health inference** persisted on the device (and potentially synced via iCloud/Google backup or device transfer), so MHMDA / GDPR Art. 9 status attaches to the _inference_, not just the image — requiring a separate, explicit, default-off consent, exclusion from cloud backup, and deletion-on-revocation. _(Confidence: high.)_

10. **The economics are too soft to be load-bearing in either direction — so they are explicitly demoted.** The conversion/retention deltas for AI apps (e.g., higher up-front conversion but ~30% faster churn) are _AI-apps-general, not skin-score-specific_, low-confidence, and largely attributable to a personalization ritual OnSkin already owns. The verdict rests on the four high-confidence grounds (trust reversal, fairness physics, regulatory claim-surface, absence of validation), **not** on a revenue model — which is the honest way to decide a feature whose own category cannot prove it monetizes. _(Confidence: high that the economics are not decisive here.)_

---

## Details

### 1. What it is — and is not (scope; the score-vs-trend line; why this is a thesis reversal, not a feature add)

**It is** the deferred, Phase-2 path docs/00 §4 left open: an optional layer that _reads change over time in the user's own guided photo series_ (docs/06) and narrates it. Concretely, the **only** version this document endorses building is **"Changes in your own photos"** — an on-device, within-person, descriptive, no-number trend narration that is **off by default**, fairness-validated, and consistent with everything OnSkin has shipped.

**It is not**, and these boundaries are the entire feature:

- **not a skin score, "skin age," skin-health grade, or any number** — explicitly killed (§4); docs/06 already ships an on-screen refusal of exactly this (D-030).
- **not a cloud face-upload service** — on-device only; cloud is killed, not deferred (§5). The "photos never leave your device / never train AI" claim (docs/06 line 177) is binary and stays literally true.
- **not a diagnostic or detection tool** — it never says "we detected acne/redness/rosacea/melasma"; disease/severity language is an FDA medical-device trigger (§9).
- **not a general-LLM-vision feature** — Claude/GPT/Gemini vision are not validated dermatology tools and are not the engine (§6).
- **not "AI" in the marketing** — the word is a measured trust penalty (§7, KF7); it is honestly framed as "your progress over time," using on-device computer vision, disclosed as on-device processing (the "don't call it AI" honesty problem is resolved in §9, not dodged).
- **not the recommendation engine** (docs/09, which is explicitly non-scan) and **not a replacement for the user's own eyes** (docs/06's core stance).

**This is a brand-thesis reversal risk, not a routine feature add.** docs/06 turned "no AI scores" and "photos never leave your device" into _shipped, marketed trust artifacts_. Adding any AI that scores, grades, or uploads is not adding a feature — it is **walking back a promise the whole app is sold on**, and the cost of that is the spine of §2 and §8.

### 2. The honest verdict — does it belong? (the four HIGH-confidence grounds)

The verdict is **defer/kill by default, with one narrow on-device exception** — and it rests **entirely on four high-confidence grounds**, deliberately _not_ on the economics (which are too soft to decide anything, §10/KF10):

1. **Trust-promise reversal.** "Never leaves your device" and "never train AI" are _binary_ claims; they cannot be half-kept. Any cloud step makes them false-or-hedged — _and leaving the existing marketing line up while uploading is itself an independent FTC §5 deception_. Privacy-positioned brands lose trust disproportionately and durably when they reverse a stated promise (the cautionary cases — Cambridge Analytica, Equifax, 23andMe — carry this far better than the "trust is easier to lose than rebuild" consultancy slogans, which should not be leaned on). _(High.)_
2. **Unfixable fairness physics.** Erythema signal is masked as melanin rises; no visible-range algorithm fully overcomes it (§5/KF5). A consumer skin AI cannot be made equally valid across tones on a white-light selfie. _(High.)_
3. **The regulatory claim-surface.** Disease/severity language → FDA SaMD; accuracy/objectivity claims → FTC AI-washing (§6/KF6). The copy _is_ the regulated surface. _(High.)_
4. **Absence of any independent validation.** As of June 2026, the entire consumer cosmetic vendor field has published _no_ independent, peer-reviewed accuracy benchmark for its score (§3/KF3). Building on vendor numbers is building on marketing. _(High on the principle; the specific "none exists" is absence-of-evidence — strong but not provable.)_

**The category ranking (so the document does not over-promise):**

| Form of the feature                                                   | Honest category                            | Why                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Cloud population "skin score" / "skin age" / hazard number            | **Trust destroyer / cost-and-risk center** | Breaks three shipped promises; no independent validation; documented fairness failure; FTC/FDA exposure            |
| On-device, within-person, **descriptive** trend (no number)           | **Retention/engagement assist (modest)**   | Scientifically defensible; preserves the promises — but mostly already captured by the shipped before/after slider |
| Anything marketed as "AI [X]" / "X% accurate" / "dermatologist-grade" | **Upsell garnish + regulatory liability**  | The "AI" label is a measured trust penalty; accuracy claims are the active FTC fact pattern                        |

**Does it truly belong?** _Largely no, and certainly not as a score._ The one form that belongs — conditionally — is the on-device, within-person, descriptive, no-number, fairness-validated, off-by-default layer of §5, **deferred** behind the proven pillars until the validation bar (§7, §12) is met. The honest default, and the higher-value move on the evidence, is to **keep refusing AI scores and market the refusal** (§3 of the steelman rebuttal, and Recommendations).

### 3. The steelman — the strongest case _for_ building it, and the rebuttal

A document that only argues its own side is not objective. Here is the strongest evidence-based case _for_ AI trend analysis as king-making, each argument paired with the precondition it needs and the ground on which it fails.

**The case for (steelmanned):**

- **(a) Demand is real and growing.** The AI-skin-analysis market is sized at ~$2.1B (2026) → $6.3B (2033), ~16.8% CAGR (vendor research, order-of-magnitude only), and every major brand ships a version. _Tailwind, not guarantee — "scan my face" demand is not the same as demand from OnSkin's trust-first buyer._
- **(b) The onboarding hook is a measured conversion lever.** AI apps convert free-to-paid ~52% higher and carry ~39% higher RLTV (RevenueCat-class 2026 data), and an "analyze your skin" ritual is the highest-commitment version of the pre-paywall personalization ritual — against docs/08's ~17–25K subs ≈ $1M ARR math, a conversion lift maps onto seven figures.
- **(c) Within-person trend is the strongest retention argument and points at assets OnSkin owns.** Longitudinal "your own data" trends are the proven retention pattern in adjacent categories (Apple Health Trends, Oura, Whoop, CGM time-in-range), and OnSkin already owns the hard part (the standardized timeline).
- **(d) There is a genuinely privacy-preserving execution.** The 2026 on-device substrate is real, so a descriptive within-person trend can ship while keeping "photos never leave your device" literally true.
- **(e) Trend-not-score is _consistent with_ the refusal, not a reversal.** docs/06 refused _scores_; a within-person, descriptive, on-device change narrative is a categorically different object.
- **(f) The compounding loop is where the seven-figure logic lives.** Capture → trend payoff → recommendation → adherence → more capture: the trend layer is the connective tissue closing the loop between the docs/06 and docs/09 pillars.

**The rebuttal (on the four HIGH-confidence grounds — this is why the steelman loses _as a revenue case_):**

- The economics in (a)/(b) are **AI-apps-general, not skin-score-specific**, low-confidence, and the conversion lift is **largely attributable to the personalization ritual OnSkin already runs without AI** (docs/01/08); the same data shows AI apps **churn ~30% faster** — a novelty, not a moat. So the revenue case is _unmeasured for this feature_ and is **not load-bearing** (KF10).
- (c) and (f) are real but describe a **retention assist on an existing loop**, not a king-maker — and the valid within-person comparison _already ships_ as the before/after slider (docs/06 §4).
- (d) and (e) are exactly right — and they are precisely why the document's _one endorsed form_ is on-device, within-person, descriptive, no-number. **But every argument here holds only in that narrow form; the day any precondition slips — a cloud upload, a single number, a severity claim, an unvalidated tone — it collapses back into the score docs/06 was right to refuse, and the four grounds defeat it.**

**The disanalogy the steelman must concede:** Yuka's refusal worked partly because **Yuka never had a photo product at all** — it scans barcodes. OnSkin _already collects and stores face photos locally_, so "just refuse like Yuka" is not a clean analogy. This is the strongest point _against_ the "market the refusal" recommendation, and it is why the endorsed form is "build the narrow, honest version _if_ the bars are cleared," not "never touch it." The refusal-as-feature is a **strategic bet consistent with the trust thesis**, not an evidence-proven optimum — stated as such (Caveats).

### 4. Why a population "skin score" is killed outright

The score is the version the market sells and the version OnSkin must never ship:

- **No independent validation exists.** No consumer cosmetic vendor has published a peer-reviewed accuracy benchmark for its score (§3). Reliability ≠ validity: a model can return the same number every time (high ICC) and still be measuring lighting, not skin.
- **A selfie score is lighting-confounded false precision.** Smartphone capture costs ~9 AUROC points vs specialist cameras (0.90→0.81); an uncontrolled selfie compounds this. A number dressed as objectivity is the opposite of evidence-honest.
- **It is the wrong construct.** A population rank cannot validly substitute for personal change (Curran & Bauer 2011); the thing users actually care about — _am I making progress?_ — is a within-person question a between-person score cannot answer.
- **It re-imports the anxiety docs/06 deliberately rejected.** A number to go up or down turns a calm record into a judgment (docs/06 §8, "load-bearing"). The skin-concern population already carries elevated appearance-anxiety load (docs/11 §5 evidence).
- **It is the regulatory trip-wire.** A "skin health" score edges toward a medical claim; an acne-severity grade _is_ the FDA acne-drug endpoint; an accuracy claim is the FTC AI-washing fact pattern (§6).
- **It is least fair where it matters most.** The score is least valid on darker skin (§5), so a "skin score" would systematically mislead the users OnSkin can least afford to mislead.

**Verdict: the population score is killed at the architecture and copy level (D-046, D-048), exactly as docs/06's on-screen refusal already states.**

### 5. The only defensible form — "Changes in your own photos"

If the founder chooses to build anything under "AI trend analysis," it ships as **"Changes in your own photos"** (or "Your progress, read for you") — an on-device assist layered onto the _already-shipped_ docs/06 standardized timeline. Every property below is load-bearing:

- **On-device only; cloud is killed, not deferred.** Cloud buys nothing (per-image cost is a rounding error, §8), and any upload makes the binary promise false. The 2026 on-device substrate (Apple Core ML/Vision; LiteRT/MediaPipe) can run the engine locally. The narrow docs/00 §4 cloud door stays shut.
- **Within-person change, never a population score** (§4). It narrates _how the user's own series has changed_, not how they rank.
- **Descriptive, not evaluative or diagnostic.** Cosmetic verbs only ("the appearance of…"), observation not grade, uncertainty always surfaced.
- **A hard noise floor (MDC), with "no change" as a celebrated output.** It surfaces a trend _only_ above a Minimal-Detectable-Change / Reliable-Change threshold derived from the user's own measurement error (MDC95); otherwise it honestly says the lighting varied too much, or that the skin has looked consistent — **and "consistent / no detectable change" is framed as adherence success, a first-class output, never failure** (this is what prevents recreating the up/down-number anxiety).
- **Off by default, separately consented** (§8).
- **Fairness-gated** (§7).
- **Not marketed as "AI"** (§7/§9) — honestly framed as on-device progress reading.

This is, deliberately, a _small_ feature — an enhancement that gives the docs/06 timeline a gentle payoff and closes the loop toward docs/09. It is a retention assist, not a pillar, and the document says so plainly.

### 6. How it works — the engine, the noise floor, and the exact output copy

**Engine: classical computer vision first; a tiny on-device model only if it clears the bar.** Compute change on the user's own _registered_ series via image registration + **SSIM/structural delta** + **color/intensity delta** — zero training data, zero upload, descriptive output. docs/06's guided capture (ghost overlay, alignment, head-pose QA, lighting check) already pre-solves most of the registration problem. A small on-device model (Core ML / LiteRT) may _later_ sharpen change detection (Phase 2) — still local, still no score. **A general multimodal LLM is never the engine** (not a validated derm tool; image-only accuracy is poor and degrades sharply on darker skin). _Caveat (per the completeness review): the classical-CV approach is sound but extrapolated from radiology/registration literature, not yet validated on consumer skin selfies — so building it requires a paired internal validation spike (B-AI-ONDEVICE), not an assumption that "SSIM on selfies works."_

**The Minimal-Detectable-Change floor (mandatory).** The dominant failure mode is reporting noise as change: consumer selfies carry far more lighting/angle variance than clinical rigs (facial appearance shifts materially at 60° vs 0°). The feature must compute a per-user, **tone-adjusted** MDC95 from measurement error and surface a trend _only_ when within-person change exceeds it. Below the floor, it says so honestly.

**The exact output copy — descriptive, calm, claim-safe, always paired with uncertainty:**

- ✅ _"Based on your guided photos, your skin's texture has looked consistent over your last 6 captures."_
- ✅ _"The look of evenness on your left cheek seems steadier since week 1 — your own eyes are the best judge."_
- ✅ _"No clear change to point to yet — skin changes are usually gradual (8–12 weeks)."_
- ✅ _"Lighting varied too much between these to compare — try capturing in similar light."_
- ❌ **Forbidden (enforced by extending the shipped `claimsafety.test.ts` guard to trend strings, D-048):** any number/grade/percentage; "skin score," "skin age," "skin health"; letter/star ratings; "improved/worse" as a verdict; **"we detected acne/redness/rosacea/melasma/hyperpigmentation"** (disease language → FDA SaMD trigger; acne severity on the IGA scale is uniquely dangerous as the FDA acne-drug endpoint); "dermatologist-grade," "objective," "more accurate than your eyes" (FTC superiority-claim doctrine); any structure/function claim ("reduces inflammation," "heals barrier").

**The hard UX problem the document must name (per the completeness review): the screenshot-and-self-score vector survives a no-number UI.** Even with no number on screen, a determined user can screenshot two captures and self-grade, re-importing the comparison/dysmorphia harm docs/06 and docs/11 §5 warn about. Mitigations: never offer a side-by-side "rate this" affordance; keep the narration descriptive and singular ("consistent," not "85% even"); front-load the docs/06 calm framing ("your own eyes, not a number"); and keep the feature opt-in so only users who want the read get it. This vector cannot be fully eliminated — stated honestly.

### 7. Fairness — the launch gate (not a footnote)

This is where a consumer skin AI most often fails, and where OnSkin's evidence-honesty is most tested.

- **Use the Monk Skin Tone scale (10 tones), never Fitzpatrick.** Fitzpatrick measures UV-burn propensity, not pigment, and classifies poorly (~0.5–20% vs Monk ~89–92% in evaluations). Per docs/00/01, adopt Monk — and **never train on Google's MST-E dataset** (Google forbids training use).
- **The bias is large, persistent into 2026, and partly unfixable by physics.** DDI-benchmark AUROC **0.50–0.57 (darkest) vs 0.61–0.72 (light)** (Daneshjou et al., _Science Advances_, 2022); 2025 meta-analysis **0.82 vs 0.89, p<0.01**; GPT-4o melanoma sensitivity **100% → 29–43%** across tone (Cureus, 2025; small sample, wide CIs — cite with that caveat); and the Dec-2025 optical-physics study (>15,000 spectra) shows erythema signal is masked as melanin rises — _no visible-range instrument can fully overcome it._
- **Three mandatory rules follow:** (1) **do not surface erythema/redness as the trend metric** (least fair on a white-light selfie — docs/06 §2 already concedes this); favor texture/evenness change. (2) **Set equal-or-higher MDC noise thresholds for darker Monk tones**, so darker-skinned users are never handed a falsely confident trend. (3) **Borrowing FDA's pulse-oximeter precedent (≥25% dark-skin cohort, ≥30% of data points), make no public/marketing accuracy or "works for everyone" claim until a Monk 7–10-heavy validation set demonstrates parity within a pre-declared band** (B-AI-FAIRNESS, a launch gate mirroring B-DERM-REVIEW).
- **The genuine, possibly-irreconcilable tension:** you _cannot self-validate fairness on truly local-only photos you never collect._ Validation must run on a **separately recruited, consented internal test cohort** — and if that bar cannot be met, the feature stays descriptive-only with **no accuracy claim**, or does not ship.
- **Fairness has an owner, a cadence, and a drift plan (per the completeness review).** Because local-only makes post-launch monitoring nearly impossible, any model update must re-clear the validation cohort _before_ release (an FDA PCCP-style "predetermined change control" discipline applied to a non-device model), with a named owner and a fixed re-validation cadence; a model update may not silently degrade on dark skin.

### 8. Privacy, consent & the trust-promise (on-device is necessary but not sufficient)

- **The promise is binary.** "Photos never leave your device / never train AI" (docs/06 line 177) cannot be half-kept; cloud is killed (§5). On-device is the only way the promise survives.
- **Cloud buys nothing, so cost cannot justify it.** Per-image inference is ~$0.0006 (Gemini Flash) to ~$0.0039 (Claude Sonnet); even 500K users × ~24 captures/yr is ~$600–$5K/mo (volume figure directional). The only variable cloud changes is _trust_, downward.
- **On-device ≠ privacy-complete: the inference is itself health data.** Even with no upload, a trend insight is a **health inference** (MHMDA / GDPR Art. 9), persisted on-device and potentially exposed via iCloud/Google backup or device transfer. Therefore: a **new, separate, explicit, revocable, default-OFF `photo_trend_insights` consent** (distinct from the existing `photo_capture` Art. 9 consent), a plain-language disclosure (_"runs entirely on your phone; no photo or result is ever uploaded; nothing trains any AI"_), **exclusion of derived trend state from any cloud backup**, gating behind the existing biometric app-lock, and **deletion of the derived series state on revocation**.
- **Never default-on.** Default-on AI-on-faces is the exact branded-backlash failure mode (Snapchat "My Selfie," Meta camera-roll); ~82% of consumers call AI data loss-of-control a serious personal threat (Relyance 2025, vendor survey — directional). Off-by-default + on-device keeps `local_only` true.
- **Installed-base reconsent (per the completeness review).** Users who onboarded under docs/06's explicit "No scores, no AI grades" refusal must be **re-consented, not silently enrolled** — they see the new feature as an opt-in with the full disclosure, and the existing refusal screen is preserved for anyone who declines. Silently enabling vision-derived insight for that cohort would _be_ the betrayal this document warns against, even on-device.
- **No faceprint, no server trove.** On-device CV is for change-narration only; **no faceprint/template is computed or stored** (the coarse `head_*` pose fields remain QA, not identification — the basis for clearing BIPA's trigger; cf. _Castelaz v. Estée Lauder_ dismissal where scans could not identify — noted as _one non-binding district ruling in an unsettled area_, not settled cover). No new server-side image surface means no new breach/sale target — the 23andMe lesson (≈98% of value lost; 15M+ users' sensitive data offered for sale in bankruptcy) and the live beauty-BIPA docket (Charlotte Tilbury $2.925M; M.A.C.'s motion to dismiss denied/proceeding as of June 2026; at least 100 BIPA suits filed in 2025; Clearview ~$51M equity settlement). _You cannot leak what you never collect._

### 9. Regulation & claim-safety (and the "don't call it AI" honesty problem, resolved)

- **FDA Software as a Medical Device.** Intended use drives classification; **appearance/wellness framing stays out of device territory**, but disease/severity/detection language (acne IGA, "detect rosacea/melasma") pulls it in. FDA's revised General Wellness guidance (Jan 6, 2026) _loosened_ oversight of low-risk wellness software — but protects **only** strictly appearance/wellness framing and does nothing for a score, severity grade, or accuracy claim.
- **EU MDR + EU AI Act.** A no-medical-claim cosmetic/appearance feature sits outside MDR and the AI Act's high-risk regime — **but the document must not assume the non-device path is regulation-free**: the EU AI Act's transparency obligations (Art. 50) and its biometric-categorization analysis may attach to a face-inference feature _even without a medical claim_ (the "ancillary cosmetic" carve-out is asserted for AR try-on, not analyzed for trend-insight). Counsel must confirm (B-AI-LEGAL).
- **FTC AI-washing & superiority claims.** "AI X% accurate," "dermatologist-grade," "more objective than your eyes" are the active FTC fact pattern (Operation AI Comply; Workado ordered to drop "98% accurate" when reality was ~53%; final order Aug 28, 2025). The copy is the regulated surface and must clear FDA/FTC-aware counsel.
- **The "don't call it AI" honesty problem — resolved, not dodged (per the completeness review).** Recommending "ship on-device vision but don't market it as AI" risks a _different_ deception (undisclosed ML). The resolution is to **pick the honest branch**: the endorsed engine is **classical computer vision** (registration + SSIM/color delta — not a learned model), which is accurately described as "your phone comparing your own photos," _not_ AI, with no omission. **If** Phase 2 ever introduces a learned on-device model, it must be **disclosed as on-device machine learning** in the consent/disclosure copy (eating the small trust-tax honestly) — OnSkin does not get to use ML and hide it. Evidence-honesty applies to the brand's description of its own technology, not just to skincare claims.

### 10. Data model (additive, on-device, no faceprint, no server trove)

The trend layer extends docs/01 `photos` (already carrying `series`, `capture_session_id`, coarse `head_roll/yaw/pitch` pose QA, `lighting_score`, `alignment_score`, `local_only DEFAULT true`, `face_region_redacted`) with **on-device-derived, non-identifying scalars only** — never images, never a faceprint.

```sql
-- On-device trend state for the user's own standardized series (LOCAL-FIRST; never an image; no faceprint).
-- Persisted in the same on-device, client-side-encrypted store as the photo bytes (docs/06 §6, D-028);
-- a Supabase mirror, IF ever enabled, carries ONLY these abstract deltas, never an image, and only
-- under the separate photo_trend_insights consent. storage of the SOURCE image stays local_only.
create table public.photo_trend (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  series             text not null,                 -- 'front' | 'left' | 'right' | 'cheek_l' | ... (mirrors photos.series)
  capture_session_id uuid,                          -- groups the compared captures (docs/06)
  delta_metric       numeric,                       -- SSIM/structural + color/intensity delta on the registered pair
  mdc_threshold      numeric,                       -- per-user, TONE-ADJUSTED Minimal-Detectable-Change floor (§7)
  change_state       text not null,                 -- 'consistent' | 'change_observed' | 'inconclusive_lighting' | 'insufficient_data'
  narrative_key      text,                          -- key into the externalised descriptive copy (NO number, NO grade)
  monk_tone_band     int,                           -- the user's Monk band, to apply the fairness-adjusted threshold
  computed_local_date date not null,
  created_at         timestamptz not null default now()
  -- NO score/grade/percentage column EXISTS, by construction (D-046/D-048).
  -- NO image, storage_path, or faceprint/template column EXISTS — the source image stays local (docs/06).
);
create index on public.photo_trend (user_id, series, computed_local_date);
-- Owner-only RLS (docs/01 §3 pattern); writes are local-first (the D-029 pattern), server mirror gated on the
-- separate photo_trend_insights consent. On consent revocation, an Edge Function / local task DELETES the
-- user's photo_trend rows (deletion-on-revocation, §8); derived state is EXCLUDED from cloud backup.

-- Consent ledger extension (docs/01 §3): add a new, separate, default-OFF consent type.
--   consents.consent_type now also accepts 'photo_trend_insights' (distinct from 'photo_capture'/'photo_cloud_backup').
```

**RLS & deletion:** owner-only throughout (`(select auth.uid()) = user_id`, `TO authenticated`, `WITH CHECK`); the `photos.storage_path` stays NULL while `local_only` (docs/06); `photo_trend` is deleted on consent revocation and on account deletion (the existing cascade). **No new server-side image surface = no new breach/sale target.**

### 11. The Maya worked example (used throughout, per the spec)

**Maya** — dry + sensitive; owns Vitamin C serum, Retinol 0.3%, Glycolic 7% toner, Ceramide moisturiser, Mineral SPF 50; she has been capturing weekly guided front photos for 13 weeks (docs/06: "13 weeks · 26 photos · all on this phone").

- **Default (what Maya sees today, unchanged):** the docs/06 Progress tab — the before/after slider, the timeline, the honest tagline "No scores, no AI grades." She judges her own progress with her own eyes. **No AI. No number.**
- **If she opts in to "Changes in your own photos" (Phase 1, on-device):** after a capture, a calm, optional line appears — _"Based on your guided photos, your skin's texture has looked consistent over your last 6 captures — your own eyes are the best judge."_ It is computed entirely on her phone from her own registered series; nothing is uploaded; there is no number, grade, or "skin age." On a week where the light was off: _"Lighting varied too much between these to compare — try capturing in similar light."_ On a genuine change above her MDC floor: _"The look of evenness on your left cheek seems steadier since week 1."_ **"Consistent" is shown as a win** (she's been adherent), not a flat line to feel bad about.
- **What Maya never sees:** a skin score, a "skin age," a letter grade, a percentage, "we detected redness/acne," a "dermatologist-grade" claim, or any prompt that her photos were uploaded or used to train anything. If her Monk tone is in the darker bands, her change threshold is _higher_ (so she is never handed a falsely confident trend), and redness is never the metric.
- **If Maya declines (or never opts in):** she keeps the exact docs/06 experience, including the on-screen refusal of AI scores — preserved, not overridden (installed-base reconsent, §8).

### 12. Phasing, kill criteria & the reopen trigger

**Phasing (one step at a time; cloud is not a phase):**

- **Phase 0 — do this regardless:** keep refusing population scores and **market the refusal as the feature.** On-device alone is no longer white space (brand apps already run on-device); the ownable position is the _combination_ — no score + local-only + never-trains-AI + your-own-photos.
- **Phase 1 — the actual build, if pursued:** on-device classical-CV within-person change narration on the existing standardized series; off-by-default `photo_trend_insights` consent; hard MDC noise floor; descriptive copy only; no accuracy/AI marketing claim; texture/evenness, **not** redness.
- **Phase 2 — only if Phase 1 retains _and_ Monk validation passes:** a small on-device model (Core ML / LiteRT) to sharpen change detection — still local, still no score, **disclosed as on-device ML** (§9), copy through counsel + the extended `claimsafety.test.ts` guard.
- **Cloud is never a phase.**

**Kill / no-ship criteria (any one fails → defer indefinitely or ship descriptive-only with no claim):**

1. Cannot run fully on-device → **kill** (breaks "never leaves your device").
2. Requires any image/feature upload, or any vendor whose DPA does not _contractually and verifiably_ guarantee zero-retention + no-training + ephemeral → **kill** (none of Haut.AI/Perfect Corp/Revieve deliver on-device; all are cloud B2B with no public benchmarks).
3. Cannot clear Monk-tone parity within the pre-declared band on a ≥25–30% dark-skin cohort → **no accuracy claim; descriptive-only or don't ship.**
4. Output drifts into any number, score, "skin age," grade, "health," or disease/detection language → **kill the output, redesign.**
5. Internal testing shows noise reported as change above the MDC floor, or "consistent / no-change" reading as failure to users → **kill until fixed.**
6. Marketing wants to call it "AI [anything]" or claim accuracy/objectivity/"better than your eyes" → **kill the claim** (FTC exposure).

**Reopen triggers (per the completeness review — a deferral needs internal _and_ external triggers, or it is half a decision):**

- **External (the strongest):** an _independent, peer-reviewed, Monk-stratified, consumer-selfie_ accuracy benchmark appears — the bar the entire vendor field has failed as of June 2026.
- **Internal:** measured OnSkin-user demand crosses a pre-set threshold (support requests / churn-exit reason / in-app survey — currently _unmeasured_, and the document says so), **and** an on-device validation spike clears the fairness gate, **and** competitor behavior makes the refusal read as "behind" rather than "principled." Until then, the shipped refusal is worth more than the feature.

### 13. Engineering / implementation notes

- **Engine & device:** classical CV (registration + SSIM/color delta) on the existing guided series; an optional tiny Core ML / LiteRT model in Phase 2; **never a general multimodal LLM**; performance verified on real devices (shares B-CAMERA's custom-dev-build need; B-AI-ONDEVICE) with the MDC floor calibrated per-device/per-user.
- **Reuse, don't reinvent:** the claim-safety regression guard (docs/02/06/07/08) is extended to cover trend strings (D-048); the local-first/encrypted on-device store and the biometric app-lock (docs/06, D-028) carry over unchanged; the consent ledger (docs/01 §3, immutable, D-015) gains `photo_trend_insights`.
- **No new server surface:** `photo_trend` holds only abstract deltas, owner-RLS, excluded from cloud backup, deleted on revocation; the source image stays `local_only`.
- **PostHog instrumentation — metadata only, never image or skin data:** `trend_insights_opted_in`, `trend_shown` (with `change_state`, not any value), `trend_inconclusive_lighting`, `trend_consistency_celebrated`, `trend_consent_revoked`. Instrument for _opt-in/retention_, never toward a score or "improvement."
- **Fairness governance:** a named owner, a re-validation gate before any model update (PCCP-style), and the Monk-stratified cohort maintained as a standing obligation (B-AI-FAIRNESS), not a one-time check.

---

## Seven-Figure Validation (the honest assessment)

The user asked whether this is a genuine seven-figure, king-making feature. The honest answer: **no — not as a feature; the validation here is for the _refusal_.**

- **It is not a pillar.** The seven-figure pillars are the local-only photo timeline (docs/06, the retention moat) and the evidence-based recommendation engine (docs/09), monetized by the paywall (docs/08). AI trend analysis ranks below all three and, in its only defensible form, is a _retention assist_ on the docs/06 loop. _(Confidence: high.)_

- **The role model proves a seven-figure trust app needs no AI face analysis.** Yuka cleared **$7,174,710 (97.3%) of $7,370,646 from subscriptions in 2024** with zero AI face analysis. _(Reconciliation, for evidence-honesty: earlier OnSkin docs cite Yuka at "98.1%"; against Yuka's full published total of $7,370,646 — including books/calendars and services — the subscription share is 97.3%. The dollar figures match; the percentage differs only by denominator, as noted in docs/11.)_ _(Confidence: high.)_

- **There is no documented seven-figure AI-score precedent — and the strongest score apps under-perform or retreat.** TroveSkin shows ~$190K revenue (2020); Neutrogena wound down its Skin360 mobile app after scaling to 1M+ analyzed faces, a tool a dermatologist on record called "primarily a sales tool." _(Confidence: medium — "no documented case found," an absence-of-evidence inference, not a proof; presented as such, not as fact.)_

- **The economics are explicitly NOT load-bearing.** AI apps as a class convert higher up-front but churn faster (~30%), and the lift is **AI-apps-general, not skin-score-specific**, and largely attributable to a personalization ritual OnSkin already runs without AI (docs/01/08). The defer/kill verdict rests on the four high-confidence grounds (trust reversal, fairness physics, regulatory claim-surface, absence of validation), **not** on a revenue model — the honest way to decide a feature whose own category cannot prove it monetizes. _(Confidence: low on the deltas; high that they are not decisive.)_

- **The cost side is risk, not compute.** Compute is trivial (on-device ≈ $0 marginal). The real costs are the **fairness validation cohort** (recruited, consented, ≥25–30% dark skin — materially expensive and in tension with the local-only promise), the **legal review of the copy** (the regulated surface), and — on any cloud path, which is killed — the breach/sale exposure (MHMDA up to $7,500/violation + private right of action; GDPR Art. 9; live beauty-BIPA docket; the 23andMe transferable-asset lesson). On-device-only structurally eliminates the last category.

**Verdict: AI trend analysis is not a seven-figure, king-making feature.** Built as a score or a cloud service it is the feature most likely to _end_ the trust brand; built as the narrow on-device, within-person, descriptive, no-number, fairness-validated, off-by-default exception, it is a modest retention assist on the docs/06 loop, deferred until an independent Monk-stratified consumer-selfie benchmark exists (none does, as of June 2026). The seven-figure logic in this app lives in the _refusal_ — the same trust engine behind Yuka's $7.37M — and the most valuable, most honest recommendation the document can make is to **keep the door shut and market the refusal**, building the narrow exception only if every bar in §7 and §12 is cleared.

---

## Synthesis

**(a) What it is:** the deferred, last build item — endorsed _only_ as "Changes in your own photos," an on-device, within-person, descriptive, no-number trend narration on the docs/06 timeline; the population skin score is killed outright.

**(b) The honest verdict:** defer/kill by default, one narrow on-device exception, resting on four HIGH-confidence grounds — trust-promise reversal, unfixable fairness physics, the regulatory claim-surface, and the absence of any independent validation; the economics are explicitly non-load-bearing.

**(c) Does it belong:** largely no, and certainly not as a score or a cloud service; the one defensible form is a retention assist, deferred behind the pillars; the higher-value move on the evidence is to keep refusing AI scores and market the refusal.

**(d) The steelman, rebutted:** the case for (demand, the conversion ritual, the within-person retention loop, a privacy-preserving on-device path) is real but contingent and not a revenue king-maker; every version that would move revenue (score, cloud, "AI" claim) is the version that detonates the trust position — and the Yuka analogy is imperfect because OnSkin already has a photo product.

**(e) The only execution:** on-device only (cloud killed, buys nothing); within-person change not a population score; classical CV first; a hard MDC noise floor with "consistent / no change" as a celebrated output; cosmetic, descriptive, non-diagnostic copy enforced by the claim-safety guard.

**(f) Fairness:** a launch gate — Monk scale not Fitzpatrick; redness is not the metric (physics); higher noise thresholds for darker tones; no accuracy claim until a ≥25–30% dark-skin cohort shows parity; the can't-self-validate-on-local-only tension named; ongoing governance/drift control.

**(g) Privacy, consent & regulation:** the binary promise survives only on-device; the inference is itself health data (separate default-off consent, no cloud backup, deletion-on-revocation, installed-base reconsent); FDA SaMD / EU MDR+AI Act / FTC AI-washing trip-wires; the "don't call it AI" tension resolved by using classical CV honestly (and disclosing any on-device ML).

**(h) Economics & confidence:** not a pillar; no documented AI-score seven-figure precedent; economics demoted to non-load-bearing; the costs are fairness validation + legal + (on the killed cloud path) breach exposure; the verdict is high-confidence on the four grounds.

---

## Recommendations

1. **Keep the door shut by default, and market the refusal.** The shipped "No scores, no AI grades" (docs/06, D-030) and "photos never leave your device / never train AI" are the asset; preserve them and make them a marketing wedge — a strategic bet consistent with Yuka (stated as a bet, not a proven optimum).

2. **Kill the population "skin score" / "skin age" outright** (D-046) — at the architecture and copy level. It is unvalidated, lighting-confounded, the wrong construct, anxiety-inducing, least fair on darker skin, and a regulatory trip-wire.

3. **If anything ships, ship only "Changes in your own photos": on-device, within-person, descriptive, no-number, off-by-default** (D-047/D-048). Cloud is killed, not deferred-with-a-DPA — it buys nothing but a trust cost.

4. **Treat fairness as a launch gate** (D-049, B-AI-FAIRNESS): Monk scale; redness is not the metric; higher noise thresholds for darker tones; no public accuracy claim until a ≥25–30% dark-skin cohort shows parity; name a fairness owner and a re-validation cadence.

5. **Enforce a hard Minimal-Detectable-Change noise floor, and make "consistent / no change" a celebrated, first-class output** — never a number, never a verdict; surface "lighting varied too much to compare" honestly.

6. **Add a separate, explicit, default-OFF `photo_trend_insights` consent** (D-050), exclude derived state from cloud backup, delete it on revocation, gate behind the biometric app-lock, and **re-consent the installed base** rather than silently enrolling users who onboarded under the refusal.

7. **Hold the claim-safe line and resolve the "AI" framing honestly** (B-AI-LEGAL): cosmetic/appearance language only; no disease/severity/detection; no accuracy/objectivity/"better than your eyes"; use classical CV (honestly "your phone comparing your own photos") and disclose any on-device ML — never undisclosed ML.

8. **Do not use a general multimodal LLM as the engine**; use classical CV first, a tiny on-device Core ML/LiteRT model only in Phase 2 if it clears the bars — and pair the build with an internal validation spike (B-AI-ONDEVICE), since the CV approach is sound but not yet skin-validated.

9. **Decide on the four HIGH-confidence grounds, not the economics** — and state plainly that OnSkin-user demand is currently _unmeasured_; instrument demand (survey / churn-exit / support signal) before reopening the question.

10. **Set explicit reopen triggers** (§12): the external benchmark trigger (an independent, peer-reviewed, Monk-stratified consumer-selfie benchmark) plus internal demand/validation/competitive triggers — so "defer" is a real decision with a way back, not a permanent shrug.

---

## Caveats (confidence flags)

- **The defer/kill verdict and the kill of the population score rest on four HIGH-confidence grounds** (trust reversal, fairness physics, regulatory claim-surface, absence of validation) and do not depend on the economics. _High confidence — this is the spine._
- **The within-person trend is the only defensible AI form, but its _added_ value over the shipped before/after slider (docs/06) is modest.** _High on the scientific basis; medium-low that it adds much beyond what already ships._
- **"Market the refusal" is a strategic judgment, not a measurement** — and the cleanest analogy (Yuka) is imperfect because Yuka has no photo product while OnSkin already stores face photos locally. _Medium confidence that refusal is strategically optimal; high that it is consistent with the trust thesis._
- **The economics are soft and non-load-bearing.** The AI-app conversion/churn deltas are AI-apps-general (not skin-score-specific), low-confidence, and largely attributable to a personalization ritual OnSkin already owns; re-verify against RevenueCat's State of Subscription Apps 2026 before quoting. _Low confidence on the figures; high that they should not decide this._
- **"No documented seven-figure AI-score precedent" is absence-of-evidence**, not proof; presented as "none found," down-weighted accordingly. _Medium confidence._
- **The skin-tone fairness gap is real, persistent into 2026, and partly unfixable by physics** (erythema masking by melanin); a phone-RGB redness trend is silently less reliable on darker skin, which is why redness is not the metric. _High confidence._
- **You cannot self-validate fairness on truly local-only photos you never collect** — validation needs a separately recruited, consented cohort; if that bar can't be met, the feature stays descriptive-only or doesn't ship. _High confidence that the tension is real._
- **The classical-CV engine is sound but extrapolated from registration/radiology literature, not skin-validated** — building it requires a paired internal validation spike (B-AI-ONDEVICE), not an assumption. _Medium confidence._
- **On-device feasibility is high; on-device _validated accuracy_ is unproven** — "runs on phone" ≠ "works on phone"; no vendor has published an independently benchmarked on-device skin-trend model. _High on capability; medium on validated accuracy._
- **The screenshot-and-self-score dysmorphia vector survives even a no-number UI** and cannot be fully eliminated — only mitigated by descriptive framing and opt-in. _High confidence that the vector is real._
- **Regulatory specifics are fast-moving and counsel-gated** (B-AI-LEGAL): FDA SaMD + the Jan 6, 2026 general-wellness guidance (protects only appearance framing); EU MDR + EU AI Act (incl. Art. 50 transparency / biometric categorization for the _non-device_ path, which is asserted-not-analyzed); FTC AI-washing/superiority-claim doctrine. Re-verify at build time. _High confidence that review is required; medium on the non-device EU AI Act applicability._
- **Legal "cover" for the no-faceprint posture is favorable but unsettled** (_Castelaz v. Estée Lauder_ is one non-binding district dismissal); the BIPA landscape is active. Keep storing no faceprint regardless. _Medium confidence._
- **Some supporting figures are vendor surveys or secondary sources** (the 82% loss-of-control stat; market-size CAGRs; the AI-app conversion/churn deltas); treated as directional, not load-bearing. _Low-to-medium confidence on those specific numbers._

---

> **Decision-log notes (DECISIONS.md):** **D-046** — AI trend analysis is **NOT a seven-figure pillar**; the population "skin score" / "skin age" is **killed outright** (no number/grade exists in the schema or copy, by construction); the shipped no-AI-score refusal (docs/06 D-030) is **preserved and treated as the asset**; the feature is **deferred behind the proven pillars** until an independent, peer-reviewed, Monk-stratified consumer-selfie benchmark exists (none does as of 2026-06-13); the verdict rests on **four HIGH-confidence grounds** (trust-promise reversal, unfixable fairness physics, the regulatory claim-surface, the absence of independent validation), and the economics are **explicitly non-load-bearing**. **D-047** — if built, it is **on-device ONLY**; **cloud is not a phase** (preserves "photos never leave your device / never train AI", docs/06 line 177 — a binary promise; cloud buys nothing here since per-image cost is trivial); the engine is **classical computer vision** (image registration + SSIM/color delta on the user's own series) first, a tiny on-device Core ML/LiteRT model only in Phase 2 if it clears the bars; **never a general multimodal LLM as the engine**. **D-048** — output is **within-person CHANGE, never a population score**; a hard **Minimal-Detectable-Change (MDC95) noise floor** is mandatory and **"consistent / no detectable change" is a celebrated first-class output**; copy is **cosmetic, descriptive, non-evaluative, non-diagnostic**, enforced by extending the shipped `claimsafety.test.ts` guard to trend strings; the forbidden list (any number/score/skin-age/grade/"health"/disease-detection/"dermatologist-grade"/superiority claim) is enforced. **D-049** — **fairness is a LAUNCH GATE** (B-AI-FAIRNESS, mirroring B-DERM-REVIEW): Monk Skin Tone scale not Fitzpatrick; never train on Google's MST-E; **erythema/redness is not the trend metric** (physics: signal masked as melanin rises); **equal-or-higher noise thresholds for darker Monk tones**; **no public accuracy/"works for everyone" claim until a ≥25–30% dark-skin, Monk 7–10-heavy validation cohort shows parity within a pre-declared band**; the can't-self-validate-on-local-only tension is acknowledged; a named fairness owner + a PCCP-style re-validation gate before any model update. **D-050** — a **new separate, explicit, revocable, DEFAULT-OFF `photo_trend_insights` consent** (distinct from `photo_capture`/`photo_cloud_backup`) extends the docs/01 §3 ledger; the on-device-derived insight is **still health-inference data** (MHMDA/Art. 9), so it is **excluded from cloud backup**, **deleted on revocation**, and gated behind the biometric app-lock; **installed-base users who onboarded under the "no AI grades" refusal are re-consented, not silently enrolled**; the "not called AI" question is resolved honestly (classical CV described plainly; any on-device ML disclosed — never undisclosed ML). New BLOCKERS: **B-AI-FAIRNESS** (🔴 launch gate — the Monk-stratified validation cohort + parity band + drift governance before any accuracy claim), **B-AI-LEGAL** (🔴 — FDA SaMD / EU MDR + EU AI Act incl. Art. 50 / FTC AI-washing+superiority counsel sign-off of the exact copy, the DPIA extension, and confirmation that the "never train AI / photos never leave your device" claim stays literally true), **B-AI-ONDEVICE** (🟡 — the on-device CV/Core ML/LiteRT engine + the MDC noise-floor calibration + device-performance verification; shares B-CAMERA's custom-dev-build need). The new consent copy + DPIA also extend **B-PRIVACY/B-PRIVACY-COPY**; any clinical framing is gated by **B-DERM-REVIEW**.
