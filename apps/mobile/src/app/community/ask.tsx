import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { Screen, Text } from '@/components/ui';
import { buildAnonHandle } from '@/features/community/anonHandle';
import { scanClaimSafety } from '@/features/community/claimSafetyScan';
import { confirmCommunityAge, grantCommunityConsent } from '@/features/community/consent';
import { COMMUNITY_COPY } from '@/features/community/copy';
import { useCommunityGate } from '@/features/community/useCommunity';
import { track } from '@/lib/analytics/track';
import { phase7Flags } from '@/lib/launch/phase7';
import { APP_COMMUNITY_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// 04 · The anonymous ask (docs/11 §9.3, design 04). Phase 2. A random handle, the auto
// claim-safety FLAG (a first pass, not the decision), the hard 16+ gate, and the
// separate unbundled community_participation consent. Human pre-moderation is
// authoritative; nothing reaches another user on the classifier alone.
//
// *** PEER POSTING IS DEFERRED (D-067, B-COMMUNITY-MOD / B-COMMUNITY-LEGAL /
// *** B-EXPERT-NETWORK): the composer is built design-faithfully + fully gated, but
// *** submission shows the honest "asking opens soon" state. The expert review desk
// *** must be staffed to the ~24h store-floor SLA before peer questions go live.

function GateRow({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-paper-raised px-3.5 py-3" style={{ borderWidth: 1, borderColor: colors.hairline }}>
      <View className="h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.sageTint }}>
        <Text className="text-[10px]" style={{ color: colors.sage }}>
          ✓
        </Text>
      </View>
      <Text variant="bodySm" className="flex-1 text-[12.5px]" style={{ lineHeight: 17 }}>
        {label}
      </Text>
    </View>
  );
}

function ConsentGate() {
  const qc = useQueryClient();
  // The 16+ gate is a REAL control: the user must affirmatively tick it before the
  // CTA enables (docs/11 §8). Age + consent are recorded together only on that tap.
  const [ageChecked, setAgeChecked] = useState(false);
  const allow = async () => {
    if (!ageChecked) return;
    haptics.success();
    await confirmCommunityAge();
    await grantCommunityConsent();
    await qc.invalidateQueries({ queryKey: ['communityGate'] });
  };
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8 pt-2">
      <Text variant="title" className="text-[28px] leading-[31px]">
        {COMMUNITY_COPY.consent.title}
      </Text>
      <Text variant="body" tone="muted" className="mt-3" style={{ lineHeight: 22 }}>
        {COMMUNITY_COPY.consent.body}
      </Text>
      <View className="mt-5 gap-2">
        <GateRow label={COMMUNITY_COPY.consent.allow} />
        <GateRow label={COMMUNITY_COPY.consent.never} />
        {/* Interactive 16+ affirmation. Must be ticked. Not a decorative checkmark. */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ageChecked }}
          onPress={() => setAgeChecked((v) => !v)}
          className="flex-row items-center gap-3 rounded-xl bg-paper-raised px-3.5 py-3"
          style={{ borderWidth: 1, borderColor: ageChecked ? colors.clay : colors.hairline }}>
          <View
            className="h-[18px] w-[18px] items-center justify-center rounded-[5px]"
            style={{
              backgroundColor: ageChecked ? colors.clay : 'transparent',
              borderWidth: ageChecked ? 0 : 1.5,
              borderColor: colors.hairlineStrong,
            }}>
            {ageChecked ? <Text className="text-[10px]" style={{ color: colors.paper }}>✓</Text> : null}
          </View>
          <Text variant="bodySm" className="flex-1 text-[12.5px]" style={{ lineHeight: 17 }}>
            {COMMUNITY_COPY.consent.age}
          </Text>
        </Pressable>
      </View>
      <Text variant="label" tone="muted" className="mt-4">
        {COMMUNITY_COPY.consent.note}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ageChecked }}
        disabled={!ageChecked}
        onPress={() => void allow()}
        className="mt-5 h-[54px] items-center justify-center rounded-pill"
        style={{ backgroundColor: colors.clay, opacity: ageChecked ? 1 : 0.4 }}>
        <Text className="font-sans-semibold text-[16px]" style={{ color: colors.paper }}>
          {COMMUNITY_COPY.consent.cta}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => backOrReplace(router, APP_COMMUNITY_ROUTE)}
        className="h-[42px] items-center justify-center"
      >
        <Text className="font-sans-semibold text-[15px]" tone="muted">
          {COMMUNITY_COPY.consent.decline}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Composer() {
  const handle = useMemo(() => buildAnonHandle(), []);
  const [body, setBody] = useState('');
  const scan = scanClaimSafety(body);
  const hasText = body.trim().length > 0;

  const submit = () => {
    haptics.select();
    track('question_submitted', { flagged: scan.flagged });
    // Peer posting is deferred (B-COMMUNITY-MOD). The honest pre-moderation reality.
    Alert.alert(COMMUNITY_COPY.ask.deferredTitle, COMMUNITY_COPY.ask.deferredBody, [{ text: 'OK' }]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8 pt-1">
      {/* composer */}
      <View className="rounded-[22px] bg-paper-raised p-4" style={{ borderWidth: 1, borderColor: colors.hairline }}>
        <View className="mb-3.5 flex-row items-center gap-2.5">
          <View className="h-[30px] w-[30px] items-center justify-center rounded-full" style={{ backgroundColor: colors.greige }}>
            <Text tone="muted">☺</Text>
          </View>
          <View className="flex-1">
            <Text variant="bodySm" className="font-sans-semibold text-[13.5px]">
              {COMMUNITY_COPY.ask.postingAs}{' '}
              <Text className="font-mono text-[12px]" style={{ color: colors.clay }}>
                {handle}
              </Text>
            </Text>
            <Text className="text-[11px]" tone="muted">
              {COMMUNITY_COPY.ask.handleNote}
            </Text>
          </View>
        </View>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="Ask a calm, claim-safe question…"
          placeholderTextColor={colors.mutedLight}
          accessibilityLabel="Your anonymous question"
          style={{ fontSize: 15, color: colors.ink, minHeight: 72, lineHeight: 22, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.hairline }}
        />
        {hasText ? (
          <View className="mt-3 flex-row items-center gap-2">
            <Text style={{ color: scan.flagged ? colors.clay : colors.sage, fontSize: 12 }}>{scan.flagged ? '◇' : '✓'}</Text>
            <Text className="flex-1 text-[11px]" style={{ color: scan.flagged ? colors.clayDeep : colors.sageBody, lineHeight: 15 }}>
              {scan.flagged ? COMMUNITY_COPY.ask.claimSafeFlagged : COMMUNITY_COPY.ask.claimSafePassed}
            </Text>
          </View>
        ) : null}
      </View>

      {/* gates */}
      <View className="mt-3.5 gap-2">
        <GateRow label={COMMUNITY_COPY.ask.ageGate} />
        <View className="flex-row items-center gap-3 rounded-xl bg-paper-raised px-3.5 py-3" style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <View className="h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.sageTint }}>
            <Text className="text-[10px]" style={{ color: colors.sage }}>
              ✓
            </Text>
          </View>
          <Text variant="bodySm" className="flex-1 text-[12.5px]" style={{ lineHeight: 17 }}>
            <Text className="font-mono text-[11px]" style={{ color: colors.clay }}>
              community_participation
            </Text>{' '}
            {COMMUNITY_COPY.ask.consentRow}
          </Text>
        </View>
      </View>

      {/* pre-moderation state */}
      <View
        className="mt-3.5 flex-row items-center gap-3 rounded-2xl p-4"
        style={{ backgroundColor: colors.clayTint, borderWidth: 1, borderColor: 'rgba(165,105,75,0.2)' }}>
        <Text style={{ color: colors.clay, fontSize: 16 }}>◷</Text>
        <Text className="flex-1 text-[12.5px]" style={{ color: '#6F4A36', lineHeight: 18 }}>
          {COMMUNITY_COPY.ask.preModeration}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !hasText }}
        disabled={!hasText}
        onPress={submit}
        className="mt-4 h-[50px] items-center justify-center rounded-pill"
        style={{ backgroundColor: colors.clay, opacity: hasText ? 1 : 0.4 }}>
        <Text className="font-sans-semibold text-[15px]" style={{ color: colors.paper }}>
          {COMMUNITY_COPY.ask.submit}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

export default function AskScreen() {
  const { data: gate } = useCommunityGate();

  if (!phase7Flags.communityPosting)
    return <DeferredSurface surface="communityPosting" fallbackRoute={APP_COMMUNITY_ROUTE} />;

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center justify-between pb-2 pt-1">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => backOrReplace(router, APP_COMMUNITY_ROUTE)}
            className="h-7 w-7 items-center justify-center rounded-full bg-paper-raised"
            style={{ borderWidth: 1, borderColor: colors.hairline }}>
            <Text style={{ color: colors.ink }}>‹</Text>
          </Pressable>
          <Text variant="body" className="font-sans-semibold" tone="muted">
            {COMMUNITY_COPY.ask.title}
          </Text>
        </View>
        <Text variant="label" tone="muted">
          {COMMUNITY_COPY.ask.phaseTag}
        </Text>
      </View>

      {/* Composer requires BOTH the consent AND the affirmative 16+ gate (docs/11 §8). */}
      {gate?.consented && gate?.ageConfirmed ? <Composer /> : <ConsentGate />}
    </Screen>
  );
}
