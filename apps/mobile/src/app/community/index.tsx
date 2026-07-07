import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { COMMUNITY_COPY } from '@/features/community/copy';
import { evidencePill, notesByTopic, type SkinNote } from '@/features/community/notes';
import { track } from '@/lib/analytics/track';
import { phase7Flags } from '@/lib/launch/phase7';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// 01 · The "Skin Notes" hub (docs/11 §9.1, design 01). Topic-structured (NOT
// chronological), each entry a myth-vs-evidence card carrying the docs/02 evidence pill.
// Deliberately a reference library: no likes, no authors to follow, no ranking by
// popularity. Phase 1, live (expert-seeded, read-mostly).

function NoteCard({ note, compact = false }: { note: SkinNote; compact?: boolean }) {
  const pill = evidencePill(note.evidenceLabel);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${note.title}. ${pill.text}.`}
      onPress={() => {
        haptics.select();
        track('skin_note_viewed', { surface: 'hub' });
        router.push({ pathname: '/community/note/[id]', params: { id: note.id } });
      }}
      className={
        compact
          ? 'mb-1.5 rounded-[16px] bg-paper-raised p-2.5'
          : 'mb-3 rounded-[18px] bg-paper-raised p-4'
      }
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <View
        className={
          compact
            ? 'mb-1 flex-row items-start justify-between gap-2'
            : 'mb-2 flex-row items-start justify-between gap-2.5'
        }
      >
        <Text
          variant="body"
          className={
            compact
              ? 'flex-1 font-sans-bold text-[13.5px]'
              : 'flex-1 font-sans-bold text-[14.5px]'
          }
          style={{ lineHeight: compact ? 16 : 19 }}
        >
          {note.title}
        </Text>
        <Text
          className={compact ? 'font-sans-bold text-[9.5px]' : 'font-sans-bold text-[10px]'}
          style={{
            color: pill.fg,
            backgroundColor: pill.bg,
            paddingHorizontal: compact ? 7 : 9,
            paddingVertical: compact ? 3 : 4,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          {pill.text}
        </Text>
      </View>
      <Text
        variant="bodySm"
        tone="muted"
        className={compact ? 'text-[11.5px]' : 'text-[12px]'}
        style={{ lineHeight: compact ? 14 : 18 }}
      >
        {note.summary}
      </Text>
    </Pressable>
  );
}

export default function SkinNotesHub() {
  const { height, width } = useWindowDimensions();
  const groups = notesByTopic();
  const compactCommunity = height < 640;
  const narrowCompactCommunity = compactCommunity && width < 360;

  useEffect(() => {
    track('skin_note_viewed', { surface: 'hub' });
  }, []);

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center justify-between pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
        />
        {phase7Flags.communityPosting ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/community/ask')}
            className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
          >
            <Text variant="body" tone="muted" className="font-sans-medium">
              Ask
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <Text
        variant="title"
        className={compactCommunity ? 'mt-1 text-[28px]' : 'mt-3'}
        style={compactCommunity ? { lineHeight: 30 } : undefined}
      >
        {COMMUNITY_COPY.hub.title}
      </Text>
      <Text
        variant="bodySm"
        tone="muted"
        className={compactCommunity ? 'mt-0.5 text-[13px]' : 'mt-1'}
        style={compactCommunity ? { lineHeight: 17 } : undefined}
      >
        {COMMUNITY_COPY.hub.subtitle}
      </Text>

      {groups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" tone="muted" className="text-center">
            Expert Skin Notes are on the way. We publish them only after a dermatologist signs off.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName={compactCommunity ? 'pb-12 pt-2' : 'pb-10 pt-5'}
        >
          {groups.map((g) => {
            const keepNextSectionBelowFold =
              narrowCompactCommunity && g.topic.slug === 'sensitive-skin';
            return (
              <View
                key={g.topic.slug}
                className={compactCommunity ? 'mb-1' : 'mb-3'}
                style={keepNextSectionBelowFold ? { marginBottom: 64 } : undefined}
              >
                <Text
                  variant="label"
                  tone="muted"
                  className={compactCommunity ? 'mb-1.5 pl-0.5' : 'mb-2.5 pl-0.5'}
                >
                  {g.topic.title.toUpperCase()}
                </Text>
                {g.notes.map((note) => (
                  <NoteCard key={note.id} note={note} compact={compactCommunity} />
                ))}
              </View>
            );
          })}
          <Text
            variant="label"
            tone="muted"
            className="mt-3 px-2 text-center"
            style={{ lineHeight: 17 }}
          >
            {COMMUNITY_COPY.hub.libraryFooter}
          </Text>
        </ScrollView>
      )}
    </Screen>
  );
}
