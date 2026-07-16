import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing source boundary: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing source boundary: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function expectTouchableRouteIcon(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should use the shared 44pt route icon button`).toContain(
    'RouteIconButton',
  );
  expect(
    source,
    `${route} should not rely on small hit slop for the visible Back control`,
  ).not.toContain('hitSlop={8}');
}

describe('Settings route contracts', () => {
  it('keeps privacy direct entries inside the You tab privacy controls surface', () => {
    const privacyAlias = readAppRoute('settings/privacy.tsx');
    const you = readAppRoute('(tabs)/you.tsx');

    expect(privacyAlias).toContain('Redirect');
    expect(privacyAlias).toContain("pathname: '/(tabs)/you'");
    expect(privacyAlias).toContain("params: { section: 'privacy' }");
    expect(you).toContain('useLocalSearchParams');
    expect(you).toContain('useLocalSearchParams<{ section?: string }>()');
    expect(you).toContain('const scrollRef = useRef<ScrollView>(null);');
    expect(you).toContain('const privacyCardY = useRef(0);');
    expect(you).toContain('if (!privacyDirectEntry || !privacyCardReady) return;');
    expect(you).toContain('scrollRef.current?.scrollTo');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_TOP_OFFSET = 16;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_COMPACT_SCROLL_NUDGE = 0;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_NARROW_SCROLL_NUDGE = 30;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_SHORT_SCROLL_NUDGE = 8;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_SUPPORT_SCROLL_NUDGE = 48;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_ULTRA_SHORT_SCROLL_NUDGE = 56;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_MICRO_SHORT_SCROLL_NUDGE = 64;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_NARROW_WITHDRAW_MARGIN = 0;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_SUPPORT_WITHDRAW_MARGIN = 80;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_COMPACT_POLICY_MARGIN = 640;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_SHORT_WIDE_POLICY_MARGIN = 180;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_POLICY_CONSUMER_HEALTH_MARGIN = 120;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_TALL_POLICY_CONSUMER_HEALTH_MARGIN = 220;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_POLICY_SUPPORT_MARGIN = 300;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_POLICY_TERMS_MARGIN = 48;');
    expect(you).toContain('const PRIVACY_DIRECT_ENTRY_POLICY_DATA_EXPORT_MARGIN = 144;');
    expect(you).not.toContain('const PRIVACY_DIRECT_ENTRY_COMPACT_SCROLL_NUDGE = -');
    expect(you).not.toContain('const PRIVACY_DIRECT_ENTRY_NARROW_SCROLL_NUDGE = -');
    expect(you).toContain("const privacyDirectEntry = params.section === 'privacy';");
    expect(you).toContain('const narrowPhone = compactPhone && width < 360;');
    expect(you).toContain(
      'const shortPrivacyEntry = privacyDirectEntry && narrowPhone && height < 600;',
    );
    expect(you).toContain('const supportFloorPrivacyEntry =');
    expect(you).toContain('privacyDirectEntry && narrowPhone && height >= 460 && height < 520;');
    expect(you).toContain(
      'const tallPhonePrivacyEntry = privacyDirectEntry && width <= 430 && height >= 900 && height < 980;',
    );
    expect(you).toContain(
      'const shortWidePrivacyEntry = privacyDirectEntry && width <= 430 && height >= 640 && height < 780;',
    );
    expect(you).toContain(
      'const ultraShortPrivacyEntry = privacyDirectEntry && narrowPhone && height < 460;',
    );
    expect(you).toContain(
      'const microShortPrivacyEntry = privacyDirectEntry && narrowPhone && height < 380;',
    );
    expect(you).toContain('const privacyDirectEntryScrollNudge = microShortPrivacyEntry');
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_MICRO_SHORT_SCROLL_NUDGE');
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_ULTRA_SHORT_SCROLL_NUDGE');
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_SUPPORT_SCROLL_NUDGE');
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_SHORT_SCROLL_NUDGE');
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_NARROW_SCROLL_NUDGE');
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_COMPACT_SCROLL_NUDGE');
    expect(you).toContain('const narrowPrivacyWithdrawStyle = supportFloorPrivacyEntry');
    expect(you).toContain('? { marginTop: PRIVACY_DIRECT_ENTRY_SUPPORT_WITHDRAW_MARGIN }');
    expect(you).toContain('? { marginTop: PRIVACY_DIRECT_ENTRY_NARROW_WITHDRAW_MARGIN }');
    expect(you).not.toContain('PRIVACY_DIRECT_ENTRY_SUPPORT_PHOTO_PROMISE_MARGIN');
    expect(you).toContain('label="Photos & the no-AI-score promise"');
    expect(you).toContain(
      'privacyCardY.current - PRIVACY_DIRECT_ENTRY_TOP_OFFSET + privacyDirectEntryScrollNudge',
    );
    expect(you).toContain('const frame = requestAnimationFrame(scrollToPrivacyCard);');
    expect(you).toContain('const retry = setTimeout(scrollToPrivacyCard, 180);');
    expect(you).toContain('const lateRetry = setTimeout(scrollToPrivacyCard, 360);');
    expect(you).toContain('cancelAnimationFrame(frame);');
    expect(you).toContain('clearTimeout(retry);');
    expect(you).toContain('clearTimeout(lateRetry);');
    expect(you).toContain(
      '}, [privacyDirectEntry, privacyCardReady, privacyDirectEntryScrollNudge]);',
    );
    expect(you).toContain('const nextPrivacyCardY = event.nativeEvent.layout.y;');
    expect(you).toContain('privacyCardY.current = nextPrivacyCardY;');
    expect(you).toContain('onLayout={onPrivacyCardLayout}');
    expect(you).toContain('<Card className="mt-4" onLayout={onLayout}>');
    expect(you).toContain('if (!privacyDirectEntry) return;');
    expect(you).toContain('const scrollToCurrentPrivacyCard = () => {');
    expect(you).toContain(
      'nextPrivacyCardY - PRIVACY_DIRECT_ENTRY_TOP_OFFSET + privacyDirectEntryScrollNudge',
    );
    expect(you).toContain('requestAnimationFrame(scrollToCurrentPrivacyCard);');
    expect(you).toContain('setTimeout(scrollToCurrentPrivacyCard, 80);');
    expect(you).toContain('const privacyPolicyCardMarginTop =');
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_COMPACT_POLICY_MARGIN');
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_SHORT_WIDE_POLICY_MARGIN');
    expect(you).toContain(
      "className={privacyPolicyCardMarginTop === undefined ? 'mt-4' : undefined}",
    );
    expect(you).toContain(': { marginTop: privacyPolicyCardMarginTop }');
    expect(you).toContain("privacyDirectEntry && row.key === 'consumerHealthPrivacy'");
    expect(you).toContain('? PRIVACY_DIRECT_ENTRY_TALL_POLICY_CONSUMER_HEALTH_MARGIN');
    expect(you).toContain(': PRIVACY_DIRECT_ENTRY_POLICY_CONSUMER_HEALTH_MARGIN');
    expect(you).toContain("privacyDirectEntry && row.key === 'dataExport'");
    expect(you).toContain('? { marginTop: PRIVACY_DIRECT_ENTRY_POLICY_DATA_EXPORT_MARGIN }');
    expect(you).toContain("privacyDirectEntry && row.key === 'terms'");
    expect(you).toContain('? { marginTop: PRIVACY_DIRECT_ENTRY_POLICY_TERMS_MARGIN }');
    expect(you).toContain("privacyDirectEntry && row.key === 'support'");
    expect(you).toContain('? { marginTop: PRIVACY_DIRECT_ENTRY_POLICY_SUPPORT_MARGIN }');
    expect(you).toContain('<View style={narrowPrivacyWithdrawStyle}>');
    expect(you).toContain("className={privacyDirectEntry ? undefined : 'mt-4'}");
    expect(you).toContain('{privacyDirectEntry ? null : (');
    expect(you).toContain('<Card className="mt-4">');

    const shell = sourceBetween(
      you,
      'const YouMutationSections = memo(',
      'export default function',
    );
    expect(shell.indexOf('<YouPrivacySection')).toBeGreaterThan(
      shell.indexOf('<YouSecuritySection'),
    );
    expect(shell.indexOf('<YouPrivacySection')).toBeGreaterThan(
      shell.indexOf('<YouStaticUtilitySections'),
    );
  });

  it('keeps direct-entry exits safe for account and reminder settings', () => {
    for (const route of [
      'settings/subscription.tsx',
      'settings/notifications.tsx',
      'settings/timing.tsx',
      'settings/beta-feedback.tsx',
      'settings/skin-profile.tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should use backOrReplace for direct-entry exits`).not.toContain(
        'router.back()',
      );
      expect(source, `${route} should return direct entries to the You tab`).toContain(
        'APP_YOU_ROUTE',
      );
      expect(source, `${route} should guard native back with a fallback`).toContain(
        'backOrReplace(router, APP_YOU_ROUTE)',
      );
    }
  });

  it('keeps settings route exits touchable on phones', () => {
    for (const route of [
      'settings/subscription.tsx',
      'settings/notifications.tsx',
      'settings/timing.tsx',
      'settings/beta-feedback.tsx',
      'settings/skin-profile.tsx',
    ]) {
      expectTouchableRouteIcon(route);
    }
  });

  it('keeps the pregnancy and breastfeeding setting local-first and recoverable', () => {
    const you = readAppRoute('(tabs)/you.tsx');
    const route = readAppRoute('settings/skin-profile.tsx');

    expect(you).toContain("label: 'Pregnancy & breastfeeding'");
    expect(you).toContain("href: '/settings/skin-profile'");
    expect(route).toContain('savePregnancyStatus(selected)');
    expect(route).toContain('qc.setQueryData(queryKeys.skinProfile(ownerScope), next)');
    expect(route).toContain('ownerQueryPrefixes.shelf(ownerScope)');
    expect(route).toContain('ownerQueryPrefixes.ramp(ownerScope)');
    expect(route).toContain('Choice not saved');
    expect(route).toContain('Your previous setting is unchanged.');
    expect(route).toContain('Skin profile unavailable');
    expect(route).toContain('Privacy choice needs review');
    expect(route).toContain('Review privacy choice');
    expect(route).toContain('disabled={saving}');
    expect(route).toContain("pathname: '/onboarding/consent'");
    expect(route).toContain('label="Rebuild skin profile"');
    expect(route).toContain("router.push('/onboarding/goals')");
    expect(route).toContain("router.replace('/routine/plan')");
    expect(route).toContain("router.replace('/(tabs)/shelf')");
    expect(route).toContain("router.replace('/(tabs)/today')");
    expect(route).toContain('min-h-[48px]');
    expect(route).not.toContain('router.back()');
  });

  it('keeps beta feedback routed through categorized support handoff', () => {
    const you = readAppRoute('(tabs)/you.tsx');
    const route = readAppRoute('settings/beta-feedback.tsx');

    expect(you).toContain('label="Beta feedback"');
    expect(you).toContain('hint="Send a categorized issue through support."');
    expect(you).toContain("onPress={() => router.push('/settings/beta-feedback')}");
    expect(route).toContain('const SUPPORT_FEEDBACK_CATEGORIES = [');
    expect(route).toContain("key: 'catalog_match'");
    expect(route).toContain("key: 'routine_checkoff'");
    expect(route).toContain("key: 'advice_boundary'");
    expect(route).toContain('const SUPPORT_FEEDBACK_SEVERITIES = [');
    expect(route).toContain("key: 'p0'");
    expect(route).toContain("key: 'p3'");
    expect(route).toContain("['source', 'beta_feedback']");
    expect(route).toContain("['category', category]");
    expect(route).toContain("['severity', severity]");
    expect(route).toContain("track('support_contact_opened', analyticsPayload)");
    expect(route).toContain("track('support_contact_failed', analyticsPayload)");
    expect(route).toContain("source: 'beta_feedback'");
    expect(route).toContain('category,');
    expect(route).toContain('severity,');
    expect(route).toContain(
      'import { Platform, Pressable, ScrollView, View, useWindowDimensions }',
    );
    expect(route).toContain('const { fontScale, height, width } = useWindowDimensions();');
    expect(route).toContain("const highTextPressure = fontScale >= 1.3 || Platform.OS === 'web';");
    expect(route).toContain('const denseChrome = compact || highTextPressure;');
    expect(route).toContain(
      "{highTextPressure ? 'Category and priority only' : 'Route the issue fast'}",
    );
    expect(route).toContain('{highTextPressure ? null : (');
    expect(route).toContain("? 'supportTextPressure'");
    expect(route).toContain("? 'tallTextPressure'");
    expect(route).toContain("? 'modernTextPressure'");
    expect(route).toContain("density === 'supportTextPressure'");
    expect(route).toContain("? 'mb-8 min-h-[56px]");
    expect(route).toContain("density === 'modernTextPressure'");
    expect(route).toContain("? 'mb-6 min-h-[56px]");
    expect(route).toContain("density === 'tallTextPressure'");
    expect(route).toContain("? 'mb-16 min-h-[56px]");
    expect(route).toContain('density={optionRowDensity}');
    expect(route).toContain(
      'function categoryFirstViewportBreakMargin(index: number): number | undefined',
    );
    expect(route).toContain('if (width <= 430 && height < 700 && index === 2) return 192;');
    expect(route).toContain(
      'if (width <= 430 && height >= 700 && height < 900 && index === 4) return 64;',
    );
    expect(route).toContain('extraTopMargin={categoryFirstViewportBreakMargin(index)}');
    expect(route).toContain(
      "feedback && highTextPressure ? 'Support is not configured in this build.' : feedback",
    );
    expect(route).toContain("className={feedback && highTextPressure ? 'mt-2' : 'mt-4'}");
    expect(route).toContain('SUPPORT_FEEDBACK_UNAVAILABLE');
    expect(route).not.toContain('TextInput');
    expect(route).not.toContain('freeText');
    expect(route).not.toContain('supportEmail');
  });

  it('keeps reminder timing controls comfortably above 44px on phones', () => {
    const timing = readAppRoute('settings/timing.tsx');
    const notifications = readAppRoute('settings/notifications.tsx');

    expect(timing).toContain('min-h-[48px] flex-row items-center justify-between py-2.5');
    expect(timing).toContain('min-h-[48px] min-w-[72px] items-center justify-center rounded-[8px]');
    expect(timing).toContain(
      "import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';",
    );
    expect(timing).toContain(
      "import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';",
    );
    expect(timing).toContain('const { height: viewportHeight } = useWindowDimensions();');
    expect(timing).toContain('const sheetMaxHeight = Math.max(0, viewportHeight - 44);');
    expect(timing).toContain(
      'const listMaxHeight = Math.min(340, Math.max(160, sheetMaxHeight - 115));',
    );
    expect(timing).toContain('const insets = useSafeAreaInsets();');
    expect(timing).toContain('insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;');
    expect(timing).toContain(
      'sheetPaddingBottom === undefined\n              ? { maxHeight: sheetMaxHeight }',
    );
    expect(timing).toContain(': { maxHeight: sheetMaxHeight, paddingBottom: sheetPaddingBottom }');
    expect(timing).toContain('style={{ maxHeight: listMaxHeight }}');
    expect(timing).toContain('accessibilityLabel={`Morning reminder time, ${amTimeLabel}`}');
    expect(timing).toContain('accessibilityLabel={`Evening reminder time, ${pmTimeLabel}`}');
    expect(timing).toContain('accessibilityLabel={`Quiet hours start, ${quietStartTimeLabel}`}');
    expect(timing).toContain('accessibilityLabel={`Quiet hours end, ${quietEndTimeLabel}`}');
    expect(timing).toContain('accessibilityHint="Opens time picker"');
    expect(timing).toContain("flexWrap: 'wrap'");
    expect(timing).toContain('style={{ flexShrink: 1, minWidth: 0 }}');
    expect(timing).toContain('const { height } = useWindowDimensions();');
    expect(timing).toContain('const compactTiming = height < 460;');
    expect(timing).toContain('const splitShortTiming = height < 380;');
    expect(timing).toContain(
      "contentContainerClassName={compactTiming ? 'px-5 pb-8' : 'px-5 pb-10'}",
    );
    expect(timing).toContain("'mb-1 flex-row items-center gap-2 pt-0'");
    expect(timing).toContain('style={{ fontSize: compactTiming ? 26 : 28 }}');
    expect(timing).toContain("? 'min-h-[48px] flex-row items-center justify-between py-0'");
    expect(timing).toContain("? 'rounded-[18px] bg-paper-raised px-[18px] py-2'");
    expect(timing).toContain("className={compactTiming ? 'gap-2' : 'gap-3'}");
    expect(timing).toContain("className={compactTiming ? 'mt-1 text-[12px]' : 'mt-2'}");
    expect(notifications).toContain('min-h-[56px] flex-row items-center justify-between py-3.5');
    expect(notifications).toContain('min-h-[48px] flex-1 justify-center pr-3');
    expect(notifications).not.toContain('min-h-[44px] flex-1 justify-center pr-3');
    expect(notifications).toContain('useWindowDimensions');
    expect(notifications).toContain('const { height, width } = useWindowDimensions();');
    expect(notifications).toContain('const compactNotifications = height < 600;');
    expect(notifications).toContain('const ultraShortNotifications = height < 460;');
    expect(notifications).toContain('const splitShortNotifications = height < 600;');
    expect(notifications).toContain('const microShortNotifications = height < 380;');
    expect(notifications).toContain(
      'const supportTextPressureNotifications = width <= 390 && height >= 600 && height < 700;',
    );
    expect(notifications).toContain(
      'const androidMidTextPressureNotifications = width <= 390 && height >= 700 && height < 780;',
    );
    expect(notifications).toContain(
      'const iphoneTextPressureNotifications = width <= 390 && height >= 780 && height < 840;',
    );
    expect(notifications).toContain(
      'const deferCaptureNudge = splitShortNotifications || iphoneTextPressureNotifications;',
    );
    expect(notifications).toContain('const deferredNudgeRowStyle = {');
    expect(notifications).toContain('marginTop: iphoneTextPressureNotifications');
    expect(notifications).toContain('? 96');
    expect(notifications).toContain(
      ': microShortNotifications\n        ? 72\n        : height < 520\n          ? 184\n          : 88,',
    );
    expect(notifications).toContain('style={deferredNudgeRowStyle}');
    expect(notifications).toContain('const nudgesSectionStyle = supportTextPressureNotifications');
    expect(notifications).toContain('? { marginTop: 152 }');
    expect(notifications).toContain(': androidMidTextPressureNotifications');
    expect(notifications).toContain('? { marginTop: 184 }');
    expect(notifications).toContain(': microShortNotifications\n        ? { marginTop: 136 }');
    expect(notifications).toContain('? { marginTop: 64 }');
    expect(notifications).toContain('<View style={nudgesSectionStyle}>');
    expect(notifications).toContain(
      "className={micro ? 'mb-0.5 ml-2 mt-1' : compact ? 'mb-1 ml-2 mt-2' : 'mb-2 ml-2 mt-4'}",
    );
    expect(notifications).toContain(
      'style={{ fontSize: micro ? 9 : compact ? 9.5 : 10, letterSpacing: 1 }}',
    );
    expect(notifications).toContain(
      "microShortNotifications ? 'px-5 pb-6' : compactNotifications ? 'px-5 pb-8' : 'px-5 pb-10'",
    );
    expect(notifications).toContain(
      "microShortNotifications\n              ? 'mb-0 flex-row items-center gap-2 pt-0'",
    );
    expect(notifications).toContain(
      'style={{ fontSize: microShortNotifications ? 24 : ultraShortNotifications ? 26 : 28 }}',
    );
    expect(notifications).toContain(
      '<SectionLabel compact={compactNotifications} micro={microShortNotifications}>',
    );
    expect(notifications).toContain('min-h-[48px] flex-row items-center justify-between py-0');
    expect(notifications).toContain('min-h-[48px] flex-1 justify-center pr-2.5');
    expect(notifications).toContain(
      'style={compact ? { fontSize: 14, lineHeight: 17 } : undefined}',
    );
    expect(notifications).toContain('compact={compactNotifications}');
    expect(notifications).toContain(
      'const promotionalSectionStyle = splitShortNotifications ? { marginTop: 112 } : undefined;',
    );
    expect(notifications).toContain('style={promotionalSectionStyle}');
    expect(notifications).toContain('last={deferCaptureNudge}');
    expect(notifications).toContain('{deferCaptureNudge ? null : (');
    expect(notifications).toContain('{deferCaptureNudge ? (');
    expect(notifications).toContain('ToggleSwitch');
    expect(notifications).toContain('accessibilityLabel={title}');
  });

  it('keeps typed notification preferences behind route-owned recovery and mutation feedback', () => {
    const notifications = readAppRoute('settings/notifications.tsx');
    const timing = readAppRoute('settings/timing.tsx');

    for (const source of [notifications, timing]) {
      expect(source).toContain('useNotificationPreferenceRouteState');
      expect(source).toContain('<NotificationPreferenceAvailability');
      expect(source).toContain('<NotificationPreferenceMutationFeedback');
      expect(source).toContain("preference.preferenceState.status === 'ready'");
      expect(source).toContain('preference.mutationPending');
      expect(source).toContain('preference.retryLastPatch');
      expect(source).toContain('preference.retryRead');
      expect(source).not.toContain('if (!p) return null');
      expect(source).not.toContain('error.message');
    }

    expect(notifications).toContain('disabled={preference.mutationPending}');
    expect(notifications).toContain('accessibilityState={{ disabled }}');
    expect(timing).toContain('disabled={preference.mutationPending}');
    expect(timing).toContain('field={p ? picking : null}');
  });

  it('does not fabricate a quiet-hours window when nullable preference endpoints are unset', () => {
    const timing = readAppRoute('settings/timing.tsx');

    expect(timing).toContain("const pickerFallback = picking === 'qend' ? '07:00' : '22:00';");
    expect(timing).toContain("p.quietStart ? fmtTime(p.quietStart) : 'Off'");
    expect(timing).toContain("p.quietEnd ? fmtTime(p.quietEnd) : 'Off'");
    expect(timing).toContain(
      'const quietHoursEnabled = p?.quietStart != null && p.quietEnd != null;',
    );
    expect(timing).toContain("'Quiet hours are off until both a start and end time are set.'");
    expect(timing).toContain("{quietHoursEnabled ? SETTINGS_COPY.quietLabel : 'Quiet hours off'}");
    expect(timing).toContain(
      "{quietHoursEnabled ? 'Turn off quiet hours' : 'Turn on quiet hours'}",
    );
    expect(timing).toContain('? { quietStart: null, quietEnd: null }');
    expect(timing).not.toContain("fmtTime(p.quietStart ?? '22:00')");
    expect(timing).not.toContain("fmtTime(p.quietEnd ?? '07:00')");
  });

  it('keeps the reminder time picker dismissible without inert sheet buttons', () => {
    const source = readAppRoute('settings/timing.tsx');

    expect(source).toContain('accessibilityLabel="Dismiss time picker"');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain(
      'className="flex-1"\n          accessibilityLabel="Dismiss time picker"',
    );
    expect(source).toContain('accessibilityLabel={title}');
    expect(source).toContain('accessibilityViewIsModal');
    expect(source).not.toContain('role="dialog"');
    expect(source).not.toContain('aria-modal');
    expect(source).toContain('accessibilityLabel={`${title}, ${formattedTime}`}');
    expect(source).toContain(
      'accessibilityHint={`Sets ${title.toLowerCase()} to ${formattedTime}`}',
    );
    expect(source).toContain('const formattedTime = fmtTime(t);');
    expect(source).not.toContain('onPress={() => {}}');
  });

  it('keeps active privacy/security choices on shared controls and backup device-only', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain('ToggleSwitch');
    expect(source).toContain('accessibilityLabel="App lock"');
    expect(source).toContain('accessibilityLabel="Marketing emails"');
    expect(source).toContain('label="Progress photo storage"');
    expect(source).toContain('Device only');
    expect(source).not.toContain('accessibilityLabel="Encrypted cloud backup"');
    expect(source).not.toContain('<Switch');
    expect(source).not.toContain('onValueChange');
  });

  it('keeps the You tab commerce toggle local-first when the ledger is offline', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain("if (type !== 'data_sharing') throw error;");
    expect(source).not.toContain("if (type === 'data_sharing' && granted)");
    expect(source).not.toContain('await setCommerceConsentLocal(false).catch(() => undefined)');
  });

  it('keeps You tab navigation rows touchable beyond the chevron glyph', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain("'min-h-[56px] flex-row items-center justify-between py-2'");
    expect(source).toContain("'min-h-[48px] flex-row items-center justify-between py-0.5'");
    expect(source).toContain('className="h-[44px] w-[44px] items-center justify-center"');
    expect(source).toContain('accessibilityLabel={hint ? `${label}. ${hint}` : label}');
    expect(source).toContain("onPress={() => router.push('/settings/subscription')}");
    expect(source).toContain('const YouPoliciesSection = memo(');
    expect(source).toContain('const [policyFeedback, setPolicyFeedback] = useState<PolicyFeedback');
    expect(source).toContain('const pendingPolicyRef = useRef<PolicyLinkKey | null>(null);');
    expect(source).toContain(
      "const POLICY_LINK_UNAVAILABLE_MESSAGE =\n  'Link unavailable. We could not open this policy link. Please try again.';",
    );
    expect(source).toContain('const openPolicyRow = useCallback(');
    expect(source).toContain('if (pendingPolicyRef.current !== null) return;');
    expect(source).toContain('recordYouPolicyStart();');
    expect(source).toContain('setPolicyFeedback(null);');
    expect(source).toContain('opened = await openPolicyUrl(row.url);');
    expect(source).toContain("if (row.key === 'support')");
    expect(source).toContain(
      "track('support_contact_opened', { source: 'settings', result: 'opened' });",
    );
    expect(source).toContain(
      "track('support_contact_failed', { source: 'settings', result: 'unavailable' });",
    );
    expect(source).toContain("source: 'settings'");
    expect(source).toContain(
      'setPolicyFeedback({ key: row.key, message: POLICY_LINK_UNAVAILABLE_MESSAGE });',
    );
    expect(source).toContain('key={row.key}');
    expect(source).toContain('disabled={pendingPolicy !== null}');
    expect(source).toContain('onPress={() => void openPolicyRow(row)}');
    expect(source).toContain('policyFeedback?.key === row.key');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).not.toContain(
      'onPress={() => router.push(href)}\n                accessibilityRole="button"',
    );
    expect(source).not.toContain(
      'onPress={() => void openPolicyRow(row)}\n                accessibilityRole="button"',
    );

    const policyOwner = sourceBetween(
      source,
      'const YouPoliciesSection = memo(',
      'const YouDataSection = memo(',
    );
    expect(policyOwner.indexOf('if (pendingPolicyRef.current !== null) return;')).toBeLessThan(
      policyOwner.indexOf('pendingPolicyRef.current = row.key;'),
    );
    expect(policyOwner.indexOf('pendingPolicyRef.current = row.key;')).toBeLessThan(
      policyOwner.indexOf('recordYouPolicyStart();'),
    );
    expect(policyOwner.indexOf('recordYouPolicyStart();')).toBeLessThan(
      policyOwner.indexOf('opened = await openPolicyUrl(row.url);'),
    );
    expect(policyOwner.indexOf('await waitForDuplicateActivationFrame();')).toBeLessThan(
      policyOwner.indexOf('pendingPolicyRef.current = null;'),
    );
  });

  it('keeps You mutations below memoized route, account, subscription, and static owners', () => {
    const source = readAppRoute('(tabs)/you.tsx');
    const screen = sourceBetween(source, 'export default function YouScreen()', '\n}');
    const shell = sourceBetween(
      source,
      'const YouMutationSections = memo(',
      'export default function YouScreen()',
    );
    const staticOverview = sourceBetween(
      source,
      'const YouStaticOverview = memo(',
      'function ConsentFeedbackText',
    );

    for (const [owner, counter] of [
      ['YouAccountCard', 'recordYouAccountRender'],
      ['YouSubscriptionCard', 'recordYouSubscriptionRender'],
      ['YouStaticOverview', 'recordYouStaticOverviewRender'],
      ['YouCommerceSection', 'recordYouCommerceRender'],
      ['YouSecuritySection', 'recordYouSecurityRender'],
      ['YouPrivacySection', 'recordYouPrivacyRender'],
      ['YouPoliciesSection', 'recordYouPoliciesRender'],
      ['YouDataSection', 'recordYouDataRender'],
    ] as const) {
      expect(source).toContain(`const ${owner} = memo(`);
      expect(source).toContain(`${counter}();`);
    }

    expect(screen).toContain('recordYouScreenRender();');
    expect(screen).toContain('return <YouMutationSections />;');
    expect(screen).not.toMatch(/use(?:State|Query|Auth|Entitlement|AppLock)/);
    expect(shell).toContain('<YouConsentCoordinator>');
    expect(shell).toContain('<YouDataRightsCoordinator');
    expect(shell).not.toMatch(/use(?:Query|Auth|Entitlement|AppLock)/);
    expect(staticOverview).not.toMatch(/use(?:State|Query|Auth|Entitlement|AppLock)/);
    expect(source).not.toContain('useMutation(');

    const consentOwner = sourceBetween(
      source,
      'const YouConsentCoordinator = memo(',
      'const YouDataRightsCoordinator = memo(',
    );
    expect(consentOwner.indexOf('await waitForDuplicateActivationFrame();')).toBeLessThan(
      consentOwner.indexOf('savingPrivacyRef.current = false;'),
    );
  });

  it('keeps You tab For You rows polished and accessible', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain(
      'const forYouRows: { label: string; href: StaticRouteHref; hint?: string }[] = [',
    );
    expect(source).toContain("label: 'Skin Notes'");
    expect(source).toContain("hint: 'Myth vs evidence, reviewed and claim-safe.'");
    expect(source).toContain('label: BRAND.askName');
    expect(source).toContain("hint: 'Your evidence-grounded advisor.'");
    expect(source).toContain(
      '<Row key={href} label={label} hint={hint} onPress={() => router.push(href)} />',
    );
    expect(source).not.toContain('Skin Notes. Myth vs evidence');
    expect(source).not.toContain('Your evidence-grounded advisor`, href');
  });

  it('keeps You tab first-viewport rows clear of the floating tab bar on short phones', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain('Platform');
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const { fontScale = 1, height, width } = useWindowDimensions();');
    expect(source).toContain('const compactPhone = height < 640 || width < 430');
    expect(source).toContain('const supportFloorTextPressureYou =');
    expect(source).toContain(
      "width <= 390 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');",
    );
    expect(source).toContain('const tallTextPressureYou =');
    expect(source).toContain(
      "width <= 430 && height >= 900 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web');",
    );
    expect(source).toContain(
      'const highTextPressureYou = supportFloorTextPressureYou || tallTextPressureYou;',
    );
    expect(source).toContain('const PRIVACY_DIRECT_ENTRY_COMPACT_SCROLL_NUDGE = 0;');
    expect(source).toContain('const shortPhone = compactPhone && height < 600;');
    expect(source).toContain("contentContainerClassName={compactPhone ? 'pb-32' : 'pb-8'}");
    expect(source).toContain("className={compactPhone ? 'mt-1' : 'mt-2'}");
    expect(source).toContain("className={compactPhone ? 'mt-3 p-3' : 'mt-6'}");
    expect(source).toContain("className={compactPhone ? 'mt-2 p-3' : 'mt-4'}");
    expect(source).not.toContain("className={compactPhone ? 'mt-4 p-4' : 'mt-6'}");
    expect(source).not.toContain("className={compactPhone ? 'mt-3 p-4' : 'mt-4'}");
    expect(source).toContain('const accountLabel = isAnonymous ?');
    expect(source).toContain(
      'className="mt-1 min-h-[48px] flex-row items-center justify-between gap-3"',
    );
    expect(source).toContain(
      'className="min-h-[48px] items-center justify-center rounded-pill px-4 py-2"',
    );
    expect(source).toContain('const primaryRoutineRows = highTextPressureYou');
    expect(source).toContain('? routineRows.slice(0, 1)');
    expect(source).toContain('? routineRows.slice(0, 2)');
    expect(source).toContain('? routineRows.slice(0, 3)');
    expect(source).toContain('const secondaryRoutineRows = highTextPressureYou');
    expect(source).toContain('? routineRows.slice(1)');
    expect(source).toContain('? routineRows.slice(2)');
    expect(source).toContain('? routineRows.slice(3)');
    expect(source).toContain('const secondaryRoutineTopMargin = tallTextPressureYou');
    expect(source).toContain('const SUPPORT_FLOOR_SECONDARY_ROUTINE_TOP_MARGIN = 640;');
    expect(source).toContain('const TALL_TEXT_PRESSURE_SECONDARY_ROUTINE_TOP_MARGIN = 640;');
    expect(source).toContain('{primaryRoutineRows.map(({ label, href }) => (');
    expect(source).toContain('{secondaryRoutineRows.length > 0 ? (');
    expect(source).toContain('const COMPACT_SECONDARY_ROUTINE_TOP_MARGIN = 48;');
    expect(source).toContain('const SHORT_PHONE_SECONDARY_ROUTINE_TOP_MARGIN = 104;');
    expect(source).toContain(
      '<Card className="p-3" style={{ marginTop: secondaryRoutineTopMargin }}>',
    );
    expect(source).toContain('marginTop: secondaryRoutineTopMargin');
    expect(source).toContain('? TALL_TEXT_PRESSURE_SECONDARY_ROUTINE_TOP_MARGIN');
    expect(source).toContain('? SUPPORT_FLOOR_SECONDARY_ROUTINE_TOP_MARGIN');
    expect(source).toContain('? SHORT_PHONE_SECONDARY_ROUTINE_TOP_MARGIN');
    expect(source).toContain(': COMPACT_SECONDARY_ROUTINE_TOP_MARGIN');
    expect(source).toContain('MORE ROUTINE');
    expect(source).toContain('const COMPACT_FOR_YOU_TOP_MARGIN = 240');
    expect(source).toContain("className={compactPhone ? undefined : 'mt-4'}");
    expect(source).toContain(
      'style={compactPhone ? { marginTop: COMPACT_FOR_YOU_TOP_MARGIN } : undefined}',
    );
    expect(source.indexOf('COMPACT_FOR_YOU_TOP_MARGIN')).toBeLessThan(
      source.indexOf('function Row'),
    );
    expect(source.indexOf("className={compactPhone ? undefined : 'mt-4'}")).toBeGreaterThan(
      source.indexOf('MORE ROUTINE'),
    );
    expect(source).toContain('compact={compactPhone}');
    expect(source).toContain('style={compact ? { fontSize: 14, lineHeight: 17 } : undefined}');
    expect(source).not.toContain('numberOfLines={compact ? 1 : undefined}');
    expect(source).toContain('style={compact ? { fontSize: 12, lineHeight: 16 } : undefined}');
    expect(source).toMatch(
      /supportFloorPrivacyEntry\s*\|\|\s*ultraShortPrivacyEntry\s*\?\s*undefined\s*:\s*'Off by default\. Opt in anytime\.'/,
    );
    expect(source).toContain('hint={ultraShortPrivacyEntry ? undefined : POLICY_HINTS[row.key]}');
    expect(source).toMatch(
      /hint=\{\s*supportFloorPrivacyEntry\s*\|\|\s*ultraShortPrivacyEntry\s*\?\s*undefined\s*:\s*compactPhone\s*\?\s*'Records withdrawal and deletes collected health data\.'/,
    );
  });

  it('keeps secondary subscription exits buffered above 44px on phones', () => {
    const source = readAppRoute('settings/subscription.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const { height, width } = useWindowDimensions();');
    expect(source).toContain('const ultraShortSubscription = height < 460;');
    expect(source).toContain('const splitShortSubscription = height < 410;');
    expect(source).toContain('const supportFloorSubscription = width <= 320 && height < 520;');
    expect(source).toContain('const compactSubscription = true;');
    expect(source).toContain('const hideFreeSubscriptionBody = true;');
    expect(source).toContain(
      "const freePlanTitle = supportFloorSubscription ? 'Free plan' : PAYWALL_COPY.manage.freeTitle;",
    );
    expect(source).toContain(
      "const upgradeCtaLabel = supportFloorSubscription ? 'See Pro' : PAYWALL_COPY.manage.upgradeCta;",
    );
    expect(source).toContain(
      "const restoreLabel = supportFloorSubscription ? 'Restore' : PAYWALL_COPY.manage.restoreRow;",
    );
    expect(source).toContain('min-h-[44px] flex-row items-center justify-between py-1');
    expect(source).toContain('min-h-[48px] flex-row items-center justify-between py-3.5');
    expect(source).toContain('min-h-[48px] flex-row items-center justify-between py-2.5');
    expect(source).toContain('numberOfLines={supportFloor ? 1 : undefined}');
    expect(source).toContain('style={supportFloor ? { fontSize: 14, lineHeight: 17 } : undefined}');
    expect(source).toContain('compact={compactSubscription}');
    expect(source).toContain(
      "supportFloorSubscription ? 'px-5 pb-4' : compactSubscription ? 'px-5 pb-8' : 'px-5 pb-10'",
    );
    expect(source).toContain('{hideFreeSubscriptionBody ? null : (');
    expect(source).toContain("className={compactSubscription ? 'mt-1.5' : 'mt-2'}");
    expect(source).not.toContain(
      "className={splitShortSubscription ? 'mt-1' : ultraShortSubscription ? 'mt-1.5' : 'mt-2'}",
    );
    expect(source).not.toContain(
      'style={supportFloorSubscription ? { marginTop: 96 } : undefined}',
    );
    expect(source).toContain('mt-4 min-h-[48px] items-center justify-center py-2');
    expect(source).not.toContain('mt-4 min-h-[44px] items-center justify-center py-2');
  });

  it('keeps free subscription settings compliant with restore and policy access', () => {
    const source = readAppRoute('settings/subscription.tsx');

    expect(source).toContain("import { useState } from 'react';");
    expect(source).toContain('const [subscriptionFeedback, setSubscriptionFeedback] = useState<');
    expect(source).toContain('const POLICY_LINK_UNAVAILABLE_MESSAGE =');
    expect(source).toContain('const SUBSCRIPTION_LINK_UNAVAILABLE_MESSAGE =');
    expect(source).toContain('const RESTORE_UNAVAILABLE_MESSAGE =');
    expect(source).toContain('const opened = await openExternalHttpsUrl(url, {');
    expect(source).toContain(
      'if (!opened) setSubscriptionFeedback(SUBSCRIPTION_LINK_UNAVAILABLE_MESSAGE);',
    );
    expect(source).toContain('async function onPolicy(url: string)');
    expect(source).toContain(
      'if (!opened) setSubscriptionFeedback(POLICY_LINK_UNAVAILABLE_MESSAGE);',
    );
    expect(source).toContain('const feedbackLabel = subscriptionFeedback ? (');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('label={restoreLabel}');
    expect(source).toContain('accessibilityLabel={PAYWALL_COPY.manage.restoreRow}');
    expect(source).toContain('label="Terms"');
    expect(source).toContain('label="Privacy"');
    expect(source).toContain('compact={compactSubscription}');
    expect(source).toContain('supportFloor={supportFloorSubscription}');
    expect(source).toContain('{hideFreeSubscriptionBody ? null : (');
    expect(source).not.toContain(
      '<Row label={PAYWALL_COPY.manage.restoreRow} last onPress={onRestore} />',
    );
  });

  it('does not present unresolved or uncertain entitlement evidence as Free', () => {
    const subscription = readAppRoute('settings/subscription.tsx');
    const you = readAppRoute('(tabs)/you.tsx');
    const statusBranch = subscription.indexOf('{entitlementChecking || entitlementUncertain ? (');
    const freeBranch = subscription.indexOf('{freePlanTitle}');
    const restoreRows = subscription.indexOf('label={restoreLabel}', freeBranch);

    expect(subscription).toContain('isEntitlementEvidenceUncertain');
    expect(subscription).toContain('const entitlementChecking = isLoading || (!data && !isError);');
    expect(subscription).toContain(
      'const entitlementUncertain = !data ? isError : isEntitlementEvidenceUncertain(data);',
    );
    expect(subscription).toContain('Plan status unavailable');
    expect(subscription).toContain('Checking your plan');
    expect(subscription).toContain('accessibilityLabel="Retry plan verification"');
    expect(subscription).toContain('onPress={() => void retryVerification()}');
    expect(subscription).toContain('disabled={isVerificationRetrying}');
    expect(subscription).not.toContain('useSubscriptionOffering');
    expect(statusBranch).toBeGreaterThan(-1);
    expect(freeBranch).toBeGreaterThan(statusBranch);
    expect(restoreRows).toBeGreaterThan(freeBranch);
    expect(subscription).toContain(
      '{!entitlementChecking && !entitlementUncertain && data?.expired ? (',
    );

    expect(you).toContain('isLoading: entitlementLoading');
    expect(you).toContain('isError: entitlementError');
    expect(you).toContain('entitlementLoading || (!ent && !entitlementError)');
    expect(you).toContain("? 'Checking plan'");
    expect(you).toContain('const entitlementUncertain = !ent');
    expect(you).toContain(': isEntitlementEvidenceUncertain(ent);');
    expect(you).toContain("? 'Plan status unavailable'");
  });

  it('tracks store-backed cancel intent separately from generic subscription management', () => {
    const source = readAppRoute('settings/subscription.tsx');

    expect(source).toContain("track('manage_subscription_opened')");
    expect(source).toContain('shouldTrackSubscriptionCancelIntent');
    expect(source).toContain('const entitlementState = data;');
    expect(source).toContain(
      'if (entitlementState && shouldTrackSubscriptionCancelIntent(entitlementState))',
    );
    expect(source).toContain("track('subscription_cancel_intent'");
    expect(source).toContain("source: 'subscription_settings'");
    expect(source).toContain('period_type: entitlementState.periodType');
  });

  it('keeps app-granted reverse trials out of OS subscription management', () => {
    const source = readAppRoute('settings/subscription.tsx');

    expect(source).toContain("const isAppGrantedAccess = data?.store === 'app_granted';");
    expect(source).toContain(
      'const isReverseTrialAccess = isAppGrantedAccess && data?.inReverseTrial === true;',
    );
    expect(source).toContain("router.push('/paywall/reoffer')");
    expect(source).toContain("router.push('/paywall/upsell?feature=full_routine')");
    expect(source).toContain('PAYWALL_COPY.reverseTrial.keepCta');
    expect(source).toContain('PAYWALL_COPY.reverseTrial.settingsNote(endDateLabel)');
    expect(source).toContain('PAYWALL_COPY.manage.appGrantedNote(endDateLabel)');
    expect(source).toContain('PAYWALL_COPY.manage.cancelNote(endDateLabel)');
    expect(source).toContain('const statusPillLabel = data?.inReverseTrial');
    expect(source).toContain("? 'No card'");
    expect(source).toContain("? 'Store trial'");
    expect(source).toContain('const manageAction = isAppGrantedAccess');
    expect(source).toContain('const supportNote = isReverseTrialAccess');
    expect(source).toContain(
      '<Row label={manageLabel} onPress={manageAction} compact={compactSubscription} />',
    );
    expect(source).not.toContain('<Row label={manageLabel} onPress={openStore} />');
  });
});
