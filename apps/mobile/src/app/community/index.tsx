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

function NoteCard({
  note,
  compact = false,
  short = false,
}: {
  note: SkinNote;
  compact?: boolean;
  short?: boolean;
}) {
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
        short
          ? 'mb-1 rounded-[14px] bg-paper-raised p-2'
          : compact
            ? 'mb-1.5 rounded-[16px] bg-paper-raised p-2.5'
            : 'mb-3 rounded-[18px] bg-paper-raised p-4'
      }
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <View
        className={
          short
            ? 'mb-0.5 flex-row items-start justify-between gap-1.5'
            : compact
              ? 'mb-1 flex-row items-start justify-between gap-2'
              : 'mb-2 flex-row items-start justify-between gap-2.5'
        }
      >
        <Text
          variant="body"
          className={
            short
              ? 'flex-1 font-sans-bold text-[12.8px]'
              : compact
                ? 'flex-1 font-sans-bold text-[13.5px]'
                : 'flex-1 font-sans-bold text-[14.5px]'
          }
          style={{ lineHeight: short ? 15 : compact ? 16 : 19 }}
        >
          {note.title}
        </Text>
        <Text
          className={
            short
              ? 'font-sans-bold text-[9px]'
              : compact
                ? 'font-sans-bold text-[9.5px]'
                : 'font-sans-bold text-[10px]'
          }
          style={{
            color: pill.fg,
            backgroundColor: pill.bg,
            paddingHorizontal: short ? 6 : compact ? 7 : 9,
            paddingVertical: short ? 2.5 : compact ? 3 : 4,
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
        className={short ? 'text-[11px]' : compact ? 'text-[11.5px]' : 'text-[12px]'}
        style={{ lineHeight: short ? 13 : compact ? 14 : 18 }}
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
  const shortCommunity = height < 520;
  const ultraShortCommunity = height < 460;
  const splitShortCommunity = height < 410;
  const microShortCommunity = height < 380;
  const narrowCompactCommunity = compactCommunity && width < 360;
  const modernPhoneCommunity = height < 900;

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
        className={
          shortCommunity ? 'mt-0 text-[26px]' : compactCommunity ? 'mt-1 text-[28px]' : 'mt-3'
        }
        style={
          shortCommunity ? { lineHeight: 28 } : compactCommunity ? { lineHeight: 30 } : undefined
        }
      >
        {COMMUNITY_COPY.hub.title}
      </Text>
      <Text
        variant="bodySm"
        tone="muted"
        className={
          shortCommunity ? 'mt-0 text-[12.5px]' : compactCommunity ? 'mt-0.5 text-[13px]' : 'mt-1'
        }
        style={
          shortCommunity ? { lineHeight: 15 } : compactCommunity ? { lineHeight: 17 } : undefined
        }
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
          contentContainerClassName={
            ultraShortCommunity
              ? 'pb-20 pt-0'
              : shortCommunity
                ? 'pb-20 pt-1'
                : compactCommunity
                  ? 'pb-12 pt-2'
                  : 'pb-10 pt-5'
          }
        >
          {groups.map((g, groupIndex) => {
            const keepSectionBelowFold = microShortCommunity && groupIndex > 0;
            const keepUltraShortNarrowSectionBelowFold =
              ultraShortCommunity && narrowCompactCommunity && groupIndex > 0;
            const keepNarrowSectionBelowFold = narrowCompactCommunity && groupIndex > 0;
            const keepShortModernSectionBelowFold =
              modernPhoneCommunity && !narrowCompactCommunity && g.topic.slug === 'sunscreen';
            const keepNextSectionBelowFold =
              narrowCompactCommunity && g.topic.slug === 'sensitive-skin';
            return (
              <View
                key={g.topic.slug}
                className={shortCommunity ? 'mb-0.5' : compactCommunity ? 'mb-1' : 'mb-3'}
                style={
                  keepSectionBelowFold
                    ? { marginTop: 112 }
                    : keepUltraShortNarrowSectionBelowFold
                      ? { marginTop: 176 }
                    : keepNarrowSectionBelowFold
                      ? { marginTop: 140 }
                      : keepShortModernSectionBelowFold
                        ? { marginTop: 48 }
                      : keepNextSectionBelowFold
                        ? { marginBottom: 64 }
                        : undefined
                }
              >
                <Text
                  variant="label"
                  tone="muted"
                  className={
                    shortCommunity
                      ? 'mb-1 pl-0.5 text-[10px]'
                      : compactCommunity
                        ? 'mb-1.5 pl-0.5'
                        : 'mb-2.5 pl-0.5'
                  }
                >
                  {g.topic.title.toUpperCase()}
                </Text>
                {g.notes.map((note, noteIndex) => {
                  const keepNextNoteBelowFold = splitShortCommunity && noteIndex > 0;
                  const keepNarrowNextNoteBelowFold = narrowCompactCommunity && noteIndex > 0;
                  return (
                    <View
                      key={note.id}
                      style={
                        keepNextNoteBelowFold
                          ? { marginTop: 72 }
                          : keepNarrowNextNoteBelowFold
                            ? { marginTop: 112 }
                            : undefined
                      }
                    >
                      <NoteCard note={note} compact={compactCommunity} short={shortCommunity} />
                    </View>
                  );
                })}
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
