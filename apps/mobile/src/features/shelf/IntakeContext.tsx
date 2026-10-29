import { randomUUID } from 'expo-crypto';
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
} from '@/lib/consent/healthProcessingEpoch';

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
  /** A retired opaque token may remain as provenance; it grants no session authority. */
  sessionId: string | null;
  /** Retires mounted form state on every reset or clear, including null-session ABA. */
  draftRevision: number;
  /** Incoming form values belong only to the grant that created them. */
  draftLeaseGeneration: number | undefined;
  isDraftCurrent: (expectedDraft: IntakeDraft) => boolean;
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
  const draftAuthority = useRef(activeHealthProcessingLeaseSnapshot()?.generation);
  const sessionAuthority = useRef<number | undefined>(undefined);
  const [draftMetadata, setDraftMetadata] = useState<{
    revision: number;
    leaseGeneration: number | undefined;
  }>(() => ({ revision: 0, leaseGeneration: activeHealthProcessingLeaseSnapshot()?.generation }));
  const subscribeLease = useMemo(
    () => (notify: () => void) => {
      let expiryTimer: ReturnType<typeof setTimeout> | undefined;
      const reconcile = () => {
        clearTimeout(expiryTimer);
        const lease = activeHealthProcessingLeaseSnapshot();
        if (draftAuthority.current !== lease?.generation) {
          // Keep only the opaque token so a retired completion cannot claim it
          // cleared a newer draft. Private content and session authority retire.
          const next = { draft: createIntakeDraft(), sessionId: stateRef.current.sessionId };
          draftAuthority.current = lease?.generation;
          sessionAuthority.current = undefined;
          stateRef.current = next;
          setState(next);
          setDraftMetadata((previous) => ({
            revision: previous.revision + 1,
            leaseGeneration: lease?.generation,
          }));
        }
        notify();
        if (lease?.expiresAt != null)
          expiryTimer = setTimeout(reconcile, Math.max(0, lease.expiresAt - Date.now()) + 1);
      };
      const unsubscribe = subscribeActiveHealthProcessingLeaseChanges(reconcile);
      // Reconcile transitions between render and subscription as well.
      reconcile();
      return () => {
        clearTimeout(expiryTimer);
        unsubscribe();
      };
    },
    [],
  );
  const lease = useSyncExternalStore(
    subscribeLease,
    activeHealthProcessingLeaseSnapshot,
    () => null,
  );
  const draftVisible =
    state.sessionId === null ||
    (draftMetadata.leaseGeneration !== undefined &&
      draftMetadata.leaseGeneration === lease?.generation);
  const value = useMemo<IntakeContextValue>(
    () => ({
      draft: draftVisible ? state.draft : createIntakeDraft(),
      sessionId: state.sessionId,
      draftRevision: draftMetadata.revision,
      draftLeaseGeneration: draftMetadata.leaseGeneration,
      isDraftCurrent: (expectedDraft) =>
        draftAuthority.current !== undefined &&
        draftAuthority.current === activeHealthProcessingLeaseSnapshot()?.generation &&
        stateRef.current.draft === expectedDraft,
      reset: (init) => {
        if (
          !lease ||
          lease.ownerUserId === null ||
          lease.accountGeneration === null ||
          activeHealthProcessingLeaseSnapshot()?.generation !== lease.generation ||
          stateRef.current.draft !== state.draft
        )
          throw new Error('INTAKE_LEASE_RETIRED');
        const nextSessionId = randomUUID();
        const next = { draft: createIntakeDraft(init), sessionId: nextSessionId };
        const leaseGeneration = lease.generation;
        draftAuthority.current = leaseGeneration;
        sessionAuthority.current = leaseGeneration;
        setDraftMetadata((previous) => ({ revision: previous.revision + 1, leaseGeneration }));
        stateRef.current = next;
        setState(next);
        return nextSessionId;
      },
      clear: () => {
        if (
          !lease ||
          activeHealthProcessingLeaseSnapshot()?.generation !== lease.generation ||
          stateRef.current.draft !== state.draft
        )
          return;
        const next = createEmptyIntakeSession();
        const leaseGeneration = activeHealthProcessingLeaseSnapshot()?.generation;
        draftAuthority.current = leaseGeneration;
        sessionAuthority.current = undefined;
        setDraftMetadata((previous) => ({
          revision: previous.revision + 1,
          leaseGeneration,
        }));
        stateRef.current = next;
        setState(next);
      },
      clearIfCurrent: (expectedSessionId) => {
        if (!lease || activeHealthProcessingLeaseSnapshot()?.generation !== lease.generation)
          return false;
        const current = stateRef.current;
        // A fresh recovery action may release matching empty provenance. Its
        // retired caller cannot borrow this render's lease or clear a successor.
        const inertEmpty =
          sessionAuthority.current === undefined &&
          draftAuthority.current === lease.generation &&
          JSON.stringify(current.draft) === JSON.stringify(createIntakeDraft());
        if (sessionAuthority.current !== lease.generation && !inertEmpty) return false;
        const next = clearIntakeSessionIfCurrent(current, expectedSessionId);
        if (next === current) return false;
        const leaseGeneration = activeHealthProcessingLeaseSnapshot()?.generation;
        draftAuthority.current = leaseGeneration;
        sessionAuthority.current = undefined;
        setDraftMetadata((previous) => ({
          revision: previous.revision + 1,
          leaseGeneration,
        }));
        stateRef.current = next;
        setState(next);
        return true;
      },
      isSessionCurrent: (expectedSessionId) =>
        sessionAuthority.current !== undefined &&
        sessionAuthority.current === activeHealthProcessingLeaseSnapshot()?.generation &&
        stateRef.current.sessionId === expectedSessionId,
    }),
    [state, draftMetadata, draftVisible, lease],
  );
  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntake(): IntakeContextValue {
  const ctx = useContext(IntakeContext);
  if (!ctx) throw new Error('useIntake must be used within IntakeProvider');
  return ctx;
}
