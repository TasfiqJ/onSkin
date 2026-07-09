import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, RouteIconButton, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { POLICY_LINKS } from '@/lib/legal/policyLinks';
import { appendExternalQueryParam } from '@/lib/navigation/externalUrl';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

const SUPPORT_FEEDBACK_UNAVAILABLE =
  'Support is not configured in this build. Please try again after the beta link is enabled.';

const SUPPORT_FEEDBACK_CATEGORIES = [
  {
    key: 'onboarding_confusion',
    label: 'Onboarding confusion',
    detail: 'Age, consent, quiz, account, or first-run setup.',
  },
  {
    key: 'catalog_match',
    label: 'Catalog match issue',
    detail: 'No match, wrong match, barcode, or manual add.',
  },
  {
    key: 'guidance_trust',
    label: 'Guidance trust concern',
    detail: 'Advice felt unclear, unsafe, or not grounded enough.',
  },
  {
    key: 'routine_checkoff',
    label: 'Routine or check-off',
    detail: 'Scheduling, timing, step order, or completion issue.',
  },
  {
    key: 'visual_progress',
    label: 'Progress photos',
    detail: 'Capture, timeline, comparison, or permission issue.',
  },
  {
    key: 'notifications',
    label: 'Reminders',
    detail: 'Notification timing, quiet hours, or delivery issue.',
  },
  {
    key: 'paywall_comprehension',
    label: 'Paywall comprehension',
    detail: 'Pricing, trial, restore, or subscription wording.',
  },
  {
    key: 'privacy_rights',
    label: 'Privacy or data rights',
    detail: 'Deletion, export, consent, or privacy policy issue.',
  },
  {
    key: 'crash_performance',
    label: 'Crash or performance',
    detail: 'Freeze, blank screen, slow load, or app crash.',
  },
  {
    key: 'account_auth',
    label: 'Account or sign-in',
    detail: 'Email, guest mode, auth, or saved-account issue.',
  },
  {
    key: 'app_install',
    label: 'Install or app review',
    detail: 'Store, TestFlight, install, or update issue.',
  },
  {
    key: 'advice_boundary',
    label: 'Advice boundary concern',
    detail: 'Content felt too clinical or beyond product guidance.',
  },
  {
    key: 'other',
    label: 'Other',
    detail: 'Something important not covered above.',
  },
] as const;

const SUPPORT_FEEDBACK_SEVERITIES = [
  {
    key: 'p0',
    label: 'Cannot use the app',
    detail: 'Crash, data-loss risk, or hard blocker.',
  },
  {
    key: 'p1',
    label: 'Core flow blocked',
    detail: 'A key journey cannot be completed.',
  },
  {
    key: 'p2',
    label: 'Can continue',
    detail: 'Wrong or confusing, but there is a workaround.',
  },
  {
    key: 'p3',
    label: 'Suggestion',
    detail: 'Polish, wording, or nice-to-have improvement.',
  },
] as const;

type SupportFeedbackCategory = (typeof SUPPORT_FEEDBACK_CATEGORIES)[number]['key'];
type SupportFeedbackSeverity = (typeof SUPPORT_FEEDBACK_SEVERITIES)[number]['key'];
type OptionRowDensity =
  | 'compact'
  | 'modernTextPressure'
  | 'regular'
  | 'supportTextPressure'
  | 'tallTextPressure';

function supportFeedbackUrl(
  category: SupportFeedbackCategory,
  severity: SupportFeedbackSeverity,
): string | null {
  let url: string | null = POLICY_LINKS.support.url;
  for (const [key, value] of [
    ['source', 'beta_feedback'],
    ['category', category],
    ['severity', severity],
  ] as const) {
    url = appendExternalQueryParam(url, key, value);
    if (!url) return null;
  }
  return url;
}

function OptionRow({
  label,
  detail,
  extraTopMargin,
  selected,
  density,
  onPress,
}: {
  label: string;
  detail: string;
  extraTopMargin?: number;
  selected: boolean;
  density: OptionRowDensity;
  onPress: () => void;
}) {
  const compactTreatment = density !== 'regular';
  const className =
    density === 'supportTextPressure'
      ? 'mb-8 min-h-[56px] rounded-[14px] px-3 py-2.5'
      : density === 'modernTextPressure'
        ? 'mb-6 min-h-[56px] rounded-[14px] px-3 py-2.5'
        : density === 'tallTextPressure'
          ? 'mb-16 min-h-[56px] rounded-[14px] px-3 py-2.5'
          : density === 'compact'
            ? 'mb-2 min-h-[56px] rounded-[14px] px-3 py-2.5'
            : 'mb-2 min-h-[64px] rounded-[14px] px-4 py-3';

  return (
    <View style={extraTopMargin ? { marginTop: extraTopMargin } : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}. ${detail}`}
        onPress={onPress}
        className={className}
        style={{
          backgroundColor: selected ? colors.clayTint : colors.paperRaised,
          borderWidth: 1,
          borderColor: selected ? colors.clay : colors.hairline,
        }}
      >
        <Text
          variant="body"
          className="font-sans-semibold"
          style={compactTreatment ? { fontSize: 14, lineHeight: 17 } : undefined}
        >
          {label}
        </Text>
        <Text
          variant="bodySm"
          tone="muted"
          className="mt-1"
          style={compactTreatment ? { fontSize: 12, lineHeight: 15 } : { lineHeight: 18 }}
        >
          {detail}
        </Text>
      </Pressable>
    </View>
  );
}

export default function BetaFeedbackScreen() {
  const { fontScale, height, width } = useWindowDimensions();
  const compact = height < 700 || width < 390;
  const highTextPressure = fontScale >= 1.3 || Platform.OS === 'web';
  const denseChrome = compact || highTextPressure;
  const optionRowDensity: OptionRowDensity =
    highTextPressure && width <= 390 && height < 700
      ? 'supportTextPressure'
      : highTextPressure && width <= 430 && height >= 900 && height < 980
        ? 'tallTextPressure'
        : highTextPressure && width <= 430 && height >= 700 && height < 900
          ? 'modernTextPressure'
          : compact
            ? 'compact'
            : 'regular';
  const [category, setCategory] = useState<SupportFeedbackCategory | null>(null);
  const [severity, setSeverity] = useState<SupportFeedbackSeverity | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const canOpenSupport = !!category && !!severity && !opening;
  const feedbackMessage =
    feedback && highTextPressure ? 'Support is not configured in this build.' : feedback;

  async function openSupport() {
    if (!category || !severity || opening) return;

    setOpening(true);
    setFeedback(null);
    const url = supportFeedbackUrl(category, severity);
    const opened = await openExternalHttpsUrl(url, {
      failureTitle: 'Support unavailable',
      failureMessage: SUPPORT_FEEDBACK_UNAVAILABLE,
      alertOnFailure: false,
    });
    const analyticsPayload = {
      source: 'beta_feedback',
      result: opened ? 'opened' : 'unavailable',
      category,
      severity,
    } as const;
    if (opened) {
      track('support_contact_opened', analyticsPayload);
    } else {
      track('support_contact_failed', analyticsPayload);
    }
    if (!opened) setFeedback(SUPPORT_FEEDBACK_UNAVAILABLE);
    setOpening(false);
  }

  function categoryFirstViewportBreakMargin(index: number): number | undefined {
    if (!highTextPressure) return undefined;
    if (width <= 430 && height < 700 && index === 2) return 192;
    if (width <= 430 && height >= 700 && height < 900 && index === 4) return 64;
    return undefined;
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={denseChrome ? 'px-5 pb-8' : 'px-5 pb-10'}
      >
        <View
          className={
            highTextPressure
              ? 'mb-2 flex-row items-center gap-3 pt-1'
              : compact
              ? 'mb-3 flex-row items-center gap-3 pt-1'
              : 'mb-5 flex-row items-center gap-3 pt-1'
          }
        >
          <RouteIconButton
            accessibilityLabel="Back"
            onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
          />
          <Text variant="title" style={{ fontSize: highTextPressure ? 24 : compact ? 26 : 28 }}>
            Beta feedback
          </Text>
        </View>

        <View
          className={
            highTextPressure
              ? 'mb-2 rounded-card bg-paper-raised p-3'
              : compact
              ? 'mb-3 rounded-card bg-paper-raised p-4'
              : 'mb-4 rounded-card bg-paper-raised p-5'
          }
        >
          <Text variant="titleSm" style={{ fontSize: highTextPressure ? 18 : compact ? 20 : 22 }}>
            {highTextPressure ? 'Category and priority only' : 'Route the issue fast'}
          </Text>
          {highTextPressure ? null : (
            <Text variant="bodySm" tone="muted" className="mt-2" style={{ lineHeight: 19 }}>
              We send only the selected issue type and priority with your support handoff.
            </Text>
          )}
        </View>

        <Text variant="label" tone="muted" className="mb-2 ml-2">
          ISSUE TYPE
        </Text>
        {SUPPORT_FEEDBACK_CATEGORIES.map((item, index) => (
          <OptionRow
            key={item.key}
            label={item.label}
            detail={item.detail}
            extraTopMargin={categoryFirstViewportBreakMargin(index)}
            selected={category === item.key}
            density={optionRowDensity}
            onPress={() => {
              setFeedback(null);
              setCategory(item.key);
            }}
          />
        ))}

        <Text variant="label" tone="muted" className="mb-2 ml-2 mt-4">
          PRIORITY
        </Text>
        {SUPPORT_FEEDBACK_SEVERITIES.map((item) => (
          <OptionRow
            key={item.key}
            label={item.label}
            detail={item.detail}
            extraTopMargin={undefined}
            selected={severity === item.key}
            density={optionRowDensity}
            onPress={() => {
              setFeedback(null);
              setSeverity(item.key);
            }}
          />
        ))}

        {feedbackMessage ? (
          <Text
            accessibilityRole="alert"
            variant="bodySm"
            tone="muted"
            className={highTextPressure ? 'mt-1 text-center' : 'mt-2 text-center'}
            style={highTextPressure ? { fontSize: 12, lineHeight: 15 } : undefined}
          >
            {feedbackMessage}
          </Text>
        ) : null}

        <Button
          className={feedback && highTextPressure ? 'mt-2' : 'mt-4'}
          label={opening ? 'Opening...' : 'Open support'}
          disabled={!canOpenSupport}
          onPress={() => void openSupport()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
