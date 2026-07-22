import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { validLocalDate } from './freshness';

export function LocalDateField({
  label,
  value,
  onChangeDate,
  minDate,
  maxDate,
  disabled = false,
}: {
  label: string;
  value: string | null;
  onChangeDate: (date: string | null) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value ?? '');

  const normalized = validLocalDate(text);
  const inRange =
    normalized != null &&
    (minDate == null || normalized >= minDate) &&
    (maxDate == null || normalized <= maxDate);
  const showError = text.length === 10 && !inRange;

  return (
    <View className="w-full">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        value={text}
        editable={!disabled}
        onChangeText={(next) => {
          setText(next);
          const date = validLocalDate(next);
          const validRange =
            date != null &&
            (minDate == null || date >= minDate) &&
            (maxDate == null || date <= maxDate);
          onChangeDate(validRange ? date : null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={10}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.mutedLight}
        className="mt-1 min-h-[48px] rounded-[12px] border border-hairline bg-paper px-3.5 py-2.5 font-mono text-[15px] text-ink"
      />
      {showError ? (
        <Text accessibilityRole="alert" variant="label" tone="clay" className="mt-1">
          Enter a real date{maxDate ? ' no later than today' : ''}.
        </Text>
      ) : null}
    </View>
  );
}
