export type PhotoNoteSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type PhotoNoteSaveSnapshot = Readonly<{
  draft: string;
  persisted: string;
  status: PhotoNoteSaveStatus;
}>;

type Listener = (snapshot: PhotoNoteSaveSnapshot) => void;

export type PhotoNoteSaveCoordinator = Readonly<{
  getSnapshot: () => PhotoNoteSaveSnapshot;
  requestSave: () => Promise<void>;
  setCommit: (commit: (notes: string) => Promise<void>) => void;
  subscribe: (listener: Listener) => () => void;
  updateDraft: (draft: string) => void;
}>;

/**
 * Serializes blur saves without moving keystroke state into the photo-detail
 * route. A second request while one write is pending coalesces to the newest
 * explicitly requested draft. Failures stop the loop so retry is always an
 * explicit user action.
 */
export function createPhotoNoteSaveCoordinator({
  commit,
  initialNotes,
}: {
  commit: (notes: string) => Promise<void>;
  initialNotes: string;
}): PhotoNoteSaveCoordinator {
  let commitCurrent = commit;
  let snapshot: PhotoNoteSaveSnapshot = {
    draft: initialNotes,
    persisted: initialNotes,
    status: 'idle',
  };
  let inFlightDraft: string | null = null;
  let queuedDraft: string | null = null;
  let savePromise: Promise<void> | null = null;
  const listeners = new Set<Listener>();

  const publish = (next: PhotoNoteSaveSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener(snapshot);
  };

  const runSaveLoop = async (initialDraft: string) => {
    let requestedDraft = initialDraft;
    while (true) {
      inFlightDraft = requestedDraft;

      publish({ ...snapshot, status: 'saving' });
      try {
        await commitCurrent(requestedDraft);
      } catch {
        inFlightDraft = null;
        queuedDraft = null;
        publish({ ...snapshot, status: 'error' });
        return;
      }

      publish({
        ...snapshot,
        persisted: requestedDraft,
        status: snapshot.draft === requestedDraft ? 'saved' : 'idle',
      });
      inFlightDraft = null;
      const nextDraft = queuedDraft;
      queuedDraft = null;
      if (nextDraft === null || nextDraft === snapshot.persisted) return;
      requestedDraft = nextDraft;
    }
  };

  return {
    getSnapshot: () => snapshot,
    requestSave: () => {
      const requestedDraft = snapshot.draft;
      if (requestedDraft === snapshot.persisted && !savePromise) return Promise.resolve();
      if (savePromise) {
        // The latest explicit request wins, including a reversion to the in-flight text.
        queuedDraft = requestedDraft === inFlightDraft ? null : requestedDraft;
        return savePromise;
      }
      savePromise = runSaveLoop(requestedDraft).finally(() => {
        savePromise = null;
      });
      return savePromise;
    },
    setCommit: (nextCommit) => {
      commitCurrent = nextCommit;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updateDraft: (draft) => {
      publish({
        ...snapshot,
        draft,
        status:
          snapshot.status === 'saving'
            ? 'saving'
            : draft === snapshot.persisted
              ? 'saved'
              : snapshot.status === 'error'
                ? 'error'
                : 'idle',
      });
    },
  };
}
