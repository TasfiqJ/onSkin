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

// --- Conflict engine (docs/00 §2 sketch — full data is BLOCKED B-CONFLICT) ---
/** Non-alarmist by mandate (docs/00 §3 caveat): every rule carries an evidence
 *  grade + a resolution, never a bare "never use." */
export type ConflictSeverity = 'low' | 'moderate' | 'high';
export type EvidenceGrade = 'strong' | 'moderate' | 'limited' | 'contested';

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
