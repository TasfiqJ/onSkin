import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { InContextNote } from '@/features/community/InContextNote';
import { noteForTags } from '@/features/community/notes';
import type { DetectedConflict } from '@/features/intelligence/engine';
import { evidenceChip, pairTitle, severityLabel } from '@/features/intelligence/presentation';
import { useShelf } from '@/features/shelf/useShelf';
import { NOT_MEDICAL_ADVICE_SHORT } from '@/lib/legal/disclaimer';
import { supabase } from '@/lib/supabase/client';
import { colors } from '@/theme/tokens';

// Conflict override sheet (design 08, docs/02 §7.3 / docs/03 §7). The trust
// set-piece, as a bottom sheet. Adapts by interaction type: standard conflicts get
// Keep / Use-together (override sticks, no re-nagging); myth/synergy reassure;
// safety defers to a clinician. The user is never blocked.
const SEV_DOT: Record<string, string> = {
  none: colors.severityNone,
  mild: colors.severityMild,
  moderate: colors.severityModerate,
  high: colors.severityHigh,
};

function Chip({ label, dot, bg, fg }: { label: string; dot?: string; bg: string; fg: string }) {
  return (
    <View className="flex-row items-center gap-2 self-start rounded-pill px-3.5 py-1.5" style={{ backgroundColor: bg }}>
      {dot ? <View className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} /> : null}
      <Text className="font-sans-bold text-[12px]" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

async function recordChoice(c: DetectedConflict, choice: 'keep' | 'use_together') {
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
  const conflict = data?.conflicts.find((c) => c.rule.id === ruleId);

  const dismiss = () => router.back();

  return (
    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(32,27,21,0.45)' }}>
      <Pressable className="absolute inset-0" accessibilityRole="button" accessibilityLabel="Dismiss" onPress={dismiss} />
      <View className="rounded-t-sheet bg-paper px-7 pb-10 pt-4">
        <View className="mb-5 h-[5px] w-10 self-center rounded-[3px]" style={{ backgroundColor: 'rgba(32,27,21,0.15)' }} />

        {!conflict ? (
          <>
            <Text variant="body" tone="muted" className="py-6 text-center">
              This conflict is no longer on your shelf.
            </Text>
            <Button label="Close" variant="ghost" onPress={dismiss} />
          </>
        ) : (
          <ConflictBody conflict={conflict} onDismiss={dismiss} />
        )}
      </View>
    </View>
  );
}

function ConflictBody({ conflict, onDismiss }: { conflict: DetectedConflict; onDismiss: () => void }) {
  const r = conflict.rule;
  const isReassure = r.interactionType === 'myth' || r.interactionType === 'synergy';
  const isSafety = r.interactionType === 'safety';
  // The community trust layer (docs/11 §9.2) reinforces a reassurance with the matching
  // "myth vs evidence" Skin Note. Exactly where the doubt lands (e.g. niacinamide × vit C).
  const skinNoteId = noteForTags(r.tagA, r.tagB);
  const honest = r.evidenceGrade == null || r.evidenceLabel === 'contested' || r.evidenceLabel === 'plausible';
  const eyebrowColor = isReassure ? colors.sage : isSafety ? colors.clayDeep : colors.clay;

  return (
    <>
      <View className="mb-4 flex-row gap-2">
        {!isReassure ? (
          <Chip label={severityLabel(conflict.computedSeverity)} dot={SEV_DOT[conflict.computedSeverity]} bg={colors.clayTint} fg={colors.clayDeep} />
        ) : null}
        <Chip
          label={evidenceChip(r.evidenceLabel)}
          bg={isReassure ? colors.sageTint : colors.clayTint}
          fg={isReassure ? colors.sage : colors.clayDeep}
        />
      </View>

      <Text variant="title" className="text-[33px]" accessibilityRole="header">
        {pairTitle(conflict)}
      </Text>

      <Text variant="body" tone="muted" className="mt-3.5 text-[14.5px]">
        {r.mechanism}
        {!isReassure && !isSafety ? ' This is a recommendation, not a rule. And whatever you choose, we won’t keep asking.' : ''}
      </Text>

      <Card className="mt-5">
        <Text variant="label" className="font-mono" style={{ color: eyebrowColor }}>
          {isSafety ? 'WHAT WE DID' : isReassure ? 'GOOD NEWS' : 'OUR SUGGESTION'}
        </Text>
        <Text variant="body" className="mt-2 font-sans-medium">
          {r.resolutionCopy}
        </Text>
      </Card>

      {!isReassure ? (
        <Text variant="bodySm" tone="muted" className="mt-4 text-[12px]">
          {r.sourceCitation}
          {honest ? ' · based largely on lab and mechanistic evidence; high-quality human-outcome studies are limited.' : ''}
        </Text>
      ) : null}

      {skinNoteId ? (
        <View className="mt-4">
          <InContextNote noteId={skinNoteId} />
        </View>
      ) : null}

      <View className="mt-6 gap-2">
        {isReassure ? (
          <Button label="Got it" onPress={onDismiss} />
        ) : isSafety ? (
          <>
            <Button label="Suggest a gentler routine" onPress={onDismiss} />
            <Pressable accessibilityRole="button" className="items-center py-3" onPress={onDismiss}>
              <Text variant="body" tone="muted" className="font-sans-semibold">
                Keep it on my shelf
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Button
              label="Keep this suggestion"
              onPress={async () => {
                await recordChoice(conflict, 'keep');
                onDismiss();
              }}
            />
            <Pressable
              accessibilityRole="button"
              className="items-center py-2"
              onPress={async () => {
                await recordChoice(conflict, 'use_together');
                onDismiss();
              }}>
              <Text variant="body" tone="muted" className="font-sans-semibold">
                Use together anyway
              </Text>
            </Pressable>
            <View className="mt-1 flex-row items-center justify-center gap-2">
              <View className="h-1 w-1 rounded-full" style={{ backgroundColor: '#C0B7A6' }} />
              <Text className="font-mono text-[10.5px]" style={{ color: colors.mutedLight }}>
                your choice is saved · we won&apos;t re-nag
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Standing not-medical-advice disclaimer (docs/02 §9): in-app copy is a
          claims surface; show it contextually on the conflict-detail and safety screens. */}
      <Text variant="bodySm" tone="muted" className="mt-5 text-center text-[11px]">
        {NOT_MEDICAL_ADVICE_SHORT}
      </Text>
    </>
  );
}
