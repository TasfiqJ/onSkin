import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Screen, Text } from '@/components/ui';
import { CompareSlider } from '@/features/photos/CompareSlider';
import { MILESTONE_COPY, PHOTO_COPY } from '@/features/photos/copy';
import { PhotoImage } from '@/features/photos/PhotoImage';
import { PhotoStorageGate } from '@/features/photos/PhotoStorageGate';
import { PhotoTimelapse } from '@/features/photos/PhotoTimelapse';
import { focusTimelapseElementAfterLayout } from '@/features/photos/timelapseFocus';
import { PhotoTimelineLockGate } from '@/features/photos/PhotoTimelineLockGate';
import { parseLocalDate } from '@/features/photos/timeline';
import { timelapseFrames } from '@/features/photos/timelapse';
import { usePhotos } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import {
  motionAwareModalAnimation,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// Progress tab. The guided photo timeline (docs/06; design screens 03/04/05/08).
// REPLACES the calm streak that briefly lived here (Slice 14). Docs/06 defines the
// Progress tab as the photo feature; the streak moved to /routine/streak (still
// reachable from Today + You). Local-only, no scores, app-locked, your own eyes.

const SAGE = '#9DB18A';
const PHOTO_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 40 } as const;

function sameStringSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function short(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Mode switch ──────────────────────────────────────────────────────────────
function ModeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="min-h-[48px] min-w-[96px] items-center justify-center rounded-pill px-[18px] py-2.5"
      style={{
        backgroundColor: active ? colors.ink : colors.paperRaised,
        borderWidth: active ? 0 : 1,
        borderColor: colors.hairlineStrong,
      }}
    >
      <Text
        variant="bodySm"
        className="font-sans-semibold"
        style={{ color: active ? colors.paper : colors.muted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Empty / first-run (design screen 03) ─────────────────────────────────────
function FirstRun({ compact = false }: { compact?: boolean }) {
  return (
    <View className={compact ? 'pb-28 pt-1' : 'flex-1 justify-center pb-6'}>
      <Card className={compact ? 'mb-2 p-3' : 'mb-5'}>
        <Text
          variant="titleSm"
          style={{ fontSize: compact ? 22 : 26, lineHeight: compact ? 25 : 30 }}
        >
          {PHOTO_COPY.firstRun.title}
        </Text>
        <Text
          variant="bodySm"
          tone="muted"
          className={compact ? 'mt-1.5 text-[12.5px]' : 'mt-3'}
          style={{ lineHeight: compact ? 17 : 22 }}
        >
          {PHOTO_COPY.firstRun.body}
        </Text>
        {/* honest 8-12 week expectation bar */}
        <View className={compact ? 'mt-2.5 flex-row' : 'mt-5 flex-row'}>
          <View
            className="h-1.5 flex-1 rounded-l-[3px]"
            style={{ backgroundColor: colors.greigeDeep }}
          />
          <View className="h-1.5 flex-1" style={{ backgroundColor: colors.clayBright }} />
          <View className="h-1.5 flex-1 rounded-r-[3px]" style={{ backgroundColor: colors.clay }} />
        </View>
        <View className="mt-1.5 flex-row justify-between">
          {['week 1', 'week 6', 'week 12'].map((w) => (
            <Text key={w} variant="label" tone="muted" style={{ fontSize: 10 }}>
              {w}
            </Text>
          ))}
        </View>
      </Card>
      <View
        className={
          compact
            ? 'mb-2 flex-row items-center gap-2.5 px-1'
            : 'mb-7 flex-row items-center gap-2.5 px-1'
        }
      >
        <View className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: colors.sage }} />
        <Text
          variant="bodySm"
          tone="muted"
          className={compact ? 'text-[12.5px]' : undefined}
          style={{ lineHeight: compact ? 17 : undefined }}
        >
          {PHOTO_COPY.firstRun.reassure}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/progress/capture')}
        className={
          compact
            ? 'h-[52px] items-center justify-center rounded-pill'
            : 'h-14 items-center justify-center rounded-pill'
        }
        style={{ backgroundColor: colors.ink }}
      >
        <Text
          variant="body"
          className="font-sans-semibold"
          style={{ color: colors.paper, fontSize: 17 }}
        >
          {PHOTO_COPY.firstRun.cta}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Compare-pair picker (docs/06 §4: "tap a date to change") ─────────────────
type PhotoLite = NonNullable<ReturnType<typeof usePhotos>['data']>['series'][number];

function PairPickerPhoto({
  photo,
  target,
  selected,
  active,
  onSelect,
}: {
  photo: PhotoLite;
  target: 'first' | 'second';
  selected: boolean;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Choose ${short(photo.takenLocalDate)} as the ${target} comparison photo`}
      accessibilityHint="Updates the side-by-side comparison pair"
      accessibilityState={{ selected }}
      onPress={() => onSelect(photo.id)}
      style={{ width: 92, aspectRatio: 3 / 4 }}
      className="overflow-hidden rounded-[12px]"
    >
      {(photo.thumbnailLocalUri ?? photo.localUri) ? (
        <PhotoImage
          uri={photo.thumbnailLocalUri ?? photo.localUri}
          photoId={photo.id}
          captureSessionId={photo.captureSessionId}
          fallbackOriginalUri={photo.localUri}
          rendition="thumbnail"
          requestPriority="visible"
          active={active}
          style={{ flex: 1 }}
        />
      ) : (
        <View className="flex-1" style={{ backgroundColor: colors.greigeDeep }} />
      )}
      <View
        className="absolute inset-x-0 bottom-0 top-0 rounded-[12px]"
        style={{ borderWidth: selected ? 2.5 : 0, borderColor: colors.clay }}
      />
      <View
        className="absolute bottom-1.5 left-1.5 rounded-[4px] px-1.5 py-0.5"
        style={{ backgroundColor: 'rgba(250,247,242,0.85)' }}
      >
        <Text variant="label" style={{ fontSize: 9, color: colors.muted }}>
          {short(photo.takenLocalDate)}
        </Text>
      </View>
    </Pressable>
  );
}

function PairPicker({
  which,
  photos,
  selectedId,
  onSelect,
  onClose,
}: {
  which: 'before' | 'after' | null;
  photos: PhotoLite[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const sheetMaxHeight = Math.max(0, viewportHeight - 44);
  const sheetPaddingBottom = insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;
  const title = which === 'before' ? 'Choose the first photo' : 'Choose the second photo';
  const target = which === 'before' ? 'first' : 'second';
  const latestFirstPhotos = useMemo(() => photos.slice().reverse(), [photos]);
  const [visiblePhotoIds, setVisiblePhotoIds] = useState<ReadonlySet<string>>(() => new Set());
  const onPickerViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<PhotoLite>[] }) => {
      const next = new Set(
        viewableItems.filter((item) => item.isViewable).map((item) => item.item.id),
      );
      setVisiblePhotoIds((current) => (sameStringSet(current, next) ? current : next));
    },
    [],
  );

  return (
    <Modal
      visible={which !== null}
      transparent
      animationType={motionAwareModalAnimation(reduceMotion, 'slide')}
      accessibilityLabel={title}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(32,27,21,0.4)' }}>
        <Pressable
          className="flex-1"
          accessibilityLabel="Dismiss photo picker"
          accessibilityRole="button"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          className="rounded-t-sheet bg-paper px-6 pb-10 pt-4"
          style={
            sheetPaddingBottom === undefined
              ? { maxHeight: sheetMaxHeight }
              : { maxHeight: sheetMaxHeight, paddingBottom: sheetPaddingBottom }
          }
        >
          <View
            className="mx-auto mb-4 h-[5px] w-10 rounded-[3px]"
            style={{ backgroundColor: 'rgba(32,27,21,0.15)' }}
          />
          <Text variant="titleSm" className="mb-1">
            {title}
          </Text>
          <Text variant="bodySm" tone="muted" className="mb-4">
            Any two captures. You decide what to compare.
          </Text>
          <FlatList
            nativeID="progress-comparison-picker-list"
            horizontal
            data={latestFirstPhotos}
            keyExtractor={(photo) => photo.id}
            extraData={visiblePhotoIds}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
            getItemLayout={(_data, index) => ({ length: 102, offset: 102 * index, index })}
            viewabilityConfig={PHOTO_VIEWABILITY_CONFIG}
            onViewableItemsChanged={onPickerViewableItemsChanged}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item: photo }) => (
              <PairPickerPhoto
                photo={photo}
                target={target}
                selected={photo.id === selectedId}
                active={which !== null && visiblePhotoIds.has(photo.id)}
                onSelect={onSelect}
              />
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Compare (design screen 04) ───────────────────────────────────────────────
function CompareView({ data }: { data: NonNullable<ReturnType<typeof usePhotos>['data']> }) {
  const [sideBySide, setSideBySide] = useState(false);
  const [picking, setPicking] = useState<'before' | 'after' | null>(null);
  const [pick, setPick] = useState<{ beforeId?: string; afterId?: string }>({});
  const dflt = data.comparePair;

  if (!dflt) {
    // Sparse: exactly one photo. Invite a second rather than an empty slider.
    return (
      <Card className="mt-2">
        <View
          className="mb-3 h-44 items-center justify-center rounded-card"
          style={{ backgroundColor: colors.greige }}
        >
          <Text variant="label" tone="muted">
            your first photo
          </Text>
        </View>
        <Text variant="body" className="font-sans-medium">
          {PHOTO_COPY.sparse}
        </Text>
      </Card>
    );
  }

  // Resolve the active pair: a user pick (docs/06 §4 "any two captures") or the
  // default earliest-vs-latest.
  const before = (pick.beforeId && data.series.find((p) => p.id === pick.beforeId)) || dflt.before;
  const after = (pick.afterId && data.series.find((p) => p.id === pick.afterId)) || dflt.after;

  function choose(id: string) {
    setPick((prev) =>
      picking === 'before' ? { ...prev, beforeId: id } : { ...prev, afterId: id },
    );
    setPicking(null);
  }

  return (
    <View className="mt-2">
      <View className="mb-3 flex-row items-center justify-between">
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: sideBySide }}
          onPress={() => setSideBySide((v) => !v)}
          className="min-h-[48px] items-center justify-center rounded-pill px-4 py-2"
          style={{
            backgroundColor: sideBySide ? colors.ink : colors.paperRaised,
            borderWidth: sideBySide ? 0 : 1,
            borderColor: colors.hairlineStrong,
          }}
        >
          <Text variant="label" style={{ color: sideBySide ? colors.paper : colors.muted }}>
            {PHOTO_COPY.sideBySide}
          </Text>
        </Pressable>
      </View>
      <CompareSlider
        before={{
          id: before.id,
          uri: before.localUri,
          date: short(before.takenLocalDate),
          tone: '#E7E0D5',
          captureSessionId: before.captureSessionId,
        }}
        after={{
          id: after.id,
          uri: after.localUri,
          date: short(after.takenLocalDate),
          tone: '#DACFBE',
          captureSessionId: after.captureSessionId,
        }}
        sideBySide={sideBySide}
        active={picking === null}
        onPickBefore={() => setPicking('before')}
        onPickAfter={() => setPicking('after')}
      />
      <View className="mt-4 flex-row items-center gap-2.5">
        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clay }} />
        <Text variant="bodySm" tone="muted" className="flex-1" style={{ lineHeight: 18 }}>
          {PHOTO_COPY.compareNote}
        </Text>
      </View>
      <PairPicker
        which={picking}
        photos={data.series}
        selectedId={picking === 'before' ? before.id : picking === 'after' ? after.id : null}
        onSelect={choose}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

// ── Timeline (design screen 05) ──────────────────────────────────────────────
type PhotosData = NonNullable<ReturnType<typeof usePhotos>['data']>;
type TimelineMilestone = PhotosData['milestones'][number];
type TimelineRow =
  | { kind: 'photos'; key: string; photos: readonly PhotoLite[] }
  | { kind: 'milestone'; key: string; milestone: TimelineMilestone };
type TimelineSection = { key: string; title: string; data: TimelineRow[] };

function buildTimelineSections(data: PhotosData): TimelineSection[] {
  const milestonesByPhoto = new Map<string, TimelineMilestone[]>();
  for (const milestone of data.milestones) {
    if (milestone.milestone === 'first') continue;
    const rows = milestonesByPhoto.get(milestone.photo.id) ?? [];
    rows.push(milestone);
    milestonesByPhoto.set(milestone.photo.id, rows);
  }

  return data.monthGroups.map((group) => {
    const rows: TimelineRow[] = [];
    for (let index = 0; index < group.photos.length; index += 3) {
      const photos = group.photos.slice(index, index + 3);
      rows.push({
        kind: 'photos',
        key: `photos:${photos.map((photo) => photo.id).join(':')}`,
        photos,
      });
      for (const photo of photos) {
        for (const milestone of milestonesByPhoto.get(photo.id) ?? []) {
          rows.push({
            kind: 'milestone',
            key: `milestone:${milestone.milestone}:${photo.id}`,
            milestone,
          });
        }
      }
    }
    return { key: group.key, title: group.label.toUpperCase(), data: rows };
  });
}

const TimelinePhotosRow = memo(function TimelinePhotosRow({
  photos,
  active,
}: {
  photos: readonly PhotoLite[];
  active: boolean;
}) {
  return (
    <View className="mb-2 flex-row" style={{ gap: 8 }}>
      {photos.map((photo) => (
        <Pressable
          key={photo.id}
          accessibilityRole="button"
          accessibilityLabel={`Photo ${short(photo.takenLocalDate)}`}
          onPress={() => router.push(`/progress/${photo.id}`)}
          style={{ width: '31.6%', aspectRatio: 3 / 4 }}
          className="overflow-hidden rounded-[12px]"
        >
          {(photo.thumbnailLocalUri ?? photo.localUri) ? (
            <PhotoImage
              uri={photo.thumbnailLocalUri ?? photo.localUri}
              photoId={photo.id}
              captureSessionId={photo.captureSessionId}
              fallbackOriginalUri={photo.localUri}
              rendition="thumbnail"
              requestPriority="visible"
              active={active}
              style={{ flex: 1 }}
            />
          ) : (
            <View className="flex-1" style={{ backgroundColor: colors.greigeDeep }} />
          )}
          <View
            className="absolute bottom-1.5 left-1.5 rounded-[4px] px-1.5 py-0.5"
            style={{ backgroundColor: 'rgba(250,247,242,0.85)' }}
          >
            <Text variant="label" style={{ fontSize: 9, color: colors.muted }}>
              {short(photo.takenLocalDate)}
            </Text>
          </View>
          {photo.isReference ? (
            <View
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: SAGE }}
            />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
});

const TimelineMilestoneCard = memo(function TimelineMilestoneCard({
  milestone,
}: {
  milestone: TimelineMilestone;
}) {
  return (
    <View
      className="mb-2 mt-2 flex-row items-center gap-3 rounded-card p-3.5"
      style={{ backgroundColor: colors.clayTint }}
    >
      <View
        className="h-[30px] w-[30px] items-center justify-center rounded-full"
        style={{ backgroundColor: colors.paperRaised }}
      >
        <View className="h-[11px] w-[11px] rounded-full" style={{ backgroundColor: colors.clay }} />
      </View>
      <Text variant="bodySm" className="flex-1" style={{ color: colors.clayDeep }}>
        {MILESTONE_COPY[milestone.milestone]}
      </Text>
    </View>
  );
});

function TimelineView({
  compact,
  data,
  header,
}: {
  compact: boolean;
  data: PhotosData;
  header: ReactNode;
}) {
  const [timelapseVisible, setTimelapseVisible] = useState(false);
  const timelapseTriggerRef = useRef<View>(null);
  const [visibleRowKeys, setVisibleRowKeys] = useState<ReadonlySet<string>>(() => new Set());
  const frames = useMemo(() => timelapseFrames(data.series), [data.series]);
  const sections = useMemo(() => buildTimelineSections(data), [data]);
  const renderTimelineRow = useCallback(
    ({ item }: { item: TimelineRow }) =>
      item.kind === 'photos' ? (
        <TimelinePhotosRow
          photos={item.photos}
          active={!timelapseVisible && visibleRowKeys.has(item.key)}
        />
      ) : (
        <TimelineMilestoneCard milestone={item.milestone} />
      ),
    [timelapseVisible, visibleRowKeys],
  );
  const onTimelineViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<TimelineRow>[] }) => {
      const next = new Set(
        viewableItems
          .filter((item) => item.isViewable && item.item.kind === 'photos')
          .map((item) => item.item.key),
      );
      setVisibleRowKeys((current) => (sameStringSet(current, next) ? current : next));
    },
    [],
  );
  const closeTimelapse = useCallback(() => {
    setTimelapseVisible(false);
    focusTimelapseElementAfterLayout(() => timelapseTriggerRef.current);
  }, []);

  return (
    <>
      <SectionList
        nativeID="progress-timeline-list"
        sections={sections}
        keyExtractor={(item) => item.key}
        extraData={visibleRowKeys}
        renderItem={renderTimelineRow}
        viewabilityConfig={PHOTO_VIEWABILITY_CONFIG}
        onViewableItemsChanged={onTimelineViewableItemsChanged}
        renderSectionHeader={({ section }) => (
          <Text variant="label" tone="muted" className="mb-2.5 mt-3" style={{ letterSpacing: 1 }}>
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: compact ? 112 : 32 }}
        ListHeaderComponent={
          <>
            {header}
            {frames.length > 1 ? (
              <View className="mb-3 mt-2 flex-row justify-end">
                <Pressable
                  ref={timelapseTriggerRef}
                  accessibilityRole="button"
                  accessibilityLabel="Play a quiet time-lapse of your local photo series"
                  onPress={() => setTimelapseVisible(true)}
                  className="min-h-[48px] flex-row items-center justify-center gap-1.5 rounded-pill px-4 py-2"
                  style={{
                    backgroundColor: colors.paperRaised,
                    borderWidth: 1,
                    borderColor: colors.hairlineStrong,
                  }}
                >
                  <Text style={{ color: colors.clay, fontSize: 11 }}>▶</Text>
                  <Text variant="label" tone="muted">
                    Time-lapse
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
      />
      {timelapseVisible ? (
        <PhotoTimelapse frames={frames} onClose={closeTimelapse} />
      ) : null}
    </>
  );
}

function PhotoProgressTab() {
  const { height } = useWindowDimensions();
  const { data } = usePhotos('front');
  const [mode, setMode] = useState<'compare' | 'timeline'>('compare');
  const compactFirstRun = height < 520;

  useEffect(() => {
    if (mode === 'compare') track('comparison_viewed');
    else track('timeline_viewed');
  }, [mode]);

  const count = data?.count ?? 0;

  const header = (
    <>
      <View className="flex-row items-start justify-between">
        <Text variant="title" className="mt-2" style={{ fontSize: 38 }}>
          {PHOTO_COPY.tabTitle}
        </Text>
        {count > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take a progress photo"
            onPress={() => router.push('/progress/capture')}
            className="mt-3 min-h-[48px] flex-row items-center justify-center gap-1.5 rounded-pill px-4 py-2"
            style={{ backgroundColor: colors.clay }}
          >
            <Text style={{ color: colors.paper, fontSize: 14 }}>＋</Text>
            <Text variant="label" style={{ color: colors.paper }}>
              Photo
            </Text>
          </Pressable>
        ) : null}
      </View>
      {count > 0 ? (
        <>
          <Text variant="bodySm" tone="muted" className="mt-1">
            {data?.metadata.text}
          </Text>
          <Text variant="bodySm" tone="muted" italic className="mt-2" style={{ lineHeight: 19 }}>
            {PHOTO_COPY.tagline}
          </Text>
          <View className="mt-4 gap-2.5">
            <View className="flex-row items-center gap-2.5">
              <ModeTab
                label="Compare"
                active={mode === 'compare'}
                onPress={() => setMode('compare')}
              />
              <ModeTab
                label="Timeline"
                active={mode === 'timeline'}
                onPress={() => setMode('timeline')}
              />
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Why no AI score"
              onPress={() => router.push('/progress/about')}
              className="min-h-[48px] self-start items-center justify-center rounded-pill px-3"
            >
              <Text variant="label" tone="clay">
                No scores ⓘ
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </>
  );

  if (count > 0 && mode === 'timeline') {
    return (
      <Screen edges={['top']}>
        <TimelineView compact={compactFirstRun} data={data!} header={header} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactFirstRun ? 'pb-28' : 'pb-8'}
      >
        {header}

        {count === 0 ? <FirstRun compact={compactFirstRun} /> : <CompareView data={data!} />}
      </ScrollView>
    </Screen>
  );
}

// The Progress tab (photo timeline) is a Pro value prop (docs/08 §2.2). Gate it.
// New users are in the reverse trial / carded trial, so it's unlocked after
// onboarding; it locks to the contextual upsell only once Pro lapses.
export default function ProgressScreen() {
  return (
    <ProGate feature="photo_timeline">
      <PhotoTimelineLockGate>
        <PhotoStorageGate tone="paper">
          <PhotoProgressTab />
        </PhotoStorageGate>
      </PhotoTimelineLockGate>
    </ProGate>
  );
}
