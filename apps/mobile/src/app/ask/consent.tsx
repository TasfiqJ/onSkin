import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { Button, Card, Screen, Text } from '@/components/ui';
import { grantAskConsent, isAskConsented, revokeAskConsent } from '@/features/ask/consent';
import { ASK_COPY } from '@/features/ask/copy';
import { phase7Flags } from '@/lib/launch/phase7';
import { colors } from '@/theme/tokens';

// The Ask privacy gate (docs/13 §7, design screen 05). The DEFAULT-OFF ask_onskin consent
// for the CLOUD-grounded language layer. Distinct, revocable, never default-on. The
// deterministic on-device advisor needs no consent; this gate is only for the deeper
// cloud path (deferred, B-AI-ASSISTANT-VENDOR). Honest posture (the stress-tested §7):
// a short, consented safety window, NOT "no transcript, ever".

function Bullet({ kind, text }: { kind: 'keep' | 'never'; text: string }) {
  const bg = kind === 'keep' ? colors.sageTint : colors.clayTint;
  const fg = kind === 'keep' ? colors.sageDeep : colors.clayDeep;
  return (
    <View className="flex-row items-start gap-2.5">
      <View
        className="mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-full"
        style={{ backgroundColor: bg }}
      >
        <Text style={{ color: fg, fontSize: 10 }}>{kind === 'keep' ? '✓' : '✕'}</Text>
      </View>
      <Text className="flex-1 text-[12.5px]" style={{ color: colors.inkSoft, lineHeight: 18 }}>
        {text}
      </Text>
    </View>
  );
}

export default function AskConsentScreen() {
  const qc = useQueryClient();
  const consented = useQuery({
    queryKey: ['ask_onskin'],
    queryFn: isAskConsented,
    enabled: phase7Flags.cloudAsk,
    retry: 0,
  });

  if (!phase7Flags.cloudAsk) return <DeferredSurface surface="cloudAsk" />;

  const onToggle = async (enabled: boolean) => {
    qc.setQueryData(['ask_onskin'], enabled);
    try {
      if (enabled) await grantAskConsent();
      else await revokeAskConsent();
    } catch {
      /* best-effort until backend configured */
    } finally {
      void qc.invalidateQueries({ queryKey: ['ask_onskin'] });
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Text style={{ color: colors.ink, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Text variant="body" className="font-sans-semibold" tone="muted">
          {ASK_COPY.privacy.header}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
        className="mt-3"
      >
        <Card>
          <Text variant="title" className="text-[25px]" accessibilityRole="header">
            {ASK_COPY.privacy.title}
          </Text>
          <Text
            variant="body"
            tone="muted"
            className="mb-4 mt-2.5 text-[13px]"
            style={{ lineHeight: 20 }}
          >
            {ASK_COPY.privacy.body}
          </Text>
          <View className="gap-3">
            {ASK_COPY.privacy.keep.map((b) => (
              <Bullet key={b} kind="keep" text={b} />
            ))}
            <Bullet kind="never" text={ASK_COPY.privacy.never} />
          </View>
          <View
            className="mt-4 flex-row items-center gap-2 border-t pt-3.5"
            style={{ borderTopColor: colors.hairline }}
          >
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.clay }} />
            <Text className="flex-1 text-[11px]" style={{ color: colors.muted, lineHeight: 16 }}>
              {ASK_COPY.privacy.consentLine}
            </Text>
          </View>
        </Card>

        <Card className="mt-4 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text variant="body" className="font-sans-semibold">
              {ASK_COPY.privacy.toggleLabel}
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-0.5">
              {ASK_COPY.privacy.toggleHint}
            </Text>
          </View>
          <Switch
            value={consented.data ?? false}
            onValueChange={(v) => void onToggle(v)}
            trackColor={{ true: colors.clay, false: colors.greigeDeep }}
            thumbColor={colors.paperRaised}
          />
        </Card>

        <Text
          className="mt-4 text-center font-mono text-[10px]"
          style={{ color: colors.mutedLight, lineHeight: 16 }}
        >
          {ASK_COPY.privacy.footer}
        </Text>

        <Button className="mt-5" label="Open Ask OnSkin" onPress={() => router.replace('/ask')} />
      </ScrollView>
    </Screen>
  );
}
