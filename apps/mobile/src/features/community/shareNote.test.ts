import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COMMUNITY_COPY } from './copy';
import { SKIN_NOTES } from './notes';
import { buildSkinNoteShareMessage, shareSkinNote } from './shareNote';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  share: vi.fn(),
}));

vi.mock('react-native', () => ({
  Share: {
    share: mocks.share,
  },
}));

describe('community note sharing', () => {
  beforeEach(() => {
    mocks.share.mockReset();
    delete process.env.EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE;
  });

  it('keeps the note disclaimer and source context in outbound share text', () => {
    const note = SKIN_NOTES[0]!;
    const message = buildSkinNoteShareMessage(note);

    expect(message).toContain(note.claim);
    expect(message).toContain(note.verdict);
    expect(message).toContain(COMMUNITY_COPY.card.disclaimer);
    expect(message).toContain(`${COMMUNITY_COPY.card.sourceLead} ${note.sourceLabel}.`);
    expect(message).toContain(
      `${COMMUNITY_COPY.card.reviewedByLead} ${note.authorCredential.toLowerCase()}.`,
    );
  });

  it('returns true after opening the native share sheet', async () => {
    const note = SKIN_NOTES[0]!;
    mocks.share.mockResolvedValueOnce({ action: 'sharedAction' });

    await expect(shareSkinNote(note)).resolves.toBe(true);

    expect(mocks.share).toHaveBeenCalledWith({ message: buildSkinNoteShareMessage(note) });
  });

  it('returns false without opening a native alert when the share sheet fails', async () => {
    mocks.share.mockRejectedValueOnce(new Error('share unavailable'));

    await expect(shareSkinNote(SKIN_NOTES[0]!)).resolves.toBe(false);
  });

  it('supports a dev-only E2E fixture for failed note sharing', async () => {
    const globalWithDev = globalThis as typeof globalThis & { __DEV__?: boolean };
    const previousDev = globalWithDev.__DEV__;
    globalWithDev.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE = '1';

    try {
      await expect(shareSkinNote(SKIN_NOTES[0]!)).resolves.toBe(false);
    } finally {
      if (previousDev === undefined) {
        delete globalWithDev.__DEV__;
      } else {
        globalWithDev.__DEV__ = previousDev;
      }
      delete process.env.EXPO_PUBLIC_E2E_SHARE_NOTE_FAILURE;
    }

    expect(mocks.share).not.toHaveBeenCalled();
  });

  it('keeps the note route on the claim-safe share helper', () => {
    const source = readSource('app/community/note/[id].tsx');
    const shareHelper = readSource('features/community/shareNote.ts');

    expect(source).toContain(
      'const [shareFeedback, setShareFeedback] = useState<string | null>(null);',
    );
    expect(source).toContain('const shared = await shareSkinNote(note);');
    expect(source).toContain('if (!shared) {');
    expect(source).toContain('setShareFeedback(SHARE_FAILURE_MESSAGE);');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).not.toContain('Share.share');
    expect(shareHelper).not.toContain('Alert.alert');
  });
});
