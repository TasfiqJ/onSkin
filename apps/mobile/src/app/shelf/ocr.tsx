import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import {
  parseIngredientText,
  type ParsedIngredientToken,
} from '@/features/catalog/ingredientParser';
import { tagLabel } from '@/features/intelligence/presentation';
import { CAMERA_FAILURE_COPY } from '@/features/native/camera/failureCopy';
import { useIntake } from '@/features/shelf/IntakeContext';
import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { openAppSettings } from '@/lib/navigation/appSettings';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

type CaptureState = 'camera' | 'capturing' | 'review';

function primaryTag(token: ParsedIngredientToken): string {
  return token.tags[0] ? tagLabel(token.tags[0]) : 'Review';
}

export default function OcrScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [state, setState] = useState<CaptureState>('camera');
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const { update } = useIntake();

  const cameraEnabled = env.nativeCameraEnabled && Platform.OS !== 'web';
  const canShowCamera = cameraEnabled && Boolean(permission?.granted) && !cameraUnavailable;
  const parsed = useMemo(() => parseIngredientText(rawText), [rawText]);
  const activeTokens = parsed.tokens.filter((token) => token.tags.length > 0);
  const lowConfidence = parsed.tokens.find((token) => token.isUnmatched);
  const canContinue = rawText.trim().length > 0;

  const capture = async () => {
    if (!cameraRef.current || state === 'capturing') return;
    haptics.select();
    setState('capturing');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.72,
        base64: false,
        exif: false,
        shutterSound: false,
      });
      setCapturedUri(photo.uri);
      setState('review');
      track('label_capture_photo_taken', { native_ocr_enabled: env.nativeOcrEnabled });
    } catch {
      setState('camera');
      Alert.alert(CAMERA_FAILURE_COPY.labelCaptureTitle, CAMERA_FAILURE_COPY.labelCaptureBody);
    }
  };

  const onContinue = () => {
    if (!canContinue) return;
    haptics.select();
    track('ingredient_parse_completed', {
      source: 'ocr_label_capture',
      native_ocr_enabled: env.nativeOcrEnabled,
      result: parsed.status,
      count: parsed.tokens.length,
    });
    update({
      ingredients: parsed.tokens.map((token) => token.displayName),
      addedVia: 'ocr',
      ingredientParseStatus: parsed.status,
      ingredientParseConfidence: parsed.confidence,
      parserVersion: parsed.parserVersion,
    });
    if (capturedUri) void FileSystem.deleteAsync(capturedUri, { idempotent: true });
    router.replace('/shelf/manual');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold">
          Read the label
        </Text>
        <View className="w-[44px]" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={state === 'review' ? 'pb-24' : 'pb-5'}
      >
        <View className="mt-4 h-[230px] overflow-hidden rounded-[18px] bg-night-elevated">
          {state === 'review' && capturedUri ? (
            <Image source={{ uri: capturedUri }} style={{ flex: 1 }} contentFit="cover" />
          ) : canShowCamera ? (
            <CameraView
              ref={cameraRef}
              active={isFocused}
              animateShutter
              facing="back"
              mode="picture"
              onMountError={() => {
                setCameraUnavailable(true);
                setState('review');
                Alert.alert(
                  CAMERA_FAILURE_COPY.labelUnavailableTitle,
                  CAMERA_FAILURE_COPY.labelUnavailableBody,
                );
              }}
              style={{ flex: 1 }}
            />
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text variant="body" tone="inverse" className="text-center font-sans-semibold">
                {cameraUnavailable
                  ? CAMERA_FAILURE_COPY.labelUnavailableTitle
                  : 'Capture the ingredient panel'}
              </Text>
              <Text variant="bodySm" tone="inverseMuted" className="mt-2 text-center">
                {cameraUnavailable
                  ? CAMERA_FAILURE_COPY.labelUnavailableBody
                  : 'Camera permission lets you keep the label beside the editable text. Manual entry still works.'}
              </Text>
              {cameraEnabled && permission && !permission.granted ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={
                    permission.canAskAgain
                      ? () => void requestPermission()
                      : () => void openAppSettings()
                  }
                  className="mt-5 rounded-pill bg-paper px-5 py-3"
                >
                  <Text className="font-sans-semibold text-night">
                    {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <View
            className="absolute left-5 right-5 top-[64px] h-[96px] rounded-[10px]"
            style={{ pointerEvents: 'none', borderWidth: 2, borderColor: 'rgba(217,161,131,0.65)' }}
          />
        </View>

        <View className="mt-3 rounded-[14px] bg-greige-chip p-3.5">
          <Text variant="bodySm" tone="muted" style={{ lineHeight: 19 }}>
            {env.nativeOcrEnabled
              ? 'On-device OCR is enabled for this build. Check the text before saving.'
              : 'On-device OCR is not enabled in this build yet. Use the captured label as a reference, then type or paste the ingredients below.'}
          </Text>
        </View>

        {state !== 'review' ? (
          <Button
            label={
              state === 'capturing'
                ? 'Capturing...'
                : canShowCamera
                  ? 'Capture label'
                  : 'Continue with manual text'
            }
            onPress={canShowCamera ? () => void capture() : () => setState('review')}
          />
        ) : null}

        {state === 'review' ? (
          <>
            <Text variant="eyebrow" tone="clay" className="mt-5">
              Editable label text
            </Text>
            <TextInput
              accessibilityLabel="Ingredient label text"
              value={rawText}
              onChangeText={setRawText}
              multiline
              placeholder="Type or paste the INCI list from the label"
              placeholderTextColor={colors.mutedLight}
              className="mt-2 min-h-[132px] rounded-[16px] border border-hairline bg-paper-raised p-4 font-sans text-[14px] leading-5 text-ink"
              textAlignVertical="top"
            />

            {rawText.trim().length > 0 ? (
              <>
                <Text variant="bodySm" tone="muted" className="mt-3">
                  Parser confidence: {Math.round(parsed.confidence * 100)}%. Low-confidence tokens
                  stay visible for review.
                </Text>
                <Text variant="eyebrow" tone="clay" className="mt-4">
                  Parsed actives
                </Text>
                <View className="mt-2.5 gap-2">
                  {activeTokens.map((token) => (
                    <View
                      key={token.rawToken}
                      className="flex-row items-center gap-3 rounded-[14px] border border-hairline bg-paper-raised p-3.5"
                    >
                      <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-clay">
                        <Text className="text-[10px] text-paper">{'\u2713'}</Text>
                      </View>
                      <Text variant="bodySm" className="flex-1 font-sans-semibold">
                        {token.displayName}
                      </Text>
                      <Text variant="label" tone="muted">
                        {primaryTag(token)}
                      </Text>
                    </View>
                  ))}
                  {lowConfidence ? (
                    <View
                      className="flex-row items-center gap-3 rounded-[14px] border border-dashed bg-greige-chip p-3.5"
                      style={{ borderColor: 'rgba(32,27,21,0.18)' }}
                    >
                      <View className="h-[18px] w-[18px] rounded-full border-[1.5px] border-muted-light" />
                      <Text variant="bodySm" tone="muted" className="flex-1 font-sans-semibold">
                        &quot;{lowConfidence.rawToken}&quot;. Not sure
                      </Text>
                      <Text variant="bodySm" tone="clay" className="font-sans-semibold">
                        Edit text
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </>
        ) : state === 'capturing' ? (
          <View className="mt-4 flex-row items-center gap-2">
            <ActivityIndicator />
            <Text variant="bodySm" tone="muted">
              Capturing label
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {state === 'review' ? (
        <Button label="Looks right. Continue" onPress={onContinue} disabled={!canContinue} />
      ) : null}
    </Screen>
  );
}
