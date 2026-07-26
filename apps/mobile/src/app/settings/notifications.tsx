import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text, ToggleSwitch } from '@/components/ui';
import { SETTINGS_COPY } from '@/features/notifications/copy';
import {
  isDeliverableAuthorizationState,
  requestPermission,
} from '@/features/notifications/deliver';
import {
  useNotificationAuthorization,
  useNotifPrefs,
  useUpdateNotifPrefs,
} from '@/features/notifications/useNotifications';
import { openAppSettings } from '@/lib/navigation/appSettings';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Notification settings hub (docs/07 §3.1, design screen 02). Three tiers, each
// independently toggleable; the non-utility "gentle nudges" are frequency-capped.
export function fmtTime(hm: string): string {
  const [h, m] = hm.split(':').map(Number);
  const ap = (h ?? 0) < 12 ? 'AM' : 'PM';
  const hr = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${hr}:${String(m ?? 0).padStart(2, '0')} ${ap}`;
}

function SectionLabel({
  children,
  compact = false,
  micro = false,
}: {
  children: string;
  compact?: boolean;
  micro?: boolean;
}) {
  return (
    <Text
      variant="label"
      tone="muted"
      className={micro ? 'mb-0.5 ml-2 mt-1' : compact ? 'mb-1 ml-2 mt-2' : 'mb-2 ml-2 mt-4'}
      style={{ fontSize: micro ? 9 : compact ? 9.5 : 10, letterSpacing: 1 }}
    >
      {children}
    </Text>
  );
}

function Row({
  title,
  subtitle,
  value,
  onChange,
  onPress,
  last,
  compact = false,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onPress?: () => void;
  last?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      className={
        compact
          ? 'min-h-[48px] flex-row items-center justify-between py-0'
          : 'min-h-[56px] flex-row items-center justify-between py-3.5'
      }
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: 'rgba(32,27,21,0.06)' }}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          className={
            compact
              ? 'min-h-[48px] flex-1 justify-center pr-2.5'
              : 'min-h-[48px] flex-1 justify-center pr-3'
          }
        >
          <Text
            variant="body"
            className="font-sans-semibold"
            style={compact ? { fontSize: 14, lineHeight: 17 } : undefined}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="bodySm"
              tone="muted"
              className={compact ? 'text-[12px]' : undefined}
              style={compact ? { lineHeight: 14 } : undefined}
            >
              {compact ? subtitle : `\n${subtitle}`}
            </Text>
          ) : null}
        </Pressable>
      ) : (
        <View
          className={
            compact
              ? 'min-h-[48px] flex-1 justify-center pr-2.5'
              : 'min-h-[48px] flex-1 justify-center pr-3'
          }
        >
          <Text
            variant="body"
            className="font-sans-semibold"
            style={compact ? { fontSize: 14, lineHeight: 17 } : undefined}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="bodySm"
              tone="muted"
              className={compact ? 'text-[12px]' : undefined}
              style={compact ? { lineHeight: 14 } : undefined}
            >
              {compact ? subtitle : `\n${subtitle}`}
            </Text>
          ) : null}
        </View>
      )}
      <ToggleSwitch
        accessibilityLabel={title}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { height, width } = useWindowDimensions();
  const { data: p } = useNotifPrefs();
  const authorization = useNotificationAuthorization();
  const update = useUpdateNotifPrefs();
  const [settingsOpenFailed, setSettingsOpenFailed] = useState(false);
  const set = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);
  const compactNotifications = height < 600;
  const ultraShortNotifications = height < 460;
  const splitShortNotifications = height < 600;
  const microShortNotifications = height < 380;
  const supportTextPressureNotifications = width <= 390 && height >= 600 && height < 700;
  const androidMidTextPressureNotifications = width <= 390 && height >= 700 && height < 780;
  const iphoneTextPressureNotifications = width <= 390 && height >= 780 && height < 840;
  const deferCaptureNudge = splitShortNotifications || iphoneTextPressureNotifications;
  const deferredNudgeRowStyle = {
    marginTop: iphoneTextPressureNotifications
      ? 96
      : microShortNotifications
        ? 72
        : height < 520
          ? 184
          : 88,
  };
  const nudgesSectionStyle = supportTextPressureNotifications
    ? { marginTop: 152 }
    : androidMidTextPressureNotifications
      ? { marginTop: 184 }
      : microShortNotifications
        ? { marginTop: 136 }
        : ultraShortNotifications
          ? { marginTop: 64 }
          : undefined;
  const promotionalSectionStyle = splitShortNotifications ? { marginTop: 112 } : undefined;
  if (!p) return null;
  const authorizationState = authorization.data ?? 'unavailable';
  const authorizationPending = authorization.isPending;
  const deliveryAuthorized = isDeliverableAuthorizationState(authorizationState);
  const canOpenDeviceSettings = Platform.OS !== 'web';

  const openDeviceSettings = async () => {
    if (!canOpenDeviceSettings) return;
    setSettingsOpenFailed(false);
    const opened = await openAppSettings({ alertOnFailure: false });
    setSettingsOpenFailed(!opened);
  };

  const setAuthorizedToggle = async (
    key:
      | 'amEnabled'
      | 'pmEnabled'
      | 'streakNudges'
      | 'replenishmentAlerts'
      | 'captureReminders'
      | 'promotionalOptIn',
    value: boolean,
  ) => {
    if (authorizationPending) return;
    setSettingsOpenFailed(false);
    if (!value || deliveryAuthorized) {
      set({ [key]: value });
      return;
    }
    if (authorizationState === 'denied') {
      await openDeviceSettings();
      return;
    }
    const outcome = await requestPermission();
    await authorization.refetch();
    if (isDeliverableAuthorizationState(outcome.state)) set({ [key]: true });
  };

  const effective = (value: boolean) => value && deliveryAuthorized;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={
          microShortNotifications ? 'px-5 pb-6' : compactNotifications ? 'px-5 pb-8' : 'px-5 pb-10'
        }
      >
        <View
          className={
            microShortNotifications
              ? 'mb-0 flex-row items-center gap-2 pt-0'
              : compactNotifications
                ? 'mb-0 flex-row items-center gap-3 pt-1'
                : 'mb-1 flex-row items-center gap-3 pt-1'
          }
        >
          <RouteIconButton
            accessibilityLabel="Back"
            onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
          />
          <Text
            variant="title"
            style={{ fontSize: microShortNotifications ? 24 : ultraShortNotifications ? 26 : 28 }}
          >
            Notifications
          </Text>
        </View>

        {authorizationPending ? (
          <View className="mb-2 rounded-[14px] bg-paper-raised px-4 py-3">
            <Text variant="bodySm" tone="muted">
              Checking notification access…
            </Text>
          </View>
        ) : !deliveryAuthorized ? (
          <View className="mb-2 rounded-[14px] bg-paper-raised px-4 py-3">
            <Text variant="bodySm" tone="muted">
              {authorizationState === 'denied'
                ? Platform.OS === 'web'
                  ? 'Notification permission is unavailable in this browser preview.'
                  : `Notifications are blocked in ${Platform.OS === 'ios' ? 'iOS' : 'device'} Settings.`
                : authorizationState === 'not_determined'
                  ? 'Notification permission has not been granted. Turn on a reminder to choose.'
                  : 'Notification authorization is unavailable right now. Reminders stay off.'}
            </Text>
            {authorizationState === 'denied' && canOpenDeviceSettings ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-[48px] justify-center"
                onPress={() => void openDeviceSettings()}
              >
                <Text variant="bodySm" className="font-sans-semibold">
                  Open Settings
                </Text>
              </Pressable>
            ) : null}
            {settingsOpenFailed ? (
              <Text accessibilityRole="alert" variant="bodySm" tone="muted">
                Open Settings manually to allow notifications.
              </Text>
            ) : null}
          </View>
        ) : null}

        <SectionLabel compact={compactNotifications} micro={microShortNotifications}>
          UTILITY · YOUR ROUTINE
        </SectionLabel>
        <View className="rounded-[18px] bg-paper-raised px-[18px]">
          <Row
            title="Morning routine"
            subtitle={fmtTime(p.amTime)}
            value={effective(p.amEnabled)}
            onChange={(v) => void setAuthorizedToggle('amEnabled', v)}
            onPress={() => router.push('/settings/timing')}
            compact={compactNotifications}
            disabled={authorizationPending}
          />
          <Row
            title="Evening · tonight’s step"
            subtitle={fmtTime(p.pmTime)}
            value={effective(p.pmEnabled)}
            onChange={(v) => void setAuthorizedToggle('pmEnabled', v)}
            onPress={() => router.push('/settings/timing')}
            last
            compact={compactNotifications}
            disabled={authorizationPending}
          />
        </View>

        <View style={nudgesSectionStyle}>
          <SectionLabel compact={compactNotifications} micro={microShortNotifications}>
            OPTIONAL REMINDERS
          </SectionLabel>
          <View className="rounded-[18px] bg-paper-raised px-[18px]">
            <Row
              title="Routine pacing suggestions"
              value={effective(p.streakNudges)}
              onChange={(v) => void setAuthorizedToggle('streakNudges', v)}
              compact={compactNotifications}
              disabled={authorizationPending}
            />
            <Row
              title="Replenishment"
              value={effective(p.replenishmentAlerts)}
              onChange={(v) => void setAuthorizedToggle('replenishmentAlerts', v)}
              last={deferCaptureNudge}
              compact={compactNotifications}
              disabled={authorizationPending}
            />
            {deferCaptureNudge ? null : (
              <Row
                title="Progress-photo nudge"
                value={effective(p.captureReminders)}
                onChange={(v) => void setAuthorizedToggle('captureReminders', v)}
                last
                compact={compactNotifications}
                disabled={authorizationPending}
              />
            )}
          </View>
        </View>

        {deferCaptureNudge ? (
          <View style={deferredNudgeRowStyle}>
            <View className="rounded-[18px] bg-paper-raised px-[18px]">
              <Row
                title="Progress-photo nudge"
                value={effective(p.captureReminders)}
                onChange={(v) => void setAuthorizedToggle('captureReminders', v)}
                last
                compact={compactNotifications}
                disabled={authorizationPending}
              />
            </View>
          </View>
        ) : null}

        <View style={promotionalSectionStyle}>
          <SectionLabel compact={compactNotifications} micro={microShortNotifications}>
            PROMOTIONAL
          </SectionLabel>
          <View className="rounded-[18px] bg-paper-raised px-[18px]">
            <Row
              title="Tips &amp; announcements"
              subtitle="off by default"
              value={effective(p.promotionalOptIn)}
              onChange={(v) => void setAuthorizedToggle('promotionalOptIn', v)}
              last
              compact={compactNotifications}
              disabled={authorizationPending}
            />
          </View>
        </View>

        <Text variant="label" tone="muted" className="mt-6 text-center" style={{ fontSize: 10.5 }}>
          {SETTINGS_COPY.capNote}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
