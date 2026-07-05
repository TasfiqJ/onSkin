import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import {
  getDobValidationError,
  isValidDob,
  meetsMinimumAge,
  MINIMUM_AGE,
} from '@/features/onboarding/ageGate';
import { getAgeVerified, setAgeVerified } from '@/features/onboarding/ageGateStore';
import { track } from '@/lib/analytics/track';

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
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  // Skip if a prior session already passed the gate (don't re-ask on re-entry).
  useEffect(() => {
    let active = true;
    void getAgeVerified().then((ok) => {
      if (!active) return;
      if (ok) router.replace('/onboarding/goals');
      else setChecked(true);
    });
    return () => {
      active = false;
    };
  }, []);

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
    track('screen_viewed', { screen_name: 'age_gate' });
    if (meetsMinimumAge(dob, today)) {
      await setAgeVerified();
      router.replace('/onboarding/goals');
    } else {
      setBlocked(true);
    }
  }

  // Render nothing while deciding whether to skip (avoids a flash of the form).
  if (!checked) return null;

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text variant="title">
          First, your{' '}
          <Text variant="title" italic tone="clay">
            date of birth.
          </Text>
        </Text>
        <Text variant="body" tone="muted" className="mt-3">
          OnSkin handles skin-health information, so we confirm your age before we begin. We don’t
          store your birth date.
        </Text>

        <View className="mt-8 flex-row gap-3">
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

        {validationError || blocked ? (
          <Text variant="bodySm" tone="clay" className="mt-5" accessibilityRole="alert">
            {validationError ?? `You need to be at least ${MINIMUM_AGE} to use OnSkin.`}
          </Text>
        ) : null}
      </View>

      <View className="pb-4">
        <Button label="Continue" disabled={!valid} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
