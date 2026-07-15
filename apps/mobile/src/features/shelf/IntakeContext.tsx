import * as Crypto from 'expo-crypto';
import type { AddedVia, PaoSource } from '@onskin/types';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { CatalogQualityGrade } from '@/features/catalog/quality';

import type { ProductCategory } from './categories';

// Transient draft shared across the intake funnel (docs/04 §4): manual / OCR /
// no-match screens fill it, the opened-date linchpin (§4.5) finalises it into a
// shelf row. In-memory only. Nothing is persisted until "Add to shelf".
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
  /** Parsed/typed INCI tokens. The engine tags off these + the name. */
  ingredients: string[];
  addedVia: AddedVia;
  /** Resolved PAO (from the category default), editable at the opened-date step. */
  paoMonths: number | null;
  paoSource: PaoSource;
  expiryDate: string | null;
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
};

type IntakeContextValue = {
  draft: IntakeDraft;
  /** Stable for one intake; reset rotates it for the next explicit intent. */
  addOperationId: string;
  update: (patch: Partial<IntakeDraft>) => void;
  reset: (init?: Partial<IntakeDraft>) => void;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

export function IntakeProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<IntakeDraft>(() => ({ ...EMPTY }));
  const [addOperationId, setAddOperationId] = useState(() => Crypto.randomUUID());
  const update = useCallback((patch: Partial<IntakeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);
  const reset = useCallback((init?: Partial<IntakeDraft>) => {
    setDraft({ ...EMPTY, ...init });
    setAddOperationId(Crypto.randomUUID());
  }, []);
  const value = useMemo<IntakeContextValue>(
    () => ({
      draft,
      addOperationId,
      update,
      reset,
    }),
    [addOperationId, draft, reset, update],
  );
  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntake(): IntakeContextValue {
  const ctx = useContext(IntakeContext);
  if (!ctx) throw new Error('useIntake must be used within IntakeProvider');
  return ctx;
}
