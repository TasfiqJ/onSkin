# Document 5: The Actives & Skin-Cycling Scheduler — Build Spec

_The temporal engine · the cycle data model & projection algorithm · multi-active orchestration across the week · cadence types & AM/PM allocation · the cycle / schedule-management surfaces · pause, skip, travel & procedure handling · recovery & barrier de-escalation · what-to-remind timing._

> This is build-order document **#5** of the 15 named in docs/00 (§"Build order", item 5: _"Actives/skin-cycling scheduler"_). It is the **temporal engine** that decides, for every active a user owns, **what to apply on which day/night, at what cadence** — and produces the per-day schedule that the Today habit loop (docs/03 §6) renders and checks off. It deliberately **does not re-derive** the things its neighbours already own: **docs/02 §5** introduced the skin-cycling _concept_ (Dr. Whitney Bowe's four-night framework, the `cycling_night` mapping, the next-acid-night sketch, "calm not gamified"), and **docs/03 §4–§5** specified the _retinoid ramp-up_ (`active_ramp`) and the _cycling-aware daily plan and its rendering_ (the PM auto-resolution screen). **This document specifies what those two only referenced**: (a) the **cycle as a stored, versioned data object** plus the **projection algorithm**; (b) **multi-active orchestration** — how a cabinet of many actives is allocated across a week without collision (the combinatorial problem neither covered); (c) **cadence types and AM/PM allocation** beyond cycling; (d) the **cycle/schedule-management surfaces** (the week view, cycle settings, the "why tonight?" explainer, pause/skip/travel); and (e) **disruption and recovery handling**. It consumes docs/02's conflict resolutions and docs/03's ramp, it extends docs/01's schema, it feeds docs/03's daily rendering, and the _delivery_ of any reminder it computes belongs to doc #7.

---

## TL;DR

- **The scheduler is the temporal engine of the whole app — the answer to "what do I actually use tonight?"** Given the user's actives (the Smart Shelf, docs/04), their skin profile, the conflict resolutions (docs/02 `detect_conflicts`), and the ramp (docs/03 `active_ramp`), it decides **what to apply on which day/night at what cadence** and emits the per-day schedule the Today loop renders and checks off (docs/03 §6/§9). docs/02 §5 introduced the cycling _concept_ and docs/03 the _ramp and the daily rendering_; **this document is the engine that produces the schedule**, plus the multi-active orchestration, the management surfaces, and the disruption handling those two referenced but did not specify.

- **It is a deterministic, explainable, constraint-satisfaction scheduler over curated rules — not AI.** This is the same architectural conclusion docs/00 §3 and docs/02–04 reached: every "X is scheduled tonight" must be **traceable** to a named rule, the user's profile, or the user's own edit, because the output must be explainable to a user, auditable to a lawyer, and impossible to hallucinate. The rules that touch frequency, recovery, and contraindication are medical-adjacent and fall under the same **B-DERM-REVIEW** gate as the conflict matrix (docs/02 §9) and the sequencing/ramp rules (docs/03).

- **The hardest problem it solves — and the one nobody does well — is multi-active orchestration.** A real cabinet holds many actives (retinoid, glycolic, salicylic, azelaic, vitamin C, niacinamide, masks…), and the cardinal dermatological rule is **one potent active per night plus supportive ingredients only** (INKEY; reinforced by board-certified derm guidance that "rarely is more than one active needed in a single routine," Doctor Rogers). **Vitamin C goes in the morning, off the night cycle**; exfoliants and retinoids go at night, cycled and **alternated, never the same night**; secondary actives are skipped on retinoid/exfoliation nights. The scheduler allocates all of a user's actives across the week under these constraints — the genuinely combinatorial part of the system.

- **Several scheduling rules are dermatologist consensus (SORT grade C) but harm-relevant, so the scheduler enforces them firmly.** Most consequentially: **never schedule an exfoliant and a retinoid on the same night** — same-night exfoliation with retinol or benzoyl peroxide is described as **"the most common cause of severe at-home chemical burns seen in U.S. clinical practice."** So the scheduler's alternate-nights placement is genuine harm-prevention, not a comfort optimisation. Likewise the **exfoliation-frequency caps** (sensitive skin ~1×/week, normal 2–3×, oily up to 3–4× with BHA — Dr. Lipner; Paula's Choice), the **introduce-one-active-at-a-time** rule (Doctor Rogers), and **recovery nights for barrier repair** (ceramides/HA/niacinamide, clinically supported post-exfoliation).

- **It needs a real cycle data model and projection algorithm that docs/01–03 only gestured at.** Both neighbours reference "the cycle definition (ordered nights + anchor date)" but **neither stores it** — `cycling_night` lives on `routine_steps`, but the cycle itself (length, variant, per-night slot, anchor) is unmodelled. This document defines a stored, versioned **cycle** object and the **projection function** that turns (cycle + anchor + today's local date) into tonight's slot, the week ahead, and the next-of-any-slot (next acid night, next retinoid night) — recomputed on edit, on local-day rollover, and after a pause (DECISIONS **D-012**).

- **It needs schedule-management surfaces neither doc covered.** docs/03 §9 specified the Today AM/PM cards; **this document adds** a **week/cycle overview** (tonight + the nights ahead), **cycle settings** (variant, length, which active on which night, per-active frequency), a **"why is this on tonight?"** explainability surface, and **pause / skip / travel / post-procedure** controls — all calm, all non-gamified (spec cover), all leaving the user in control.

- **It is resilient: it manages breaks instead of punishing them.** Pause for a vacation, illness, or a peel/facial; skip a single night; resume with the cycle re-anchored; and **auto-de-escalate on reported irritation or over-exfoliation** (stop actives, simplify to cleanser + moisturiser + SPF for ~7–10 days, prioritise barrier repair, then re-introduce). A missed night never breaks anything — consistent with the calm, forgiving streak (docs/03 §6) grounded in Lally's finding that a single missed day does not impair habit formation.

- **Seven-figure verdict: the scheduler is king-making because it is the antidote to the #1 problem in modern skincare — decision fatigue.** McKinsey's 2025 State of Fashion & Beauty found **72% of consumers are overwhelmed by the volume of products**, with younger shoppers most fatigued, and the dominant 2026 mood is **"skinimalism" and "skin longevity"** — fewer, smarter, expert-guided, barrier-first routines "you'll actually stick to." The scheduler **operationalises exactly that**: it removes the "what do I use tonight?" decision, reduces a pile of actives to one calm nightly step, protects the barrier, and is the nightly-return habit spine behind retention and data lock-in. It powers the paywall's #1 value prop ("Routine intelligence — order, timing, skin cycling," spec p7). The one real risk is an honest tension: the scheduler must **reduce** load and protect the barrier, never become a complexity or anxiety engine — "no aggressive cycling." That is both a design principle and a caveat.

---

## Key Findings

1. **The scheduler is the temporal engine; it produces the schedule docs/03 renders.** Its job is allocation-in-time: what active, what day/night, what cadence. docs/02 §5 owns the cycling _concept_ and the `cycling_night` mapping; docs/03 §4–§5 owns the _ramp_ (`active_ramp`) and the _daily rendering_ (the PM auto-resolution); this document owns the **cycle data model, the projection algorithm, multi-active orchestration, cadence types, the management surfaces, and disruption/recovery** — the parts they referenced but left unspecified.

2. **Multi-active orchestration is the hard, under-served core, and the rules are consistent dermatological consensus.** **One potent active per night + supportive ingredients only** (INKEY); **vitamin C in the morning, off the night cycle** (Doctor Rogers: "vitamin C in the morning and a retinoid in the evening"); **skip secondary actives (vitamin C, BP) on exfoliation or retinoid nights** (Dot & Key); **introduce actives one at a time** so a reaction is attributable (Doctor Rogers); **≤2 serums per night** (consensus). These are SORT grade C (expert consensus) but highly consistent.

3. **Never schedule a retinoid and an exfoliant on the same night — this is harm-relevant, not cosmetic.** Same-night exfoliation with retinol or benzoyl peroxide is reported as the most common cause of severe at-home chemical burns in U.S. clinical practice. The scheduler's `alternate_nights` placement (driven by docs/02's resolution) therefore does real protective work, and the scheduler enforces the separation firmly (while staying claim-safe — it _separates_, it doesn't "warn of danger").

4. **Exfoliation frequency must be capped and personalised.** Consensus ranges: sensitive/beginner ~**1×/week** (start low, build), normal/combination **2–3×/week**, oily/acne-prone up to **3–4×/week with BHA** (Dr. Lipner recommends a max of once weekly for some; Paula's Choice: "no hard and fast rule," find the cadence by response). BHA can be tolerated more frequently than AHA. The scheduler treats these as conservative, adjustable defaults.

5. **Phased introduction matters — don't start a user on every active at once.** Adding multiple actives simultaneously raises irritation and makes reactions un-attributable (Doctor Rogers). The scheduler/onboarding introduces actives **one at a time** (staged with the ramp, docs/03 §4): "we'll add your glycolic next week once the retinoid settles."

6. **Recovery nights are barrier repair, and the recovery protocol is specific.** Recovery nights focus on ceramides, hyaluronic acid, and niacinamide — clinically supported for post-exfoliation barrier recovery; apply a barrier-repair moisturiser promptly after any exfoliation. On over-exfoliation (stinging on plain moisturiser, persistent redness, flaking, tightness, burning, sudden bumps), the protocol is to **stop all exfoliants/retinoids/vitamin C for ~7–10 days**, simplify to cleanser + moisturiser + SPF, and re-introduce gradually. The scheduler automates inserting recovery and pausing actives.

7. **Cadence and AM/PM allocation are class-specific.** Daily (vitamin C and SPF in the AM, moisturiser AM/PM, often niacinamide); cycled at night (exfoliants, retinoid); `every_n_days` (a weekly mask, maintenance exfoliant); optional weekday-specific. By class: **antioxidant/vitamin C → AM**; **SPF → AM, last**; **retinoid → PM**; **exfoliants → PM** (BHA acceptable AM for oily skin); **niacinamide/hydrators → flexible**; **benzoyl peroxide → AM or alternate nights** (Doctor Rogers).

8. **The cycle needs a stored, versioned data model and a projection algorithm.** docs/01–03 only carried `cycling_night` on `routine_steps` and referenced "the cycle definition + anchor." This document defines a stored cycle (variant, length, per-night slot, anchor date) and a deterministic projection: `night_index = (today_local − anchor) mod length` → tonight's slot; project forward for the week and for next-of-slot; recompute on edit/rollover/pause; **local-day aware** (DECISIONS **D-012**).

9. **The scheduler must be resilient to real life.** Pause (vacation/illness/procedure), skip a single night, resume with re-anchoring, and auto-de-escalate on irritation. The break is **managed**, not punished — consistent with the calm, forgiving streak (docs/03 §6) and Lally's missed-day finding. This disruption layer is entirely unspecified upstream.

10. **Demand is real and the scheduler is the antidote to decision fatigue — with one honest tension.** McKinsey 2025: **72% overwhelmed** by product volume; the 2026 mood is **skinimalism/longevity** — fewer, smarter, expert-guided, barrier-first ("trusted expert guidance cuts through the noise," Revieve); skin cycling has ~3.5B TikTok views (docs/02/03) and sources explicitly tell people to **"use a skincare app to track"** the cycle (Dot & Key). The honest counter-current: the same mood rejects **"aggressive cycling"** and over-complication — so the scheduler must reduce load and protect the barrier, never multiply steps. The scheduler aligns with skinimalism _if_ it is calm, minimal, and barrier-first.

---

## Details

### 1. What the scheduler is — and is not (scope & the boundary with docs/02 §5 and docs/03)

**It is** the temporal engine. Concretely, the scheduler:

- decides **what active on what day/night at what cadence**, for the actives the user owns;
- owns the **cycle data model** and the **projection algorithm** (§3);
- performs **multi-active orchestration** across the week (§4);
- assigns **cadence types and AM/PM placement** (§5);
- powers the **schedule-management surfaces** (§6);
- handles **pause/skip/travel/procedure and recovery/de-escalation** (§7);
- decides **what to remind about and when** (the _content_ of reminders; §9), leaving delivery to doc #7.

**It is not**, and these boundaries keep this document from re-treading its neighbours:

- the **conflict/synergy rules** — docs/02 owns the matrix and `detect_conflicts`; the scheduler _consumes_ the resolutions (`alternate_nights`, `separate_am_pm`, `buffer`).
- the **retinoid ramp mechanics** — docs/03 §4 owns `active_ramp` (the step-up offers, the `tolerance_state`); the scheduler _reads_ the current `freq_per_week` and schedules around it.
- the **daily-card rendering** — docs/03 §9 owns the Today AM/PM screens; the scheduler _feeds_ them and adds the _week-level_ surfaces (§6).
- the **within-routine sequencing** — docs/03 §3 owns `step_order` (thinnest-to-thickest); the scheduler decides _which night/phase_, not the order within a session.
- the **catalog/shelf** — docs/02/04 own products and the inventory; the scheduler reads `user_products`.

**Boundary table (so the three documents compose cleanly):**

| Concern                                                                   | docs/02 §5        | docs/03 §4–§5                 | doc 5 (here) |
| ------------------------------------------------------------------------- | ----------------- | ----------------------------- | ------------ |
| The Bowe cycling _concept_ + `cycling_night` mapping                      | ✔                 | reaffirms                     | uses         |
| Retinoid **ramp** (`active_ramp`, step-ups, tolerance)                    | —                 | ✔                             | reads        |
| Daily-card **rendering** (PM auto-resolution screen)                      | sketch            | ✔                             | feeds        |
| **Cycle data model** (stored, versioned) + **projection algorithm**       | referenced        | referenced                    | **✔**        |
| **Multi-active orchestration** (a cabinet across a week)                  | retinoid+AHA case | retinoid case                 | **✔**        |
| **Cadence types** + AM/PM allocation (all classes)                        | —                 | partial                       | **✔**        |
| **Schedule-management surfaces** (week view, settings, pause/skip/travel) | —                 | —                             | **✔**        |
| **Disruption & recovery** (pause/skip/procedure/de-escalation)            | —                 | irritation de-escalation seed | **✔**        |

**Deterministic, explainable, gated.** The scheduler is constraint satisfaction over curated rules (§2), not ML; every decision is traceable; the medical-adjacent rules (frequency, recovery, contraindication, the retinoid×exfoliant separation) are signed off under **B-DERM-REVIEW** alongside docs/02's matrix and docs/03's ramp/sequencing rules.

### 2. The scheduling model — inputs, constraints, outputs

**Inputs:**

- **Actives owned** — `user_products` (docs/04) joined to docs/02 `product_ingredients → ingredient_tags`, giving each owned product a functional class (`retinoid`, `aha`, `bha`, `vitamin_c`, `niacinamide`, `benzoyl_peroxide`, `azelaic`, …) and a concentration band.
- **Profile** — `skin_profiles` (docs/01): `sensitive_resistant`, `sensitivities`, `pregnancy_status`, `goals`.
- **Conflict resolutions** — docs/02 `detect_conflicts` → `routine_conflicts` with `resolution_type` (`alternate_nights` / `separate_am_pm` / `buffer` / `lower_frequency` / `no_change` / `reassure` / `avoid_refer`).
- **Ramp state** — docs/03 `active_ramp` (`freq_per_week`, `tolerance_state`).
- **The cycle definition** — this document, §3.

**Constraints (the rules — sourced and graded; all SORT grade C consensus, several harm-relevant and firmer):**

1. **One potent active per night** + supportive ingredients only (INKEY; Doctor Rogers). _Firm._
2. **Never a retinoid and an exfoliant on the same night** (harm-relevant — chemical-burn risk). _Firm._
3. **AM/PM placement by class** (§5): vitamin C AM; SPF AM-last; retinoid PM; exfoliants PM (BHA AM ok for oily); niacinamide/hydrators flexible; BP AM or alternate nights.
4. **Exfoliation frequency cap by skin type** (sensitive ~1×/wk → oily 3–4×/wk BHA). _Personalised, conservative._
5. **≤2 serums per night.**
6. **Recovery nights** present for barrier repair; insert more on irritation.
7. **Introduce actives one at a time** (phased onboarding/ramp).
8. **Pregnancy/breastfeeding → suppress retinoid** and route to docs/02's `safety` path (§4.8 there).
9. **Conservative default** when concentration/sensitivity/tolerance is unknown.

**Outputs:**

- a **per-day schedule** — for today and projected forward: which routine (AM/PM), which actives, which `cycling_night`, with the conflict resolutions applied;
- the **next-of-slot** computations (next acid night, next retinoid night) for the in-context copy docs/03 renders;
- the **week view** data (§6.1) and the **explainability** trace (§6.3).

**Orchestration at a glance (full algorithm in §4):** classify actives → allocate AM/PM → assign cycled PM actives to nights under the constraints → place daily/AM actives → reconcile the ramp and the conflict resolutions → fill recovery nights with barrier support → project the calendar.

### 3. The cycle data model & projection algorithm (the part docs/01–03 only referenced)

**The cycle as a stored, versioned object.** `cycling_night` on `routine_steps` (docs/01) records _which night a step belongs to_, but the **cycle itself** — its variant, length, per-night slot, and anchor — has nowhere to live. This document adds it:

```sql
create table public.cycles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  variant       text not null default 'gentle',   -- 'gentle' | 'classic' | 'advanced' | 'custom'
  length_nights int  not null default 4,           -- 4 (classic) | 5–6 (gentle) | custom
  anchor_date   date not null,                     -- the date night_index 0 fell on
  is_active     boolean not null default true,
  paused_from   date,                              -- non-null while paused (§7)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.cycles (user_id);

create table public.cycle_nights (                 -- the per-night slot assignment
  cycle_id      uuid not null references public.cycles(id) on delete cascade,
  night_index   int  not null,                     -- 0 .. length_nights-1
  slot          text not null,                     -- 'exfoliation' | 'retinoid' | 'recovery' | 'other_active'
  user_product_id uuid references public.user_products(id) on delete set null,  -- the active on this night
  primary key (cycle_id, night_index)
);
-- Owner-only RLS on both, exactly per docs/01 §3 (subselect auth.uid(), TO authenticated, WITH CHECK).
```

(A JSONB cycle definition on a single row is a valid alternative; the two-table form is shown for clarity and queryability. Either way the cycle is **versioned** — edits create a new active cycle and supersede the old, preserving history.)

**The projection algorithm (deterministic, pure, local-day aware).** Given an active `cycle` (anchor `A`, length `L`), today's **local** date `T` (per the user's timezone; the timezone-tolerant logic of DECISIONS **D-012** applies), and the slot map:

```
night_index(T)        = ((T - A) mod L + L) mod L          # safe modulo for dates before the anchor
tonight_slot          = cycle_nights[night_index(T)].slot
week_ahead            = [ (T+d, cycle_nights[night_index(T+d)]) for d in 0..6 ]
next_slot_date(slot)  = min{ T+d : d>0, cycle_nights[night_index(T+d)].slot == slot }
```

- **Tonight** drives the PM card and strip (docs/03 §9.3).
- **`next_slot_date('exfoliation')`** is the "**next acid night**" the PM banner names ("Next acid night: Saturday," spec p9) — the computation docs/02 §5 sketched, here made concrete.
- **Variable length** is handled by `L` (4 classic, 5–6 gentle, custom); recovery-heavy gentle cycles simply have more `recovery` nights.
- **Recompute triggers:** any cycle/shelf/ramp edit, local-day rollover, and resume-from-pause (§7). The projection is cached and re-run on these.

**Re-anchoring after a pause/skip (design choice; default = resume where left off).** When a pause ends, the default is to **resume the cycle at the night the user left off** (advance `anchor_date` by the paused duration so the sequence continues), rather than snapping to today's modular position — this respects "you were on a recovery night, you still are." A skip of a single night does **not** re-anchor (the cycle continues; the streak forgives, docs/03 §6). (D-027.)

**Worked example (Maya).** Gentle 6-night cycle, `anchor_date` set at first generation. Slots: N0 exfoliation (glycolic) · N1 retinoid (retinol 0.3%) · N2 recovery · N3 retinoid · N4 recovery · N5 recovery. On the spec's Thursday, the projection yields `night_index = 1` → **retinoid night**, and `next_slot_date('exfoliation')` lands on the following exfoliation night → **"Saturday."** Exactly the spec's PM screen.

### 4. Multi-active orchestration (the hard, under-served core)

This is the part no competitor does well and neither neighbour specified: turning a _cabinet_ of actives into a coherent weekly schedule.

**The cardinal rules (sourced).** **One potent active per night** plus supportive (hydrating/barrier) ingredients only; **vitamin C in the AM**, off the night cycle; **exfoliants and retinoids at night, cycled and alternated, never the same night**; **skip secondary actives on retinoid/exfoliation nights**; **≤2 serums per night**; **introduce one active at a time.**

**The allocation algorithm (in detail):**

```
orchestrate(user):
  actives = classify(user_products → tags)            # retinoid, aha, bha, azelaic, vitamin_c, niacinamide, bp, ...
  # 1. AM / daily actives
  am_daily = [vitamin_c (AM), niacinamide/hydrators (flexible→AM), spf (AM, last)]
  # 2. Cycled PM potent actives = exfoliants (aha/bha) + retinoid (+ azelaic if used as a push)
  pm_potent = [a for a in actives if class(a) in {aha, bha, retinoid}]
  # 3. Build the cycle's night slots from pm_potent under the constraints:
  for each potent active a:
      freq = min(active_ramp[a].freq_per_week, frequency_cap(class(a), profile.sensitivity))
      place a on `freq` nights such that:
          - no night holds two potent actives                      # rule 1 + 2 (firm)
          - retinoid and exfoliant are never adjacent-same-night    # rule 2 (firm)
          - alternate_nights resolutions from docs/02 are honoured  # conflict engine
          - recovery nights separate consecutive potent nights      # rule 6
  # 4. Fill remaining nights as recovery (barrier support only)
  # 5. Place flexible actives (azelaic, niacinamide) on recovery/AM where they don't add a potent load
  # 6. Reconcile with separate_am_pm resolutions (e.g. BP → AM, simple retinol → PM)
  write cycles + cycle_nights; emit per-day schedule
```

**Frequency caps by class (conservative defaults; personalised; B-DERM-REVIEW):**

| Class                 | Sensitive                  | Normal/combination           | Oily/resistant          |
| --------------------- | -------------------------- | ---------------------------- | ----------------------- |
| AHA (glycolic/lactic) | 1×/wk → build              | 2–3×/wk                      | up to 3–4×/wk           |
| BHA (salicylic)       | 1–2×/wk                    | 2–3×/wk                      | up to daily (tolerated) |
| Retinoid              | 2×/wk (ramp)               | every-other → nightly (ramp) | nightly (ramp)          |
| Azelaic acid          | gentle — most nights/AM ok | flexible                     | flexible                |

**Worked examples:**

- **Simple (Maya — retinoid + glycolic):** N0 exfoliate (glycolic) · N1 retinoid · N2–N5 recover (gentle variant). Vitamin C every AM. Exactly the spec.
- **Complex (a fuller cabinet — retinoid + glycolic + salicylic + azelaic + vitamin C + niacinamide):** a 7-night cycle, e.g. **N0** AHA (glycolic) · **N1** retinoid · **N2** recover · **N3** BHA (salicylic) · **N4** retinoid · **N5** recover · **N6** recover; **azelaic** (gentle) on recovery nights or the AM; **vitamin C + niacinamide** every AM; SPF every AM, last. Each potent active gets its capped frequency, no two share a night, retinoid and acids never collide, and recovery nights sit between pushes. This is the orchestration value: six actives turned into a calm, barrier-safe weekly plan the user never has to reason about.

**Phased introduction.** When several actives are new, the scheduler does **not** switch them all on at once; it stages introductions one at a time (with the ramp, docs/03 §4): start the retinoid, settle for ~2 weeks, then introduce the exfoliant, etc. — with a calm note ("We'll add your glycolic next week once your retinoid settles"). This is the dermatologist "one at a time" rule made into product behaviour.

### 5. Cadence types & AM/PM allocation

**Cadence types (map onto `routine_steps.frequency`, docs/01 — no schema change there):**

- **`daily`** — vitamin C and SPF (AM), moisturiser (AM/PM), often niacinamide; every day.
- **`skin-cycling`** — the cycled PM potent actives, placed by `cycling_night` (§3).
- **`every_n_days`** — a weekly mask, a maintenance exfoliant, or a "2×/week" item not tied to the cycle.
- **weekday-specific (optional)** — e.g. "exfoliate Sunday & Wednesday" for users who prefer fixed days over a rolling cycle.

**AM/PM allocation by class (the rules, sourced):**

| Class                       | Default phase              | Notes                                                                 |
| --------------------------- | -------------------------- | --------------------------------------------------------------------- |
| Antioxidant / vitamin C     | **AM**                     | morning antioxidant + SPF is the classic pairing (docs/02 matrix #10) |
| Sunscreen (SPF)             | **AM, last**               | always the final AM step                                              |
| Retinoid                    | **PM**                     | UV degrades it and raises photosensitivity                            |
| Exfoliant (AHA)             | **PM**                     | cycled, alternated with retinoid                                      |
| Exfoliant (BHA / salicylic) | **PM** (or AM for oily)    | oil-soluble; AM acceptable for oily skin (Doctor Rogers)              |
| Benzoyl peroxide            | **AM or alternate nights** | separate from simple retinol (docs/02 stability rule)                 |
| Niacinamide / hydrators     | **flexible**               | typically AM; barrier-supportive, low-conflict                        |
| Azelaic acid                | **flexible**               | gentle; recovery nights or AM                                         |

**The interplay.** The **AM block is stable** (vitamin C → … → moisturiser → SPF, every day, sequenced by docs/03 §3); the **PM cycle rotates** (the potent active of the night + barrier support); the scheduler keeps the two coherent so the user sees a steady morning and a guided, varying evening.

### 6. The cycle & schedule-management surfaces (look, feel, behaviour)

Design tokens are fixed (docs/00 §8, DECISIONS D-005, docs/02 §7): **Instrument Serif** for editorial moments, **Hanken Grotesk** for UI, **monospace** for labels ("SKIN CYCLING · NIGHT 2 OF 4," "next acid night"); palette **paper · greige · clay · ink · night**; **dark "night"** for PM/evening context, **light** elsewhere; **calm, not gamified**; 8pt grid; Reanimated 3 motion; restrained haptics; WCAG 2.2 AA; Dynamic Type; RTL-ready.

#### 6.1 Week / cycle overview

A calm calendar/strip reachable from Today, showing **tonight and the nights ahead** — each night's slot (Exfoliate · Retinoid · Recover · Recover · …) and the active assigned to it, plus the **stable AM block** noted once. Tonight is the only night tinted clay; the rest are muted (the spec's PM strip, docs/03 §9.3, is the _today slice_ of this week view). Tapping a night opens **what's on and why** (§6.3). A small "next acid night / next retinoid night" line uses the projection (§3). No counts, no points, no pressure.

#### 6.2 Cycle settings / customisation

A calm settings surface to:

- **Choose the variant** — Gentle (more recovery, for sensitive/barrier-repair), Classic (the 4-night), Advanced (fewer recovery nights), or Custom.
- **Set the length** (`length_nights`) and **assign actives to nights** (a drag interaction over `cycle_nights`).
- **Set per-active frequency** (within the caps, §4).
- **Add/remove an active** from the cycle (re-runs orchestration, §4).

Edits that **violate a rule** (two potent actives on a night, exceeding a frequency cap, putting an exfoliant on a retinoid night) produce a **gentle, non-blocking nudge** ("Most people keep acids and retinol on separate nights to protect the barrier — want me to space them out?") and the user may proceed anyway, except where docs/02's **`safety`** path applies (pregnancy × retinoid), which defers to the clinician copy (docs/02 §4.8). This mirrors docs/03 §7's reorder behaviour: guidance, not gates — firmest only where harm is real.

#### 6.3 "Why is this on tonight?" explainability

A tap-through from any night that shows the **reasoning trace**, in calm, claim-safe language: _"Tonight is cycling night 2 — retinoid night. Your glycolic toner is on alternate nights so the two don't compound irritation. Your vitamin C is in your mornings."_ It surfaces docs/02's **evidence grade** where relevant ("recommendation, not a rule"). This is the trust counterpart to the conflict-detail screen (docs/02 §7.3) — it makes the schedule legible, which is exactly what the "expert guidance that cuts through the noise" mood rewards.

#### 6.4 Pause / skip / travel / post-procedure

Calm controls (also reachable from Today and Settings):

- **Pause my routine** — for a vacation, illness, or break; suspends the cycle (`cycles.paused_from`), optionally keeps a **minimal barrier routine** (cleanser + moisturiser + SPF), and resumes with re-anchoring (§3).
- **Skip tonight** — a one-off; the cycle continues; nothing breaks (the calm streak, docs/03 §6).
- **Travelling** — a "travel mode" that simplifies to essentials (skip potent actives if the user prefers) and resumes on return.
- **I had a facial / peel / treatment** — inserts a recovery period (pause actives for a set number of days), with claim-safe copy ("Give your skin a few days to recover before actives"), then resumes.

#### 6.5 Ramp & cadence surfaces

The ramp **step-up offer** (docs/03 §4 — "you've been steady at 2 nights a week for three weeks; want to try a third?") and the current per-active frequency are surfaced here, calmly and as **offers** the user confirms, never silent escalations.

#### 6.6 Microcopy, motion, haptics, accessibility, localisation

Claim-safe and calm (docs/02 §7.7): "keep it simple tonight," "recovery night — barrier support," "recommendation, not a rule"; never "treats/cures," never alarmist. Motion: subtle fades, the clay highlight for tonight; Reduce Motion → fades. Haptics: selection ticks on settings changes; nothing alarming. Accessibility: the night strip and slots carry **text, not colour alone**; VoiceOver announces "tonight: retinoid night, 1 of 3 steps"; Dynamic Type reflow. Localisation: externalise slot labels and all schedule copy for ~30% expansion + RTL (docs/01 §8); weekday names localise.

### 7. Disruption & recovery handling (the resilient scheduler)

The scheduler manages breaks instead of punishing them:

- **Pause** (vacation/illness/break) → suspend the cycle, optionally keep a minimal barrier routine, resume + re-anchor (§3). The streak is protected (docs/03 §6).
- **Skip a single night** → the cycle continues uninterrupted; a missed night never resets anything (Lally: a single missed day doesn't impair habit formation, docs/03 §6).
- **Post-procedure** (facial/peel/laser) → insert a recovery window (pause actives for N days), claim-safe, then resume.
- **Auto-de-escalation on irritation / over-exfoliation** → on a reported irritation signal (the docs/03 §4 weekly tolerance prompt, or the over-exfoliation signs: stinging on plain moisturiser, persistent redness, flaking, tightness, burning, sudden bumps) the scheduler sets the relevant `active_ramp.tolerance_state='paused_irritation'` (docs/03), **pauses the offending actives**, inserts recovery nights, and follows the recovery protocol — **stop exfoliants/retinoids/vitamin C for ~7–10 days, simplify to cleanser + moisturiser + SPF, prioritise barrier repair (ceramides/HA/niacinamide)** — then re-introduces gradually. This also ties to docs/02 matrix row #15 (active × compromised barrier).
- **Seasonal/contextual (optional)** → winter or a drier climate can shift toward more recovery and less exfoliation (claim-safe, off by default; complements docs/04's optional seasonal note).

Every disruption is **guided, reversible, non-diagnostic, recovery-first**, and never breaks the streak.

### 8. The science & evidence grading (the scheduler's rules, honestly)

Consistent with docs/02's SORT discipline, the scheduling rules are graded and mostly **grade C** (consensus/mechanistic), with the harm-relevant ones enforced more firmly:

| Rule                                                | Evidence                                                                 | Firmness in the scheduler        |
| --------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| One potent active per night + support               | grade C, strong consensus                                                | firm                             |
| **Never retinoid + exfoliant same night**           | grade C, but **harm-relevant** (chemical-burn risk in clinical practice) | **firm (separation enforced)**   |
| Exfoliation frequency caps (skin-type-personalised) | grade C, "no hard rule"                                                  | conservative default, adjustable |
| Introduce actives one at a time                     | grade C, consensus                                                       | firm (phased)                    |
| Recovery nights / barrier-repair ingredients        | grade C + some clinical support                                          | firm                             |
| AM/PM allocation by class                           | grade C, consensus                                                       | default, adjustable              |
| Skin cycling framework                              | dermatologist framework, not RCT                                         | personalised, conservative       |

**Honest framing.** The scheduler's rules are consensus and mechanistic, not RCT-proven; they are conservative and personalised; the harm-relevant ones (retinoid×exfoliant separation, frequency caps, pregnancy suppression) are firmer; and the whole rule set — like the conflict matrix (docs/02 §9) and the sequencing/ramp rules (docs/03) — is **signed off under B-DERM-REVIEW** before launch. Crucially, the scheduler is **barrier-first and load-reducing** by design, never an engine for aggressive cycling.

### 9. Notifications & timing (what to remind, when — feeds doc #7)

The scheduler decides the **content and timing** of reminders; **doc #7 owns delivery** (the channels, `notification_preferences`, the Live Activity and widget — docs/00 §6, docs/01 §3, docs/03 §9.9). The scheduler emits, for the user's chosen PM time: _tonight's active_ ("Retinoid night — keep it simple"), _recovery nights_ ("Recovery night — barrier support"), the _next acid/retinoid night_, the _ramp step-up offer_ (as an occasional, confirmable prompt), and _de-escalation guidance_ ("Your skin's felt irritated — let's take a few recovery nights"). All calm, all opt-in, none with streak pressure.

### 10. Engineering / implementation notes

- **Where it runs.** Mirror docs/02–04: an authoritative server-side projection/orchestration (`schedule_for(uid, date)` / `orchestrate(uid)`, `SECURITY DEFINER`, hardened with `REVOKE … FROM public, anon, authenticated` per **D-013**), plus a **pure client-side mirror** over the cached cycle + rules so the schedule and the week view work offline (docs/01 §6). The projection is small and pure.
- **New schema introduced here:** `cycles` + `cycle_nights` (or an equivalent JSONB cycle), owner-only RLS; **no change** to `routines`/`routine_steps`/`routine_completions` (they already carry `frequency`, `cycling_night`, `instructions`).
- **Suggested DECISIONS.md entries:** **D-025** — the cycle is a **stored, versioned data object** with a pure, local-day-aware **projection function** (not implied by `cycling_night` alone); **D-026** — multi-active orchestration enforces **one potent active per night** + class **frequency caps** + the **retinoid×exfoliant same-night prohibition**, derm-reviewed; **D-027** — pause/skip **re-anchoring default is resume-where-left-off**, and disruptions never break the calm streak. Anything touching the medical defensibility of the orchestration/frequency/separation rules belongs in **BLOCKERS.md** under **B-DERM-REVIEW**.
- **PostHog instrumentation** (docs/01 §7): `cycle_started`, `cycle_variant_changed`, `cycle_night_completed`, `cycle_paused` / `_resumed`, `night_skipped`, `irritation_reported` → `deescalated`, `ramp_step_up_offered`/`_accepted` (from docs/03), `why_tonight_viewed`. Wire the **cycle-adherence** depth metric alongside the activation funnel (docs/03).
- **Performance & correctness.** The projection is O(`length_nights`); cache it and recompute only on the triggers in §3; keep orchestration idempotent (re-running over an unchanged shelf + profile yields the same cycle and preserves edits); recompute on local-day rollover (D-012) and after a pause.

---

## Seven-Figure Validation (the scheduler & the money)

The scheduler is king-making because it solves the single biggest problem in modern skincare:

- **It is the antidote to decision fatigue — the #1 consumer pain point.** McKinsey's 2025 State of Fashion & Beauty found **72% of consumers overwhelmed by the volume of products**, younger shoppers most fatigued. "What do I use tonight?" is the question a cabinet full of actives provokes; the scheduler **answers it deterministically**, every night, so the user just follows.
- **It operationalises the dominant 2026 mood (skinimalism + skin longevity).** The market wants **fewer, smarter, expert-guided, barrier-first routines "you'll actually stick to"** — and "trusted expert guidance cuts through the noise" (Revieve). The scheduler delivers exactly that: one calm nightly step, barrier-protective frequency/recovery, evidence-graded reasoning, and zero mental load. It turns the pile of products people already own into a plan — directly addressing HadaBuddy's "what do I do with these 12 bottles" moment.
- **It powers the paywall's #1 value prop and is the nightly-return habit spine.** The paywall leads with "Routine intelligence — order, timing, skin cycling" (spec p7); the scheduler is the engine behind it, and the nightly "tonight's step" is what brings users back — the behaviour that compounds into retention and data lock-in (annual retention ~44% vs ~17% monthly, docs/01 §9).
- **Demand is durable and explicitly app-shaped.** Skin cycling has ~3.5B TikTok views and is dermatologist-endorsed (docs/02/03); sources literally tell people to **"use a skincare app to track"** the cycle because "the cycle can feel complex" (Dot & Key). The scheduler is the product that recommendation is asking for.
- **Competitively, no one does the hard parts.** SkinSort organises and logs; HadaBuddy AI-generates a static 7-day plan; neither does **multi-active orchestration across a real cabinet**, a **living projected cycle**, **disruption/recovery handling**, or the **calm management surfaces** — and an AI-generated static plan can't re-anchor after a vacation, de-escalate on irritation, or explain itself.

**Verdict: yes — the Actives & Skin-Cycling Scheduler is a seven-figure, king-of-the-category feature**, because it converts a pile of products into a calm, barrier-safe, expert-guided nightly plan that removes the decision and keeps people coming back. The one real risk is the honest tension below: it must **reduce** load and **protect** the barrier — never become a complexity or anxiety engine, never push aggressive cycling. Built that way (and only that way), it is the difference between an app people abandon and one they keep.

---

## Synthesis

**(a) What it is:** the temporal engine — what active, what day/night, what cadence — producing the schedule docs/03 renders. Scoped against docs/02 §5 (the cycling concept) and docs/03 §4–§5 (the ramp + daily rendering); this document owns the cycle data model, the projection, multi-active orchestration, cadence types, the management surfaces, and disruption/recovery.

**(b) The model:** inputs (shelf actives, profile, conflict resolutions, ramp, cycle) → constraints (one potent active/night; never retinoid+exfoliant same night; AM/PM by class; frequency caps; ≤2 serums; recovery; one-at-a-time; pregnancy suppression; conservative-when-unknown) → outputs (the per-day schedule, next-of-slot, the week view, the explainability trace).

**(c) Cycle data model & projection:** a stored, versioned `cycles` + `cycle_nights` (the part `cycling_night` alone never captured) and a pure, local-day-aware projection (`night_index = (today − anchor) mod length`) computing tonight's slot, the week ahead, and the next acid/retinoid night; re-anchoring on resume.

**(d) Multi-active orchestration:** the algorithm that allocates a cabinet of actives across the week under the cardinal rules, with class frequency caps and phased introduction — the under-served core, with simple (Maya) and complex (six-active) worked examples.

**(e) Cadence & AM/PM:** daily/cycling/every-n-days/weekday cadences and class-specific AM/PM placement (vitamin C AM, exfoliants/retinoid PM, BHA/BP flexible, niacinamide/azelaic flexible), with a stable AM block and a rotating PM cycle.

**(f) Management surfaces:** the week view, cycle settings (variant/length/assignment/frequency with non-blocking rule nudges), the "why tonight?" explainer, and pause/skip/travel/procedure controls — calm and non-gamified.

**(g) Disruption & recovery:** pause/skip/procedure with re-anchoring, and auto-de-escalation on irritation (the 7–10-day recovery protocol) — the break is managed, the streak protected; rules honestly graded (grade C, harm-relevant ones firmer) and gated under B-DERM-REVIEW.

**(h) Composition & confidence:** consumes docs/02 (resolutions) and docs/03 (ramp), extends docs/01 (schema), feeds docs/03 (rendering) and doc #7 (reminder delivery); the orchestration/frequency/separation rules are the items most needing review; the honest tension is keeping it calm and barrier-first, not aggressive.

---

## Recommendations

1. **Build a deterministic, explainable scheduler — not AI.** Constraint satisfaction over curated rules; every "X tonight" traceable; the medical-adjacent rules signed off under **B-DERM-REVIEW** (with docs/02's matrix and docs/03's ramp).
2. **Store the cycle as a versioned data object and implement the projection as a pure, local-day-aware function** (D-025) — don't leave the cycle implied by `cycling_night` alone.
3. **Invest in multi-active orchestration — it's the moat.** Enforce **one potent active per night**, the **retinoid×exfoliant same-night prohibition** (harm-relevant), and class **frequency caps**; stage **phased introduction** of new actives (D-026).
4. **Place actives by class** (vitamin C AM, exfoliants/retinoid PM cycled, BHA/BP flexible, niacinamide/azelaic flexible) with a **stable AM block** and a **rotating PM cycle**.
5. **Build the management surfaces docs/03 didn't cover** — the week view, cycle settings (with non-blocking rule nudges), the **"why tonight?"** explainer, and **pause/skip/travel/procedure** controls — all calm and non-gamified.
6. **Make the scheduler resilient:** re-anchor on resume, never break the streak on a skip (D-027), and **auto-de-escalate on irritation** with the barrier-recovery protocol.
7. **Personalise conservatively:** gentle variants and lower frequency for sensitive/barrier-repair; default to the more cautious branch when tolerance is unknown.
8. **Keep it claim-safe and calm** (docs/02 §9/§7.7): "recommendation, not a rule," "recovery night," "give your skin a few days" — never "treats," never alarmist, never aggressive cycling.
9. **Let the scheduler decide _what_ to remind and _when_, and hand delivery to doc #7** (`notification_preferences`, Live Activity, widget) — opt-in, no streak pressure.
10. **Position it as the antidote to decision fatigue** — "we decide tonight's one step so you don't have to" — explicitly aligned with skinimalism/longevity, and explicitly **not** a complexity engine.

---

## Caveats (confidence flags)

- **The scheduling rules are dermatologist consensus and mechanistic (SORT grade C), not RCT-proven** — conservative and personalised, with the harm-relevant ones (the retinoid×exfoliant separation, frequency caps, pregnancy suppression) enforced more firmly; the whole rule set needs clinical sign-off under **B-DERM-REVIEW**. _Medium-high confidence on the consensus; the specific frequencies are starting positions for review._
- **The retinoid×exfoliant same-night prohibition is the firmest rule, and rightly so** — same-night use is reported as a leading cause of at-home chemical burns in clinical practice — but it remains expert/clinical consensus rather than trial evidence; the scheduler enforces separation while staying claim-safe (it _separates_, it doesn't diagnose danger). _High confidence on enforcing the separation._
- **Exfoliation-frequency caps are personalised heuristics, not hard numbers** ("no hard and fast rule," Paula's Choice); they must adjust to the user's reported tolerance and the over-exfoliation signals. _Medium confidence on the specific caps; high on personalising them down for sensitivity._
- **Skin cycling is a dermatologist-developed framework, not an RCT-validated protocol** (docs/02/03); frame and personalise honestly, no "clinically proven" outcome claims. _Medium-high confidence on provenance/rationale; low on outcome claims._
- **The honest market tension is real:** the 2026 skinimalism/longevity mood **rejects aggressive cycling and over-complication**, so the scheduler must be a **load-reducer and barrier-protector**, never a complexity/anxiety engine; over-scheduling would actively work against the trend it rides. _High confidence — this is a design constraint, not optional._
- **The cycle projection has edge cases** — timezones and local-day rollover (D-012), dates before the anchor (safe modulo), pause/resume re-anchoring (D-027), and concurrent multi-device edits (deferred to a sync upgrade, docs/01 §6) — that should be verified on-device. _Medium confidence pending device testing._
- **Multi-active orchestration must degrade gracefully** when the shelf is sparse (no actives → no cycle, a simple daily AM/PM, per docs/02 §5 / docs/03 §5) or when products lack parsed actives/concentration (conservative defaults). _High confidence on the fallback behaviour._
- **Auto-de-escalation depends on self-reported signals**, which are imperfect; keep the prompt optional and the response conservative (pause + recovery, never escalate), and never diagnose. _Medium confidence._
- **Reminder delivery is owned by doc #7 and is platform-constrained** (iOS time-sensitive notifications, Android 14 exact-alarm limits, Live Activity/widget refresh — docs/00 §6); the scheduler only decides content/timing, and feasibility should be re-verified at build. _Medium confidence._
- **Competitive positioning moves fast** — SkinSort logs, HadaBuddy AI-generates static plans, and others will add cycling — so the defensible wedge must remain the **living orchestration + projection + disruption/recovery + calm management surfaces** combination, revisited periodically. _Medium confidence._
