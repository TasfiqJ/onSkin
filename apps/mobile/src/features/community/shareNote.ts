import { Alert, Share } from 'react-native';

import { COMMUNITY_COPY } from './copy';
import type { SkinNote } from './notes';

const SHARE_FAILURE_TITLE = 'Sharing unavailable';
const SHARE_FAILURE_MESSAGE =
  "We couldn't open the share sheet. You can still read this note in Skin Notes.";

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
    await Share.share({ message: buildSkinNoteShareMessage(note) });
    return true;
  } catch {
    Alert.alert(SHARE_FAILURE_TITLE, SHARE_FAILURE_MESSAGE);
    return false;
  }
}
