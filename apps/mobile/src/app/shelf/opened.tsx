import type { PaoSource } from '@layerwell/types';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, RouteIconButton, Sheet, Text } from '@/components/ui';
import {
  beginShelfAddSubmissionAttempt,
  type ShelfAddSubmissionAttempt,
} from '@/features/shelf/addSubmissionAttempt';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { finalizeCatalogLookupAfterShelfSave } from '@/features/shelf/catalogLookupRecovery';
import {
  PAO_MONTH_OPTIONS,
  parsePaoMonthInput,
  shiftLocalDateMonths,
} from '@/features/shelf/freshness';
import { isCurrentIntakeSession, useIntake } from '@/features/shelf/IntakeContext';
import { paoSourceLabel } from '@/features/shelf/labels';
import { LocalDateField } from '@/features/shelf/LocalDateField';
import { useShelfMutations } from '@/features/shelf/mutations';
import { editedPaoSource } from '@/features/shelf/paoProvenance';
import { useShelf } from '@/features/shelf/useShelf';
import { useRoutineClock } from '@/features/today/useRoutineClock';
import { localDateString } from '@/features/today/useToday';
import { cn } from '@/lib/cn';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  APP_ONBOARDING_PRODUCTS_ROUTE,
  APP_SHELF_ROUTE,
  backOrReplace,
} from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// The opened-date linchpin (design screen 04, docs/04 §4.5). Every intake path
// converges here. Without an opened-date there is no PAO clock. Calm, skippable,
// with an explicit "not opened yet" state and an editable, source-labelled PAO.
type Mode = 'just' | 'pick' | 'unopened';

const PICK_OPTIONS = [
  { label: '2 weeks ago', months: 0 },
  { label: '1 month ago', months: 1 },
  { label: '3 months ago', months: 3 },
  { label: '6 months ago', months: 6 },
];
function pickOptionDate(months: number): string {
  const now = new Date();
  if (months === 0) {
    now.setDate(now.getDate() - 14);
    return localDateString(now);
  }
  return shiftLocalDateMonths(localDateString(now), -months) ?? localDateString(now);
}

function OptionRow({
  title,
  subtitle,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      className={cn(
        'flex-row items-center gap-3.5 rounded-[18px] bg-paper-raised p-4',
        selected ? 'border-2 border-clay' : 'border border-hairline',
      )}
    >
      <View
        className={cn(
          'h-[22px] w-[22px] items-center justify-center rounded-full',
          selected ? 'bg-clay' : 'border-[1.5px] border-hairline-strong',
        )}
      >
        {selected ? <Text className="text-[11px] text-paper">✓</Text> : null}
      </View>
      <View className="flex-1">
        <Text variant="body" className="font-sans-semibold">
          {title}
        </Text>
        <Text variant="bodySm" tone="muted">
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export default function OpenedDateScreen() {
  const { intakeId, origin } = useLocalSearchParams<{ intakeId?: string; origin?: string }>();
  const { clearIfCurrent, draft, isSessionCurrent, sessionId } = useIntake();
  const queryClient = useQueryClient();
  useShelf();
  const m = useShelfMutations();
  const [mode, setMode] = useState<Mode | null>(null);
  const [pickIso, setPickIso] = useState<string | null>(null);
  const [pao, setPao] = useState<number | null>(draft.paoMonths);
  const [paoSource, setPaoSource] = useState<PaoSource>(draft.paoSource);
  const [paoEditOpen, setPaoEditOpen] = useState(false);
  const [customPaoText, setCustomPaoText] = useState(() =>
    draft.paoMonths != null && !PAO_MONTH_OPTIONS.some((months) => months === draft.paoMonths)
      ? String(draft.paoMonths)
      : '',
  );
  const [saving, setSaving] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completedProductId, setCompletedProductId] = useState<string | null>(null);
  usePreventRemove(saving && completedProductId === null, () => undefined);
  const saveOperationId = useRef(randomUUID()).current;
  const attempt = useRef<ShelfAddSubmissionAttempt | null>(null);
  const [attemptLocked, setAttemptLocked] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  let acceptedLease: ReturnType<typeof captureHealthDataWriteLease> | undefined;
  try {
    acceptedLease = captureHealthDataWriteLease();
  } catch {
    /* admission closed */
  }
  const leaseAtRender = acceptedLease;
  function isCurrent(): boolean {
    if (!mounted.current || !leaseAtRender) return false;
    try {
      assertHealthDataWriteLease(leaseAtRender);
      return true;
    } catch {
      return false;
    }
  }
  function isShelfCurrent(productId?: string): boolean {
    if (!isCurrent()) return false;
    const state = queryClient.getQueryState<NonNullable<ReturnType<typeof useShelf>['data']>>([
      'shelf',
    ]);
    const data = state?.data;
    return (
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      !state.isInvalidated &&
      data !== undefined &&
      data.sourceGeneration === leaseAtRender?.generation &&
      (!productId || data.items.some((item) => item.id === productId))
    );
  }
  function close() {
    if (saving || inFlight.current || !isCurrent()) return;
    if (sessionId && !clearIfCurrent(sessionId)) return;
    backOrReplace(router, fallbackRoute);
  }
  const editingDisabled = saving || attemptLocked;
  const [dateShortcutRevision, setDateShortcutRevision] = useState(0);
  function canEdit(): boolean {
    return !inFlight.current && attempt.current === null && isShelfCurrent();
  }
  const fallbackRoute = origin === 'onboarding' ? APP_ONBOARDING_PRODUCTS_ROUTE : APP_SHELF_ROUTE;
  const today = useRoutineClock().localDate;
  useEffect(() => {
    if (!completedProductId || !isShelfCurrent(completedProductId)) return;
    if (origin === 'onboarding') {
      router.replace({
        pathname: APP_ONBOARDING_PRODUCTS_ROUTE,
        params: { addedProductId: completedProductId },
      });
    } else {
      router.replace(APP_SHELF_ROUTE);
    }
  });

  const hasProductDraft =
    isCurrentIntakeSession(sessionId, intakeId) &&
    (draft.name.trim().length > 0 || draft.catalogProductId != null || draft.barcode != null);
  const canSave = mode != null && (mode !== 'pick' || pickIso != null);
  const customPaoMonths = parsePaoMonthInput(customPaoText);

  const onSave = async () => {
    const productName = draft.name.trim();
    const saveSessionId = sessionId;
    if (
      !hasProductDraft ||
      !productName ||
      !saveSessionId ||
      mode == null ||
      !canSave ||
      saving ||
      inFlight.current ||
      !isSessionCurrent(saveSessionId) ||
      !isShelfCurrent()
    )
      return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    let shelfWriteSucceeded = false;
    let navigationReady = false;
    try {
      const openedAt = mode === 'just' ? localDateString() : mode === 'pick' ? pickIso : null;
      const isOpened = mode !== 'unopened';
      const submission = beginShelfAddSubmissionAttempt(attempt.current, saveOperationId, () => ({
        operationId: saveOperationId,
        name: productName,
        brand: draft.brand,
        category: draft.category,
        barcode: draft.barcode,
        catalogProductId: draft.catalogProductId,
        catalogSourceId: draft.catalogSourceId,
        catalogSource: draft.catalogSource,
        catalogSourceName: draft.catalogSourceName,
        catalogSourceRef: draft.catalogSourceRef,
        catalogSourceUrl: draft.catalogSourceUrl,
        catalogSourceSnapshotDate: draft.catalogSourceSnapshotDate,
        catalogMatchQuality: draft.catalogMatchQuality,
        dataQualityScore: draft.dataQualityScore,
        ingredientParseStatus: draft.ingredientParseStatus,
        ingredientParseConfidence: draft.ingredientParseConfidence,
        parserVersion: draft.parserVersion,
        sourceDisclosureAckAt: draft.sourceDisclosureAckAt,
        ingredients: draft.ingredients,
        openedAt,
        isOpened,
        paoMonths: pao,
        paoSource,
        expiryDate: draft.expiryDate,
        addedVia: draft.addedVia,
      }));
      attempt.current = submission;
      setAttemptLocked(true);
      const addedProduct = await m.add({ ...submission.input });
      shelfWriteSucceeded = true;
      if (!isCurrent() || !isSessionCurrent(saveSessionId)) return;
      submission.productId = addedProduct.id;
      setSavedLocally(true);
      if (!isShelfCurrent(addedProduct.id)) throw new Error('SHELF_READBACK_UNCONFIRMED');
      if (draft.barcode) {
        const ownerUserId = activeHealthProcessingOwnerUserId();
        if (!ownerUserId) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
        await finalizeCatalogLookupAfterShelfSave({
          ownerUserId,
          barcode: draft.barcode,
          shelfProductId: addedProduct.id,
          recoveryToken: draft.catalogRecoveryToken,
        });
      }
      if (!isShelfCurrent(addedProduct.id) || !clearIfCurrent(saveSessionId)) return;
      navigationReady = true;
      setCompletedProductId(addedProduct.id);
    } catch {
      if (isCurrent() && isSessionCurrent(saveSessionId)) {
        setSaveError(
          shelfWriteSucceeded
            ? 'The write returned, but setup is not confirmed. Reload your Shelf, then tap Finish setup to confirm the same product and choices without adding it again.'
            : 'Saving was not confirmed. Retry uses these same choices to avoid a duplicate. Close to start a different product.',
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current && !navigationReady) setSaving(false);
    }
  };

  if (!hasProductDraft) {
    return (
      <Sheet
        fallbackRoute={fallbackRoute}
        backdropAccessible={false}
        dismissDisabled={saving}
        onClose={close}
      >
        <View className="mb-3 flex-row items-start justify-between">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-clay-tint">
            <Text className="text-[18px] text-clay">+</Text>
          </View>
          <RouteIconButton accessibilityLabel="Close" glyph="x" disabled={saving} onPress={close} />
        </View>
        <Text variant="title" className="text-[28px] leading-[31px]" accessibilityRole="header">
          Add product details first.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1.5 text-[13px] leading-[18px]">
          Freshness starts after we know the product. Start with the name, then we&apos;ll ask when
          you opened it.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add product by hand"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          className="mt-4 min-h-[48px] items-center justify-center rounded-pill bg-ink px-5 py-2"
          onPress={() => {
            if (saving || !isShelfCurrent()) return;
            if (sessionId && !clearIfCurrent(sessionId)) return;
            haptics.select();
            trackProductAddStarted('opened_recovery');
            router.replace('/shelf/manual');
          }}
        >
          <Text className="font-sans-semibold" tone="inverse">
            Add by hand
          </Text>
        </Pressable>
      </Sheet>
    );
  }

  return (
    <Sheet
      fallbackRoute={fallbackRoute}
      scroll
      backdropAccessible={false}
      dismissDisabled={saving}
      onClose={close}
    >
      <View className="mb-4 flex-row items-start justify-between">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-clay-tint">
          <Text className="text-[18px] text-clay">◴</Text>
        </View>
        <RouteIconButton accessibilityLabel="Close" glyph="x" disabled={saving} onPress={close} />
      </View>
      <Text variant="title" className="text-[33px] leading-[34px]" accessibilityRole="header">
        When did you open it?
      </Text>
      <Text variant="body" tone="muted" className="mt-2">
        Choose the state that matches this package. A PAO clock starts only after your choice.
      </Text>

      <View className="mt-6 gap-2.5">
        <OptionRow
          title="Just opened it"
          subtitle="Clock starts today"
          selected={mode === 'just'}
          disabled={editingDisabled}
          onPress={() => {
            if (canEdit()) setMode('just');
          }}
        />
        <OptionRow
          title="Pick a date"
          subtitle={
            pickIso
              ? (PICK_OPTIONS.find((o) => pickOptionDate(o.months) === pickIso)?.label ?? pickIso)
              : 'I opened it earlier'
          }
          selected={mode === 'pick'}
          disabled={editingDisabled}
          onPress={() => {
            if (canEdit()) setMode('pick');
          }}
        />
        {mode === 'pick' ? (
          <View className="flex-row flex-wrap gap-2 px-1">
            <LocalDateField
              key={dateShortcutRevision}
              label="Exact opened date"
              value={pickIso}
              maxDate={today}
              disabled={editingDisabled}
              onChangeDate={(value) => {
                if (canEdit()) setPickIso(value);
              }}
            />
            {PICK_OPTIONS.map((o) => (
              <Pressable
                key={o.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: editingDisabled }}
                disabled={editingDisabled}
                onPress={() => {
                  if (!canEdit()) return;
                  haptics.select();
                  setPickIso(pickOptionDate(o.months));
                  setDateShortcutRevision((revision) => revision + 1);
                }}
                className={cn(
                  'min-h-[48px] items-center justify-center rounded-pill px-3.5 py-2',
                  pickIso === pickOptionDate(o.months)
                    ? 'bg-clay'
                    : 'border border-hairline bg-paper-raised',
                )}
              >
                <Text
                  className="font-sans-medium text-[13px]"
                  tone={pickIso === pickOptionDate(o.months) ? 'inverse' : 'ink'}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <OptionRow
          title="Not opened yet"
          subtitle="No PAO clock; add a printed date if the pack has one"
          selected={mode === 'unopened'}
          disabled={editingDisabled}
          onPress={() => {
            if (canEdit()) setMode('unopened');
          }}
        />
      </View>

      {/* Editable, source-labelled PAO row (docs/04 §4.5). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit period after opening"
        accessibilityState={{ disabled: editingDisabled }}
        disabled={editingDisabled}
        onPress={() => {
          if (!canEdit()) return;
          haptics.select();
          setPaoEditOpen((o) => !o);
        }}
        className="mt-5 flex-row items-center justify-between rounded-[16px] bg-greige-chip px-4 py-3.5"
      >
        <View>
          <Text variant="body" className="font-sans-semibold">
            {pao != null ? `PAO: ${pao} months after opening` : 'PAO not set'}
          </Text>
          <Text variant="label" tone="muted" className="mt-0.5">
            {pao != null ? `${paoSourceLabel(paoSource)} · tap to change` : 'tap to set'}
          </Text>
        </View>
        <Text tone="clay">✎</Text>
      </Pressable>

      {paoEditOpen ? (
        <View className="mt-2.5 flex-row flex-wrap gap-2">
          <Text variant="label" tone="muted" className="w-full">
            Choose the months printed beside the open-jar symbol.
          </Text>
          {PAO_MONTH_OPTIONS.map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ disabled: editingDisabled }}
              disabled={editingDisabled}
              onPress={() => {
                if (!canEdit()) return;
                haptics.select();
                setPao(n);
                setCustomPaoText('');
                setPaoSource(
                  editedPaoSource({
                    currentMonths: draft.paoMonths,
                    currentSource: draft.paoSource,
                    nextMonths: n,
                    confirmedFromLabel: true,
                  }),
                );
                setPaoEditOpen(false);
              }}
              className={cn(
                'min-h-[48px] items-center justify-center rounded-pill px-4 py-2',
                pao === n ? 'bg-clay' : 'border border-hairline bg-paper-raised',
              )}
            >
              <Text className="font-sans-medium text-[13px]" tone={pao === n ? 'inverse' : 'ink'}>
                {n} mo
              </Text>
            </Pressable>
          ))}
          <View className="w-full gap-2 rounded-[14px] border border-hairline bg-paper-raised p-3">
            <Text variant="label" tone="muted">
              Another value printed on the label
            </Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                accessibilityLabel="PAO months printed on label"
                accessibilityHint="Enter a whole number from 1 to 120"
                editable={!editingDisabled}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={3}
                value={customPaoText}
                onChangeText={(value) => {
                  if (canEdit()) setCustomPaoText(value);
                }}
                className="h-[48px] min-w-0 flex-1 rounded-[12px] border border-hairline bg-paper px-4 font-sans-medium text-[15px] text-ink"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm label PAO value"
                accessibilityState={{ disabled: editingDisabled || customPaoMonths == null }}
                disabled={editingDisabled || customPaoMonths == null}
                onPress={() => {
                  if (!canEdit()) return;
                  if (customPaoMonths == null) return;
                  haptics.select();
                  setPao(customPaoMonths);
                  setPaoSource(
                    editedPaoSource({
                      currentMonths: draft.paoMonths,
                      currentSource: draft.paoSource,
                      nextMonths: customPaoMonths,
                      confirmedFromLabel: true,
                    }),
                  );
                  setPaoEditOpen(false);
                }}
                className={cn(
                  'min-h-[48px] items-center justify-center rounded-pill px-4 py-2',
                  customPaoMonths == null ? 'bg-greige' : 'bg-ink',
                )}
              >
                <Text
                  className="font-sans-semibold text-[13px]"
                  tone={customPaoMonths == null ? 'muted' : 'inverse'}
                >
                  Use value
                </Text>
              </Pressable>
            </View>
            <Text variant="label" tone="muted">
              Enter whole months from 1 to 120 exactly as printed.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: editingDisabled }}
            disabled={editingDisabled}
            onPress={() => {
              if (!canEdit()) return;
              haptics.select();
              setPao(null);
              setPaoSource('unknown');
              setCustomPaoText('');
              setPaoEditOpen(false);
            }}
            className="min-h-[48px] items-center justify-center rounded-pill px-4 py-2"
          >
            <Text className="font-sans-medium text-[13px]" tone="muted">
              Not on label
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Button
        className="mt-6"
        label={saving ? 'Saving...' : savedLocally ? 'Finish setup' : 'Add to shelf'}
        disabled={!canSave || saving}
        onPress={onSave}
      />
      {saveError ? (
        <View accessibilityRole="alert" className="mt-3 rounded-[14px] bg-clay-tint px-4 py-3">
          <Text variant="bodySm" tone="clay">
            {saveError}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}
