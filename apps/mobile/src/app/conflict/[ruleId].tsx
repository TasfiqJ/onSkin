import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import type { DetectedConflict } from '@/features/intelligence/engine';
import { evidenceChip, pairTitle, severityLabel } from '@/features/intelligence/presentation';
import { useShelf } from '@/features/intelligence/useShelf';
import { supabase } from '@/lib/supabase/client';

// Conflict detail (design spec p13, docs/02 §7.3) — the trust set-piece. Severity +
// evidence chips (information, not alarm), claim-safe mechanism, the resolution
// ("OUR SUGGESTION"), affected products, source + honesty note, and two actions
// that keep the user in control. Never blocks.
function Chip({ label }: { label: string }) {
  return (
    <View className="self-start rounded-pill border border-hairline bg-paper-raised px-3 py-1">
      <Text variant="label" tone="ink">
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
    // best-effort until backend configured (B-SUPABASE)
  }
}

export default function ConflictDetailScreen() {
  const { ruleId } = useLocalSearchParams<{ ruleId: string }>();
  const { data } = useShelf();
  const conflict = data?.conflicts.find((c) => c.rule.id === ruleId);

  if (!conflict) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text variant="body" tone="muted">
            This conflict is no longer on your shelf.
          </Text>
          <Button className="mt-4" label="Back" variant="ghost" fullWidth={false} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const r = conflict.rule;
  const honest = r.evidenceGrade == null || r.evidenceLabel === 'contested' || r.evidenceLabel === 'plausible';

  return (
    <Screen>
      <View className="flex-1">
        <View className="mt-6 flex-row gap-2">
          <Chip label={severityLabel(conflict.computedSeverity)} />
          <Chip label={evidenceChip(r.evidenceLabel)} />
        </View>

        <Text variant="title" className="mt-5" accessibilityRole="header">
          {pairTitle(conflict)}
        </Text>

        <Text variant="body" tone="muted" className="mt-3">
          {r.mechanism}
        </Text>

        <Card className="mt-6">
          <Text variant="label" tone="clay">
            OUR SUGGESTION
          </Text>
          <Text variant="body" className="mt-2">
            {r.resolutionCopy}
          </Text>
        </Card>

        <View className="mt-6">
          <Text variant="label" tone="muted">
            AFFECTED PRODUCTS
          </Text>
          <Text variant="body" className="mt-1">
            {[conflict.productAName, conflict.productBName].filter(Boolean).join(' · ') || pairTitle(conflict)}
          </Text>
        </View>

        <View className="mt-4">
          <Text variant="label" tone="muted">
            SOURCE
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            {r.sourceCitation}
            {honest ? ' · based largely on lab and mechanistic evidence; high-quality human-outcome studies are limited.' : ''}
          </Text>
        </View>
      </View>

      <View className="gap-3 pb-4">
        {r.resolutionType !== 'reassure' && r.resolutionType !== 'no_change' ? (
          <>
            <Button
              label="Keep this suggestion"
              onPress={async () => {
                await recordChoice(conflict, 'keep');
                router.back();
              }}
            />
            <Button
              label="Use together anyway"
              variant="ghost"
              onPress={async () => {
                await recordChoice(conflict, 'use_together');
                router.back();
              }}
            />
          </>
        ) : (
          <Button label="Got it" onPress={() => router.back()} />
        )}
      </View>
    </Screen>
  );
}
