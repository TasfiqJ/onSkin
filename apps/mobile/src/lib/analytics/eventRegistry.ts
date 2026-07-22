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
  'catalog_search',
  'commerce_consent_declined',
  'commerce_consent_granted',
  'community_consent_granted',
  'comparison_viewed',
  'conflict_detected',
  'conflict_overridden',
  'conflict_resolution_chosen',
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
  'landing_viewed',
  'manage_subscription_opened',
  'night_skipped',
  'notification_prompt_denied',
  'notification_prompt_granted',
  'notification_prompt_shown',
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
  'share_card_export_failed',
  'share_card_export_started',
  'share_card_export_succeeded',
  'share_card_exported',
  'share_link_created',
  'share_link_opened',
  'share_sheet_opened',
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

export const ANALYTICS_ALLOWED_PROP_KEYS = [
  'action',
  'added_via',
  'app_version',
  'barcode_type',
  'build_number',
  'campaign',
  'category',
  'content',
  'context',
  'correction_type',
  'count',
  'creative_variant',
  'feature',
  'grounded',
  'is_opened',
  'kind',
  'lookup_type',
  'matched',
  'medium',
  'milestone',
  'mode',
  'moment',
  'native_ocr_enabled',
  'on_device',
  'period_type',
  'platform',
  'reaction',
  'reason',
  'refused',
  'result',
  'screen_name',
  'severity',
  'share_id',
  'signal_source',
  'source',
  'streak',
  'surface',
  'type',
  'variant',
] as const;

export type AnalyticsAllowedPropKey = (typeof ANALYTICS_ALLOWED_PROP_KEYS)[number];
type AnalyticsPrimitive = string | number | boolean | null;
type AnalyticsRule =
  | Readonly<{ kind: 'app_version' }>
  | Readonly<{ kind: 'build_number' }>
  | Readonly<{ kind: 'enum'; values: readonly AnalyticsPrimitive[] }>
  | Readonly<{ kind: 'integer'; max: number; min: number }>
  | Readonly<{ kind: 'opaque_id' }>;
type AnalyticsEventSchema = Readonly<Partial<Record<AnalyticsAllowedPropKey, AnalyticsRule>>>;

const enumValue = <const Values extends readonly AnalyticsPrimitive[]>(
  ...values: Values
): Readonly<{ kind: 'enum'; values: Values }> => ({ kind: 'enum', values });
const integer = (
  min = 0,
  max = 10_000,
): Readonly<{ kind: 'integer'; max: number; min: number }> => ({
  kind: 'integer',
  max,
  min,
});
const opaqueId = { kind: 'opaque_id' } as const;
const appVersion = { kind: 'app_version' } as const;
const buildNumber = { kind: 'build_number' } as const;

const ASK_KINDS = ['deterministic', 'escalate', 'grounded', 'refuse'] as const;
const BARCODE_TYPES = [
  'aztec',
  'codabar',
  'code128',
  'code39',
  'code93',
  'datamatrix',
  'ean13',
  'ean8',
  'itf14',
  'pdf417',
  'qr',
  'unknown',
  'upc_a',
  'upc_e',
] as const;
const CATALOG_RESULTS = [
  'error',
  'external_candidate',
  'matched',
  'no_match',
  'offline',
  'too_short',
] as const;
const FEEDBACK_CATEGORIES = [
  'onboarding_confusion',
  'catalog_match',
  'guidance_trust',
  'routine_checkoff',
  'visual_progress',
  'notifications',
  'paywall_comprehension',
  'privacy_rights',
  'crash_performance',
  'account_auth',
  'app_install',
  'advice_boundary',
  'other',
] as const;
const PERIOD_TYPES = ['reverse_trial', 'trial', 'intro', 'normal', 'prepaid', null] as const;
const REVIEW_MOMENTS = [
  'data_export_success',
  'first_reviewed_conflict',
  'paid_conversion_success',
  'seven_checkoff_days',
] as const;
const SHARE_ATTRIBUTION = {
  app_version: appVersion,
  build_number: buildNumber,
  campaign: enumValue('shelf_conflict_card_v1'),
  content: enumValue('conflict_card'),
  creative_variant: enumValue('story-v1'),
  medium: enumValue('organic_share'),
  platform: enumValue('android', 'ios', 'web'),
  reason: enumValue('invalid_share_id'),
  share_id: opaqueId,
  source: enumValue('share_card'),
} as const;

export const ANALYTICS_EVENT_SCHEMAS = {
  account_created: {},
  ask_consent_granted: {},
  ask_consent_revoked: {},
  ask_escalated_to_clinician: {},
  ask_grounded_gated: { reason: enumValue('cap_reached', 'free_locked') },
  ask_opened: {},
  ask_proactive_lead_shown: {},
  ask_reported_problem: { kind: enumValue(...ASK_KINDS) },
  ask_turn: {
    grounded: enumValue(false),
    kind: enumValue('deterministic', 'escalate', 'refuse'),
    refused: enumValue(false, true),
  },
  barcode_scanned: {
    matched: enumValue(false, true),
    result: enumValue('ambiguous', 'matched', 'no_match', 'offline_queued'),
    source: enumValue('scan'),
  },
  barcode_decode_rejected: {
    barcode_type: enumValue(...BARCODE_TYPES),
    reason: enumValue('checksum'),
  },
  barcode_decode_success: { barcode_type: enumValue(...BARCODE_TYPES) },
  catalog_barcode_lookup: { result: enumValue(...CATALOG_RESULTS, 'unknown') },
  catalog_correction_reported: {
    correction_type: enumValue(
      'category_issue',
      'duplicate',
      'expiry_issue',
      'ingredient_issue',
      'missing_product',
      'source_issue',
      'wrong_match',
    ),
  },
  catalog_lookup_no_match: { lookup_type: enumValue('search') },
  catalog_search: { result: enumValue(...CATALOG_RESULTS) },
  commerce_consent_declined: {},
  commerce_consent_granted: {},
  community_consent_granted: {},
  comparison_viewed: {},
  conflict_detected: { count: integer(1) },
  conflict_overridden: { source: enumValue('detail') },
  conflict_resolution_chosen: {
    action: enumValue('keep', 'use_together'),
    source: enumValue('detail'),
  },
  contextual_paywall_shown: {
    feature: enumValue(
      'ask',
      'conflict_checks',
      'full_routine',
      'photo_timeline',
      'reminders_widgets',
      'scheduler',
    ),
  },
  cycle_night_completed: { moment: enumValue('pm'), source: enumValue('today') },
  cycle_paused: {},
  cycle_recovery_started: {},
  cycle_resumed: {},
  cycle_started: {},
  cycle_variant_changed: { variant: enumValue('advanced', 'auto', 'classic', 'custom', 'gentle') },
  first_checkoff_completed: { moment: enumValue('am', 'pm') },
  first_photo_captured: {},
  first_routine_created: { source: enumValue('routine_plan') },
  first_useful_insight: {
    count: integer(1),
    source: enumValue('reveal', 'routine_plan'),
  },
  health_consent_declined: {},
  ingredient_parse_completed: {
    count: integer(),
    native_ocr_enabled: enumValue(false, true),
    result: enumValue('failed', 'parsed', 'partial'),
    source: enumValue('manual', 'ocr_label_capture'),
  },
  label_capture_photo_taken: { native_ocr_enabled: enumValue(false, true) },
  landing_viewed: SHARE_ATTRIBUTION,
  manage_subscription_opened: {},
  night_skipped: {},
  notification_prompt_denied: {},
  notification_prompt_granted: {},
  notification_prompt_shown: {},
  onboarding_started: {},
  opened_date_set: { is_opened: enumValue(false, true) },
  paywall_dismissed: { surface: enumValue('paywall') },
  paywall_shown: {
    context: enumValue('reverse_trial_keep_options', 'reverse_trial_reoffer'),
    count: integer(),
  },
  personalization_shown: {},
  phase7_deferred_surface_viewed: {
    surface: enumValue(
      'cloudAsk',
      'commerce',
      'communityPosting',
      'goalActiveRecommendations',
      'shareCard',
      'trend',
      'widgets',
    ),
  },
  phased_intro_overridden: {},
  photo_capture_still_taken: { signal_source: enumValue('post_capture_measurement') },
  photo_baseline_added: { on_device: enumValue(true) },
  photo_captured: { on_device: enumValue(true) },
  preference_set: {},
  product_add_started: {
    source: enumValue(
      'catalog_manual',
      'commerce',
      'empty_manual',
      'empty_scan',
      'miss_label',
      'miss_manual',
      'miss_search',
      'onboarding',
      'opened_recovery',
      'recommendation',
      'scan_fab',
      'scan_inline',
      'scan_label',
      'scan_manual',
      'scan_search',
      'share_manual',
      'share_scan',
    ),
  },
  product_added: { added_via: enumValue('barcode', 'manual', 'ocr', 'onboarding', 'search') },
  product_discarded: { source: enumValue('shelf') },
  product_finished: { source: enumValue('shelf') },
  purchase_completed: {
    period_type: enumValue('reverse_trial', 'intro', 'normal', 'prepaid', null),
    source: enumValue('revenuecat'),
  },
  quiz_completed: {},
  quiz_question_answered: { count: integer(1), type: enumValue('single') },
  reaction_added: { reaction: enumValue('helped') },
  recommendation_accepted: {},
  recommendation_dismissed: {},
  recommendation_expanded: {},
  recommendation_shown: { count: integer(1) },
  reference_reset: {},
  replenishment_nudge_shown: { source: enumValue('shelf') },
  replenishment_nudge_tapped: { action: enumValue('re_add', 'see_similar') },
  restore_tapped: {},
  review_prompt_attempted: { moment: enumValue(...REVIEW_MOMENTS) },
  review_prompt_skipped: {
    moment: enumValue(...REVIEW_MOMENTS),
    reason: enumValue('annual_cap', 'cooldown', 'disabled', 'not_value_moment'),
  },
  review_prompt_unavailable: { moment: enumValue(...REVIEW_MOMENTS) },
  reverse_trial_expired: {},
  reverse_trial_started: {
    source: enumValue('app_granted', 'local_cache', 'revenuecat', 'server'),
  },
  ramp_step_up_accepted: { source: enumValue('routine_ramp') },
  ramp_step_up_offered: { source: enumValue('routine_ramp') },
  routine_edited: {
    action: enumValue('cycle_customized', 'reordered'),
    mode: enumValue('am', 'both', 'pm'),
    source: enumValue('cycle_settings', 'routine_reorder'),
  },
  routine_checkoff_completed: { moment: enumValue('am', 'pm') },
  routine_created: { source: enumValue('routine_plan') },
  routine_plan_viewed: { source: enumValue('example', 'routine_plan') },
  screen_viewed: {
    count: integer(),
    screen_name: enumValue('age_gate', 'goals', 'health_consent', 'products_intake', 'reveal'),
  },
  scan_matched: { result: enumValue('matched'), source: enumValue('scan') },
  scan_no_match: { result: enumValue('no_match'), source: enumValue('scan') },
  subscription_cancel_intent: {
    period_type: enumValue(...PERIOD_TYPES),
    source: enumValue('subscription_settings'),
  },
  support_contact_failed: {
    category: enumValue(...FEEDBACK_CATEGORIES),
    result: enumValue('unavailable'),
    severity: enumValue('p0', 'p1', 'p2', 'p3'),
    source: enumValue('beta_feedback', 'settings'),
  },
  support_contact_opened: {
    category: enumValue(...FEEDBACK_CATEGORIES),
    result: enumValue('opened'),
    severity: enumValue('p0', 'p1', 'p2', 'p3'),
    source: enumValue('beta_feedback', 'settings'),
  },
  share_card_export_failed: {
    creative_variant: enumValue('story-v1'),
    reason: enumValue('exception', 'public_link_unavailable', 'share_unavailable'),
    share_id: opaqueId,
  },
  share_card_export_started: { creative_variant: enumValue('story-v1') },
  share_card_export_succeeded: {
    creative_variant: enumValue('story-v1'),
    share_id: opaqueId,
  },
  share_card_exported: { creative_variant: enumValue('story-v1'), share_id: opaqueId },
  share_link_created: { creative_variant: enumValue('story-v1'), share_id: opaqueId },
  share_link_opened: SHARE_ATTRIBUTION,
  share_sheet_opened: { creative_variant: enumValue('story-v1'), share_id: opaqueId },
  skin_note_viewed: { surface: enumValue('detail', 'hub', 'in_context') },
  stack_viewed: { source: enumValue('stack') },
  step_reordered: {
    action: enumValue('saved'),
    mode: enumValue('am', 'both', 'pm'),
    source: enumValue('routine_reorder'),
  },
  streak_milestone_reached: {
    milestone: enumValue('d30', 'd7', 'one_cycle'),
    streak: integer(1),
  },
  timeline_viewed: {},
  transparency_viewed: {},
  trend_consent_revoked: {},
  trend_insights_opted_in: {},
  trend_shown: {},
  trial_started: { period_type: enumValue('trial'), source: enumValue('revenuecat') },
  where_to_buy_clicked: { source: enumValue('direct', 'none', 'shopmy', 'skimlinks', 'stack') },
  where_to_buy_link_failed: { source: enumValue('direct', 'none', 'shopmy', 'skimlinks') },
  why_tonight_viewed: {},
  winback_converted: {
    period_type: enumValue(...PERIOD_TYPES),
    source: enumValue('revenuecat'),
  },
  winback_shown: {},
  youre_set_shown: {},
} as const satisfies Record<AnalyticsAllowedEventName, AnalyticsEventSchema>;

type RuleValue<Rule> =
  Rule extends Readonly<{ kind: 'enum'; values: infer Values }>
    ? Values extends readonly AnalyticsPrimitive[]
      ? Values[number]
      : never
    : Rule extends Readonly<{ kind: 'integer' }>
      ? number
      : Rule extends Readonly<{ kind: 'app_version' | 'build_number' | 'opaque_id' }>
        ? string
        : never;

type SchemaProps<Event extends AnalyticsAllowedEventName> = {
  [Key in keyof (typeof ANALYTICS_EVENT_SCHEMAS)[Event]]: RuleValue<
    (typeof ANALYTICS_EVENT_SCHEMAS)[Event][Key]
  >;
};

type AskTurnProps = Pick<SchemaProps<'ask_turn'>, 'grounded'> &
  (
    | { kind: 'refuse'; refused: true }
    | {
        kind: Exclude<SchemaProps<'ask_turn'>['kind'], 'refuse'>;
        refused: false;
      }
  );
type BarcodeScannedProps = Pick<SchemaProps<'barcode_scanned'>, 'source'> &
  (
    | { matched: true; result: 'matched' }
    | {
        matched: false;
        result: Exclude<SchemaProps<'barcode_scanned'>['result'], 'matched'>;
      }
  );
type IngredientParseProps = Pick<SchemaProps<'ingredient_parse_completed'>, 'count' | 'result'> &
  (
    | { native_ocr_enabled?: never; source: 'manual' }
    | { native_ocr_enabled: boolean; source: 'ocr_label_capture' }
  );
type LandingProps =
  | ({ reason: 'invalid_share_id' } & {
      [Key in Exclude<keyof SchemaProps<'landing_viewed'>, 'reason'>]?: never;
    })
  | ({ share_id: string; reason?: never } & Partial<
      Omit<SchemaProps<'landing_viewed'>, 'reason' | 'share_id'>
    >);
type PaywallShownProps =
  | { context: SchemaProps<'paywall_shown'>['context']; count?: never }
  | { context?: never; count: number };
type RoutineEditedProps =
  | { action: 'cycle_customized'; mode?: never; source: 'cycle_settings' }
  | {
      action: 'reordered';
      mode: SchemaProps<'routine_edited'>['mode'];
      source: 'routine_reorder';
    };
type ScreenViewedProps =
  | { count: number; screen_name: 'products_intake' }
  | {
      count?: never;
      screen_name: Exclude<SchemaProps<'screen_viewed'>['screen_name'], 'products_intake'>;
    };
type ShareCardFailedProps = Pick<SchemaProps<'share_card_export_failed'>, 'creative_variant'> &
  (
    | { reason: 'share_unavailable'; share_id: string }
    | { reason: 'exception' | 'public_link_unavailable'; share_id?: never }
  );
type StreakMilestoneProps = Omit<SchemaProps<'streak_milestone_reached'>, 'streak'> &
  Partial<Pick<SchemaProps<'streak_milestone_reached'>, 'streak'>>;
type SupportContactProps<Event extends 'support_contact_failed' | 'support_contact_opened'> = Pick<
  SchemaProps<Event>,
  'result'
> &
  (
    | { category?: never; severity?: never; source: 'settings' }
    | (Required<Pick<SchemaProps<Event>, 'category' | 'severity'>> & {
        source: 'beta_feedback';
      })
  );

type SpecialAnalyticsEventProps = {
  ask_turn: AskTurnProps;
  barcode_scanned: BarcodeScannedProps;
  ingredient_parse_completed: IngredientParseProps;
  landing_viewed: LandingProps;
  paywall_shown: PaywallShownProps;
  routine_edited: RoutineEditedProps;
  screen_viewed: ScreenViewedProps;
  share_card_export_failed: ShareCardFailedProps;
  share_link_opened: LandingProps;
  streak_milestone_reached: StreakMilestoneProps;
  support_contact_failed: SupportContactProps<'support_contact_failed'>;
  support_contact_opened: SupportContactProps<'support_contact_opened'>;
};

export type AnalyticsEventProps<Event extends AnalyticsAllowedEventName> =
  Event extends keyof SpecialAnalyticsEventProps
    ? SpecialAnalyticsEventProps[Event]
    : SchemaProps<Event>;

export type AnalyticsEventWithoutProps = {
  [Event in AnalyticsAllowedEventName]: keyof (typeof ANALYTICS_EVENT_SCHEMAS)[Event] extends never
    ? Event
    : never;
}[AnalyticsAllowedEventName];

export type AnalyticsEventWithProps = Exclude<
  AnalyticsAllowedEventName,
  AnalyticsEventWithoutProps
>;

type KeysOfUnion<Value> = Value extends Value ? keyof Value : never;

export type ExactAnalyticsEventProps<
  Event extends AnalyticsEventWithProps,
  Actual extends AnalyticsEventProps<Event>,
> = Actual & Record<Exclude<keyof Actual, KeysOfUnion<AnalyticsEventProps<Event>>>, never>;

type AnalyticsPayloadShape = Readonly<{
  integers?: Readonly<
    Partial<Record<AnalyticsAllowedPropKey, Readonly<{ max: number; min: number }>>>
  >;
  required: readonly AnalyticsAllowedPropKey[];
  optional?: readonly AnalyticsAllowedPropKey[];
  values?: Readonly<Partial<Record<AnalyticsAllowedPropKey, readonly AnalyticsPrimitive[]>>>;
}>;

export const ANALYTICS_SPECIAL_PAYLOAD_SHAPES = {
  ask_turn: [
    {
      required: ['grounded', 'kind', 'refused'],
      values: { kind: ['refuse'], refused: [true] },
    },
    {
      required: ['grounded', 'kind', 'refused'],
      values: {
        kind: ['deterministic', 'escalate'],
        refused: [false],
      },
    },
  ],
  barcode_scanned: [
    {
      required: ['matched', 'result', 'source'],
      values: { matched: [true], result: ['matched'] },
    },
    {
      required: ['matched', 'result', 'source'],
      values: {
        matched: [false],
        result: ['ambiguous', 'no_match', 'offline_queued'],
      },
    },
  ],
  ingredient_parse_completed: [
    {
      required: ['count', 'result', 'source'],
      integers: { count: { max: 0, min: 0 } },
      values: { result: ['failed'], source: ['manual'] },
    },
    {
      required: ['count', 'result', 'source'],
      integers: { count: { max: 10_000, min: 1 } },
      values: { result: ['parsed', 'partial'], source: ['manual'] },
    },
    {
      required: ['count', 'native_ocr_enabled', 'result', 'source'],
      integers: { count: { max: 0, min: 0 } },
      values: { result: ['failed'], source: ['ocr_label_capture'] },
    },
    {
      required: ['count', 'native_ocr_enabled', 'result', 'source'],
      integers: { count: { max: 10_000, min: 1 } },
      values: { result: ['parsed', 'partial'], source: ['ocr_label_capture'] },
    },
  ],
  landing_viewed: [
    { required: ['reason'] },
    {
      required: ['share_id'],
      optional: [
        'app_version',
        'build_number',
        'campaign',
        'content',
        'creative_variant',
        'medium',
        'platform',
        'source',
      ],
    },
  ],
  paywall_shown: [{ required: ['context'] }, { required: ['count'] }],
  routine_edited: [
    {
      required: ['action', 'source'],
      values: { action: ['cycle_customized'], source: ['cycle_settings'] },
    },
    {
      required: ['action', 'mode', 'source'],
      values: { action: ['reordered'], source: ['routine_reorder'] },
    },
  ],
  screen_viewed: [
    {
      required: ['count', 'screen_name'],
      values: { screen_name: ['products_intake'] },
    },
    {
      required: ['screen_name'],
      values: { screen_name: ['age_gate', 'goals', 'health_consent', 'reveal'] },
    },
  ],
  share_card_export_failed: [
    {
      required: ['creative_variant', 'reason', 'share_id'],
      values: { reason: ['share_unavailable'] },
    },
    {
      required: ['creative_variant', 'reason'],
      values: { reason: ['exception', 'public_link_unavailable'] },
    },
  ],
  share_link_opened: [
    { required: ['reason'] },
    {
      required: ['share_id'],
      optional: [
        'app_version',
        'build_number',
        'campaign',
        'content',
        'creative_variant',
        'medium',
        'platform',
        'source',
      ],
    },
  ],
  streak_milestone_reached: [{ required: ['milestone'], optional: ['streak'] }],
  support_contact_failed: [
    {
      required: ['result', 'source'],
      values: { source: ['settings'] },
    },
    {
      required: ['category', 'result', 'severity', 'source'],
      values: { source: ['beta_feedback'] },
    },
  ],
  support_contact_opened: [
    {
      required: ['result', 'source'],
      values: { source: ['settings'] },
    },
    {
      required: ['category', 'result', 'severity', 'source'],
      values: { source: ['beta_feedback'] },
    },
  ],
} as const satisfies Partial<Record<AnalyticsAllowedEventName, readonly AnalyticsPayloadShape[]>>;

const allowedEvents = new Set<string>(ANALYTICS_ALLOWED_EVENTS);
const allowedProps = new Set<string>(ANALYTICS_ALLOWED_PROP_KEYS);

export function isAllowedAnalyticsEventName(event: string): event is AnalyticsAllowedEventName {
  return allowedEvents.has(event);
}

export function isAllowedAnalyticsPropKey(key: string): key is AnalyticsAllowedPropKey {
  return allowedProps.has(key);
}

export function analyticsSchemaForEvent(event: AnalyticsAllowedEventName): AnalyticsEventSchema {
  return ANALYTICS_EVENT_SCHEMAS[event];
}

function hasPayloadShape(
  payload: Readonly<Record<string, AnalyticsPrimitive>>,
  shape: AnalyticsPayloadShape,
): boolean {
  const keys = Object.keys(payload);
  const allowed = new Set<string>([...shape.required, ...(shape.optional ?? [])]);
  if (
    !shape.required.every((key) => keys.includes(key)) ||
    !keys.every((key) => allowed.has(key))
  ) {
    return false;
  }
  return (
    Object.entries(shape.values ?? {}).every(
      ([key, values]) => values?.includes(payload[key]) ?? false,
    ) &&
    Object.entries(shape.integers ?? {}).every(([key, range]) => {
      const value = payload[key];
      return (
        range !== undefined &&
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= range.min &&
        value <= range.max
      );
    })
  );
}

export function analyticsPayloadShapesForEvent(
  event: AnalyticsAllowedEventName,
): readonly AnalyticsPayloadShape[] {
  const special = ANALYTICS_SPECIAL_PAYLOAD_SHAPES[
    event as keyof typeof ANALYTICS_SPECIAL_PAYLOAD_SHAPES
  ] as readonly AnalyticsPayloadShape[] | undefined;
  return (
    special ?? [
      { required: Object.keys(ANALYTICS_EVENT_SCHEMAS[event]) as AnalyticsAllowedPropKey[] },
    ]
  );
}

export function isAllowedAnalyticsPayloadShape(
  event: AnalyticsAllowedEventName,
  payload: Readonly<Record<string, AnalyticsPrimitive>>,
): boolean {
  return analyticsPayloadShapesForEvent(event).some((shape) => hasPayloadShape(payload, shape));
}

export function isAllowedAnalyticsPropValue(rule: AnalyticsRule, value: unknown): boolean {
  switch (rule.kind) {
    case 'enum':
      return rule.values.includes(value as AnalyticsPrimitive);
    case 'integer':
      return Number.isSafeInteger(value) && Number(value) >= rule.min && Number(value) <= rule.max;
    case 'opaque_id':
      return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
    case 'app_version':
      return (
        typeof value === 'string' &&
        /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:[-+][A-Za-z0-9.-]{1,32})?$/.test(value)
      );
    case 'build_number':
      return typeof value === 'string' && /^(?:dev|\d{1,18})$/.test(value);
  }
}
