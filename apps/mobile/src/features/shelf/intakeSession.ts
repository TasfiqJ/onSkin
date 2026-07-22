import type { AddedVia, PaoSource } from '@onskin/types';

import type { CatalogQualityGrade } from '@/features/catalog/quality';

import type { ProductCategory } from './categories';

export type CatalogRecoveryToken = {
  barcode: string;
  productId: string;
};

export type IntakeDraft = {
  name: string;
  brand: string | null;
  category: ProductCategory | null;
  barcode: string | null;
  catalogProductId: string | null;
  catalogSourceId: string | null;
  catalogSource: string | null;
  catalogSourceName: string | null;
  catalogSourceRef: string | null;
  catalogSourceUrl: string | null;
  catalogSourceSnapshotDate: string | null;
  catalogMatchQuality: CatalogQualityGrade | 'manual' | null;
  dataQualityScore: number | null;
  ingredientParseStatus: string | null;
  ingredientParseConfidence: number | null;
  parserVersion: string | null;
  sourceDisclosureAckAt: string | null;
  ingredients: string[];
  addedVia: AddedVia;
  paoMonths: number | null;
  paoSource: PaoSource;
  expiryDate: string | null;
  catalogRecoveryToken: CatalogRecoveryToken | null;
};

const EMPTY: IntakeDraft = {
  name: '',
  brand: null,
  category: null,
  barcode: null,
  catalogProductId: null,
  catalogSourceId: null,
  catalogSource: null,
  catalogSourceName: null,
  catalogSourceRef: null,
  catalogSourceUrl: null,
  catalogSourceSnapshotDate: null,
  catalogMatchQuality: null,
  dataQualityScore: null,
  ingredientParseStatus: null,
  ingredientParseConfidence: null,
  parserVersion: null,
  sourceDisclosureAckAt: null,
  ingredients: [],
  addedVia: 'manual',
  paoMonths: null,
  paoSource: 'unknown',
  expiryDate: null,
  catalogRecoveryToken: null,
};

export function createIntakeDraft(init: Partial<IntakeDraft> = {}): IntakeDraft {
  const ingredients = Array.isArray(init.ingredients)
    ? init.ingredients
        .filter(
          (ingredient): ingredient is string =>
            typeof ingredient === 'string' && ingredient.trim().length > 0,
        )
        .map((ingredient) => ingredient.trim())
    : [];
  return { ...EMPTY, ...init, ingredients };
}

export function isCurrentIntakeSession(
  currentSessionId: string | null,
  requestedSessionId: string | null | undefined,
): boolean {
  return currentSessionId != null && requestedSessionId === currentSessionId;
}

export type IntakeSessionState = {
  draft: IntakeDraft;
  sessionId: string | null;
};

export function createEmptyIntakeSession(): IntakeSessionState {
  return { draft: createIntakeDraft(), sessionId: null };
}

/** Return the same object when an older async completion no longer owns the
 * active intake session. */
export function clearIntakeSessionIfCurrent(
  state: IntakeSessionState,
  expectedSessionId: string,
): IntakeSessionState {
  return state.sessionId === expectedSessionId ? createEmptyIntakeSession() : state;
}
