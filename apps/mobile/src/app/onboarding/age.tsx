import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import {
  getDobValidationError,
  isValidDob,
  meetsMinimumAge,
  MINIMUM_AGE,
} from '@/features/onboarding/ageGate';
import { readAgeVerification, setAgeVerified } from '@/features/onboarding/ageGateStore';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';

const AGE_VERIFICATION_STORAGE_COPY = {
  loading: 'Checking your age confirmation...',
  eyebrow: 'Private age confirmation',
  title: 'Age confirmation unavailable',
  body: "We couldn't safely read the age confirmation saved on this phone. Nothing was reset or removed. Try again when private storage is available.",
  retry: 'Try again',
  retrying: 'Trying again...',
  retryFailed: 'The saved confirmation is still unavailable. Nothing was changed.',
  saveFailed:
    "We couldn't save your age confirmation. Your birth date was not stored. Try again when private storage is available.",
} as const;

type VerificationStatus = 'checking' | 'ready' | 'error';

// 01b · Neutral age gate (docs/01 §4). We ask for a date of birth (never "are you
// over X?", which invites falsification) BEFORE any health-data collection, and
// block under-threshold users. We persist only that the gate passed, never the
// DOB itself (data minimization). Final threshold / parental-consent path: counsel.
function DobField({
  label,
  accessibilityLabel,
  value,
  onChange,
  max,
  placeholder,
  grow,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder: string;
  grow?: number;
}) {
  return (
    <View style={{ flex: grow ?? 1 }}>
      <Text variant="label" tone="muted" className="mb-2">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, max))}
        placeholder={placeholder}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={max}
        className="rounded-card border border-hairline bg-paper-raised px-4 py-4 text-center font-mono text-2xl text-ink"
      />
    </View>
  );
}

export default function AgeGateScreen() {
  const { fontScale = 1, height, width } = useWindowDimensions();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('checking');
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const verificationRequestId = useRef(0);
  const saveRequestId = useRef(0);
  const supportFloorTextPressurePhone =
    width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPhone = height < 640 || supportFloorTextPressurePhone;

  const checkAgeVerification = useCallback(async (reason: 'initial' | 'retry') => {
    const requestId = ++verificationRequestId.current;
    const fromRetry = reason === 'retry';
    setRetryFailed(false);
    if (fromRetry) setRetrying(true);
    else setVerificationStatus('checking');

    try {
      const result = await readAgeVerification();
      if (verificationRequestId.current !== requestId) return;

      if (result.status === 'available' && result.value) {
        router.replace('/onboarding/goals');
        return;
      }
      if (result.status === 'absent' || result.status === 'available') {
        setVerificationStatus('ready');
        return;
      }
      setRetryFailed(fromRetry);
      setVerificationStatus('error');
    } catch {
      if (verificationRequestId.current !== requestId) return;
      setRetryFailed(fromRetry);
      setVerificationStatus('error');
    } finally {
      if (verificationRequestId.current === requestId) setRetrying(false);
    }
  }, []);

  // Skip if a prior session already passed the gate (don't re-ask on re-entry).
  useEffect(() => {
    const timer = setTimeout(() => void checkAgeVerification('initial'), 0);
    return () => {
      clearTimeout(timer);
      verificationRequestId.current += 1;
      saveRequestId.current += 1;
    };
  }, [checkAgeVerification]);

  const dob = { year: Number(year), month: Number(month), day: Number(day) };
  const complete = day.length > 0 && month.length > 0 && year.length === 4;
  const today = new Date();
  const valid = complete && isValidDob(dob, today);
  const validationError = getDobValidationError(dob, today, complete);

  function edit(setter: (v: string) => void) {
    return (v: string) => {
      setBlocked(false);
      setter(v);
    };
  }

  async function submit() {
    if (saving) return;
    track('screen_viewed', { screen_name: 'age_gate' });
    if (meetsMinimumAge(dob, today)) {
      const requestId = ++saveRequestId.current;
      setSaveFailed(false);
      setSaving(true);
      try {
        await setAgeVerified();
        if (saveRequestId.current !== requestId) return;
        router.replace('/onboarding/goals');
      } catch {
        if (saveRequestId.current === requestId) setSaveFailed(true);
      } finally {
        if (saveRequestId.current === requestId) setSaving(false);
      }
    } else {
      setBlocked(true);
    }
  }

  if (verificationStatus === 'checking') {
    return (
      <Screen>
        <View
          accessibilityLabel={AGE_VERIFICATION_STORAGE_COPY.loading}
          accessibilityLiveRegion="polite"
          className="flex-1 items-center justify-center"
        >
          <Text variant="bodySm" tone="muted" className="text-center">
            {AGE_VERIFICATION_STORAGE_COPY.loading}
          </Text>
        </View>
      </Screen>
    );
  }

  if (verificationStatus === 'error') {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text variant="label" tone="clay" className="text-center">
              {AGE_VERIFICATION_STORAGE_COPY.eyebrow}
            </Text>
            <Text variant="title" className="mt-3 text-center">
              {AGE_VERIFICATION_STORAGE_COPY.title}
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-3 text-center">
              {AGE_VERIFICATION_STORAGE_COPY.body}
            </Text>
            {retryFailed ? (
              <Text variant="bodySm" className="mt-3 text-center">
                {AGE_VERIFICATION_STORAGE_COPY.retryFailed}
              </Text>
            ) : null}
          </View>
          <Button
            accessibilityLabel="Retry age confirmation"
            className="mt-7 min-h-[56px]"
            disabled={retrying}
            label={
              retrying
                ? AGE_VERIFICATION_STORAGE_COPY.retrying
                : AGE_VERIFICATION_STORAGE_COPY.retry
            }
            onPress={() => void checkAgeVerification('retry')}
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName={compactPhone ? 'pb-28 pt-6' : 'pb-8 pt-10'}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="title" style={compactPhone ? { fontSize: 26, lineHeight: 30 } : undefined}>
            First, your{' '}
            <Text
              variant="title"
              italic
              tone="clay"
              style={compactPhone ? { fontSize: 26, lineHeight: 30 } : undefined}
            >
              date of birth.
            </Text>
          </Text>
          <Text
            variant="body"
            tone="muted"
            className="mt-3"
            style={compactPhone ? { fontSize: 14, lineHeight: 20 } : undefined}
          >
            {compactPhone
              ? `${BRAND.appName} confirms your age before skin-health data. We don't store your birth date.`
              : `${BRAND.appName} handles skin-health information, so we confirm your age before we begin. We don't store your birth date.`}
          </Text>

          <View className={compactPhone ? 'mt-5 flex-row gap-2' : 'mt-8 flex-row gap-3'}>
            <DobField
              label="DAY"
              accessibilityLabel="Day of birth"
              value={day}
              onChange={edit(setDay)}
              max={2}
              placeholder="DD"
            />
            <DobField
              label="MONTH"
              accessibilityLabel="Month of birth"
              value={month}
              onChange={edit(setMonth)}
              max={2}
              placeholder="MM"
            />
            <DobField
              label="YEAR"
              accessibilityLabel="Year of birth"
              value={year}
              onChange={edit(setYear)}
              max={4}
              placeholder="YYYY"
              grow={1.4}
            />
          </View>

          {saveFailed ? (
            <Text variant="bodySm" tone="clay" className="mt-5" accessibilityRole="alert">
              {AGE_VERIFICATION_STORAGE_COPY.saveFailed}
            </Text>
          ) : validationError || blocked ? (
            <Text variant="bodySm" tone="clay" className="mt-5" accessibilityRole="alert">
              {validationError ?? `You need to be at least ${MINIMUM_AGE} to use ${BRAND.appName}.`}
            </Text>
          ) : null}
        </ScrollView>
      </View>

      <View className="bg-paper pb-4 pt-2">
        <Button
          label={saving ? 'Saving...' : 'Continue'}
          disabled={!valid || saving}
          onPress={() => void submit()}
        />
      </View>
    </Screen>
  );
}
