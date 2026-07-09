import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { lookupBarcode, type CatalogProductSummary } from '@/features/catalog/client';
import { parseIngredientText } from '@/features/catalog/ingredientParser';
import {
  normalizeScannedBarcode,
  PRODUCT_BARCODE_TYPES,
  shouldSuppressDuplicate,
  type DuplicateBarcodeGate,
} from '@/features/native/camera/barcode';
import { CAMERA_FAILURE_COPY } from '@/features/native/camera/failureCopy';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { useIntake } from '@/features/shelf/IntakeContext';
import type { ProductCategory } from '@/features/shelf/categories';
import { recordShelfScan, shelfScanResultFromLookup } from '@/features/shelf/scanLog';
import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { openAppSettings } from '@/lib/navigation/appSettings';
import { APP_SHELF_ROUTE } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'looking_up'; barcode: string }
  | { kind: 'matched'; barcode: string; product: CatalogProductSummary; external: boolean }
  | { kind: 'no_match'; barcode: string }
  | { kind: 'offline'; barcode: string }
  | { kind: 'error'; barcode: string; reason: string };

function devShelfScanFixtureState(): ScanState | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT?.trim().toLowerCase();
  const barcode = process.env.EXPO_PUBLIC_E2E_SHELF_SCAN_BARCODE?.trim() || '012345678905';

  switch (fixture) {
    case 'matched':
    case 'external_candidate':
      return {
        kind: 'matched',
        barcode,
        external: fixture === 'external_candidate',
        product: {
          id: fixture === 'external_candidate' ? 'e2e-external-product' : 'e2e-catalog-product',
          barcode,
          name: 'Mineral SPF 50',
          brand: 'RoutineKind Fixture',
          category: 'sunscreen',
          default_pao_months: 12,
          source: fixture === 'external_candidate' ? 'open_beauty_facts' : 'routinekind_fixture',
          source_ref: fixture,
          source_url: null,
          source_snapshot_date: null,
          quality_grade: fixture === 'external_candidate' ? 'unverified' : 'usable',
          review_status: fixture === 'external_candidate' ? 'external_candidate' : 'reviewed',
          data_quality_score: fixture === 'external_candidate' ? 45 : 82,
          ingredient_parse_status: 'empty',
          ingredient_parse_confidence: null,
          rawIngredientsText: null,
          external: fixture === 'external_candidate',
        },
      };
    case 'no_match':
      return { kind: 'no_match', barcode };
    case 'offline':
      return { kind: 'offline', barcode };
    case 'error':
      return { kind: 'error', barcode, reason: 'Lookup failed. Add it another way.' };
    default:
      return null;
  }
}

function devShelfCameraPermissionMode(): 'denied_no_retry' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION === 'denied_no_retry'
    ? 'denied_no_retry'
    : null;
}

function activeIngredients(product: CatalogProductSummary): {
  ingredients: string[];
  status: ReturnType<typeof parseIngredientText>['status'] | null;
  confidence: number | null;
  parserVersion: string | null;
} {
  if (!product.rawIngredientsText) {
    return {
      ingredients: [],
      status: product.ingredient_parse_status as never,
      confidence: product.ingredient_parse_confidence ?? null,
      parserVersion: null,
    };
  }
  const parsed = parseIngredientText(product.rawIngredientsText);
  return {
    ingredients: parsed.tokens.map((token) => token.displayName),
    status: parsed.status,
    confidence: parsed.confidence,
    parserVersion: parsed.parserVersion,
  };
}

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const { height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const { reset } = useIntake();
  const [torch, setTorch] = useState(false);
  const [state, setState] = useState<ScanState>(
    () => devShelfScanFixtureState() ?? { kind: 'idle' },
  );
  const [cameraReady, setCameraReady] = useState(false);
  const [settingsOpenFailed, setSettingsOpenFailed] = useState(false);
  const lastScan = useRef<DuplicateBarcodeGate | null>(null);

  const cameraPermissionMode = devShelfCameraPermissionMode();
  const forceDeniedCameraPermission = cameraPermissionMode === 'denied_no_retry';
  const cameraEnabled = env.nativeCameraEnabled && Platform.OS !== 'web';
  const permissionGranted = forceDeniedCameraPermission ? false : Boolean(permission?.granted);
  const canAskCameraPermission = forceDeniedCameraPermission
    ? false
    : (permission?.canAskAgain ?? true);
  const canShowPermissionRecovery =
    !permissionGranted && (forceDeniedCameraPermission || (cameraEnabled && Boolean(permission)));
  const canShowCamera = cameraEnabled && permissionGranted;
  const compactScanSurface = height < 640;
  const splitShortScanSurface = height < 460;
  const showScanPreview = !splitShortScanSurface || canShowCamera;

  const goManual = () => {
    haptics.select();
    trackProductAddStarted('scan_manual');
    reset({ addedVia: 'manual' });
    router.push('/shelf/manual');
  };
  const goOcr = () => {
    haptics.select();
    trackProductAddStarted('scan_label');
    reset({ addedVia: 'ocr' });
    router.push('/shelf/ocr');
  };
  const goSearch = () => {
    haptics.select();
    trackProductAddStarted('scan_search');
    reset({ addedVia: 'search' });
    router.push('/shelf/search');
  };

  const applyProduct = (product: CatalogProductSummary, barcode: string) => {
    const parsed = activeIngredients(product);
    reset({
      name: product.name,
      brand: product.brand,
      category: (product.category as ProductCategory | null) ?? null,
      barcode,
      catalogProductId: product.id,
      catalogSourceId: product.source_ref ?? null,
      catalogSource: product.source,
      catalogSourceName: product.source,
      catalogSourceRef: product.source_ref ?? null,
      catalogSourceUrl: product.source_url ?? null,
      catalogSourceSnapshotDate: product.source_snapshot_date ?? null,
      catalogMatchQuality: (product.quality_grade as never) ?? null,
      dataQualityScore: product.data_quality_score ?? null,
      ingredientParseStatus: parsed.status ?? (product.ingredient_parse_status as never) ?? null,
      ingredientParseConfidence: parsed.confidence ?? product.ingredient_parse_confidence ?? null,
      parserVersion: parsed.parserVersion,
      ingredients: parsed.ingredients,
      paoMonths: product.default_pao_months ?? null,
      paoSource: product.default_pao_months ? 'catalog' : 'unknown',
      sourceDisclosureAckAt: new Date().toISOString(),
      addedVia: 'barcode',
    });
    haptics.success();
    router.replace('/shelf/opened');
  };

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    const normalized = normalizeScannedBarcode(result.data, result.type);
    if (!normalized) return;
    const now = Date.now();
    if (shouldSuppressDuplicate(lastScan.current, normalized.lookupValue, now)) return;
    lastScan.current = { barcode: normalized.lookupValue, atMs: now };

    if (normalized.validChecksum === false) {
      setState({
        kind: 'invalid',
        reason: 'That read failed the barcode checksum. Try holding steady in brighter light.',
      });
      track('barcode_decode_rejected', { reason: 'checksum', barcode_type: normalized.type });
      return;
    }

    setState({ kind: 'looking_up', barcode: normalized.lookupValue });
    track('barcode_decode_success', { barcode_type: normalized.type });
    void lookupBarcode(normalized.lookupValue)
      .then((response) => {
        const scanResult = shelfScanResultFromLookup(response.result);
        void recordShelfScan({
          barcode: normalized.lookupValue,
          result: scanResult,
          matchedProductId: 'product' in response ? response.product.id : null,
        });

        if (response.result === 'matched' || response.result === 'external_candidate') {
          setState({
            kind: 'matched',
            barcode: normalized.lookupValue,
            product: response.product,
            external: response.result === 'external_candidate',
          });
          return;
        }
        if (response.result === 'no_match' || response.result === 'too_short') {
          setState({ kind: 'no_match', barcode: normalized.lookupValue });
          return;
        }
        if (response.result === 'offline') {
          setState({ kind: 'offline', barcode: normalized.lookupValue });
          return;
        }
        setState({
          kind: 'error',
          barcode: normalized.lookupValue,
          reason: 'Lookup failed. Add it another way.',
        });
      })
      .catch(() => {
        void recordShelfScan({
          barcode: normalized.lookupValue,
          result: shelfScanResultFromLookup('lookup_error'),
        });
        setState({
          kind: 'error',
          barcode: normalized.lookupValue,
          reason: 'Lookup failed. Add it another way.',
        });
      });
  };

  const requestCamera = () => {
    haptics.select();
    setSettingsOpenFailed(false);
    void requestPermission();
  };

  const openShelfCameraSettings = async () => {
    haptics.select();
    setSettingsOpenFailed(false);
    const opened = await openAppSettings({
      failureTitle: CAMERA_FAILURE_COPY.shelfSettingsTitle,
      failureMessage: CAMERA_FAILURE_COPY.shelfSettingsBody,
      alertOnFailure: false,
    });
    if (!opened) setSettingsOpenFailed(true);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-night">
      <View
        className="flex-1 px-6"
        style={[
          splitShortScanSurface ? { minHeight: 68 } : undefined,
          { position: 'relative', zIndex: 2 },
        ]}
      >
        <View
          className="mt-2 flex-row items-center justify-between"
          style={{ position: 'relative', zIndex: 20 }}
        >
          <RouteIconButton
            accessibilityLabel="Close"
            glyph="x"
            tone="night"
            onPress={() => router.replace(APP_SHELF_ROUTE)}
          />
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: torch }}
            disabled={!canShowCamera}
            onPress={() => setTorch((value) => !value)}
            className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
          >
            <Text variant="label" tone={canShowCamera ? 'inverseMuted' : 'muted'}>
              torch
            </Text>
          </Pressable>
        </View>

        {showScanPreview ? (
          <View className="flex-1 items-center justify-center">
            <View
              className={
                splitShortScanSurface
                  ? 'h-[96px] w-full overflow-hidden rounded-[18px] bg-night-elevated'
                  : compactScanSurface
                    ? 'h-[152px] w-full overflow-hidden rounded-[20px] bg-night-elevated'
                    : 'h-[320px] w-full overflow-hidden rounded-[20px] bg-night-elevated'
              }
            >
              {canShowCamera ? (
                <CameraView
                  active={isFocused}
                  animateShutter={false}
                  barcodeScannerSettings={{ barcodeTypes: PRODUCT_BARCODE_TYPES }}
                  enableTorch={torch}
                  facing="back"
                  onBarcodeScanned={
                    state.kind === 'looking_up' || state.kind === 'matched'
                      ? undefined
                      : onBarcodeScanned
                  }
                  onCameraReady={() => setCameraReady(true)}
                  onMountError={() =>
                    setState({
                      kind: 'error',
                      barcode: '',
                      reason: 'Camera could not start on this device.',
                    })
                  }
                  style={{ flex: 1 }}
                />
              ) : (
                <View className="flex-1 items-center justify-center px-7">
                  <Text variant="body" tone="inverse" className="text-center font-sans-semibold">
                    Camera permission is needed for barcode scanning.
                  </Text>
                  <Text variant="bodySm" tone="inverseMuted" className="mt-2 text-center">
                    You can still search, scan the label path, or add by hand.
                  </Text>
                  {canShowPermissionRecovery ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={
                        canAskCameraPermission
                          ? requestCamera
                          : () => void openShelfCameraSettings()
                      }
                      className="mt-5 min-h-[48px] items-center justify-center rounded-pill bg-paper px-5 py-3"
                    >
                      <Text className="font-sans-semibold text-night">
                        {canAskCameraPermission ? 'Allow camera' : 'Open settings'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {settingsOpenFailed ? (
                    <View
                      accessibilityRole="alert"
                      className="mt-4 w-full rounded-[14px] p-3.5"
                      style={{
                        borderWidth: 1,
                        borderColor: 'rgba(217,161,131,0.45)',
                        backgroundColor: 'rgba(217,161,131,0.14)',
                      }}
                    >
                      <Text variant="bodySm" tone="inverse" className="font-sans-semibold">
                        {CAMERA_FAILURE_COPY.shelfSettingsTitle}
                      </Text>
                      <Text variant="bodySm" tone="inverseMuted" className="mt-1">
                        {CAMERA_FAILURE_COPY.shelfSettingsBody}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
              {canShowCamera ? (
                <View
                  className={
                    splitShortScanSurface
                      ? 'absolute left-8 right-8 top-[34px] h-8 rounded-[12px]'
                      : compactScanSurface
                        ? 'absolute left-8 right-8 top-[54px] h-11 rounded-[14px]'
                        : 'absolute left-8 right-8 top-[118px] h-28 rounded-[18px]'
                  }
                  style={{
                    pointerEvents: 'none',
                    borderWidth: 2,
                    borderColor: cameraReady ? 'rgba(157,177,138,0.9)' : 'rgba(244,239,231,0.45)',
                  }}
                />
              ) : null}
            </View>
            {!compactScanSurface ? (
              <>
                <Text variant="body" tone="inverseMuted" className="mt-5">
                  Line up the barcode
                </Text>
                <View className="mt-3 flex-row items-center gap-2">
                  <View className="h-1.5 w-1.5 rounded-full bg-clay-bright" />
                  <Text variant="label" tone="inverseMuted">
                    Decoding happens on your device
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      <View
        className={
          splitShortScanSurface
            ? 'rounded-t-sheet bg-night-surface px-5 pb-4 pt-3'
            : compactScanSurface
              ? 'rounded-t-sheet bg-night-surface px-5 pb-4 pt-3'
              : 'rounded-t-sheet bg-night-surface px-7 pb-10 pt-6'
        }
        style={{ position: 'relative', zIndex: 1 }}
      >
        {state.kind === 'looking_up' ? (
          <View className="mb-4 flex-row items-center gap-3">
            <ActivityIndicator />
            <Text variant="bodySm" tone="inverseMuted">
              Looking up barcode {state.barcode}
            </Text>
          </View>
        ) : state.kind === 'matched' ? (
          <View className="mb-4 rounded-[16px] bg-paper/10 p-4">
            <Text variant="label" tone="inverseMuted">
              {state.external ? 'External source candidate' : 'Catalog match'}
            </Text>
            <Text variant="body" tone="inverse" className="mt-1 font-sans-semibold">
              {state.product.brand ? `${state.product.brand} ` : ''}
              {state.product.name}
            </Text>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => applyProduct(state.product, state.barcode)}
                className="flex-1 items-center rounded-pill bg-paper px-4 py-3"
              >
                <Text className="font-sans-semibold text-night">Add this</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/shelf/no-match')}
                className="items-center rounded-pill px-4 py-3"
                style={{ backgroundColor: 'rgba(244,239,231,0.1)' }}
              >
                <Text tone="inverseMuted" className="font-sans-semibold">
                  Wrong
                </Text>
              </Pressable>
            </View>
          </View>
        ) : state.kind === 'no_match' ? (
          <Text variant="bodySm" tone="inverseMuted" className="mb-4">
            Barcode {state.barcode} is not in the catalog yet. Add it another way, then report the
            miss if you want.
          </Text>
        ) : state.kind === 'offline' ? (
          <Text variant="bodySm" tone="inverseMuted" className="mb-4">
            Couldn&apos;t reach the product catalog for barcode {state.barcode}. Search by name,
            scan the label, or add it by hand; the shelf still works offline.
          </Text>
        ) : state.kind === 'invalid' || state.kind === 'error' ? (
          <Text variant="bodySm" tone="inverseMuted" className="mb-4">
            {state.reason}
          </Text>
        ) : state.kind === 'idle' && compactScanSurface ? null : (
          <Text variant="bodySm" tone="inverseMuted" className="mb-4">
            Scan a UPC or EAN barcode, or use a fallback. No third-party product lookup is called
            from the app.
          </Text>
        )}

        <View className={compactScanSurface ? 'gap-1.5' : 'gap-2.5'}>
          <FallbackRow
            icon="="
            title={compactScanSurface ? 'Scan label' : 'Scan ingredient label'}
            subtitle="Review editable OCR"
            accessibilityLabel="Scan ingredient label. Review editable OCR"
            compact={compactScanSurface}
            hideSubtitle={compactScanSurface}
            onPress={goOcr}
          />
          <FallbackRow
            icon="S"
            title="Search catalog"
            subtitle="Use reviewed matches"
            compact={compactScanSurface}
            hideSubtitle={compactScanSurface}
            onPress={goSearch}
          />
          <FallbackRow
            icon="+"
            title="Add it by hand"
            subtitle="Always works offline"
            compact={compactScanSurface}
            hideSubtitle={compactScanSurface}
            onPress={goManual}
          />
        </View>
        {state.kind === 'no_match' && (
          <Pressable
            accessibilityRole="button"
            className="mt-5 items-center py-1"
            onPress={() => {
              haptics.select();
              router.push('/shelf/no-match');
            }}
          >
            <Text variant="label" tone="inverseMuted">
              Product not found
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function FallbackRow({
  icon,
  title,
  subtitle,
  accessibilityLabel,
  compact,
  hideSubtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  accessibilityLabel?: string;
  compact?: boolean;
  hideSubtitle?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}
      onPress={onPress}
      className={
        compact
          ? 'min-h-[48px] flex-row items-center gap-2.5 rounded-[15px] px-2.5 py-1.5'
          : 'flex-row items-center gap-3.5 rounded-[18px] p-4'
      }
      style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}
    >
      <View
        className={
          compact
            ? 'h-8 w-8 items-center justify-center rounded-[9px] bg-clay-bright/20'
            : 'h-9 w-9 items-center justify-center rounded-[10px] bg-clay-bright/20'
        }
      >
        <Text className="font-sans-bold text-clay-bright">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text
          variant="body"
          tone="inverse"
          className="font-sans-semibold"
          numberOfLines={compact ? 1 : undefined}
        >
          {title}
        </Text>
        {hideSubtitle ? null : (
          <Text variant="bodySm" tone="inverseMuted" numberOfLines={compact ? 1 : undefined}>
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
