# Document 7: Reminders, Streaks & Widgets — Build Spec

> **2026-07-12 launch-scope update:** Native iOS widgets and Live Activities are
> required for the all-features release. Any older sequencing or optionality in
> this document is superseded by `docs/hugeToDo/launch-contract.json`; the
> privacy, accessibility, lifecycle, and physical-device gates remain binding.

> **2026-08-08 implementation status:** The repository now contains an
> **implemented iOS source candidate** for the exact-pinned `expo-widgets`
> `57.0.8` dependency on Expo SDK 57: the app-side generation-bound lifecycle
> bridge/coordinator/host; a native App Group SQLite store protected by a POSIX
> lock and `BEGIN IMMEDIATE` transactions; opaque owner-authority rotation;
> bounded snapshots; an App Intent outbox append committed before return;
> native compare-and-swap reconciliation; lock-held health-lease quiescence that
> captures the exact final outbox and permits one exact receipt-bound commit;
> typed outbox-pending and stale-Activity retries; a parse-independent,
> boundary-first privacy lane that durably verifies `privacy-closing-v1` and
> returns a closed-admission receipt before its queued purge; and deterministic
> Live Activity stale, recovery, and end-request paths. This corrects
> the earlier scaffold-only finding recorded in
> `docs/hugeToDo/IOS-02-WIDGET-LIFECYCLE-SOURCE-CHECKPOINT-2026-07-16.md`.
> It is still **not a compiled or signed iOS artifact**, has no physical-iPhone
> proof, and is not enabled for customers: interactive publication and the
> public native-widgets capability remain literal `false`; the generated
> `RoutineKindWidgetInteractivePublicationEnabled` and
> `RoutineKindLiveActivityStartEnabled` Info.plist values are also literal
> `false`. Ordinary shipping config does not generate the extension or
> advertise Live Activities, and
> `/routine/widgets` remains an honest unavailable recovery route. Source
> implementation is not Apple approval, legal clearance, or permission to
> claim the feature in App Store metadata. Its current health-status authority
> also makes personalized display short-lived, and its synchronous
> exclusive-lock/read-write-SQLite render path still requires Instruments and
> device contention evidence.

> **2026-07-26 reminder implementation status:** The current mobile source uses
> an encrypted, device-local notification preference and scheduling-attempt
> ledger. Every notification purpose defaults off. The onboarding soft ask
> displays the proposed 7:30 AM and 9:30 PM times before any OS request and can
> enable only those two routine reminders. Scheduling rechecks the current OS
> authorization state, settings render stored purposes effectively off when
> authorization is unavailable, and native denial has a Settings recovery
> path. Behavioural routine/replenishment suggestions reserve one of three
> rolling seven-day device slots and promotional attempts reserve one,
> atomically before native scheduling; the separately opted-in progress-photo
> reminder is weekly. Routine quiet hours do not claim to govern
> the checkout-date billing reminder or OS presentation. The mobile client does
> not read or write `notification_preferences` or `notification_log`, and it
> does not produce permission-prompt analytics. Remote synchronization,
> cross-device caps, sent/open measurement, native OS prompt/scheduling,
> timezone/DST/relaunch, accessibility, network, signed-archive, privacy/legal,
> and physical-iPhone evidence remain closed launch gates. This is a local
> source and development-web checkpoint, not notification, App Review, legal,
> launch, or revenue clearance.

_The engagement & delivery layer · local-first reminders with permission-priming · notification tiers, timing, quiet hours & lock-screen discretion · the calm, forgiving streak & weekly adherence · home-screen widgets (including interactive check-off) · Live Activities for the evening routine._

> This is build-order document **#7** of the 15 named in docs/00 (§"Build order", item 7: _"Reminders/streaks/widgets"_). It is the **delivery and engagement layer** that several earlier documents feed into: it _delivers_ the reminder **content** the scheduler computes (docs/05 §9 — tonight's active, recovery night, next acid night, ramp step-up, de-escalation), the **replenishment alerts** from the Smart Shelf (docs/04 §6), and the **capture nudges** from the photo feature (docs/06 §5); and it _owns and implements_ the **calm, forgiving streak** whose principles docs/03 §6 established and explicitly deferred to "doc #7." It retains docs/01's server `notification_preferences` table only as dormant future-sync/cleanup scaffolding; encrypted device preferences are the current scheduling authority. It also extends the **computed-and-cached streak** on `profiles` (D-011, D-012), and it _implements_ docs/00 §6 (local-first notifications, Android-14 exact-alarm handling, WidgetKit/Glance widgets, Live Activities, permission-priming). Its design principle — **calm, not gamified** — is, as this document shows, not only on-brand but the **retention-optimal** strategy: over-notification and pressure-streaks measurably backfire. It powers the paywall's #4 value prop, _"Reminders, streaks & home-screen widgets,"_ and feeds the subscription/paywall surface (doc #8).

---

## TL;DR

- **This layer is the app's re-engagement engine — and done calmly, it is one of the highest-leverage retention levers in the product.** Reminders bring people back to the daily loop, the streak anchors the habit, and widgets keep the app present on the home screen. The evidence is strong on all three: users who receive any push in their first 90 days have **~3× higher retention**; Duolingo users are **3× more likely to return daily when a streak is active** (and a streak **widget lifted commitment ~60%**). This is the surface that converts a good product into a daily habit.

- **The cardinal rule is restraint, and restraint is empirically correct — not just on-brand.** Over-notification is one of the top uninstall drivers: **>6 pushes/week from one brand → 3.4× more likely to uninstall within 30 days** (Klaviyo 2026, n=6,200); even one weekly push makes ~10% disable notifications. The validated fix — **segment notifications into tiers (utility / behavioural-trigger / promotional), opt-in, frequency-capped** — _is_ OnSkin's calm design, and its reminders are **user-set times the person chose for their own routine**. The brand's calmness and the retention data point the same way.

- **Reminders genuinely improve daily-regimen adherence — the medication-adherence literature is the closest analog.** Systematic reviews and meta-analyses find reminder apps are associated with **higher medication adherence** for chronic conditions (against a baseline where only ~50% of patients adhere) — "promising, interpret with caution." Since **consistency is the single biggest determinant of skin results** (docs/06), the chain _reminder → adherence → results → retention_ is well-grounded, with appropriate humility.

- **The streak is calm and forgiving — and forgiving streaks retain _better_ than punitive ones.** Lally's habit research shows a single missed day doesn't impair habit formation (docs/03 §6); Duolingo's data shows the same in reverse — **Streak Freeze cut churn 21%**, _adding_ forgiveness made DAU "skyrocket," and an _achievable_ threshold added Day-14 retention, while an over-pressured streak produced "hollow engagement" until they softened it ("sticky but humane"). OnSkin therefore takes the **forgiveness and achievability** lessons (grace days/freezes, recovery nights count, low bar, weekly adherence + a heat-map) and deliberately **rejects the dark-pattern half** (aggressive loss-aversion, guilt copy, default leaderboards) — the combination that is both humane and retention-optimal, and uniquely right for a skincare context where recovery nights and occasional misses are _healthy_.

- **Notifications are tiered, user-controlled, discreet, and platform-correct.** Three tiers — **utility** (the AM/PM routine reminders and "tonight's step," at user-set times, local notifications), **behavioural-trigger** (gentle streak/adherence nudges, replenishment, ramp step-ups, irritation de-escalation), and **promotional** (sparse win-backs/announcements, explicit opt-in) — each independently toggleable, frequency-capped, quiet-hours-aware, and **discreet on the lock screen** (skincare content is health-adjacent). Permission is requested via a **soft-ask at the value moment** (55–70% opt-in vs 30–40% cold), and the platform mechanics handle **Android-14 exact-alarm restrictions** and **iOS time-sensitive** justification correctly.

- **Widgets put the routine on the home screen — glanceably, and now interactively.** Following the glanceability law (**1–3 data points, readable in under two seconds**), the widget set shows _tonight's step / next up_, _today's progress (X of N)_, _the streak_, or _the cycle night_ — never a paragraph. Crucially, **iOS 17 interactive widgets** (and Android's long-standing `RemoteViews`) let the user **check off a routine step directly from the home screen without opening the app** — collapsing the activation action to a single tap and reinforcing the habit metric (docs/01 §7).

- **Live Activities carry the evening routine onto the Lock Screen and Dynamic Island.** For the PM skin-cycling session, an optional **Live Activity** (iOS ActivityKit, 16.2+) shows "tonight's step — Retinoid night, 1 of 3" in real time, with an Android ongoing-notification equivalent — a natural fit for the cycling "tonight's step" display, started at the reminder and ended when the routine completes.

- **Seven-figure verdict: a top retention surface, made durable by restraint.** Re-engagement and habit-anchoring are where subscription retention is won or lost; this layer drives the daily return that compounds into the annual-plan retention the business depends on (docs/01 §9), and it powers the paywall's #4 value prop. The honest risks — **notification fatigue and streak-anxiety are real, well-documented failure modes** — are addressed head-on by tiering, frequency caps, forgiveness, discretion, and opt-in, which is exactly why the calm approach is the seven-figure approach.

---

## Key Findings

1. **Notifications are a major retention lever — when relevant and restrained.** Push-enabled users show up to ~88% higher engagement and ~3× higher 90-day retention than opted-out users; the opt-in itself is "the single most valuable conversion event in onboarding." But the benefit is conditional on relevance and frequency discipline.

2. **Over-notification is a top uninstall driver, with a clear threshold.** >6 pushes/week from one brand → **3.4× more likely to uninstall within 30 days** (Klaviyo 2026); 1 weekly push → ~10% disable / ~6% uninstall; 3–6 → ~40% "no more." The validated structural fix is **tiering (utility / behavioural / promotional) + opt-in + frequency caps**, which keeps well-managed programs' uninstalls <1%.

3. **Reminders improve daily-regimen adherence (medication analog).** Meta-analyses and systematic reviews associate reminder apps with **higher medication adherence** for chronic conditions ("promising, interpret with caution"); since consistency drives skin results (docs/06), routine reminders are a well-grounded adherence mechanism.

4. **Permission-priming works.** A soft-ask at the value moment yields **55–70% opt-in vs 30–40%** cold (consistent with docs/01's OneSignal/CleverTap figures); the prompt is fired at the value moment, never at launch (docs/01 §8). Android 13+ now also requires explicit notification opt-in.

5. **Streaks are a top retention mechanic.** Duolingo users are **3× more likely to return daily** with an active streak; a **7-day streak → 3.6× more likely to stay long-term**; a streak **widget lifted commitment ~60%**. Streaks drive early habit formation (day 0→7→14→30) — but only when layered on a product that already delivers real value.

6. **Forgiving streaks retain better than punitive ones — this is the key design validation.** **Streak Freeze reduced churn 21%**; _adding_ a second freeze made DAU "skyrocket" ("reducing anxiety about streak loss increases long-term engagement"); an _achievable_ threshold added ~3.3% Day-14 retention. Conversely, over-pressure produced "hollow engagement… the experience eroding" until Duolingo softened it. OnSkin adopts forgiveness + achievability and rejects the loss-aversion/guilt/leaderboard half (docs/03 §6).

7. **The calm streak fits skincare uniquely well.** Recovery nights (docs/05) and the occasional missed evening are _expected and healthy_, so an all-or-nothing daily counter is actively wrong here; OnSkin's "completion day" counts recovery nights, forgives misses (grace/freeze), and frames progress as **weekly adherence + a heat-map**, not a fragile chain.

8. **Widgets boost engagement/retention and are now interactive.** Always-visible widgets keep the app top-of-mind and increase stickiness; the glanceability law caps content at **1–3 data points** readable in under two seconds; **iOS 17 interactive widgets** (and Android `RemoteViews`) allow **checking off a step from the home screen without opening the app** — a one-tap habit reinforcement docs/00 predated.

9. **Live Activities fit the evening "tonight's step."** iOS ActivityKit (16.2+) Live Activities are temporary, event-tied, and real-time on the Lock Screen and Dynamic Island — a natural display for the PM skin-cycling session (docs/00 §6).

10. **Notifications and widgets carry health-adjacent content, so discretion is required.** Skincare reminders on a lock screen or a shared home screen can reveal health context; content must be **discreet by default**, detail is **opt-in**, and (where push is used) **no health-revealing content goes in third-party push payloads** — local notifications keep content on-device.

---

## Details

### 1. What the layer is — and is not (scope; the boundary with docs/03 §6 and docs/05 §9)

**It is** the engagement and delivery layer. Concretely, it:

- **delivers** notifications — the routine reminders, "tonight's step," the scheduler's content (docs/05 §9), replenishment alerts (docs/04 §6), capture nudges (docs/06 §5), and sparse win-backs;
- **owns and implements the streak/adherence system** — the calm, forgiving streak whose principles docs/03 §6 set (D-021) and deferred here;
- **builds the home-screen widgets** (including interactive check-off) and the **Live Activities**;
- **manages notification permission, tiers, timing, frequency caps, quiet hours, and lock-screen discretion.**

**It is not**, and these boundaries keep it from re-treading its neighbours:

- it **does not decide reminder _content_ for actives** — the scheduler (docs/05 §9) computes _what_ to say ("tonight is retinoid night," "next acid night Saturday"); this layer decides _when and how_ to deliver it.
- it **does not define the streak's _philosophy_** — docs/03 §6 set "calm, not gamified" (D-021); this layer _implements_ it (the freeze logic, the surfaces, the computation).
- it **does not own the routine, the cycle, the shelf, or the photos** — it surfaces and reminds about them.
- it is **not a growth-hacking / dark-pattern surface** — no manufactured urgency, no guilt, no engagement-maximising at the expense of trust (the brand's and the evidence's shared conclusion).

### 2. The engagement philosophy — calm, not gamified, and why it is also the retention-optimal choice

OnSkin's engagement layer is deliberately calm, and this document's central argument is that **calm is not a trade-off against retention — it is the retention-optimal strategy** for this product:

- **Over-notification backfires** (>6/week → 3.4× uninstall); restraint + tiering + caps is what keeps users (and uninstalls <1%).
- **Forgiving, achievable streaks retain _better_** (freeze −21% churn; leniency ↑ DAU; low threshold ↑ D14) than punitive ones, which produce "hollow engagement."
- **Health-adjacent content demands discretion**; a calm, private posture is both ethical and trust-preserving (the privacy-as-trust thesis, Yuka, docs/01 §7).
- **The brand voice forbids the dark patterns** (guilt copy, manufactured urgency, loss-aversion maximisation) that _also_ erode long-term retention.

So the layer takes the _mechanically_ powerful parts of reminders/streaks/widgets (they demonstrably drive return and adherence) and applies them **humanely** — which the evidence says is the way to keep people, not lose them. "Calm, not gamified" is the spec's mandate (cover) and the data's recommendation at once.

### 3. Reminders & notifications (the local-first delivery system)

#### 3.1 The three notification tiers (the structural fix for fatigue)

Every notification belongs to exactly one tier, each independently controllable:

- **Utility (off until explicitly enabled, user-scheduled):** the **AM/PM routine reminders** at the encrypted current-device `amTime` / `pmTime`, and the **"tonight's step"** prompt. The onboarding proposal is 7:30 AM and 9:30 PM and confirms both before requesting OS authorization.
- **Behavioural-trigger (gentle, event-driven, capped):** the **streak/adherence nudge** (`streak_nudges`), the **replenishment alert** (`replenishment_alerts`, docs/04 §6), the **ramp step-up offer** (docs/05 §4, occasional), and the **irritation de-escalation** guidance (docs/05 §7). Triggered by state, not by a schedule, and frequency-capped.
- **Promotional (sparse, explicit opt-in only):** **win-backs** and **announcements**. Off by default beyond a minimal lifecycle; never the daily noise.

This tiering is the validated "fastest structural fix for notification fatigue and uninstall rates."

#### 3.2 Permission-priming (the soft-ask)

Onboarding step 8 (docs/01 §2) shows a **soft pre-permission screen** at the value moment, names the proposed 7:30 AM and 9:30 PM routine times, and requests OS authorization only after the affirmative `Use these times` action. It enables only AM/PM after a deliverable authorization result. The current path emits no prompt-result analytics: app code cannot prove that the system sheet was visibly presented, and unavailable/error/unchanged outcomes are not denials.

#### 3.3 The reminders (what gets delivered)

- **AM routine reminder** — "Good morning — your routine's ready" at the AM time; deep-links to Today.
- **PM routine / "tonight's step"** — the scheduler's content (docs/05 §9): "Retinoid night — keep it simple," "Recovery night — barrier support," with the next-acid-night line where relevant; deep-links to the PM routine (and may launch the Live Activity, §6).
- **Capture nudge** (docs/06 §5) — "Time for a progress photo?" at a consistent time, weekly cadence, opt-in, never pressuring.
- **Replenishment alert** (docs/04 §6) — "A shelf update is ready" when a tracked PAO/recorded-package-date item needs review or the user marked a unit finished; defaults off, requires explicit Settings opt-in, and routes to the shelf/replenish flow.
- **Ramp step-up offer** (docs/05 §4) — occasional, confirmable ("Ready to try a third retinoid night?").
- **De-escalation** (docs/05 §7) — "Your skin's felt irritated — let's take a few recovery nights."
- **Win-back** (sparse) — value-restatement at ~Day 7 ("Here's what your timeline could show in a month"), a gentle Day-14 touch, then move to monthly to avoid accelerating uninstall.

All copy is **calm and claim-safe** (docs/02 §9): no guilt ("Don't break your streak!"), no manufactured urgency, no health claims.

#### 3.4 Timing, scheduling & frequency caps

- **User-set times** for the utility tier — the person confirms or edits AM/PM routine times. Stored in the encrypted device preference record; its device timezone is local authority. Remote preference sync remains closed.
- **Local notifications** for everything schedulable (routine reminders, capture nudges) — no server round-trip, work offline, content stays on-device (docs/00 §6).
- **Routine quiet hours** — scheduled AM/PM and weekly photo reminders inside the window move to its end; immediate event-triggered suggestions are skipped. Matching start/end means off. The checkout-date billing reminder is outside this health-purpose window, and OS presentation remains system-controlled.
- **Frequency caps** — a per-tier, per-week cap enforced by the delivery layer (§9), so behavioural triggers can never stack into fatigue; the utility tier is bounded by the user's own schedule.

#### 3.5 Platform mechanics

- **iOS time-sensitive notifications** require justification; routine reminders are standard notifications (not time-sensitive) unless the user opts a step into time-sensitivity. One system opt-in prompt (§3.2).
- **Android 14+ exact alarms** — `SCHEDULE_EXACT_ALARM` is denied by default for new installs targeting API 33+; routine reminders use **inexact alarms / WorkManager** (a routine nudge does not need minute precision), and the app **must call `canScheduleExactAlarms()` before any exact-alarm API or it crashes** (docs/00 §6). `USE_EXACT_ALARM` is reserved for alarm/calendar apps and is not claimed here.
- **Remote push is closed in the current mobile source.** A future APNs promotional or cross-device signal path would require separate in-app opt-in, token lifecycle, privacy/retention approval, and exact-build evidence. The current client stores no push token in `notification_preferences`.

#### 3.6 Lock-screen discretion (health-adjacent content)

Skincare notifications can reveal health context on a lock screen, so: notification content is **discreet by default** ("Your routine's ready," not "Time for your acne treatment"); any condition-specific detail is **opt-in**; and **no health-revealing content is placed in third-party push payloads** — the utility/behavioural tiers are **local notifications** (content never leaves the device), and the promotional push tier carries only generic copy. This mirrors the photo feature's on-device posture (docs/06 §7).

### 4. The streak & adherence system (the calm, forgiving streak)

docs/03 §6 set the philosophy (D-021); this layer implements it.

#### 4.1 Definition

- A **"completion day"** = the user did their **scheduled** routine for that day — and **recovery nights count** (docs/05). A simple, low bar: showing up for today's plan, whatever it is.
- The streak measures **consistency of showing up**, not perfection or intensity (the "achievable threshold" lesson: low bar → higher retention).
- **Photos are decoupled** from the streak (docs/06 §5) — the slower, gentler photo cadence is never a streak obligation.

#### 4.2 Forgiveness (the part that makes it retain _and_ humane)

- **Grace / freeze:** a missed day does **not** reset the streak to zero. The system carries a small **forgiveness window** (a streak freeze that auto-applies, like Duolingo's auto-equipped freeze) so one (or two) missed days are absorbed — beyond which the streak resets, _because past that point the habit has lapsed anyway and the streak must stay meaningful_. Freezes are **earned/automatic, not sold** (no in-app currency; this is a calm health app, not a game).
- **Earn-back:** if the streak does lapse, completing the next day's routine quietly restores momentum — no shame screen, just a calm "welcome back."
- **No guilt:** a lapse is acknowledged neutrally and the user is invited back; never "You lost your 30-day streak!"

#### 4.3 Weekly adherence + heat-map (the framing)

The **primary** progress framing is **weekly adherence** ("5 of 7 nights this week") and a **monthly heat-map** calendar — a representation that rewards consistency-over-time (what actually matters) rather than a fragile chain whose breaking triggers shame. The streak count exists but is presented calmly, secondary to the adherence/heat-map view.

#### 4.4 Computation (authoritative, cached, correct)

- Migration `0068` computes streaks server-side through owner-scoped
  security-definer projections from explicit routine-level
  `routine_completions` attestations. `profiles.current_streak` and
  `profiles.longest_streak` are server-owned caches; direct client mutation is
  denied.
- **`longest_streak` is a non-decreasing personal best** — `recompute_streak` uses `greatest(longest_streak, computed)` so a deleted completion never shrinks the all-time best (**D-011**); `current_streak` is recomputed on both INSERT and DELETE.
- The **completion validation window is timezone-tolerant** (**D-012**);
  authoritative adherence timezone is an independently validated IANA value and
  never comes from the dormant notification mirror. The current server intake
  admits only the bounded local replay window and rejects dates outside it.
- The freeze/grace state is projected from the same log plus the server-owned
  freeze ledger (§7), so it survives offline and recomputes deterministically.
- Migration `0069` is the only current mobile-to-server Shelf/completion
  mutation bridge. It derives the owner from the authenticated session, fences
  every write to the current approved health-processing epoch, drains Shelf
  identity before completion replay, records minimized idempotency receipts,
  and denies direct client DML. This is a source boundary; hosted convergence,
  two-device races, native process-death, withdrawal, and signed-build evidence
  remain launch gates.

#### 4.5 The streak surfaces (look & feel)

- **The streak pill** (Today header, spec p8) — a calm "12 days" with a small clay dot; tap → the adherence/heat-map view. Never a flashing, anxiety-inducing counter.
- **The adherence / heat-map view** — "5 of 7 nights this week" + a monthly heat-map; a visible **"Streak protected"** state when a freeze is active; recovery nights shown as fulfilled.
- **Milestones** — gentle markers (7 days, one cycle, 30 days) with a **restrained celebration** (a brief Lottie moment is acceptable per docs/00 §8, but calm — no confetti-cannon dark pattern); milestones can unlock something _meaningful_ (e.g., surfacing the progress-photo comparison), white-hat over loss-aversion (docs/03 §6).
- **No default leaderboards / social comparison** — social accountability is powerful but pressure-laden and off-brand; if ever added, strictly opt-in and private-by-default.

#### 4.6 Anti-patterns explicitly avoided

No guilt copy; no manufactured loss-aversion ("Duo desperation"); no default leaderboards; no streak-as-currency; no hollow-grind optimisation (the cautionary tale); no streak pressure on recovery nights or photos. The streak serves the habit, not the metric.

### 5. Home-screen widgets

#### 5.1 The glanceability law

A widget shows **one to three data points, readable in under two seconds** — "more than that and the glance becomes a read, which breaks the interaction model." Widgets that survive the home-screen reorg deliver their payload instantly. So OnSkin's widgets are spare and purposeful.

#### 5.2 The widget set

- **Tonight / Next up** (the hero) — "Tonight: Retinoid night · 1 of 3" or "Next: Ceramide moisturiser," from the scheduler (docs/05); tap → the routine.
- **Today's progress** — a small ring or "2 of 4" for the current routine; calm, no pressure.
- **Streak / adherence** — "12 days" or a tiny week heat-map (the streak-widget pattern that lifted commitment ~60% — used calmly here).
- **Cycle tonight** — the skin-cycling night ("Night 2 of 4 · Retinoid"), the strip's glanceable form (docs/05).

Each is a separate, user-chosen widget; none crams multiple of these together.

**IOS-02 launch source candidate:** the checked-in `RoutineKindToday` target
implements one privacy-bounded Today experience across exactly four declared
WidgetKit families: `systemSmall`, `systemMedium`, `accessoryInline`, and
`accessoryRectangular`. The content concepts above remain the product
selection model; they are not evidence that four separate extension targets,
`systemLarge`, `accessoryCircular`, or a separate StandBy layout currently
ship. Those claims require a signed archive and physical-device evidence.

#### 5.3 Interactive check-off (the notable enhancement)

With **iOS 17 interactive widgets** (WidgetKit handling taps without opening the app) and Android's `RemoteViews`, the **Today's-progress widget lets the user check off a step from the home screen** — collapsing the activation action (docs/01 §7's north-star) to a **single home-screen tap**. The check-off writes a `routine_completions` row through the same idempotent, offline-safe path (docs/03 §6), and the widget reflects the new state on its next timeline reload. This materially lowers the friction of the daily habit and is a current capability docs/00 predated.

In the iOS source candidate, the extension does **not** independently author a
canonical completion. The App Intent validates the bounded opaque action,
durably appends it to the native outbox before `perform()` returns, and asks
WidgetKit to reload. The generation-bound app host later resolves the action
through the same canonical local completion path, atomically compare-and-swaps
the replacement snapshot and outbox acknowledgement in native storage, and
only then acknowledges the private app registry. Concurrent and repeated taps
therefore converge idempotently; unknown, foreign-owner, stale, or expired
tokens cannot create a completion. This is implemented source behavior, not
device-verified behavior, and the interactive publication flag remains
literal `false`.

Before a scheduled health lease closes, native quiescence takes the same
cross-process store lock as App Intent append, validates the exact owner and
authority, durably writes a random receipt, and captures the exact final outbox
before releasing the lock. Ordinary operations are then denied. One separate
receipt/authority/owner/snapshot/revision-bound commit can reconcile only that
nonempty captured outbox and revokes the receipt before releasing the lock. An
empty capture replaces the structured receipt with the generic closing sentinel
under the same lock before quiescence returns. Native `outbox_pending`
publication and typed stale Live Activity outcomes are retryable concurrency
states; bounded retry exhaustion leaves accepted actions durable for a later
foreground refresh rather than purging them.

#### 5.4 Sizes, Lock Screen, StandBy

- **IOS-02 launch families:** Home Screen `systemSmall` and `systemMedium`,
  plus Lock Screen `accessoryInline` and `accessoryRectangular`. Shared or
  locked surfaces fail generic and never reveal product, step, condition, or
  owner detail without current authority.
- **Future concepts, not launch evidence:** `systemLarge`,
  `accessoryCircular`, and a separately optimized StandBy layout remain
  product options until implemented and added to the signed/device matrix.
- **Android:** Glance/ongoing-notification work is outside the current
  iPhone-only release contract and cannot substitute for IOS-02 evidence.

#### 5.5 Data sharing & refresh

- **iOS** WidgetKit runs separately from the app. For `RoutineKindToday`, the
  source candidate uses an **App Group SQLite lifecycle store**, not
  `UserDefaults` whole-timeline replacement as the authority. A process-shared
  lock plus immediate transactions protect owner authority, the current
  snapshot, and the append-only action outbox. Shared payloads use a closed,
  bounded schema with random, user-independent owner generations and no user
  ID or user-derived hash. Publication, reconciliation, expiry, account
  transitions, and privacy withdrawal reload the RoutineKind WidgetKit timeline
  only after their native transaction. Health withdrawal starts native closure
  immediately after exact-owner destructive authority and before JavaScript,
  private-store, or photo writer drains; Auth boundaries close native admission
  and delete encrypted action capabilities before a replacement owner can
  publish. Privacy cleanup can invalidate/purge raw native state even when
  payload bytes cannot be parsed. Timeline refresh remains system-managed, so
  source correctness does not establish refresh latency or rendering quality
  on a real device. **Android** uses **Glance** in the later, non-launch scope.

- The personalized timeline deadline is capped by the five-minute
  health-processing status lease and reserves 30 seconds for final
  reconciliation. Even after a fresh status verification, detail can remain
  current for at most roughly four and a half minutes and can be shorter when
  publication starts later. A reviewed, purpose-limited longer local-display
  authorization is required before the widget can provide useful persistent
  personalized content; this source checkpoint does not invent one.

### 6. Live Activities (iOS) / ongoing notifications (Android)

For the **PM skin-cycling session**, an optional `RoutineKindEvening` Live
Activity (iOS ActivityKit via the exact-pinned `expo-widgets` source) displays
the current evening progress on the Lock Screen and Dynamic Island. The source
candidate now derives a bounded deterministic `staleDate` from strict props,
updates only under current owner/snapshot authority, recovers existing
instances for reconciliation after app-process death, and requests immediate
generic final content/end on completion, expiry, disablement, sign-out, account
switch, deletion, health-consent withdrawal, invalid state, or stale timeout.
Start/update reauthorizes after the ActivityKit operation and asks a newly stale
instance to end immediately if authority changed during the call. Native
quiescence/cleanup schedules or awaits the end request, but a synchronous
closed-admission receipt does **not** prove that ActivityKit has removed the
presentation. Reboot/process-death behavior and actual removal latency still
require physical-device proof. The customer start path remains disabled and
ordinary shipping config does not advertise Live Activities, so this paragraph
is product intent plus implemented-source status—not a shipped capability. The
Android ongoing notification remains later scope.

The start path requires the exact signed RoutineKind deep link before
`Activity.request`. A typed stale result after start rereads current JavaScript
instances and awaits their immediate end requests before retry. Global
push-to-start token observation/emission is intentionally removed because those
tokens are not owner-bound or revocable; per-activity push remains signed
`false` and current-authority-gated.

### 7. Data model — dormant notification server scaffolding + streak caching

**Current authority boundary:** `notification_preferences` and
`notification_log` remain server schema/withdrawal/export scaffolding, not
current mobile collection or delivery authority. The encrypted device preference
record and encrypted scheduling-attempt ledger are authoritative. Every purpose
defaults off, and the current client sends neither preference values nor attempt
metadata off device. Migration `0068` has landed the forgiving server-parity
projection, so `profiles.current_streak` / `longest_streak` are now trusted only
as server-owned derived caches under the current health-processing authority.
Migration `0069` adds the owner-derived Shelf/completion replay bridge and
minimized receipt/identity export projections; it does not make dormant
notification tables mobile authority.

**Extensions this layer needs:**

```sql
alter table public.notification_preferences
  add column pm_reminder_enabled boolean not null default false,
  add column am_reminder_enabled boolean not null default false,
  add column capture_reminders   boolean not null default false, -- the weekly progress-photo nudge (opt-in)
  add column quiet_hours_start    time,
  add column quiet_hours_end      time,
  add column live_activity_enabled boolean not null default false, -- PM Live Activity (opt-in)
  add column promotional_opt_in   boolean not null default false,  -- win-backs/announcements tier
  add column updated_at           timestamptz not null default now();

-- A small ledger for the calm streak's forgiveness window (freezes), computed-friendly.
create table public.streak_freezes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  applied_for_date date not null,            -- the missed day this freeze absorbed
  source      text not null default 'auto',  -- 'auto' (earned) — never purchased
  created_at  timestamptz not null default now(),
  unique (user_id, applied_for_date)
);
create index on public.streak_freezes (user_id);

-- Dormant future remote delivery/throttle scaffolding. The current mobile client
-- must not use this table for caps, analytics, or delivery decisions.
create table public.notification_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  tier      text not null,        -- 'utility' | 'behavioural' | 'promotional'
  kind      text not null,        -- 'am_reminder' | 'pm_step' | 'capture' | 'replenishment' | 'rampup' | 'deescalation' | 'winback'
  sent_at   timestamptz not null default now()
);
create index on public.notification_log (user_id, tier, sent_at);
-- All three: owner-only RLS per docs/01 §3 (subselect auth.uid(), TO authenticated, WITH CHECK).
```

The **streak computation** (`project_routine_adherence` and its owner-facing
security-definer projections, D-011/D-012; docs/01 §3) consumes explicit
routine-level `routine_completions` plus `streak_freezes` to produce
`current_streak` / `longest_streak`; the freeze logic is deterministic and the
local/server parity corpus is versioned. Migration `0069` reconciles the
encrypted offline completion journal through `record_routine_completion`; it
does not infer adherence from partial step rows.

> **Decision-log notes (DECISIONS.md):** **D-031** — notifications are **tiered (utility / behavioural / promotional)**, each independently toggleable and **frequency-capped**, with utility reminders fired at **user-set local times**; **D-032** — the streak is **forgiving (auto-applied freezes, never purchased; recovery nights count) and framed as weekly adherence + a heat-map**, implementing the calm-streak philosophy (D-021) — no guilt copy, no default leaderboards, no loss-aversion maximisation; **D-033** — the **Today widget supports interactive check-off** (iOS 17 / Android `RemoteViews`) through the idempotent completion path, and **all health-adjacent notification content stays in local notifications** (no health content in third-party push payloads). Lock-screen/health-content discretion and the win-back cadence belong in **BLOCKERS.md** under **B-PRIVACY** where they touch sensitive content.

### 8. Privacy & compliance

- **Lock-screen / home-screen content is discreet** because skincare reveals health context (§3.6, §6); detail is opt-in; widgets on a shared home screen show calm, non-revealing content by default.
- **Local notifications keep content on-device** for the utility/behavioural tiers; the promotional **push** tier (APNs/FCM via Edge Functions) carries only generic copy — **no health-revealing content in third-party push payloads** (avoids exposing health-adjacent data to push intermediaries; consistent with MHMDA/GDPR special-category handling, docs/01 §4).
- **`push_token` is not currently collected.** Future remote push and notification analytics remain closed until purpose, opt-in, recipients, retention/deletion, processor, linkage, privacy-label, and exact-build review pass.
- **Streak/adherence data** is owner-only (RLS), included in the GDPR Art. 20 export, and removed on deletion (docs/01 §4).

### 9. Engineering / implementation notes

- **Notifications:** `expo-notifications` for **local notifications** (routine reminders, capture nudges) with timezone-correct scheduling; **Android 14**: inexact alarms / **WorkManager** by default, `canScheduleExactAlarms()` guarded before any exact API (or crash), `USE_EXACT_ALARM` not claimed; **iOS**: standard notifications with the single opt-in prompt, time-sensitive only where justified; **push** for win-backs via native **APNs/FCM + Supabase Edge Functions** (docs/00 §6).
- **Frequency-cap engine:** atomically reserve the encrypted current-device scheduling-attempt ledger before any event-triggered native schedule request. Behavioural suggestions admit at most three attempts and promotional at most one in a rolling seven days. Keep the reservation after native failure; it is not sent/open proof. Weekly photo reminders are separately opted in and separately described.
- **Widgets:** **iOS** WidgetKit (SwiftUI) via the exact-pinned
  `expo-widgets` source; App Group SQLite authority with a native durable
  outbox/CAS and one-shot final-quiescence lifecycle; RoutineKind timeline
  reload only after meaningful native transitions; four launch families
  (`systemSmall`/`systemMedium`/`accessoryInline`/`accessoryRectangular`).
  The publication flag remains false until signed and device gates pass.
  **Android** Glance/`RemoteViews` is later scope.
- **Live Activities:** ActivityKit via the exact-pinned `expo-widgets` source;
  deterministic stale/update/recovery/end source paths tied to the PM routine.
  The start/config flags remain false until signed and physical-device gates
  pass; the Android ongoing-notification equivalent is later scope.
- **Streak:** `recompute_streak` security-definer function (D-011/D-012), `profiles` cache via trigger, `streak_freezes` ledger; all offline-safe and idempotent (docs/03 §6).
- **Notification instrumentation is closed.** The current notification path produces no prompt, sent, opened, or reminder-time analytics. A future CAT-09 schema may use only mechanically observable names and must separately approve consent, payload, linkage, recipients, retention, deletion, and exact-build transport. Never infer that an OS prompt was shown or that a schedule attempt was delivered/opened.
- **Performance:** the frequency-cap check is a single indexed query and
  reminder scheduling is local and battery-friendly (inexact alarms). The
  RoutineKind WidgetKit provider/render read path is not yet performance-cleared:
  it synchronously acquires the exclusive cross-process `flock` and opens SQLite
  read-write. Instruments must measure lock wait, schema/read work, memory,
  timeout, and AppIntent/publication/cleanup contention on supported physical
  iPhones before the signed flag can be enabled.

---

## Seven-Figure Validation (the engagement layer & the money)

Re-engagement and habit-anchoring are where subscription retention is decided, and this layer is the product's primary lever on both:

- **It drives the daily return that compounds into retention.** Push-enabled users retain ~3× better at 90 days; streak-active users return ~3× more daily; a streak widget lifted commitment ~60%. The daily loop this layer sustains is what makes annual plans (which retain ~44% at one year vs ~17% monthly, docs/01 §9) pay off — and annual is the paywall default precisely because retention is the business.
- **It powers the paywall's #4 value prop** — _"Reminders, streaks & home-screen widgets"_ (spec p7) — and the interactive widget + Live Activity make the product feel present and effortless, deepening perceived value.
- **It reinforces the activation metric.** The interactive-widget check-off collapses the north-star action (first/again check-off, docs/01 §7) to a single home-screen tap, raising the odds users form the habit that predicts retention.
- **Restraint is what makes the retention durable.** The same evidence that says reminders/streaks/widgets drive retention says **over-notification and pressure-streaks destroy it** (>6 pushes/week → 3.4× uninstall; hollow-grind streaks erode the experience). OnSkin's tiered, capped, forgiving, discreet design captures the upside _without_ the churn — which is why the calm approach is the seven-figure approach, not a softer alternative to it.
- **It compounds the trust thesis.** A calm, private, non-manipulative engagement layer (discreet lock-screen content, no dark patterns, no data sold) reinforces the privacy-as-trust word-of-mouth engine behind Yuka's $7.3M (docs/01 §7) — the opposite of the "Duo desperation" pattern users increasingly resent.

**Business hypothesis:** the reminders/streaks/widgets layer can be a
retention-defining surface _provided_ it is built calmly: tiered and
frequency-capped notifications at user-set times, a forgiving and achievable
streak framed as weekly adherence, glanceable (and interactive) widgets, and an
opt-in Live Activity—all discreet and claim-safe. The documented failure modes
(notification fatigue, streak-anxiety, lock-screen leakage) are real and are
exactly what the calm design is intended to mitigate. This hypothesis is not a
revenue forecast or guarantee.

---

## Synthesis

**(a) What it is:** the engagement and delivery layer — it delivers the scheduler's reminder content (docs/05), the shelf's replenishment alerts (docs/04), and the photo capture nudges (docs/06); it implements the calm streak (docs/03 §6); and it builds the widgets and Live Activities (docs/00 §6).

**(b) Philosophy:** calm, not gamified — and the evidence makes this the retention-optimal choice (over-notification and pressure-streaks backfire), not a trade-off.

**(c) Reminders:** three tiers (utility / behavioural-trigger / promotional), permission-primed soft-ask, user-set local times, quiet hours, frequency caps, Android-14/iOS platform-correct, discreet on the lock screen.

**(d) Streak:** a forgiving, achievable "completion day" (recovery nights count), auto-freezes and earn-back, framed as weekly adherence + a heat-map, computed authoritatively and cached (D-011/D-012), with the dark-pattern half deliberately rejected.

**(e) Widgets:** glanceable (1–3 data points), a small set (tonight/next, progress, streak, cycle), with **interactive check-off** (iOS 17 / Android) collapsing the habit action to one home-screen tap; App-Groups data sharing, sparing timeline reloads.

**(f) Live Activities:** an opt-in PM "tonight's step" on the Lock Screen / Dynamic Island, started at the reminder and ended on completion.

**(g) Data & privacy:** encrypted current-device preferences hold tiers, quiet
hours, and capture/live-activity/promotional toggles; the encrypted device
attempt ledger owns local caps. Server `notification_preferences` and
`notification_log` are dormant scaffolding, and notification analytics are
closed. Health-adjacent content stays in local notifications and discreet on
screens.

**(h) Composition & confidence:** consumes docs/03/04/05/06, extends docs/01, implements docs/00; the load-bearing constraints are restraint (frequency/tiering), forgiveness (the streak), and discretion (health-adjacent content) — all both ethical and retention-optimal.

---

## Recommendations

1. **Tier every notification (utility / behavioural / promotional), make each independently toggleable, and frequency-cap the non-utility tiers** (D-031) — the validated structural fix for fatigue and uninstalls.
2. **Fire reminders at user-set local times via local notifications**, timezone-correct, quiet-hours-aware — the best send-time strategy for a routine app and the most private.
3. **Permission-prime with a soft-ask at the value moment** (55–70% vs 30–40% opt-in), never at launch (docs/01 §8).
4. **Implement the streak as forgiving and achievable** (D-032): a low "completion day" bar, recovery nights count, auto-applied freezes (never sold), earn-back, and a **weekly-adherence + heat-map** framing — and **reject** guilt copy, loss-aversion maximisation, and default leaderboards.
5. **Compute streaks authoritatively and cache them** (D-011 non-decreasing best, D-012 timezone-tolerant, 48h backfill cap), offline-safe and idempotent (docs/03 §6).
6. **Build a small, glanceable widget set (1–3 data points)** and ship **interactive check-off** (iOS 17 / Android `RemoteViews`, D-033) to collapse the activation action to one home-screen tap.
7. **Offer an opt-in PM Live Activity** for the "tonight's step" cycling display; keep it discreet and easy to disable.
8. **Keep all health-adjacent content discreet and local** — generic lock-screen copy, detail opt-in, no health content in third-party push payloads (B-PRIVACY).
9. **Handle the platforms correctly** — Android-14 inexact alarms / `canScheduleExactAlarms()` guard, iOS single opt-in prompt + time-sensitive only where justified, sparing `reloadAllTimelines()` (docs/00 §6).
10. **Position the layer as calm and respectful** — "gentle nudges at times you choose, a streak that forgives, widgets that help" — which is both the brand and the retention-optimal strategy.

---

## Caveats (confidence flags)

- **Notifications drive retention _only when relevant and restrained_** — the 3× retention upside and the 3.4×-uninstall downside are two faces of the same lever; the tiering + caps + user-set-times design is what keeps OnSkin on the right side, and frequency discipline must be enforced, not aspirational. _High confidence on the direction; the specific magnitudes are vendor/benchmark figures._
- **The reminder-adherence evidence is "promising, interpret with caution"** (medication meta-analyses: varied effect sizes, self-report, short durations) — reminders plausibly improve routine adherence, but don't overclaim a guaranteed effect. _Medium-high confidence on direction._
- **Permission-priming and opt-in lift figures are largely vendor-sourced** (OneSignal/CleverTap/Adjust; docs/01 §8) — the _direction_ (soft-ask at the value moment) is well established; treat the magnitudes directionally. _Medium-high confidence on direction._
- **The forgiving streak is the retention-optimal _and_ humane choice** (freeze −21% churn; leniency ↑ DAU; achievable threshold ↑ D14; over-pressure → hollow engagement), but these are platform case studies (Duolingo), not RCTs; the principle is robust and converges with Lally (docs/03 §6). _Medium-high confidence; hold the calm line._
- **Streak-anxiety and dark patterns are a real risk if the calm constraints slip** — a future growth push toward loss-aversion mechanics would both violate the brand and, per the evidence, erode long-term retention; D-032's guardrails are load-bearing. _High confidence — this is a design constraint._
- **Widget and Live Activity presentation remains system-managed, not a
  real-time rendering guarantee.** The App Intent must durably append before
  returning and the canonical state converges through the native transaction,
  but WidgetKit controls when the refreshed timeline is rendered. Measure
  actual latency and stale/end behavior on supported physical iPhones.
  _High confidence on the platform constraint; device evidence open._
- **The present personalized-display lifetime is intentionally short.** A
  five-minute health-status lease plus 30-second reconciliation headroom is a
  fail-closed source posture, not a useful long-lived home-screen contract. A
  longer purpose-limited local-display authorization needs explicit product,
  privacy, legal, implementation, and device review. _High confidence on the
  current limitation; the longer authorization is undecided._
- **The current native read path may contend inside WidgetKit's execution
  budget.** Provider/render reads synchronously take an exclusive `flock` and
  open SQLite read-write. Source bounds do not establish acceptable latency;
  Instruments and physical-device contention evidence are required. _High
  confidence that measurement is required; performance is unknown._
- **Interactive widgets require iOS 17+ (Android long-supported)**; older iOS falls back to a tap-to-open widget — verify the fallback and the AppIntents wiring on-device. _Medium confidence pending device testing._
- **Health-adjacent content on lock screens / shared home screens is a privacy exposure** that discreet-by-default content and local-notification handling mitigate; the win-back push copy and any condition-specific detail need legal/DPIA review (B-PRIVACY). _High confidence that discretion is required._
- **Android-14 exact-alarm handling is a crash risk if mishandled** (`canScheduleExactAlarms()` must be checked); routine reminders are fine on inexact alarms, but verify timing acceptability on-device. _Medium-high confidence; verify at build._
- **Streak/timezone/offline edge cases** (D-012's tolerant window, 48h backfill cap, freeze application across timezones, multi-device) need device testing; the computed-and-cached hybrid is correct but edge-sensitive. _Medium confidence pending testing._
