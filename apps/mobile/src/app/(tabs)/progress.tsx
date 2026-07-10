import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Screen, Text } from '@/components/ui';
import { CompareSlider } from '@/features/photos/CompareSlider';
import { MILESTONE_COPY, PHOTO_COPY } from '@/features/photos/copy';
import { PhotoImage } from '@/features/photos/PhotoImage';
import { PhotoTimelapse } from '@/features/photos/PhotoTimelapse';
import { parseLocalDate } from '@/features/photos/timeline';
import { timelapseFrames } from '@/features/photos/timelapse';
import { usePhotos } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import { TrendInsight } from '@/features/trend/TrendInsight';
import { authenticateAppLock } from '@/lib/applock/authenticate';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { appLockUserMessage } from '@/lib/errors/userFacing';
import { track } from '@/lib/analytics/track';
import { phase7Flags } from '@/lib/launch/phase7';
import { colors } from '@/theme/tokens';

// Progress tab. The guided photo timeline (docs/06; design screens 03/04/05/08).
// REPLACES the calm streak that briefly lived here (Slice 14). Docs/06 defines the
// Progress tab as the photo feature; the streak moved to /routine/streak (still
// reachable from Today + You). Local-only, no scores, app-locked, your own eyes.

const BG = '#16130F';
const SAGE = '#9DB18A';
function short(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const sheetMaxHeight = Math.max(0, viewportHeight - 44);
  const sheetPaddingBottom = insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;
  const title = which === 'before' ? 'Choose the first photo' : 'Choose the second photo';
  const target = which === 'before' ? 'first' : 'second';

  return (
    <Modal
      visible={which !== null}
      transparent
      animationType="slide"
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {photos
              .slice()
              .reverse()
              .map((p) => {
                const sel = p.id === selectedId;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${short(p.takenLocalDate)} as the ${target} comparison photo`}
                    accessibilityHint="Updates the side-by-side comparison pair"
                    accessibilityState={{ selected: sel }}
                    onPress={() => onSelect(p.id)}
                    style={{ width: 92, aspectRatio: 3 / 4 }}
                    className="overflow-hidden rounded-[12px]"
                  >
                    {p.localUri ? (
                      <PhotoImage uri={p.localUri} style={{ flex: 1 }} />
                    ) : (
                      <View className="flex-1" style={{ backgroundColor: colors.greigeDeep }} />
                    )}
                    <View
                      className="absolute inset-x-0 bottom-0 top-0 rounded-[12px]"
                      style={{ borderWidth: sel ? 2.5 : 0, borderColor: colors.clay }}
                    />
                    <View
                      className="absolute bottom-1.5 left-1.5 rounded-[4px] px-1.5 py-0.5"
                      style={{ backgroundColor: 'rgba(250,247,242,0.85)' }}
                    >
                      <Text variant="label" style={{ fontSize: 9, color: colors.muted }}>
                        {short(p.takenLocalDate)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
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
        before={{ uri: before.localUri, date: short(before.takenLocalDate), tone: '#E7E0D5' }}
        after={{ uri: after.localUri, date: short(after.takenLocalDate), tone: '#DACFBE' }}
        sideBySide={sideBySide}
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
function TimelineView({ data }: { data: NonNullable<ReturnType<typeof usePhotos>['data']> }) {
  const [timelapseVisible, setTimelapseVisible] = useState(false);
  const frames = timelapseFrames(data.series);

  return (
    <View className="mt-2">
      {frames.length > 1 ? (
        <View className="mb-3 flex-row justify-end">
          <Pressable
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
      {data.monthGroups.map((group) => {
        // Milestones whose crossing photo falls in this month group, so each marker
        // shows inline at the photo that earned it and earlier markers don't vanish.
        const ids = new Set(group.photos.map((p) => p.id));
        const groupMilestones = data.milestones.filter(
          (m) => m.milestone !== 'first' && ids.has(m.photo.id),
        );
        return (
          <View key={group.key} className="mb-5">
            <Text variant="label" tone="muted" className="mb-2.5" style={{ letterSpacing: 1 }}>
              {group.label.toUpperCase()}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {group.photos.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Photo ${short(p.takenLocalDate)}`}
                  onPress={() => router.push(`/progress/${p.id}`)}
                  style={{ width: '31.6%', aspectRatio: 3 / 4 }}
                  className="overflow-hidden rounded-[12px]"
                >
                  {p.localUri ? (
                    <PhotoImage uri={p.localUri} style={{ flex: 1 }} />
                  ) : (
                    <View className="flex-1" style={{ backgroundColor: colors.greigeDeep }} />
                  )}
                  <View
                    className="absolute bottom-1.5 left-1.5 rounded-[4px] px-1.5 py-0.5"
                    style={{ backgroundColor: 'rgba(250,247,242,0.85)' }}
                  >
                    <Text variant="label" style={{ fontSize: 9, color: colors.muted }}>
                      {short(p.takenLocalDate)}
                    </Text>
                  </View>
                  {p.isReference ? (
                    <View
                      className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: SAGE }}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
            {/* calm milestone markers, inline at the photo that crossed each (docs/06 §4) */}
            {groupMilestones.map((m) => (
              <View
                key={m.milestone}
                className="mt-4 flex-row items-center gap-3 rounded-card p-3.5"
                style={{ backgroundColor: colors.clayTint }}
              >
                <View
                  className="h-[30px] w-[30px] items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.paperRaised }}
                >
                  <View
                    className="h-[11px] w-[11px] rounded-full"
                    style={{ backgroundColor: colors.clay }}
                  />
                </View>
                <Text variant="bodySm" className="flex-1" style={{ color: colors.clayDeep }}>
                  {MILESTONE_COPY[m.milestone]}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
      {timelapseVisible ? (
        <PhotoTimelapse frames={frames} onClose={() => setTimelapseVisible(false)} />
      ) : null}
    </View>
  );
}

// ── Biometric gallery lock (design screen 08) ────────────────────────────────
function GalleryLock({ onUnlock }: { onUnlock: () => void }) {
  const insets = useSafeAreaInsets();
  const [lockFeedback, setLockFeedback] = useState<string | null>(null);

  const requestUnlock = useCallback(() => {
    void authenticateAppLock('Unlock your photo timeline').then((status) => {
      if (status === 'success') {
        setLockFeedback(null);
        onUnlock();
      } else if (status === 'unavailable') {
        setLockFeedback(appLockUserMessage());
      }
    });
  }, [onUnlock]);

  const authenticate = () => {
    setLockFeedback(null);
    requestUnlock();
  };

  useEffect(() => {
    requestUnlock(); // auto-prompt when the gate appears
  }, [requestUnlock]);
  // Full-bleed #16130F incl. the safe-area bands (design screen 08). No night sliver.
  return (
    <View
      className="flex-1"
      style={{ backgroundColor: BG, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 items-center justify-center px-7">
        <View
          className="mb-6 h-[78px] w-[78px] items-center justify-center rounded-[24px]"
          style={{ backgroundColor: 'rgba(244,239,231,0.1)' }}
        >
          <Text style={{ color: SAGE, fontSize: 30 }}>🔒</Text>
        </View>
        <Text
          variant="title"
          style={{ color: colors.cream, fontSize: 30, lineHeight: 33, textAlign: 'center' }}
        >
          {PHOTO_COPY.lock.title}
        </Text>
        <Text
          variant="bodySm"
          className="mt-2.5 text-center"
          style={{ color: 'rgba(244,239,231,0.6)', maxWidth: 280, lineHeight: 21 }}
        >
          {PHOTO_COPY.lock.body}
        </Text>
        {lockFeedback ? (
          <View
            className="mt-4 rounded-[16px] px-4 py-3"
            style={{
              maxWidth: 300,
              borderWidth: 1,
              borderColor: 'rgba(244,239,231,0.16)',
              backgroundColor: 'rgba(244,239,231,0.1)',
            }}
          >
            <Text
              accessibilityRole="alert"
              variant="bodySm"
              className="text-center"
              style={{ color: colors.cream, lineHeight: 20 }}
            >
              {lockFeedback}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PHOTO_COPY.lock.unlock}
          onPress={authenticate}
          className={`${lockFeedback ? 'mt-5' : 'mt-7'} flex-row items-center gap-2.5 rounded-pill px-8 py-4`}
          style={{ backgroundColor: colors.cream }}
        >
          <Text className="font-sans-semibold" style={{ color: BG, fontSize: 16 }}>
            {PHOTO_COPY.lock.unlock}
          </Text>
        </Pressable>
      </View>
      <View
        className="mb-10 flex-row items-center gap-3.5 rounded-[18px] p-4"
        style={{ backgroundColor: 'rgba(244,239,231,0.07)', marginHorizontal: 4 }}
      >
        <View className="flex-1">
          <Text className="font-sans-bold" style={{ color: colors.cream, fontSize: 14 }}>
            {PHOTO_COPY.lock.storageTitle}
          </Text>
          <Text
            style={{
              color: 'rgba(244,239,231,0.5)',
              fontSize: 12,
              lineHeight: 17,
              fontFamily: 'HankenGrotesk_400Regular',
            }}
          >
            {PHOTO_COPY.lock.storageBody}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PhotoProgressTab() {
  const { enabled: lockEnabled } = useAppLock();
  const { height } = useWindowDimensions();
  const { data } = usePhotos('front');
  const [unlocked, setUnlocked] = useState(false);
  const [mode, setMode] = useState<'compare' | 'timeline'>('compare');
  const compactFirstRun = height < 520;

  useEffect(() => {
    if (mode === 'compare') track('comparison_viewed');
    else track('timeline_viewed');
  }, [mode]);

  const count = data?.count ?? 0;

  // Gallery is gated by the opt-in biometric app-lock (docs/06 §7), but only once
  // there are photos to protect.
  if (lockEnabled && !unlocked && count > 0) {
    return <GalleryLock onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactFirstRun ? 'pb-28' : 'pb-8'}
      >
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

        {count === 0 ? (
          <FirstRun compact={compactFirstRun} />
        ) : (
          <>
            <Text variant="bodySm" tone="muted" className="mt-1">
              {data?.metadata.text}
            </Text>
            <Text variant="bodySm" tone="muted" italic className="mt-2" style={{ lineHeight: 19 }}>
              {PHOTO_COPY.tagline}
            </Text>

            {/* "Changes in your own photos" (docs/12). Renders ONLY when opted in
                (off by default); on-device, within-person, descriptive, no number. */}
            {phase7Flags.trend ? (
              <View className="mt-4">
                <TrendInsight />
              </View>
            ) : null}

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

            {mode === 'compare' ? <CompareView data={data!} /> : <TimelineView data={data!} />}
          </>
        )}
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
      <PhotoProgressTab />
    </ProGate>
  );
}
