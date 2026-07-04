import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { isCommerceConsented } from '@/features/commerce/consent';
import { setCommerceConsentLocal } from '@/features/commerce/store';
import { CONSENT_COPY_VERSION } from '@/features/onboarding/consentCopy';
import { getCloudBackupEnabled, setCloudBackupEnabled } from '@/features/photos/consent';
import { PHOTO_COPY } from '@/features/photos/copy';
import { requestReviewAfterValue } from '@/features/review/prompt';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { deleteAccount, exportData, withdrawHealthDataConsent } from '@/features/settings/actions';
import { track } from '@/lib/analytics/track';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getLatestConsents, recordConsent } from '@/lib/consent/consent';
import { NOT_MEDICAL_ADVICE } from '@/lib/legal/disclaimer';
import { type PolicyLinkKey, policyLinkRows } from '@/lib/legal/policyLinks';
import { phase7Flags } from '@/lib/launch/phase7';
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
  terms: 'Rules for using OnSkin and subscription terms.',
  privacy: 'What data we collect, use, and share.',
  consumerHealthPrivacy: 'Consumer health data notice and rights.',
  support: 'Help with accounts, billing, deletion, or export.',
  accountDeletion: 'How account deletion works before and after deleting in app.',
  dataExport: 'How to request and read your export.',
};

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between py-3">
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
      {children}
    </View>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.clay, false: colors.greigeDeep }}
      thumbColor={colors.paperRaised}
    />
  );
}

function openPolicyUrl(url: string) {
  if (!url) {
    Alert.alert('Link not configured', 'This policy URL must be configured before launch.');
    return;
  }
  void WebBrowser.openBrowserAsync(url).catch(() => {});
}

export default function YouScreen() {
  const { user, isAnonymous, signOut } = useAuth();
  const { enabled: lockEnabled, setEnabled: setLockEnabled } = useAppLock();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

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
  const planLabel = ent?.inReverseTrial
    ? 'Exploring Pro'
    : ent?.inTrial
      ? 'Free trial · Pro'
      : ent?.isPro
        ? 'OnSkin Pro · active'
        : 'Free plan';
  const routineRows: { label: string; href: string }[] = [
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

  const forYouRows: { label: string; href: string }[] = [
    { label: 'Recommendations', href: '/recommendations' },
    { label: 'Recommendation preferences', href: '/recommendations/preferences' },
    { label: 'Skin Notes. Myth vs evidence', href: '/community' },
  ];
  if (phase7Flags.cloudAsk) {
    forYouRows.unshift({ label: 'Ask OnSkin. Your evidence-grounded advisor', href: '/ask' });
  }
  if (phase7Flags.commerce) {
    forYouRows.push({ label: 'Shoppable routines', href: '/commerce/stacks' });
  }

  async function setConsent(type: 'marketing' | 'data_sharing', granted: boolean) {
    qc.setQueryData<Record<string, boolean>>(['consents'], (prev) => ({
      ...(prev ?? {}),
      [type]: granted,
    }));
    // data_sharing IS the MHMDA third-party-sharing consent that gates "where to buy"
    //. Keep the local-first commerce flag in sync so revoking here re-locks paid links
    // even before the backend exists (review fix, docs/10 §6 / D-061).
    if (type === 'data_sharing') {
      qc.setQueryData<boolean>(['commerceConsent'], granted); // optimistic, both surfaces
      await setCommerceConsentLocal(granted);
      await qc.invalidateQueries({ queryKey: ['commerceConsent'] });
    }
    try {
      await recordConsent({
        type,
        granted,
        version: CONSENT_COPY_VERSION,
        consentText: `[PLACEHOLDER ${type} consent. B-PRIVACY-COPY]`,
      });
    } catch {
      /* best-effort until backend configured */
    }
  }

  async function setCloud(enabled: boolean) {
    qc.setQueryData(['photo_cloud_backup'], enabled);
    if (enabled) {
      track('cloud_backup_opted_in');
      // Surface the device-loss tradeoff honestly when turning backup ON (docs/06 §6).
      Alert.alert('Encrypted cloud backup', PHOTO_COPY.lock.cloudTradeoff, [{ text: 'Got it' }]);
    }
    try {
      await setCloudBackupEnabled(enabled);
    } catch {
      /* best-effort */
    }
  }

  const exportMut = useMutation({
    mutationFn: exportData,
    onSuccess: () => {
      void requestReviewAfterValue('data_export_success');
    },
    onError: (e) =>
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Please try again.'),
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
              .catch((e: unknown) =>
                Alert.alert(
                  'Withdrawal failed',
                  e instanceof Error ? e.message : 'Please try again.',
                ),
              )
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
              .catch((e: unknown) =>
                Alert.alert(
                  'Deletion failed',
                  e instanceof Error ? e.message : 'Please try again.',
                ),
              )
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <Text variant="title" className="mt-2">
          You
        </Text>

        <Card className="mt-6">
          <Text variant="label" tone="muted">
            ACCOUNT
          </Text>
          <Text variant="body" className="mt-2 font-sans-medium">
            {isAnonymous ? 'Guest (not saved)' : (user?.email ?? 'Signed in')}
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
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            SUBSCRIPTION
          </Text>
          <Row label="Manage subscription" hint={planLabel}>
            <Text
              variant="body"
              tone="muted"
              onPress={() => router.push('/settings/subscription')}
              accessibilityRole="button"
              style={{ fontSize: 18 }}
            >
              ›
            </Text>
          </Row>
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            YOUR ROUTINE
          </Text>
          {routineRows.map(({ label, href }) => (
            <Row key={href} label={label}>
              <Text
                variant="body"
                tone="muted"
                onPress={() => router.push(href)}
                accessibilityRole="button"
                style={{ fontSize: 18 }}
              >
                ›
              </Text>
            </Row>
          ))}
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            FOR YOU
          </Text>
          {forYouRows.map(({ label, href }) => (
            <Row key={href} label={label}>
              <Text
                variant="body"
                tone="muted"
                onPress={() => router.push(href)}
                accessibilityRole="button"
                style={{ fontSize: 18 }}
              >
                ›
              </Text>
            </Row>
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
          >
            <Text
              variant="body"
              tone="muted"
              onPress={() => router.push('/commerce/transparency')}
              accessibilityRole="button"
              style={{ fontSize: 18 }}
            >
              ›
            </Text>
          </Row>
          <Row
            label="Share data with partners (where-to-buy)"
            hint="Off by default. A separate, revocable MHMDA choice. Turn off and we won’t show paid links."
          >
            <Toggle
              value={commerceConsent.data ?? false}
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
            label="Face ID app lock"
            hint="Require unlock to open the app and your photo timeline."
          >
            <Toggle
              value={lockEnabled}
              onChange={(v) =>
                void setLockEnabled(v).catch((e: unknown) =>
                  Alert.alert('App lock', e instanceof Error ? e.message : 'Not available.'),
                )
              }
            />
          </Row>
          <Row
            label="Encrypted cloud backup"
            hint="Off by default. A separate choice. Photos stay on this phone until you turn it on."
          >
            <Toggle value={cloudBackup.data ?? false} onChange={(v) => void setCloud(v)} />
          </Row>
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            REMINDERS
          </Text>
          <Row
            label="Reminders & notifications"
            hint="Tiered, capped, at times you choose. Quiet hours & lock-screen discretion."
          >
            <Text
              variant="body"
              tone="muted"
              onPress={() => router.push('/settings/notifications')}
              accessibilityRole="button"
              style={{ fontSize: 18 }}
            >
              ›
            </Text>
          </Row>
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            PRIVACY &amp; CONSENT
          </Text>
          <Row label="Marketing emails" hint="Off by default. Opt in anytime.">
            <Toggle
              value={consents.data?.marketing ?? false}
              onChange={(v) => void setConsent('marketing', v)}
            />
          </Row>
          {phase7Flags.commerce ? (
            <Row
              label="Share data with partners"
              hint="Separate from collection (MHMDA). Off by default."
            >
              <Toggle
                value={commerceConsent.data ?? false}
                onChange={(v) => void setConsent('data_sharing', v)}
              />
            </Row>
          ) : null}
          <Row label="Photos & the no-AI-score promise">
            <Text
              variant="body"
              tone="muted"
              onPress={() => router.push('/progress/about')}
              accessibilityRole="button"
              style={{ fontSize: 18 }}
            >
              ›
            </Text>
          </Row>
          {phase7Flags.trend ? (
            <Row
              label="Changes in your own photos"
              hint="Optional · on-device · off by default · no score, ever."
            >
              <Text
                variant="body"
                tone="muted"
                onPress={() => router.push('/trend/optin')}
                accessibilityRole="button"
                style={{ fontSize: 18 }}
              >
                ›
              </Text>
            </Row>
          ) : null}
          {phase7Flags.cloudAsk ? (
            <Row
              label="Ask OnSkin. Private advisor"
              hint="Optional · the deeper cloud advisor · off by default. The on-device answers about your own shelf are always free."
            >
              <Text
                variant="body"
                tone="muted"
                onPress={() => router.push('/ask/consent')}
                accessibilityRole="button"
                style={{ fontSize: 18 }}
              >
                ›
              </Text>
            </Row>
          ) : null}
          <Row
            label="Withdraw health-data consent"
            hint="Records your withdrawal in the consent ledger and deletes your collected health data."
          >
            <Text
              variant="body"
              tone="muted"
              onPress={confirmWithdrawHealthData}
              accessibilityRole="button"
              style={{ fontSize: 18 }}
            >
              ›
            </Text>
          </Row>
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            POLICIES
          </Text>
          {POLICY_ROWS.map((row) => (
            <Row key={row.key} label={row.label} hint={POLICY_HINTS[row.key]}>
              <Text
                variant="body"
                tone="muted"
                onPress={() => openPolicyUrl(row.url)}
                accessibilityRole="button"
                style={{ fontSize: 18 }}
              >
                &gt;
              </Text>
            </Row>
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
