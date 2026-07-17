import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, RouteIconButton, Screen, StateLoading, Text } from '@/components/ui';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { useAuth } from '@/lib/auth/AuthProvider';
import { localDiagnosticsAccessEnabled } from '@/lib/diagnostics/localDiagnosticsAccess';
import {
  loadLocalDiagnostics,
  type LocalDiagnosticsSnapshot,
} from '@/lib/diagnostics/localDiagnostics';
import { createLocalDiagnosticsDependencies } from '@/lib/diagnostics/localDiagnosticsRuntime';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

function displayValue(value: string): string {
  return value.replaceAll('_', ' ');
}

function DiagnosticsRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="min-h-[48px] flex-row items-center justify-between border-b border-hairline py-3"
    >
      <Text variant="bodySm" tone="muted" className="mr-4 flex-1">
        {label}
      </Text>
      <Text variant="bodySm" className="max-w-[58%] text-right font-mono">
        {value}
      </Text>
    </View>
  );
}

function DiagnosticsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-4">
      <Text variant="label" tone="muted" className="mb-1">
        {title}
      </Text>
      {children}
    </Card>
  );
}

export default function LocalDiagnosticsScreen() {
  const accessEnabled = localDiagnosticsAccessEnabled();
  const { user } = useAuth();
  const { appUnlocked, enabled: appLockEnabled } = useAppLock();
  const [snapshot, setSnapshot] = useState<LocalDiagnosticsSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const deps = useMemo(
    () =>
      createLocalDiagnosticsDependencies({
        userId: user?.id ?? null,
        appLockEnabled,
        appUnlocked,
      }),
    [appLockEnabled, appUnlocked, user?.id],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!accessEnabled) return;
    const id = ++requestId.current;
    setRefreshing(true);
    const next = await loadLocalDiagnostics(deps);
    if (!mounted.current || requestId.current !== id) return;
    setSnapshot(next);
    setRefreshing(false);
  }, [accessEnabled, deps]);

  useEffect(() => {
    if (!accessEnabled) return;
    const id = ++requestId.current;
    void loadLocalDiagnostics(deps).then((next) => {
      if (!mounted.current || requestId.current !== id) return;
      setSnapshot(next);
    });
  }, [accessEnabled, deps]);

  if (!accessEnabled) return <Redirect href="/(tabs)/you" />;

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center justify-between py-3">
        <RouteIconButton
          accessibilityLabel="Back to You"
          onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
        />
        <Text variant="titleSm" className="font-sans-semibold">
          Local diagnostics
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {!snapshot ? (
        <StateLoading label="Reading content-free health" className="mt-10" />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
          accessibilityLabel="Content-free local diagnostics"
        >
          <View
            accessibilityRole="summary"
            className="rounded-[16px] border border-hairline px-4 py-3"
            style={{ backgroundColor: colors.paperRaised }}
          >
            <Text variant="bodySm" className="font-sans-semibold">
              Development only · fixed schema v{snapshot.schemaVersion}
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              Counts and health enums only. No keys, tokens, IDs, filenames, record values, or
              search text.
            </Text>
          </View>

          <DiagnosticsCard title="BUILD">
            <DiagnosticsRow label="Environment" value={snapshot.build.environment} />
            <DiagnosticsRow label="Release" value={snapshot.build.releaseVersion} />
            <DiagnosticsRow label="Build" value={snapshot.build.buildVersion} />
            <DiagnosticsRow label="Runtime" value={snapshot.build.runtimeVersion} />
            <DiagnosticsRow
              label="Symbol config"
              value={displayValue(snapshot.build.symbolConfig)}
            />
          </DiagnosticsCard>

          <DiagnosticsCard title="PRIVACY & STORAGE">
            <DiagnosticsRow
              label="Account generation"
              value={snapshot.accountGenerationPrefix}
            />
            <DiagnosticsRow label="Vault" value={displayValue(snapshot.vault)} />
            <DiagnosticsRow label="App lock" value={displayValue(snapshot.appLock)} />
            <DiagnosticsRow
              label="Free-space class"
              value={displayValue(snapshot.storageFreeSpace)}
            />
            <DiagnosticsRow
              label="Photo journal"
              value={`${displayValue(snapshot.photoJournal.status)} · ${snapshot.photoJournal.pending} pending`}
            />
          </DiagnosticsCard>

          <DiagnosticsCard title="SYNC & CACHE">
            <DiagnosticsRow
              label="Outbox model"
              value={displayValue(snapshot.outbox.model)}
            />
            <DiagnosticsRow
              label="Outbox counts"
              value={`${snapshot.outbox.ready} ready · ${snapshot.outbox.inFlight} in flight · ${snapshot.outbox.dead} dead`}
            />
            <DiagnosticsRow
              label="Last sync"
              value={`${displayValue(snapshot.lastSync.result)} · ${snapshot.lastSync.at ?? 'none'}`}
            />
            <DiagnosticsRow
              label="Query cache"
              value={`${snapshot.queryCache.total} total · ${snapshot.queryCache.active} active · ${snapshot.queryCache.fetching} fetching · ${snapshot.queryCache.stale} stale`}
            />
          </DiagnosticsCard>

          <DiagnosticsCard title="SERVICES">
            <DiagnosticsRow
              label="Notifications"
              value={`${displayValue(snapshot.notifications.permission)} · ${displayValue(snapshot.notifications.schedule)}`}
            />
            <DiagnosticsRow
              label="Catalog gateway"
              value={displayValue(snapshot.catalogEndpoint)}
            />
          </DiagnosticsCard>

          <DiagnosticsCard title="RECENT TIMINGS">
            {snapshot.timings.length === 0 ? (
              <DiagnosticsRow label="Samples" value="none" />
            ) : (
              snapshot.timings.map((timing) => (
                <DiagnosticsRow
                  key={timing.name}
                  label={displayValue(timing.name)}
                  value={`${timing.count} samples · ${timing.errorCount} errors · p50 ${timing.p50Ms} ms · p95 ${timing.p95Ms} ms`}
                />
              ))
            )}
          </DiagnosticsCard>

          <DiagnosticsRow label="Captured" value={snapshot.capturedAt} />
          <Button
            className="mt-5"
            label={refreshing ? 'Refreshing...' : 'Refresh diagnostics'}
            disabled={refreshing}
            onPress={() => void refresh()}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
