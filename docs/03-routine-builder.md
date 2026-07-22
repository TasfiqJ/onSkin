# Document 3: The Routine Builder — Build Spec

_Routine generation · application-order sequencing · frequency & the retinoid ramp-up · the skin-cycling-aware daily plan · the Today habit loop & check-off · editing, overrides & recompute · adaptation over time · reminders, widgets & Live Activity._

> This is build-order document **#3** of the 15 named in docs/00. It sits directly on top of **docs/02 (the ingredient intelligence layer)** — it _consumes_ that layer's conflict/synergy engine (`detect_conflicts`, the `conflict_rules` matrix, the resolution verbs), its skin-cycling scheduler (§5), and its PAO logic (§6) — and it _extends_ the `routines` / `routine_steps` / `routine_completions` schema defined in docs/01 §3. It is the layer that turns a skin profile + a shelf + the rules engine into a **living daily plan and a habit loop**. It renders the reveal's "See my routine" handoff (spec p6), the Today AM screen and its habit loop (spec p8), and the Today PM dark / skin-cycling screen with its conflict auto-resolution (spec p9). It powers the paywall's headline value prop — _"Routine intelligence — order, timing, skin cycling"_ (spec p7) — and it owns the product's **north-star activation metric**: "completed first routine check-off within 24 hours of install" (docs/01 §7).

---

## TL;DR

- **The routine builder is the product's spine, and it is the activation and retention engine — not plumbing.** It converts the skin profile (docs/01 `skin_profiles`), the shelf (`user_products`), and docs/02's rules engine into a personalised AM/PM plan, schedules the actives, folds in every conflict resolution, and renders the daily habit loop where the user checks off steps. That check-off **is** the north-star activation metric (docs/01 §7: "first check-off within 24 hours"), and the accumulating plan + cycle + completion history is the compounding switching cost that drives annual retention.

- **It is a deterministic, explainable _generator over curated rules_ — emphatically not an AI that "designs your routine."** This is the same architectural conclusion docs/00 §3 and docs/02 §1/§4 reached for the conflict engine, and it applies with equal force here: the sequencing, frequency, and cycling logic must be **auditable to a lawyer, explainable to a user, and impossible to hallucinate**. A competitor (HadaBuddy) already ships an "AI-built 7-day routine"; that is both a commoditising move and a liability vector. OnSkin's defensibility is the _combination_ a black box cannot safely replicate: cycling-aware scheduling + conflict resolution folded into the daily plan + a retinoid ramp-up schedule + the calm habit loop + PAO + privacy + the longitudinal data lock-in.

- **Application order is genuinely strong dermatological consensus — but it is still mechanistic, grade-C science, so encode it like the conflict matrix: graded, versioned, and reviewable.** Dermatologists consistently agree on three ordering rules — **thinnest-to-thickest, lowest-pH-first, and water-based-before-oil-based** — yielding the canonical AM (cleanse → optional tone → antioxidant/vitamin C → optional eye → moisturise → SPF) and PM (cleanse → optional tone → treatment/retinoid → optional eye → moisturise → optional oil) sequences (AAD; Mona Gohara MD, Yale; multiple board-certified derms). The popular _"improper layering cuts absorption by up to 40%"_ figure traces to vendor blogs citing a single 2020 paper — **treat the direction as consensus and the magnitude as vendor-sourced and unverified.**

- **Frequency and the retinoid ramp-up are the part most "routine builders" miss — and the builder must _schedule the ramp_, not just order the steps.** "Start low and slow" is close to universal dermatological consensus (board-certified derm Hadley King and many others): a low-strength retinoid **~2 nights per week**, built up over **one to two months** as tolerated, PM-only, pea-sized, on dry skin, buffered with moisturiser for sensitive skin, with **consistency valued over frequency**. This is simultaneously an efficacy strategy, an irritation-safety control, and a scheduling problem — and it ties straight back to docs/02's engine (King's own guidance: do not stack a retinoid with AHAs/vitamin C while ramping).

- **Skin cycling is the scheduling spine for actives — dermatologist-originated, massively in demand, durable, but not RCT-proven.** Dr. Whitney Bowe's four-night cycle (Exfoliate → Retinoid → Recover → Recover) has **~3.5 billion TikTok views** and is distinguished from fleeting trends precisely _because_ it is dermatologist-endorsed; it is especially suited to sensitive/reactive skin and active-skincare beginners. The builder makes it the default active-scheduling framework for anyone who owns actives, personalised by the sensitivity axis (docs/02 §5).

- **The habit loop must be calm, not gamified — and that is an evidence-based decision, not an aesthetic one.** Two independent literatures converge: (1) Lally et al. (_European Journal of Social Psychology_, 2010) found habits take **~66 days on average (range 18–254)**, debunked the "21-day" figure (which traces to Maltz's 1960 _Psycho-Cybernetics_, about adjusting to plastic surgery), and crucially found that **missing a single day did not meaningfully impair habit formation**; and (2) the streak-design literature shows rigid daily streaks weaponise loss aversion, triggering the _abstinence-violation effect_ and rage-quitting after one missed day (Octalysis Group; Duolingo case studies). The product consequence is explicit in the spec ("streaks and cycling are calm, not gamified," cover): a **forgiving** streak (grace days / freezes, recovery nights don't break it), a **weekly-adherence + heat-map** framing rather than an all-or-nothing counter, no shame copy, and a sub-one-minute check-off.

- **Everything the builder renders is docs/02's output _shown in context_.** The PM banner — _"Your glycolic toner is skipped tonight — it doesn't mix well with retinol. Next acid night: Saturday"_ (spec p9) — is the scheduler + engine resolution rendered. The AM _"Wait ~1 min after serum"_ (spec p8) is a `buffer` resolution. The Shelf's _"paired"_ badge (spec p12) is a conflict the builder has already resolved by placing two actives on different nights. The user always stays in control (the spec's "Use together anyway," p13).

- **Seven-figure verdict: yes — this is the retention-and-activation engine, and the risk is execution, not demand.** It owns the activation metric, it powers the paywall's #1 value prop and its single most demoable moment (the PM auto-resolution), and it is _what Yuka and EWG structurally lack_ (no routine, no profile — HadaBuddy's own competitive framing). It rides durable skin-cycling demand and the 2026 market shift toward trust, longevity, and scientific credibility (Cosmetics Business; Beauty Independent). The way to lose is to get the habit psychology wrong (punitive streaks) or the scheduling wrong — which is why this document is mostly about discipline.

---

## Key Findings

1. **Routine generation owns the north-star activation metric, so design the whole builder around the funnel that ends in the first check-off.** docs/01 §7 defines activation as "completed first routine check-off within 24 hours of install" and pairs it with a depth metric ("3 check-offs in first 7 days"). The reveal → "See my routine" → first AM/PM plan → first check-off path is the activation funnel; every screen and default in this document is tuned to shorten time-to-first-check-off, because Amplitude's analysis of 2,600+ products found ~98% of new users are inactive by Day 14 for half of all products (docs/01 §7).

2. **Application order is consensus but grade-C — encode it like the conflict matrix, and be honest about the evidence.** The principle is dermatologist-consistent (thinnest-to-thickest, low-pH-first, water-before-oil; AAD's public guidance plus derms including Mona Gohara MD of Yale and Nazanin Saedi MD), but the supporting evidence is mechanistic (penetration through the stratum corneum), not patient-outcome trials — so it lands at **SORT grade C** exactly as docs/02's interaction claims do. The widely repeated _"up to 40% reduced absorption"_ claim appears on commercial blogs citing a single _Biomedical Dermatology_ (2020) paper and should be flagged vendor-sourced; the _order matters for penetration_ direction is sound, the _quantified benefit_ is not established.

3. **Three ordering sub-rules dermatologists actually agree on, plus one sensitive-skin exception.** (a) **Thinnest-to-thickest** — light, water-based products penetrate before occlusive ones form a film; (b) **lowest-pH-to-highest** — acidic actives (vitamin C, AHAs) need a low-pH environment and shouldn't be neutralised by later layers; (c) **water-based before oil-based** — an oil film blocks lighter actives. The exception, well supported for sensitive skin, is the **buffer / "sandwich" method**: applying moisturiser _before_ (and after) a strong active to temper irritation — which is itself one of docs/02's `buffer` resolutions. Morning cleansing is optional for normal/dry skin; SPF is always the final AM step (mineral last; some derms apply chemical filters before moisturiser).

4. **The retinoid ramp-up is near-universal consensus and is fundamentally a _scheduling_ problem the builder must own.** Across dermatologist-reviewed sources (board-certified derm Hadley King; Glo Skin Beauty; Strut Health; HydroPeptide; The Amaranthine Collective, 2026), the protocol is consistent: start low-strength, **~1–3 (commonly 2) nights/week**, build gradually over ~1–2 months → every other night → nightly _as tolerated_, PM-only (UV degrades retinoids and increases photosensitivity), pea-sized, applied to **dry** skin (damp skin raises absorption _and_ irritation), buffered for sensitive skin, with **consistency more important than frequency** ("the skin barrier is a finite resource"). Skin type modulates the starting point (dry/sensitive start lower). King's guidance explicitly says not to combine a retinoid with AHAs or vitamin C while building tolerance — a direct hand-off to docs/02's engine — and to **stop retinoids in pregnancy/breastfeeding** (docs/02 §4.8 safety class).

5. **Skin cycling is the right default scheduling framework for actives: dermatologist-originated, hugely in demand, durable, expert-endorsed — and honestly, not RCT-proven.** Bowe's four-night cycle has ~3.5B TikTok views and, per multiple 2026 trend reviews, is treated as "a legitimate and beneficial skincare strategy" _because_ of its dermatologist provenance, with rest nights letting the barrier recover so actives work better. Its rationale is mechanistic and expert-endorsed, not trial-validated; the builder should adopt it with `gentle`/classic/`advanced` variants keyed to the sensitivity axis (docs/02 §5).

6. **"Calm, not gamified" is evidence-based: forgive missed days, reward showing-up over time.** Lally et al. (2010) — n=96, _European Journal of Social Psychology_ — found automaticity plateaued at **~66 days on average (range 18–254)**, that the "21-day" claim is a myth from Maltz's 1960 _Psycho-Cybernetics_, and most importantly that **a single missed day did not significantly impair habit formation**. In parallel, the streak-design literature (Octalysis Group's Rob Alvarez: a streak that's "one missed day away from making users quit forever is not a habit mechanic, it's a time bomb"; Duolingo's own Streak Freeze / Weekend Amulet forgiveness mechanics) shows rigid daily counters trigger the abstinence-violation effect. Both point the same way: **a forgiving streak, weekly adherence, a heat-map, and white-hat motivation (accomplishment/meaning) over loss-aversion.**

7. **The builder must consume docs/02 deterministically and render its outputs in context — that integration _is_ the moat.** Sequencing fills `routine_steps.step_order`; the engine's resolutions place steps (`separate_am_pm` → opposite AM/PM routines; `alternate_nights` → different `cycling_night`; `buffer` → an instruction/wait); the scheduler computes the cycle and the "next acid night." The PM auto-resolution banner, the AM buffer hint, and the Shelf "paired" badge are these outputs surfaced where the user already is — zero extra effort, the conflict already handled and explained.

8. **The competitive set proves sequencing and one-shot AI generation are table stakes — and that "AI-built" is a liability vector.** SkinSort's Routine Creator lets you add products you own, **sequences them into AM/PM order and flags clashes**, and shares via link — explicitly "not the right tool if you want a personalised routine designed from scratch by an algorithm that knows your skin." HadaBuddy scans your shelf and **AI-builds a 7-day routine with skin-profile-aware conflict detection** ($29.99/yr). Neither combines a _living, cycling-aware, conflict-resolved, ramp-scheduled_ plan with a calm daily habit loop and compounding personal data — and the "AI-built" approach carries exactly the explainability/hallucination/liability problem docs/02 §4 warns against.

9. **The routine is fully user-editable, and every edit re-runs detection and reschedules — while preserving the user's overrides.** Add / remove / reorder / swap / change-frequency / pause / "use together anyway." Each edit re-invokes `detect_conflicts` and the cycle scheduler, then upserts `routine_conflicts` **idempotently so prior `user_choice`/`status` survive** (docs/02 §4.6). The spec's p13 buttons ("Keep alternate nights" / "Use together anyway") write that choice; the plan reflects it and the app does **not** re-nag on every open.

10. **Adaptation over time must stay conservative, explainable, and claim-safe.** The plan should evolve — ramp-up progression, folding in newly-added products, de-escalating on self-reported irritation (docs/02 matrix row #15), optional seasonal/climate adjustments (SkinSort offers this) — but every adaptation is optional, reversible, non-diagnostic, and worded within the FDA cosmetic-claims boundary (docs/02 §9). No "treats," no "stimulates collagen"; "may help reduce the appearance of," "supports the barrier."

---

## Details

### 1. What the routine builder is — and is not (scope & philosophy)

**It is the layer that _assembles, sequences, schedules, renders, edits, and adapts_ the user's daily plan.** Concretely, it:

- generates a first AM/PM (+ cycling) plan from the skin profile, goals, and owned products at the reveal ("See my routine", spec p6);
- orders steps within each routine using the application-order rules (§3);
- assigns each active a frequency and, where relevant, a cycling night and a ramp-up schedule (§4–§5);
- applies docs/02's conflict resolutions by _placing_ steps (separate AM/PM, alternate nights) or _annotating_ them (buffer/wait), and renders the consequences (§5, §9);
- presents the Today habit loop and records check-offs (§6);
- lets the user edit everything and recomputes safely (§7);
- adapts the plan over time, conservatively (§8).

**It is _not_** any of the following, and these boundaries are load-bearing:

- It does **not own or invent conflict/safety rules** — docs/02 does. The builder is a _consumer_ of `conflict_rules` and `detect_conflicts`; it never hard-codes an interaction.
- It does **not diagnose, treat, or make drug claims.** It arranges cosmetic products and explains its reasoning in cosmetic language (docs/02 §9). Anything that smells like a medical claim or a contraindication is routed through docs/02's `safety` path and the not-medical-advice disclaimer.
- It is **not a black-box generator.** Every decision the builder makes — why this step is here, in this order, at this frequency, on this night — is traceable to a named rule, the user's profile, or the user's own edit. This is the docs/00 §3 / docs/02 §1 stance: explainable and auditable beats opaque, especially when a wrong output is a liability.

**Medical-adjacency and the review gate.** Sequencing is low-risk (mostly cosmetic optimisation), but **frequency, the retinoid ramp, and any pregnancy/irritation interaction are medical-adjacent**, so the rules that drive them fall under the same discipline as docs/02's matrix: graded, versioned, and **signed off by the board-certified dermatologist + cosmetic chemist before launch** (docs/02 §9, **BLOCKER B-DERM-REVIEW**). This document proposes those rules as _starting positions for that review_, not settled facts.

### 2. Inputs & the generation pipeline (profile + shelf + engine → plan)

**Inputs (all already defined upstream):**

- `skin_profiles` (docs/01 §3): the four Baumann-style axes, especially `sensitive_resistant`; `sensitivities text[]`; `pregnancy_status`; `goals text[]`.
- `user_products` (docs/01 §3) joined to docs/02's `product_ingredients` → `ingredient_tags` so each owned product resolves to **functional tags** (`retinoid`, `aha`, `vitamin_c`, `niacinamide`, …) and a **concentration band**.
- docs/02's **engine**: `conflict_rules` (the matrix) + the `detect_conflicts(uid)` function + the resolution verbs (`separate_am_pm`, `alternate_nights`, `buffer`, `lower_frequency`, `no_change`, `reassure`, `avoid_refer`).
- docs/02's **scheduler** (§5): the Bowe cycle definition + `cycling_night` mapping + the next-acid-night computation.
- docs/02's **freshness truth table** (§6): provenance-bearing `expiry_computed` state for replenishment awareness. Actionable printed dates are exact physical-package entries/reconfirmations only; product-catalog expiry dates and the retained legacy-unverified quarantine are not routine or recommendation inputs. Category estimates remain disabled and non-actionable until an exact server-attested marker retained locally plus named review exists; migration `0060` purges, force-RLS seals, and permanently blocks repopulation of the legacy `ingredient_pao_defaults` relation, so it is not an input.

**The generation pipeline (deterministic, ordered):**

1. **Classify** each owned product by role/category (`cleanser`, `toner`, `antioxidant/vitamin_c`, `treatment/retinoid`, `exfoliant/acid`, `moisturiser`, `oil`, `spf`) from `products.category` + tags.
2. **Allocate AM vs PM.** Defaults from consensus: antioxidants (vitamin C) and SPF → AM; retinoids and exfoliating acids → PM; cleanser and moisturiser → both; niacinamide/hydrating serums → either. `separate_am_pm` resolutions (e.g. benzoyl peroxide vs simple retinol) force the split.
3. **Sequence within each routine** using the §3 priority rules → write `routine_steps.step_order`.
4. **Assign frequency & cycling** (§4–§5): daily vs `skin-cycling` vs `every_n_days`; set `cycling_night` for actives; initialise the retinoid ramp.
5. **Run detection & apply resolutions:** call `detect_conflicts(uid)`; for each result, _place_ (AM/PM or alternate nights) or _annotate_ (buffer/wait via `routine_steps.instructions`); reflect `safety` suppressions (remove + offer alternative + disclaimer).
6. **Persist:** write `routines` (AM, PM, and a cycling definition) + `routine_steps`; materialise `routine_conflicts` (docs/02) preserving any prior user choices.
7. **Render** the reveal summary and the first Today view.

**The "See my routine" moment (spec p6 → p8/p9).** At the reveal, the profile is known and the shelf may be sparse (onboarding step 6 is "current products: scan / search / **skip**"). The builder generates the best plan it can from what's owned, and where a role is missing it shows a calm, claim-safe gap note ("A daily SPF would round this out") rather than fabricating a product. The shared-element transition (docs/01 §8) carries the reveal card into the plan.

**Worked example — Maya (used throughout, per the spec).** Dry + sensitive; owns **Vitamin C serum**, **Retinol 0.3%**, **Glycolic 7% toner**, **Ceramide moisturiser**, **Mineral SPF 50**.

- **AM:** Cream cleanser → Vitamin C serum → Ceramide moisturiser → Mineral SPF 50 (thin-to-thick; antioxidant + SPF is a positive AM pairing, docs/02 matrix #10). This is exactly the spec's AM card (p8).
- **PM (skin cycling):** Night 1 _Exfoliate_ (Glycolic 7%) · Night 2 _Retinoid_ (Retinol 0.3%) · Nights 3–4 _Recover_ (cleanse + ceramide). On retinoid nights, the **glycolic is auto-suppressed** because retinoid × AHA is an `irritation` conflict resolved `alternate_nights`, and the next acid night is computed and named — the spec's p9 banner. Sensitivity bumps the retinoid × glycolic conflict to **Moderate** (docs/02 §4.2), and the reveal's advice ("a low-strength retinoid two nights a week, no daily acids, ceramides every day," p6) is the ramp default for sensitive skin.

### 3. Application-order sequencing engine (the science + the rules)

**The validated science (grade C, consensus + mechanism).** Dermatologists converge on a single canonical order driven by three rules — thinnest-to-thickest, lowest-pH-first, water-before-oil — because actives must penetrate the stratum corneum before occlusive layers seal the surface (AAD public guidance; Mona Gohara MD, Yale; Nazanin Saedi MD; Marisa Garshick MD). Canonical sequences:

| Routine | Order                                                                                                                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AM**  | cleanser (optional for normal/dry) → toner/essence (optional) → **antioxidant / vitamin C serum** → other water-based serums (thin→thick) → eye cream (optional) → moisturiser → **SPF (always last)**                                    |
| **PM**  | cleanser (double-cleanse if heavy makeup/SPF) → toner/essence (optional) → **treatment / retinoid** (or hydrating/soothing serum _before_ an active for buffering) → eye cream (optional) → moisturiser → face oil / occlusive (optional) |

**Honesty flags.** The _order matters for penetration_ direction is consensus, but the popular _"up to 40% less absorption if you layer wrong"_ magnitude is vendor-sourced (commercial blogs citing one 2020 paper) and should not be stated as fact in-app. Between-layer **waiting** is mostly about preventing _pilling_ and tempering irritation, **not** strict pH-neutralisation timing: a few seconds to ~1 minute generally (the spec's "Wait ~1 min after serum," p8), and ~20 minutes on dry skin before a retinoid for irritation control (consensus among the ramp-up sources). The older "wait 30 minutes between every step" advice is overblown; encode waits as **microcopy/instructions**, not hard gates.

**The sequencing rules — a versioned table, not hard-coded logic.** To stay consistent with docs/02's "rules are data" philosophy and to make the ordering reviewable, store an ordered priority by role/tag with AM/PM eligibility and notes:

```sql
create table public.sequencing_rules (
  id            uuid primary key default gen_random_uuid(),
  role          text not null,        -- 'cleanser','toner','antioxidant','treatment',
                                       --   'exfoliant','hydrating_serum','eye','moisturiser','oil','spf'
  base_priority int  not null,        -- lower = applied earlier (cleanser=10 ... spf=100)
  am_eligible   boolean not null default true,
  pm_eligible   boolean not null default true,
  default_phase text,                 -- 'am' | 'pm' | 'either'  (soft default; resolutions can override)
  notes         text,                 -- claim-safe microcopy seed ('apply to dry skin','last step, AM only')
  rule_version  int  not null default 1,
  reviewed_by   text,
  is_active     boolean not null default true,
  unique (role, rule_version)
);
-- Review authority, not a client catalog surface. Migration 0058 revokes direct
-- SELECT from PUBLIC, anon, authenticated, and service_role. Bundled mirrors
-- retain review metadata and production-filter identically.
```

**Sequencing algorithm.** First select only active rules carrying the exact qualified-review metadata accepted by the production gate. For a given phase (AM/PM), collect the user's owned products, map each to a reviewed `role`, sort by reviewed `base_priority`, then apply only reviewed resolution overrides. When no reviewed sequencing rule is available, automatic AM/PM placement and rule-derived instructions are withheld: the product remains on the Shelf but stays out of the generated routine, Today checklist, and cycle projection. The current editor can reorder only already-generated reviewed steps; it does **not** provide manual add-to-AM/PM placement, so no current copy may promise that recovery path. A future manual-placement flow needs its own implementation and human E2E before this contract changes. Development may expose the starter set only behind an explicit non-production mode or the explicit closed-gate E2E fixture. Reordering is **non-destructive** and re-checkable (§7).

### 4. Frequency & the retinoid ramp-up scheduler

**The validated science (grade C, but very consistent consensus).** "Start low and slow" is essentially undisputed: low-strength retinoid ~2 nights/week initially, escalating over 1–2 months as tolerated toward every-other-night then nightly; PM-only; pea-sized; on dry skin; buffered for sensitive skin; consistency over frequency; skin type modulates the start (dry/sensitive lower). Two cross-links to docs/02: Hadley King's guidance to **not stack a retinoid with AHAs/vitamin C while ramping** (the engine already enforces this via `alternate_nights`/`separate_am_pm`), and **stop retinoids in pregnancy/breastfeeding** (the `safety` class, docs/02 §4.8).

**The frequency model (extends docs/01 `routine_steps`).** `routine_steps.frequency` already supports `daily | skin-cycling | every_n_days`, and `cycling_night` already encodes 1=exfoliation / 2=retinoid / 3–4=recovery (docs/01 §3) — **no change needed there**. What's new is making the _ramp_ a first-class, per-user, recomputable object so the builder can progress it and surface gentle step-up prompts:

```sql
create table public.active_ramp (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  user_product_id uuid not null references public.user_products(id) on delete cascade,
  ramp_class      text not null,                 -- 'retinoid' | 'aha' | 'bha' | 'other_active'
  freq_per_week   int  not null,                 -- current scheduled nights/week
  target_per_week int  not null,                 -- e.g. 3–4 for tolerated nightly-ish use
  started_at      date not null default current_date,
  last_step_up    date,
  next_review_at  date,                           -- when to *offer* (never force) a step-up
  tolerance_state text not null default 'building', -- 'building' | 'steady' | 'paused_irritation'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.active_ramp (user_id);
-- Per-user, owner-only RLS exactly per docs/01 §3 (subselect auth.uid(), TO authenticated, WITH CHECK).
```

**Ramp behaviour.**

- **Initialise** on first generation: sensitive / "barrier repair" → `freq_per_week = 2`, `target = 3`; resistant/oily tolerant → `freq_per_week = 3`, `target = 4–7`. (Final numbers are a **B-DERM-REVIEW** item.)
- **Step up only on a positive signal and only as an _offer_:** after ~2–4 weeks at the current cadence with no reported irritation, surface a calm prompt ("You've been steady at 2 nights a week for three weeks — want to try a third?"). Never silently escalate; the user confirms.
- **De-escalate automatically on irritation:** a self-reported "my skin feels irritated" (or matrix row #15, compromised barrier) sets `tolerance_state = 'paused_irritation'`, drops frequency, and inserts recovery nights — claim-safe, non-diagnostic.
- **Respect the conflict engine:** the scheduled nights are always reconciled with `alternate_nights` resolutions so a ramp step-up never silently re-collides the retinoid with an acid.

**Tolerance feedback (lightweight, optional).** A single, dismissible end-of-week prompt — "How did your skin feel this week?" (Comfortable / A bit dry / Irritated) — feeds `tolerance_state`. This is the _only_ "assessment" the builder asks for, it's optional, and it never diagnoses; it just tunes cadence conservatively.

### 5. The skin-cycling-aware daily plan (consuming docs/02 §5)

**Reaffirm the framework (no schema change).** Bowe's classic cycle (Night 1 Exfoliate → Night 2 Retinoid → Nights 3–4 Recover, repeat) maps onto `routine_steps.cycling_night` exactly as docs/01 §3 and docs/02 §5 define. The builder picks a variant by sensitivity:

- **Sensitive / "barrier repair" (Maya):** a gentle 5–6-night cycle with extra recovery nights, retinoid ~2×/week — matching the reveal advice (p6) and the ramp default (§4).
- **Resistant / oily, tolerant:** the classic 4-night, or `advanced` (fewer recovery nights).
- **No actives owned:** no cycling — a simple daily AM/PM.

**How conflicts fold in (the moat, rendered).** The scheduler reads the engine's `alternate_nights` resolutions and _places_ the clashing actives on different nights; the builder then renders the consequence in the daily view. The spec's PM banner is precisely this computation: tonight is retinoid night (cycling night 2) → glycolic (an AHA) `alternate_nights`-conflicts with the retinoid → **suppress glycolic tonight** → compute and name the **next acid night** ("Saturday"). This is the single highest-value, most-demoable screen in the product: the conflict is _already resolved and explained in place_, with zero user effort (docs/02 §5).

**Next-acid-night computation.** Given the cycle definition (ordered nights + an anchor date) and today's local date, project forward to the next night whose slot is `exfoliation`; render as a friendly weekday. **Local-day aware** per DECISIONS.md **D-012** (the timezone-tolerant completion window); recompute on edits and on date rollover.

**Calm, not gamified (spec cover).** The night strip (Exfoliate · Retinoid · Recover · Recover) tints only _tonight_ with the clay accent (the spec's p9 strip); there are no points, badges, or pressure on the cycle itself. Recovery nights are framed as doing-the-right-thing, not as "off" days. (Streaks live in the habit loop, §6, and are themselves calm.)

### 6. The Today habit loop (the daily experience, check-off & the behavioural science)

**The loop.** Cue (a gentle reminder at the user's chosen time) → routine (do the steps, check each off) → reward (calm acknowledgement; a streak/adherence that celebrates showing-up). This is the engine of the activation metric (docs/01 §7) and the daily retention surface.

**Check-off mechanics (extends docs/01 §3/§6, hardened by the DECISIONS log).**

- A tap on a step writes a `routine_completions` row — **append-only**, idempotent on `(user_id, step_id, completed_date)` (docs/01 §3). Record both `completed_at` (when logged) and `completed_date` (the local day it counts for).
- **Offline-first:** completions must succeed in a bathroom with no signal — TanStack Query optimistic update + a persisted mutation queue (docs/01 §6, **D-007**); last-write-wins is safe because completions are idempotent.
- **Streak integrity:** offline backfill is capped to ~48h server-side and flagged `source='backfilled'` (docs/01 §6); the completion validation window is the timezone-tolerant `[current_date − 2, current_date + 1]` (**D-012**); INSERTs prove routine/step ownership via `owns_routine` (**D-014**).
- **Streaks are computed/authoritative, cached on `profiles`** (docs/01 §3), with `longest_streak` a **non-decreasing personal best** (**D-011**) so a deleted completion never shrinks the badge.

**Calm, not gamified — the design, and why (the evidence).** Lally et al. (2010) show habits take ~66 days (range 18–254), that "21 days" is a myth, and — decisively — that **missing a single day does not meaningfully impair habit formation**; the streak-design literature shows rigid daily counters trigger the abstinence-violation effect and rage-quitting (Octalysis Group; Duolingo's own Streak Freeze / Weekend Amulet exist precisely to soften this). For a **skin-cycling** app the all-or-nothing daily streak is actively wrong, because recovery nights and the occasional missed evening are _expected and healthy_. Concretely:

- **A forgiving streak.** Define a "completion day" as _did your scheduled routine for today_ — and **recovery nights count**. Build in **grace days / a streak freeze** so one missed day doesn't reset to zero (the abstinence-violation fix). Never use shame copy ("You broke your streak!"); a missed day is acknowledged neutrally and the user is invited back.
- **Weekly adherence + a heat-map**, not just a number. Show "5 of 7 nights this week" and a calm calendar heat-map of the month — a framing that rewards consistency-over-time (the thing Lally found matters) rather than perfection.
- **White-hat motivation** (accomplishment, progress, meaning — tying check-offs to the visible photo progress of doc-#10) over loss-aversion. Milestones (where used) unlock genuinely meaningful things (e.g. a progress-photo comparison), not bigger numbers.
- **A sub-one-minute check-off** and **gentle, opt-in nudges** (never the aggressive notification cadence the streak-backfire literature warns about; honour `notification_preferences`, §10).

### 7. Editing, overrides & recompute

**The user edits everything; the builder recomputes safely.** Supported edits: add a step / product, remove a step, **reorder** steps, **swap** a product, change a step's **frequency**, set/adjust a **cycling night**, **pause** an active, and **override a conflict** ("use together anyway", spec p13).

**Recompute contract.** Every edit re-invokes `detect_conflicts(uid)` and the cycle scheduler, then **upserts `routine_conflicts` idempotently by rule plus canonical unordered product pair so the user's prior `status`/`user_choice` survive** (docs/02 §4.6). A choice applies only to the exact current rule version; changed guidance becomes unresolved again instead of silently inheriting an older decision.

**V1 application-order persistence.** Morning and evening application-order edits are stored locally as separate, versioned arrays of stable shelf-product IDs in the encrypted private KV. The saved value is an ordering preference only: it is intersected with each newly generated phase, cannot restore a safety/cadence-excluded product, cannot move a product between AM and PM, and never changes the canonical cycle-night assignment. Surviving IDs keep the user's relative order, new products enter deterministically beside canonical neighbours, and removed/replenished shelf-unit IDs are pruned on the next save. A temporarily excluded active keeps its stored position for a later eligible plan. Save is acknowledged only after the private write succeeds; examples are never persisted. The record is included in current-device export and registered account cleanup. Cross-device routine sync remains deferred under `B-ROUTINE-PERSIST`.

**The p13 decision surface (docs/02 §7, rendered by the builder).** "Keep alternate nights" (or the resolution-appropriate "Keep suggested timing") writes `user_choice='accept_suggested_timing'`, `status='accepted'`; "Use together anyway" writes `user_choice='use_together'`, `status='overridden'`. Legacy `keep_alternate_nights` values migrate to the generic accepted choice. Both choices suppress repeat advisory prompts for that exact pair/current rule version across Shelf, Plan, Recommendations, and Ask. V1 does **not** silently co-locate potent actives after `use_together`: Today and the cycle keep one potent active per night and never place a retinoid with an exfoliant until a named clinical and cosmetic-chemistry review approves a pair-specific co-use rule. Product detail and Why Tonight explain this boundary. Local encrypted persistence succeeds before analytics/navigation; a failed write leaves the prior schedule and prompt state unchanged.

**Reordering and the sequencing rules.** For already-generated reviewed steps, if a user moves moisturiser above their vitamin C serum, the builder gives a **gentle, non-blocking** nudge and lets them keep their order if they insist. This editor never adds a review-withheld product to either phase. Cosmetic sequencing is guidance once reviewed; missing review authority is a publication gate. Safety (`safety`/`avoid_refer`), pregnancy exclusion, unreviewed cadence, and unreviewed sequencing remain firm and cannot be restored by an ordering or conflict-choice preference.

### 8. Adaptation over time (claim-safe, conservative)

The plan is **living**, but every change is optional, reversible, explainable, and within the cosmetic-claims boundary (docs/02 §9):

- **Ramp progression** (§4): retinoid frequency step-ups, always offered and confirmed, never silent.
- **New product folded in:** adding a product to the shelf re-runs the pipeline (classify → sequence → detect → schedule) and shows what changed and why.
- **Barrier-signal de-escalation:** a self-reported irritation (or matrix row #15) pauses/lowers actives and adds recovery nights.
- **Replenishment & expiry awareness** (docs/02 §6): when `expiry_computed` nears, a calm "time to replace" nudge (and, later, doc-#7's replenishment flow) — never alarmist.
- **Optional seasonal/climate tuning:** SkinSort exposes climate/location on routines; OnSkin can offer the same as an _optional_ adjustment (e.g. richer moisturiser in winter), claim-safe and off by default.

No adaptation ever diagnoses, promises an outcome, or uses drug-claim language; the standing not-medical-advice line (docs/02 §9) is attached wherever the plan changes for a skin-health reason.

### 9. UI / UX specification (every routine surface — look, feel, and behaviour)

The design language is fixed by the spec and docs/00 §8 / **D-005**: **Instrument Serif** for editorial moments, **Hanken Grotesk** for UI, a **monospace** face for labels/counters ("2 of 4", "NEXT", "SKIN CYCLING · NIGHT 2 OF 4"); palette **paper · greige · clay · ink · night**; **light mode** for AM/shelf, **dark ("night")** for the PM/evening screens; privacy and reassurance treated as brand voice; **calm, not gamified**.

**9.1 Reveal → "See my routine" (spec p6).** The dark reveal shows the four axis sliders and a claim-safe summary ("Your barrier wants gentleness: a low-strength retinoid two nights a week, no daily acids, ceramides every day"). The **paper-coloured "See my routine" CTA** hands off into the first Today view via a shared-element transition (docs/01 §8). This is the seam between docs/01's onboarding and this document's plan.

**9.2 Today — AM (spec p8, light).**

- **Header:** mono caps date ("THURSDAY, JUNE 12") + a calm **streak pill** ("12 days") with a small clay dot — _not_ a loud counter.
- **Serif greeting:** "Good morning, Maya."
- **Routine card** titled "Morning routine" with a mono **"2 of 4"** progress counter.
- **Step rows:** a leading **check circle** (filled clay + strikethrough text when done — the spec's checked "Cream cleanser", "Vitamin C serum"); the **next** incomplete step carries a mono **"NEXT"** affordance and a buffer/usage microcopy line ("Wait ~1 min after serum"); usage cues like "Two-finger amount, every day" (SPF). Tapping toggles completion with a **selection haptic** (docs/01 §8).
- **The dark "Tonight" preview card** at the bottom ("Tonight · Cycling night 2 / Retinoid night — keep it simple") with a moon glyph and chevron — a one-tap jump to the PM plan.

**9.3 Today — PM (spec p9, dark "night").**

- Mono "THURSDAY · 9:41 PM"; serif "Good evening."
- **The skin-cycling strip:** "SKIN CYCLING · NIGHT 2 OF 4" over a four-segment progress rail labelled **Exfoliate · Retinoid · Recover · Recover**, with **only tonight's segment clay-filled**.
- **Routine card** "Evening routine · 0 of 3": Cream cleanser ("Dry skin fully before the retinoid", NEXT) → Retinol 0.3% ("Pea-sized · avoid eye area") → Ceramide moisturiser ("Generous layer tonight").
- **The auto-resolution banner** (clay dot): "Your glycolic toner is skipped tonight — it doesn't mix well with retinol. Next acid night: Saturday." This is the §5 computation rendered.
- **Bottom tab bar:** Today (active, clay dot) · Progress · Shelf · You.

**9.4 Step-row anatomy & check-off.** Each row = check control + product name (serif/grotesk) + a single claim-safe instruction line + optional badge (NEXT / amount). Completion: tap → optimistic clay fill + strikethrough + selection haptic; completing the **last** step fires a single **success notification haptic** and a calm "Morning done" acknowledgement (docs/01 §8). **Reduce-Motion** swaps any transition for a fade; **VoiceOver** focus moves to the routine heading on screen entry and announces "step 3 of 4, completed".

**9.5 Streak / adherence surfaces (calm).** A weekly "5 of 7 nights" line and a monthly **heat-map** calendar; a forgiving streak with a visible **grace/freeze** state ("Streak protected"); recovery nights rendered as fulfilled, not skipped. No leaderboards, no loss-aversion countdowns, no "don't lose your streak!" pressure (the streak-backfire evidence, §6).

**9.6 Editing affordances.** Long-press / edit-mode on a step for reorder (drag handle), swap, frequency, pause; the p13 conflict sheet for overrides. Edits animate calmly and trigger the §7 recompute; any sequencing nudge is a dismissible, non-blocking toast.

**9.7 Microcopy voice.** Calm, plain, claim-safe, second-person, privacy-forward. "Recommendation, not a rule" (p13). Never "treats/cures/guarantees"; prefer "may help reduce the appearance of", "supports your barrier", "keep it simple tonight". Mono for labels; serif for emotional beats.

**9.8 Accessibility & localisation.** Dynamic Type reflow (no fixed-height text containers); 44pt minimum targets; correct VoiceOver order; Reduce-Motion fallbacks; **dark-mode variants for every PM surface**; externalised strings with ~30% expansion headroom and RTL mirroring (docs/01 §8).

**9.9 Widgets & Live Activity (spec p14 names these as natural next screens).** A home-screen widget for "tonight's step / next up" and an optional **Live Activity** for the evening routine ("Retinoid night — 1 of 3"), driven by the same plan and honouring `notification_preferences`. Platform-gated (iOS Live Activity / WidgetKit; Android equivalents) and to be re-verified at build (docs/00 §6).

### 10. Notifications & reminders

- **AM/PM reminders** at `notification_preferences.am_reminder_time` / `pm_reminder_time`; "tonight's step" surfaced via the widget/Live Activity.
- **Gentle, opt-in streak nudges** only — never the aggressive, guilt-driven cadence the streak-backfire literature warns against; `streak_nudges` is user-controlled, calm, and respects quiet hours.
- **Replenishment alerts** from PAO/expiry (`replenishment_alerts`, docs/02 §6).
- **Permission-priming:** a soft in-app explainer before the OS prompt, fired at the value moment, not at launch (docs/01 §8).

### 11. Engineering / implementation notes

- **Where generation runs.** A future authoritative server-side function must consume only evidence-authorized rule projections and remain hardened with `REVOKE … FROM public, anon, authenticated` per **D-013**. The offline client mirror retains review metadata and applies the same production filter; it must not treat bundled availability as publication authority. The small rule sets may ship in the binary only with this fail-closed gate.
- **New schema introduced here:** `sequencing_rules` is a read-sealed clinical/content authority, and `active_ramp` is per-user and owner-only. Migration `0058` supersedes the former world-readable classification. No change to `routines` / `routine_steps` / `routine_completions` — they already carry `step_order`, `frequency`, `cycling_night`, `instructions`, and the append-only completion log.
- **Suggested DECISIONS.md entries:** **D-019** — application-order encoded as a versioned `sequencing_rules` table, not hard-coded; **D-020** — the retinoid ramp modelled as a per-user `active_ramp` with offer-only step-ups and auto de-escalation on reported irritation; **D-021** — streak is _forgiving_ (grace/freeze, recovery nights count, weekly-adherence + heat-map framing) on the Lally + streak-backfire evidence. Anything touching the _medical defensibility_ of sequencing/ramp/cycling rules belongs in **BLOCKERS.md** under **B-DERM-REVIEW** (which now covers these rules in addition to docs/02's matrix).
- **PostHog instrumentation** (extends docs/01 §7): `first_routine_created` and `first_checkoff_completed` already exist; add `routine_edited`, `step_reordered`, `conflict_overridden`, `ramp_step_up_offered` / `_accepted`, `cycle_night_completed`, `streak_freeze_used`. Wire the activation funnel (reveal → see-routine → first check-off) and the depth metric (3 check-offs in 7 days).
- **Performance & correctness:** index `active_ramp(user_id)` and `routine_conflicts(user_id)`; keep generation idempotent (re-running `build_routine` over an unchanged shelf yields the same plan and preserves overrides); recompute the cycle on local-day rollover (D-012).

---

## Seven-Figure Validation (the routine builder & the money)

The routine builder is the layer where willingness-to-pay and retention are actually produced:

- **It owns the north-star activation metric.** docs/01 §7 defines activation as the first check-off within 24h; the routine builder _is_ the path to that check-off. Activation predicts retention, and retention is the subscription business — so the builder sets the retention ceiling.
- **It powers the paywall's #1 value prop and its best demo.** The paywall (spec p7) leads with "Routine intelligence — order, timing, skin cycling"; the PM auto-resolution screen (§5) is the single most demoable moment in the product — a conflict resolved and explained before the user lifts a finger.
- **It is the compounding switching cost.** Your plan, your cycle, your ramp progress, and your append-only completion history accumulate into data lock-in; annual plans retain far better than monthly in this category (RevenueCat: ~44% one-year retention on annual vs ~17% monthly, docs/01 §9), which is why the builder's outputs feed an annual-default paywall.
- **It rides durable, dermatologist-endorsed demand and the 2026 market mood.** Skin cycling has ~3.5B TikTok views and persists _because_ it's dermatologist-originated; the broader 2026 shift is explicitly toward **trust, longevity, and scientific credibility** ("Prestige has an opportunity to reclaim authority through scientific validation, dermatologist partnerships, and proven long-term results," Cosmetics Business; Beauty Independent's "longevity / healthy resilient skin long-term"). That is OnSkin's exact lane. The global skincare market was ~**$169.9bn in 2025** (Euromonitor), with mass skincare growing fastest.
- **It is precisely what the commodity scanners structurally lack.** Yuka (per its own 2024 accounts: **$7.3M revenue, 98.1% from subscriptions, ~15 staff, zero marketing**, docs/01 §9) and EWG have **no routine and no skin profile** — HadaBuddy's own competitive write-ups make this the central critique ("Yuka doesn't know your routine"). The routine builder is the feature that converts a scanner into a daily companion.

**Verdict: yes — this is the retention-and-activation spine of a seven-figure product.** The risk is not demand; it is execution — specifically, getting the **habit psychology** right (a forgiving, calm streak, not a punitive one) and the **scheduling** right (correct sequencing, ramp, and conflict resolution). Both are addressable, and this document is built around them.

---

## Synthesis

**(a) What the builder is:** a deterministic, explainable generator that turns the skin profile + shelf + docs/02's engine into a living AM/PM (+ cycling) plan and a daily habit loop — not an AI that "designs a routine."

**(b) Generation pipeline:** classify → allocate AM/PM → sequence → assign frequency/cycling + initialise ramp → run `detect_conflicts` and apply resolutions → persist `routines`/`routine_steps` + materialise `routine_conflicts` → render. The "See my routine" reveal is the first run.

**(c) Sequencing:** thinnest-to-thickest, low-pH-first, water-before-oil → the canonical AM/PM orders, encoded as a versioned `sequencing_rules` table; buffering for sensitive skin; waits as microcopy, not gates; the "40% absorption" claim flagged vendor-sourced.

**(d) Frequency & ramp:** "start low and slow" modelled as a per-user `active_ramp` with offer-only step-ups and automatic de-escalation on reported irritation; reconciled with the conflict engine; pregnancy → docs/02's safety path.

**(e) Skin cycling:** Bowe's framework as the active-scheduling spine, personalised by sensitivity (gentle/classic/advanced), with conflicts folded in via `alternate_nights` and the next-acid-night computation rendered in the PM banner.

**(f) The habit loop:** check-off → append-only `routine_completions` (offline-first, 48h backfill cap, computed/cached streaks per D-011/D-012/D-014); **calm, not gamified** — a forgiving streak, weekly adherence + heat-map, white-hat motivation — justified by Lally (2010) and the streak-backfire literature.

**(g) Editing & adaptation:** everything is user-editable; every edit re-runs detection + rescheduling while preserving overrides; adaptation (ramp, new products, irritation de-escalation, seasonal) is conservative, reversible, and claim-safe.

**(h) Confidence & composition:** application-order, ramp, and cycling are grade-C/consensus and medical-adjacent, so they fall under **B-DERM-REVIEW** alongside docs/02's matrix; the builder composes on top of docs/00 (stack, notifications/widgets), docs/01 (schema, offline, activation, look/feel), and docs/02 (engine, scheduler, PAO), and it feeds the progress/streaks work (doc #7) and the photo timeline (doc #10).

---

## Recommendations

1. **Build the deterministic generator, not an AI router.** Generate from curated, versioned, reviewable rules; reserve any ML for non-safety ranking far downstream (docs/00 §3, docs/02 §4).
2. **Encode application-order, frequency, and cycling as graded, versioned rules under `B-DERM-REVIEW`.** Sequencing is low-risk; the **ramp and any pregnancy/irritation logic are medical-adjacent** and must be signed off with docs/02's matrix.
3. **Render docs/02's resolutions in context, and invest in the PM auto-resolution screen (§5/§9.3)** — it is the highest-value, most-demoable moment in the product.
4. **Ship the calm habit loop on the evidence:** a forgiving streak (grace/freeze, recovery nights count), weekly adherence + a heat-map, no shame copy, white-hat motivation — per Lally (2010) and the streak-backfire literature. This is **D-021**.
5. **Make the activation metric the design target.** Tune every default to shorten time-to-first-check-off; instrument the reveal → see-routine → first-check-off funnel in PostHog from day one.
6. **Model the retinoid ramp as schedulable state (`active_ramp`),** with offer-only step-ups and automatic de-escalation on reported irritation; never silently escalate an active.
7. **Preserve user overrides forever** via idempotent `routine_conflicts` upserts; "Use together anyway" must stick and the app must not re-nag.
8. **Keep adaptation conservative and claim-safe** (docs/02 §9): optional, reversible, non-diagnostic, no drug-claim language; attach the not-medical-advice line wherever the plan changes for a skin-health reason.
9. **Run generation server-side (authoritative) with a cached client mirror for offline,** hardened per **D-013**; keep the whole thing idempotent and local-day aware (D-012).
10. **Position it as "living routine intelligence," not "a routine list."** The pitch is a personalised, evidence-graded, conflict-resolved, cycling-aware plan that adapts and compounds — explicitly differentiated from "sequence the products you added" (SkinSort) and "AI-built 7-day routine" (HadaBuddy).

---

## Caveats (confidence flags)

- **Application order is dermatological consensus but mechanistic, grade-C evidence;** the popular "up to 40% reduced absorption" magnitude is vendor-sourced (commercial blogs citing one 2020 paper). _High confidence on the convention (thin-to-thick, low-pH-first, water-before-oil); low confidence on any quantified benefit — do not state the percentage in-app._
- **The retinoid ramp-up is highly consistent consensus, but still grade C;** the exact starting cadence and step-up timing are starting positions for the dermatologist/cosmetic-chemist review, not settled facts. _Medium-high confidence on "start low and slow"; medium on specific numbers — re-grade at B-DERM-REVIEW._
- **Skin cycling is a dermatologist-developed framework, not an RCT-validated protocol;** frame and personalise it honestly and do not claim clinical superiority. _Medium-high confidence on provenance, rationale, and durable demand; low confidence in any "clinically proven outcome" claim._
- **Lally et al. (2010) is real, frequently-cited research, but n=96, self-reported automaticity, and relatively simple habits;** the ~66-day average, the wide range, and the "missing one day doesn't impair formation" findings are robust enough to _design on_, but do not overclaim "scientifically guaranteed habit formation." _Medium-high confidence on the design implications; the precise 66-day figure is an average with huge variance._
- **The streak-backfire evidence is behavioural-economics reasoning plus industry case studies (Octalysis Group, Duolingo), not RCTs;** the _direction_ (forgive misses, avoid loss-aversion pressure) is well-supported and converges with Lally, but the specific retention magnitudes (e.g. "+14% D14 from a streak wager") are vendor-reported. _Medium-high confidence on the direction; treat magnitudes as directional._
- **Sequencing, ramp, and cycling rules are medical-adjacent and fall under the same launch gate as docs/02's matrix (`B-DERM-REVIEW`);** do not ship safety-relevant scheduling (especially anything touching pregnancy or barrier compromise) without board-certified-dermatologist + cosmetic-chemist sign-off recorded in `reviewed_by`. _High confidence that this gate is required._
- **The competitive set moves fast** — SkinSort sequences and flags, HadaBuddy ships an AI-built routine, and new entrants will appear; the moat is the _integration_ (cycling-aware, conflict-resolved, ramp-scheduled, calm habit loop, data lock-in), not any single capability, and that positioning must be revisited periodically. _Medium confidence._
- **Offline streak/completion correctness has real edge cases** — timezone handling (D-012), backfill-abuse caps, and concurrent multi-device writes (deferred until a sync upgrade, docs/01 §6) — and should be verified on-device. _Medium confidence pending device testing._
- **Adaptation features must stay inside the FDA cosmetic-vs-drug claims boundary** (docs/02 §9); the more the plan "responds to your skin," the more carefully the copy must avoid implying diagnosis or treatment. Regulatory-counsel review of adaptive copy is recommended. _High confidence on the principle; legal review recommended for wording._
- **Widgets and Live Activity have platform constraints** (iOS WidgetKit / Live Activities background limits; Android equivalents) and are named in the spec as _next_ screens (p14); re-verify feasibility and refresh cadence at build time (docs/00 §6). _Medium confidence._
- **Market-size and trend figures are vendor/definition-dependent** (skincare-app vs beauty-tech vs skincare-products; TikTok view counts as a demand proxy); treat the specific numbers as directional. The Yuka financials (its own accounts) remain the most reliable proof point. _Medium confidence on sizing; high on the Yuka reference._
