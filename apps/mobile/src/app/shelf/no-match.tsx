import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle, useWindowDimensions } from 'react-native';

import { Button, RouteIconButton, Sheet, Text } from '@/components/ui';
import { CatalogReportConfirmation } from '@/features/catalog/CatalogReportConfirmation';
import { reportCatalogIssue } from '@/features/catalog/client';
import { barcodeRecoveryReportInput } from '@/features/catalog/recoveryReport';
import {
  cancelCatalogReportOperation,
  createCatalogReportOperation,
  finishCatalogReportOperation,
  markCatalogReportOperationAttempted,
  type CatalogReportOperation,
} from '@/features/catalog/reportOperation';
import {
  catalogReportFeedback,
  type CatalogReportFeedback,
} from '@/features/catalog/reportPresentation';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { useIntake } from '@/features/shelf/IntakeContext';
import { cn } from '@/lib/cn';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// A barcode miss is never a dead end. Contribution-back is not promised until
// the source workflow is approved.
export default function NoMatchScreen() {
  const { reset } = useIntake();
  const params = useLocalSearchParams<{ barcode?: string; wrongProductId?: string }>();
  const { height, width } = useWindowDimensions();
  const reportSubmissionInFlight = useRef(false);
  const [confirmingReport, setConfirmingReport] = useState(false);
  const [reportOperation, setReportOperation] = useState<CatalogReportOperation | null>(null);
  const [reportingMissingProduct, setReportingMissingProduct] = useState(false);
  const [missingProductFeedback, setMissingProductFeedback] =
    useState<CatalogReportFeedback | null>(null);
  const barcode =
    typeof params.barcode === 'string' && params.barcode.trim().length > 0
      ? params.barcode.trim()
      : null;
  const wrongProductId =
    typeof params.wrongProductId === 'string' && params.wrongProductId.trim().length > 0
      ? params.wrongProductId.trim()
      : null;
  const reportDraft = barcodeRecoveryReportInput({ barcode, wrongProductId });
  const shortPhone = height < 700 || width <= 430;
  const ultraShortPhone = height < 560 || width <= 320;
  const supportFloorPhone = width <= 320 && height < 520;
  const splitShortPhone = height < 410;
  const microShortPhone = height < 380;
  const tallTextPressurePhone =
    (width <= 430 && height >= 900 && height < 980) ||
    (height <= 430 && width >= 900 && width < 980);
  const compactPressurePhone = shortPhone;
  const showScanRecovery = !supportFloorPhone;
  const compactSecondaryRecoveryStyle = microShortPhone ? { marginTop: 24 } : undefined;
  const compactScanRecoveryStyle = undefined;
  const compactManualRecoveryStyle = supportFloorPhone
    ? undefined
    : microShortPhone
      ? { marginTop: 40 }
      : tallTextPressurePhone
        ? { marginTop: 64 }
        : undefined;

  const goOcr = () => {
    if (reportingMissingProduct) return;
    haptics.select();
    trackProductAddStarted('miss_label');
    reset({ addedVia: 'ocr', barcode });
    router.replace('/shelf/ocr');
  };
  const goSearch = () => {
    if (reportingMissingProduct) return;
    haptics.select();
    trackProductAddStarted('miss_search');
    reset({ addedVia: 'search', barcode });
    router.replace('/shelf/search');
  };
  const goManual = () => {
    if (reportingMissingProduct) return;
    haptics.select();
    trackProductAddStarted('miss_manual');
    reset({ addedVia: 'manual', barcode });
    router.replace('/shelf/manual');
  };
  const openReportConfirmation = () => {
    if (!reportDraft || reportSubmissionInFlight.current) return;
    setReportOperation((current) => current ?? createCatalogReportOperation(reportDraft));
    setMissingProductFeedback(null);
    setConfirmingReport(true);
  };
  const reportMissingProduct = async () => {
    if (!reportOperation || reportSubmissionInFlight.current || reportingMissingProduct) return;
    const attempted = markCatalogReportOperationAttempted(reportOperation);
    setReportOperation(attempted);
    reportSubmissionInFlight.current = true;
    setReportingMissingProduct(true);
    setMissingProductFeedback(null);
    try {
      const outcome = await reportCatalogIssue(attempted.input);
      setReportOperation(finishCatalogReportOperation(attempted, outcome));
      setMissingProductFeedback(catalogReportFeedback(outcome));
    } catch {
      setReportOperation(attempted);
      setMissingProductFeedback(catalogReportFeedback({ result: 'offline_or_withdrawn' }));
    } finally {
      setConfirmingReport(false);
      setReportingMissingProduct(false);
      reportSubmissionInFlight.current = false;
    }
  };

  return (
    <Sheet
      tone="night"
      fallbackRoute={APP_SHELF_ROUTE}
      scroll
      backdropAccessible={false}
      className={
        microShortPhone
          ? 'min-h-[320px] px-6 pb-2 pt-2'
          : splitShortPhone
            ? 'min-h-[320px] px-6 pb-3 pt-2'
            : shortPhone
              ? 'min-h-[340px] px-6 pb-4 pt-2'
              : undefined
      }
    >
      <View
        className={cn(
          microShortPhone
            ? 'absolute right-0 top-0 z-10'
            : ultraShortPhone
              ? 'mb-0'
              : shortPhone
                ? 'mb-1'
                : 'mb-4',
          microShortPhone ? undefined : 'flex-row items-start justify-between',
        )}
      >
        {microShortPhone ? null : (
          <View
            className={cn(
              shortPhone ? 'h-9 w-9' : 'h-12 w-12',
              'items-center justify-center rounded-full',
            )}
            style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}
          >
            <Text className={shortPhone ? 'text-[15px]' : 'text-[18px]'} tone="inverseMuted">
              ?
            </Text>
          </View>
        )}
        <RouteIconButton
          accessibilityLabel="Close"
          disabled={reportingMissingProduct}
          glyph="x"
          tone="night"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
      </View>
      <Text
        variant="title"
        tone="inverse"
        className={
          microShortPhone
            ? 'pr-12 text-[19px] leading-[22px]'
            : ultraShortPhone
              ? 'text-[21px] leading-[24px]'
              : shortPhone
                ? 'text-[24px] leading-[27px]'
                : 'text-[30px] leading-[33px]'
        }
        accessibilityRole="header"
      >
        {wrongProductId
          ? 'Not the right product.'
          : compactPressurePhone
            ? 'Not found yet.'
            : 'We don&apos;t have this one yet.'}
      </Text>
      {!shortPhone ? (
        <Text
          variant="body"
          tone="inverseMuted"
          className={shortPhone ? 'mt-1 text-[12px] leading-[17px]' : 'mt-2'}
        >
          {wrongProductId
            ? 'Choose another way to add it, and optionally report the wrong catalog match.'
            : "That barcode isn't in our database yet. No problem. Add it another way, then report any wrong details from the product page."}
        </Text>
      ) : null}

      <View
        className={
          microShortPhone
            ? 'mt-1 gap-1'
            : splitShortPhone
              ? 'mt-2 gap-1'
              : shortPhone
                ? 'mt-2 gap-1'
                : 'mt-4 gap-2'
        }
      >
        <NoMatchAction
          icon="S"
          title="Search catalog"
          subtitle="Try name or brand instead"
          compact={shortPhone}
          ultraCompact={shortPhone}
          hideSubtitle={ultraShortPhone}
          disabled={reportingMissingProduct}
          onPress={goSearch}
        />
        {showScanRecovery ? (
          <View style={compactSecondaryRecoveryStyle}>
            <NoMatchAction
              icon="I"
              title={compactPressurePhone ? 'Add ingredients' : 'Add the ingredient list'}
              subtitle="Take a label photo or type it"
              accessibilityLabel="Add the ingredient list. Take a label photo or type it"
              compact={shortPhone}
              ultraCompact={shortPhone}
              hideSubtitle={compactPressurePhone}
              disabled={reportingMissingProduct}
              style={compactScanRecoveryStyle}
              onPress={goOcr}
            />
          </View>
        ) : null}
        <View style={compactManualRecoveryStyle}>
          <NoMatchAction
            icon="+"
            title="Add it by hand"
            subtitle="Always works, even offline"
            compact={shortPhone}
            ultraCompact={shortPhone}
            hideSubtitle={ultraShortPhone}
            disabled={reportingMissingProduct}
            onPress={goManual}
          />
        </View>
      </View>

      <View className={shortPhone ? 'mt-3' : 'mt-4'}>
        {reportDraft ? (
          <Button
            label={wrongProductId ? 'Report wrong match' : 'Report missing product'}
            variant="inverse"
            disabled={reportingMissingProduct}
            className={shortPhone ? 'min-h-[48px] py-3' : undefined}
            onPress={openReportConfirmation}
          />
        ) : null}
        {confirmingReport && reportOperation ? (
          <View className="mt-2.5">
            <CatalogReportConfirmation
              input={reportOperation.input}
              busy={reportingMissingProduct}
              tone="night"
              onCancel={() => {
                setReportOperation((current) => cancelCatalogReportOperation(current));
                setConfirmingReport(false);
              }}
              onConfirm={() => void reportMissingProduct()}
            />
          </View>
        ) : null}
        {missingProductFeedback ? (
          <View
            accessibilityRole="alert"
            className="mt-2.5 rounded-[14px] px-4 py-3"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(217,161,131,0.42)',
              backgroundColor: 'rgba(217,161,131,0.12)',
            }}
          >
            <Text variant="label" tone="inverse">
              {missingProductFeedback.title}
            </Text>
            <Text variant="bodySm" tone="inverseMuted" className="mt-1">
              {missingProductFeedback.message}
            </Text>
          </View>
        ) : null}
      </View>

      {!shortPhone ? (
        <View className="mt-5 flex-row items-center justify-center gap-2">
          <View
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.sageMuted }}
          />
          <Text variant="label" tone="inverseMuted">
            manual fallback keeps the shelf working
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

function NoMatchAction({
  icon,
  title,
  subtitle,
  accessibilityLabel,
  compact,
  ultraCompact,
  hideSubtitle = false,
  disabled = false,
  style,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  accessibilityLabel?: string;
  compact: boolean;
  ultraCompact: boolean;
  hideSubtitle?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        ultraCompact
          ? 'min-h-[48px] gap-2.5 rounded-[15px] px-2.5 py-1.5'
          : compact
            ? 'min-h-[54px] gap-3 rounded-[16px] p-2.5'
            : 'gap-3.5 rounded-[18px] p-3',
        'flex-row items-center',
      )}
      style={[{ backgroundColor: 'rgba(244,239,231,0.08)', opacity: disabled ? 0.45 : 1 }, style]}
    >
      <View
        className={cn(
          ultraCompact
            ? 'h-[30px] w-[30px] rounded-[9px]'
            : compact
              ? 'h-8 w-8 rounded-[9px]'
              : 'h-[34px] w-[34px] rounded-[10px]',
          'items-center justify-center bg-clay-bright/20',
        )}
      >
        <Text className="font-sans-bold text-clay-bright">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text
          variant="body"
          tone="inverse"
          className={
            ultraCompact
              ? 'text-[13px] leading-[17px] font-sans-semibold'
              : compact
                ? 'text-[14px] leading-[18px] font-sans-semibold'
                : 'font-sans-semibold'
          }
        >
          {title}
        </Text>
        {hideSubtitle ? null : (
          <Text
            variant="bodySm"
            tone="inverseMuted"
            className={
              ultraCompact
                ? 'text-[11px] leading-[14px]'
                : compact
                  ? 'text-[12px] leading-[16px]'
                  : undefined
            }
            numberOfLines={ultraCompact ? 1 : undefined}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
