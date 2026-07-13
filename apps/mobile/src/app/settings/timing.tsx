import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { REMINDER_COPY, SETTINGS_COPY } from '@/features/notifications/copy';
import { useNotifPrefs, useUpdateNotifPrefs } from '@/features/notifications/useNotifications';
import { BRAND } from '@/lib/brand';
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
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetMaxHeight = Math.max(0, viewportHeight - 44);
  const listMaxHeight = Math.min(340, Math.max(160, sheetMaxHeight - 115));
  const sheetPaddingBottom = insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;
  const title =
    field === 'am'
      ? 'Morning reminder'
      : field === 'pm'
        ? 'Evening reminder'
        : field === 'qstart'
          ? 'Quiet hours start'
          : 'Quiet hours end';
  return (
    <Modal
      visible={field !== null}
      transparent
      animationType="slide"
      accessibilityLabel={title}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(32,27,21,0.4)' }}>
        <Pressable
          className="flex-1"
          accessibilityLabel="Dismiss time picker"
          accessibilityRole="button"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          className="rounded-t-sheet bg-paper px-6 pb-10 pt-4"
          style={
            sheetPaddingBottom === undefined
              ? { maxHeight: sheetMaxHeight }
              : { maxHeight: sheetMaxHeight, paddingBottom: sheetPaddingBottom }
          }
        >
          <View
            className="mx-auto mb-4 h-[5px] w-10 rounded-[3px]"
            style={{ backgroundColor: 'rgba(32,27,21,0.15)' }}
          />
          <Text variant="titleSm" className="mb-3">
            {title}
          </Text>
          <ScrollView style={{ maxHeight: listMaxHeight }} showsVerticalScrollIndicator={false}>
            {TIMES.map((t) => {
              const formattedTime = fmtTime(t);
              const sel = t === value;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}, ${formattedTime}`}
                  accessibilityHint={`Sets ${title.toLowerCase()} to ${formattedTime}`}
                  accessibilityState={{ selected: sel }}
                  onPress={() => onSelect(t)}
                  className="min-h-[48px] flex-row items-center justify-between py-2.5"
                >
                  <Text
                    variant="body"
                    style={{ color: sel ? colors.clay : colors.ink }}
                    className={sel ? 'font-sans-semibold' : undefined}
                  >
                    {formattedTime}
                  </Text>
                  {sel ? <Text style={{ color: colors.clay }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TimePill({
  accessibilityLabel,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens time picker"
      onPress={onPress}
      className="min-h-[48px] min-w-[72px] items-center justify-center rounded-[8px] px-3 py-1.5"
      style={{ backgroundColor: colors.greigeChip }}
    >
      <Text className="font-mono-medium" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TimingScreen() {
  const { height } = useWindowDimensions();
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
  const amTimeLabel = fmtTime(p.amTime);
  const pmTimeLabel = fmtTime(p.pmTime);
  const quietStartTimeLabel = fmtTime(p.quietStart ?? '22:00');
  const quietEndTimeLabel = fmtTime(p.quietEnd ?? '07:00');
  const compactTiming = height < 460;
  const splitShortTiming = height < 380;

  function choose(hm: string) {
    if (picking) update.mutate({ [fieldKey[picking]]: hm } as Parameters<typeof update.mutate>[0]);
    setPicking(null);
  }

  const discreetBody = REMINDER_COPY.pm_step.discreet;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactTiming ? 'px-5 pb-8' : 'px-5 pb-10'}
      >
        <View
          className={
            compactTiming
              ? 'mb-1 flex-row items-center gap-2 pt-0'
              : 'mb-3 flex-row items-center gap-3 pt-1'
          }
        >
          <RouteIconButton
            accessibilityLabel="Back"
            onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
          />
          <Text variant="title" style={{ fontSize: compactTiming ? 26 : 28 }}>
            Timing
          </Text>
        </View>

        {/* time pickers */}
        <View className="rounded-[18px] bg-paper-raised px-[18px]">
          <View
            className={
              compactTiming
                ? 'min-h-[48px] flex-row items-center justify-between py-0'
                : 'flex-row items-center justify-between py-3.5'
            }
            style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(32,27,21,0.06)' }}
          >
            <Text variant="body" className="font-sans-semibold">
              Morning
            </Text>
            <TimePill
              accessibilityLabel={`Morning reminder time, ${amTimeLabel}`}
              label={amTimeLabel}
              onPress={() => setPicking('am')}
            />
          </View>
          <View
            className={
              compactTiming
                ? 'min-h-[48px] flex-row items-center justify-between py-0'
                : 'flex-row items-center justify-between py-3.5'
            }
          >
            <Text variant="body" className="font-sans-semibold">
              Evening
            </Text>
            <TimePill
              accessibilityLabel={`Evening reminder time, ${pmTimeLabel}`}
              label={pmTimeLabel}
              onPress={() => setPicking('pm')}
            />
          </View>
        </View>

        {/* quiet hours */}
        <Text
          variant="label"
          tone="muted"
          className={
            splitShortTiming
              ? 'mb-1 ml-2 mt-2'
              : compactTiming
                ? 'mb-1.5 ml-2 mt-3'
                : 'mb-2 ml-2 mt-5'
          }
          style={{ fontSize: compactTiming ? 9.5 : 10, letterSpacing: 1 }}
        >
          QUIET HOURS
        </Text>
        <View
          className={
            compactTiming
              ? 'rounded-[18px] bg-paper-raised px-[18px] py-2'
              : 'rounded-[18px] bg-paper-raised px-[18px] py-4'
          }
        >
          <View
            className={compactTiming ? 'gap-2' : 'gap-3'}
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <Text
              variant="body"
              className="font-sans-semibold"
              style={{ flexShrink: 1, minWidth: 0 }}
            >
              {SETTINGS_COPY.quietLabel}
            </Text>
            <View className="flex-row items-center gap-2">
              <TimePill
                accessibilityLabel={`Quiet hours start, ${quietStartTimeLabel}`}
                label={quietStartTimeLabel}
                onPress={() => setPicking('qstart')}
              />
              <Text tone="muted">→</Text>
              <TimePill
                accessibilityLabel={`Quiet hours end, ${quietEndTimeLabel}`}
                label={quietEndTimeLabel}
                onPress={() => setPicking('qend')}
              />
            </View>
          </View>
          <Text
            variant="bodySm"
            tone="muted"
            className={compactTiming ? 'mt-1 text-[12px]' : 'mt-2'}
            style={compactTiming ? { lineHeight: 15 } : undefined}
          >
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
                  {BRAND.appName}
                </Text>
                <Text
                  style={{
                    color: 'rgba(244,239,231,0.7)',
                    fontSize: 12,
                    fontFamily: 'HankenGrotesk-Regular',
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
