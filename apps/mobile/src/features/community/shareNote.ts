import { Share } from 'react-native';

import { COMMUNITY_COPY } from './copy';
import type { SkinNote } from './notes';

export const SHARE_FAILURE_MESSAGE =
  "We couldn't open the share sheet. You can still read this note in Skin Notes.";

function shouldForceShareFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return process.env.EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE === '1';
}

export function buildSkinNoteShareMessage(note: SkinNote): string {
  return [
    note.claim,
    `${note.verdict}. ${note.why}`,
    COMMUNITY_COPY.card.disclaimer,
    `${COMMUNITY_COPY.card.sourceLead} ${note.sourceLabel}. ${COMMUNITY_COPY.card.reviewedByLead} ${note.authorCredential.toLowerCase()}.`,
  ].join('\n\n');
}

export async function shareSkinNote(note: SkinNote): Promise<boolean> {
  try {
    if (shouldForceShareFailure()) throw new Error('E2E_SHARE_NOTE_FAILURE');
    await Share.share({ message: buildSkinNoteShareMessage(note) });
    return true;
  } catch {
    return false;
  }
}
