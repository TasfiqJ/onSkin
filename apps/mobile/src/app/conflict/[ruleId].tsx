import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Text } from '@/components/ui';
import { isAdmittedDetectedConflict, type DetectedConflict } from '@/features/intelligence/engine';
import type { ConflictChoices, ConflictUserChoice } from '@/features/intelligence/conflictChoices';
import { setConflictChoice } from '@/features/intelligence/overrides';
import {
  evidenceChip,
  familyTitle,
  interactionClassLabel,
  severityLabel,
} from '@/features/intelligence/presentation';
import {
  applyConflictChoicesToShelfData,
  useShelf,
  type ShelfData,
} from '@/features/shelf/useShelf';
import {
  conflictCheckAccess,
  loadFreeConflictCheckRuleIds,
  recordFreeConflictCheckRuleId,
} from '@/features/subscription/conflictQuota';
import { ProGate } from '@/features/subscription/ProGate';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { NOT_MEDICAL_ADVICE_SHORT } from '@/lib/legal/disclaimer';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Conflict override sheet (design frames 04/05/06, docs/02 §7.3 / docs/03 §7). The
// trust set-piece, as a bottom sheet. Adapts by interaction type: standard
// conflicts get severity/evidence/class + Keep / Use-together (override sticks,
// no re-nagging); myth/synergy reassure on a sage success sheet; safety defers to
// a clinician on a calm night sheet. The user is never blocked.
//
// All interaction-specific claim copy comes from the hash-bound mobile corpus.
// This route supplies layout labels and the standing legal disclaimer only.
const SEV_DOT: Record<string, string> = {
  none: colors.severityNone,
  mild: colors.severityMild,
  moderate: colors.severityModerate,
  high: colors.severityHigh,
};

const SAFETY_ICON_BG = 'rgba(217,161,131,0.16)';
const NIGHT_GRABBER = 'rgba(244,239,231,0.18)';
const NIGHT_BODY = 'rgba(244,239,231,0.72)';
const NIGHT_FAINT = 'rgba(244,239,231,0.5)';

function Chip({ label, dot, bg, fg }: { label: string; dot?: string; bg: string; fg: string }) {
  return (
    <View
      className="flex-row items-center gap-2 self-start rounded-pill"
      style={{ backgroundColor: bg, paddingHorizontal: 13, paddingVertical: 6 }}
    >
      {dot ? <View className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} /> : null}
      <Text className="font-sans-bold text-[12px]" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

/** A check mark composed from two rounded bars (house rule: no react-native-svg).
 *  The short bar is the down-stroke, the long bar the up-stroke; together they
 *  form a tick centered in their parent circle. */
function CheckGlyph({ color, size = 22 }: { color: string; size?: number }) {
  const thickness = Math.max(2.5, size * 0.14);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.4,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          transform: [
            { translateX: -size * 0.2 },
            { translateY: size * 0.12 },
            { rotate: '45deg' },
          ],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.72,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          transform: [
            { translateX: size * 0.08 },
            { translateY: -size * 0.02 },
            { rotate: '-45deg' },
          ],
        }}
      />
    </View>
  );
}

function persistedChoice(choice: 'keep' | 'use_together'): ConflictUserChoice {
  return choice === 'use_together' ? 'use_together' : 'accept_suggested_timing';
}

async function recordChoice(
  c: DetectedConflict,
  choice: 'keep' | 'use_together',
): Promise<ConflictChoices> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  // Exact-hash choices remain encrypted and local-only until a hash-bound
  // backend schema exists.
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    const userChoice = persistedChoice(choice);
    const conflictChoices = await setConflictChoice(c, userChoice);
    lease.assertCurrent();
    return conflictChoices;
  });
}

function firstSearchParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}

function conflictProductPairLabel(conflict: DetectedConflict): string | null {
  const names = [conflict.productAName, conflict.productBName].filter((name): name is string =>
    Boolean(name?.trim()),
  );
  return names.length > 0 ? names.join(' + ') : null;
}

function conflictSuggestion(conflict: DetectedConflict): string {
  return conflict.rule.copy.resolution;
}

export default function ConflictSheet() {
  const params = useLocalSearchParams<{
    ruleId?: string | string[];
    productAId?: string | string[];
    productBId?: string | string[];
    subjectProductId?: string | string[];
  }>();
  const ruleId = firstSearchParam(params.ruleId);
  const productAId = firstSearchParam(params.productAId);
  const productBId = firstSearchParam(params.productBId);
  const subjectProductId = firstSearchParam(params.subjectProductId);
  const requestedPair = productAId && productBId ? [productAId, productBId].sort().join('+') : null;
  const incompletePair = Boolean(productAId || productBId) && requestedPair == null;
  const invalidIdentity = incompletePair || Boolean(subjectProductId && requestedPair);
  const { data } = useShelf();
  const entitlement = useEntitlement();
  const [seenRuleIds, setSeenRuleIds] = useState<string[] | null>(null);
  const ruleMatches =
    data?.conflicts.filter(
      (candidate) => isAdmittedDetectedConflict(candidate) && candidate.rule.id === ruleId,
    ) ?? [];
  const conflict = invalidIdentity
    ? undefined
    : requestedPair
      ? ruleMatches.find(
          (candidate) =>
            [candidate.productAId ?? '', candidate.productBId ?? ''].sort().join('+') ===
            requestedPair,
        )
      : subjectProductId
        ? ruleMatches.find(
            (candidate) =>
              candidate.productAId === subjectProductId ||
              candidate.productBId === subjectProductId,
          )
        : ruleMatches.length === 1
          ? ruleMatches[0]
          : undefined;
  const conflictRuleId = conflict?.rule.id;

  const dismiss = () => backOrReplace(router, APP_SHELF_ROUTE);
  const isSafety = conflict?.rule.interactionType === 'safety';

  // The safety class renders on a calm night sheet (design frame 06); everything
  // else on the light sheet (frames 04/05).
  const backdrop = isSafety ? colors.night : 'rgba(32,27,21,0.45)';
  const sheetBg = isSafety ? colors.nightSurface : colors.paper;
  const grabber = isSafety ? NIGHT_GRABBER : 'rgba(32,27,21,0.15)';
  const access =
    conflict && entitlement.data && seenRuleIds
      ? conflictCheckAccess({
          isPro: entitlement.data.isPro,
          ruleId: conflict.rule.id,
          seenRuleIds,
        })
      : null;

  useEffect(() => {
    let alive = true;
    void loadFreeConflictCheckRuleIds().then((ids) => {
      if (!alive) return;
      setSeenRuleIds(ids);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!conflictRuleId || !access?.shouldRecord) return;

    let alive = true;
    const current = seenRuleIds ?? [];
    const optimistic = current.includes(conflictRuleId) ? current : [...current, conflictRuleId];
    queueMicrotask(() => {
      if (alive) setSeenRuleIds(optimistic);
    });

    void recordFreeConflictCheckRuleId(conflictRuleId)
      .then((ids) => {
        if (!alive) return;
        setSeenRuleIds(ids);
      })
      .catch(() => {
        if (!alive) return;
        setSeenRuleIds(optimistic);
      });

    return () => {
      alive = false;
    };
  }, [access?.shouldRecord, conflictRuleId, seenRuleIds]);

  if (conflict && (entitlement.isLoading || !entitlement.data || !seenRuleIds)) {
    return <View className="flex-1" style={{ backgroundColor: backdrop }} />;
  }

  if (access && !access.allowed) {
    return (
      <ProGate feature="conflict_checks">
        <ConflictFrame
          backdrop={backdrop}
          sheetBg={sheetBg}
          grabber={grabber}
          conflict={conflict}
          onDismiss={dismiss}
        />
      </ProGate>
    );
  }

  return (
    <ConflictFrame
      backdrop={backdrop}
      sheetBg={sheetBg}
      grabber={grabber}
      conflict={conflict}
      onDismiss={dismiss}
    />
  );
}

function ConflictFrame({
  backdrop,
  sheetBg,
  grabber,
  conflict,
  onDismiss,
}: {
  backdrop: string;
  sheetBg: string;
  grabber: string;
  conflict: DetectedConflict | undefined;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<View>(null);
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetMaxHeight = viewportHeight > 44 ? viewportHeight - 44 : 524;
  const productPairLabel = conflict ? conflictProductPairLabel(conflict) : null;
  const dialogLabel = conflict
    ? [familyTitle(conflict), productPairLabel].filter(Boolean).join('. ')
    : 'Timing note unavailable';
  const compactMissingConflict = !conflict && viewportHeight < 520;
  const contentPaddingBottom = insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;
  const missingConflictAdvice = compactMissingConflict
    ? 'Old links never reuse stale routine advice.'
    : 'We only show conflict guidance for products currently on your shelf, so old links never reuse stale routine advice.';
  const missingConflictActions = (
    <View className="mt-1 gap-2">
      <Button label="Back to Shelf" onPress={() => router.replace(APP_SHELF_ROUTE)} />
      <Pressable
        accessibilityRole="button"
        className="min-h-[48px] items-center justify-center py-2"
        onPress={() => router.replace('/shelf/manual')}
      >
        <Text variant="body" tone="muted" className="font-sans-semibold">
          Add a product
        </Text>
      </Pressable>
    </View>
  );
  const missingConflictAdviceCard = (
    <View
      className="rounded-[16px]"
      style={{
        backgroundColor: colors.greigeChip,
        paddingHorizontal: compactMissingConflict ? 14 : 18,
        paddingVertical: compactMissingConflict ? 10 : 12,
      }}
    >
      <Text
        className={
          compactMissingConflict ? 'text-[12px] leading-[17px]' : 'text-[12.5px] leading-[18px]'
        }
        style={{ color: colors.mutedStrong }}
      >
        {missingConflictAdvice}
      </Text>
    </View>
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (Platform.OS === 'web') {
        document.getElementById('conflict-choice-dialog')?.focus();
        return;
      }
      const handle = findNodeHandle(dialogRef.current);
      if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
    }, 100);

    const dialog = Platform.OS === 'web' ? document.getElementById('conflict-choice-dialog') : null;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (active === dialog || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener('keydown', trapFocus);
    return () => {
      clearTimeout(timeout);
      dialog?.removeEventListener('keydown', trapFocus);
    };
  }, [dialogLabel, onDismiss]);

  return (
    <View className="flex-1 justify-end" style={{ backgroundColor: backdrop }}>
      <Pressable
        aria-hidden
        className="absolute inset-0"
        accessible={false}
        accessibilityElementsHidden
        focusable={false}
        importantForAccessibility="no"
        tabIndex={-1}
        onPress={onDismiss}
      />
      <View
        ref={dialogRef}
        aria-modal
        role="dialog"
        nativeID="conflict-choice-dialog"
        tabIndex={-1}
        accessibilityLabel={dialogLabel}
        accessibilityViewIsModal
        onAccessibilityEscape={onDismiss}
        className="rounded-t-sheet px-7 pt-4"
        style={{ backgroundColor: sheetBg, maxHeight: sheetMaxHeight }}
      >
        <View
          className="mb-5 h-[5px] w-10 self-center rounded-[3px]"
          style={{ backgroundColor: grabber }}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
          contentContainerStyle={
            contentPaddingBottom === undefined ? undefined : { paddingBottom: contentPaddingBottom }
          }
          keyboardShouldPersistTaps="handled"
        >
          {!conflict ? (
            <View className="gap-3">
              <View>
                <Chip label="Shelf updated" bg={colors.greige} fg={colors.mutedStrong} />
                <Text
                  variant="title"
                  className="mt-3 text-[27px] leading-[31px]"
                  accessibilityRole="header"
                >
                  This timing note is no longer active.
                </Text>
                <Text
                  variant="body"
                  tone="muted"
                  className="mt-2.5 text-[14px] leading-[22px]"
                  style={{ color: colors.inkSoft }}
                >
                  Your shelf or safety setting has changed since this note was created. Review your
                  current shelf to see what applies now.
                </Text>
              </View>

              {compactMissingConflict ? missingConflictActions : missingConflictAdviceCard}
              {compactMissingConflict ? missingConflictAdviceCard : missingConflictActions}
            </View>
          ) : (
            <ConflictBody conflict={conflict} onDismiss={onDismiss} />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ConflictBody({
  conflict,
  onDismiss,
}: {
  conflict: DetectedConflict;
  onDismiss: () => void;
}) {
  const qc = useQueryClient();
  const r = conflict.rule;
  const isReassure = r.interactionType === 'myth' || r.interactionType === 'synergy';
  const isSafety = r.interactionType === 'safety';
  if (isReassure) return <ReassureBody conflict={conflict} onDismiss={onDismiss} />;
  if (isSafety) return <SafetyBody conflict={conflict} />;
  return <StandardBody conflict={conflict} qc={qc} onDismiss={onDismiss} />;
}

// ---- Standard conflict (frame 04) ----------------------------------------------
function StandardBody({
  conflict,
  qc,
  onDismiss,
}: {
  conflict: DetectedConflict;
  qc: ReturnType<typeof useQueryClient>;
  onDismiss: () => void;
}) {
  const saveInFlight = useRef(false);
  const [savingChoice, setSavingChoice] = useState<'keep' | 'use_together' | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const r = conflict.rule;
  const productPairLabel = conflictProductPairLabel(conflict);
  const suggestion = conflictSuggestion(conflict);
  const keepLabel = r.copy.primaryActionLabel;

  async function choose(choice: 'keep' | 'use_together') {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSavingChoice(choice);
    setSaveFailed(false);
    try {
      const conflictChoices = await recordChoice(conflict, choice);
      qc.setQueryData<ShelfData>(['shelf'], (current) =>
        current ? applyConflictChoicesToShelfData(current, conflictChoices) : current,
      );
      onDismiss();
    } catch {
      setSaveFailed(true);
    } finally {
      saveInFlight.current = false;
      setSavingChoice(null);
    }
  }

  return (
    <>
      <View className="mb-4 flex-row flex-wrap gap-2">
        <Chip
          label={severityLabel(conflict)}
          dot={SEV_DOT[conflict.computedSeverity]}
          bg={colors.clayTint}
          fg={colors.clayDeep}
        />
        <Chip label={evidenceChip(conflict)} bg={colors.clayTint} fg={colors.clayDeep} />
        <Chip label={interactionClassLabel(conflict)} bg={colors.greige} fg={colors.mutedStrong} />
      </View>

      <Text variant="title" className="text-[33px] leading-[37px]" accessibilityRole="header">
        {familyTitle(conflict)}
      </Text>

      {productPairLabel ? (
        <View className="mt-3 rounded-[8px] bg-greige px-3.5 py-3">
          <Text variant="label" tone="muted" className="font-mono uppercase">
            Your products
          </Text>
          <Text variant="bodySm" className="mt-1 font-sans-semibold leading-5">
            {productPairLabel}
          </Text>
        </View>
      ) : null}

      <Text
        variant="body"
        tone="muted"
        className="mt-3.5 text-[14.5px] leading-6"
        style={{ color: colors.inkSoft }}
      >
        {r.copy.mechanism}
      </Text>

      <Card className="mt-5">
        <Text variant="label" className="font-mono uppercase" style={{ color: colors.clay }}>
          {r.copy.interactionLabel}
        </Text>
        <Text variant="body" className="mt-2 font-sans-medium text-[15px] leading-[22px]">
          {suggestion}
        </Text>
      </Card>

      {/* Framed source-disclosure card (design frame 04). */}
      <View
        className="mt-3.5 rounded-[16px]"
        style={{ backgroundColor: colors.greigeChip, paddingHorizontal: 18, paddingVertical: 14 }}
      >
        <View
          className="pb-[7px]"
          style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(32,27,21,0.07)' }}
        >
          <Text className="text-[13px]" style={{ color: colors.muted }}>
            {r.copy.sourceLimitationTitle}
          </Text>
        </View>
        <Text className="pt-2 text-[12.5px] leading-[19px]" style={{ color: colors.mutedStrong }}>
          {r.copy.sourceLimitationBody}
        </Text>
      </View>

      <View className="mt-[18px] gap-2">
        <Button
          disabled={savingChoice != null}
          label={savingChoice === 'keep' ? 'Saving choice' : keepLabel}
          onPress={() => void choose('keep')}
        />
        {r.copy.overrideActionLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: savingChoice != null }}
            className="min-h-[48px] items-center justify-center py-2"
            disabled={savingChoice != null}
            onPress={() => void choose('use_together')}
            style={{ opacity: savingChoice != null ? 0.5 : 1 }}
          >
            <Text variant="body" tone="muted" className="font-sans-semibold">
              {savingChoice === 'use_together'
                ? r.copy.primaryActionLabel
                : r.copy.overrideActionLabel}
            </Text>
          </Pressable>
        ) : null}
        {saveFailed ? (
          <View accessibilityRole="alert" className="rounded-[8px] bg-clay-tint px-4 py-3">
            <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.ink }}>
              Choice not saved
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1 text-[12.5px]">
              Your previous schedule is unchanged. Try again.
            </Text>
          </View>
        ) : null}
        <View className="mt-1 flex-row items-center justify-center gap-2">
          <View className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.mutedFaint }} />
          <Text className="font-mono text-[10.5px]" style={{ color: colors.mutedLight }}>
            saves your choice · no repeat prompts
          </Text>
        </View>
      </View>

      {/* Standing not-medical-advice disclaimer (docs/02 §9). */}
      <Text variant="bodySm" tone="muted" className="mt-5 text-center text-[11px]">
        {NOT_MEDICAL_ADVICE_SHORT}
      </Text>
    </>
  );
}

// ---- Myth / reassurance (frame 05) ---------------------------------------------
function ReassureBody({
  conflict,
  onDismiss,
}: {
  conflict: DetectedConflict;
  onDismiss: () => void;
}) {
  const r = conflict.rule;

  return (
    <>
      <View
        className="mb-[18px] items-center justify-center rounded-full"
        style={{ width: 52, height: 52, backgroundColor: colors.sageTint }}
      >
        <CheckGlyph color={colors.sage} size={22} />
      </View>

      <View className="mb-3.5 flex-row flex-wrap gap-2">
        <Chip label={r.copy.interactionLabel} bg={colors.sageTint} fg={colors.sage} />
        <Chip label={evidenceChip(conflict)} bg={colors.sageTint} fg={colors.sage} />
      </View>

      <Text variant="title" className="text-[33px] leading-[37px]" accessibilityRole="header">
        {r.copy.detailTitle}
      </Text>

      <Text
        variant="body"
        tone="muted"
        className="mt-3.5 text-[14.5px] leading-6"
        style={{ color: colors.inkSoft }}
      >
        {r.copy.mechanism}
      </Text>

      <Card className="mt-5">
        <Text variant="label" className="font-mono uppercase" style={{ color: colors.sage }}>
          {r.copy.interactionLabel}
        </Text>
        <Text variant="body" className="mt-2 font-sans-medium text-[15px] leading-[22px]">
          {r.copy.resolution}
        </Text>
      </Card>

      {/* Misinformation footnote (design frame 05). */}
      <View
        className="mt-3.5 rounded-[16px]"
        style={{ backgroundColor: colors.greigeChip, paddingHorizontal: 18, paddingVertical: 14 }}
      >
        <Text className="text-[12.5px] leading-[19px]" style={{ color: colors.mutedStrong }}>
          {r.copy.sourceLimitationBody}
        </Text>
      </View>

      <View className="mt-6">
        <Button label={r.copy.primaryActionLabel} onPress={onDismiss} />
      </View>
    </>
  );
}

// ---- Safety class (frame 06, night sheet) --------------------------------------
function SafetyBody({ conflict }: { conflict: DetectedConflict }) {
  const r = conflict.rule;
  const subjectProductLabel = conflictProductPairLabel(conflict);

  return (
    <>
      <View
        className="mb-[18px] items-center justify-center rounded-full"
        style={{ width: 52, height: 52, backgroundColor: SAFETY_ICON_BG }}
      >
        <View
          className="rounded-full"
          style={{ width: 16, height: 16, borderWidth: 2.5, borderColor: colors.clayBright }}
        />
      </View>

      <View className="mb-3.5 flex-row flex-wrap gap-2">
        <Chip label={r.copy.interactionLabel} bg={SAFETY_ICON_BG} fg={colors.clayBright} />
      </View>

      <Text
        variant="title"
        tone="inverse"
        className="text-[32px] leading-[37px]"
        accessibilityRole="header"
      >
        {r.copy.detailTitle}
      </Text>

      {subjectProductLabel ? (
        <View
          className="mt-3 rounded-[8px] px-3.5 py-3"
          style={{ backgroundColor: SAFETY_ICON_BG }}
        >
          <Text className="font-mono text-[10.5px] uppercase" style={{ color: NIGHT_FAINT }}>
            Shelf product
          </Text>
          <Text className="mt-1 font-sans-semibold text-[13.5px]" style={{ color: colors.cream }}>
            {subjectProductLabel}
          </Text>
        </View>
      ) : null}

      <Text className="mt-3.5 text-[14.5px] leading-6" style={{ color: NIGHT_BODY }}>
        {r.copy.mechanism} {r.copy.resolution}
      </Text>

      <View className="mt-6 gap-2">
        <Button
          label={r.copy.primaryActionLabel}
          variant="inverse"
          onPress={() => router.push('/settings/skin-profile?returnTo=shelf')}
        />
      </View>

      <Text className="mt-5 text-center text-[11px] leading-4" style={{ color: NIGHT_FAINT }}>
        {NOT_MEDICAL_ADVICE_SHORT}
      </Text>
    </>
  );
}
