import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { COMMUNITY_COPY } from './copy';
import { evidencePill, noteById } from './notes';

// 03 · In-context "Read the evidence" (docs/11 §9.2, design 03) — a Skin Note attaches
// to a routine step or a conflict resolution (docs/02/09). The library answers the doubt
// exactly where it lands, never as a separate destination to visit. Renders nothing if
// the note isn't shippable (B-DERM-REVIEW gate), so it never shows an unreviewed claim.
export function InContextNote({ noteId }: { noteId: string }) {
  const note = noteById(noteId);
  if (!note) return null;
  const pill = evidencePill(note.evidenceLabel);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${note.claim} ${pill.text}. ${COMMUNITY_COPY.inContext.read}`}
      onPress={() => {
        haptics.select();
        track('skin_note_viewed', { id: note.id, surface: 'in_context' });
        router.push({ pathname: '/community/note/[id]', params: { id: note.id } });
      }}
      className="rounded-[18px] bg-paper-raised p-4"
      style={{ borderWidth: 1, borderColor: colors.hairline }}>
      <Text variant="label" tone="muted" className="mb-2">
        {COMMUNITY_COPY.inContext.eyebrow}
      </Text>
      <Text variant="body" className="font-sans-bold text-[14.5px]" style={{ lineHeight: 19 }}>
        {note.claim}
      </Text>
      <View className="mt-2.5 flex-row items-center gap-2">
        <Text
          className="font-sans-bold text-[11px]"
          style={{ color: pill.fg, backgroundColor: pill.bg, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' }}>
          {note.evidenceLabel === 'refuted' ? 'Refuted myth' : pill.text}
        </Text>
        <Text variant="bodySm" tone="muted" className="flex-1 text-[12px]">
          {note.verdict}.
        </Text>
      </View>
      <View
        className="mt-3 flex-row items-center justify-between pt-3"
        style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}>
        <Text className="font-mono text-[10.5px]" tone="muted">
          {COMMUNITY_COPY.inContext.from}
        </Text>
        <Text className="font-sans-semibold text-[13px]" style={{ color: colors.clay }}>
          {COMMUNITY_COPY.inContext.read} →
        </Text>
      </View>
    </Pressable>
  );
}
