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
import { InContextNote } from '@/features/community/InContextNote';
import { noteForTags } from '@/features/community/notes';
import type { DetectedConflict } from '@/features/intelligence/engine';
import type { ConflictChoices, ConflictUserChoice } from '@/features/intelligence/conflictChoices';
import { mirrorConflictChoiceForOwner } from '@/features/intelligence/conflictChoiceMirror';
import { conflictShareRoute } from '@/features/intelligence/conflictIdentity';
import { setConflictChoice } from '@/features/intelligence/overrides';
import {
  evidenceChip,
  familyTitle,
  interactionClassLabel,
  severityLabel,
  tagLabel,
} from '@/features/intelligence/presentation';
import {
  applyConflictChoicesToShelfData,
  useShelf,
  type ShelfData,
} from '@/features/shelf/useShelf';
import { failClosedShelfQueriesAfterMutationFailure } from '@/features/shelf/mutationFailure';
import {
  conflictCheckAccess,
  loadFreeConflictCheckRuleIds,
  recordFreeConflictCheckRuleId,
  type ConflictQuotaRead,
} from '@/features/subscription/conflictQuota';
import { isEntitlementEvidenceUncertain } from '@/features/subscription/entitlement';
import { ProGate } from '@/features/subscription/ProGate';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { canShareConflictCard } from '@/lib/launch/phase7';
import { NOT_MEDICAL_ADVICE_SHORT } from '@/lib/legal/disclaimer';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import {
  isOwnerQueryScopeCurrent,
  queryKeys,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import { readLocalDateBoundarySnapshot } from '@/lib/query/queryDateBoundaryCore';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

// Conflict override sheet (design frames 04/05/06, docs/02 §7.3 / docs/03 §7). The
// trust set-piece, as a bottom sheet. Adapts by interaction type: standard
// conflicts get severity/evidence/class + Keep / Use-together (override sticks,
// no re-nagging); myth/synergy reassure on a sage success sheet; safety defers to
// a clinician on a calm night sheet. The user is never blocked.
//
// Display copy here is a presentation override of the canonical rule data (which
// stays byte-synced with the seed migration and is scanned by claimsafety tests).
// It restates the same claim-safe meaning in the design's exact words.
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

/** Faithful per-rule display copy, restating the canonical (claim-safe) rule meaning
 *  in the design's exact words. Keyed by rule id; falls back to the rule's own copy. */
type CopyOverride = {
  mechanism?: string;
  suggestion?: string;
  suggestionAccent?: string;
  source?: string;
};
const COPY: Record<string, CopyOverride> = {
  // Retinol × glycolic acid (frame 04).
  '00000000-0000-4000-8000-000000000001': {
    mechanism:
      'Used the same evening, these can compound irritation, especially on sensitive skin like yours. The popular "they cancel each other out" idea isn’t supported, so this is about comfort, not effectiveness.',
    suggestion: 'Alternate nights. Keep retinol and glycolic on different evenings.',
    source:
      'Based largely on lab and mechanistic evidence; high-quality human-outcome studies are limited. Source: dermatology literature review, 2025.',
  },
  // Niacinamide + vitamin C (frame 05, myth).
  '00000000-0000-4000-8000-000000000004': {
    mechanism:
      'You may have read these "cancel out" or cause flushing. That fear traces to a 1960s study that used niacin, a different ingredient, under heat. Modern niacinamide is stable, and the two are routinely formulated together.',
    suggestion:
      'Nothing to change. These are fine in the same routine, and they can complement each other.',
  },
};

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
  ownerScope: OwnerQueryScope,
  c: DetectedConflict,
  choice: 'keep' | 'use_together',
): Promise<ConflictChoices> {
  // Local-first so the choice sticks offline and the app stops re-nagging
  // immediately (docs/03 §7); the server mirror below is best-effort.
  return runOwnerQueryOperation(ownerScope, async (lease) => {
    const userChoice = persistedChoice(choice);
    const conflictChoices = await setConflictChoice(c, userChoice);
    lease.assertCurrent();
    track('conflict_resolution_chosen', {
      action: choice === 'use_together' ? 'use_together' : 'keep',
      source: 'detail',
    });
    if (choice === 'use_together') track('conflict_overridden', { source: 'detail' });
    void mirrorConflictChoiceForOwner(ownerScope, c, userChoice);
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

function conflictSuggestion(conflict: DetectedConflict, copy: CopyOverride): string {
  if (
    conflict.rule.resolutionType === 'alternate_nights' &&
    conflict.productAName &&
    conflict.productBName
  ) {
    return `Alternate nights. Keep ${conflict.productAName} and ${conflict.productBName} on different evenings.`;
  }
  return copy.suggestion ?? conflict.rule.resolutionCopy;
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
  const [conflictQuota, setConflictQuota] = useState<ConflictQuotaRead | null>(null);
  const ruleMatches = data?.conflicts.filter((candidate) => candidate.rule.id === ruleId) ?? [];
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
  const quotaAvailable =
    conflictQuota?.status === 'missing' || conflictQuota?.status === 'available';
  const quotaRuleIds = conflictQuota?.ruleIds ?? [];
  const entitlementUncertain =
    (!entitlement.data && entitlement.isError) ||
    isEntitlementEvidenceUncertain(entitlement.data);
  const access =
    conflict &&
    entitlement.data &&
    !entitlementUncertain &&
    (entitlement.data.isPro || conflictQuota)
      ? conflictCheckAccess({
          isPro: entitlement.data.isPro,
          ruleId: conflict.rule.id,
          seenRuleIds: quotaRuleIds,
          quotaAvailable,
        })
      : null;

  useEffect(() => {
    let alive = true;
    void loadFreeConflictCheckRuleIds()
      .then((result) => {
        if (!alive) return;
        setConflictQuota(result);
      })
      .catch(() => {
        if (!alive) return;
        setConflictQuota({ status: 'unavailable', ruleIds: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!conflictRuleId || !access?.shouldRecord) return;

    let alive = true;
    void recordFreeConflictCheckRuleId(conflictRuleId)
      .then((result) => {
        if (!alive) return;
        setConflictQuota(result);
      })
      .catch(() => {
        if (!alive) return;
        setConflictQuota({ status: 'unavailable', ruleIds: null });
      });

    return () => {
      alive = false;
    };
  }, [access?.shouldRecord, conflictRuleId]);

  const quotaClaimPending = !entitlement.data?.isPro && access?.shouldRecord === true;
  if (conflict && entitlementUncertain) {
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
  if (
    conflict &&
    (entitlement.isLoading ||
      !entitlement.data ||
      (!entitlement.data.isPro && !conflictQuota) ||
      quotaClaimPending)
  ) {
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
  const copy = COPY[r.id] ?? {};
  // The community trust layer (docs/11 §9.2) reinforces a reassurance with the matching
  // "myth vs evidence" Skin Note. Exactly where the doubt lands (e.g. niacinamide × vit C).
  const skinNoteId = noteForTags(r.tagA, r.tagB) ?? null;

  if (isReassure)
    return (
      <ReassureBody conflict={conflict} copy={copy} skinNoteId={skinNoteId} onDismiss={onDismiss} />
    );
  if (isSafety) return <SafetyBody conflict={conflict} onDismiss={onDismiss} />;
  return (
    <StandardBody
      conflict={conflict}
      copy={copy}
      skinNoteId={skinNoteId}
      qc={qc}
      onDismiss={onDismiss}
    />
  );
}

// ---- Standard conflict (frame 04) ----------------------------------------------
function StandardBody({
  conflict,
  copy,
  skinNoteId,
  qc,
  onDismiss,
}: {
  conflict: DetectedConflict;
  copy: CopyOverride;
  skinNoteId: string | null;
  qc: ReturnType<typeof useQueryClient>;
  onDismiss: () => void;
}) {
  const ownerScope = useOwnerQueryScope();
  const saveInFlight = useRef(false);
  const saveRequestId = useRef(0);
  const [savingChoice, setSavingChoice] = useState<'keep' | 'use_together' | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const r = conflict.rule;
  const productPairLabel = conflictProductPairLabel(conflict);
  const honest =
    r.evidenceGrade == null || r.evidenceLabel === 'contested' || r.evidenceLabel === 'plausible';
  const sourceBody =
    copy.source ??
    `${r.sourceCitation}${honest ? '. Based largely on lab and mechanistic evidence; high-quality human-outcome studies are limited.' : '.'}`;
  const suggestion = conflictSuggestion(conflict, copy);
  const keepLabel =
    r.resolutionType === 'alternate_nights' ? 'Keep alternate nights' : 'Keep suggested timing';

  useEffect(
    () => () => {
      saveRequestId.current += 1;
    },
    [],
  );

  async function choose(choice: 'keep' | 'use_together') {
    if (saveInFlight.current) return;
    const requestId = saveRequestId.current + 1;
    saveRequestId.current = requestId;
    saveInFlight.current = true;
    setSavingChoice(choice);
    setSaveFailed(false);
    try {
      const conflictChoices = await recordChoice(ownerScope, conflict, choice);
      if (saveRequestId.current !== requestId || !isOwnerQueryScopeCurrent(ownerScope)) {
        return;
      }
      const boundary = readLocalDateBoundarySnapshot();
      const shelfQueryKey = queryKeys.shelf(ownerScope, boundary);
      qc.setQueryData<ShelfData>(shelfQueryKey, (current) =>
        current
          ? applyConflictChoicesToShelfData(current, conflictChoices, boundary.localDate)
          : current,
      );
      if (saveRequestId.current !== requestId || !isOwnerQueryScopeCurrent(ownerScope)) return;
      onDismiss();
    } catch {
      try {
        await failClosedShelfQueriesAfterMutationFailure(qc, ownerScope);
      } catch {
        // Recovery failure must not suppress honest mutation feedback.
      }
      if (saveRequestId.current === requestId && isOwnerQueryScopeCurrent(ownerScope)) {
        setSaveFailed(true);
      }
    } finally {
      if (saveRequestId.current === requestId && isOwnerQueryScopeCurrent(ownerScope)) {
        saveInFlight.current = false;
        setSavingChoice(null);
      }
    }
  }

  return (
    <>
      <View className="mb-4 flex-row flex-wrap gap-2">
        <Chip
          label={severityLabel(conflict.computedSeverity)}
          dot={SEV_DOT[conflict.computedSeverity]}
          bg={colors.clayTint}
          fg={colors.clayDeep}
        />
        <Chip label={evidenceChip(r.evidenceLabel)} bg={colors.clayTint} fg={colors.clayDeep} />
        <Chip
          label={interactionClassLabel(r.interactionType)}
          bg={colors.greige}
          fg={colors.mutedStrong}
        />
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
        {copy.mechanism ?? r.mechanism}
      </Text>

      <Card className="mt-5">
        <Text variant="label" className="font-mono uppercase" style={{ color: colors.clay }}>
          Our suggestion
        </Text>
        <Text variant="body" className="mt-2 font-sans-medium text-[15px] leading-[22px]">
          {suggestion}
          {copy.suggestionAccent ? (
            <Text className="font-sans-medium text-[15px]" style={{ color: colors.sageEyebrow }}>
              {copy.suggestionAccent}
            </Text>
          ) : null}
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
            Why it&apos;s only &quot;{r.evidenceLabel}&quot;
          </Text>
        </View>
        <Text className="pt-2 text-[12.5px] leading-[19px]" style={{ color: colors.mutedStrong }}>
          {sourceBody}
        </Text>
      </View>

      {skinNoteId ? (
        <View className="mt-4">
          <InContextNote noteId={skinNoteId} />
        </View>
      ) : null}

      <View className="mt-[18px] gap-2">
        <Button
          disabled={savingChoice != null}
          label={savingChoice === 'keep' ? 'Saving choice' : keepLabel}
          onPress={() => void choose('keep')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: savingChoice != null }}
          className="min-h-[48px] items-center justify-center py-2"
          disabled={savingChoice != null}
          onPress={() => void choose('use_together')}
          style={{ opacity: savingChoice != null ? 0.5 : 1 }}
        >
          <Text variant="body" tone="muted" className="font-sans-semibold">
            {savingChoice === 'use_together' ? 'Saving choice' : 'Use together anyway'}
          </Text>
        </Pressable>
        {saveFailed ? (
          <View accessibilityRole="alert" className="rounded-[8px] bg-clay-tint px-4 py-3">
            <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.ink }}>
              Choice not confirmed
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1 text-[12.5px]">
              OnSkin couldn&apos;t confirm whether this choice was saved. It did not reset or remove
              your private Shelf data. Try again.
            </Text>
          </View>
        ) : null}
        <Text className="text-center text-[11.5px] leading-[17px]" style={{ color: colors.muted }}>
          Your guided checklist keeps one potent active per night until co-use timing has named
          clinical and cosmetic-chemistry review.
        </Text>
        <View className="mt-1 flex-row items-center justify-center gap-2">
          <View className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.mutedFaint }} />
          <Text className="font-mono text-[10.5px]" style={{ color: colors.mutedLight }}>
            saves your choice · no repeat prompts
          </Text>
        </View>
      </View>

      {/* Shareable Shelf Conflict Card (docs/14 §3, the word-of-mouth growth artifact). */}
      {canShareConflictCard(conflict) ? (
        <Pressable
          accessibilityRole="button"
          className="mt-4 min-h-[48px] items-center justify-center"
          onPress={() => router.push(conflictShareRoute(conflict))}
        >
          <Text variant="bodySm" tone="muted" className="font-sans-semibold">
            Share this card
          </Text>
        </Pressable>
      ) : null}

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
  copy,
  skinNoteId,
  onDismiss,
}: {
  conflict: DetectedConflict;
  copy: CopyOverride;
  skinNoteId: string | null;
  onDismiss: () => void;
}) {
  const r = conflict.rule;
  const a = tagLabel(r.tagA);
  const b = tagLabel(r.tagB).toLowerCase();

  return (
    <>
      <View
        className="mb-[18px] items-center justify-center rounded-full"
        style={{ width: 52, height: 52, backgroundColor: colors.sageTint }}
      >
        <CheckGlyph color={colors.sage} size={22} />
      </View>

      <View className="mb-3.5 flex-row flex-wrap gap-2">
        <Chip label="Refuted myth" bg={colors.sageTint} fg={colors.sage} />
        <Chip label="Safe to combine" bg={colors.sageTint} fg={colors.sage} />
      </View>

      <Text variant="title" className="text-[33px] leading-[37px]" accessibilityRole="header">
        {a} + {b}?{' '}
        <Text variant="title" italic className="text-[33px]" style={{ color: colors.sage }}>
          Go ahead.
        </Text>
      </Text>

      <Text
        variant="body"
        tone="muted"
        className="mt-3.5 text-[14.5px] leading-6"
        style={{ color: colors.inkSoft }}
      >
        {copy.mechanism ?? r.mechanism}
      </Text>

      <Card className="mt-5">
        <Text variant="label" className="font-mono uppercase" style={{ color: colors.sage }}>
          What we did
        </Text>
        <Text variant="body" className="mt-2 font-sans-medium text-[15px] leading-[22px]">
          {copy.suggestion ?? r.resolutionCopy}
        </Text>
      </Card>

      {/* Misinformation footnote (design frame 05). */}
      <View
        className="mt-3.5 rounded-[16px]"
        style={{ backgroundColor: colors.greigeChip, paddingHorizontal: 18, paddingVertical: 14 }}
      >
        <Text className="text-[12.5px] leading-[19px]" style={{ color: colors.mutedStrong }}>
          We flag myths as readily as risks. Telling you a safe combination is dangerous would be
          its own kind of misinformation.
        </Text>
      </View>

      {skinNoteId ? (
        <View className="mt-4">
          <InContextNote noteId={skinNoteId} />
        </View>
      ) : null}

      <View className="mt-6">
        <Button label="Got it" onPress={onDismiss} />
      </View>

      {canShareConflictCard(conflict) ? (
        <Pressable
          accessibilityRole="button"
          className="mt-4 min-h-[48px] items-center justify-center"
          onPress={() => router.push(conflictShareRoute(conflict))}
        >
          <Text variant="bodySm" tone="muted" className="font-sans-semibold">
            Share this card
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

// ---- Safety class (frame 06, night sheet) --------------------------------------
function SafetyBody({
  conflict,
  onDismiss,
}: {
  conflict: DetectedConflict;
  onDismiss: () => void;
}) {
  const r = conflict.rule;
  // The non-pregnancy tag names the suppressed active for the family-aware title.
  const activeTag = r.tagA === 'pregnancy' ? r.tagB : r.tagA;
  const activeLabel = tagLabel(activeTag).toLowerCase();
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
        <Chip label="Safety · talk to your doctor" bg={SAFETY_ICON_BG} fg={colors.clayBright} />
      </View>

      <Text
        variant="title"
        tone="inverse"
        className="text-[32px] leading-[37px]"
        accessibilityRole="header"
      >
        Pause your {activeLabel} until you can ask your doctor.
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
        Your pregnancy and breastfeeding setting puts this {activeLabel} on pause. Review the
        setting if your status changed. Otherwise, ask your clinician before adding it to your
        routine.
      </Text>

      <Text className="mt-3.5 text-[12px] leading-[19px]" style={{ color: NIGHT_FAINT }}>
        {BRAND.appName} isn&apos;t medical advice. We err conservative and always defer to your
        clinician.
      </Text>

      <View className="mt-6 gap-2">
        <Button
          label="Review safety setting"
          variant="inverse"
          onPress={() => router.push('/settings/skin-profile?returnTo=shelf')}
        />
        <Pressable
          accessibilityRole="button"
          className="min-h-[48px] items-center justify-center py-3"
          onPress={onDismiss}
        >
          <Text className="font-sans-semibold text-[15px]" style={{ color: NIGHT_FAINT }}>
            Keep it on my shelf
          </Text>
        </Pressable>
      </View>

      <Text className="mt-5 text-center text-[11px] leading-4" style={{ color: NIGHT_FAINT }}>
        {NOT_MEDICAL_ADVICE_SHORT}
      </Text>
    </>
  );
}
