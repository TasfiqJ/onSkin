import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { CONSENT_COPY_VERSION } from '@/features/onboarding/consentCopy';
import { getCloudBackupEnabled, setCloudBackupEnabled } from '@/features/photos/consent';
import { deleteAccount, exportData } from '@/features/settings/actions';
import { track } from '@/lib/analytics/track';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getLatestConsents, recordConsent } from '@/lib/consent/consent';
import { colors } from '@/theme/tokens';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

export default function YouScreen() {
  const { user, isAnonymous, signOut } = useAuth();
  const { enabled: lockEnabled, setEnabled: setLockEnabled } = useAppLock();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const consents = useQuery({ queryKey: ['consents'], queryFn: getLatestConsents, retry: 0 });
  const cloudBackup = useQuery({ queryKey: ['photo_cloud_backup'], queryFn: getCloudBackupEnabled, retry: 0 });

  async function setConsent(type: 'marketing' | 'data_sharing', granted: boolean) {
    qc.setQueryData<Record<string, boolean>>(['consents'], (prev) => ({ ...(prev ?? {}), [type]: granted }));
    try {
      await recordConsent({
        type,
        granted,
        version: CONSENT_COPY_VERSION,
        consentText: `[PLACEHOLDER ${type} consent — B-PRIVACY-COPY]`,
      });
    } catch {
      /* best-effort until backend configured */
    }
  }

  async function setCloud(enabled: boolean) {
    qc.setQueryData(['photo_cloud_backup'], enabled);
    if (enabled) track('cloud_backup_opted_in');
    try {
      await setCloudBackupEnabled(enabled);
    } catch {
      /* best-effort */
    }
  }

  const exportMut = useMutation({
    mutationFn: exportData,
    onError: (e) => Alert.alert('Export failed', e instanceof Error ? e.message : 'Please try again.'),
  });

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and data. App Store billing continues until you cancel your subscription.',
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
                Alert.alert('Deletion failed', e instanceof Error ? e.message : 'Please try again.'),
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
            <Button className="mt-4" label="Create an account" onPress={() => router.push('/onboarding/account')} />
          ) : (
            <Button className="mt-4" label="Sign out" variant="ghost" onPress={() => void signOut()} />
          )}
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            YOUR ROUTINE
          </Text>
          {(
            [
              ['Your plan', '/routine/plan'],
              ['Edit the order', '/routine/reorder'],
              ['Retinoid ramp', '/routine/ramp'],
              ['Streak & adherence', '/routine/streak'],
              ['This week’s check-in', '/routine/tolerance'],
              ['Recent changes', '/routine/adaptation'],
              ['Widgets & Live Activity', '/routine/widgets'],
            ] as const
          ).map(([label, href]) => (
            <Row key={href} label={label}>
              <Text
                variant="body"
                tone="muted"
                onPress={() => router.push(href)}
                accessibilityRole="button"
                style={{ fontSize: 18 }}>
                ›
              </Text>
            </Row>
          ))}
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            SECURITY
          </Text>
          <Row label="Face ID app lock" hint="Require unlock to open the app and your photo timeline.">
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
            hint="Off by default — a separate choice. Photos stay on this phone until you turn it on.">
            <Toggle value={cloudBackup.data ?? false} onChange={(v) => void setCloud(v)} />
          </Row>
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            REMINDERS
          </Text>
          <Row label="Reminders & notifications" hint="Tiered, capped, at times you choose. Quiet hours & lock-screen discretion.">
            <Text
              variant="body"
              tone="muted"
              onPress={() => router.push('/settings/notifications')}
              accessibilityRole="button"
              style={{ fontSize: 18 }}>
              ›
            </Text>
          </Row>
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted" className="mb-1">
            PRIVACY &amp; CONSENT
          </Text>
          <Row label="Marketing emails" hint="Off by default. Opt in anytime.">
            <Toggle value={consents.data?.marketing ?? false} onChange={(v) => void setConsent('marketing', v)} />
          </Row>
          <Row label="Share data with partners" hint="Separate from collection (MHMDA). Off by default.">
            <Toggle value={consents.data?.data_sharing ?? false} onChange={(v) => void setConsent('data_sharing', v)} />
          </Row>
          <Row label="Photos & the no-AI-score promise">
            <Text
              variant="body"
              tone="muted"
              onPress={() => router.push('/progress/about')}
              accessibilityRole="button"
              style={{ fontSize: 18 }}>
              ›
            </Text>
          </Row>
          <Text variant="bodySm" tone="muted" className="mt-1">
            Withdraw health-data consent from the privacy policy screen — your data is then deleted.
          </Text>
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
          <Button className="mt-2" label="Delete account" variant="ghost" disabled={busy} onPress={confirmDelete} />
          <Text variant="bodySm" tone="muted" className="mt-3 text-center">
            Photos stay on your device by default. No ads, no data sales.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
