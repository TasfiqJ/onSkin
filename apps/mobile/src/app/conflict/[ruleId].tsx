import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { InContextNote } from '@/features/community/InContextNote';
import { noteForTags } from '@/features/community/notes';
import type { DetectedConflict } from '@/features/intelligence/engine';
import { conflictKey, setConflictOverride } from '@/features/intelligence/overrides';
import {
  evidenceChip,
  familyTitle,
  interactionClassLabel,
  severityLabel,
  tagLabel,
} from '@/features/intelligence/presentation';
import { useShelf } from '@/features/shelf/useShelf';
import {
  conflictCheckAccess,
  loadFreeConflictCheckRuleIds,
  recordFreeConflictCheckRuleId,
} from '@/features/subscription/conflictQuota';
import { ProGate } from '@/features/subscription/ProGate';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { canShareConflictCard } from '@/lib/launch/phase7';
import { NOT_MEDICAL_ADVICE_SHORT } from '@/lib/legal/disclaimer';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { supabase } from '@/lib/supabase/client';
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

async function recordChoice(c: DetectedConflict, choice: 'keep' | 'use_together') {
  // Local-first so the choice sticks offline and the app stops re-nagging
  // immediately (docs/03 §7); the server mirror below is best-effort.
  await setConflictOverride(conflictKey(c), choice === 'use_together');
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.id) return;
    await supabase.from('routine_conflicts').insert({
      user_id: data.user.id,
      rule_id: c.rule.id,
      product_a_id: c.productAId,
      product_b_id: c.productBId,
      computed_severity: c.computedSeverity,
      status: choice === 'use_together' ? 'overridden' : 'accepted',
      user_choice: choice === 'use_together' ? 'use_together' : 'keep_alternate_nights',
      rule_version: c.rule.ruleVersion,
    });
  } catch {
    /* best-effort until backend configured (B-SUPABASE) */
  }
}

export default function ConflictSheet() {
  const { ruleId } = useLocalSearchParams<{ ruleId: string }>();
  const { data } = useShelf();
  const entitlement = useEntitlement();
  const [seenRuleIds, setSeenRuleIds] = useState<string[] | null>(null);
  const conflict = data?.conflicts.find((c) => c.rule.id === ruleId);
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
  const { height } = useWindowDimensions();
  const sheetMaxHeight = Math.max(320, height - 24);

  return (
    <View className="flex-1 justify-end" style={{ backgroundColor: backdrop }}>
      <Pressable
        className="absolute inset-0"
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
      />
      <View
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
          keyboardShouldPersistTaps="handled"
        >
          {!conflict ? (
            <>
              <Text variant="body" tone="muted" className="py-6 text-center">
                This conflict is no longer on your shelf.
              </Text>
              <Button label="Close" variant="ghost" onPress={onDismiss} />
            </>
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
  const r = conflict.rule;
  const honest =
    r.evidenceGrade == null || r.evidenceLabel === 'contested' || r.evidenceLabel === 'plausible';
  const sourceBody =
    copy.source ??
    `${r.sourceCitation}${honest ? '. Based largely on lab and mechanistic evidence; high-quality human-outcome studies are limited.' : '.'}`;
  const suggestion = copy.suggestion ?? r.resolutionCopy;

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

      <View className="mt-6 gap-2">
        <Button
          label="Keep alternate nights"
          onPress={async () => {
            await recordChoice(conflict, 'keep');
            await qc.invalidateQueries({ queryKey: ['shelf'] });
            onDismiss();
          }}
        />
        <Pressable
          accessibilityRole="button"
          className="min-h-[48px] items-center justify-center py-2"
          onPress={async () => {
            await recordChoice(conflict, 'use_together');
            await qc.invalidateQueries({ queryKey: ['shelf'] });
            onDismiss();
          }}
        >
          <Text variant="body" tone="muted" className="font-sans-semibold">
            Use together anyway
          </Text>
        </Pressable>
        <View className="mt-1 flex-row items-center justify-center gap-2">
          <View className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.mutedFaint }} />
          <Text className="font-mono text-[10.5px]" style={{ color: colors.mutedLight }}>
            your choice is saved · we won&apos;t re-nag
          </Text>
        </View>
      </View>

      {/* Shareable Shelf Conflict Card (docs/14 §3, the word-of-mouth growth artifact). */}
      {canShareConflictCard(conflict) ? (
        <Pressable
          accessibilityRole="button"
          className="mt-4 min-h-[48px] items-center justify-center"
          onPress={() => router.push(`/share/conflict/${r.id}`)}
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
          onPress={() => router.push(`/share/conflict/${r.id}`)}
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

      <Text className="mt-3.5 text-[14.5px] leading-6" style={{ color: NIGHT_BODY }}>
        You told us you&apos;re pregnant. Many dermatologists suggest pausing retinoids while
        pregnant or breastfeeding, out of caution, not because harm is proven. This is a
        conversation for you and your doctor.
      </Text>

      {/* "A gentler swap" card on the deeper night surface (design frame 06). */}
      <View
        className="mt-5 rounded-[20px]"
        style={{ backgroundColor: colors.night, paddingHorizontal: 20, paddingVertical: 18 }}
      >
        <Text variant="label" className="font-mono uppercase" style={{ color: colors.clayBright }}>
          A gentler swap
        </Text>
        <Text
          className="mt-2 font-sans-medium text-[15px] leading-[22px]"
          style={{ color: colors.cream }}
        >
          We can rebuild your evenings around bakuchiol, often suggested as a pregnancy-friendly
          alternative.
        </Text>
      </View>

      <Text className="mt-3.5 text-[12px] leading-[19px]" style={{ color: NIGHT_FAINT }}>
        OnSkin isn&apos;t medical advice. We err conservative and always defer to your clinician.
      </Text>

      <View className="mt-6 gap-2">
        <Button label="Suggest a gentler routine" variant="inverse" onPress={onDismiss} />
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
