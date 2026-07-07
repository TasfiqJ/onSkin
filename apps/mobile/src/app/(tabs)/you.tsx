import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

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

const EXPORT_UNAVAILABLE_MESSAGE =
  "We couldn't open the export sheet on this device. The temporary export file was removed.";
const COMPACT_FOR_YOU_TOP_MARGIN = 240;

type StaticRouteHref = Extract<Href, string>;

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
        <Text variant="body" className="font-sans-medium">
          {label}
        </Text>
        {hint ? (
          <Text variant="bodySm" tone="muted" className="mt-0.5">
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
        accessibilityLabel={label}
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

function openPolicyUrl(url: string) {
  void openExternalHttpsUrl(url, {
    invalidTitle: 'Link not configured',
    invalidMessage: 'This policy URL must be configured before launch.',
    failureTitle: 'Link unavailable',
    failureMessage: 'We could not open this policy link. Please try again.',
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
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [privacyCardReady, setPrivacyCardReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const privacyCardY = useRef(0);
  const savingPrivacyRef = useRef(false);

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
    if (params.section !== 'privacy' || !privacyCardReady) return;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: false,
        y: Math.max(privacyCardY.current - 16, 0),
      });
    });
  }, [params.section, privacyCardReady]);

  const forYouRows: { label: string; href: StaticRouteHref }[] = [
    { label: 'Recommendations', href: '/recommendations' },
    { label: 'Recommendation preferences', href: '/recommendations/preferences' },
    { label: 'Skin Notes. Myth vs evidence', href: '/community' },
  ];
  if (phase7Flags.cloudAsk) {
    forYouRows.unshift({ label: `${BRAND.askName}. Your evidence-grounded advisor`, href: '/ask' });
  }
  if (phase7Flags.commerce) {
    forYouRows.push({ label: 'Shoppable routines', href: '/commerce/stacks' });
  }

  async function setConsent(type: 'marketing' | 'data_sharing', granted: boolean) {
    if (savingPrivacyRef.current) return;
    savingPrivacyRef.current = true;
    setSavingPrivacy(type);
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
        },
        onFailure: () => Alert.alert('Choice not saved', privacyChoiceUserMessage()),
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
            Alert.alert('Encrypted cloud backup', PHOTO_COPY.lock.cloudTradeoff, [
              { text: 'Got it' },
            ]);
          }
        },
        onFailure: () => Alert.alert('Choice not saved', privacyChoiceUserMessage()),
        onSettled: () => qc.invalidateQueries({ queryKey: ['photo_cloud_backup'] }),
      });
    } finally {
      savingPrivacyRef.current = false;
      setSavingPrivacy(null);
    }
  }

  const exportMut = useMutation({
    mutationFn: exportData,
    onMutate: () => setExportFeedback(null),
    onSuccess: (shared) => {
      if (!shared) {
        setExportFeedback(EXPORT_UNAVAILABLE_MESSAGE);
        Alert.alert('Export unavailable', EXPORT_UNAVAILABLE_MESSAGE);
        return;
      }
      void requestReviewAfterValue('data_export_success');
    },
    onError: () => {
      const message = dataRightsUserMessage();
      setExportFeedback(message);
      Alert.alert('Export failed', message);
    },
  });

  function confirmWithdrawHealthData() {
    Alert.alert(
      'Withdraw health-data consent?',
      'This records your withdrawal and deletes your collected health data. Your account and routine are closed. Apple or Google subscription billing continues until you cancel in the store.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw & delete',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            withdrawHealthDataConsent()
              .then(() => router.replace('/'))
              .catch(() => Alert.alert('Withdrawal failed', dataRightsUserMessage()))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and data. Apple or Google subscription billing continues until you cancel in the store.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            deleteAccount()
              .then(() => router.replace('/'))
              .catch(() => Alert.alert('Deletion failed', dataRightsUserMessage()))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactPhone ? 'pb-32' : 'pb-8'}
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
          <Card className="mt-12 p-3">
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
          {forYouRows.map(({ label, href }) => (
            <Row key={href} label={label} onPress={() => router.push(href)} />
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
                onChange={(v) => void setConsent('data_sharing', v)}
              />
            </Row>
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
              onChange={(v) =>
                void setLockEnabled(v).catch(() => Alert.alert('App lock', appLockUserMessage()))
              }
            />
          </Row>
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
          <Row label="Marketing emails" hint="Off by default. Opt in anytime.">
            <Toggle
              accessibilityLabel="Marketing emails"
              value={consents.data?.marketing ?? false}
              disabled={savingPrivacy === 'marketing'}
              onChange={(v) => void setConsent('marketing', v)}
            />
          </Row>
          {phase7Flags.commerce ? (
            <Row
              label="Share data with partners"
              hint="Separate from collection (MHMDA). Off by default."
            >
              <Toggle
                accessibilityLabel="Share data with partners"
                value={commerceConsent.data ?? false}
                disabled={savingPrivacy === 'data_sharing'}
                onChange={(v) => void setConsent('data_sharing', v)}
              />
            </Row>
          ) : null}
          <Row
            label="Photos & the no-AI-score promise"
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
            hint="Records your withdrawal in the consent ledger and deletes your collected health data."
            onPress={confirmWithdrawHealthData}
          />
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            POLICIES
          </Text>
          {POLICY_ROWS.map((row) => (
            <Row
              key={row.key}
              label={row.label}
              hint={POLICY_HINTS[row.key]}
              onPress={() => openPolicyUrl(row.url)}
            />
          ))}
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            YOUR DATA
          </Text>
          <Button
            className="mt-2"
            label={exportMut.isPending ? 'Preparing…' : 'Export my data'}
            variant="ghost"
            disabled={exportMut.isPending}
            onPress={() => exportMut.mutate()}
          />
          <Button
            className="mt-2"
            label="Delete account"
            variant="ghost"
            disabled={busy}
            onPress={confirmDelete}
          />
          {exportFeedback ? (
            <Text
              accessibilityRole="alert"
              variant="bodySm"
              tone="muted"
              className="mt-3 text-center"
            >
              {exportFeedback}
            </Text>
          ) : null}
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
