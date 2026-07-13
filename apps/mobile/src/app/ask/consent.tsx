import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { Button, Card, RouteIconButton, Screen, Text, ToggleSwitch } from '@/components/ui';
import { applyAskConsentChoice } from '@/features/ask/applyConsentChoice';
import { grantAskConsent, isAskConsented, revokeAskConsent } from '@/features/ask/consent';
import { ASK_COPY } from '@/features/ask/copy';
import { clearAskStore, setAskConsentLocal } from '@/features/ask/store';
import { BRAND } from '@/lib/brand';
import { phase7Flags } from '@/lib/launch/phase7';
import { APP_ASK_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isOwnerQueryScopeCurrent, ownerQueryPrefixes, queryKeys } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

// The Ask privacy gate (docs/13 §7, design screen 05). The DEFAULT-OFF ask_onskin consent
// for the CLOUD-grounded language layer. Distinct, revocable, never default-on. The
// deterministic on-device advisor needs no consent; this gate is only for the deeper
// cloud path (deferred, B-AI-ASSISTANT-VENDOR). Honest posture (the stress-tested §7):
// a short, consented safety window, NOT "no transcript, ever".

type AskConsentFailureModes = {
  grantOnce: boolean;
  ledgerLocalOnly: boolean;
  revokeOnce: boolean;
};

function devAskConsentFailureModes(): AskConsentFailureModes {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return { grantOnce: false, ledgerLocalOnly: false, revokeOnce: false };
  }
  const modes = new Set(
    (process.env.EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE ?? '').split(',').map((mode) => mode.trim()),
  );
  return {
    grantOnce: modes.has('grant_once') || modes.has('all_once'),
    ledgerLocalOnly: process.env.EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER === 'local_only',
    revokeOnce: modes.has('revoke_once') || modes.has('all_once'),
  };
}

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
  const ownerScope = useOwnerQueryScope();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [askConsentFailureUsed, setAskConsentFailureUsed] = useState({
    grant: false,
    revoke: false,
  });
  const savingRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const failureModes = devAskConsentFailureModes();
  const consented = useQuery({
    queryKey: queryKeys.askConsent(ownerScope),
    queryFn: isAskConsented,
    enabled: phase7Flags.cloudAsk,
    retry: 0,
  });

  if (!phase7Flags.cloudAsk)
    return (
      <DeferredSurface
        surface="cloudAsk"
        fallbackRoute={APP_ASK_ROUTE}
        fallbackLabel="Back to Ask"
      />
    );

  const showSaveFailure = () => {
    setSaveFailed(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const grant = async () => {
    if (failureModes.grantOnce && !askConsentFailureUsed.grant) {
      setAskConsentFailureUsed((used) => ({ ...used, grant: true }));
      throw new Error('E2E_ASK_CONSENT_GRANT_FAILURE');
    }
    if (failureModes.ledgerLocalOnly) {
      await setAskConsentLocal(true);
      return;
    }
    await grantAskConsent();
  };

  const revoke = async () => {
    if (failureModes.revokeOnce && !askConsentFailureUsed.revoke) {
      setAskConsentFailureUsed((used) => ({ ...used, revoke: true }));
      throw new Error('E2E_ASK_CONSENT_REVOKE_FAILURE');
    }
    if (failureModes.ledgerLocalOnly) {
      await clearAskStore();
      return;
    }
    await revokeAskConsent();
  };

  const onToggle = async (enabled: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveFailed(false);
    setSaving(true);
    try {
      const saved = await applyAskConsentChoice(enabled, {
        grant,
        revoke,
        onSaved: () => {
          if (!isOwnerQueryScopeCurrent(ownerScope)) return;
          qc.setQueryData(queryKeys.askConsent(ownerScope), enabled);
        },
        onFailure: showSaveFailure,
        invalidate: () => {
          if (!isOwnerQueryScopeCurrent(ownerScope)) return Promise.resolve();
          return qc.invalidateQueries({ queryKey: ownerQueryPrefixes.askConsent(ownerScope) });
        },
      });
      if (saved) setSaveFailed(false);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_ASK_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold" tone="muted">
          {ASK_COPY.privacy.header}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
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
          <ToggleSwitch
            accessibilityLabel={ASK_COPY.privacy.toggleLabel}
            value={consented.data ?? false}
            disabled={saving}
            inactiveTrackColor={colors.greigeDeep}
            onChange={(v) => void onToggle(v)}
          />
        </Card>

        {saveFailed ? (
          <Card
            accessibilityRole="alert"
            className="mt-3"
            style={{
              backgroundColor: 'rgba(165,105,75,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(165,105,75,0.22)',
            }}
          >
            <Text className="font-sans-semibold text-[13px]" style={{ color: colors.clayDeep }}>
              {ASK_COPY.privacy.saveFailedTitle}
            </Text>
            <Text className="mt-1 text-[12px]" tone="muted" style={{ lineHeight: 17 }}>
              {ASK_COPY.privacy.saveFailedBody}
            </Text>
          </Card>
        ) : null}

        <Text
          className="mt-4 text-center font-mono text-[10px]"
          style={{ color: colors.mutedLight, lineHeight: 16 }}
        >
          {ASK_COPY.privacy.footer}
        </Text>

        <Button
          className="mt-5"
          label={`Open ${BRAND.askName}`}
          onPress={() => router.replace('/ask')}
        />
      </ScrollView>
    </Screen>
  );
}
