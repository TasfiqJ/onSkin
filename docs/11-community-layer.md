# Document 11: The Community Layer — Build Specification & Strategic Validation

*The honest verdict on whether a skincare app whose whole moat is trust should add a social layer at all · community as a retention/trust **multiplier**, never a revenue pillar · the proven private retention mechanics are already shipped (docs/03, docs/07) — so the only net-new question is whether to add a **peer/social** layer · the answer: not an open one · the single defensible execution is a thin, anonymous, expert-seeded, claim-safe, human-pre-moderated "myth vs evidence" Q&A trust layer ("Skin Notes") — Flo's cage, but stricter · no feed, no photos, no follower graph, no DMs, no likes/leaderboards · a hard 16+ gate, a separate unbundled health-data consent, and an explicit, **observable** kill switch · deferred behind the subscription and recommendation pillars.*

> This is build-order item **#11** of the 15 feature documents named in docs/00 (§"Build order", item 11: *"Community layer"*). It is the most contestable feature in the entire build, and this document treats it that way. Every prior slice strengthened a moat; a community layer is the first feature that can *attack* the moat. OnSkin's whole thesis — independent, calm/non-alarmist, claim-safe (cosmetic verbs only, never "treats/cures"), evidence-honest (SORT grade C is the realistic baseline for skincare claims), privacy-first (photos local-only by default, health-adjacent data protected under MHMDA + GDPR Art. 9) — is modelled on **Yuka**, which deliberately has **no community at all** and reached seven figures anyway. So this document does not ask "how do we build a community?" It asks the harder, prior question the user is owed: *is a community even right for OnSkin, is it a genuine seven-figure king-maker, and if anything ships, what is the only form that does not destroy the trust that is the business?* The short, evidence-driven answer — validated against Yuka, Flo, Duolingo, Strava, the dermatology and social-comparison literature, and the graveyard of failed beauty-social apps — is: **a community is *not* a seven-figure pillar and is *not* required for one; it is, at best, an indirect retention multiplier on the subscription pillar, worth six figures (plausibly low-seven over time) only if a measured churn lift actually materialises; an open user-generated forum is actively hostile to the moat; and the only version that belongs is a radically scoped, deferred, expert-anchored trust layer.** The rest of the document specifies exactly that — and is unusually explicit about what to *forbid* and when to *kill it*.

---

## TL;DR

- **Community is a retention/trust *multiplier* on the subscription pillar — not a seven-figure pillar in its own right, and not required for one.** The decisive data point is OnSkin's own role model: Yuka earned **$7,174,710 from subscriptions of $7,370,646 total (97.3%)** in 2024 with **zero community, zero marketing, and zero brand money** (Yuka Independence page, 2024). A seven-figure trust-first scanner demonstrably does not need a social layer, so community carries the burden of proof — and it can only clear that burden as a *multiplier*, never as a pillar. This places it **below** the affiliate six-figure supplement (doc #10) as a revenue contributor, and **below both** as a build priority, because — unlike affiliate — it produces *zero* direct revenue and carries a recurring cost and an acute legal/brand risk that affiliate does not.

- **The proven, safe, on-brand part of "community-as-retention" is *already shipped*.** The calm forgiving streak, weekly adherence, the month heat-map (docs/03 §6, docs/07; D-025/D-046) are the *private, single-player social-comparison mechanics* that the evidence actually supports — Duolingo grew DAU to **~50M (+36% YoY, Q3 2025)** on streaks/leagues *after killing its community forums in March 2022*, not on user-generated content. So Document 11's genuine net-new scope is **not** the retention mechanic (built) — it is the contested question of whether to add a **peer/social layer** on top.

- **An open user-generated (UGC) community is the one feature that can break the moat, and the evidence against it is convergent and quantified.** It imports a documented misinformation firehose (only **~2.5%** of top skincare videos come from board-certified dermatologists; even *expert-led* health communities retain **~21%** misinformation and correct only **~25.7%** of bad threads — Bizzotto et al., JMIR 2023); it recreates appearance-comparison harm that falls hardest on OnSkin's exact users (upward skin comparison correlates **r=0.53** with feeling stigmatised in people with acne); it converts OnSkin from a low-risk advisor into a regulated hosting platform (MHMDA private right of action; FTC Reviews Rule up to **$51,744/violation**; amended COPPA biometric/faceprint rules); and it is a recurring cost centre with a likely-fatal cold-start that has killed every monetised beauty-social precedent (Supergreat raised **$31M**, shut Dec 2023).

- **If anything ships, the single defensible execution is "Skin Notes": anonymous, topic-structured, expert-*seeded*, claim-safe, human *pre*-moderated "myth vs evidence" Q&A — Flo's cage, but stricter.** Flo runs a calm community at **77M MAU / ~5M paid subs** *because* it is anonymous, topic-structured, pre-moderated, and bans medical advice/dosages. OnSkin copies that cage and tightens it: **no open feed, no public before/after photo galleries, no follower graph, no DMs, no likes/leaderboards, no algorithmic engagement feed** — each barred at the *architecture* level, not just the UI, and **photos can never enter the community schema**.

- **It must be gated, consented, and deferred.** A hard **16+** age gate (the amended COPPA biometric rule + the "Sephora kids" regulatory front); a **separate, unbundled `community_participation` consent** (MHMDA/GDPR Art. 9 — never reuse the photo or data-sharing consent); the mandatory Apple Guideline 1.2 / Google Play UGC floor (filter + in-app report + block + published contact + ~24h action SLA); and sequencing **after** the subscription and recommendation pillars and the catalog seed (B-CATALOG-SEED). The build order in docs/00 lists community as item 11; the honest recommendation is to keep the *expert trust layer* here and **defer any peer-posting phase** until retention data and moderation capacity justify it.

- **The kill switch must be honest about its own detectability.** A clean churn A/B holdout to detect an ~11–14% hazard reduction needs many quarters and tens of thousands of exposed paying users — likely *longer* than any "kill within two quarters" rule, so the A/B test alone may be statistically unfireable at OnSkin's scale. The real kill switch is therefore a set of **observable tripwires** (any viral "treats/cures"/DIY-harm thread under the brand; any MHMDA/Art. 9 consent gap; moderation opex exceeding the retained-subscription LTV it buys; a moderation-SLA breach), not solely an experiment.

---

## Key Findings

1. **Community is not king-making for OnSkin, and Yuka settles the "is it required?" question.** OnSkin's explicit archetype reached **$7.17M (97.3% of $7.37M) from subscriptions with no social/community layer at all** (Yuka, 2024). This is the strongest single fact in the evidence base: a seven-figure, trust-first scanner does not require community. Community is therefore a *nice-to-have multiplier* that must justify itself, not a flagship. *(Confidence: high.)*

2. **Community never monetises directly, and the industry can barely prove it monetises at all.** Only **16% of community teams in 2024 (24% in 2025)** could quantify community's financial value (CMX Community Industry Trends Report). The strongest causal study — a *Management Science* RCT (Gu, Bapna, Chan & Gupta, 2021) — found community/crowdsourcing cut app-abandonment hazard **~14%** and session-abandonment **~11%**, but with a **negative interaction when contribution and consumption features were combined** (more community is not linearly better). That RCT is from a *mobile-gaming* context, so transfer to a privacy-first skincare utility is unproven. *(Confidence: high on the mechanism; low-to-medium on the magnitude transferring to OnSkin.)*

3. **The proven, safe retention lever is *private* social-comparison gamification — and OnSkin already shipped it.** Duolingo grew DAU to **~50M (+36% YoY, Q3 2025)** via streaks and leagues *after discontinuing its community forums in March 2022*; Strava's *own* A/B test showed that making friend-following harder cratered follow rate but barely moved retention (the follow→retention link is far weaker causally than the correlation implies). OnSkin's calm forgiving streak + heat-map (docs/03/07) is exactly this mechanic. The net-new decision in Document 11 is purely about a **peer/social** layer. *(Confidence: medium-high; the Duolingo forum-shutdown *rationale* is inferred from the timeline/outcomes, not a sourced quote.)*

4. **An open UGC skincare forum is a documented misinformation firehose that moderation reduces but cannot eliminate — a direct attack on claim-safety.** Only **~2.5%** of top skincare videos come from board-certified dermatologists while **~40%** of people use social media for skin information; a Finnish acne study found **0%** physician creators; sunscreen content scores **2.68/5** on DISCERN. Critically, even *expert-led* health communities still carry **~21%** misinformation (vs 32.4% peer-led), only **25.7%** of misinformation threads ever get a correction, and moderators themselves shared misinformation **24.6%** of the time (Bizzotto et al., JMIR 2023, a mental-health context). One viral "this cured my eczema / beef tallow / DIY sunscreen / retinol-for-tweens" thread under the OnSkin name is brand-fatal. *(Confidence: high; the cross-domain transfer from mental-health to skincare communities is an analogy, stated as such.)*

5. **An appearance/comparison feed contradicts the "calm, non-alarmist" promise, and the harm lands hardest on OnSkin's exact users.** Appearance-based social comparison *causally* worsens body and skin dissatisfaction (Myers & Crowther meta-analysis of 156 studies/189 effect sizes); in an acne population (n=650) the correlation between upward skin comparison and feeling stigmatised was **large, r=0.53**; "skin dysmorphia" is now a validated construct tied to heavy short-video use (n=843: ρ=0.29, co-occurring with anxiety ρ=0.35, depression ρ=0.34). Clinical dermatology guidance now tells practitioners to *avoid* filtered before/after imagery — the single most-engaging community behaviour. This is the strongest evidence against a public photo feed. *(Confidence: high on the harm; the counter-case — that *structured, moderated, anonymous* support can be net-positive — is real but conditional on design.)*

6. **A community converts OnSkin from a low-liability advisor into a regulated hosting platform.** The mandatory store floor is binary: Apple Guideline 1.2 and Google Play's UGC policy require a content filter, in-app reporting, user blocking, and published contact, with Apple expecting action on reports within **~24h** (reaffirmed in Apple's June 2026 guidelines update) — apps are rejected without these. Section 230 still broadly immunises a US platform from users' defamatory product criticism, **but** does not shield against the FTC, COPPA, or state consumer-health-data law, and is eroding via algorithmic-recommendation / addictive-design theories (*Anderson v. TikTok*, 3d Cir. 2024; *Lemmon v. Snap*, 9th Cir. 2021; Mass. SJC *Commonwealth v. Meta*, 2026). The acute exposure is OnSkin's *own* conduct under the FTC Reviews Rule (16 CFR 465, up to **$51,744/violation**) and the new health-data surface under MHMDA (per se Consumer Protection Act violation, private right of action, treble damages up to **$25,000**; first class action filed Feb 10, 2025). *(Confidence: high on the regime; medium on whether a specific skin-condition post triggers MHMDA — treat conservatively.)*

7. **Moderation is a recurring cost centre, and the cheap version (volunteer labour) is unavailable to a claim-safe health app.** Reddit's unpaid moderation is worth **≥$3.4M/yr** (~60,000 volunteers vs ~400 paid admins) — a model OnSkin cannot use for *medical-claim* moderation. Claim-safe moderation needs paid, trained humans running effectively 24/7 to meet the ~24h standard, scaling with volume. (Dollar benchmarks — US content moderator ~$56k/yr, T&S ~$116k/yr, offshore ~$400–1,100/mo — are vendor-sourced and illustrative; the *qualitative* point that this is recurring opex, not a one-time build, is high-confidence.) An **under-resourced** community is *worse than none* for a trust-first brand. *(Confidence: low-to-medium on the dollar figures; high on the structural point.)*

8. **The cold-start "empty room" problem is likely fatal at OnSkin's scale, and the precedents are a graveyard.** Participation is structurally unequal (**90-9-1**: ~90% lurk, ~9% contribute occasionally, ~1% create — NN/g) and a niche skincare app may never reach the active-user density to escape it. Every *monetised* beauty-community attempt has failed or stalled: **Supergreat** (raised **$31M**, the exact "real people, not influencers" ethos OnSkin admires) shut Dec 15, 2023; **MakeupAlley** (2.8M reviews) is closing Sept 2025; **Glossier** abandoned DTC-only for Sephora wholesale after ~30% layoffs in 2022; and the most aligned direct competitor, **Clear** ("Strava for skincare", explicitly "safe, welcoming, non-toxic" — OnSkin's exact positioning) has **~47K downloads** after 4+ years (~$1M raised, ~$15M valuation, 2,000+ brand partners) — investable, but it has not reached escape velocity as a standalone social product. *(Confidence: high.)*

9. **The genuine white space is "trustworthy, claim-safe skincare *guidance*", and it is better served by expert-anchored content than by open peer UGC.** The unmet need is real and worsening — the AAD found **16M+ U.S. adults reduced sunscreen use** due to online misinformation (2026); demand is pushing users to Reddit/Discord for peer trust. But the winning answer to a *misinformation* problem is *credentialed authority*, not more peer content (which imports the very risk OnSkin exists to escape). OnSkin already owns the engine for this — the evidence-graded conflict layer (docs/02) and the independent recommendation engine (docs/09). A community here is most defensible as an **expert "myth vs evidence" trust layer that extends the recommendation engine**, not a social feed. *(Confidence: high on the demand; medium on community-as-the-delivery-mechanism.)*

10. **The one constructive case for ever doing *peer* contribution is the recommendation flywheel — and only in structured, anonymised form.** Structured (non-free-text) contributions — "I use this for dry + sensitive skin", a "this helped" reaction on an expert note, an anonymised routine share — can be normalised into the "people like you" signals the recommendation engine (docs/09) already wants, making recommendations better and therefore retention better. This is the only place community and a *proven* pillar become one flywheel. But it requires Phase-2+ density, must be aggregated/anonymised, and must **never** surface a free-text health disclosure to other users. *(Confidence: medium; this is the strongest pro-community argument and the most execution-dependent.)*

---

## Details

### 1. What it is — and is not (scope; the boundary with docs/03, /06, /07, /09)

**It is** a calm, trust-first layer that lets OnSkin answer the question users most fear getting wrong — *"is what I'm reading online actually true for my skin?"* — with credentialed, claim-safe, evidence-graded answers, and (only in later phases, only if justified) lets users ask questions and contribute *structured* signals anonymously. It owns the *content* (expert "myth vs evidence" entries and answers), the *surfaces*, the *moderation pipeline*, the *consent and age gating*, and the *trust architecture* that keeps it from becoming the thing it exists to counter.

**It is not**, and these boundaries are the entire point:

- **not the retention mechanic** — the calm streak, weekly adherence, and month heat-map are *already built* (docs/03 §6, docs/07; D-025/D-046). Those are the private, single-player "social-comparison-with-yourself" levers the evidence actually supports. Document 11 does not re-litigate them; it addresses only the *peer/social* question they don't cover.
- **not an open social feed, a forum, or a photo-sharing community** — there is no chronological or algorithmic feed, no follower graph, no public profiles, no DMs, no likes/leaderboards, and **no public before/after photo galleries**. These are forbidden by construction (§5, D-042). Progress photos stay **local-only by default** exactly as docs/06 mandates (D-039); they can never enter the community schema (§7).
- **not a medical-advice service** — expert content is general cosmetic/educational information, framed claim-safe ("for the appearance of…", never "treats/cures"), gated by B-DERM-REVIEW, and explicitly *not* individualised diagnosis. This mirrors Flo's explicit "not medical advice" posture and keeps OnSkin out of regulated telehealth.
- **not a storefront or an affiliate surface** — community content is walled off from commerce exactly as the recommendation engine is (docs/09 §3, docs/10): no incentivised reviews, no employee posting without disclosure, no suppressing brand-critical posts, no affiliate links inside community content. Here, FTC compliance and the trust moat point the same way (§8).
- **not the recommendation engine** — it *consumes* docs/09's outputs (it can attach an expert "myth vs evidence" note to a recommendation's "how") and, in Phase 2+, *feeds* docs/09 structured anonymised signals (§6) — but it never ranks products and never re-orders a recommendation.

**The defining line (made explicitly, as docs/09 made the advisor-vs-storefront line):** OnSkin builds an **expert-anchored trust layer**, not an open peer social network. Every design choice below flows from that. The naïve version of this feature — a Reddit/Instagram-for-skincare feed — is not merely lower-value; it is *the* feature most likely to convert OnSkin's durable trust advantage into the misinformation, comparison, and liability problems that the rest of the app exists to escape.

### 2. The honest verdict — is a community even right for OnSkin? (the tension, resolved)

This document owes the founder a direct answer, because the build order says "community is next" and the evidence says "be careful."

**The case *for* (steel-manned):** the misinformation problem is real, large, peer-reviewed, and worsening, and *no one trustworthy owns it* — the AAD found 16M+ U.S. adults cut sunscreen over online claims; only ~2.5% of viral skincare content comes from board-certified dermatologists. Community can compound the subscription pillar three ways at once: (a) retention → LTV (the *Management Science* RCT's ~11–14% churn-hazard reduction × Reichheld's leverage, where a 5-point retention gain drives a 25–95% profit increase); (b) word-of-mouth → lower CAC (referred customers show **+16% LTV / −18% churn**, Wharton 2011, and Yuka grew to seven figures on word-of-mouth with zero marketing); and (c) structured contributions → a proprietary dataset that makes the recommendation engine, and therefore retention, better over time (§10/§6). In its strongest honest form, the bull case is *"community is the multiplier that lets a Yuka-class trust app break past Yuka's ~$7.37M ceiling."*

**The case *against* (the trap):** every dollar of that case evaporates the moment community becomes an open feed. The dominant community model is built to maximise engagement and is a misinformation and comparison engine — precisely the conflict of interest with claim-safety and "calm" that would destroy OnSkin's only moat. The role model itself (Yuka) reached seven figures with *none* of it; community is unproven as a direct monetiser (16–24% of teams can even quantify it); it imports a quantified misinformation liability that survives expert moderation (~21%); it falls hardest on OnSkin's exact, already-vulnerable users (acne-stigma r=0.53); it expands the regulated health-data surface without new revenue (MHMDA private right of action; FTC $51,744/violation; COPPA faceprints); it is a recurring cost centre with no volunteer-labour escape; and it faces a likely-fatal cold-start in a category where users don't show up to socialise (Supergreat $31M, dead; Clear stalled at ~47K downloads).

**The resolution (the spine of this document):** build the **expert-anchored trust layer**, deferred and radically scoped, and **do not build the open social feed at all.** This captures the only proven, on-thesis upside (retention via private mechanics already shipped; trust differentiation via credentialed content) without the trap (the UGC feed that kills trust), and it is exactly what the best-in-class privacy-first health community does — Flo runs a calm community at 77M MAU precisely *because* it is anonymous, topic-structured, pre-moderated, and bans medical advice. **Verdict: a community is conditionally right for OnSkin — but only this version, and only after the pillars it is meant to multiply are themselves strong.** The honest corollary, which respects docs/00 as source-of-truth while reporting what the evidence says, is in §11 and Recommendations: keep the *expert trust layer* as build item 11, and **defer any peer-posting phase** behind the subscription + recommendation pillars and the catalog seed.

### 3. Why an open UGC forum is hostile to the moat (the four convergent liabilities)

The four independent reasons converge — they are not a single objection restated, and they compound rather than add:

1. **Misinformation (vs claim-safety).** UGC skincare advice is documented as low-accuracy and physically harmful: the Northwestern/*Pediatrics* study (June 2025; 100 videos, 82 creators) found teen TikTok routines average **6 products, 11 potentially irritating actives, ~$168/month**, with sunscreen in only **26%** of daytime routines — risking irritant/allergic contact dermatitis, a *lifelong* allergy. The AAD warned (Oct 2024) that viral trends (Russian manicures, "glass skin" over-layering, at-home red-light) are "problematic", and DIY trends (homemade sunscreen, beef tallow, lemon juice) are uniformly condemned. Moderation reduces but cannot eliminate this: expert-led communities still carry **~21%** misinformation and correct only **~25.7%** of bad threads (Bizzotto et al., JMIR 2023). A claim-safe brand cannot host this.

2. **Comparison harm (vs "calm").** A public photo/appearance feed is the single most-documented harm vector for OnSkin's female-skewing demographic (§5; r=0.53 acne-stigma; skin-dysmorphia ρ=0.29; Meta's own leaked finding that **32% of teen girls *who already felt bad about their bodies*** said Instagram made it worse — a disputed internal slide, framed carefully). Clinical guidance now says *avoid* filtered before/after imagery — the most engaging community behaviour is also the most harmful one.

3. **Health-data + legal exposure (vs privacy-first).** Public skin-condition posts are a new MHMDA/GDPR-Art. 9 surface that the existing photo consent does **not** cover; this converts OnSkin into a regulated hosting platform with a private right of action and a mandatory Apple/Google moderation floor (§6, §8).

4. **Cost + cold-start (vs runway and focus).** Recurring paid moderation OnSkin cannot subsidise the Reddit way, plus a likely-fatal empty-room problem in a niche (§7/§8). Every monetised beauty-community precedent has failed or stalled.

> The takeaway is not "communities are bad." It is that *this app's* moat is uniquely incompatible with the *open* form, and uniquely well-suited to the *expert-anchored* form — because OnSkin already owns the evidence-graded engine (docs/02/09) that an open forum lacks.

### 4. The single best execution — "Skin Notes" (the expert-anchored trust layer)

If anything ships, it ships as **"Skin Notes"** — copy Flo's cage, then tighten it. Flo's community works at scale precisely because it is **anonymous** (random avatars, identity hidden), **topic/category-structured** (1,000+ threads, not an open appearance feed), **human pre-moderated** (comments approved before they appear), and explicitly **bans members from giving/asking medical advice and dosages**. OnSkin adopts each of those and adds claim-safety and evidence-grading on top.

| Dimension | Specification | Evidence anchor |
|---|---|---|
| **Anonymity** | Anonymous-by-default. Random/assigned `anon_handle`, **no real names, no follower counts, no public profiles, no DMs, no social graph.** | Flo's anonymous model at 77M MAU; Strava's A/B test showing the follow→retention link is weak causally. |
| **Structure** | Topic-structured, expert-*seeded*. Authority broadcast over peer chat. Phase 1 is **read-mostly**. | Expert-led health communities carry ~21% misinformation vs 32.4% peer-led; correct 65.5% of bad threads vs 34.5% (Bizzotto, JMIR 2023). |
| **Content** | Dermatologist/cosmetic-chemist-authored **"myth vs evidence"** entries + claim-safe explainers, each carrying the docs/02 **evidence grade** (SORT A/B/C; null = refuted myth) and an honest source. | Only ~2.5% of viral skincare content is expert-made while ~40% use social for skin info — the credibility gap OnSkin fills. |
| **Claim-safety** | Cosmetic-verbs-only, enforced by the shipped claim-safety guard (docs/02/06/07/08 pattern) as a *flag*, with human pre-moderation authoritative and an appeal path (§6). | Northwestern/*Pediatrics* (2025): teen UGC routines average 11 irritating actives, sunscreen in only 26%. |
| **Moderation** | Human **pre-moderation** (approve-before-publish) + expert seeding; budgeted as recurring opex (B-COMMUNITY-MOD). | Moderators themselves share misinformation 24.6% of the time — containment is imperfect; size brand risk accordingly. |

**The content primitive — the "myth vs evidence" card — is an extension of the recommendation engine, not a new social object.** It reuses the exact visual vocabulary OnSkin already ships (docs/02/13 design tokens): the four evidence-label pills (Established = ink; Plausible = greige; Contested = clay-tint; **Refuted = sage**), the calm severity ramp, the sage "good news" treatment for debunked myths. Example entries, all claim-safe and evidence-graded: *"Does retinol thin your skin?"* (refuted, sage), *"Can I use niacinamide with vitamin C?"* (the classic myth — refuted/reassuring, the docs/02 Maya reassurance), *"Is a 'glass skin' 10-step routine better for sensitive skin?"* (contested → "fewer/smarter", docs/05 skinimalism). Each names the *concern* not a *condition*, carries the SORT grade and an honest caveat, and links — where relevant — to the user's own routine or the recommendation that surfaced it.

### 5. The forbidden patterns (the kill list — each tied to a specific harm)

These are barred at the **architecture** level (schema + RLS + module boundaries), not merely hidden in the UI (D-042), so a future growth pressure cannot quietly re-enable them:

- **No public before/after photo feed or galleries.** The single most-documented harm vector for this demographic (r=0.53 acne-stigma; skin-dysmorphia ρ=0.29; clinical guidance to avoid filtered before/after). **Photos stay local-only** (docs/06, D-039) and the community schema has *no image/photo/storage_path column at all* (§7).
- **No likes, leaderboards, ranked "perfect skin" content, influencer surfaces, follower counts, DMs, or chronological/algorithmic engagement feed.** Algorithmic recommendation and addictive-design patterns are precisely the Section-230 erosion vectors (*Anderson v. TikTok* 2024; *Lemmon v. Snap*; Mass. SJC *Commonwealth v. Meta* 2026) and the opposite of "calm". Ranking by popularity also amplifies popular-over-accurate content — the wrong objective for an evidence-honest brand.
- **No incentivised reviews, no undisclosed employee/insider posting, no suppression of brand-critical posts.** The FTC Reviews Rule (16 CFR 465; up to $51,744/violation) targets OnSkin's *own* conduct; here compliance *reinforces* the moat. The r/SkincareAddiction moderator pay-for-promotion scandal and Sunday Riley's FTC case are the cautionary tales — covert monetisation is the #1 community trust-killer. (Note the FTC also bars "groundless legal threats" to suppress negative reviews, so OnSkin cannot quietly scrub a brand-critical post to protect an affiliate relationship — a squeeze that argues *for* keeping community independent of commerce.)
- **No "treats/cures"/dosage language.** Auto-flagged and human-removed; cosmetic verbs only.
- **No selling, sharing, or training on community content.** Unlike PatientsLikeMe (whose model was selling de-identified aggregated data), OnSkin never monetises community data — that is the MHMDA-ethos line and the Yuka promise ("revenues come from users, never from brands").

### 6. How it works — the moderation pipeline, the claim-safety guard, and the recommendation flywheel

**The pre-moderation pipeline (peer content, Phase 2+):**
```
submit(user, topic, body):
  require is_anonymous(user) == false            # docs/01 §1: anon users cannot post (restrictive RLS)
  require valid_consent(user, 'community_participation')   # separate unbundled grant; else block (§8)
  require age_ok(user, 16)                         # hard gate (COPPA + "Sephora kids")
  flag = claim_safety_scan(body)                  # the shipped guard (drug/disease verbs, dosage, alarm, %); a FLAG, not a gate
  insert community_questions(state='pending', claim_safety_flag=flag, consent_grant_id=...)
  enqueue human_pre_moderation                    # approve-before-publish; SLA tracked
human_pre_moderation(item):
  decision ∈ {approve, reject(reason)}            # reason = DSA Art. 17 statement of reasons
  on approve  -> state='approved' (now visible to other authenticated users)
  on reject   -> state='rejected'; notify author with reason + appeal path
```

**The claim-safety control is human-authoritative, not classifier-authoritative.** The auto-scan reuses the regression guard already shipped for rules, photos, notifications, and the paywall (docs/02/06/07/08) — it is a *first-pass flag*, not the decision. This deliberately closes both failure modes a naïve auto-filter would create: **under-blocking** (a paraphrased "it healed my acne" the classifier misses) is caught by mandatory human pre-moderation; **over-blocking** (a legitimate post wrongly flagged) is caught by an explicit **appeal path** (also a DSA Art. 17 obligation). No post reaches another user on the strength of the classifier alone. (If an automated classifier is ever used as more than a flag, it falls under EU AI Act content-moderation obligations — re-verify; B-COMMUNITY-LEGAL.)

**Expert content (Phase 1) is editorial, gated, and provenance-tagged.** "Myth vs evidence" entries and expert answers are authored/reviewed in an internal console, carry an `author_credential` (e.g., "Board-certified dermatologist"), an evidence grade, an honest source, and a `reviewed_by` value — and, exactly like the conflict matrix (docs/02, B-DERM-REVIEW; D-032's `shippableRules` pattern), **unreviewed entries are withheld in production** until clinical sign-off. There is no peer free-text in Phase 1, so the misinformation surface is near-zero.

**The recommendation flywheel (the one constructive case for peer contribution — §10/KF10).** In Phase 2+, *structured* contributions (a "this helped" reaction on an approved note; a normalised "I use this for dry + sensitive skin" tag; an anonymised routine share) are aggregated into the "people like you" signals the recommendation engine (docs/09 §5/§8) already wants — *"users with your profile who tolerated retinol found alternate-night cycling helped."* This is where community and a *proven* pillar become one flywheel: more structured signal → better recommendations → better retention. Hard rules: contributions are **structured, not free-text health disclosures**; signals are **aggregated and anonymised** before they reach another user; and the church-and-state rule (docs/09 §3, D-038) still holds — community signal informs *fit*, never commission.

### 7. Data model (the schema — segregated, consent-scoped, photo-free)

The community is a **new health-data class**, physically segregated from the recommendation path (the docs/09/10 "church and state" discipline) and from the photo store (docs/06). It reuses the docs/01 conventions exactly: `(select auth.uid())`, `TO authenticated`, `WITH CHECK` everywhere, indexed policy columns, `owns_*` security-definer helpers, append-only audit, and the immutable consent ledger.

```sql
-- Topic catalog (structured; world-readable to authenticated, service-role write — the docs/02 §3 catalog pattern, D-016)
create table public.community_topics (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- 'retinoids' | 'sunscreen' | 'sensitive-skin' | 'ingredient-myths'
  title       text not null,
  description text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

-- Expert-seeded EDITORIAL content (NOT peer UGC): "myth vs evidence", expert answers, explainers
create table public.community_notes (
  id                uuid primary key default gen_random_uuid(),
  topic_id          uuid not null references public.community_topics(id),
  kind              text not null,           -- 'myth_vs_evidence' | 'expert_answer' | 'explainer'
  title             text not null,
  body              text not null,           -- claim-safe; cosmetic verbs only
  evidence_grade    text,                    -- SORT A/B/C (docs/02); NULL = refuted myth ('—', D-019)
  evidence_label    text,                    -- 'established'|'plausible'|'contested'|'refuted' (docs/02 vocab)
  provenance        text not null default 'expert',  -- 'expert' | 'editorial'
  author_credential text,                    -- displayed: 'Board-certified dermatologist' | 'Cosmetic chemist'
  source_url        text,                    -- honest citation (Wirecutter/Yuka-style transparency)
  claim_safety_ok   boolean not null default false,  -- the claim-safety guard verdict (must pass to publish)
  reviewed_by       uuid,                    -- B-DERM-REVIEW gate: NULL = not cleared -> withheld in production
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Peer questions (Phase 2+) — the NEW consumer-health-data class. Owner-write, MODERATED read, consent-scoped.
create table public.community_questions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  topic_id          uuid not null references public.community_topics(id),
  body              text not null,           -- free-text MINIMISED; structured contributions preferred (§6)
  anon_handle       text not null,           -- assigned pseudonym; NEVER profiles.display_name
  moderation_state  text not null default 'pending',   -- 'pending' | 'approved' | 'rejected'
  claim_safety_flag boolean,                 -- auto-scan FLAG only (human pre-mod is authoritative, §6)
  rejected_reason   text,                    -- DSA Art. 17 statement of reasons
  consent_grant_id  uuid not null references public.consents(id),  -- the community_participation grant (§8)
  created_at        timestamptz not null default now()
  -- NOTE: there is deliberately NO image/photo/storage_path/local_uri column. Photos can NEVER enter
  -- the community schema (D-042). Enforced at the table layer, not just the UI.
);
create index on public.community_questions (topic_id, moderation_state);
create index on public.community_questions (user_id);

-- Structured contributions that feed docs/09 "people like you" (Phase 2+) — anonymised/aggregated, no free text
create table public.community_reactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  note_id     uuid references public.community_notes(id),
  reaction    text not null,                 -- 'helped' | 'use_this' | ... (a closed vocabulary, never free text)
  created_at  timestamptz not null default now(),
  unique (user_id, note_id, reaction)
);

-- Moderation audit (append-only; content-free where possible)
create table public.community_moderation_events (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid references public.community_questions(id) on delete cascade,
  action       text not null,                -- 'approved' | 'rejected' | 'removed_after_report'
  reason       text,
  acted_at     timestamptz not null default now()
);

-- Apple Guideline 1.2 mandatory floor: in-app report + user block (works on anonymous handles)
create table public.community_reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references auth.users(id) on delete cascade,
  question_id   uuid not null references public.community_questions(id) on delete cascade,
  reason        text not null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create table public.community_blocks (
  user_id        uuid not null references auth.users(id) on delete cascade,
  blocked_handle text not null,              -- block an anon handle; never exposes a real identity
  created_at     timestamptz not null default now(),
  primary key (user_id, blocked_handle)
);

-- Consent ledger extension (docs/01 §3): add a new, separate, unbundled consent type.
--   consents.consent_type now also accepts 'community_participation' (MHMDA/GDPR Art. 9; §8).
```

**RLS (the load-bearing rules):**
- `community_topics`, `community_notes`: `SELECT TO authenticated` — but `community_notes` only where `reviewed_by IS NOT NULL AND claim_safety_ok` (the production gate, mirroring `shippableRules`/D-032); writes service-role/expert-console only.
- `community_questions`: the owner can `SELECT/INSERT` their own rows; **other** authenticated users can `SELECT` only where `moderation_state = 'approved'`; **anonymous users (`is_anonymous` JWT claim) are blocked from `INSERT` by a restrictive policy** — closing exactly the gap docs/01 §1 named ("Use restrictive RLS checking `is_anonymous` to lock anonymous users out of sensitive writes … no community posting"). `WITH CHECK` additionally requires a *current, un-revoked* `community_participation` consent grant via an `owns_consent()` definer helper (the D-014/D-018 ownership pattern). No UPDATE by the author after submission except withdrawal (which deletes — see below).
- `community_reactions`, `community_reports`, `community_blocks`: owner-only, with the docs/01 `(select auth.uid()) = user_id` + `WITH CHECK` pattern.
- All `SECURITY DEFINER` helpers `REVOKE`'d from `public/anon/authenticated` except where an RLS policy invokes them (D-013).

**Data-subject rights, deletion & sunset (closing a real compliance obligation, not optional):**
- **Account deletion** cascades from `auth.users` (`ON DELETE CASCADE`) and removes all peer content, reactions, reports, and blocks — extending the existing `account-deletion` Edge Function (docs/01 §4).
- **Consent withdrawal** (a new immutable `consents` row revoking `community_participation`, per D-015) triggers an Edge Function that **deletes the user's pending and approved questions** and their reactions (MHMDA's deletion right has no retention exception; GDPR Art. 17). Expert `community_notes` persist (they are OnSkin's content, not the user's) so thread integrity survives without retaining user health data. Because content is anonymous and there is no reply-threading on free text in early phases, erasure does not orphan a conversation.
- **Sunset plan (if the feature is killed, §11):** peer content is exported to the affected users (GDPR Art. 20, the existing `data-export` function) and then deleted — never silently retained post-shutdown and never dumped without notice. A trust-first brand offboards a killed community as carefully as it onboarded it; Duolingo's clean forum shutdown is the model, its messy bits the warning.

### 8. Compliance, claim-safety & consent (the floor that makes the layer lawful)

- **Mandatory store floor (build first, or be rejected).** Apple Guideline 1.2 and Google Play's UGC policy require: a content filter, an in-app **report** mechanism, the ability to **block** abusive users, **published** contact info, a zero-tolerance EULA accepted before posting, and action on reports within **~24h** (reaffirmed Apple, June 2026). These are the `community_reports`/`community_blocks` tables + the moderation SLA + the EULA gate. Without them the app does not ship. (B-COMMUNITY-MOD.)
- **Separate, unbundled health-data consent.** A user posting skin/health-adjacent information to others is a new collection/sharing event under Washington MHMDA and GDPR Art. 9; the existing photo/`data_sharing` consents do **not** cover it, and the GDPR Art. 9(2)(e) "manifestly made public" exception is too narrow to rely on for a closed community. A distinct `community_participation` consent — opt-in, specific, informed (the docs/01 §4 standard) — is required before any peer post, recorded to the immutable ledger and referenced by `consent_grant_id`. *Selling* community health data is avoided entirely. (B-PRIVACY / B-PRIVACY-COPY; DPIA extension.)
- **Hard 16+ age gate.** Skincare skews young ("Sephora kids"); the amended COPPA Rule (effective June 23, 2025; full compliance April 22, 2026) expands "personal information" to biometric faceprints, and a state regulatory front is active (the CT AG → Sephora safeguards, 2026; CA AB 728, stalled). Posting is gated to a declared/verified 16+; note that self-declared age does not fully sidestep COPPA where the audience skews young, so combine the gate with audience-appropriate design and no faceprints (docs/06 already stores none). (B-COMMUNITY-LEGAL.)
- **Section 230, honestly.** It still broadly immunises OnSkin from a user's defamatory criticism of a *named brand* (the user is the liable party), but it does **not** shield against the FTC, COPPA, or MHMDA, and it erodes when a platform adds algorithmic feeds/addictive design — which is exactly why §5 forbids the engagement feed. The real exposure is OnSkin's *own* conduct under the FTC Reviews Rule.
- **EU DSA + UK Online Safety Act.** As a micro/small enterprise (<50 employees AND <€10M turnover) OnSkin is exempt from the heavy DSA Section 3 platform obligations, but **not** from the Section 2 hosting duties — notice-and-action (Art. 16), statement of reasons (Art. 17, the appeal path in §6), crime reporting (Art. 18), and an EU legal representative. The UK Online Safety Act adds illegal-content and children's-access duties now in force. (B-COMMUNITY-LEGAL.)
- **Multilingual reality.** Yuka operates in 12 countries; claim-safe *medical-claim* moderation in every shipped language multiplies cost and difficulty. Mitigation: launch English-first; expert "myth vs evidence" content is *editorially translatable* (a known, bounded cost) whereas free-text peer moderation is not — another reason Phase 1 (expert content) precedes any peer phase. (Flagged in Caveats.)

### 9. The surfaces — where it appears, look & feel (calm, never social-media)

Design tokens per docs/00 §8 / docs/13 (D-005/D-013): Instrument Serif display, Hanken Grotesk UI, IBM Plex Mono eyebrows/metadata; paper #FAF7F2 · greige · clay #A5694B · ink · night; the sage "good news" system for refuted myths; 8pt grid; Reanimated 3 motion; restrained haptics; WCAG 2.2 AA; Dynamic Type; RTL-ready. The register is *calm reference library*, never *social feed*.

- **9.1 "Skin Notes" hub (within the You tab, or a calm card on the recommendation "For you" hub).** Topic-structured (not chronological): cards grouped by topic ("Retinoids", "Sunscreen", "Sensitive skin", "Ingredient myths"). Each entry is a **myth-vs-evidence card** reusing the exact evidence-label pills and the sage refuted-myth treatment OnSkin already ships — *What* (the claim), *Verdict* (refuted/contested/plausible/established, evidence-grade pill), *Why* (claim-safe mechanism + SORT grade + honest caveat), and an honest **source**. There is no like count, no author follower count, no ranking by popularity. Deliberately a *library*, not a feed.
- **9.2 In-context "myth vs evidence" (attached to recommendations and conflicts).** When the recommendation engine (docs/09) shows a suggestion, or the conflict engine (docs/02) shows the niacinamide×vitamin-C reassurance, an optional "Read the evidence" affordance opens the relevant Skin Note — the trust layer reinforcing the recommendation's "how", exactly where the question arises.
- **9.3 Ask a question (Phase 2+, anonymous, pre-moderated).** A calm composer that *requires* the `community_participation` consent and the 16+ gate, assigns an `anon_handle`, runs the claim-safety flag, and shows an honest "An expert or our team will review this before it appears" state (Flo's pre-moderation, made transparent). No public profile is ever created. Rejected posts return a plain-language reason and an appeal link (DSA Art. 17).
- **9.4 "People like you" (Phase 2+, anonymised aggregate — *not* a feed).** A quiet, opt-in card on the recommendation hub: *"Among people with dry, sensitive skin who use retinol, alternate-night cycling was the most common way to keep it comfortable."* This is an aggregated, anonymised signal (§6) — never a list of individuals, never a comparison ranking, never a photo.
- **Across all surfaces:** no infinite scroll, no notifications that manufacture engagement (the docs/07 tiering and quiet hours apply — community is the *behavioural*/opt-out tier at most, never promotional push of others' content), report/block always one tap away, and every expert entry carries its credential and source. Photos never appear.

### 10. The Maya worked example (used throughout, per the spec)

**Maya** — dry + sensitive; owns Vitamin C serum, Retinol 0.3%, Glycolic 7% toner, Ceramide moisturiser, Mineral SPF 50; her shelf carries the retinol × glycolic *Moderate / contested* conflict that the engine resolved to *alternate nights* (docs/02/03/05).

- **Phase 1 (what Maya gets at launch of Skin Notes):** while reviewing her routine, Maya wonders if the niacinamide-plus-vitamin-C warning she saw on TikTok applies to her. She taps "Read the evidence" on her Vitamin C step and lands on a **myth-vs-evidence card**: *"Can you use niacinamide with vitamin C?"* → **Refuted** (sage pill), claim-safe mechanism, *"Broad consensus; the old 'they cancel out' claim comes from decades-old raw-ingredient research,"* SORT-graded, with an honest source and a "Board-certified dermatologist" credential. She also sees *"Does retinol thin your skin?"* (refuted) and *"Is a 10-step 'glass skin' routine better for sensitive skin?"* (contested → "fewer/smarter", docs/05). **No before/after photos. No feed. No other users.** Her own progress photos stay on her phone (docs/06).
- **Phase 2 (only if Phase 1 earns it):** Maya, having consented to `community_participation` and being over 16, anonymously asks: *"My retinol and glycolic are on alternate nights — is that enough recovery for sensitive skin?"* She posts as a random handle; the claim-safety scan flags nothing; a human moderator approves it; an expert answers claim-safe and evidence-graded. Maya never has a public profile, never sees a leaderboard, never compares her skin to anyone's photo. Her structured "this helped" reaction on the answer becomes one anonymised data point in the *"people like dry+sensitive-skin you"* signal that improves docs/09's recommendations.
- **What Maya never experiences:** an open feed of strangers' faces, a "perfect skin" influencer post, a DM, a follower count, a "X cured my eczema" thread, or any nudge to buy. That absence *is* the feature.

### 11. Phasing, instrumentation & the (honest) kill switch

**Phasing — one mechanic at a time (respecting the RCT's non-additivity warning that combining contribution + consumption backfired):**
- **Phase 1 (the only phase justified by current evidence): expert-seeded, read-mostly "myth vs evidence" Q&A**, attached to the recommendation engine. No peer posting. Near-zero misinformation/moderation/legal surface. This is the on-thesis trust layer and the version that should carry the docs/00 "item 11" slot.
- **Phase 2 (gated on Phase-1 retention signal + moderation capacity): anonymous, pre-moderated peer *questions* + *structured* contributions** feeding the recommendation flywheel (§6).
- **Phase 3 (only if Phases 1–2 prove a churn lift and the moderation SLA holds): anonymous, Flo-style "Secret Chats" topic threads.**
- **Never:** open feed, follower graph, DMs, likes/leaderboards, public before/after photo galleries.

**The instrumentation honesty problem (the most important caveat in this document).** The clean way to justify a retention feature is an A/B churn holdout. At OnSkin's realistic scale, that test is likely **statistically unfireable**: detecting an ~11–14% *hazard* reduction at adequate power, against a single-digit-percent paid base with a ~1% contributor cohort, needs **many quarters and tens of thousands of exposed paying users** — longer than any "kill within two quarters" rule. Presenting an A/B kill switch as the safeguard while quietly lacking the power to fire it would be false rigour. So the kill switch is built from **observable tripwires that do not depend on detecting the lift**:
- **Brand/claim-safety tripwire (immediate kill of the offending phase):** any viral "treats/cures" or DIY-harm thread surfacing under the OnSkin name.
- **Legal tripwire (immediate):** any MHMDA/Art. 9 consent gap, COPPA exposure, or store-floor rejection.
- **Cost ceiling (observable):** moderation opex exceeding a pre-set fraction of the *modelled* incremental retained-subscription LTV — a number OnSkin *can* observe even when the lift itself is noisy.
- **SLA gate (observable):** the ~24h moderation-action SLA must hold; a sustained breach freezes new-post intake.
- **Engagement *floor*, not target:** because 90-9-1 means ~90% lurk, *low contribution is expected, not failure* — design for lurker (read) value first and do not chase social-app stickiness (utility/health apps realistically reach 15–30% DAU/MAU vs 50–80% for social).

**Opportunity cost (stated plainly).** The same engineering quarter spent on Document 11's *peer* phases instead buys catalog expansion (B-CATALOG-SEED — which directly improves the recommendation engine's specific-product coverage, docs/09 caveats) or subscription-funnel hardening (docs/08) — both higher-ROI and better-proven than an unproven community lift. This is the strongest reason to ship only Phase 1 now and defer the rest.

### 12. Engineering / implementation notes

- **Module boundaries (church-and-state, extended).** The community module imports no commerce module (docs/10) and the ranking module imports no community module; community signal reaches the recommendation engine only as *aggregated, anonymised* "people like you" inputs (docs/09 §5), never as commission or as a free-text health record. Enforce with separate Postgres schemas/roles and review.
- **Reuse, don't reinvent.** The claim-safety guard is the existing regression test pattern (docs/02/06/07/08) pointed at `community_notes.body` and `community_questions.body`; the local-first/guarded-mirror pattern (D-029) and the immutable consent ledger (D-015) carry over unchanged.
- **Expert console + seeding (the real make-or-break).** Phase 1 lives or dies on *seeded content density and expert recruitment*, not on a peer flywheel — a read-mostly library with three derms answering on their own time stalls exactly like Clear did. Budget a paid expert network (B-EXPERT-NETWORK) and seed a substantial myth-vs-evidence corpus before launch; treat expert recruitment/retention as a first-class cost line, not a hand-wave.
- **PostHog instrumentation (docs/01 §7):** `skin_note_viewed` (topic, kind), `skin_note_evidence_expanded`, `community_consent_granted`, `question_submitted`/`_approved`/`_rejected`/`_appealed`, `reaction_added`, `report_filed`/`block_added`, and the moderation-SLA timer. Tie to churn cohorts for the (noisy) retention read — and **never** instrument toward engagement maximisation, which is the addictive-design pattern §5 forbids.
- **Performance & offline:** the expert library is cacheable, read-mostly content (works offline like the rest of the app, docs/01 §6); peer submission requires connectivity and consent and is therefore online-only by design.

---

## Seven-Figure Validation (the honest assessment)

The user asked for an honest answer to "is this a genuine seven-figure, king-making feature?" The evidence says: **no, not on its own, and not as an open community — but yes as an indirect multiplier on the pillar that already is, in a narrow form.**

- **Community is not a direct seven-figure pillar, and the role model proves it isn't required.** Yuka reached **$7,174,710 (97.3%) of $7,370,646** from subscriptions in 2024 with **no community** (Yuka, 2024). The industry can barely prove community monetises at all (16% of teams in 2024, 24% in 2025, can quantify its value — CMX). There is no precedent in the evidence base of a community layer generating seven figures *as a line item* for a consumer health app. *(Confidence: high.)* *(Reconciliation note for evidence-honesty: earlier OnSkin docs cite Yuka at "$7.17M of $7.3M (98.1%)"; against Yuka's full published total of $7,370,646 — which includes $137,893 books/calendars and $58,043 services — the subscription share is 97.3%. The dollar figures match; the percentage differs only because the earlier figure used a narrower denominator.)*

- **The honest mechanism is retention → subscription LTV, and the math is real but conditional.** A 5-point retention gain drives a **25–95% profit increase** (Reichheld, HBR/Bain restatement, 2014); the best causal community study found an **~11–14%** churn-hazard reduction (Gu et al., *Management Science* 2021). Applied even partially to a Yuka-scale subscription base, the incremental *retained* LTV is plausibly **six figures, compounding, with a path toward low-seven over time** — *but only if the lift materialises and is measured*, and the anchor RCT is gaming-context. Treat the dollar figure as an **illustrative model output, not a forecast**; the transfer assumption is the single biggest unknown. *(Confidence: low-to-medium.)*

- **A secondary, more speculative lever is referral/CAC suppression.** Referred customers show **+16% LTV / −18% churn** (Wharton, *Journal of Marketing*, 2011), and Yuka grew to seven figures on word-of-mouth with *zero* marketing. A trust-first community *could* feed this — but it is the least-proven leg and is upside, not base case. *(Confidence: medium on the referral premium; low on community-as-the-driver for OnSkin.)*

- **Ranked against the prior pillars, community is last.** Subscriptions are the proven seven-figure pillar (docs/01/08). Affiliate is a **six-figure** high-margin supplement (docs/10). Community is in the **same weight class or lower** as a contributor and — unlike affiliate — produces **zero direct revenue** while adding a **recurring cost** and an **acute legal/brand risk**. Its justification is *strategic* (retention, trust differentiation, recommendation-engine fuel), not financial.

- **The cost and failure side is concrete.** Recurring paid moderation OnSkin cannot subsidise the volunteer way (Reddit's free labour is worth ≥$3.4M/yr); a cold-start that has killed every monetised beauty-social precedent (Supergreat $31M, dead; MakeupAlley closing; Glossier's DTC retreat; Clear stalled at ~47K downloads); and the opportunity cost of building it instead of hardening the subscription and recommendation pillars. **An under-resourced community is worse than none for a trust-first brand.**

**Verdict: the community layer is *not* a king-making, seven-figure feature for OnSkin in the way the recommendation engine (docs/09) or the paywall (docs/08) are.** It is, at best, an **indirect retention/trust multiplier** whose dollar value is real but unproven, and an **open UGC version is value-destroying** for this specific moat. The only version that belongs is the narrow, anonymous, expert-anchored, claim-safe trust layer specified above — and even that should ship as Phase 1 only, deferred behind the proven pillars, and killed on the observable tripwires if it does not earn its keep. Built that way, it *reinforces* the trust that drives the subscription business; built as a social feed, it is the feature most likely to end it.

---

## Synthesis

**(a) What it is:** an expert-anchored, claim-safe, evidence-graded "myth vs evidence" trust layer ("Skin Notes") that extends the recommendation engine — *not* an open social/UGC community. The proven private retention mechanics (streaks, heat-map) are already shipped in docs/03/07.

**(b) The honest verdict:** community is *not* a seven-figure pillar and is *not* required for one (Yuka proves it at $7.17M/97.3% with zero community). It is an indirect retention multiplier — worth six figures, plausibly low-seven over time, *only if* a measured churn lift materialises — ranking below the affiliate six-figure supplement and below both as a build priority.

**(c) Does it belong:** conditionally yes for the narrow expert trust layer; firmly *no* for the open social feed; and even the narrow version should be sequenced after the subscription + recommendation pillars and the catalog seed. The build order's "item 11" slot belongs to Phase 1 (expert content); the peer phases should be deferred.

**(d) Why an open forum is hostile:** four convergent, quantified liabilities — misinformation (vs claim-safety), comparison harm (vs "calm"), health-data/legal exposure (vs privacy-first), and cost + cold-start (vs runway/focus) — each tied to specific evidence, each compounding.

**(e) The single best execution:** Flo's cage, stricter — anonymous, topic-structured, expert-seeded, human pre-moderated, claim-safe; with a hard kill list (no feed, no photos, no follower graph, no DMs, no likes/leaderboards, no incentivised/suppressed reviews) enforced at the architecture level, and photos that can never enter the community schema.

**(f) Compliance & consent:** the mandatory Apple 1.2 / Play floor (filter, report, block, contact, ~24h SLA); a separate unbundled `community_participation` consent (MHMDA/GDPR Art. 9); a hard 16+ gate (COPPA + "Sephora kids"); FTC Reviews-Rule discipline on OnSkin's own conduct; DSA Section 2 + UK OSA duties; and graceful deletion/sunset for a new health-data class.

**(g) The flywheel (the one pro-peer case):** structured, anonymised contributions feeding docs/09's "people like you" signals — the only place community and a proven pillar become one engine — gated to Phase 2+, aggregated, never free-text health disclosure, never commission-biased.

**(h) Economics & confidence:** retention multiplier (real mechanism, unproven magnitude, gaming-context RCT) × Reichheld leverage, plus a speculative referral/CAC lever; a recurring moderation cost and a graveyard of failed precedents on the other side; an honest kill switch built on *observable* tripwires because a clean A/B churn test is likely unfireable at OnSkin's scale.

---

## Recommendations

1. **Do not build an open social/UGC community.** Kill the open feed, public before/after photo galleries, DMs, follower counts, likes/leaderboards, algorithmic engagement feed, and incentivised reviews outright (D-042). They are the features most hostile to OnSkin's moat and have failed in every monetised beauty-social precedent.

2. **Ship Phase 1 only: the expert-anchored "Skin Notes" trust layer.** Anonymous, topic-structured, read-mostly, dermatologist/cosmetic-chemist-seeded "myth vs evidence" content, evidence-graded (docs/02), claim-safe, attached to the recommendation engine (docs/09). This is the on-thesis version and the one that should occupy the docs/00 "item 11" slot.

3. **Defer the peer-posting phases (2–3) behind the subscription + recommendation pillars and the catalog seed.** The cold-start problem is fatal in an empty room; the flywheel only spins with subscriber density and a real expert corpus. Sequence catalog (B-CATALOG-SEED) and recommendation hardening (docs/09) first.

4. **Build the legal/moderation floor before any peer post.** The four Apple/Google safeguards + the ~24h SLA (B-COMMUNITY-MOD); the separate unbundled `community_participation` consent and DPIA extension (B-PRIVACY/B-PRIVACY-COPY); the hard 16+ gate; the DSA Section 2 / UK OSA duties and counsel sign-off (B-COMMUNITY-LEGAL).

5. **Keep community independent of commerce, exactly as the recommendation engine is.** No incentivised reviews, no undisclosed insider posting, no suppression of brand-critical posts, no affiliate links in community content, no selling/sharing/training on community data — the FTC rule and the trust moat point the same way.

6. **Make photos architecturally impossible in community.** No image/photo/storage_path column in the community schema (D-042); progress photos stay local-only (docs/06, D-039). Enforce at the table layer, not the UI.

7. **Treat expert recruitment and human pre-moderation as recurring opex, and seed substantial content before launch** (B-EXPERT-NETWORK, B-COMMUNITY-MOD). An under-resourced or thinly-seeded community is worse than none for a trust-first brand; launch English-first to bound multilingual moderation cost.

8. **Instrument honestly and adopt the observable kill switch.** Define success as churn reduction but accept that a clean A/B holdout may be statistically unfireable at OnSkin's scale; rely on observable tripwires (brand/claim-safety incident; legal/consent gap; moderation cost ceiling; SLA breach) and an engagement *floor*, not a social-app stickiness target. Plan a graceful export-then-delete sunset if a phase is killed.

9. **Build the recommendation flywheel only in structured, anonymised form (Phase 2+).** Structured "this helped"/"I use this" signals → docs/09 "people like you" — never free-text health disclosure surfaced to others, never commission-biased (D-038 still holds).

10. **Re-verify at build time** (cross-cutting): Apple Guideline 1.2 current wording + the June 2026 enforcement posture; the amended COPPA biometric rule (full compliance April 22, 2026); MHMDA's application to skin-condition posts (unsettled — treat conservatively); the FTC Reviews-Rule penalty figure; DSA micro-enterprise thresholds + EU representative; UK Online Safety Act duties; and the EU AI Act's content-moderation-classifier obligations if any automated classifier is used as more than a flag.

---

## Caveats (confidence flags)

- **Community is not a direct seven-figure pillar and is not required for one.** Multiple independent lines converge, and the role model (Yuka) proves it isn't even necessary. *High confidence — this is the decision the feature hinges on.*
- **Community works as an indirect retention multiplier.** The mechanism is real, but the strongest causal evidence is a *mobile-gaming* RCT (Gu et al., *Management Science* 2021); transfer of the ~11–14% churn-hazard magnitude to a privacy-first skincare utility is unproven, and "more community" can backfire (the negative contribution×consumption interaction). *Medium confidence on the mechanism; low-to-medium on the magnitude.*
- **An open UGC forum is a net liability for this specific app.** Misinformation, claim-safety, health-data, comparison-harm, and cost all converge against it. *High confidence.*
- **The "six-figure, plausibly low-seven over time" retained-LTV figure is an illustrative model output, not a forecast.** It rests on a lift that must be measured and a cross-context transfer assumption. The "~23% churn reduction from community" figure circulating in vendor marketing is unsourced and excluded. *Low-to-medium confidence.*
- **The kill switch's A/B leg may be statistically unfireable at OnSkin's scale**, which is why the observable tripwires (brand incident, legal gap, cost ceiling, SLA breach) are the real safeguard. Presenting an A/B test alone as the kill switch would be false rigour. *High confidence that the detectability problem is real.*
- **Comparison-feed harm to OnSkin's demographic is well-evidenced** (causal meta-analyses; the validated Skin Dysmorphia Scale; the large acne-stigma correlation). The counter-case — that *structured, moderated, anonymous* support can be net-positive — is real but conditional on design and drawn mostly from chronic-disease/mental-health communities, not skincare. *High confidence on the harm; medium on the conditional upside.*
- **Whether a user's skin-condition post specifically triggers MHMDA is a reasonable interpretive read, not settled case law.** Plaintiffs are testing MHMDA's edges aggressively (first class action Feb 10, 2025); treat conservatively and obtain the separate consent regardless. *Medium confidence.*
- **Moderation dollar figures are vendor-sourced and illustrative**; the qualitative point — recurring opex, not a one-time build, with no volunteer-labour escape for claim-safe medical moderation — is solid. *Low-to-medium on the figures; high on the structure.*
- **The Section-230 erosion thesis** survives on *Anderson v. TikTok* (3d Cir. 2024), *Lemmon v. Snap* (9th Cir. 2021), and the Mass. SJC *Commonwealth v. Meta* (2026); it is case-by-case judicial erosion, not statutory repeal, and the avoidance strategy (no algorithmic engagement feed) is what matters. *Medium confidence.*
- **The Duolingo forum-shutdown rationale is inferred** from the documented timeline and outcomes (forums discontinued March 2022; DAU growth via streaks/leagues), not a sourced company quote. The endpoint (~50M DAU, +36% YoY, Q3 2025) is confirmed via SEC filing. *Medium-high confidence on the pattern; the causal "why" is inferred.*
- **The direct competitor Clear occupies OnSkin's exact "calm, non-toxic" positioning** with ~$1M raised, a ~$15M valuation, and 2,000+ brand partners but only ~47K downloads — investable and validating the *lane*, but not at standalone escape velocity. The lesson is that the positioning is real and the *standalone-social* model is structurally weak, which favours attaching the trust layer to OnSkin's already-monetising engine. *Medium confidence.*
- **Multilingual claim-safe moderation is an under-examined cost.** Expert content is editorially translatable; free-text peer moderation is not — another reason Phase 1 precedes any peer phase. Launch English-first. *Medium confidence.*
- **The "Sephora kids" / minor-safety regulatory front is active but in flux** (CA AB 728 stalled; the CT AG → Sephora safeguards landed in 2026; the under-13 California ban did not pass). The durable signal is regulatory *pressure*, not an enacted statute — design to the strictest plausible standard (16+, no faceprints). *Medium confidence.*

---

> **Decision-log notes (DECISIONS.md):** **D-041** — community is a **retention/trust multiplier on the subscription pillar, not a seven-figure pillar and not required for one** (Yuka proves it); it ranks *below* the affiliate six-figure supplement (doc #10) as a revenue contributor; the proven private retention mechanics (streaks/heat-map, docs/03/07; D-025/D-046) are *already shipped*, so Document 11's net-new scope is the **expert-anchored trust layer**, never an open social feed. **D-042** — **"no open UGC" by construction**: the forbidden patterns (open/algorithmic feed, follower graph, DMs, likes/leaderboards, public before/after photo galleries, incentivised/suppressed reviews) are barred at the *architecture* level, and **the community schema has no image/photo column — photos can never enter community** (enforced at the table layer; local-only stays local-only, docs/06/D-039). **D-043** — the layer is **anonymous-by-default, topic-structured, expert-*seeded*, human *pre*-moderated** ("Skin Notes" / "myth vs evidence" Q&A — Flo's cage, stricter); the shipped **claim-safety guard** (docs/02/06/07/08 pattern) is applied to community copy as a **flag**, with human pre-moderation authoritative and an **appeal path** (DSA Art. 17). **D-044** — a **new, separate, unbundled `community_participation` consent** (MHMDA/GDPR Art. 9) extends the docs/01 §3 ledger and is *never* reused from the photo or `data_sharing` grants; **anonymous (`is_anonymous`) users are locked out of posting via restrictive RLS** (closing the gap docs/01 §1 named); posting is hard-gated to **16+**. **D-045** — **phased rollout + observable kill switch**: Phase 1 read-mostly expert Q&A (the only phase justified now), Phase 2 anonymous pre-moderated structured peer questions feeding the docs/09 flywheel, Phase 3 anonymous Secret-Chats topics — each gated; because a clean churn A/B holdout is likely *statistically unfireable* at OnSkin's scale, the kill switch is **observable tripwires** (brand/claim-safety incident, legal/consent gap, moderation-cost ceiling, SLA breach), and peer phases are **deferred behind the subscription + recommendation pillars and the catalog seed**. Clinical sign-off of expert content is gated by **B-DERM-REVIEW**; the moderation/store floor by **B-COMMUNITY-MOD**; the UGC legal review by **B-COMMUNITY-LEGAL**; the consent copy + DPIA extension by **B-PRIVACY/B-PRIVACY-COPY**; expert recruitment by **B-EXPERT-NETWORK**.
