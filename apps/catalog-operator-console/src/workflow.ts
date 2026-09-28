import type { ItemDetail, ItemKind } from './operatorApi';

export interface TransitionOption {
  readonly decision: string;
  readonly reasonCode: string;
  readonly label: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const correctionTriageReasons: ReadonlyArray<readonly [string, string]> = [
  ['wrong_match_confirmed', 'Wrong product match confirmed'],
  ['ingredient_risk_confirmed', 'Ingredient risk confirmed'],
  ['source_defect_confirmed', 'Source defect confirmed'],
  ['expiry_defect_confirmed', 'Expiry defect confirmed'],
  ['category_defect_confirmed', 'Category defect confirmed'],
  ['duplicate_confirmed', 'Duplicate product confirmed'],
  ['missing_product_confirmed', 'Missing product confirmed'],
];
const correctionTriage: readonly TransitionOption[] = correctionTriageReasons.map(
  ([reasonCode, label]) => ({ decision: 'triage', reasonCode, label }),
);

const correctionDisposition: readonly TransitionOption[] = [
  { decision: 'accept', reasonCode: 'repair_required', label: 'Accept: repair required' },
  { decision: 'reject', reasonCode: 'not_reproducible', label: 'Reject: not reproducible' },
  { decision: 'reject', reasonCode: 'report_incorrect', label: 'Reject: report incorrect' },
  {
    decision: 'reject',
    reasonCode: 'insufficient_evidence',
    label: 'Reject: insufficient evidence',
  },
];

const sourceReview: readonly TransitionOption[] = [
  { decision: 'acknowledge', reasonCode: 'reviewed_no_change', label: 'Reviewed: no change' },
  { decision: 'request_changes', reasonCode: 'rights_gap', label: 'Request changes: rights gap' },
  {
    decision: 'request_changes',
    reasonCode: 'attribution_gap',
    label: 'Request changes: attribution gap',
  },
  {
    decision: 'request_changes',
    reasonCode: 'artifact_gap',
    label: 'Request changes: artifact gap',
  },
  {
    decision: 'request_changes',
    reasonCode: 'quality_gap',
    label: 'Request changes: quality gap',
  },
  {
    decision: 'request_changes',
    reasonCode: 'provenance_gap',
    label: 'Request changes: provenance gap',
  },
  {
    decision: 'escalate',
    reasonCode: 'legal_review_required',
    label: 'Escalate: legal review required',
  },
  {
    decision: 'escalate',
    reasonCode: 'security_review_required',
    label: 'Escalate: security review required',
  },
  {
    decision: 'escalate',
    reasonCode: 'source_withdrawal_risk',
    label: 'Escalate: source withdrawal risk',
  },
];

const importRecommendations: readonly TransitionOption[] = [
  {
    decision: 'recommend_promotion',
    reasonCode: 'evidence_complete',
    label: 'Recommend promotion: evidence complete',
  },
  {
    decision: 'recommend_rollback',
    reasonCode: 'integrity_failure',
    label: 'Recommend rollback: integrity failure',
  },
  {
    decision: 'recommend_rollback',
    reasonCode: 'source_withdrawn',
    label: 'Recommend rollback: source withdrawn',
  },
  {
    decision: 'recommend_rollback',
    reasonCode: 'quality_regression',
    label: 'Recommend rollback: quality regression',
  },
];

function has(capabilities: ReadonlySet<string>, capability: string): boolean {
  return capabilities.has(capability);
}

export function canReadQueue(kind: 'correction' | 'source_import', capabilities: ReadonlySet<string>): boolean {
  return has(capabilities, kind === 'correction' ? 'correction_queue_read' : 'source_queue_read');
}

export function canClaim(kind: ItemKind, capabilities: ReadonlySet<string>): boolean {
  if (kind === 'correction_report') return has(capabilities, 'correction_claim');
  if (kind === 'catalog_source' || kind === 'import_batch') {
    return has(capabilities, 'source_claim');
  }
  return has(capabilities, 'catalog_hold_claim');
}

export function transitionOptionsFor(
  detail: ItemDetail,
  capabilities: ReadonlySet<string>,
): readonly TransitionOption[] {
  if (detail.itemKind === 'correction_report') {
    if (detail.status === 'open' && has(capabilities, 'correction_triage')) {
      return correctionTriage;
    }
    if (detail.status === 'triaged' && has(capabilities, 'correction_disposition')) {
      return correctionDisposition;
    }
    return [];
  }
  if (
    (detail.itemKind === 'catalog_source' || detail.itemKind === 'import_batch') &&
    has(capabilities, 'source_review_record')
  ) {
    return detail.itemKind === 'import_batch'
      ? [...sourceReview, ...importRecommendations]
      : sourceReview;
  }
  if (
    detail.itemKind === 'product_hold' &&
    detail.status === 'active' &&
    has(capabilities, 'catalog_repair_attest')
  ) {
    return [
      {
        decision: 'attest_repair',
        reasonCode: 'cat02_cat03_repair_verified',
        label: 'Attest exact CAT02 + CAT03 repair proof',
      },
    ];
  }
  return [];
}

export function releaseReceiptId(
  detail: ItemDetail,
  capabilities: ReadonlySet<string>,
): string | null {
  if (
    detail.itemKind !== 'product_hold' ||
    detail.status !== 'repair_attested' ||
    !has(capabilities, 'catalog_hold_release')
  ) {
    return null;
  }
  const value = detail.detail.repairReceiptId;
  return typeof value === 'string' && UUID_PATTERN.test(value.toLowerCase())
    ? value.toLowerCase()
    : null;
}

export function leaseIsCurrent(expiresAt: string, nowMs: number): boolean {
  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && Number.isFinite(nowMs) && expiresAtMs > nowMs;
}
