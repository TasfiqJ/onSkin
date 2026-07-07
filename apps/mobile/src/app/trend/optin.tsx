import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { RouteIconButton, Screen, Text, ToggleSwitch } from '@/components/ui';
import { applyTrendConsentChoice } from '@/features/trend/applyConsentChoice';
import { grantTrendInsightsConsent, revokeTrendInsightsConsent } from '@/features/trend/consent';
import { TREND_COPY } from '@/features/trend/copy';
import { deleteTrendState, setTrendInsightsLocal } from '@/features/trend/store';
import { useTrendConsent } from '@/features/trend/useTrend';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

type TrendConsentFailureModes = {
  grantOnce: boolean;
  ledgerLocalOnly: boolean;
  revokeOnce: boolean;
};

function devTrendConsentFailureModes(): TrendConsentFailureModes {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return { grantOnce: false, ledgerLocalOnly: false, revokeOnce: false };
  }
  const modes = new Set(
    (process.env.EXPO_PUBLIC_E2E_TREND_CONSENT_FAILURE ?? '')
      .split(',')
      .map((mode) => mode.trim()),
  );
  return {
    grantOnce: modes.has('grant_once') || modes.has('all_once'),
    ledgerLocalOnly: process.env.EXPO_PUBLIC_E2E_TREND_CONSENT_LEDGER === 'local_only',
    revokeOnce: modes.has('revoke_once') || modes.has('all_once'),
  };
}

// 02 · The opt-in (docs/12 §5/§8, design 02). OFF by default, a plain-language
// disclosure, a SEPARATE photo_trend_insights consent. The honest engine is classical
// computer vision ("your phone comparing your own photos"), not marketed as AI. Never
// default-on; the installed base is re-consented here, never silently enrolled.
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row items-start gap-2.5">
      <View
        className="mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-full"
        style={{ backgroundColor: colors.sageTint }}
      >
        <Text className="text-[10px]" style={{ color: colors.sage }}>
          ✓
        </Text>
      </View>
      <Text
        variant="bodySm"
        className="flex-1 text-[12.5px]"
        style={{ color: colors.inkSoft, lineHeight: 18 }}
      >
        {children}
      </Text>
    </View>
  );
}

export default function TrendOptInScreen() {
  const qc = useQueryClient();
  const { data: consented } = useTrendConsent();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [trendConsentFailureUsed, setTrendConsentFailureUsed] = useState({
    grant: false,
    revoke: false,
  });
  const failureModes = devTrendConsentFailureModes();

  const grant = async () => {
    if (failureModes.grantOnce && !trendConsentFailureUsed.grant) {
      setTrendConsentFailureUsed((used) => ({ ...used, grant: true }));
      throw new Error('E2E_TREND_CONSENT_GRANT_FAILURE');
    }
    if (failureModes.ledgerLocalOnly) {
      await setTrendInsightsLocal(true);
      return;
    }
    await grantTrendInsightsConsent();
  };

  const revoke = async () => {
    if (failureModes.revokeOnce && !trendConsentFailureUsed.revoke) {
      setTrendConsentFailureUsed((used) => ({ ...used, revoke: true }));
      throw new Error('E2E_TREND_CONSENT_REVOKE_FAILURE');
    }
    if (failureModes.ledgerLocalOnly) {
      await setTrendInsightsLocal(false);
      await deleteTrendState();
      return;
    }
    await revokeTrendInsightsConsent();
  };

  const setEnabled = async (on: boolean) => {
    if (saving) return;
    setSaveFailed(false);
    setSaving(true);
    haptics.select();
    try {
      const saved = await applyTrendConsentChoice(on, {
        grant,
        revoke,
        invalidate: () => qc.invalidateQueries({ queryKey: ['trendConsent'] }),
        onFailure: () => {
          setSaveFailed(true);
          Alert.alert(TREND_COPY.optIn.saveFailedTitle, TREND_COPY.optIn.saveFailedBody);
        },
      });
      if (saved) {
        qc.setQueryData(['trendConsent'], on);
        setSaveFailed(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_PROGRESS_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold" tone="muted">
          {TREND_COPY.optIn.title}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View
          className="mt-2 rounded-[22px] bg-paper-raised p-5"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <Text variant="title" className="text-[25px] leading-[29px]" accessibilityRole="header">
            {TREND_COPY.optIn.heading}
          </Text>
          <Text
            variant="bodySm"
            tone="muted"
            className="mt-3 text-[13px]"
            style={{ lineHeight: 20 }}
          >
            {TREND_COPY.optIn.body}
          </Text>
          <View className="mt-4 gap-2.5">
            {TREND_COPY.optIn.bullets.map((b) => (
              <Bullet key={b}>{b}</Bullet>
            ))}
          </View>
          <View
            className="mt-4 flex-row items-center gap-2 pt-3.5"
            style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}
          >
            <Text style={{ color: colors.clay, fontSize: 12 }}>✦</Text>
            <Text className="flex-1 text-[11px]" tone="muted" style={{ lineHeight: 15 }}>
              {TREND_COPY.optIn.consentLine}
            </Text>
          </View>
        </View>

        {/* the toggle. OFF by default */}
        <View
          className="mt-3.5 flex-row items-center justify-between rounded-2xl bg-paper-raised p-4"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <View>
            <Text variant="body" className="font-sans-semibold text-[14px]">
              {TREND_COPY.optIn.toggleLabel}
            </Text>
            <Text className="text-[11px]" tone="muted">
              {TREND_COPY.optIn.toggleHint}
            </Text>
          </View>
          <ToggleSwitch
            accessibilityLabel={TREND_COPY.optIn.toggleLabel}
            value={consented ?? false}
            disabled={saving}
            activeTrackColor={colors.sage}
            inactiveTrackColor={colors.greigeDeep}
            onChange={(v) => void setEnabled(v)}
          />
        </View>
        {saveFailed ? (
          <View
            accessibilityRole="alert"
            className="mt-2.5 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: 'rgba(165,105,75,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(165,105,75,0.22)',
            }}
          >
            <Text className="font-sans-semibold text-[13px]" style={{ color: colors.clayDeep }}>
              {TREND_COPY.optIn.saveFailedTitle}
            </Text>
            <Text className="mt-1 text-[12px]" tone="muted" style={{ lineHeight: 17 }}>
              {TREND_COPY.optIn.saveFailedBody}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/trend/fairness')}
          className="mt-3 flex-row items-center justify-between rounded-2xl bg-paper-raised p-4"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <Text variant="bodySm" className="font-sans-medium text-[13px]">
            How it stays fair across skin tones
          </Text>
          <Text style={{ color: colors.mutedLight, fontSize: 18 }}>›</Text>
        </Pressable>

        <Text
          variant="label"
          tone="muted"
          className="mt-5 px-2 text-center"
          style={{ lineHeight: 17 }}
        >
          {TREND_COPY.optIn.footer}
        </Text>
      </ScrollView>
    </Screen>
  );
}
