import { VALUES_FILTERS, type BudgetBand, type ValuesFilter } from '@onskin/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

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
import { isOwnerQueryScopeCurrent, ownerQueryPrefixes, queryKeys } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Preferences (docs/09 §8, §11). The values / format / budget filters. Honest
// personalisation: they shape *what fits you*, never *what sells*. The engine is
// type-first and WEIGHTS these in the fit score; the hard product-level exclusion
// (a fragrance-averse user never seeing a fragranced product) lands with the
// curated catalog (B-CATALOG-SEED), so the copy says "prioritise", not "never".

const BUDGETS: BudgetBand[] = ['drugstore', 'mid', 'premium'];
const FORMATS = ['gel', 'cream', 'fluid', 'balm', 'oil'];
const MAX_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS = 3_000;

function devRecommendationPreferenceFailureMode(): 'once' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_FAILURE === 'once' ? 'once' : null;
}

function devRecommendationPreferenceDelayMs(): number {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return 0;

  const raw = process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS;
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), MAX_E2E_RECOMMENDATION_PREFERENCES_DELAY_MS);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function Toggle({
  label,
  active,
  disabled,
  dense = false,
  fill = false,
  ultraDense = false,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  dense?: boolean;
  fill?: boolean;
  ultraDense?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      aria-selected={active}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={
        ultraDense
          ? 'min-h-[48px] items-center justify-center rounded-pill px-3 py-2'
          : 'min-h-[48px] items-center justify-center rounded-pill px-4 py-2.5'
      }
      style={{
        backgroundColor: active ? colors.ink : colors.paperRaised,
        borderWidth: 1,
        borderColor: active ? colors.ink : colors.hairlineStrong,
        flexBasis: fill ? 0 : undefined,
        flexGrow: fill ? 1 : undefined,
        minHeight: ultraDense ? 48 : undefined,
        minWidth: fill ? 0 : dense ? 48 : undefined,
        opacity: disabled ? 0.58 : 1,
        paddingHorizontal: fill ? 8 : ultraDense ? 10 : dense ? 12 : undefined,
      }}
    >
      <Text
        adjustsFontSizeToFit
        className="font-sans-medium text-[13.5px]"
        minimumFontScale={0.78}
        numberOfLines={1}
        style={{
          color: active ? colors.paper : colors.inkSoft,
          fontSize: fill ? 12 : ultraDense ? 12.5 : dense ? 13 : undefined,
          lineHeight: fill || dense || ultraDense ? 16 : undefined,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function PreferencesScreen() {
  const { fontScale = 1, height, width } = useWindowDimensions();
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const simulatedPreferenceFailureUsed = useRef(false);
  const { data: prefs, isLoading } = useQuery({
    queryKey: queryKeys.recommendationPreferences(ownerScope),
    queryFn: loadPreferences,
  });
  const p = prefs ?? DEFAULT_PREFERENCES;
  const controlsDisabled = isLoading || saving;
  const preferenceFailureMode = devRecommendationPreferenceFailureMode();
  const preferenceDelayMs = devRecommendationPreferenceDelayMs();
  const compactPreferences = height < 640;
  const shortPreferences = height < 600;
  const supportFloorPreferences = width <= 320 && height < 520;
  const shortTextPressurePreferences = width <= 414 && height >= 600 && height < 640;
  const supportFloorTextPressurePreferences = width <= 430 && height >= 640 && height <= 700;
  const wideSupportFloorTextPressurePreferences =
    width > 390 && supportFloorTextPressurePreferences;
  const ultraShortPreferences = height < 460;
  const microShortPreferences = height < 380;
  const splitShortPreferences =
    height < 600 || shortTextPressurePreferences || supportFloorTextPressurePreferences;
  const modernTextPressurePreferences = height < 900;
  const boundaryTextPressurePreferences =
    height >= 700 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web');
  const androidMidTextPressurePreferences = width <= 390 && height >= 700 && height < 840;
  const tallTextPressurePreferences = width <= 430 && height >= 900 && height < 980;
  const showPreferencesSubtitle = !compactPreferences;
  const preferencesTitle = supportFloorPreferences ? 'Preferences' : REC_COPY.preferences.title;
  const valuesLabelClassName = ultraShortPreferences
    ? 'mb-1.5 mt-2.5'
    : supportFloorPreferences
      ? 'mb-1 mt-1.5'
      : shortPreferences
        ? 'mb-1.5 mt-3'
        : compactPreferences
          ? 'mb-2 mt-5'
          : 'mb-3 mt-7';
  const sectionLabelClassName = splitShortPreferences
    ? 'mb-1.5 mt-20'
    : ultraShortPreferences
      ? 'mb-1.5 mt-12'
      : shortPreferences
        ? 'mb-1.5 mt-24'
        : compactPreferences
          ? 'mb-2 mt-5'
          : 'mb-3 mt-7';
  const chipGroupClassName = shortPreferences
    ? 'flex-row flex-wrap gap-1'
    : 'flex-row flex-wrap gap-2';
  const textureSectionLabelClassName = ultraShortPreferences
    ? 'mb-1.5 mt-7'
    : shortPreferences
      ? 'mb-1.5 mt-28'
      : sectionLabelClassName;
  const textureSectionLabelStyle = ultraShortPreferences
    ? { marginBottom: 6, marginTop: 44 }
    : undefined;
  const ultraShortPreferenceFirstGroupStyle = microShortPreferences
    ? { marginTop: 88 }
    : ultraShortPreferences
      ? { marginTop: 48 }
      : undefined;
  const splitShortPreferenceDeferredGroupStyle = wideSupportFloorTextPressurePreferences
    ? { marginTop: 560 }
    : supportFloorPreferences || supportFloorTextPressurePreferences
      ? { marginTop: 400 }
      : { marginTop: 192 };
  const modernTextPressureBudgetGroupStyle =
    supportFloorPreferences || shortTextPressurePreferences || boundaryTextPressurePreferences
      ? { marginTop: 320 }
      : (modernTextPressurePreferences || tallTextPressurePreferences) && !compactPreferences
        ? { marginTop: 112 }
        : undefined;
  const modernTextPressureTextureGroupStyle = androidMidTextPressurePreferences
    ? { marginTop: 184 }
    : modernTextPressurePreferences && !compactPreferences
      ? { marginTop: 56 }
      : tallTextPressurePreferences
        ? { marginTop: 64 }
        : undefined;

  const savePreferenceWithFixture = async (next: RecPreferences) => {
    if (preferenceDelayMs > 0) await wait(preferenceDelayMs);
    if (preferenceFailureMode === 'once' && !simulatedPreferenceFailureUsed.current) {
      simulatedPreferenceFailureUsed.current = true;
      throw new Error('E2E_RECOMMENDATION_PREFERENCES_FAILURE');
    }
    await savePreferences(next);
  };

  const commit = async (next: RecPreferences) => {
    if (controlsDisabled) return;
    haptics.select();
    setSaveFailed(false);
    setSaving(true);
    try {
      await applyRecommendationPreferences(next, {
        save: savePreferenceWithFixture,
        onSaved: async () => {
          if (!isOwnerQueryScopeCurrent(ownerScope)) return;
          qc.setQueryData(queryKeys.recommendationPreferences(ownerScope), next);
          setSaveFailed(false);
          track('preference_set');
          // The For-you hub reads prefs+dismissals together. Refresh it too.
          await qc.invalidateQueries({
            queryKey: ownerQueryPrefixes.recommendations(ownerScope),
          });
        },
        onFailure: () => {
          setSaveFailed(true);
        },
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
  const renderValueToggle = (v: ValuesFilter) => (
    <Toggle
      key={v}
      ultraDense={ultraShortPreferences || shortPreferences}
      label={VALUES_LABEL[v] ?? v}
      active={p.values.includes(v)}
      disabled={controlsDisabled}
      onPress={() => void toggleValue(v)}
    />
  );

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactPreferences ? 'pb-24' : 'pb-10'}
      >
        <Text
          variant="title"
          className={
            ultraShortPreferences || shortPreferences ? 'mt-1 text-[30px] leading-[32px]' : 'mt-2'
          }
        >
          {preferencesTitle}
        </Text>
        {showPreferencesSubtitle ? (
          <Text variant="bodySm" tone="muted" className="mt-1.5">
            {REC_COPY.preferences.subtitle}
          </Text>
        ) : null}
        {saveFailed ? (
          <View
            accessibilityRole="alert"
            className="mt-4 rounded-xl bg-clay-tint px-3.5 py-3"
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <Text className="font-sans-bold text-[13px]" style={{ color: colors.clay }}>
              {REC_COPY.preferences.saveFailedTitle}
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              {REC_COPY.preferences.saveFailedBody}
            </Text>
          </View>
        ) : null}

        <Text variant="label" tone="muted" className={valuesLabelClassName}>
          {REC_COPY.preferences.valuesLabel.toUpperCase()}
        </Text>
        {splitShortPreferences ? (
          <>
            <View className={chipGroupClassName} style={ultraShortPreferenceFirstGroupStyle}>
              {VALUES_FILTERS.slice(0, 3).map(renderValueToggle)}
            </View>
            <View className={chipGroupClassName} style={splitShortPreferenceDeferredGroupStyle}>
              {VALUES_FILTERS.slice(3).map(renderValueToggle)}
            </View>
          </>
        ) : (
          <View className={chipGroupClassName}>{VALUES_FILTERS.map(renderValueToggle)}</View>
        )}

        <Text variant="label" tone="muted" className={sectionLabelClassName}>
          {REC_COPY.preferences.budgetLabel.toUpperCase()}
        </Text>
        <View className={chipGroupClassName} style={modernTextPressureBudgetGroupStyle}>
          {BUDGETS.map((b) => (
            <Toggle
              key={b}
              dense={compactPreferences || modernTextPressurePreferences}
              fill={!compactPreferences && !modernTextPressurePreferences}
              ultraDense={ultraShortPreferences || shortPreferences}
              label={BUDGET_LABEL[b] ?? b}
              active={p.budget === b}
              disabled={controlsDisabled}
              onPress={() => void setBudget(b)}
            />
          ))}
        </View>

        <Text
          variant="label"
          tone="muted"
          className={textureSectionLabelClassName}
          style={textureSectionLabelStyle}
        >
          {REC_COPY.preferences.formatLabel.toUpperCase()}
        </Text>
        <View className={chipGroupClassName} style={modernTextPressureTextureGroupStyle}>
          {FORMATS.map((f) => (
            <Toggle
              key={f}
              dense={compactPreferences}
              ultraDense={ultraShortPreferences || shortPreferences}
              label={FORMAT_LABEL[f] ?? f}
              active={p.formats.includes(f)}
              disabled={controlsDisabled}
              onPress={() => void toggleFormat(f)}
            />
          ))}
        </View>

        <View
          className={
            compactPreferences
              ? 'mt-7 flex-row items-center justify-center gap-2'
              : 'mt-9 flex-row items-center justify-center gap-2'
          }
        >
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
