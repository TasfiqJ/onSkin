import { VALUES_FILTERS, type BudgetBand, type ValuesFilter } from '@onskin/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { applyRecommendationPreferences } from '@/features/recommendations/applyPreferences';
import {
  BUDGET_LABEL,
  FORMAT_LABEL,
  REC_COPY,
  VALUES_LABEL,
} from '@/features/recommendations/copy';
import { DEFAULT_PREFERENCES, type RecPreferences } from '@/features/recommendations/preferences';
import { loadPreferences, savePreferences } from '@/features/recommendations/store';
import { track } from '@/lib/analytics/track';
import { APP_RECOMMENDATIONS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Preferences (docs/09 §8, §11). The values / format / budget filters. Honest
// personalisation: they shape *what fits you*, never *what sells*. The engine is
// type-first and WEIGHTS these in the fit score; the hard product-level exclusion
// (a fragrance-averse user never seeing a fragranced product) lands with the
// curated catalog (B-CATALOG-SEED), so the copy says "prioritise", not "never".

const BUDGETS: BudgetBand[] = ['drugstore', 'mid', 'premium'];
const FORMATS = ['gel', 'cream', 'fluid', 'balm', 'oil'];

function Toggle({
  label,
  active,
  disabled,
  fill = false,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  fill?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-[48px] items-center justify-center rounded-pill px-4 py-2.5"
      style={{
        backgroundColor: active ? colors.ink : colors.paperRaised,
        borderWidth: 1,
        borderColor: active ? colors.ink : colors.hairlineStrong,
        flexBasis: fill ? 0 : undefined,
        flexGrow: fill ? 1 : undefined,
        minWidth: fill ? 0 : undefined,
        opacity: disabled ? 0.58 : 1,
        paddingHorizontal: fill ? 8 : undefined,
      }}
    >
      <Text
        className="font-sans-medium text-[13.5px]"
        numberOfLines={1}
        style={{
          color: active ? colors.paper : colors.inkSoft,
          fontSize: fill ? 12 : undefined,
          lineHeight: fill ? 16 : undefined,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function PreferencesScreen() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['recPreferences'],
    queryFn: loadPreferences,
  });
  const p = prefs ?? DEFAULT_PREFERENCES;
  const controlsDisabled = isLoading || saving;

  const commit = async (next: RecPreferences) => {
    if (controlsDisabled) return;
    haptics.select();
    setSaving(true);
    try {
      await applyRecommendationPreferences(next, {
        save: savePreferences,
        onSaved: async () => {
          qc.setQueryData(['recPreferences'], next);
          track('preference_set');
          // The For-you hub reads prefs+dismissals together. Refresh it too.
          await qc.invalidateQueries({ queryKey: ['recPrefsAndDismissed'] });
        },
        onFailure: () =>
          Alert.alert(REC_COPY.preferences.saveFailedTitle, REC_COPY.preferences.saveFailedBody),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleValue = (v: ValuesFilter) =>
    commit({
      ...p,
      values: p.values.includes(v) ? p.values.filter((x) => x !== v) : [...p.values, v],
    });
  const setBudget = (b: BudgetBand) => commit({ ...p, budget: p.budget === b ? null : b });
  const toggleFormat = (f: string) =>
    commit({
      ...p,
      formats: p.formats.includes(f) ? p.formats.filter((x) => x !== f) : [...p.formats, f],
    });

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_RECOMMENDATIONS_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold" tone="muted">
          Preferences
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <Text variant="title" className="mt-2">
          {REC_COPY.preferences.title}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1.5">
          {REC_COPY.preferences.subtitle}
        </Text>

        <Text variant="label" tone="muted" className="mb-3 mt-7">
          {REC_COPY.preferences.valuesLabel.toUpperCase()}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {VALUES_FILTERS.map((v) => (
            <Toggle
              key={v}
              label={VALUES_LABEL[v] ?? v}
              active={p.values.includes(v)}
              disabled={controlsDisabled}
              onPress={() => void toggleValue(v)}
            />
          ))}
        </View>

        <Text variant="label" tone="muted" className="mb-3 mt-7">
          {REC_COPY.preferences.budgetLabel.toUpperCase()}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <Toggle
              key={b}
              fill
              label={BUDGET_LABEL[b] ?? b}
              active={p.budget === b}
              disabled={controlsDisabled}
              onPress={() => void setBudget(b)}
            />
          ))}
        </View>

        <Text variant="label" tone="muted" className="mb-3 mt-7">
          {REC_COPY.preferences.formatLabel.toUpperCase()}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {FORMATS.map((f) => (
            <Toggle
              key={f}
              label={FORMAT_LABEL[f] ?? f}
              active={p.formats.includes(f)}
              disabled={controlsDisabled}
              onPress={() => void toggleFormat(f)}
            />
          ))}
        </View>

        <View className="mt-9 flex-row items-center justify-center gap-2">
          <Text tone="muted" className="text-[12px]">
            ✦
          </Text>
          <Text variant="label" tone="muted" className="max-w-[280px] text-center">
            {REC_COPY.preferences.footnote}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
