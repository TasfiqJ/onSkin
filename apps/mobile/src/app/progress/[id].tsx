import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { PHOTO_COPY } from '@/features/photos/copy';
import { PhotoImage } from '@/features/photos/PhotoImage';
import { PhotoStorageGate } from '@/features/photos/PhotoStorageGate';
import { PhotoTimelineLockGate } from '@/features/photos/PhotoTimelineLockGate';
import { purgeSensitiveImageMemory } from '@/features/photos/sensitiveImageMemory';
import { sharePhotoImageOnly } from '@/features/photos/sharePhoto';
import { parseLocalDate } from '@/features/photos/timeline';
import { usePhotoActions, usePhotos } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import { useAuth } from '@/lib/auth/AuthProvider';
import { createPhotoNoteSaveCoordinator, type PhotoNoteSaveCoordinator } from '@/features/photos/photoNoteSaveCoordinator';
import { runPhotoDeleteRetrySingleFlight } from '@/features/photos/photoDeleteRetrySingleFlight';
import { PhotoDeleteSyncStatus } from '@/features/photos/PhotoDeleteSyncStatus';
import {
  motionAllowed,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import { track } from '@/lib/analytics/track';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Single-photo detail (docs/06 §4, design screen 06). Date, quality, your note,
// set-reference, explicit photo share, delete. All on-device.

const BG = '#16130F';
const SAGE = '#9DB18A';

function e2ePhotoDeleteFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return process.env.EXPO_PUBLIC_E2E_PHOTO_DELETE_FAILURE === '1';
}

type DetailActions = ReturnType<typeof usePhotoActions>;
type DetailSession = {
  actions: DetailActions;
  noteForPhoto: (initialNotes: string) => PhotoNoteSaveCoordinator;
  isCurrent: () => boolean;
  deleting: boolean;
  removalBlocked: boolean;
  closeToProgress: () => void;
  replaceWithCapture: () => void;
  referencing: boolean;
  deleteFeedback: string | null;
  referenceFeedback: string | null;
  clearDeleteFeedback: () => void;
  deletePhoto: () => Promise<void>;
  setReference: () => Promise<void>;
};

function PhotoDetailNoteEditor({ coordinator, isCurrent }: {
  coordinator: PhotoNoteSaveCoordinator;
  isCurrent: () => boolean;
}) {
  const snapshot = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, coordinator.getSnapshot);
  const requestSave = (explicit: boolean) => {
    if (!isCurrent() || (!explicit && coordinator.getSnapshot().status === 'error')) return;
    void coordinator.requestSave();
  };
  return (
    <View>
      <TextInput
        accessibilityLabel={PHOTO_COPY.detail.noteLabel}
        value={snapshot.draft}
        onChangeText={(text) => { if (isCurrent()) coordinator.updateDraft(text); }}
        onBlur={() => requestSave(false)}
        onEndEditing={() => requestSave(false)}
        placeholder={PHOTO_COPY.detail.notePlaceholder}
        placeholderTextColor="rgba(244,239,231,0.35)"
        multiline
        style={{ color: '#F4EFE7', fontFamily: 'HankenGrotesk-Regular', fontSize: 15, lineHeight: 22, minHeight: 72, textAlignVertical: 'top' }}
      />
      {snapshot.status !== 'idle' ? (
        <Text accessibilityLiveRegion="polite" style={{ color: '#F4EFE7', fontSize: 13, lineHeight: 19 }}>
          {snapshot.status === 'saving' ? PHOTO_COPY.detail.noteSaving : snapshot.status === 'saved'
            ? PHOTO_COPY.detail.noteSaved : PHOTO_COPY.detail.noteSaveUnavailable}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={snapshot.status === 'error' ? PHOTO_COPY.detail.noteSaveRetry : PHOTO_COPY.detail.noteSave}
        onPress={() => requestSave(true)}
        style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}
      >
        <Text style={{ color: '#F4EFE7', fontSize: 14 }}>
          {snapshot.status === 'error' ? PHOTO_COPY.detail.noteSaveRetry : PHOTO_COPY.detail.noteSave}
        </Text>
      </Pressable>
    </View>
  );
}

/** This session sits above the existing storage gate: refetching must withhold
 * photo content without destroying an unsaved draft or mutation recovery UI.
 * Its key and the lock gate still dispose it at every authority/route change. */
function PhotoDetailSession({ id, actions }: { id: string; actions: DetailActions }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const noteRef = useRef<PhotoNoteSaveCoordinator | null>(null);
  type Exit = { kind: 'back' | 'capture' } | { kind: 'action'; action: NavigationAction };
  const pendingExit = useRef<Exit | null>(null);
  const exitDispatched = useRef(false);
  const [, requestExitRender] = useState(0);
  const blocked = useRef(false);
  const guardReady = useRef<(() => void) | null>(null);
  const localAttemptSettled = useRef(false);
  const localDeleteConfirmed = useRef(false);
  const [removalBlocked, setRemovalBlocked] = useState(false);
  const [privacyRetryRequired, setPrivacyRetryRequired] = useState(false);
  const deleteFlight = useRef<Promise<void> | null>(null);
  const referenceFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const [deleting, setDeleting] = useState(false);
  const [referencing, setReferencing] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [referenceFeedback, setReferenceFeedback] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      guardReady.current?.();
      guardReady.current = null;
      pendingExit.current = null;
      // Forced entitlement/health/lock removal is not ordinary navigation. Drop
      // bytes synchronously with that privacy boundary, even while the old store
      // promise is settling. No old callback gets a later owner's write lease.
      if (blocked.current) void purgeSensitiveImageMemory();
    };
  }, []);
  const isCurrent = () => mounted.current && actions.isCurrent();
  const requestExit = (exit: Exit) => {
    if (!isCurrent() || exitDispatched.current) return;
    pendingExit.current ??= exit;
    // Dispatch only after a render removed the navigator's prevent-remove flag;
    // a captured callback in the purge-complete/render gap must not self-block.
    if (!blocked.current) requestExitRender(value => value + 1);
  };
  usePreventRemove(removalBlocked, ({ data }) => {
    if (isCurrent()) pendingExit.current ??= { kind: 'action', action: data.action };
  });
  useEffect(() => {
    if (removalBlocked) {
      // usePreventRemove has installed its listener before the destructive work
      // starts. Visible callbacks also consult the synchronous `blocked` ref.
      guardReady.current?.();
      guardReady.current = null;
      return;
    }
    const exit = pendingExit.current;
    if (!blocked.current && exit && isCurrent() && !exitDispatched.current) {
      pendingExit.current = null;
      exitDispatched.current = true;
      if (exit.kind === 'action') navigation.dispatch(exit.action);
      else if (exit.kind === 'capture') router.replace('/progress/capture');
      else backOrReplace(router, APP_PROGRESS_ROUTE);
    }
  });

  const session: DetailSession = {
    actions, isCurrent, deleting, removalBlocked, referencing, deleteFeedback, referenceFeedback,
    closeToProgress: () => requestExit({ kind: 'back' }),
    replaceWithCapture: () => requestExit({ kind: 'capture' }),
    clearDeleteFeedback: () => { if (isCurrent()) setDeleteFeedback(null); },
    noteForPhoto: (initialNotes) => {
      if (noteRef.current === null) {
        noteRef.current = createPhotoNoteSaveCoordinator({ initialNotes, commit: async (notes) => {
          if (!isCurrent()) throw new Error('PHOTO_DETAIL_AUTHORITY_LOST');
          await actions.note.mutateAsync({ id, notes });
          if (!isCurrent()) throw new Error('PHOTO_DETAIL_AUTHORITY_LOST');
        } });
      }
      return noteRef.current;
    },
    deletePhoto: () => {
      if (!isCurrent() || exitDispatched.current) return Promise.resolve();
      return runPhotoDeleteRetrySingleFlight(deleteFlight, async () => {
        const alreadyBlocked = blocked.current;
        if (!alreadyBlocked) {
          localAttemptSettled.current = false;
          localDeleteConfirmed.current = false;
          setPrivacyRetryRequired(false);
        }
        blocked.current = true;
        setDeleting(true);
        setDeleteFeedback(null);
        if (!alreadyBlocked) {
          const ready = new Promise<void>(resolve => { guardReady.current = resolve; });
          setRemovalBlocked(true);
          await ready;
        }
        try {
          if (!isCurrent()) return;
          if (!localAttemptSettled.current) {
            try {
              if (e2ePhotoDeleteFailure()) throw new Error('PHOTO_DELETE_E2E_FAILURE');
              await actions.remove.mutateAsync(id);
              localDeleteConfirmed.current = true;
            } catch {
              // An exception is not proof no metadata committed. Purge on both
              // success and failure before allowing any ordinary route removal.
              if (isCurrent()) setDeleteFeedback(PHOTO_COPY.detail.deleteUnavailable);
            } finally {
              localAttemptSettled.current = true;
            }
          }
          if (!isCurrent()) return;
          let cleared = false;
          try { cleared = await purgeSensitiveImageMemory(); } catch { /* fail closed */ }
          if (!isCurrent()) return;
          if (!cleared) {
            setPrivacyRetryRequired(true);
            setDeleteFeedback(PHOTO_COPY.detail.deleteCleanupPending);
            return;
          }
          // The existing durable file/outbox workers own residual encrypted
          // cleanup. They do not need to trap a user after decoded bytes cleared.
          blocked.current = false;
          setPrivacyRetryRequired(false);
          if (localDeleteConfirmed.current) pendingExit.current ??= { kind: 'back' };
          setRemovalBlocked(false);
        } finally {
          if (isCurrent()) setDeleting(false);
        }
      });
    },
    setReference: () => {
      if (!isCurrent() || blocked.current || deleteFlight.current) return Promise.resolve();
      return runPhotoDeleteRetrySingleFlight(referenceFlight, async () => {
        setReferencing(true);
        setReferenceFeedback(null);
        try {
          await actions.reference.mutateAsync(id);
          if (!isCurrent()) return;
          haptics.select();
          track('reference_reset');
        } catch {
          if (isCurrent()) setReferenceFeedback(PHOTO_COPY.detail.referenceUnavailable);
        } finally {
          if (isCurrent()) setReferencing(false);
        }
      });
    },
  };
  // Memory settlement cannot depend on a now-unreadable photo store. This
  // generic recovery surface stays inside existing Pro/lock/owner boundaries
  // but outside the source gate, and never renders photo data or notes.
  if (privacyRetryRequired) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
        <RouteIconButton accessibilityLabel="Back" onPress={session.closeToProgress} tone="night" />
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityState={{ busy: deleting }}
          style={{ flex: 1, justifyContent: 'center', gap: 16, paddingVertical: 24 }}>
          <Text style={{ color: '#F4EFE7', fontSize: 16, lineHeight: 24 }}>{PHOTO_COPY.detail.deleteCleanupPending}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={PHOTO_COPY.deleteSync.retry}
            accessibilityState={{ disabled: deleting, busy: deleting }} disabled={deleting}
            onPress={() => { void session.deletePhoto(); }} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ color: '#F4EFE7' }}>{deleting ? PHOTO_COPY.deleteSync.retrying : PHOTO_COPY.deleteSync.retry}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }
  return (
    <PhotoStorageGate onExit={() => requestExit({ kind: 'back' })}>
      <PhotoDetailScreenContent session={session} />
    </PhotoStorageGate>
  );
}

function PhotoDetailAuthorityBoundary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const actions = usePhotoActions({ authenticatedOwnerUserId: user?.id ?? null });
  return <PhotoDetailSession key={`${actions.authorityKey}:${id}`} id={id} actions={actions} />;
}

function PhotoDetailScreenContent({ session }: { session: DetailSession }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const { height } = useWindowDimensions();
  const compact = height < 640;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isSourceCurrent } = usePhotos('front');
  const photo = data?.all.find((p) => p.id === id);
  const [shareConfirmVisible, setShareConfirmVisible] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const { deleteFeedback } = session;
  const scrollRef = useRef<ScrollView>(null);
  const closeToProgress = session.closeToProgress;

  // Missing-photo UI is only valid after a current authoritative store read.
  // PhotoStorageGate owns loading/unavailable/retry presentation.
  if (!data) return null;

  if (!photo) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: BG,
          paddingTop: insets.top + 12,
          paddingHorizontal: 24,
        }}
      >
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={closeToProgress}
          tone="night"
          style={{
            backgroundColor: 'rgba(244,239,231,0.12)',
            borderColor: 'transparent',
          }}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: compact ? 56 : 72,
            paddingBottom: insets.bottom + (compact ? 18 : 28),
          }}
        >
          <View style={{ gap: compact ? 12 : 14, paddingVertical: compact ? 18 : 24 }}>
            <Text variant="label" style={{ color: 'rgba(244,239,231,0.48)', textAlign: 'center' }}>
              {PHOTO_COPY.detail.missingEyebrow}
            </Text>
            <Text
              style={{
                fontFamily: 'HankenGrotesk-SemiBold',
                fontSize: compact ? 23 : 26,
                lineHeight: compact ? 29 : 32,
                color: '#F4EFE7',
                textAlign: 'center',
              }}
            >
              {PHOTO_COPY.detail.missingTitle}
            </Text>
            <Text
              style={{
                fontFamily: 'HankenGrotesk-Regular',
                fontSize: 15,
                lineHeight: 22,
                color: 'rgba(244,239,231,0.76)',
                textAlign: 'center',
              }}
            >
              {PHOTO_COPY.detail.missingBody}
            </Text>
          </View>

          {!session.removalBlocked && !session.deleteFeedback ? <PhotoDeleteSyncStatus tone="night" /> : null}
          {session.deleteFeedback ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityState={{ busy: session.deleting }}>
              <Text style={{ color: '#F4EFE7', fontSize: 14, lineHeight: 21 }}>{session.deleteFeedback}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={PHOTO_COPY.deleteSync.retry}
                accessibilityState={{ disabled: session.deleting, busy: session.deleting }} disabled={session.deleting}
                onPress={() => { void session.deletePhoto(); }} style={{ minHeight: 48, justifyContent: 'center' }}>
                <Text style={{ color: '#F4EFE7' }}>{session.deleting ? 'Trying again...' : PHOTO_COPY.deleteSync.retry}</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={{ gap: 12, marginTop: compact ? 8 : 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={session.replaceWithCapture}
              style={{
                minHeight: 56,
                borderRadius: 999,
                backgroundColor: '#F4EFE7',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
                {PHOTO_COPY.detail.missingCapture}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={closeToProgress}
              style={{
                minHeight: 56,
                borderRadius: 999,
                backgroundColor: 'rgba(244,239,231,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 16,
                  color: '#F4EFE7',
                }}
              >
                {PHOTO_COPY.detail.missingBack}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const dateLabel = parseLocalDate(photo.takenLocalDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const captureQualityLabel =
    photo.qualitySource === 'post_capture_measurement'
      ? 'Capture checks recorded'
      : 'Quality not measured';
  const photoHeight = compact ? Math.min(240, Math.round(height * 0.38)) : 330;
  const actionFeedback = deleteFeedback ?? session.referenceFeedback ?? shareFeedback;

  function nudgeActionFeedbackIntoView() {
    const scrollToEnd = () =>
      scrollRef.current?.scrollToEnd({ animated: motionAllowed(reduceMotion) });
    requestAnimationFrame(scrollToEnd);
    setTimeout(scrollToEnd, 120);
    setTimeout(scrollToEnd, 280);
  }

  function confirmDelete() {
    if (!isSourceCurrent() || !session.isCurrent() || session.deleting) return;
    setShareConfirmVisible(false);
    setShareFeedback(null);
    session.clearDeleteFeedback();
    setDeleteConfirmVisible(true);
  }

  async function deleteCurrentPhoto() {
    if (!isSourceCurrent() || !session.isCurrent()) return;
    setDeleteConfirmVisible(false);
    await session.deletePhoto();
    nudgeActionFeedbackIntoView();
  }

  async function shareCurrentPhoto() {
    if (!photo) return;
    session.clearDeleteFeedback();
    setShareFeedback(null);
    setShareConfirmVisible(false);
    const shared = await sharePhotoImageOnly(photo);
    if (!shared) {
      setShareFeedback(PHOTO_COPY.detail.shareUnavailable);
      nudgeActionFeedbackIntoView();
    }
  }

  function confirmShare() {
    if (session.removalBlocked || !session.isCurrent()) return;
    setDeleteConfirmVisible(false);
    session.clearDeleteFeedback();
    setShareFeedback(null);
    setShareConfirmVisible(true);
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 12, paddingHorizontal: 24 }}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={closeToProgress}
          tone="night"
          style={{
            backgroundColor: 'rgba(244,239,231,0.12)',
            borderColor: 'transparent',
          }}
        />
        <Text style={{ fontFamily: 'HankenGrotesk-Bold', fontSize: 14, color: '#F4EFE7' }}>
          {dateLabel}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }}
      >
        {/* photo */}
        <View
          style={{
            height: photoHeight,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: '#2A251E',
            marginBottom: compact ? 10 : 14,
          }}
        >
          {photo.localUri ? (
            <PhotoImage
              uri={photo.localUri}
              photoId={photo.id}
              captureSessionId={photo.captureSessionId}
              rendition="display"
              requestPriority="interactive"
              style={{ flex: 1 }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="label" style={{ color: 'rgba(244,239,231,0.3)' }}>
                your photo
              </Text>
            </View>
          )}
        </View>

        {/* quality + time chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(244,239,231,0.08)',
              borderRadius: 999,
              paddingHorizontal: 13,
              paddingVertical: 7,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SAGE }} />
            <Text
              style={{
                fontFamily: 'HankenGrotesk-SemiBold',
                fontSize: 12,
                color: 'rgba(244,239,231,0.8)',
              }}
            >
              {captureQualityLabel}
            </Text>
          </View>
          {photo.timeOfDay ? (
            <View
              style={{
                backgroundColor: 'rgba(244,239,231,0.08)',
                borderRadius: 999,
                paddingHorizontal: 13,
                paddingVertical: 7,
              }}
            >
              <Text
                style={{
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 12,
                  color: 'rgba(244,239,231,0.8)',
                }}
              >
                {photo.timeOfDay}
              </Text>
            </View>
          ) : null}
          {photo.isReference ? (
            <View
              style={{
                backgroundColor: 'rgba(176,122,60,0.18)',
                borderRadius: 999,
                paddingHorizontal: 13,
                paddingVertical: 7,
              }}
            >
              <Text
                style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 12, color: '#D9A183' }}
              >
                reference
              </Text>
            </View>
          ) : null}
        </View>

        {actionFeedback ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: '#211C16',
              borderColor: 'rgba(244,239,231,0.14)',
              borderRadius: 16,
              borderWidth: 1,
              marginBottom: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                color: 'rgba(244,239,231,0.84)',
                fontFamily: 'HankenGrotesk-Regular',
                fontSize: 13,
                lineHeight: 18,
                textAlign: 'center',
              }}
            >
              {actionFeedback}
            </Text>
          </View>
        ) : null}

        {/* note */}
        <View
          style={{
            borderRadius: 16,
            backgroundColor: 'rgba(244,239,231,0.06)',
            padding: 16,
            marginBottom: 'auto',
          }}
        >
          <Text variant="label" style={{ color: 'rgba(244,239,231,0.4)', marginBottom: 6 }}>
            {PHOTO_COPY.detail.noteLabel.toUpperCase()}
          </Text>
          <PhotoDetailNoteEditor coordinator={session.noteForPhoto(photo.notes ?? '')} isCurrent={session.isCurrent} />
        </View>

        {!shareConfirmVisible && !deleteConfirmVisible ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingTop: 16 }}>
            <Pressable
              accessibilityRole="button"
              disabled={session.referencing || session.deleting}
              accessibilityState={{ disabled: session.referencing || session.deleting, busy: session.referencing }}
              onPress={() => {
                if (isSourceCurrent() && session.isCurrent()) void session.setReference();
              }}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 13, color: '#F4EFE7' }}
              >
                {PHOTO_COPY.detail.setReference}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={PHOTO_COPY.detail.shareLabel}
              onPress={confirmShare}
              style={{
                width: 48,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#F4EFE7', fontSize: 16 }}>↗</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete photo"
              onPress={confirmDelete}
              style={{
                width: 48,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(176,122,60,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#D9A183', fontSize: 16 }}>🗑</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      {shareConfirmVisible ? (
        <View
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: insets.bottom + 20,
            backgroundColor: '#211C16',
            borderColor: 'rgba(244,239,231,0.16)',
            borderRadius: 18,
            borderWidth: 1,
            padding: 14,
          }}
        >
          <Text
            style={{
              color: '#F4EFE7',
              fontFamily: 'HankenGrotesk-SemiBold',
              fontSize: 14,
              lineHeight: 19,
            }}
          >
            {PHOTO_COPY.detail.shareTitle}
          </Text>
          <Text
            style={{
              color: 'rgba(244,239,231,0.76)',
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: 13,
              lineHeight: 18,
              marginTop: 4,
            }}
          >
            {PHOTO_COPY.detail.shareBody}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShareConfirmVisible(false)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: 'rgba(244,239,231,0.82)',
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 13,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void shareCurrentPhoto()}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: '#F4EFE7',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: BG,
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 13,
                }}
              >
                {PHOTO_COPY.detail.shareConfirm}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {deleteConfirmVisible ? (
        <View
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: insets.bottom + 20,
            backgroundColor: '#211C16',
            borderColor: 'rgba(244,239,231,0.16)',
            borderRadius: 18,
            borderWidth: 1,
            padding: 14,
          }}
        >
          <Text
            style={{
              color: '#F4EFE7',
              fontFamily: 'HankenGrotesk-SemiBold',
              fontSize: 14,
              lineHeight: 19,
            }}
          >
            {PHOTO_COPY.detail.deleteTitle}
          </Text>
          <Text
            style={{
              color: 'rgba(244,239,231,0.76)',
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: 13,
              lineHeight: 18,
              marginTop: 4,
            }}
          >
            {PHOTO_COPY.detail.deleteBody}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: session.deleting }}
              disabled={session.deleting}
              onPress={() => setDeleteConfirmVisible(false)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: 'rgba(244,239,231,0.82)',
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 13,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: session.deleting }}
              disabled={session.deleting}
              onPress={() => void deleteCurrentPhoto()}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: '#D9A183',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: BG,
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 13,
                }}
              >
                {session.deleting ? 'Deleting...' : PHOTO_COPY.detail.deleteConfirm}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function PhotoDetailScreen() {
  return (
    <ProGate feature="photo_timeline">
      <PhotoTimelineLockGate>
        <PhotoDetailAuthorityBoundary />
      </PhotoTimelineLockGate>
    </ProGate>
  );
}
