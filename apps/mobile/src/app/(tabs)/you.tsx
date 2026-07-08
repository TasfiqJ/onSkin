import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, Card, Screen, Text, ToggleSwitch } from '@/components/ui';
import { isCommerceConsented } from '@/features/commerce/consent';
import { setCommerceConsentLocal } from '@/features/commerce/store';
import { CONSENT_COPY_VERSION } from '@/features/onboarding/consentCopy';
import { getCloudBackupEnabled, setCloudBackupEnabled } from '@/features/photos/consent';
import { PHOTO_COPY } from '@/features/photos/copy';
import { requestReviewAfterValue } from '@/features/review/prompt';
import { applySettingsPrivacyChoice } from '@/features/settings/applyPrivacyChoice';
import { deleteAccount, exportData, withdrawHealthDataConsent } from '@/features/settings/actions';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { track } from '@/lib/analytics/track';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { useAuth } from '@/lib/auth/AuthProvider';
import { BRAND } from '@/lib/brand';
import { getLatestConsents, recordConsent } from '@/lib/consent/consent';
import {
  appLockUserMessage,
  dataRightsUserMessage,
  privacyChoiceUserMessage,
} from '@/lib/errors/userFacing';
import { NOT_MEDICAL_ADVICE } from '@/lib/legal/disclaimer';
import { type PolicyLinkKey, policyLinkRows } from '@/lib/legal/policyLinks';
import { phase7Flags } from '@/lib/launch/phase7';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { colors } from '@/theme/tokens';

const POLICY_ROWS = policyLinkRows([
  'privacy',
  'consumerHealthPrivacy',
  'terms',
  'support',
  'accountDeletion',
  'dataExport',
]);

const POLICY_HINTS: Record<PolicyLinkKey, string> = {
  terms: `Rules for using ${BRAND.appName} and subscription terms.`,
  privacy: 'What data we collect, use, and share.',
  consumerHealthPrivacy: 'Consumer health data notice and rights.',
  support: 'Help with accounts, billing, deletion, or export.',
  accountDeletion: 'How account deletion works before and after deleting in app.',
  dataExport: 'How to request and read your export.',
};

const POLICY_LINK_UNAVAILABLE_MESSAGE =
  'Link unavailable. We could not open this policy link. Please try again.';
const PRIVACY_CHOICE_SAVE_FAILED_TITLE = 'Choice not saved';
const CLOUD_BACKUP_TRADEOFF_TITLE = 'Encrypted cloud backup';
const EXPORT_UNAVAILABLE_TITLE = 'Export unavailable';
const EXPORT_UNAVAILABLE_MESSAGE =
  "We couldn't open the export sheet on this device. The temporary export file was removed.";
const EXPORT_FAILED_TITLE = 'Export failed';
const WITHDRAW_HEALTH_DATA_CONFIRM_TITLE = 'Withdraw health-data consent?';
const WITHDRAW_HEALTH_DATA_CONFIRM_MESSAGE =
  'This records your withdrawal and deletes your collected health data. Your account and routine are closed. Apple or Google subscription billing continues until you cancel in the store.';
const WITHDRAW_HEALTH_DATA_FAILED_TITLE = 'Withdrawal failed';
const DELETE_ACCOUNT_CONFIRM_TITLE = 'Delete account?';
const DELETE_ACCOUNT_CONFIRM_MESSAGE =
  'This permanently deletes your account and data. Apple or Google subscription billing continues until you cancel in the store.';
const DELETE_ACCOUNT_FAILED_TITLE = 'Deletion failed';
const COMPACT_FOR_YOU_TOP_MARGIN = 240;
const COMPACT_SECONDARY_ROUTINE_TOP_MARGIN = 48;
const SHORT_PHONE_SECONDARY_ROUTINE_TOP_MARGIN = 104;
const DATA_RIGHTS_CONFIRMATION_SCROLL_NUDGE = 144;
const PRIVACY_DIRECT_ENTRY_TOP_OFFSET = 16;
const PRIVACY_DIRECT_ENTRY_COMPACT_SCROLL_NUDGE = 18;
const PRIVACY_DIRECT_ENTRY_NARROW_SCROLL_NUDGE = 30;
const PRIVACY_DIRECT_ENTRY_ULTRA_SHORT_SCROLL_NUDGE = 56;
const PRIVACY_DIRECT_ENTRY_COMPACT_POLICY_MARGIN = 280;

type StaticRouteHref = Extract<Href, string>;
type PrivacyFeedbackKey = 'marketing' | 'data_sharing' | 'photo_cloud_backup' | 'app_lock';
type PrivacyFeedbackPlacement = 'commerce' | 'privacy' | 'security';
type InlineNotice = {
  title: string;
  message: string;
};
type PendingDataRightsAction = 'withdraw_health_data' | 'delete_account';

function Row({
  label,
  hint,
  children,
  compact,
  onPress,
}: {
  label: string;
  hint?: string;
  children?: React.ReactNode;
  compact?: boolean;
  onPress?: () => void;
}) {
  const labelContent = (
    <>
      <View className="flex-1 pr-3">
        <Text
          variant="body"
          className="font-sans-medium"
          style={compact ? { fontSize: 14, lineHeight: 17 } : undefined}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            variant="bodySm"
            tone="muted"
            className="mt-0.5"
            style={compact ? { fontSize: 12, lineHeight: 16 } : undefined}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      {onPress ? (
        <View className="h-[44px] w-[44px] items-center justify-center">
          <Text variant="body" tone="muted" style={{ fontSize: 18 }}>
            &gt;
          </Text>
        </View>
      ) : (
        children
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        onPress={onPress}
        className={
          compact
            ? 'min-h-[48px] flex-row items-center justify-between py-0.5'
            : 'min-h-[56px] flex-row items-center justify-between py-2'
        }
        style={({ pressed }) => (pressed ? { opacity: 0.82 } : undefined)}
      >
        {labelContent}
      </Pressable>
    );
  }

  return (
    <View
      className={
        compact
          ? 'min-h-[48px] flex-row items-center justify-between py-0.5'
          : 'min-h-[56px] flex-row items-center justify-between py-2'
      }
    >
      {labelContent}
    </View>
  );
}

function Toggle({
  value,
  disabled,
  onChange,
  accessibilityLabel,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  accessibilityLabel: string;
}) {
  return (
    <ToggleSwitch
      accessibilityLabel={accessibilityLabel}
      value={value}
      disabled={disabled}
      inactiveTrackColor={colors.greigeDeep}
      onChange={onChange}
    />
  );
}

function InlineNoticeCard({
  notice,
  className = 'mt-2',
}: {
  notice: InlineNotice;
  className?: string;
}) {
  return (
    <View className={`${className} rounded-[12px] bg-clay-tint px-4 py-3`}>
      <Text
        accessibilityRole="alert"
        variant="bodySm"
        className="text-center"
        style={{ color: colors.clayDeep, lineHeight: 20 }}
      >
        {notice.title}
        {'\n'}
        {notice.message}
      </Text>
    </View>
  );
}

function InlineConfirmCard({
  title,
  message,
  confirmLabel,
  disabled,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View className="mt-2 rounded-[12px] bg-clay-tint px-4 py-3">
      <Text
        accessibilityRole="alert"
        variant="bodySm"
        className="text-center"
        style={{ color: colors.clayDeep, lineHeight: 20 }}
      >
        {title}
        {'\n'}
        {message}
      </Text>
      <Button
        className="mt-3"
        label={confirmLabel}
        variant="accent"
        disabled={disabled}
        onPress={onConfirm}
      />
      <Button
        className="mt-2"
        label="Cancel"
        variant="ghost"
        disabled={disabled}
        onPress={onCancel}
      />
    </View>
  );
}

function openPolicyUrl(url: string): Promise<boolean> {
  return openExternalHttpsUrl(url, {
    invalidTitle: 'Link not configured',
    invalidMessage: 'This policy URL must be configured before launch.',
    failureTitle: 'Link unavailable',
    failureMessage: 'We could not open this policy link. Please try again.',
    alertOnFailure: false,
  });
}

export default function YouScreen() {
  const { height, width } = useWindowDimensions();
  const params = useLocalSearchParams<{ section?: string }>();
  const { user, isAnonymous, signOut } = useAuth();
  const { enabled: lockEnabled, setEnabled: setLockEnabled } = useAppLock();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState<
    'marketing' | 'data_sharing' | 'photo_cloud_backup' | null
  >(null);
  const [privacyFeedback, setPrivacyFeedback] = useState<{
    key: PrivacyFeedbackKey;
    placement: PrivacyFeedbackPlacement;
    message: string;
  } | null>(null);
  const [savingAppLock, setSavingAppLock] = useState(false);
  const [cloudBackupNotice, setCloudBackupNotice] = useState<InlineNotice | null>(null);
  const [privacyActionFeedback, setPrivacyActionFeedback] = useState<InlineNotice | null>(null);
  const [exportFeedback, setExportFeedback] = useState<InlineNotice | null>(null);
  const [dataRightsFeedback, setDataRightsFeedback] = useState<InlineNotice | null>(null);
  const [confirmingDataRightsAction, setConfirmingDataRightsAction] =
    useState<PendingDataRightsAction | null>(null);
  const [policyFeedback, setPolicyFeedback] = useState<{
    key: PolicyLinkKey;
    message: string;
  } | null>(null);
  const [privacyCardReady, setPrivacyCardReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const privacyCardY = useRef(0);
  const savingPrivacyRef = useRef(false);
  const savingAppLockRef = useRef(false);

  const consents = useQuery({ queryKey: ['consents'], queryFn: getLatestConsents, retry: 0 });
  // The RESOLVED commerce data-sharing consent (ledger-if-present, else the local
  // flag). Both data-sharing surfaces read this so that offline (v1, no backend) a
  // sheet-granted consent shows ON, instead of the toggle reading the empty ledger
  // while the gate reads the local flag (docs/10 §6 cross-surface consistency).
  const commerceConsent = useQuery({
    queryKey: ['commerceConsent'],
    queryFn: isCommerceConsented,
    retry: 0,
  });
  const cloudBackup = useQuery({
    queryKey: ['photo_cloud_backup'],
    queryFn: getCloudBackupEnabled,
    retry: 0,
  });
  const { data: ent } = useEntitlement();
  const accountLabel = isAnonymous ? 'Guest (not saved)' : (user?.email ?? 'Signed in');
  const planLabel = ent?.inReverseTrial
    ? 'Exploring Pro'
    : ent?.inTrial
      ? 'Free trial · Pro'
      : ent?.isPro
        ? `${BRAND.proName} · active`
        : 'Free plan';
  const compactPhone = height < 640 || width < 430;
  const privacyDirectEntry = params.section === 'privacy';
  const narrowPhone = compactPhone && width < 360;
  const ultraShortPrivacyEntry = privacyDirectEntry && narrowPhone && height < 460;
  const privacyDirectEntryScrollNudge = ultraShortPrivacyEntry
    ? PRIVACY_DIRECT_ENTRY_ULTRA_SHORT_SCROLL_NUDGE
    : narrowPhone
      ? PRIVACY_DIRECT_ENTRY_NARROW_SCROLL_NUDGE
      : compactPhone
        ? PRIVACY_DIRECT_ENTRY_COMPACT_SCROLL_NUDGE
        : 0;
  const routineRows: { label: string; href: StaticRouteHref }[] = [
    { label: 'Your plan', href: '/routine/plan' },
    { label: 'Edit the order', href: '/routine/reorder' },
    { label: 'Retinoid ramp', href: '/routine/ramp' },
    { label: 'Streak & adherence', href: '/routine/streak' },
    { label: 'Weekly check-in', href: '/routine/tolerance' },
    { label: 'Recent changes', href: '/routine/adaptation' },
  ];
  if (phase7Flags.widgets) {
    routineRows.push({ label: 'Widgets & Live Activity', href: '/routine/widgets' });
  }
  const shortPhone = compactPhone && height < 600;
  const primaryRoutineRows = shortPhone
    ? routineRows.slice(0, 2)
    : compactPhone
      ? routineRows.slice(0, 3)
      : routineRows;
  const secondaryRoutineRows = shortPhone
    ? routineRows.slice(2)
    : compactPhone
      ? routineRows.slice(3)
      : [];

  useEffect(() => {
    if (!privacyDirectEntry || !privacyCardReady) return;

    const scrollToPrivacyCard = () => {
      scrollRef.current?.scrollTo({
        animated: false,
        y: Math.max(
          privacyCardY.current - PRIVACY_DIRECT_ENTRY_TOP_OFFSET + privacyDirectEntryScrollNudge,
          0,
        ),
      });
    };
    const frame = requestAnimationFrame(scrollToPrivacyCard);
    const retry = setTimeout(scrollToPrivacyCard, 180);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(retry);
    };
  }, [privacyDirectEntry, privacyCardReady, privacyDirectEntryScrollNudge]);

  const forYouRows: { label: string; href: StaticRouteHref; hint?: string }[] = [
    { label: 'Recommendations', href: '/recommendations' },
    { label: 'Recommendation preferences', href: '/recommendations/preferences' },
    {
      label: 'Skin Notes',
      href: '/community',
      hint: 'Myth vs evidence, reviewed and claim-safe.',
    },
  ];
  if (phase7Flags.cloudAsk) {
    forYouRows.unshift({
      label: BRAND.askName,
      href: '/ask',
      hint: 'Your evidence-grounded advisor.',
    });
  }
  if (phase7Flags.commerce) {
    forYouRows.push({ label: 'Shoppable routines', href: '/commerce/stacks' });
  }

  function renderPrivacyFeedback(key: PrivacyFeedbackKey, placement: PrivacyFeedbackPlacement) {
    if (privacyFeedback?.key !== key || privacyFeedback.placement !== placement) return null;

    return (
      <Text accessibilityRole="alert" variant="bodySm" tone="muted" className="pb-2 text-center">
        {PRIVACY_CHOICE_SAVE_FAILED_TITLE}
        {'\n'}
        {privacyFeedback.message}
      </Text>
    );
  }

  async function setConsent(
    type: 'marketing' | 'data_sharing',
    granted: boolean,
    placement: PrivacyFeedbackPlacement,
  ) {
    if (savingPrivacyRef.current) return;
    savingPrivacyRef.current = true;
    setSavingPrivacy(type);
    setPrivacyFeedback(null);
    setCloudBackupNotice(null);
    try {
      await applySettingsPrivacyChoice({
        save: async () => {
          if (type === 'data_sharing') {
            await setCommerceConsentLocal(granted);
          }
          // data_sharing IS the MHMDA third-party-sharing consent that gates "where to buy"
          // Keep the local-first commerce flag in sync so revoking here re-locks paid links
          // even before the backend exists (review fix, docs/10 §6 / D-061).
          try {
            await recordConsent({
              type,
              granted,
              version: CONSENT_COPY_VERSION,
              consentText: `[PLACEHOLDER ${type} consent. B-PRIVACY-COPY]`,
            });
          } catch (error) {
            if (type !== 'data_sharing') throw error;
          }
        },
        onSaved: () => {
          qc.setQueryData<Record<string, boolean>>(['consents'], (prev) => ({
            ...(prev ?? {}),
            [type]: granted,
          }));
          if (type === 'data_sharing') {
            qc.setQueryData<boolean>(['commerceConsent'], granted);
          }
          setPrivacyFeedback(null);
        },
        onFailure: () =>
          setPrivacyFeedback({ key: type, placement, message: privacyChoiceUserMessage() }),
        onSettled: async () => {
          await qc.invalidateQueries({ queryKey: ['consents'] });
          if (type === 'data_sharing') {
            await qc.invalidateQueries({ queryKey: ['commerceConsent'] });
          }
        },
      });
    } finally {
      savingPrivacyRef.current = false;
      setSavingPrivacy(null);
    }
  }

  async function setCloud(enabled: boolean) {
    if (savingPrivacyRef.current) return;
    savingPrivacyRef.current = true;
    setSavingPrivacy('photo_cloud_backup');
    setPrivacyFeedback(null);
    setCloudBackupNotice(null);
    try {
      await applySettingsPrivacyChoice({
        save: async () => {
          await setCloudBackupEnabled(enabled);
        },
        onSaved: () => {
          qc.setQueryData(['photo_cloud_backup'], enabled);
          if (enabled) {
            track('cloud_backup_opted_in');
            // Surface the device-loss tradeoff honestly when turning backup ON (docs/06 §6).
            setCloudBackupNotice({
              title: CLOUD_BACKUP_TRADEOFF_TITLE,
              message: PHOTO_COPY.lock.cloudTradeoff,
            });
          }
          setPrivacyFeedback(null);
        },
        onFailure: () =>
          setPrivacyFeedback({
            key: 'photo_cloud_backup',
            placement: 'security',
            message: privacyChoiceUserMessage(),
          }),
        onSettled: () => qc.invalidateQueries({ queryKey: ['photo_cloud_backup'] }),
      });
    } finally {
      savingPrivacyRef.current = false;
      setSavingPrivacy(null);
    }
  }

  async function setAppLockChoice(enabled: boolean) {
    if (savingAppLockRef.current) return;
    savingAppLockRef.current = true;
    setSavingAppLock(true);
    setPrivacyFeedback(null);
    try {
      await setLockEnabled(enabled);
      setPrivacyFeedback(null);
    } catch {
      setPrivacyFeedback({
        key: 'app_lock',
        placement: 'security',
        message: appLockUserMessage(),
      });
    } finally {
      savingAppLockRef.current = false;
      setSavingAppLock(false);
    }
  }

  const exportMut = useMutation({
    mutationFn: exportData,
    onMutate: () => {
      setExportFeedback(null);
      setDataRightsFeedback(null);
    },
    onSuccess: (shared) => {
      if (!shared) {
        setExportFeedback({
          title: EXPORT_UNAVAILABLE_TITLE,
          message: EXPORT_UNAVAILABLE_MESSAGE,
        });
        return;
      }
      void requestReviewAfterValue('data_export_success');
    },
    onError: () => {
      const message = dataRightsUserMessage();
      setExportFeedback({
        title: EXPORT_FAILED_TITLE,
        message,
      });
    },
  });

  async function openPolicyRow(row: (typeof POLICY_ROWS)[number]) {
    setPolicyFeedback(null);
    const opened = await openPolicyUrl(row.url);
    if (!opened) {
      setPolicyFeedback({ key: row.key, message: POLICY_LINK_UNAVAILABLE_MESSAGE });
    }
  }

  function nudgeDataRightsConfirmationIntoView() {
    const scrollToConfirmation = () => {
      scrollRef.current?.scrollTo({
        animated: true,
        y: Math.max(scrollY.current + DATA_RIGHTS_CONFIRMATION_SCROLL_NUDGE, 0),
      });
    };

    requestAnimationFrame(scrollToConfirmation);
    setTimeout(scrollToConfirmation, 80);
  }

  function promptWithdrawHealthData() {
    if (busy) return;
    setConfirmingDataRightsAction('withdraw_health_data');
    setPrivacyActionFeedback(null);
    setDataRightsFeedback(null);
    setExportFeedback(null);
    nudgeDataRightsConfirmationIntoView();
  }

  function promptDeleteAccount() {
    if (busy) return;
    setConfirmingDataRightsAction('delete_account');
    setPrivacyActionFeedback(null);
    setDataRightsFeedback(null);
    setExportFeedback(null);
    nudgeDataRightsConfirmationIntoView();
  }

  function cancelDataRightsConfirmation() {
    if (busy) return;
    setConfirmingDataRightsAction(null);
  }

  async function runWithdrawHealthData() {
    setBusy(true);
    setConfirmingDataRightsAction(null);
    setPrivacyActionFeedback(null);
    try {
      await withdrawHealthDataConsent();
      router.replace('/');
    } catch {
      setPrivacyActionFeedback({
        title: WITHDRAW_HEALTH_DATA_FAILED_TITLE,
        message: dataRightsUserMessage(),
      });
    } finally {
      setBusy(false);
    }
  }

  async function runDeleteAccount() {
    setBusy(true);
    setConfirmingDataRightsAction(null);
    setDataRightsFeedback(null);
    setExportFeedback(null);
    try {
      await deleteAccount();
      router.replace('/');
    } catch {
      setDataRightsFeedback({
        title: DELETE_ACCOUNT_FAILED_TITLE,
        message: dataRightsUserMessage(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactPhone ? 'pb-32' : 'pb-8'}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <Text variant="title" className={compactPhone ? 'mt-1' : 'mt-2'}>
          You
        </Text>

        <Card className={compactPhone ? 'mt-3 p-3' : 'mt-6'}>
          <Text variant="label" tone="muted">
            ACCOUNT
          </Text>
          {compactPhone ? (
            <View className="mt-1 min-h-[48px] flex-row items-center justify-between gap-3">
              <Text variant="body" className="flex-1 font-sans-medium">
                {accountLabel}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isAnonymous ? 'Create an account' : 'Sign out'}
                onPress={() => (isAnonymous ? router.push('/onboarding/account') : void signOut())}
                className="min-h-[48px] items-center justify-center rounded-pill px-4 py-2"
                style={({ pressed }) => [
                  { backgroundColor: colors.greige },
                  pressed ? { opacity: 0.82 } : undefined,
                ]}
              >
                <Text className="font-sans-semibold text-[13px]" style={{ color: colors.ink }}>
                  {isAnonymous ? 'Create' : 'Sign out'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text variant="body" className="mt-2 font-sans-medium">
                {accountLabel}
              </Text>
              {isAnonymous ? (
                <Button
                  className="mt-4"
                  label="Create an account"
                  onPress={() => router.push('/onboarding/account')}
                />
              ) : (
                <Button
                  className="mt-4"
                  label="Sign out"
                  variant="ghost"
                  onPress={() => void signOut()}
                />
              )}
            </>
          )}
        </Card>

        <Card className={compactPhone ? 'mt-2 p-3' : 'mt-4'}>
          <Text variant="label" tone="muted" className="mb-1">
            SUBSCRIPTION
          </Text>
          <Row
            label="Manage subscription"
            hint={planLabel}
            compact={compactPhone}
            onPress={() => router.push('/settings/subscription')}
          />
        </Card>

        <Card className={compactPhone ? 'mt-2 p-3' : 'mt-4'}>
          <Text variant="label" tone="muted" className="mb-1">
            YOUR ROUTINE
          </Text>
          {primaryRoutineRows.map(({ label, href }) => (
            <Row
              key={href}
              label={label}
              compact={compactPhone}
              onPress={() => router.push(href)}
            />
          ))}
        </Card>

        {secondaryRoutineRows.length > 0 ? (
          <Card
            className="p-3"
            style={{
              marginTop: shortPhone
                ? SHORT_PHONE_SECONDARY_ROUTINE_TOP_MARGIN
                : COMPACT_SECONDARY_ROUTINE_TOP_MARGIN,
            }}
          >
            <Text variant="label" tone="muted" className="mb-1">
              MORE ROUTINE
            </Text>
            {secondaryRoutineRows.map(({ label, href }) => (
              <Row
                key={href}
                label={label}
                compact={compactPhone}
                onPress={() => router.push(href)}
              />
            ))}
          </Card>
        ) : null}

        <Card
          className={compactPhone ? undefined : 'mt-4'}
          style={compactPhone ? { marginTop: COMPACT_FOR_YOU_TOP_MARGIN } : undefined}
        >
          <Text variant="label" tone="muted" className="mb-1">
            FOR YOU
          </Text>
          {forYouRows.map(({ label, href, hint }) => (
            <Row key={href} label={label} hint={hint} onPress={() => router.push(href)} />
          ))}
        </Card>

        {phase7Flags.commerce ? (
          <Card className="mt-4">
            <Text variant="label" tone="muted" className="mb-1">
              WHERE TO BUY
            </Text>
            <Row
              label="How we stay honest"
              hint="Why recommendations and money stay separate. And every paid link is disclosed."
              onPress={() => router.push('/commerce/transparency')}
            />
            <Row
              label="Share data with partners (where-to-buy)"
              hint="Off by default. A separate, revocable MHMDA choice. Turn off and we won’t show paid links."
            >
              <Toggle
                accessibilityLabel="Share data with partners for where-to-buy"
                value={commerceConsent.data ?? false}
                disabled={savingPrivacy === 'data_sharing'}
                onChange={(v) => void setConsent('data_sharing', v, 'commerce')}
              />
            </Row>
            {renderPrivacyFeedback('data_sharing', 'commerce')}
          </Card>
        ) : null}

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            SECURITY
          </Text>
          <Row
            label="App lock"
            hint="Require your phone's unlock to open the app and your photo timeline."
          >
            <Toggle
              accessibilityLabel="App lock"
              value={lockEnabled}
              disabled={savingAppLock}
              onChange={(v) => void setAppLockChoice(v)}
            />
          </Row>
          {renderPrivacyFeedback('app_lock', 'security')}
          <Row
            label="Encrypted cloud backup"
            hint="Off by default. A separate choice. Photos stay on this phone until you turn it on."
          >
            <Toggle
              accessibilityLabel="Encrypted cloud backup"
              value={cloudBackup.data ?? false}
              disabled={savingPrivacy === 'photo_cloud_backup'}
              onChange={(v) => void setCloud(v)}
            />
          </Row>
          {cloudBackupNotice ? <InlineNoticeCard notice={cloudBackupNotice} /> : null}
          {renderPrivacyFeedback('photo_cloud_backup', 'security')}
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            REMINDERS
          </Text>
          <Row
            label="Reminders & notifications"
            hint="Tiered, capped, at times you choose. Quiet hours & lock-screen discretion."
            onPress={() => router.push('/settings/notifications')}
          />
        </Card>

        <Card
          className="mt-4"
          onLayout={(event) => {
            privacyCardY.current = event.nativeEvent.layout.y;
            setPrivacyCardReady(true);
          }}
        >
          <Text variant="label" tone="muted" className="mb-1">
            PRIVACY &amp; CONSENT
          </Text>
          <Row
            label="Marketing emails"
            hint={ultraShortPrivacyEntry ? undefined : 'Off by default. Opt in anytime.'}
          >
            <Toggle
              accessibilityLabel="Marketing emails"
              value={consents.data?.marketing ?? false}
              disabled={savingPrivacy === 'marketing'}
              onChange={(v) => void setConsent('marketing', v, 'privacy')}
            />
          </Row>
          {renderPrivacyFeedback('marketing', 'privacy')}
          {phase7Flags.commerce ? (
            <>
              <Row
                label="Share data with partners"
                hint="Separate from collection (MHMDA). Off by default."
              >
                <Toggle
                  accessibilityLabel="Share data with partners"
                  value={commerceConsent.data ?? false}
                  disabled={savingPrivacy === 'data_sharing'}
                  onChange={(v) => void setConsent('data_sharing', v, 'privacy')}
                />
              </Row>
              {renderPrivacyFeedback('data_sharing', 'privacy')}
            </>
          ) : null}
          <Row
            label="Photos & the no-AI-score promise"
            compact={compactPhone}
            onPress={() => router.push('/progress/about')}
          />
          {phase7Flags.trend ? (
            <Row
              label="Changes in your own photos"
              hint="Optional · on-device · off by default · no score, ever."
              onPress={() => router.push('/trend/optin')}
            />
          ) : null}
          {phase7Flags.cloudAsk ? (
            <Row
              label={`${BRAND.askName}. Private advisor`}
              hint="Optional · the deeper cloud advisor · off by default. The on-device answers about your own shelf are always free."
              onPress={() => router.push('/ask/consent')}
            />
          ) : null}
          <Row
            label="Withdraw health-data consent"
            hint={
              ultraShortPrivacyEntry
                ? undefined
                : compactPhone
                  ? 'Records withdrawal and deletes collected health data.'
                  : 'Records your withdrawal in the consent ledger and deletes your collected health data.'
            }
            compact={compactPhone}
            onPress={promptWithdrawHealthData}
          />
          {confirmingDataRightsAction === 'withdraw_health_data' ? (
            <InlineConfirmCard
              title={WITHDRAW_HEALTH_DATA_CONFIRM_TITLE}
              message={WITHDRAW_HEALTH_DATA_CONFIRM_MESSAGE}
              confirmLabel={busy ? 'Working...' : 'Withdraw & delete'}
              disabled={busy}
              onCancel={cancelDataRightsConfirmation}
              onConfirm={() => void runWithdrawHealthData()}
            />
          ) : null}
          {privacyActionFeedback ? (
            <InlineNoticeCard notice={privacyActionFeedback} className="mt-3" />
          ) : null}
        </Card>

        <Card
          className={compactPhone && privacyDirectEntry ? undefined : 'mt-4'}
          style={
            compactPhone && privacyDirectEntry
              ? { marginTop: PRIVACY_DIRECT_ENTRY_COMPACT_POLICY_MARGIN }
              : undefined
          }
        >
          <Text variant="label" tone="muted" className="mb-1">
            POLICIES
          </Text>
          {POLICY_ROWS.map((row) => (
            <Fragment key={row.key}>
              <Row
                label={row.label}
                hint={ultraShortPrivacyEntry ? undefined : POLICY_HINTS[row.key]}
                compact={compactPhone}
                onPress={() => void openPolicyRow(row)}
              />
              {policyFeedback?.key === row.key ? (
                <Text
                  accessibilityRole="alert"
                  variant="bodySm"
                  tone="muted"
                  className="pb-2 text-center"
                >
                  {policyFeedback.message}
                </Text>
              ) : null}
            </Fragment>
          ))}
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            YOUR DATA
          </Text>
          <Button
            className="mt-2"
            label={exportMut.isPending ? 'Preparing...' : 'Export my data'}
            variant="ghost"
            disabled={exportMut.isPending}
            onPress={() => exportMut.mutate()}
          />
          <Button
            className="mt-2"
            label="Delete account"
            variant="ghost"
            disabled={busy}
            onPress={promptDeleteAccount}
          />
          {confirmingDataRightsAction === 'delete_account' ? (
            <InlineConfirmCard
              title={DELETE_ACCOUNT_CONFIRM_TITLE}
              message={DELETE_ACCOUNT_CONFIRM_MESSAGE}
              confirmLabel={busy ? 'Working...' : 'Delete'}
              disabled={busy}
              onCancel={cancelDataRightsConfirmation}
              onConfirm={() => void runDeleteAccount()}
            />
          ) : null}
          {dataRightsFeedback ? (
            <InlineNoticeCard notice={dataRightsFeedback} className="mt-3" />
          ) : null}
          {exportFeedback ? <InlineNoticeCard notice={exportFeedback} className="mt-3" /> : null}
          <Text variant="bodySm" tone="muted" className="mt-3 text-center">
            Photos stay on your device by default. No ads, no data sales.
          </Text>
        </Card>

        {/* Standing not-medical-advice disclaimer (docs/02 §9). */}
        <Text variant="bodySm" tone="muted" className="mt-5 px-2 text-center text-[12px]">
          {NOT_MEDICAL_ADVICE}
        </Text>
      </ScrollView>
    </Screen>
  );
}
