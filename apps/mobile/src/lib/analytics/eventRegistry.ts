export const ANALYTICS_ALLOWED_EVENTS = [
  'account_created',
  'ask_consent_granted',
  'ask_consent_revoked',
  'ask_escalated_to_clinician',
  'ask_grounded_gated',
  'ask_opened',
  'ask_proactive_lead_shown',
  'ask_reported_problem',
  'ask_turn',
  'barcode_scanned',
  'barcode_decode_rejected',
  'barcode_decode_success',
  'catalog_barcode_lookup',
  'catalog_correction_reported',
  'catalog_lookup_no_match',
  'catalog_lookup_retry_saved',
  'catalog_search',
  'cloud_backup_opted_in',
  'commerce_consent_declined',
  'commerce_consent_granted',
  'community_consent_granted',
  'community_consent_withdrawn',
  'comparison_viewed',
  'contextual_paywall_shown',
  'cycle_night_completed',
  'cycle_paused',
  'cycle_recovery_started',
  'cycle_resumed',
  'cycle_started',
  'cycle_variant_changed',
  'first_checkoff_completed',
  'first_photo_captured',
  'first_routine_created',
  'first_useful_insight',
  'health_consent_declined',
  'ingredient_parse_completed',
  'label_capture_photo_taken',
  'label_recognition_completed',
  'manage_subscription_opened',
  'night_skipped',
  'onboarding_started',
  'opened_date_set',
  'paywall_dismissed',
  'paywall_shown',
  'personalization_shown',
  'phase7_deferred_surface_viewed',
  'phased_intro_overridden',
  'photo_capture_still_taken',
  'photo_baseline_added',
  'photo_captured',
  'preference_set',
  'product_add_started',
  'product_added',
  'product_scanned',
  'product_discarded',
  'product_finished',
  'purchase_completed',
  'quiz_completed',
  'quiz_question_answered',
  'reaction_added',
  'recommendation_accepted',
  'recommendation_dismissed',
  'recommendation_expanded',
  'recommendation_shown',
  'reference_reset',
  'replenishment_nudge_shown',
  'replenishment_nudge_tapped',
  'restore_tapped',
  'review_prompt_attempted',
  'review_prompt_skipped',
  'review_prompt_unavailable',
  'reverse_trial_expired',
  'reverse_trial_started',
  'ramp_step_up_accepted',
  'ramp_step_up_offered',
  'routine_edited',
  'routine_checkoff_completed',
  'routine_created',
  'routine_plan_viewed',
  'screen_viewed',
  'scan_matched',
  'scan_no_match',
  'subscription_cancel_intent',
  'support_contact_failed',
  'support_contact_opened',
  'skin_note_viewed',
  'stack_viewed',
  'step_reordered',
  'streak_milestone_reached',
  'timeline_viewed',
  'transparency_viewed',
  'trend_consent_revoked',
  'trend_insights_opted_in',
  'trend_shown',
  'trial_started',
  'where_to_buy_clicked',
  'where_to_buy_link_failed',
  'why_tonight_viewed',
  'winback_converted',
  'winback_shown',
  'youre_set_shown',
] as const;

export type AnalyticsAllowedEventName = (typeof ANALYTICS_ALLOWED_EVENTS)[number];

export const ANALYTICS_RESTRICTED_EXACT_PROP_EVENTS = Object.freeze([
  'barcode_decode_rejected',
  'barcode_decode_success',
  'barcode_scanned',
  'catalog_barcode_lookup',
  'catalog_correction_reported',
  'catalog_lookup_no_match',
  'catalog_lookup_retry_saved',
  'catalog_search',
  'ingredient_parse_completed',
  'label_capture_photo_taken',
  'label_recognition_completed',
  'product_scanned',
  'scan_matched',
  'scan_no_match',
] as const satisfies readonly AnalyticsAllowedEventName[]);

export const ANALYTICS_ALLOWED_PROP_KEYS = [
  'action',
  'added_via',
  'answerKind',
  'barcode_type',
  'category',
  'context',
  'consented',
  'correction_type',
  'count',
  'campaign',
  'content',
  'creative_variant',
  'days',
  'feature',
  'flagged',
  'grounded',
  'is_opened',
  'kind',
  'landing_variant',
  'latency_bucket',
  'lookup_type',
  'matched',
  'medium',
  'milestone',
  'mode',
  'moment',
  'native_ocr_enabled',
  'on_device',
  'period_type',
  'reason',
  'reaction',
  'refused',
  'result',
  'screen_name',
  'share_id',
  'severity',
  'signal_source',
  'source',
  'streak',
  'store',
  'surface',
  'term',
  'type',
  'unknown_count_bucket',
  'variant',
  'platform',
  'app_version',
  'build_number',
] as const;

export type AnalyticsAllowedPropKey = (typeof ANALYTICS_ALLOWED_PROP_KEYS)[number];

/**
 * Shared, content-free vocabularies for restricted analytics events. Keeping
 * these values beside the registry gives producers and the final sanitizer one
 * immutable source without importing feature code into the analytics layer.
 */
export const ANALYTICS_LATENCY_BUCKETS = Object.freeze([
  'lt_1s',
  '1s_to_lt_3s',
  '3s_to_lt_6s',
  '6s_to_lt_12s',
  'gte_12s',
  'unknown',
] as const);

export const ANALYTICS_CATALOG_LOOKUP_RESULTS = Object.freeze([
  'matched',
  'no_match',
  'too_short',
  'error',
] as const);

export const ANALYTICS_CATALOG_CORRECTION_TYPES = Object.freeze([
  'wrong_match',
  'missing_product',
  'ingredient_issue',
  'duplicate',
  'source_issue',
  'expiry_issue',
  'category_issue',
] as const);

export const ANALYTICS_CATALOG_RETRY_RESULTS = Object.freeze([
  'queued',
  'already_queued',
  'failed',
] as const);

export const ANALYTICS_SCAN_RESULTS = Object.freeze([
  'matched',
  'no_match',
  'ambiguous',
  'offline_queued',
] as const);

export const ANALYTICS_BARCODE_TYPES = Object.freeze([
  'ean13',
  'upc_a',
  'upc_e',
  'ean8',
  'unknown',
] as const);

export const ANALYTICS_LABEL_RECOGNITION_RESULTS = Object.freeze([
  'recognized',
  'no_text',
  'timed_out',
  'failed',
  'cancelled',
] as const);

export const ANALYTICS_INGREDIENT_PARSE_RESULTS = Object.freeze([
  'parsed',
  'partial',
  'failed',
] as const);

export const ANALYTICS_INGREDIENT_PARSE_SOURCES = Object.freeze([
  'manual',
  'label_capture',
] as const);

export const ANALYTICS_UNKNOWN_INGREDIENT_COUNT_BUCKETS = Object.freeze([
  'none',
  'one_to_two',
  'three_to_five',
  'six_plus',
  'unknown',
] as const);

const allowedEvents = new Set<string>(ANALYTICS_ALLOWED_EVENTS);
const allowed = new Set<string>(ANALYTICS_ALLOWED_PROP_KEYS);

export function isAllowedAnalyticsEventName(event: string): event is AnalyticsAllowedEventName {
  return allowedEvents.has(event);
}

export function isAllowedAnalyticsPropKey(key: string): key is AnalyticsAllowedPropKey {
  return allowed.has(key);
}
