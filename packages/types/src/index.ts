/**
 * @onskin/types — shared domain types.
 *
 * These literal unions mirror the data model in docs/01 §3 (and the catalog
 * sketch in docs/00 §2). They are the single source of truth for both the
 * mobile client and the Supabase Edge Functions. The generated Supabase
 * `Database` type lives in `./database.types.ts` (regenerate with
 * `supabase gen types typescript` once the project exists — see BLOCKERS
 * B-SUPABASE).
 */

export type * from './database.types';

// --- Consent (docs/01 §3 `consents`, §4 placement map) -----------------------
/** Each consent is unbundled — collection is "separate and distinct" from
 *  sharing under MHMDA, and health-data needs explicit GDPR Art. 9 consent. */
export const CONSENT_TYPES = [
  'account',
  'health_data_collection',
  'photo_capture',
  'photo_cloud_backup',
  'marketing',
  'data_sharing',
  // docs/11 §8 / D-066: a NEW, separate, unbundled consent for posting health-adjacent
  // info to the community (MHMDA / GDPR Art. 9) — never reused from photo/data_sharing.
  'community_participation',
  // docs/12 §8 / D-072: a NEW, separate, DEFAULT-OFF consent for the on-device
  // within-person photo trend insight (still a health inference; distinct from
  // photo_capture / photo_cloud_backup). Installed base is re-consented, never enrolled.
  'photo_trend_insights',
  // docs/13 §7 / D-053: a NEW, separate, DEFAULT-OFF consent for "Ask OnSkin". The
  // user's question is a health disclosure transmitted to a zero-retention cloud
  // language layer (MHMDA / GDPR Art. 9 attaches to the TRANSMISSION). Distinct from
  // every other consent; the deterministic on-device advisor needs no consent at all.
  'ask_onskin',
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

// --- Skin profile axes (docs/01 §3 `skin_profiles`, §2 Baumann 4-axis) -------
export const SKIN_AXES = [
  'oily_dry',
  'sensitive_resistant',
  'pigmented_non',
  'wrinkled_tight',
] as const;
export type SkinAxis = (typeof SKIN_AXES)[number];

export type PregnancyStatus = 'none' | 'pregnant' | 'breastfeeding' | 'prefer_not';

// --- Goals (docs/01 §2 + design-spec p.3 goal cards) -------------------------
/** Exactly the 6 goals enumerated in docs/01 §2 and shown on the design spec
 *  goals screen. `title`/`subtitle` are the spec's card copy (authorized). */
export const GOALS = [
  { id: 'clear_skin', title: 'Clear skin', subtitle: 'Breakouts & congestion' },
  { id: 'even_tone', title: 'Even tone', subtitle: 'Dark spots & texture' },
  { id: 'hydration', title: 'Hydration', subtitle: 'Tightness & dullness' },
  { id: 'anti_aging', title: 'Fine lines', subtitle: 'Firmness & elasticity' },
  { id: 'sensitivity', title: 'Sensitivity', subtitle: 'Stinging & flushing' },
  { id: 'barrier_repair', title: 'Barrier repair', subtitle: 'Redness & reactivity' },
] as const;
export type GoalId = (typeof GOALS)[number]['id'];

// --- Routines (docs/01 §3 `routines` / `routine_steps`) ----------------------
export type RoutineType = 'AM' | 'PM' | 'custom';
export type StepFrequency = 'daily' | 'skin_cycling' | 'every_n_days';
/** Skin-cycling night meanings per docs/01 §3: 1=exfoliation, 2=retinoid,
 *  3–4=recovery. */
export type CyclingNight = 1 | 2 | 3 | 4;
export type CompletionSource = 'live' | 'backfilled';

// --- Routine builder (docs/03) -----------------------------------------------
/** Product roles the sequencing engine orders (docs/03 §3). */
export type SequencingRole =
  | 'cleanser'
  | 'toner'
  | 'antioxidant'
  | 'treatment'
  | 'exfoliant'
  | 'hydrating_serum'
  | 'eye'
  | 'moisturiser'
  | 'oil'
  | 'spf';
export type RoutinePhase = 'am' | 'pm' | 'either';
/** Retinoid/active ramp-up (docs/03 §4). */
export type RampClass = 'retinoid' | 'aha' | 'bha' | 'other_active';
export type ToleranceState = 'building' | 'steady' | 'paused_irritation';

// --- Actives & skin-cycling scheduler (docs/05) ------------------------------
/** The stored cycle's variant (docs/05 §3 `cycles.variant`). */
export type CycleVariant = 'gentle' | 'classic' | 'advanced' | 'custom';
/** The DB per-night slot enum (docs/05 §3 `cycle_nights.slot`). */
export type CycleSlotDb = 'exfoliation' | 'retinoid' | 'recovery' | 'other_active';
/** Why the scheduler eased off / paused (drives recovery copy, docs/05 §7). */
export type DisruptionReason = 'procedure' | 'irritation' | 'travel' | 'break';

// --- Shelf (docs/01 §3 `user_products`, docs/04 Smart Shelf) ------------------
export type ProductStatus = 'active' | 'finished' | 'discarded';
/** Where the PAO value came from — recorded so the UI can be honest about
 *  estimates (docs/04 §3 sourcing waterfall). */
export type PaoSource = 'label' | 'catalog' | 'category_default' | 'unknown';
/** Where the surfaced expiry came from (docs/04 §3). */
export type ExpirySource = 'printed' | 'pao_computed' | 'estimated' | 'unknown';
/** Which intake path created a shelf row (docs/04 §4, funnel analytics §9). */
export type AddedVia = 'barcode' | 'search' | 'ocr' | 'manual' | 'onboarding';
/** A barcode-scan outcome logged to `shelf_scans` (docs/04 §2/§4.6). */
export type ShelfScanResult = 'matched' | 'no_match' | 'ambiguous' | 'offline_queued';

// --- Guided photo progress (docs/06) -----------------------------------------
/** A capture series: each angle/zone is its own series with its own reference +
 *  ghost so the SERIES stays internally consistent (docs/06 §3). 'front' default. */
export const PHOTO_SERIES = ['front', 'left', 'right', 'cheek_l', 'cheek_r', 'forehead'] as const;
export type PhotoSeries = (typeof PHOTO_SERIES)[number];
/** Time-of-day consistency hint — shots are most comparable at the same hour
 *  (docs/06 §3 skin-prep variables). */
export type TimeOfDay = 'morning' | 'evening';
/** On-device lighting check states (docs/06 §3) — calm guidance, never alarm. */
export type LightingState = 'good' | 'too_dark' | 'too_warm' | 'uneven';
/** A per-shot quality verdict surfaced at review — flagged, NEVER blocked
 *  (docs/06 §3, the doc's D-029). The user always controls capture. */
export type PhotoQualityFlag = 'matched' | 'darker' | 'misaligned' | 'low';
/** Calm timeline milestones — gentle markers, NOT gamified points (docs/06 §4).
 *  `one_cycle` (~12 weeks / 84 days) is the full-results-window marker; a distinct
 *  per-user cycle-length milestone is a future refinement once cycle length is
 *  plumbed through (today the pure helper has no per-user length). */
export type PhotoMilestone = 'first' | 'four_weeks' | 'one_cycle';
/** PostHog photo events — METADATA ONLY, never image data (docs/06 §10). */
export const PHOTO_EVENTS = [
  'photo_captured',
  'first_photo_captured',
  'comparison_viewed',
  'timeline_viewed',
  'capture_reminder_tapped',
  'cloud_backup_opted_in',
  'reference_reset',
] as const;
export type PhotoEvent = (typeof PHOTO_EVENTS)[number];

// --- Reminders / streaks / widgets (docs/07) ---------------------------------
/** Every notification belongs to exactly one tier, each independently toggleable;
 *  the non-utility tiers are frequency-capped (docs/07 §3.1, D-031). */
export type NotificationTier = 'utility' | 'behavioural' | 'promotional';
/** The notification kinds the delivery layer fires (docs/07 §3.3 / §7). */
export const NOTIFICATION_KINDS = [
  'am_reminder',
  'pm_step',
  'capture',
  'replenishment',
  'rampup',
  'deescalation',
  'winback',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
/** Glanceable widget kinds — 1–3 data points each (docs/07 §5.2). */
export type WidgetKind = 'tonight' | 'progress' | 'streak' | 'cycle';
/** PostHog reminders/streaks/widgets events — metadata only (docs/07 §9). */
export const ENGAGEMENT_EVENTS = [
  'notification_sent',
  'notification_opened',
  'reminder_time_set',
  'streak_freeze_applied',
  'streak_milestone_reached',
  'widget_added',
  'widget_checkoff_completed',
  'live_activity_started',
] as const;
export type EngagementEvent = (typeof ENGAGEMENT_EVENTS)[number];

// --- Entitlements (docs/01 §3 `entitlements`) --------------------------------
export type EntitlementTier = 'pro' | 'pro_plus';

// --- Subscriptions, paywall & conversion (docs/08) ---------------------------
/** What a user can access. 'free' = the generous floor; 'pro' = the four value
 *  props; 'pro_plus' reserved for the Phase-2 AI tier (docs/08 §2.3). */
export type SubscriptionTier = 'free' | 'pro' | 'pro_plus';
/** How a `pro` entitlement was obtained (docs/08 §8 `period_type`). The reverse
 *  trial is app-granted (no store txn, no auto-renew); 'trial' is the carded
 *  14-day store trial; 'normal' is a paid subscription; 'intro' an intro offer. */
export type PeriodType = 'reverse_trial' | 'trial' | 'intro' | 'normal';
/** Where the entitlement came from (docs/08 §8 `store`). */
export type EntitlementStore = 'app_store' | 'play_store' | 'web' | 'app_granted';
/** The purchasable plans (docs/08 §2.3). No weekly plan by design. */
export type PlanId = 'annual' | 'monthly';
/** Pro-gated feature areas, used to frame the contextual upsell (docs/08 §3.2). */
export type GatedFeature =
  | 'photo_timeline'
  | 'scheduler'
  | 'conflict_checks'
  | 'reminders_widgets'
  | 'full_routine'
  // docs/13 §15: the CLOUD-GROUNDED language layer is Pro-gated with a hard trial cap.
  // The deterministic, on-device, $0 advisor (the moat taste) stays free.
  | 'ask';
/** PostHog subscription funnel events (docs/08 §10) — metadata only. */
export const SUBSCRIPTION_EVENTS = [
  'paywall_shown',
  'paywall_dismissed',
  'reverse_trial_started',
  'reverse_trial_expired',
  'trial_started',
  'purchase_completed',
  'contextual_paywall_shown',
  'restore_tapped',
  'manage_subscription_opened',
  'winback_shown',
  'winback_converted',
] as const;
export type SubscriptionEvent = (typeof SUBSCRIPTION_EVENTS)[number];

// --- Personalized recommendations (docs/09) ----------------------------------
/** The six honest, needs-based triggers (docs/09 §4). The engine recommends only
 *  when one fires; an empty set is the honest seventh state — "you're set". */
export const RECOMMENDATION_TRIGGERS = [
  'gap',
  'replacement',
  'conflict',
  'better_fit',
  'goal',
  'routine_completion',
] as const;
export type RecommendationTrigger = (typeof RECOMMENDATION_TRIGGERS)[number];
/** Honest personalisation filters (docs/09 §8) — they constrain *what fits you*,
 *  not *what sells*. They HARD-CONSTRAIN the candidate set (§5). */
export const VALUES_FILTERS = [
  'fragrance_free',
  'vegan',
  'cruelty_free',
  'non_comedogenic',
  'sustainable',
] as const;
export type ValuesFilter = (typeof VALUES_FILTERS)[number];
export type BudgetBand = 'drugstore' | 'mid' | 'premium';
/** PostHog recommendation events (docs/09 §12) — metadata only; tune RELEVANCE on
 *  accept/dismiss + the "how"-expansion, NEVER toward commission. */
export const RECOMMENDATION_EVENTS = [
  'recommendation_shown',
  'recommendation_expanded',
  'recommendation_accepted',
  'recommendation_dismissed',
  'youre_set_shown',
  'preference_set',
] as const;
export type RecommendationEvent = (typeof RECOMMENDATION_EVENTS)[number];

// --- Creator stacks + commerce (docs/10) -------------------------------------
/** The affiliate rail a "where to buy" link resolves through. Rail-agnostic by
 *  design (docs/10 §5, the B-SHOPMY hedge): if ShopMy can't mint links on OnSkin's
 *  own recommendations under a house account, swap rails without re-architecting. */
export type AffiliateSource = 'shopmy' | 'skimlinks' | 'direct' | 'none';
/** Who curated a shoppable stack. Expert/derm curation is the differentiator;
 *  anonymous influencer stacks are a trust liability (docs/10 §3). */
export type CuratorKind = 'editorial' | 'derm' | 'creator';
/** A polled ShopMy Order-Report row's lifecycle (docs/10 §5; pending → locked after
 *  the 30–120-day return window, or returned). */
export type OrderStatus = 'pending' | 'locked' | 'returned';
/** PostHog commerce events (docs/10 §10) — metadata only; NEVER tune ranking by
 *  these (church and state). */
export const COMMERCE_EVENTS = [
  'where_to_buy_shown',
  'where_to_buy_clicked',
  'commerce_consent_granted',
  'commerce_consent_declined',
  'transparency_viewed',
  'stack_viewed',
] as const;
export type CommerceEvent = (typeof COMMERCE_EVENTS)[number];

// --- AI trend analysis / "Changes in your own photos" (docs/12) --------------
/** The on-device within-person change state (docs/12 §6/§10). NEVER a score/grade —
 *  "consistent / no detectable change" is a CELEBRATED first-class output, never failure. */
export type TrendChangeState = 'consistent' | 'change_observed' | 'inconclusive_lighting' | 'insufficient_data';
/** PostHog trend events (docs/12 §13) — metadata only, never an image or skin value;
 *  instrument for OPT-IN / RETENTION, never toward a score or "improvement". */
export const TREND_EVENTS = [
  'trend_insights_opted_in',
  'trend_shown', // carries change_state, NEVER a value
  'trend_inconclusive_lighting',
  'trend_consistency_celebrated',
  'trend_consent_revoked',
] as const;
export type TrendEvent = (typeof TREND_EVENTS)[number];

// --- "Ask OnSkin" conversational advisor (docs/13) ---------------------------
/** The deterministic intent router (docs/13 §4). The router runs FIRST, BEFORE any
 *  language model, so medical/dosing/diagnosis intent is caught at the door and
 *  escalated — never narrated. Deterministic intents are answered on-device at $0;
 *  grounded intents need the (Pro-gated, currently blocked) cloud layer. */
export const ASK_INTENTS = [
  'conflict_q', // "can I use X with Y" / "is there a conflict on my shelf" — detectConflicts()
  'routine_q', // "what should I do tonight" — the generated plan
  'replenish_q', // "what's running low" — the shelf PAO/expiry
  'product_fit_q', // "is this product a fit for me" — the recommend()/fit engine
  'concern_q', // a cosmetic-concern question needing the curated corpus (grounded)
  'medical', // diagnosis/dose/condition/severe — ESCALATE, never answer
  'unsupported', // a product/topic outside the curated corpus — honest refusal
  'out_of_scope', // off-topic — refuse calmly
] as const;
export type AskIntent = (typeof ASK_INTENTS)[number];

/** How a turn was answered (docs/13 §4/§10) — the content-free audit dimension. */
export type AskAnswerKind = 'deterministic' | 'grounded' | 'escalate' | 'refuse';

/** PostHog Ask events (docs/13 §13) — metadata only, NEVER the question or answer
 *  text; instrument for TRUST / RETENTION / COST, never engagement maximisation. */
export const ASK_EVENTS = [
  'ask_opened',
  'ask_turn', // carries intent + answerKind + grounded?/refused?/escalated?, NEVER content
  'ask_consent_granted',
  'ask_consent_revoked',
  'ask_escalated_to_clinician',
  'ask_grounded_gated', // a grounded turn hit the Pro gate / trial cap
  'ask_reported_problem', // the wrong-answer feedback loop (content-free)
] as const;
export type AskEvent = (typeof ASK_EVENTS)[number];

// --- Community layer / "Skin Notes" (docs/11) --------------------------------
/** Expert-seeded note kinds (docs/11 §7). NOT peer UGC. */
export type CommunityNoteKind = 'myth_vs_evidence' | 'expert_answer' | 'explainer';
/** Who authored a note — expert/editorial only; never anonymous peers (docs/11 §4). */
export type NoteProvenance = 'expert' | 'editorial';
/** Peer question moderation lifecycle (docs/11 §6 — human PRE-moderation). */
export type ModerationState = 'pending' | 'approved' | 'rejected';
/** Structured reactions — a CLOSED vocabulary, never free text (docs/11 §5/§6 flywheel). */
export type CommunityReaction = 'helped' | 'use_this';
/** PostHog community events (docs/11 §12) — metadata only; NEVER instrument toward
 *  engagement maximisation (the addictive-design pattern §5 forbids). */
export const COMMUNITY_EVENTS = [
  'skin_note_viewed',
  'skin_note_evidence_expanded',
  'community_consent_granted',
  'question_submitted',
  'question_approved',
  'question_rejected',
  'question_appealed',
  'reaction_added',
  'report_filed',
  'block_added',
] as const;
export type CommunityEvent = (typeof COMMUNITY_EVENTS)[number];

// --- Ingredient intelligence layer (docs/02) ---------------------------------
/** Non-alarmist by mandate (docs/02 §4): every rule carries an evidence grade +
 *  a resolution, never a bare "never use." */
export type ConflictSeverity = 'none' | 'mild' | 'moderate' | 'high';

/** The five interaction classes + the `myth` reassurance label (docs/02 §4.1). */
export type InteractionType = 'irritation' | 'stability' | 'efficacy' | 'synergy' | 'safety' | 'myth';

/** Internal SORT-anchored grade (Ebell et al., AFP 2004) — docs/02 §4.3. */
export type EvidenceGrade = 'A' | 'B' | 'C';
/** Consumer-facing evidence label mapped on top of the grade (docs/02 §4.3). */
export type EvidenceLabel = 'established' | 'plausible' | 'contested' | 'refuted';

/** Resolution verbs (docs/02 §4.5). */
export type ResolutionType =
  | 'separate_am_pm'
  | 'alternate_nights'
  | 'buffer'
  | 'lower_frequency'
  | 'no_change'
  | 'reassure'
  | 'avoid_refer';

/** Functional families the conflict engine matches on (docs/02 §2.4/§4.4).
 *  `pregnancy` is a profile-derived pseudo-tag injected for safety rules. */
export const FUNCTIONAL_TAGS = [
  'retinoid',
  'aha',
  'bha',
  'benzoyl_peroxide',
  'vitamin_c',
  'niacinamide',
  'copper_peptide',
  'hydroquinone',
  'sunscreen',
  'physical_spf',
  'chemical_spf',
  'humectant',
  'ceramide',
  'barrier',
  'pregnancy',
] as const;
export type FunctionalTag = (typeof FUNCTIONAL_TAGS)[number];

/** Sub-flags that exempt/modulate a rule (docs/02 §2.4/§4.2). */
export type IngredientSubflag = 'adapalene' | 'tretinoin' | 'encapsulated' | 'l_ascorbic_acid';

export type CatalogSource = 'cosing' | 'open_beauty_facts' | 'curated' | 'user_contributed';

export type RoutineConflictStatus = 'suggested' | 'accepted' | 'overridden' | 'dismissed';

// --- Onboarding analytics taxonomy (docs/01 §7) ------------------------------
export const ONBOARDING_EVENTS = [
  'onboarding_started',
  'screen_viewed',
  'quiz_question_answered',
  'quiz_completed',
  'personalization_shown',
  'notification_prompt_shown',
  'notification_prompt_granted',
  'notification_prompt_denied',
  'account_created',
  'paywall_shown',
  'trial_started',
  'purchase_completed',
  'first_routine_created',
  'first_checkoff_completed',
] as const;
export type OnboardingEvent = (typeof ONBOARDING_EVENTS)[number];
