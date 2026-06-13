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

// --- Shelf (docs/01 §3 `user_products`) --------------------------------------
export type ProductStatus = 'active' | 'finished' | 'discarded';

// --- Entitlements (docs/01 §3 `entitlements`) --------------------------------
export type EntitlementTier = 'pro' | 'pro_plus';

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
