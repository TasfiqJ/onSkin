import type { CycleVariant } from '@onskin/types';
import { router } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button, RouteIconButton, Screen, Sheet, Text } from '@/components/ui';
import {
  motionAwareModalAnimation,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import { canUseRoutineCadence } from '@/features/routine/reviewGate';
import { classLabel } from '@/features/scheduler/classes';
import {
  adjustCustomCycleFrequency,
  allowedCustomCycleOccurrences,
  applyCustomCycleDefinition,
  approximateWeeklyFrequency,
  assignCustomCycleNight,
  customCycleFromCycle,
  customCycleLimitViolations,
  customCycleOccurrences,
  customCycleProductIds,
  fitCustomCycleToCadence,
  hasAdjacentSameClass,
  MAX_CUSTOM_CYCLE_LENGTH,
  MIN_CUSTOM_CYCLE_LENGTH,
  pruneMissingCustomCycleProducts,
  resizeCustomCycle,
  type CustomCycleDefinition,
  type CustomCycleEditBlock,
  type CycleEditorActive,
} from '@/features/scheduler/customCycle';
import { CycleMutationError } from '@/features/scheduler/CycleMutationError';
import { slotLabel } from '@/features/scheduler/projection';
import { useCycle, useCycleMutations, type CycleData } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

const VARIANTS: { id: CycleVariant; label: string; sub: string }[] = [
  { id: 'gentle', label: 'Gentle', sub: 'More recovery' },
  { id: 'classic', label: 'Classic', sub: 'Balanced rest' },
  { id: 'advanced', label: 'Advanced', sub: 'Fewer rest nights' },
  { id: 'custom', label: 'Custom', sub: 'Your night plan' },
];
const PENDING_CYCLE_SAVE_HISTORY_KEY = '__routinekindPendingCycleSave';
type BrowserNavigation = {
  addEventListener: (type: 'navigate', listener: (event: Event) => void) => void;
  removeEventListener: (type: 'navigate', listener: (event: Event) => void) => void;
};

export default function CycleSettingsScreen() {
  const { data, isLoading } = useCycle();
  const cadenceReady = canUseRoutineCadence();

  if (!cadenceReady) return <CadenceReviewGate />;
  if (isLoading || !data) return <CycleSettingsLoading />;

  const configKey = `${data.config.variant}:${JSON.stringify(data.config.customCycle)}`;
  return <CycleSettingsEditor key={configKey} data={data} />;
}

function CycleSettingsEditor({ data }: { data: CycleData }) {
  const mutations = useCycleMutations();
  const baselineVariant = selectedVariant(data);
  const baselineCustom = useMemo(
    () =>
      data.config.customCycle ??
      fitCustomCycleToCadence(
        customCycleFromCycle(data.recommendedCycle ?? data.cycle),
        data.cycleActives,
      ),
    [data],
  );
  const [draftVariant, setDraftVariant] = useState<CycleVariant>(baselineVariant);
  const [draftCustom, setDraftCustom] = useState<CustomCycleDefinition>(baselineCustom);
  const [selectedNightIndex, setSelectedNightIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [editBlock, setEditBlock] = useState<CustomCycleEditBlock | null>(null);
  const [exitAfterCommit, setExitAfterCommit] = useState(false);
  const guardReady = useRef<(() => void) | null>(null);
  const disarmPendingExit = useRef<() => Promise<void>>(async () => undefined);

  usePreventRemove(saving, () => undefined);
  useEffect(() => {
    if (!saving) return;
    let active = true;
    let removeWebListeners = () => undefined;

    // Browser traversal is not always covered by the native-stack guard. A
    // same-URL entry consumes Back before Expo Router can unmount the draft.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const marker = `${Date.now()}-${Math.random()}`;
      const pushShield = () => {
        const rawState = window.history.state as unknown;
        const state = rawState && typeof rawState === 'object' ? rawState : {};
        window.history.pushState(
          { ...state, [PENDING_CYCLE_SAVE_HISTORY_KEY]: marker },
          '',
          window.location.href,
        );
      };
      const onPopState = (event: PopStateEvent) => {
        if (!active) return;
        event.stopImmediatePropagation();
        window.history.forward();
      };
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!active) return;
        event.preventDefault();
        event.returnValue = '';
      };
      const browserNavigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
      const onNavigate = (event: Event) => {
        if (active && event.cancelable) event.preventDefault();
      };

      pushShield();
      window.addEventListener('popstate', onPopState, { capture: true });
      window.addEventListener('beforeunload', onBeforeUnload);
      browserNavigation?.addEventListener('navigate', onNavigate);
      removeWebListeners = () => {
        window.removeEventListener('popstate', onPopState, { capture: true });
        window.removeEventListener('beforeunload', onBeforeUnload);
        browserNavigation?.removeEventListener('navigate', onNavigate);
      };
      disarmPendingExit.current = async () => {
        if (!active) return;
        active = false;
        removeWebListeners();
        if (window.history.state?.[PENDING_CYCLE_SAVE_HISTORY_KEY] !== marker) return;
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.removeEventListener('popstate', finish);
            window.clearTimeout(timeout);
            resolve();
          };
          const timeout = window.setTimeout(finish, 250);
          window.addEventListener('popstate', finish, { once: true });
          window.history.back();
        });
      };
    } else {
      disarmPendingExit.current = async () => undefined;
    }

    guardReady.current?.();
    guardReady.current = null;
    return () => {
      if (active) void disarmPendingExit.current();
      removeWebListeners();
      disarmPendingExit.current = async () => undefined;
    };
  }, [saving]);
  useEffect(() => {
    if (exitAfterCommit) backOrReplace(router);
  }, [exitAfterCommit]);

  const customMode = draftVariant === 'custom';
  const limitViolations = customMode
    ? customCycleLimitViolations(draftCustom, data.cycleActives)
    : [];
  const spacingNudge = customMode && hasAdjacentSameClass(draftCustom, data.cycleActives);
  const customChanged = JSON.stringify(draftCustom) !== JSON.stringify(baselineCustom);
  const hasChanges =
    draftVariant !== baselineVariant ||
    (customMode && baselineVariant === 'custom' && customChanged);
  const saveDisabled = saving || !hasChanges;
  const selectedDraftIds = new Set(customCycleProductIds(draftCustom));
  const previewActives = data.cycleActives.map((active) =>
    active.staged && selectedDraftIds.has(active.id) ? { ...active, staged: false } : active,
  );
  const previewCycle = customMode
    ? applyCustomCycleDefinition({
        definition: draftCustom,
        actives: previewActives,
        amDaily: data.recommendedCycle?.amDaily ?? data.cycle?.amDaily ?? [],
        notes: data.notes,
      })
    : null;

  function updateCustom(result: {
    definition: CustomCycleDefinition;
    blocked: CustomCycleEditBlock | null;
  }) {
    if (result.blocked) {
      setEditBlock(result.blocked);
      return;
    }
    setEditBlock(null);
    setSaveFailed(false);
    setDraftCustom(result.definition);
  }

  function changeLength(delta: -1 | 1) {
    const candidate = resizeCustomCycle(draftCustom, draftCustom.lengthNights + delta);
    setEditBlock(null);
    setSaveFailed(false);
    setDraftCustom(candidate);
  }

  function chooseVariant(variant: CycleVariant) {
    setDraftVariant(variant);
    setEditBlock(null);
    setSaveFailed(false);
  }

  async function save() {
    if (saveDisabled) return;
    const guardArmed = new Promise<void>((resolve) => {
      guardReady.current = resolve;
    });
    setSaving(true);
    setSaveFailed(false);
    setEditBlock(null);
    try {
      await guardArmed;
      if (customMode) {
        const customCycle = pruneMissingCustomCycleProducts(draftCustom, data.knownProductIds);
        await mutations.saveCustom(customCycle, baselineVariant !== 'custom');
      } else {
        await mutations.setVariant(draftVariant);
      }
      await disarmPendingExit.current();
      setExitAfterCommit(true);
    } catch {
      await disarmPendingExit.current();
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SettingsHeader disabled={saving} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <Text variant="eyebrow" tone="muted" className="mb-2.5 mt-4">
          Variant
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {VARIANTS.map((variant) => {
            const selected = draftVariant === variant.id;
            const sub =
              variant.id === 'custom' && selected
                ? `${draftCustom.lengthNights} nights`
                : variant.sub;
            return (
              <Pressable
                key={variant.id}
                accessibilityRole="button"
                accessibilityLabel={`${variant.label}. ${sub}`}
                accessibilityState={{ disabled: saving, selected }}
                disabled={saving}
                onPress={() => {
                  haptics.select();
                  chooseVariant(variant.id);
                }}
                className={cn(
                  'min-h-[64px] items-center justify-center rounded-[8px] bg-paper-raised px-3 py-2.5',
                  selected ? 'border-2 border-clay' : 'border border-hairline-strong',
                )}
                style={{ width: '48%', flexGrow: 1, opacity: saving ? 0.55 : 1 }}
              >
                <Text className="font-sans-bold text-[13.5px]" tone={selected ? 'ink' : 'muted'}>
                  {variant.label}
                </Text>
                <Text variant="label" tone="muted" className="mt-0.5 text-center">
                  {sub}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {customMode ? (
          <>
            <CycleLengthControl
              definition={draftCustom}
              disabled={saving}
              onChange={changeLength}
            />
            <ActiveFrequencyControls
              actives={data.cycleActives}
              definition={draftCustom}
              disabled={saving}
              onChange={updateCustom}
            />

            {editBlock ? <CustomEditMessage block={editBlock} /> : null}
            {limitViolations.length > 0 ? (
              <View accessibilityRole="alert" className="mt-3 rounded-[8px] bg-clay-tint p-3.5">
                <Text className="font-sans-semibold text-[13.5px]">
                  Some nights will stay recovery
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1">
                  Your saved nights stay intact. Occurrences above the current cadence appear as
                  recovery until your allowed pace changes.
                </Text>
              </View>
            ) : null}

            <NightAssignmentList
              actives={data.cycleActives}
              definition={draftCustom}
              disabled={saving}
              onSelect={setSelectedNightIndex}
            />

            {spacingNudge ? (
              <View className="mt-4 rounded-[8px] bg-clay-tint p-4">
                <Text className="font-sans-semibold text-[13.5px]">Gentler spacing available</Text>
                <Text variant="bodySm" tone="muted" className="mt-1">
                  Repeated acid or retinoid nights usually feel calmer with recovery between them.
                  Recommendation, not a rule.
                </Text>
                <Button
                  label="Use recommended spacing"
                  variant="ghost"
                  disabled={saving}
                  className="mt-2 min-h-[48px] border border-hairline-strong py-2"
                  onPress={() => {
                    setDraftCustom(
                      fitCustomCycleToCadence(
                        customCycleFromCycle(data.recommendedCycle),
                        data.cycleActives,
                      ),
                    );
                    setEditBlock(null);
                    setSaveFailed(false);
                  }}
                />
              </View>
            ) : null}

            <View className="mt-4 rounded-[8px] border border-hairline bg-paper-raised p-4">
              <Text variant="label" tone="muted">
                Preview
              </Text>
              <Text variant="bodySm" className="mt-1 font-sans-semibold">
                {`${previewCycle?.nights.filter((night) => night.productId).length ?? 0} active nights · ${previewCycle?.nights.filter((night) => !night.productId).length ?? draftCustom.lengthNights} recovery · ${draftCustom.lengthNights} total`}
              </Text>
            </View>
          </>
        ) : (
          <GeneratedNightSummary data={data} selectedVariant={draftVariant} />
        )}

        {saveFailed ? <CycleMutationError /> : null}
        <Button
          label={saving ? 'Saving cycle...' : 'Save cycle'}
          disabled={saveDisabled}
          className="mt-5"
          onPress={() => void save()}
        />
      </ScrollView>

      <NightAssignmentSheet
        actives={data.cycleActives}
        definition={draftCustom}
        disabled={saving}
        index={selectedNightIndex}
        onClose={() => setSelectedNightIndex(null)}
        onChange={updateCustom}
      />
    </Screen>
  );
}

function SettingsHeader({ disabled = false }: { disabled?: boolean }) {
  return (
    <View className="mt-2 flex-row items-center justify-between">
      <RouteIconButton
        accessibilityLabel="Cancel cycle changes"
        glyph="x"
        disabled={disabled}
        onPress={() => backOrReplace(router)}
      />
      <Text variant="body" className="font-sans-semibold">
        Cycle settings
      </Text>
      <View className="w-[48px]" />
    </View>
  );
}

function CadenceReviewGate() {
  return (
    <Screen edges={['top', 'bottom']}>
      <SettingsHeader />
      <View className="mt-6 rounded-[8px] bg-paper-raised p-5">
        <Text variant="body" className="font-sans-semibold">
          Cycle settings open after review.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-2">
          Your routine can still be used daily. Skin-cycling cadence and ramp settings stay hidden
          in production until clinical and cosmetic-chemistry review closes.
        </Text>
      </View>
    </Screen>
  );
}

function CycleSettingsLoading() {
  return (
    <Screen edges={['top', 'bottom']}>
      <SettingsHeader />
      <Text variant="bodySm" tone="muted" className="mt-6">
        Loading cycle settings...
      </Text>
    </Screen>
  );
}

function CycleLengthControl({
  definition,
  disabled,
  onChange,
}: {
  definition: CustomCycleDefinition;
  disabled: boolean;
  onChange: (delta: -1 | 1) => void;
}) {
  return (
    <View className="mt-6">
      <Text variant="eyebrow" tone="muted">
        Cycle length
      </Text>
      <View className="mt-2 flex-row items-center justify-between rounded-[8px] border border-hairline bg-paper-raised p-2">
        <RouteIconButton
          accessibilityLabel="Remove one cycle night"
          glyph="-"
          tone="muted"
          disabled={disabled || definition.lengthNights <= MIN_CUSTOM_CYCLE_LENGTH}
          onPress={() => onChange(-1)}
        />
        <View className="items-center px-3">
          <Text variant="titleSm">{definition.lengthNights}</Text>
          <Text variant="label" tone="muted">
            nights
          </Text>
        </View>
        <RouteIconButton
          accessibilityLabel="Add one cycle night"
          glyph="+"
          tone="muted"
          disabled={disabled || definition.lengthNights >= MAX_CUSTOM_CYCLE_LENGTH}
          onPress={() => onChange(1)}
        />
      </View>
    </View>
  );
}

function ActiveFrequencyControls({
  actives,
  definition,
  disabled,
  onChange,
}: {
  actives: readonly CycleEditorActive[];
  definition: CustomCycleDefinition;
  disabled: boolean;
  onChange: (result: ReturnType<typeof adjustCustomCycleFrequency>) => void;
}) {
  return (
    <View className="mt-6">
      <Text variant="eyebrow" tone="muted" className="mb-2.5">
        Active frequency
      </Text>
      {actives.length === 0 ? (
        <Text variant="bodySm" tone="muted">
          No eligible night actives are on your shelf.
        </Text>
      ) : (
        <View className="gap-2">
          {actives.map((active) => {
            const count = customCycleOccurrences(definition, active.id);
            const requestedWeekly = approximateWeeklyFrequency(count, definition.lengthNights);
            const allowed = allowedCustomCycleOccurrences(
              active.maxFrequencyPerWeek,
              definition.lengthNights,
            );
            const appliedCount = active.eligible ? Math.min(count, allowed) : 0;
            const appliedWeekly = approximateWeeklyFrequency(appliedCount, definition.lengthNights);
            const addResult = adjustCustomCycleFrequency(definition, active, 1);
            const detail = !active.eligible
              ? `${formatFrequency(requestedWeekly)}/week requested · paused by safety setting`
              : count === 0
                ? active.staged
                  ? 'Not scheduled · phased introduction'
                  : 'Not scheduled'
                : appliedCount < count
                  ? `${formatFrequency(requestedWeekly)}/week requested · ${formatFrequency(appliedWeekly)}/week currently scheduled`
                  : `${formatFrequency(requestedWeekly)}/week saved and scheduled`;
            return (
              <View
                key={active.id}
                className="min-h-[64px] flex-row items-center gap-2 rounded-[8px] border border-hairline bg-paper-raised p-2"
              >
                <View className="min-w-0 flex-1 px-1">
                  <Text variant="bodySm" className="font-sans-semibold">
                    {active.name}
                  </Text>
                  <Text variant="label" tone="muted" className="mt-0.5">
                    {classLabel(active.className)} · {detail}
                  </Text>
                </View>
                <RouteIconButton
                  accessibilityLabel={`Remove one ${active.name} night`}
                  glyph="-"
                  tone="muted"
                  disabled={disabled || count === 0}
                  onPress={() => onChange(adjustCustomCycleFrequency(definition, active, -1))}
                />
                <RouteIconButton
                  accessibilityLabel={`Add one ${active.name} night`}
                  glyph="+"
                  tone="muted"
                  disabled={disabled || addResult.blocked !== null}
                  onPress={() => onChange(addResult)}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function NightAssignmentList({
  actives,
  definition,
  disabled,
  onSelect,
}: {
  actives: readonly CycleEditorActive[];
  definition: CustomCycleDefinition;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  const activeById = new Map(actives.map((active) => [active.id, active] as const));
  return (
    <View className="mt-6">
      <Text variant="eyebrow" tone="muted" className="mb-2.5">
        Night assignments
      </Text>
      <View className="gap-2">
        {definition.nights.map((night, index) => {
          const active = night.productId ? activeById.get(night.productId) : null;
          const assignment = !night.productId
            ? 'Recovery'
            : active
              ? `${active.name}${active.eligible ? '' : ' · paused'}`
              : 'Unavailable active';
          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Night ${index + 1}. ${assignment}. Change assignment`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onSelect(index)}
              className="min-h-[56px] flex-row items-center gap-3 rounded-[8px] border border-hairline bg-paper-raised px-3.5 py-2.5"
              style={({ pressed }) => ({ opacity: disabled ? 0.55 : pressed ? 0.82 : 1 })}
            >
              <View className="rounded-[6px] bg-clay-tint px-2 py-1">
                <Text className="font-sans-semibold text-[10.5px]">Night {index + 1}</Text>
              </View>
              <Text variant="bodySm" className="min-w-0 flex-1 font-sans-semibold">
                {assignment}
              </Text>
              <Text tone="muted" accessibilityElementsHidden importantForAccessibility="no">
                ›
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NightAssignmentSheet({
  actives,
  definition,
  disabled,
  index,
  onClose,
  onChange,
}: {
  actives: readonly CycleEditorActive[];
  definition: CustomCycleDefinition;
  disabled: boolean;
  index: number | null;
  onClose: () => void;
  onChange: (result: ReturnType<typeof assignCustomCycleNight>) => void;
}) {
  const reduceMotion = useReduceMotionPreference();
  if (index === null) return null;
  const selectedId = definition.nights[index]?.productId ?? null;
  const options: { id: string | null; label: string; disabled: boolean }[] = [
    { id: null, label: 'Recovery', disabled: false },
    ...actives.map((active) => ({
      id: active.id,
      label: `${active.name} · ${classLabel(active.className)}`,
      disabled: !active.eligible,
    })),
  ];

  return (
    <Modal
      transparent
      animationType={motionAwareModalAnimation(reduceMotion, 'fade')}
      visible
      onRequestClose={() => {
        if (!disabled) onClose();
      }}
    >
      <Sheet onClose={onClose} scroll dismissDisabled={disabled}>
        <View className="pb-2">
          <Text variant="titleSm">Night {index + 1}</Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            Choose one active or recovery.
          </Text>
          <View className="mt-4 gap-2">
            {options.map((option) => {
              const selected = option.id === selectedId;
              return (
                <Pressable
                  key={option.id ?? 'recovery'}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: selected,
                    disabled: disabled || option.disabled,
                    selected,
                  }}
                  disabled={disabled || option.disabled}
                  onPress={() => {
                    const result = assignCustomCycleNight(definition, index, option.id, actives);
                    onChange(result);
                    if (!result.blocked) onClose();
                  }}
                  className={cn(
                    'min-h-[52px] justify-center rounded-[8px] border px-4 py-3',
                    selected ? 'border-clay bg-clay-tint' : 'border-hairline bg-paper-raised',
                    option.disabled && 'opacity-45',
                  )}
                >
                  <Text variant="bodySm" className="font-sans-semibold">
                    {option.label}
                  </Text>
                  {option.disabled ? (
                    <Text variant="label" tone="muted" className="mt-0.5">
                      Paused by safety setting
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Button
            label="Done"
            variant="ghost"
            disabled={disabled}
            className="mt-3 min-h-[48px]"
            onPress={onClose}
          />
        </View>
      </Sheet>
    </Modal>
  );
}

function GeneratedNightSummary({
  data,
  selectedVariant: draftVariant,
}: {
  data: CycleData;
  selectedVariant: Exclude<CycleVariant, 'custom'>;
}) {
  const baselineVariant = selectedVariant(data);
  const potentNights = (data.cycle?.nights ?? []).filter(
    (night) => night.slot === 'exfoliate' || night.slot === 'retinoid',
  );
  if (draftVariant !== baselineVariant) {
    return (
      <Text variant="bodySm" tone="muted" className="mt-6">
        Save to generate the {variantLabel(draftVariant)} cycle.
      </Text>
    );
  }
  if (!data.cycle) {
    return (
      <Text variant="bodySm" tone="muted" className="mt-6">
        Add a reviewed night active to build a cycle.
      </Text>
    );
  }
  return (
    <View className="mt-6">
      <Text variant="eyebrow" tone="muted" className="mb-2.5">
        Actives on your nights
      </Text>
      <View className="gap-2">
        {potentNights.map((night) => (
          <View
            key={night.index}
            className="min-h-[56px] flex-row items-center gap-3 rounded-[8px] border border-hairline bg-paper-raised px-3.5 py-2.5"
          >
            <View className="rounded-[6px] bg-clay-tint px-2 py-1">
              <Text className="font-sans-semibold text-[10.5px]">Night {night.index + 1}</Text>
            </View>
            <Text variant="bodySm" className="min-w-0 flex-1 font-sans-semibold">
              {night.productName}{' '}
              <Text variant="label" tone="muted">
                {slotLabel(night.slot).toLowerCase()}
              </Text>
            </Text>
            <Text variant="label" tone="muted">
              Scheduled
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CustomEditMessage({ block }: { block: CustomCycleEditBlock }) {
  const message =
    block === 'cadence_limit'
      ? 'That change is above the current cadence. Add recovery nights or lower the frequency first.'
      : block === 'recovery_required'
        ? 'Keep at least one recovery night in every cycle.'
        : 'That active is paused by your current safety setting.';
  return (
    <View accessibilityRole="alert" className="mt-3 rounded-[8px] bg-clay-tint p-3.5">
      <Text variant="bodySm" className="font-sans-semibold">
        {message}
      </Text>
    </View>
  );
}

function selectedVariant(data: CycleData): CycleVariant {
  if (data.config.variant !== 'auto') return data.config.variant;
  return data.recommendedCycle?.variant ?? data.cycle?.variant ?? 'gentle';
}

function variantLabel(variant: CycleVariant): string {
  return VARIANTS.find((item) => item.id === variant)?.label.toLowerCase() ?? variant;
}

function formatFrequency(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
