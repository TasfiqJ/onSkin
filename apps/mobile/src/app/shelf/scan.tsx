import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import {
  catalogIntakeProvenance,
  lookupBarcode,
  type CatalogProductSummary,
} from '@/features/catalog/client';
import { sourceDisplayName } from '@/features/catalog/copy';
import { parseIngredientText } from '@/features/catalog/ingredientParser';
import {
  normalizeScannedBarcode,
  PRODUCT_BARCODE_TYPES,
  shouldSuppressDuplicate,
  type DuplicateBarcodeGate,
} from '@/features/native/camera/barcode';
import {
  CAMERA_FAILURE_COPY,
  CAMERA_PERMISSION_FAILURE_COPY,
} from '@/features/native/camera/failureCopy';
import { useCameraAccessLifecycle } from '@/features/native/camera/useCameraAccessLifecycle';
import { labelOcrNativeAvailability } from '@/features/native/ocr';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { useIntake } from '@/features/shelf/IntakeContext';
import type { ProductCategory } from '@/features/shelf/categories';
import { recordShelfScan, shelfScanResultFromLookup } from '@/features/shelf/scanLog';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { env } from '@/lib/env';
import { openAppSettings } from '@/lib/navigation/appSettings';
import { APP_SHELF_ROUTE } from '@/lib/navigation/safeBack';
import { enqueueCatalogLookup } from '@/lib/offline/catalogLookupQueue';
import { haptics } from '@/theme/haptics';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'looking_up'; barcode: string }
  | { kind: 'matched'; barcode: string; product: CatalogProductSummary }
  | { kind: 'no_match'; barcode: string }
  | { kind: 'offline'; barcode: string }
  | { kind: 'error'; barcode: string; reason: string };

type QueueFeedback =
  | { kind: 'idle' }
  | { kind: 'saving'; barcode: string }
  | { kind: 'saved'; barcode: string; alreadyQueued: boolean }
  | { kind: 'error'; barcode: string };

type TorchSession = Readonly<{
  cameraGeneration: number;
  enabled: boolean;
}>;

type DuplicateScanSession = Readonly<{
  cameraGeneration: number;
  gate: DuplicateBarcodeGate;
}>;

function devShelfScanFixtureState(): ScanState | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT?.trim().toLowerCase();
  const barcode = process.env.EXPO_PUBLIC_E2E_SHELF_SCAN_BARCODE?.trim() || '012345678905';

  switch (fixture) {
    case 'matched':
      return {
        kind: 'matched',
        barcode,
        product: {
          id: '00000000-0000-4000-8000-000000000044',
          barcode,
          name: 'Mineral SPF 50',
          brand: 'Layerwell Fixture',
          category: 'sunscreen',
          region: 'US',
          default_pao_months: 12,
          source: 'layerwell_fixture',
          catalog_source_id: '00000000-0000-4000-8000-000000000043',
          source_ref: fixture,
          source_url: null,
          source_snapshot_date: null,
          quality_grade: 'usable',
          review_status: 'reviewed',
          data_quality_score: 82,
          ingredient_parse_status: 'empty',
          ingredient_parse_confidence: null,
          product_pao_expiry: [
            {
              pao_months: 12,
              pao_source: 'catalog',
              expiry_date: null,
              expiry_source: 'unknown',
              region: 'US',
              source_id: '00000000-0000-4000-8000-000000000043',
              review_status: 'reviewed',
              created_at: '2026-07-09T00:00:00.000Z',
            },
          ],
          rawIngredientsText: null,
        },
      };
    case 'external_candidate':
      return {
        kind: 'error',
        barcode,
        reason: 'This catalog response is not eligible. Add it another way.',
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

function noMatchRoute(barcode: string, wrongProductId?: string | null) {
  return {
    pathname: '/shelf/no-match' as const,
    params: {
      barcode,
      ...(wrongProductId ? { wrongProductId } : {}),
    },
  };
}

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const { height, width } = useWindowDimensions();
  const cameraPermissionMode = devShelfCameraPermissionMode();
  const forceDeniedCameraPermission = cameraPermissionMode === 'denied_no_retry';
  const cameraEnabled = env.nativeCameraEnabled && Platform.OS !== 'web';
  const {
    permission,
    permissionBusy,
    permissionFailure,
    permissionGranted: lifecyclePermissionGranted,
    canAskAgain: lifecycleCanAskAgain,
    shouldMountCamera,
    cameraActive,
    cameraReady,
    cameraUnavailable,
    canCapture,
    cameraGeneration,
    cameraKey,
    refreshCameraPermission,
    requestCameraPermission,
    retryCameraMount,
    onCameraReady,
    onCameraMountError,
    beginCameraOperation,
    isCameraOperationCurrent,
  } = useCameraAccessLifecycle({
    available: cameraEnabled && !forceDeniedCameraPermission,
    isFocused,
    mountAllowed: cameraEnabled && !forceDeniedCameraPermission,
    autoRequestOnUndetermined: true,
  });
  const { reset } = useIntake();
  const [torchSession, setTorchSession] = useState<TorchSession>({
    cameraGeneration: -1,
    enabled: false,
  });
  const [scanState, setState] = useState<ScanState>(
    () => devShelfScanFixtureState() ?? { kind: 'idle' },
  );
  const [lookupCameraGeneration, setLookupCameraGeneration] = useState<number | null>(null);
  const [settingsOpenFailed, setSettingsOpenFailed] = useState(false);
  const [queueFeedback, setQueueFeedback] = useState<QueueFeedback>({ kind: 'idle' });
  const lastScan = useRef<DuplicateScanSession | null>(null);
  const queueRequestId = useRef(0);
  const lookupRequestId = useRef(0);

  const permissionGranted = forceDeniedCameraPermission ? false : lifecyclePermissionGranted;
  const canAskCameraPermission = forceDeniedCameraPermission ? false : lifecycleCanAskAgain;
  const permissionRecoveryFailed = permissionFailure !== null;
  const canRetryCameraPermission = permissionFailure === 'refresh_failed' || canAskCameraPermission;
  const canShowPermissionRecovery =
    forceDeniedCameraPermission ||
    (cameraEnabled && (permissionRecoveryFailed || (!permissionGranted && Boolean(permission))));
  const permissionFailureCopy =
    permissionFailure === null ? null : CAMERA_PERMISSION_FAILURE_COPY[permissionFailure];
  const canShowCamera = cameraEnabled && permissionGranted;
  const canUseCameraControls = canShowCamera && canCapture;
  const labelOcrAvailable = env.nativeOcrEnabled && labelOcrNativeAvailability() === 'configured';
  const supportFloorTextPressureScan = width <= 430 && height >= 640 && height <= 700;
  const compactScanSurface = height < 640 || supportFloorTextPressureScan;
  const splitShortScanSurface = height < 460;
  const showScanPreview = !splitShortScanSurface || canShowCamera;
  const torch =
    cameraActive && torchSession.cameraGeneration === cameraGeneration && torchSession.enabled;
  // A lookup belongs to the exact camera generation that decoded it. Route
  // blur/background invalidates that generation in the shared lifecycle, so
  // stale work becomes idle without an effect-driven state cascade.
  const state: ScanState =
    scanState.kind === 'looking_up' &&
    (!cameraActive || lookupCameraGeneration !== cameraGeneration)
      ? { kind: 'idle' }
      : scanState;
  const recoveryBarcode = 'barcode' in state && state.barcode ? state.barcode : null;
  const canQueueRetry =
    recoveryBarcode !== null && (state.kind === 'offline' || state.kind === 'error');

  const cancelActiveLookup = () => {
    lookupRequestId.current += 1;
    setState((current) => (current.kind === 'looking_up' ? { kind: 'idle' } : current));
  };

  const goManual = () => {
    cancelActiveLookup();
    haptics.select();
    trackProductAddStarted('scan_manual');
    const intakeId = reset({ addedVia: 'manual', barcode: recoveryBarcode });
    router.push({ pathname: '/shelf/manual', params: { intakeId } });
  };
  const goOcr = () => {
    cancelActiveLookup();
    haptics.select();
    trackProductAddStarted('scan_label');
    const intakeId = reset({ addedVia: 'ocr', barcode: recoveryBarcode });
    router.push({ pathname: '/shelf/ocr', params: { intakeId } });
  };
  const goSearch = () => {
    cancelActiveLookup();
    haptics.select();
    trackProductAddStarted('scan_search');
    const intakeId = reset({ addedVia: 'search', barcode: recoveryBarcode });
    router.push({ pathname: '/shelf/search', params: { intakeId } });
  };

  const applyProduct = (product: CatalogProductSummary, barcode: string) => {
    const parsed = activeIngredients(product);
    const provenance = catalogIntakeProvenance(product);
    const intakeId = reset({
      name: product.name,
      brand: product.brand,
      category: (product.category as ProductCategory | null) ?? null,
      barcode,
      catalogProductId: product.id,
      catalogSourceId: provenance.catalogSourceId,
      catalogSource: product.source,
      catalogSourceName: product.catalog_sources?.display_name ?? sourceDisplayName(product.source),
      catalogSourceRef: product.source_ref ?? null,
      catalogSourceUrl: product.source_url ?? null,
      catalogSourceSnapshotDate: product.source_snapshot_date ?? null,
      catalogMatchQuality: (product.quality_grade as never) ?? null,
      dataQualityScore: product.data_quality_score ?? null,
      ingredientParseStatus: parsed.status ?? (product.ingredient_parse_status as never) ?? null,
      ingredientParseConfidence: parsed.confidence ?? product.ingredient_parse_confidence ?? null,
      parserVersion: parsed.parserVersion,
      ingredients: parsed.ingredients,
      paoMonths: provenance.paoMonths,
      paoSource: provenance.paoSource,
      expiryDate: provenance.expiryDate,
      sourceDisclosureAckAt: new Date().toISOString(),
      addedVia: 'barcode',
    });
    haptics.success();
    router.replace({ pathname: '/shelf/opened', params: { intakeId } });
  };

  const queueRetryWhenOnline = async () => {
    if (!canQueueRetry || !recoveryBarcode || queueFeedback.kind === 'saving') return;
    haptics.select();
    const requestId = ++queueRequestId.current;
    setQueueFeedback({ kind: 'saving', barcode: recoveryBarcode });
    try {
      const ownerUserId = activeHealthProcessingOwnerUserId();
      if (!ownerUserId) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
      const result = await enqueueCatalogLookup({ ownerUserId, barcode: recoveryBarcode });
      if (requestId !== queueRequestId.current) return;
      setQueueFeedback({
        kind: 'saved',
        barcode: result.barcode,
        alreadyQueued: !result.enqueued,
      });
      if (result.enqueued) void recordShelfScan({ result: 'offline_queued' });
      track('catalog_lookup_retry_saved', {
        result: result.enqueued ? 'queued' : 'already_queued',
      });
      haptics.success();
    } catch {
      if (requestId !== queueRequestId.current) return;
      setQueueFeedback({ kind: 'error', barcode: recoveryBarcode });
      track('catalog_lookup_retry_saved', { result: 'failed' });
    }
  };

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    // Native callbacks can already be queued when AppState/focus invalidates
    // the rendered closure. Acquire the ref-fenced session before parsing,
    // analytics, duplicate bookkeeping, or any visible state mutation.
    const cameraOperation = beginCameraOperation();
    if (cameraOperation === null) return;
    const normalized = normalizeScannedBarcode(result.data, result.type);
    if (!normalized) return;
    const now = Date.now();
    const duplicateGate =
      lastScan.current?.cameraGeneration === cameraOperation.cameraGeneration
        ? lastScan.current.gate
        : null;
    if (shouldSuppressDuplicate(duplicateGate, normalized.lookupValue, now)) return;
    lastScan.current = {
      cameraGeneration: cameraOperation.cameraGeneration,
      gate: { barcode: normalized.lookupValue, atMs: now },
    };
    queueRequestId.current += 1;
    setQueueFeedback({ kind: 'idle' });

    if (normalized.validChecksum === false) {
      setState({
        kind: 'invalid',
        reason: 'That read failed the barcode checksum. Try holding steady in brighter light.',
      });
      track('barcode_decode_rejected', { reason: 'checksum', barcode_type: normalized.type });
      return;
    }

    const requestId = ++lookupRequestId.current;
    const lookupIsCurrent = () =>
      requestId === lookupRequestId.current && isCameraOperationCurrent(cameraOperation);

    setLookupCameraGeneration(cameraOperation.cameraGeneration);
    setState({ kind: 'looking_up', barcode: normalized.lookupValue });
    track('barcode_decode_success', { barcode_type: normalized.type });
    void lookupBarcode(normalized.lookupValue)
      .then((response) => {
        if (!lookupIsCurrent()) return;
        const scanResult = shelfScanResultFromLookup(response.result);
        if (scanResult !== null) void recordShelfScan({ result: scanResult });

        if (response.result === 'matched') {
          setState({
            kind: 'matched',
            barcode: normalized.lookupValue,
            product: response.product,
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
        if (!lookupIsCurrent()) return;
        setState({
          kind: 'error',
          barcode: normalized.lookupValue,
          reason: 'Lookup failed. Add it another way.',
        });
      });
  };

  const requestCamera = async () => {
    haptics.select();
    setSettingsOpenFailed(false);
    try {
      if (permissionFailure === 'refresh_failed') {
        await refreshCameraPermission();
      } else {
        await requestCameraPermission();
      }
    } catch {
      // The shared lifecycle publishes claim-safe retry state; native details
      // must never reach logs or route copy.
    }
  };

  const retryCamera = () => {
    haptics.select();
    retryCameraMount();
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
            onPress={() => {
              cancelActiveLookup();
              router.replace(APP_SHELF_ROUTE);
            }}
          />
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: torch }}
            disabled={!canUseCameraControls}
            onPress={() =>
              setTorchSession((current) => ({
                cameraGeneration,
                enabled: current.cameraGeneration === cameraGeneration ? !current.enabled : true,
              }))
            }
            className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
          >
            <Text variant="label" tone={canUseCameraControls ? 'inverseMuted' : 'muted'}>
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
                  : supportFloorTextPressureScan && canShowPermissionRecovery
                    ? 'h-[320px] w-full overflow-hidden rounded-[20px] bg-night-elevated'
                    : compactScanSurface
                      ? 'h-[152px] w-full overflow-hidden rounded-[20px] bg-night-elevated'
                      : 'h-[320px] w-full overflow-hidden rounded-[20px] bg-night-elevated'
              }
            >
              {cameraUnavailable && canShowCamera ? (
                <View className="flex-1 items-center justify-center px-5">
                  <Text variant="body" tone="inverse" className="text-center font-sans-semibold">
                    Camera couldn&apos;t start
                  </Text>
                </View>
              ) : shouldMountCamera ? (
                <CameraView
                  key={cameraKey}
                  active={cameraActive}
                  animateShutter={false}
                  barcodeScannerSettings={{ barcodeTypes: PRODUCT_BARCODE_TYPES }}
                  enableTorch={torch && cameraActive}
                  facing="back"
                  onBarcodeScanned={
                    !canCapture || state.kind === 'looking_up' || state.kind === 'matched'
                      ? undefined
                      : onBarcodeScanned
                  }
                  onCameraReady={onCameraReady}
                  onMountError={onCameraMountError}
                  style={{ flex: 1 }}
                />
              ) : (
                <View className="flex-1 items-center justify-center px-7">
                  {permissionFailureCopy ? (
                    <View accessibilityRole="alert">
                      <Text
                        variant="body"
                        tone="inverse"
                        className="text-center font-sans-semibold"
                      >
                        {permissionFailureCopy.title}
                      </Text>
                      <Text variant="bodySm" tone="inverseMuted" className="mt-2 text-center">
                        {permissionFailureCopy.body}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text
                        variant="body"
                        tone="inverse"
                        className="text-center font-sans-semibold"
                      >
                        {permissionGranted
                          ? 'Checking camera access.'
                          : 'Camera permission is needed for barcode scanning.'}
                      </Text>
                      <Text variant="bodySm" tone="inverseMuted" className="mt-2 text-center">
                        You can still search, scan the label path, or add by hand.
                      </Text>
                    </>
                  )}
                  {canShowPermissionRecovery ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: permissionBusy,
                        disabled: permissionBusy,
                      }}
                      disabled={permissionBusy}
                      onPress={
                        canRetryCameraPermission
                          ? () => void requestCamera()
                          : () => void openShelfCameraSettings()
                      }
                      className="mt-5 min-h-[48px] items-center justify-center rounded-pill bg-paper px-5 py-3"
                    >
                      <Text className="font-sans-semibold text-night">
                        {permissionBusy
                          ? 'Checking...'
                          : permissionFailure === 'refresh_failed'
                            ? 'Try again'
                            : permissionRecoveryFailed && canAskCameraPermission
                              ? 'Try again'
                              : canAskCameraPermission
                                ? 'Continue'
                                : 'Open settings'}
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
              {shouldMountCamera ? (
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
        {cameraUnavailable ? (
          <View
            accessibilityRole="alert"
            className="mb-3 flex-row items-center gap-3 rounded-[14px] bg-paper/10 p-3"
          >
            <Text variant="bodySm" tone="inverseMuted" className="min-w-0 flex-1">
              The camera did not start. Search, label scan, and manual add still work.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try barcode camera again"
              onPress={retryCamera}
              className="min-h-[48px] items-center justify-center rounded-pill bg-paper px-4 py-2"
            >
              <Text variant="bodySm" className="font-sans-semibold text-night">
                Try camera again
              </Text>
            </Pressable>
          </View>
        ) : null}

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
              Catalog match
            </Text>
            <Text variant="body" tone="inverse" className="mt-1 font-sans-semibold">
              {state.product.brand ? `${state.product.brand} ` : ''}
              {state.product.name}
            </Text>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => applyProduct(state.product, state.barcode)}
                className="min-h-[48px] flex-1 items-center justify-center rounded-pill bg-paper px-4 py-3"
              >
                <Text className="font-sans-semibold text-night">Add this</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(noMatchRoute(state.barcode, state.product.id))}
                className="min-h-[48px] items-center justify-center rounded-pill px-4 py-3"
                style={{ backgroundColor: 'rgba(244,239,231,0.1)' }}
              >
                <Text tone="inverseMuted" className="font-sans-semibold">
                  Not this product
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

        {canQueueRetry && queueFeedback.kind !== 'saved' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retry barcode ${recoveryBarcode} when online`}
            accessibilityHint="Saves an encrypted first-party catalog retry on this device"
            accessibilityState={{
              disabled: queueFeedback.kind === 'saving',
              busy: queueFeedback.kind === 'saving',
            }}
            disabled={queueFeedback.kind === 'saving'}
            onPress={() => void queueRetryWhenOnline()}
            className="mb-3 min-h-[48px] items-center justify-center rounded-pill border border-paper/20 bg-paper/10 px-4 py-2.5"
          >
            <Text variant="bodySm" tone="inverse" className="font-sans-semibold">
              {queueFeedback.kind === 'saving' ? 'Saving retry...' : 'Retry when online'}
            </Text>
          </Pressable>
        ) : null}

        {queueFeedback.kind === 'saved' && queueFeedback.barcode === recoveryBarcode ? (
          <View
            accessibilityRole="alert"
            className="mb-3 rounded-[14px] px-3.5 py-2.5"
            style={{ backgroundColor: 'rgba(157,177,138,0.18)' }}
          >
            <Text variant="bodySm" tone="inverse">
              {queueFeedback.alreadyQueued
                ? 'This barcode is already saved for retry. Review its match from Shelf when it is ready.'
                : `Retry saved on this device. We will check the ${BRAND.appName} catalog when the app is online.`}
            </Text>
          </View>
        ) : queueFeedback.kind === 'error' && queueFeedback.barcode === recoveryBarcode ? (
          <View
            accessibilityRole="alert"
            className="mb-3 rounded-[14px] px-3.5 py-2.5"
            style={{ backgroundColor: 'rgba(217,161,131,0.16)' }}
          >
            <Text variant="bodySm" tone="inverse">
              Couldn&apos;t save this retry. Nothing was added or changed. Try again.
            </Text>
          </View>
        ) : null}

        <View className={compactScanSurface ? 'gap-1.5' : 'gap-2.5'}>
          <FallbackRow
            icon="="
            title={compactScanSurface ? 'Scan label' : 'Scan ingredient label'}
            subtitle={
              labelOcrAvailable
                ? 'Read on this iPhone, then review'
                : 'Capture label, then type from it'
            }
            accessibilityLabel={
              labelOcrAvailable
                ? 'Scan ingredient label. Read text on this iPhone, then review it'
                : 'Scan ingredient label. Capture label, then type from it'
            }
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
            className="mt-2.5 min-h-[48px] items-center justify-center py-1"
            onPress={() => {
              haptics.select();
              router.push(noMatchRoute(state.barcode));
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
