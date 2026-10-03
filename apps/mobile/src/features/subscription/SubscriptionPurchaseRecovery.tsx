import { useState } from 'react';
import type { PlanId } from '@layerwell/types';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { confirmedFreePlan } from './clientEntitlement';
import type { SubscriptionState } from './entitlement';
import { useEntitlement } from './useEntitlement';
import { useSubscriptionOffering } from './useSubscriptionOffering';

/** Shared normal-paywall admission; no custom grants or win-back offers. */
export function useStandardSubscriptionOffering() {
  const [plan, setPlan] = useState<PlanId>('annual');
  const access = useEntitlement();
  const offering = useSubscriptionOffering({ enabled: confirmedFreePlan(access) });
  const canPurchase = confirmedFreePlan(access) && !offering.isFetching &&
    offering.data?.status === 'available' && offering.data[plan].canPurchase;
  return { access, offering, canPurchase, plan, setPlan };
}

type AccessQuery = Readonly<{
  data?: SubscriptionState;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}>;
type OfferingQuery = Readonly<{
  data?: Readonly<{ status: string }>;
  isFetching: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}>;

/** Existing close/free and ComplianceRow actions stay visible around this panel. */
export function SubscriptionPurchaseRecovery({ access, offering }: {
  access: AccessQuery;
  offering: OfferingQuery;
}) {
  const active = access.data?.isPro === true;
  const confirmedFree = confirmedFreePlan(access);
  const checkingAccess = access.isPending || access.isFetching;
  const pricingUnavailable = confirmedFree &&
    (offering.isError || offering.data?.status === 'unavailable');
  if (confirmedFree && !pricingUnavailable) return null;
  const message = active
    ? 'Pro access is already verified for this account. Manage the existing subscription instead of buying again.'
    : checkingAccess
      ? 'Checking your current plan. You can still continue without a new purchase.'
      : pricingUnavailable
        ? 'No new purchase is available right now. Restore purchases and the free path remain available.'
        : 'Plan status is unavailable. Check access or restore your purchases before buying again.';
  const busy = checkingAccess || offering.isFetching;
  return (
    <View className="mt-2 rounded-card bg-paper-raised p-3">
      <Text accessibilityRole="alert" variant="bodySm" tone="muted">{message}</Text>
      {!active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pricingUnavailable ? 'Refresh store pricing' : 'Check subscription access'}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void (pricingUnavailable ? offering.refetch() : access.refetch())}
          className="min-h-[48px] justify-center py-2"
        >
          <Text variant="bodySm" style={{ color: colors.clay }}>
            {busy ? 'Checking...' : pricingUnavailable ? 'Refresh store pricing' : 'Check access again'}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Manage existing subscription"
        onPress={() => router.push('/settings/subscription')}
        className="min-h-[48px] justify-center py-2"
      >
        <Text variant="bodySm" style={{ color: colors.clay }}>Manage existing subscription</Text>
      </Pressable>
    </View>
  );
}

/** Both ordinary subscription durations use the same checkout and admission path. */
export function SubscriptionPlanSelector({ plan, onChange, disabled = false }: {
  plan: PlanId;
  onChange: (plan: PlanId) => void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" className="mt-3 flex-row gap-3">
      {(['annual', 'monthly'] as const).map((id) => (
        <Pressable key={id} accessibilityRole="radio"
          accessibilityLabel={id === 'annual' ? 'Annual subscription' : 'Monthly subscription'}
          accessibilityState={{ checked: plan === id, disabled }} disabled={disabled} onPress={() => onChange(id)}
          className="min-h-[48px] flex-1 items-center justify-center rounded-pill px-3"
          style={{ borderWidth: 1, borderColor: plan === id ? colors.clay : colors.mutedLight }}>
          <Text variant="bodySm" tone="muted">{id === 'annual' ? 'Annual' : 'Monthly'}</Text>
        </Pressable>
      ))}
    </View>
  );
}
