import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { REMINDER_COPY, SETTINGS_COPY } from '@/features/notifications/copy';
import { useNotifPrefs, useUpdateNotifPrefs } from '@/features/notifications/useNotifications';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

import { fmtTime } from './notifications';

// Timing, quiet hours & lock-screen discretion (docs/07 §3.4/§3.6, design screen 03).
// Times use a calm 30-minute picker (no native date-picker dependency, the D-030
// convention). Health-adjacent content stays generic on the lock screen.

const TIMES: string[] = [];
for (let h = 0; h < 24; h++)
  for (const m of [0, 30])
    TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

type Field = 'am' | 'pm' | 'qstart' | 'qend';

function TimePickerModal({
  field,
  value,
  onSelect,
  onClose,
}: {
  field: Field | null;
  value: string;
  onSelect: (hm: string) => void;
  onClose: () => void;
}) {
  const title =
    field === 'am'
      ? 'Morning reminder'
      : field === 'pm'
        ? 'Evening reminder'
        : field === 'qstart'
          ? 'Quiet hours start'
          : 'Quiet hours end';
  return (
    <Modal visible={field !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(32,27,21,0.4)' }}
        onPress={onClose}
      >
        <Pressable className="rounded-t-sheet bg-paper px-6 pb-10 pt-4" onPress={() => {}}>
          <View
            className="mx-auto mb-4 h-[5px] w-10 rounded-[3px]"
            style={{ backgroundColor: 'rgba(32,27,21,0.15)' }}
          />
          <Text variant="titleSm" className="mb-3">
            {title}
          </Text>
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {TIMES.map((t) => {
              const sel = t === value;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  onPress={() => onSelect(t)}
                  className="flex-row items-center justify-between py-2.5"
                >
                  <Text
                    variant="body"
                    style={{ color: sel ? colors.clay : colors.ink }}
                    className={sel ? 'font-sans-semibold' : undefined}
                  >
                    {fmtTime(t)}
                  </Text>
                  {sel ? <Text style={{ color: colors.clay }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TimePill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-[8px] px-3 py-1.5"
      style={{ backgroundColor: colors.greigeChip }}
    >
      <Text className="font-mono-medium" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TimingScreen() {
  const { data: p } = useNotifPrefs();
  const update = useUpdateNotifPrefs();
  const [picking, setPicking] = useState<Field | null>(null);
  if (!p) return null;

  const fieldKey: Record<Field, keyof typeof p> = {
    am: 'amTime',
    pm: 'pmTime',
    qstart: 'quietStart',
    qend: 'quietEnd',
  };
  const currentValue = picking ? ((p[fieldKey[picking]] as string | null) ?? '22:00') : '22:00';

  function choose(hm: string) {
    if (picking) update.mutate({ [fieldKey[picking]]: hm } as Parameters<typeof update.mutate>[0]);
    setPicking(null);
  }

  const discreetBody = REMINDER_COPY.pm_step.discreet;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-10">
        <View className="mb-3 flex-row items-center gap-3 pt-1">
          <Text
            accessibilityRole="button"
            onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
            variant="body"
            style={{ fontSize: 22 }}
          >
            ‹
          </Text>
          <Text variant="title" style={{ fontSize: 28 }}>
            Timing
          </Text>
        </View>

        {/* time pickers */}
        <View className="rounded-[18px] bg-paper-raised px-[18px]">
          <View
            className="flex-row items-center justify-between py-3.5"
            style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(32,27,21,0.06)' }}
          >
            <Text variant="body" className="font-sans-semibold">
              Morning
            </Text>
            <TimePill label={fmtTime(p.amTime)} onPress={() => setPicking('am')} />
          </View>
          <View className="flex-row items-center justify-between py-3.5">
            <Text variant="body" className="font-sans-semibold">
              Evening
            </Text>
            <TimePill label={fmtTime(p.pmTime)} onPress={() => setPicking('pm')} />
          </View>
        </View>

        {/* quiet hours */}
        <Text
          variant="label"
          tone="muted"
          className="mb-2 ml-2 mt-5"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          QUIET HOURS
        </Text>
        <View className="rounded-[18px] bg-paper-raised px-[18px] py-4">
          <View className="flex-row items-center justify-between">
            <Text variant="body" className="font-sans-semibold">
              {SETTINGS_COPY.quietLabel}
            </Text>
            <View className="flex-row items-center gap-2">
              <TimePill
                label={fmtTime(p.quietStart ?? '22:00')}
                onPress={() => setPicking('qstart')}
              />
              <Text tone="muted">→</Text>
              <TimePill label={fmtTime(p.quietEnd ?? '07:00')} onPress={() => setPicking('qend')} />
            </View>
          </View>
          <Text variant="bodySm" tone="muted" className="mt-2">
            Nothing fires inside this window. Even your routine reminders wait until morning.
          </Text>
        </View>

        {/* lock-screen discretion */}
        <Text
          variant="label"
          tone="muted"
          className="mb-2 ml-2 mt-5"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          LOCK SCREEN
        </Text>
        <View className="rounded-[18px] bg-paper-raised px-[18px]">
          <View
            className="flex-row items-center justify-between py-3.5"
            style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(32,27,21,0.06)' }}
          >
            <View className="flex-1 pr-3">
              <Text variant="body" className="font-sans-semibold">
                {SETTINGS_COPY.discreetLabel}
              </Text>
              <Text variant="bodySm" tone="muted">
                {SETTINGS_COPY.discreetHint}
              </Text>
            </View>
            <View
              className="rounded-[8px] px-3 py-1.5"
              style={{ backgroundColor: colors.greigeChip }}
            >
              <Text className="font-sans-semibold" style={{ color: colors.clay, fontSize: 13 }}>
                On
              </Text>
            </View>
          </View>
          {/* discreet preview */}
          <View className="py-3.5">
            <View
              className="flex-row items-center gap-2.5 rounded-[12px] p-3"
              style={{ backgroundColor: '#16130F' }}
            >
              <View className="h-6 w-6 rounded-[7px]" style={{ backgroundColor: colors.clay }} />
              <View className="flex-1">
                <Text className="font-sans-bold" style={{ color: colors.cream, fontSize: 12.5 }}>
                  OnSkin
                </Text>
                <Text
                  style={{
                    color: 'rgba(244,239,231,0.7)',
                    fontSize: 12,
                    fontFamily: 'HankenGrotesk_400Regular',
                  }}
                >
                  {discreetBody}
                </Text>
              </View>
            </View>
            <Text
              variant="label"
              tone="muted"
              className="mt-2 text-center"
              style={{ fontSize: 11 }}
            >
              Always generic on the lock screen
            </Text>
          </View>
        </View>
      </ScrollView>

      <TimePickerModal
        field={picking}
        value={currentValue}
        onSelect={choose}
        onClose={() => setPicking(null)}
      />
    </SafeAreaView>
  );
}
