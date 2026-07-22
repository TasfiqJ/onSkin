import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  clearIntakeSessionIfCurrent,
  createEmptyIntakeSession,
  createIntakeDraft,
  type IntakeDraft,
  type IntakeSessionState,
} from './intakeSession';

export {
  createIntakeDraft,
  isCurrentIntakeSession,
  type CatalogRecoveryToken,
  type IntakeDraft,
} from './intakeSession';

// Transient draft shared across the intake funnel (docs/04 §4): manual / OCR /
// no-match screens fill it, the opened-date linchpin (§4.5) finalises it into a
// shelf row. In-memory only. Nothing is persisted until "Add to shelf".
type IntakeContextValue = {
  draft: IntakeDraft;
  sessionId: string | null;
  /** Starts a new exact intake session and returns its opaque route token. */
  reset: (init?: Partial<IntakeDraft>) => string;
  /** Ends the current intake without starting another session. */
  clear: () => void;
  /** Ends only the session owned by an async completion. */
  clearIfCurrent: (expectedSessionId: string) => boolean;
  /** Reads the latest session synchronously, including same-frame resets. */
  isSessionCurrent: (expectedSessionId: string) => boolean;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

export function IntakeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IntakeSessionState>(() => createEmptyIntakeSession());
  const stateRef = useRef<IntakeSessionState>(state);
  const value = useMemo<IntakeContextValue>(
    () => ({
      draft: state.draft,
      sessionId: state.sessionId,
      reset: (init) => {
        const nextSessionId = randomUUID();
        const next = { draft: createIntakeDraft(init), sessionId: nextSessionId };
        stateRef.current = next;
        setState(next);
        return nextSessionId;
      },
      clear: () => {
        const next = createEmptyIntakeSession();
        stateRef.current = next;
        setState(next);
      },
      clearIfCurrent: (expectedSessionId) => {
        const current = stateRef.current;
        const next = clearIntakeSessionIfCurrent(current, expectedSessionId);
        if (next === current) return false;
        stateRef.current = next;
        setState(next);
        return true;
      },
      isSessionCurrent: (expectedSessionId) => stateRef.current.sessionId === expectedSessionId,
    }),
    [state],
  );
  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntake(): IntakeContextValue {
  const ctx = useContext(IntakeContext);
  if (!ctx) throw new Error('useIntake must be used within IntakeProvider');
  return ctx;
}
