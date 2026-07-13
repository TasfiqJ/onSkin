import type { PregnancyStatus } from '@onskin/types';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, OptionCard, RouteIconButton, Screen, Text } from '@/components/ui';
import { savePregnancyStatus, useProfileBits } from '@/features/scheduler/profile';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

const OPTIONS: { id: PregnancyStatus; label: string }[] = [
  { id: 'none', label: 'No' },
  { id: 'pregnant', label: 'Pregnant or trying' },
  { id: 'breastfeeding', label: 'Breastfeeding' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

type ReturnDestination = 'plan' | 'shelf' | 'today' | 'you';

function returnDestination(value: string | string[] | undefined): ReturnDestination {
  const token = Array.isArray(value) ? value[0] : value;
  return token === 'plan' || token === 'shelf' || token === 'today' ? token : 'you';
}

export default function SkinProfileSettingsScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const profile = useProfileBits();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = returnDestination(params.returnTo);
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const [choice, setChoice] = useState<PregnancyStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const storedStatus = profile.data?.pregnancyStatus;
  const selected = choice ?? (storedStatus && storedStatus !== 'unknown' ? storedStatus : null);

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const next = await savePregnancyStatus(selected);
      if (!isOwnerQueryScopeCurrent(ownerScope)) return;
      qc.setQueryData(queryKeys.skinProfile(ownerScope), next);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ownerQueryPrefixes.shelf(ownerScope) }),
        qc.invalidateQueries({ queryKey: ownerQueryPrefixes.ramp(ownerScope) }),
      ]);
      if (returnTo === 'plan') router.replace('/routine/plan');
      else if (returnTo === 'shelf') router.replace('/(tabs)/shelf');
      else if (returnTo === 'today') router.replace('/(tabs)/today');
      else backOrReplace(router, APP_YOU_ROUTE);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const localProfileAvailable = profile.data?.source === 'local';
  const consentCurrent = profile.data?.consentCurrent === true;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
        />
        <Text
          variant="title"
          className="min-w-0 flex-1"
          style={{ fontSize: compact ? 25 : 28, lineHeight: compact ? 29 : 32 }}
        >
          Pregnancy &amp; breastfeeding
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compact ? 'pb-5 pt-3' : 'pb-8 pt-5'}
      >
        <Text variant="body" tone="muted">
          This private setting controls which caution products can appear in your routine.
        </Text>

        {profile.isLoading ? (
          <View className="mt-5 rounded-card bg-greige-chip p-4">
            <Text className="font-sans-semibold text-[15px]">Checking your private profile</Text>
            <Text variant="bodySm" tone="muted" className="mt-1.5">
              One moment while this device opens your saved setting.
            </Text>
          </View>
        ) : !consentCurrent ? (
          <View className="mt-5 rounded-card bg-clay-tint p-4">
            <Text className="font-sans-semibold text-[15px]" style={{ color: colors.clayDeep }}>
              Privacy choice needs review
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1.5">
              Review the current health-data collection text before viewing or changing this private
              setting. Caution products stay paused meanwhile.
            </Text>
            <Button
              label="Review privacy choice"
              variant="ghost"
              className="mt-3 min-h-[48px] rounded-[8px] py-2.5"
              onPress={() =>
                router.push({
                  pathname: '/onboarding/consent',
                  params: { returnTo: 'skin-profile', profileReturnTo: returnTo },
                })
              }
            />
          </View>
        ) : localProfileAvailable ? (
          <>
            <View className={compact ? 'mt-4 gap-2' : 'mt-6 gap-3'}>
              {OPTIONS.map((option) => (
                <OptionCard
                  key={option.id}
                  title={option.label}
                  selected={selected === option.id}
                  disabled={saving}
                  onPress={() => {
                    setChoice(option.id);
                    setSaveFailed(false);
                  }}
                  compact
                  tight={compact}
                />
              ))}
            </View>

            <View
              className={
                compact
                  ? 'mt-4 rounded-card bg-greige-chip p-3.5'
                  : 'mt-5 rounded-card bg-greige-chip p-4'
              }
            >
              <Text variant="bodySm" tone="muted">
                Only No clears pregnancy-caution products for your routine. Prefer not to say keeps
                the cautious plan.
              </Text>
            </View>

            {saveFailed ? (
              <View accessibilityRole="alert" className="mt-4 rounded-card bg-clay-tint p-4">
                <Text className="font-sans-semibold text-[14px]" style={{ color: colors.clayDeep }}>
                  Choice not saved
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1">
                  Your previous setting is unchanged. Try again when private storage is available.
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <View className="mt-5 rounded-card bg-clay-tint p-4">
            <Text className="font-sans-semibold text-[15px]" style={{ color: colors.clayDeep }}>
              Skin profile unavailable
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1.5">
              Caution products remain paused. Rebuild your skin profile to create a current private
              profile on this device.
            </Text>
            <Button
              label="Rebuild skin profile"
              variant="ghost"
              className="mt-3 min-h-[48px] rounded-[8px] py-2.5"
              onPress={() => router.push('/onboarding/goals')}
            />
          </View>
        )}
      </ScrollView>

      {!profile.isLoading && consentCurrent && localProfileAvailable ? (
        <View className="border-t border-hairline bg-paper pb-2 pt-3">
          <Button
            label={saveFailed ? 'Try again' : saving ? 'Saving...' : 'Save setting'}
            disabled={!selected || saving}
            onPress={() => void save()}
          />
        </View>
      ) : null}
    </Screen>
  );
}
