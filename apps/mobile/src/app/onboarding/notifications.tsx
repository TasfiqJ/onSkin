import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, ProgressBar, Screen, Text } from '@/components/ui';
import { SOFT_ASK } from '@/features/notifications/copy';
import { NotificationPreferenceSaveError } from '@/features/notifications/applyPreferences';
import {
  acceptRoutineReminderSoftAsk,
  declineRoutineReminderSoftAsk,
  PROPOSED_ROUTINE_REMINDER_TIMES,
  retryRoutineReminderSoftAsk,
} from '@/features/notifications/onboarding';
import type { NotifPrefs } from '@/features/notifications/store';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { subscribeActiveHealthProcessingLeaseChanges } from '@/lib/consent/healthProcessingEpoch';
import { colors } from '@/theme/tokens';

function CheckRow({ label }: { label: string }) {
  return (
    <View className="flex-row items-start gap-3 py-2">
      <View
        className="mt-0.5 h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.sageTint }}
      >
        <Text style={{ color: colors.sageDeep, fontSize: 11, lineHeight: 13 }}>✓</Text>
      </View>
      <Text variant="bodySm" className="flex-1" style={{ color: colors.inkSoft }}>
        {label}
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const [busy, setBusy] = useState(false);
  const admitted = useRef(false);
  const focused = useRef(false);
  const navigated = useRef(false);
  const authority = useRef<ReturnType<typeof captureHealthDataWriteLease> | null>(null);
  const [retired, setRetired] = useState(false);
  const [notice, setNotice] = useState<{
    body: string;
    saved: boolean;
    offUnconfirmed?: boolean;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      navigated.current = false;
      setNotice(null);
      try {
        authority.current = captureHealthDataWriteLease();
        setRetired(false);
      } catch {
        authority.current = null;
        setRetired(true);
      }
      const unsubscribe = subscribeActiveHealthProcessingLeaseChanges(() => {
        try {
          if (!authority.current) throw new Error('closed');
          assertHealthDataWriteLease(authority.current);
        } catch {
          authority.current = null;
          setNotice(null);
          setRetired(true);
        }
      });
      return () => {
        focused.current = false;
        authority.current = null;
        unsubscribe();
      };
    }, []),
  );

  function assertCurrent() {
    if (!focused.current || navigated.current || !authority.current)
      throw new Error('ONBOARDING_REMINDER_RETIRED');
    assertHealthDataWriteLease(authority.current);
  }

  function continueToAccount() {
    if (admitted.current) return;
    try {
      assertCurrent();
    } catch {
      if (focused.current) setRetired(true);
      return;
    }
    navigated.current = true;
    router.push('/onboarding/account');
  }

  function allOff(prefs: NotifPrefs) {
    return (
      !prefs.amEnabled &&
      !prefs.pmEnabled &&
      !prefs.captureReminders &&
      !prefs.streakNudges &&
      !prefs.replenishmentAlerts &&
      !prefs.liveActivityEnabled &&
      !prefs.promotionalOptIn
    );
  }

  async function finish(choice: 'enable' | 'off' | 'retry' | 'continue-off') {
    if (admitted.current || navigated.current) return;
    try {
      assertCurrent();
    } catch {
      if (focused.current) setRetired(true);
      return;
    }
    // Capture the exact focus/health window before the first await.
    const accepted = authority.current!;
    const assertLifecycle = () => {
      assertCurrent();
      assertHealthDataWriteLease(accepted);
    };
    admitted.current = true;
    setBusy(true);
    setNotice(null);
    try {
      let body: string;
      if (choice === 'enable') {
        const outcome = await acceptRoutineReminderSoftAsk(
          PROPOSED_ROUTINE_REMINDER_TIMES,
          undefined,
          assertLifecycle,
        );
        body =
          outcome.state === 'unavailable'
            ? 'Reminders are unavailable here. Your choice is saved as off.'
            : outcome.state === 'denied' || outcome.state === 'not_determined'
              ? 'Reminders are off. Your choice was saved.'
              : 'Your reminder choice was saved. Notification delivery is not guaranteed.';
      } else if (choice === 'retry') {
        const result = await retryRoutineReminderSoftAsk(undefined, assertLifecycle);
        body = allOff(result.prefs)
          ? 'Reminders are off. Your current choice was saved.'
          : 'Your current reminder choice was saved. Notification delivery is not guaranteed.';
      } else {
        await declineRoutineReminderSoftAsk(undefined, assertLifecycle);
        body = 'Reminders are off. Your choice was saved.';
      }
      assertLifecycle();
      if (choice === 'continue-off') {
        navigated.current = true;
        router.push('/onboarding/account');
      } else setNotice({ body, saved: true });
    } catch (error) {
      try {
        assertLifecycle();
      } catch {
        return;
      }
      if (error instanceof NotificationPreferenceSaveError) {
        const offUnconfirmed = allOff(error.prefs);
        if (choice === 'continue-off' && offUnconfirmed) {
          // Explicitly acknowledged fallback: OFF is durable under this lease,
          // while cancellation/delivery remains unconfirmed as the UI stated.
          navigated.current = true;
          router.push('/onboarding/account');
        } else
          setNotice({
            saved: false,
            offUnconfirmed,
            body: offUnconfirmed
              ? 'Your off choice is saved, but delivery is unconfirmed. Existing reminders may remain. You can retry or continue with delivery unconfirmed.'
              : 'Your choice is saved, but reminders are unconfirmed. Retry the current saved choice or turn reminders off.',
          });
      } else
        setNotice({
          saved: false,
          body: 'We could not save your reminder choice. Check the current choice and retry, or try turning reminders off.',
        });
    } finally {
      admitted.current = false;
      if (focused.current) setBusy(false);
    }
  }

  function enable() {
    void finish('enable');
  }

  function skip() {
    void finish('off');
  }

  return (
    <Screen>
      <View className="pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <Text variant="label" tone="muted">
            SETUP
          </Text>
          <Text variant="label" tone="muted">
            4 OF 5
          </Text>
        </View>
        <ProgressBar total={5} current={4} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="py-5"
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="mb-6 h-14 w-14 items-center justify-center rounded-[19px]"
          style={{ backgroundColor: colors.clayTint }}
        >
          <View className="h-4 w-4 rounded-full" style={{ backgroundColor: colors.clay }} />
        </View>
        <Text variant="title">{SOFT_ASK.title}</Text>
        <Text variant="body" tone="muted" className="mt-3">
          {SOFT_ASK.body}
        </Text>

        <Card className="mt-6 px-4 py-3">
          {SOFT_ASK.bullets.map((bullet, index) => (
            <View key={bullet}>
              {index > 0 ? <View className="h-px bg-hairline" /> : null}
              <CheckRow label={bullet} />
            </View>
          ))}
        </Card>
      </ScrollView>

      <ScrollView
        style={{ flexGrow: 0, flexShrink: 1 }}
        contentContainerClassName="pb-4"
        keyboardShouldPersistTaps="handled"
      >
        {retired ? (
          <>
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" variant="bodySm">
              Your privacy choice changed. Return to privacy before continuing.
            </Text>
            <Button
              label="Return to privacy"
              onPress={() => router.replace('/onboarding/consent')}
            />
          </>
        ) : (
          <>
            {notice ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                variant="bodySm"
                className="mb-3"
              >
                {notice.body}
              </Text>
            ) : null}
            <Button
              label={
                notice?.saved
                  ? 'Continue'
                  : notice
                    ? 'Check current choice and retry'
                    : SOFT_ASK.yes
              }
              onPress={
                notice?.saved
                  ? continueToAccount
                  : notice
                    ? () => {
                        void finish('retry');
                      }
                    : enable
              }
              disabled={busy}
            />
            {notice?.offUnconfirmed ? (
              <Button
                label="Continue with delivery unconfirmed"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  void finish('continue-off');
                }}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              className="mt-2 min-h-[48px] items-center justify-center py-3"
              disabled={busy}
              onPress={skip}
            >
              <Text variant="body" tone="muted" className="font-sans-semibold">
                {notice ? 'Turn reminders off' : SOFT_ASK.no}
              </Text>
            </Pressable>
          </>
        )}
        <Text variant="bodySm" tone="muted" className="mt-1 text-center text-[11.5px]">
          You can change this anytime in You → Reminders.
        </Text>
      </ScrollView>
    </Screen>
  );
}
