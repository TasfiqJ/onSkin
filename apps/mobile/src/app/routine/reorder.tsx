import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import type { PlanStep } from '@/features/routine/generate';
import {
  routineOrderQueryKeyForLease,
  routineOrderOverrideForPhase,
  saveRoutineOrderOverrides,
  type RoutineOrderPhase,
  type RoutineOrderOverrides,
} from '@/features/routine/orderStore';
import { usePlan } from '@/features/routine/usePlan';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import {
  assertHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Sequencing controls + non-blocking nudge (docs/03 section 7).
// We sort thinnest-to-thickest by default but never lock it. "Guidance, not a
// gate." Full drag gestures are deferred; V1 uses tap-to-select and Earlier /
// Later controls so the user-facing surface does not promise drag-and-drop.
const MOVING_SHADOW =
  Platform.OS === 'web'
    ? { boxShadow: '0 12px 28px rgba(32, 27, 21, 0.18)' }
    : {
        shadowColor: '#201B15',
        shadowOpacity: 0.18,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
      };

type PhaseSteps = Record<RoutineOrderPhase, PlanStep[]>;

function Handle({ active }: { active: boolean }) {
  const color = active ? colors.clay : colors.mutedFaint;
  return (
    <View className="gap-1">
      {[0, 1, 2].map((index) => (
        <View key={index} style={{ width: 16, height: 1.5, backgroundColor: color }} />
      ))}
    </View>
  );
}

function phaseName(phase: RoutineOrderPhase): string {
  return phase === 'am' ? 'Morning' : 'Evening';
}

function phaseOrderKey(steps: readonly PlanStep[]): string {
  return JSON.stringify(steps.map((step) => step.productId));
}

function devRoutineOrderSaveFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return process.env.EXPO_PUBLIC_E2E_ROUTINE_ORDER_SAVE_FAILURE === 'once';
}

export default function ReorderScreen() {
  const params = useLocalSearchParams<{ phase?: string | string[] }>();
  const requestedPhase = Array.isArray(params.phase) ? params.phase[0] : params.phase;
  const initialPhase: RoutineOrderPhase = requestedPhase === 'pm' ? 'pm' : 'am';
  const { data, isLoading, sourceReady, orderLease } = usePlan();
  const canonical = useMemo<PhaseSteps>(
    () => ({
      am: data?.canonicalPlan.am ?? [],
      pm: data?.canonicalPlan.pm ?? [],
    }),
    [data?.canonicalPlan.am, data?.canonicalPlan.pm],
  );
  const initial = useMemo<PhaseSteps>(
    () => ({
      am: data?.plan.am ?? [],
      pm: data?.plan.pm ?? [],
    }),
    [data?.plan.am, data?.plan.pm],
  );
  // A saved-order refresh must not remount an open draft. Canonical input or
  // owner changes still create a fresh editor; saved AM/PM changes do not.
  const editorKey = JSON.stringify([
    routineOrderQueryKeyForLease(orderLease),
    Boolean(data),
    phaseOrderKey(canonical.am),
    phaseOrderKey(canonical.pm),
    [...(data?.activeProductIds ?? [])].sort(),
    initialPhase,
  ]);

  return (
    <ReorderEditor
      key={editorKey}
      canonical={canonical}
      initial={initial}
      initialPhase={initialPhase}
      activeProductIds={data?.activeProductIds ?? []}
      isExample={Boolean(data?.isExample)}
      isLoading={isLoading}
      sourceReady={sourceReady && Boolean(data)}
      orderLease={orderLease}
      persistenceUnavailable={Boolean(data?.orderPersistenceUnavailable)}
      previousOverrides={data?.orderOverrides ?? { schemaVersion: 1, am: [], pm: [] }}
    />
  );
}

function ReorderEditor({
  canonical,
  initial,
  initialPhase,
  activeProductIds,
  isExample,
  isLoading,
  persistenceUnavailable,
  sourceReady,
  orderLease,
  previousOverrides: incomingOverrides,
}: {
  canonical: PhaseSteps;
  initial: PhaseSteps;
  initialPhase: RoutineOrderPhase;
  activeProductIds: string[];
  isExample: boolean;
  isLoading: boolean;
  persistenceUnavailable: boolean;
  sourceReady: boolean;
  orderLease: HealthDataWriteLease | undefined;
  previousOverrides: RoutineOrderOverrides;
}) {
  const queryClient = useQueryClient();
  // These snapshots belong to this editor, not to a later cache refresh.
  const [original] = useState(() => ({
    initial: { am: [...initial.am], pm: [...initial.pm] },
    previousOverrides: {
      ...incomingOverrides,
      am: [...incomingOverrides.am],
      pm: [...incomingOverrides.pm],
    },
    lease: orderLease,
  }));
  const previousOverrides = original.previousOverrides;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const simulatedSaveFailureUsed = useRef(false);
  const saveInFlight = useRef(false);
  const [orders, setOrders] = useState<PhaseSteps>(initial);
  const [phase, setPhase] = useState<RoutineOrderPhase>(initialPhase);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [reloading, setReloading] = useState(false);
  const reloadInFlight = useRef(false);
  const editingUnavailable =
    saving || reloading || isLoading || !sourceReady || persistenceUnavailable || !original.lease;

  function editorIsCurrent(): boolean {
    if (!mounted.current || !original.lease) return false;
    try {
      assertHealthDataWriteLease(original.lease);
      return true;
    } catch {
      return false;
    }
  }

  const order = orders[phase];
  const canonicalOrder = canonical[phase];
  const canonicalKey = phaseOrderKey(canonicalOrder);
  const orderKey = phaseOrderKey(order);
  const violatesOrder = canonicalOrder.length > 0 && orderKey !== canonicalKey;
  const movingIndex = order.findIndex(
    (step, index) => step.productId !== canonicalOrder[index]?.productId,
  );
  const selectedIndex = selectedId ? order.findIndex((step) => step.productId === selectedId) : -1;
  const selectedStep = selectedIndex >= 0 ? order[selectedIndex] : null;
  const amChanged = phaseOrderKey(orders.am) !== phaseOrderKey(original.initial.am);
  const pmChanged = phaseOrderKey(orders.pm) !== phaseOrderKey(original.initial.pm);
  const hasChanges = amChanged || pmChanged;

  function choosePhase(next: RoutineOrderPhase) {
    if (next === phase || editingUnavailable || saveInFlight.current) return;
    haptics.select();
    setPhase(next);
    setSelectedId(null);
    setNudgeDismissed(false);
  }

  function moveSelected(direction: -1 | 1) {
    if (editingUnavailable || saveInFlight.current || selectedIndex < 0) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;

    setOrders((current) => {
      const nextPhase = [...current[phase]];
      const [item] = nextPhase.splice(selectedIndex, 1);
      if (!item) return current;
      nextPhase.splice(nextIndex, 0, item);
      return { ...current, [phase]: nextPhase };
    });
    haptics.select();
    setNudgeDismissed(false);
    setSaveFailed(false);
  }

  async function saveOrder() {
    if (saveInFlight.current || persistenceUnavailable) return;
    if (editingUnavailable || !editorIsCurrent()) return;
    saveInFlight.current = true;
    if (isExample) {
      backOrReplace(router);
      return;
    }

    setSaving(true);
    setSaveFailed(false);
    try {
      const lease = original.lease;
      if (!lease) return;
      assertHealthDataWriteLease(lease);
      const queryKey = routineOrderQueryKeyForLease(lease);
      // A pre-save disk read must not overwrite the newly committed cache.
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (!editorIsCurrent()) return;
      if (devRoutineOrderSaveFailure() && !simulatedSaveFailureUsed.current) {
        simulatedSaveFailureUsed.current = true;
        throw new Error('E2E_ROUTINE_ORDER_SAVE_FAILURE');
      }

      const saved = await saveRoutineOrderOverrides(
        {
          previous: previousOverrides,
          next: {
            schemaVersion: 1,
            // Unedited phases retain the original intent so the store merges
            // the latest independent edit rather than overwriting that phase.
            am: amChanged
              ? routineOrderOverrideForPhase(
                  canonical.am,
                  orders.am,
                  previousOverrides.am,
                  activeProductIds,
                )
              : previousOverrides.am,
            pm: pmChanged
              ? routineOrderOverrideForPhase(
                  canonical.pm,
                  orders.pm,
                  previousOverrides.pm,
                  activeProductIds,
                )
              : previousOverrides.pm,
          },
        },
        lease,
      );
      assertHealthDataWriteLease(lease);
      if (!mounted.current) {
        // A user may leave through native navigation after dispatch. Refresh
        // the same owner's next view, but never navigate or report UI success.
        void queryClient.invalidateQueries({ queryKey, exact: true });
        return;
      }
      queryClient.setQueryData(queryKey, saved);

      if (hasChanges) {
        const changedPhase = amChanged && pmChanged ? 'both' : amChanged ? 'am' : 'pm';
        track('step_reordered', {
          action: 'saved',
          mode: changedPhase,
          source: 'routine_reorder',
        });
        track('routine_edited', {
          action: 'reordered',
          mode: changedPhase,
          source: 'routine_reorder',
        });
      }
      haptics.success();
      backOrReplace(router);
    } catch {
      if (editorIsCurrent()) setSaveFailed(true);
    } finally {
      saveInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function reloadSavedOrder() {
    if (saveInFlight.current || reloadInFlight.current || !editorIsCurrent()) return;
    reloadInFlight.current = true;
    setReloading(true);
    try {
      await queryClient.refetchQueries(
        { queryKey: routineOrderQueryKeyForLease(original.lease), exact: true },
        { throwOnError: true },
      );
      if (editorIsCurrent()) setSaveFailed(false);
    } catch {
      if (editorIsCurrent()) setSaveFailed(true);
    } finally {
      reloadInFlight.current = false;
      if (mounted.current) setReloading(false);
    }
  }

  function resetPhaseOrder() {
    if (editingUnavailable || saveInFlight.current) return;
    setOrders((current) => ({ ...current, [phase]: canonicalOrder }));
    setSelectedId(null);
    setNudgeDismissed(true);
    setSaveFailed(false);
    haptics.select();
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-6"
      >
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
            disabled={saving || reloading}
            onPress={() => {
              if (!saveInFlight.current) backOrReplace(router);
            }}
          >
            <Text variant="body" tone="muted" className="font-sans-semibold text-[15px]">
              Cancel
            </Text>
          </Pressable>
          <Text variant="body" className="font-sans-bold text-[15px]">
            {isExample ? 'Example order' : 'Routine order'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: editingUnavailable }}
            className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
            disabled={editingUnavailable}
            onPress={() => void saveOrder()}
            style={{ opacity: editingUnavailable ? 0.55 : 1 }}
          >
            <Text variant="body" tone="clay" className="font-sans-semibold text-[15px]">
              {isExample ? 'Done' : saving ? 'Saving' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <Text variant="bodySm" tone="muted" className="mt-4 text-[13px]">
          {isExample
            ? 'This example shows how ordering guidance works. Add products to your shelf for your routine.'
            : 'Tap a step, then move it earlier or later. Your saved order applies every time that product is scheduled.'}
        </Text>

        <View
          accessibilityLabel="Routine phase"
          accessibilityRole="tablist"
          className="mt-4 flex-row rounded-[8px] bg-greige-chip p-1"
        >
          {(['am', 'pm'] as const).map((option) => {
            const selected = phase === option;
            return (
              <Pressable
                key={option}
                aria-selected={selected}
                accessibilityRole="tab"
                accessibilityState={{ disabled: editingUnavailable, selected }}
                className="h-[48px] flex-1 items-center justify-center rounded-[6px]"
                disabled={editingUnavailable}
                onPress={() => choosePhase(option)}
                style={{ backgroundColor: selected ? colors.paper : 'transparent' }}
              >
                <Text
                  className="font-sans-semibold text-[13.5px]"
                  style={{ color: selected ? colors.ink : colors.muted }}
                >
                  {phaseName(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-3 font-mono text-[11px] uppercase" style={{ color: colors.clayDeep }}>
          {phaseName(phase)} application order
        </Text>
        {phase === 'pm' ? (
          <Text variant="bodySm" tone="muted" className="mt-1 text-[12.5px]">
            Cycling products appear once here. This order is used on each product&apos;s scheduled
            night.
          </Text>
        ) : null}

        {persistenceUnavailable ? (
          <View accessibilityRole="alert" className="mt-3 rounded-[8px] bg-clay-tint p-3.5">
            <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.ink }}>
              Routine order unavailable
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1 text-[12.5px]">
              Private storage could not be read. Nothing was changed.
            </Text>
          </View>
        ) : null}

        {saveFailed ? (
          <View accessibilityRole="alert" className="mt-3 rounded-[8px] bg-clay-tint p-3.5">
            <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.ink }}>
              Order not saved
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1 text-[12.5px]">
              We could not confirm the save. Reload to check your saved routine, then try again.
            </Text>
          </View>
        ) : null}

        {!isLoading && !sourceReady && !persistenceUnavailable ? (
          <View accessibilityRole="alert" className="mt-3 rounded-[8px] bg-clay-tint p-3.5">
            <Text variant="bodySm" tone="muted">
              Routine inputs are unavailable. Nothing can be saved until they can be read.
              If reloading the order does not help, go back and reopen your routine.
            </Text>
          </View>
        ) : null}

        {(persistenceUnavailable || saveFailed || (!isLoading && !sourceReady)) && original.lease ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reload saved order"
            accessibilityState={{ disabled: saving || reloading }}
            disabled={saving || reloading}
            className="mt-3 min-h-[48px] items-center justify-center rounded-[8px] bg-paper-raised p-3"
            onPress={() => void reloadSavedOrder()}
          >
            <Text variant="bodySm" tone="clay">
              {reloading ? 'Reloading saved order' : 'Reload saved order'}
            </Text>
            <Text variant="bodySm" tone="muted">Your open draft is kept while reloading.</Text>
          </Pressable>
        ) : null}

        <View className="mt-3 gap-2">
          {isLoading ? (
            <View className="rounded-[8px] bg-paper-raised p-4">
              <Text variant="bodySm" tone="muted">
                Loading your generated routine.
              </Text>
            </View>
          ) : null}
          {!isLoading && sourceReady && order.length === 0 ? (
            <View className="rounded-[8px] bg-paper-raised p-4">
              <Text variant="bodySm" tone="muted">
                {`No ${phaseName(phase).toLowerCase()} steps yet. Add products to your shelf to build this out.`}
              </Text>
            </View>
          ) : null}
          {order.map((step, index) => {
            const moving = violatesOrder && index === movingIndex;
            const selected = selectedId === step.productId;
            return (
              <Pressable
                key={step.productId}
                accessibilityHint="Select to reveal Earlier and Later controls"
                accessibilityLabel={`${step.name}. Step ${index + 1} of ${order.length}`}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: editingUnavailable }}
                className={cn(
                  'min-h-[56px] flex-row items-center gap-3 rounded-[8px] bg-paper-raised p-3.5',
                  moving || selected ? 'border-clay' : 'border-hairline',
                )}
                disabled={editingUnavailable}
                onPress={() => {
                  if (!editingUnavailable && !saveInFlight.current) {
                    setSelectedId(selected ? null : step.productId);
                  }
                }}
                style={{
                  borderWidth: moving || selected ? 1.5 : 1,
                  opacity: editingUnavailable ? 0.62 : 1,
                  ...(moving ? { ...MOVING_SHADOW, transform: [{ translateY: -2 }] } : {}),
                }}
              >
                <Handle active={moving || selected} />
                <Text
                  variant="body"
                  className={cn(
                    'min-w-0 flex-1 text-[14.5px]',
                    moving || selected ? 'font-sans-bold' : 'font-sans-medium',
                  )}
                >
                  {step.name}
                </Text>
                {moving ? (
                  <Text className="font-mono text-[10.5px]" style={{ color: colors.clay }}>
                    MOVING
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {selectedStep ? (
          <View className="mt-3 rounded-[8px] bg-paper-raised p-3">
            <Text variant="bodySm" tone="muted" className="text-[13px]">
              Move {selectedStep.name}
            </Text>
            <View className="mt-2 flex-row gap-2">
              <Pressable
                accessibilityLabel={`Move ${selectedStep.name} earlier`}
                accessibilityRole="button"
                disabled={selectedIndex === 0 || editingUnavailable}
                className="h-[48px] flex-1 items-center justify-center rounded-[8px]"
                style={{
                  backgroundColor: selectedIndex === 0 ? colors.greige : colors.paper,
                  borderColor: colors.hairline,
                  borderWidth: 1,
                  opacity: selectedIndex === 0 || editingUnavailable ? 0.55 : 1,
                }}
                onPress={() => moveSelected(-1)}
              >
                <Text className="font-sans-semibold text-[13px]" style={{ color: colors.ink }}>
                  Earlier
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Move ${selectedStep.name} later`}
                accessibilityRole="button"
                disabled={selectedIndex === order.length - 1 || editingUnavailable}
                className="h-[48px] flex-1 items-center justify-center rounded-[8px]"
                style={{
                  backgroundColor:
                    selectedIndex === order.length - 1 ? colors.greige : colors.paper,
                  borderColor: colors.hairline,
                  borderWidth: 1,
                  opacity: selectedIndex === order.length - 1 || editingUnavailable ? 0.55 : 1,
                }}
                onPress={() => moveSelected(1)}
              >
                <Text className="font-sans-semibold text-[13px]" style={{ color: colors.ink }}>
                  Later
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {violatesOrder && !nudgeDismissed ? (
          <View className="mt-4 rounded-[8px] bg-clay-tint p-4">
            <View className="flex-row gap-2.5">
              <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-clay" />
              <Text variant="bodySm" tone="muted" className="flex-1 text-[13.5px]">
                This differs from the recommended application sequence. You can keep it; sequencing
                is guidance, not a rule.
              </Text>
            </View>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: editingUnavailable }}
                className="h-[48px] flex-1 items-center justify-center rounded-[8px]"
                disabled={editingUnavailable}
                style={{ backgroundColor: colors.ink, opacity: editingUnavailable ? 0.55 : 1 }}
                onPress={resetPhaseOrder}
              >
                <Text className="font-sans-semibold text-[13px] text-paper">Fix the order</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: editingUnavailable }}
                className="h-[48px] flex-1 items-center justify-center rounded-[8px]"
                disabled={editingUnavailable}
                style={{ backgroundColor: 'rgba(255,255,255,0.6)', opacity: editingUnavailable ? 0.55 : 1 }}
                onPress={() => {
                  if (!editingUnavailable) setNudgeDismissed(true);
                }}
              >
                <Text className="font-sans-semibold text-[13px]" style={{ color: colors.muted }}>
                  Keep mine
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
