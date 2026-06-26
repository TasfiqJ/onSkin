import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { COMMUNITY_COPY } from '@/features/community/copy';
import { evidencePill, noteById } from '@/features/community/notes';
import { isNoteHelpful, toggleNoteHelpful } from '@/features/community/reactionStore';
import { track } from '@/lib/analytics/track';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// 02 · The myth-vs-evidence card (docs/11 §9, design 02). The claim / verdict
// (evidence pill) / why (claim-safe mechanism) / honest source + credential, and the
// mandatory "not medical advice" footer. The only reaction is a structured "This
// helped" (the docs/09 flywheel signal). No like count, no author to follow.
export default function NoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const note = id ? noteById(id) : undefined;
  // Persisted "This helped" state (survives remount, unlike the prior useState).
  const helpedQ = useQuery({ queryKey: ['noteHelped', id], queryFn: () => isNoteHelpful(id ?? ''), enabled: !!id });
  const helped = helpedQ.data ?? false;
  const pill = note ? evidencePill(note.evidenceLabel) : null;

  const toggleHelped = async () => {
    if (!note) return;
    haptics.select();
    const next = await toggleNoteHelpful(note.id);
    qc.setQueryData(['noteHelped', id], next);
    if (next) track('reaction_added', { id: note.id, reaction: 'helped' });
  };

  useEffect(() => {
    if (note) track('skin_note_viewed', { id: note.id, surface: 'detail' });
  }, [note]);

  const onShare = () => {
    if (!note) return;
    haptics.select();
    void Share.share({ message: `${note.claim}. ${note.verdict}. ${note.why}` });
  };

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="h-7 w-7 items-center justify-center rounded-full bg-paper-raised"
          style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <Text style={{ color: colors.ink }}>‹</Text>
        </Pressable>
        <Text variant="body" className="font-sans-semibold" tone="muted">
          Skin Note
        </Text>
      </View>

      {!note || !pill ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" tone="muted" className="text-center">
            This note isn’t available right now.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
          <View className="rounded-[22px] bg-paper-raised p-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
            {/* THE CLAIM */}
            <Text variant="label" tone="muted" className="mb-1.5">
              {COMMUNITY_COPY.card.claimLabel.toUpperCase()}
            </Text>
            <Text variant="title" className="text-[25px] leading-[28px]" accessibilityRole="header">
              {note.claim}
            </Text>

            {/* VERDICT pills */}
            <View className="mt-4 flex-row flex-wrap gap-2">
              <View
                className="flex-row items-center gap-2 rounded-pill"
                style={{ backgroundColor: pill.bg, paddingHorizontal: 13, paddingVertical: 6 }}>
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: pill.fg }} />
                <Text className="font-sans-bold text-[12px]" style={{ color: pill.fg }}>
                  {note.evidenceLabel === 'refuted' ? 'Refuted myth' : pill.text}
                </Text>
              </View>
              <View className="rounded-pill" style={{ backgroundColor: pill.bg, paddingHorizontal: 13, paddingVertical: 6 }}>
                <Text className="font-sans-bold text-[12px]" style={{ color: pill.fg }}>
                  {note.verdict}
                </Text>
              </View>
            </View>

            {/* WHY */}
            <Text variant="label" className="mb-2 mt-5" style={{ color: colors.clay }}>
              {COMMUNITY_COPY.card.whyLabel.toUpperCase()}
            </Text>
            <Text className="text-[13.5px]" style={{ color: colors.inkSoft, lineHeight: 21 }}>
              {note.why}
            </Text>

            {/* source + grade */}
            <View className="mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.greigeChip }}>
              <View
                className="flex-row items-center justify-between pb-2.5"
                style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
                <Text variant="bodySm" tone="muted" className="text-[12px]">
                  {COMMUNITY_COPY.card.evidenceGradeLabel}
                </Text>
                <Text className="font-mono text-[12px]" style={{ color: pill.fg }}>
                  {pill.text}
                  {note.evidenceGrade ? ` · SORT ${note.evidenceGrade}` : ' · broad consensus'}
                </Text>
              </View>
              <Text variant="bodySm" tone="muted" className="mt-2.5 text-[12px]" style={{ lineHeight: 17 }}>
                {COMMUNITY_COPY.card.reviewedByLead} <Text className="font-sans-semibold" style={{ color: colors.ink }}>{note.authorCredential.toLowerCase()}</Text>. {COMMUNITY_COPY.card.sourceLead} {note.sourceLabel}.
              </Text>
            </View>

            {/* claim-safe footer */}
            <View className="mt-3.5 flex-row items-center gap-2">
              <Text style={{ color: colors.clay, fontSize: 12 }}>✦</Text>
              <Text className="flex-1 text-[11px]" tone="muted" style={{ lineHeight: 15 }}>
                {COMMUNITY_COPY.card.disclaimer}
              </Text>
            </View>
          </View>

          {/* the only reaction. A structured "This helped" (the docs/09 flywheel) */}
          <View className="mt-4 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: helped }}
              onPress={() => void toggleHelped()}
              className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-pill"
              style={{ borderWidth: 1.5, borderColor: helped ? colors.sage : 'rgba(79,122,74,0.4)', backgroundColor: helped ? colors.sageTint : 'transparent' }}>
              <Text style={{ color: colors.sage, fontSize: 14 }}>♥</Text>
              <Text className="font-sans-semibold text-[14.5px]" style={{ color: colors.sage }}>
                {COMMUNITY_COPY.card.helped}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onShare}
              className="h-12 items-center justify-center rounded-pill px-6"
              style={{ borderWidth: 1.5, borderColor: colors.hairlineStrong }}>
              <Text className="font-sans-semibold text-[14.5px]" tone="muted">
                {COMMUNITY_COPY.card.share}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
