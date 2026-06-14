import type { AddedVia, PaoSource } from '@onskin/types';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ProductCategory } from './categories';

// Transient draft shared across the intake funnel (docs/04 §4): manual / OCR /
// no-match screens fill it, the opened-date linchpin (§4.5) finalises it into a
// shelf row. In-memory only. Nothing is persisted until "Add to shelf".
export type IntakeDraft = {
  name: string;
  brand: string | null;
  category: ProductCategory | null;
  barcode: string | null;
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
  ingredients: [],
  addedVia: 'manual',
  paoMonths: null,
  paoSource: 'unknown',
  expiryDate: null,
};

type IntakeContextValue = {
  draft: IntakeDraft;
  update: (patch: Partial<IntakeDraft>) => void;
  reset: (init?: Partial<IntakeDraft>) => void;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

export function IntakeProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<IntakeDraft>(EMPTY);
  const value = useMemo<IntakeContextValue>(
    () => ({
      draft,
      update: (patch) => setDraft((d) => ({ ...d, ...patch })),
      reset: (init) => setDraft({ ...EMPTY, ...init }),
    }),
    [draft],
  );
  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntake(): IntakeContextValue {
  const ctx = useContext(IntakeContext);
  if (!ctx) throw new Error('useIntake must be used within IntakeProvider');
  return ctx;
}
