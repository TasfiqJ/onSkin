import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import {
  cleanupPlaintextStaging,
  isImageManipulatorPlaintextCleanupError,
  isCanonicalImageManipulatorJpegName,
  markPlaintextStagingState,
  reservePlaintextStaging,
  retryPlaintextStagingRecovery,
  runPlaintextImageManipulatorOperation,
  type PlaintextStagingHandle,
} from '@/lib/storage/plaintextStaging';

import { assessLighting, type LightingAssessment, type RgbaImage } from './captureAnalysis';
import { PhotoAnalysisCleanupError, type CaptureAnalysisControl } from './photoAnalysisCleanup';

const SAMPLE_WIDTH = 64;

type AnalyzerDependencies = Readonly<{
  cacheDirectory: string | null;
  cleanup: (handle: PlaintextStagingHandle) => Promise<void>;
  decodeJpeg: (bytes: Uint8Array) => RgbaImage;
  deleteAsync: (uri: string, options: { idempotent: true }) => Promise<void>;
  manipulate: (uri: string) => Promise<{ uri: string }>;
  markWritten: (handle: PlaintextStagingHandle) => Promise<void>;
  moveAsync: (options: { from: string; to: string }) => Promise<void>;
  readBytes: (uri: string) => Promise<Uint8Array>;
  reserve: () => Promise<PlaintextStagingHandle>;
  retryRecovery: () => Promise<unknown>;
  runGeneratedOperation: <T>(operation: () => Promise<T>) => Promise<T>;
}>;

export function trustedImageManipulatorJpegUri(
  value: unknown,
  cacheDirectory: string | null | undefined,
): string | null {
  if (typeof value !== 'string' || !cacheDirectory?.startsWith('file://')) return null;
  const directory = `${cacheDirectory.replace(/\/+$/u, '')}/ImageManipulator/`;
  if (!value.startsWith(directory)) return null;
  const name = value.slice(directory.length);
  return isCanonicalImageManipulatorJpegName(name) ? value : null;
}

async function cleanupOwnedSample(
  deps: AnalyzerDependencies,
  handle: PlaintextStagingHandle,
  generatedUri: string | null,
): Promise<void> {
  const results = await Promise.allSettled([
    generatedUri ? deps.deleteAsync(generatedUri, { idempotent: true }) : Promise.resolve(),
    deps.cleanup(handle),
  ]);
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failed) throw failed.reason;
}

export function createPhotoLightingAnalyzer(deps: AnalyzerDependencies) {
  return async function run(
    uri: string,
    control?: CaptureAnalysisControl,
  ): Promise<LightingAssessment> {
    let handle: PlaintextStagingHandle;
    try {
      handle = await deps.reserve();
    } catch (error) {
      throw new PhotoAnalysisCleanupError(async () => {
        await deps.retryRecovery();
      }, error);
    }
    let generatedUri: string | null = null;
    let primaryError: unknown = null;
    let assessment: LightingAssessment | null = null;

    try {
      await deps.runGeneratedOperation(async () => {
        control?.assertActive();
        const generated = await deps.manipulate(uri);
        generatedUri = trustedImageManipulatorJpegUri(generated.uri, deps.cacheDirectory);
        if (generatedUri === null) throw new Error('PHOTO_ANALYSIS_SAMPLE_URI_UNTRUSTED');
        await deps.moveAsync({ from: generatedUri, to: handle.uri });
        generatedUri = null;
        await deps.markWritten(handle);
      });
      control?.assertActive();
      const bytes = await deps.readBytes(handle.uri);
      control?.assertActive();
      assessment = assessLighting(deps.decodeJpeg(bytes));
    } catch (error) {
      // The serialized generated-file coordinator owns any package-cache file
      // once its operation rejects. Do not race a following manipulation by
      // deleting from this outer continuation.
      generatedUri = null;
      primaryError = isImageManipulatorPlaintextCleanupError(error)
        ? new PhotoAnalysisCleanupError(error.retryCleanup, error)
        : error;
    }

    const retryCleanup = () => cleanupOwnedSample(deps, handle, generatedUri);
    try {
      await retryCleanup();
    } catch (cleanupError) {
      throw new PhotoAnalysisCleanupError(retryCleanup, cleanupError);
    }
    if (primaryError !== null) throw primaryError;
    return assessment!;
  };
}

const defaultAnalyzer = createPhotoLightingAnalyzer({
  cacheDirectory: FileSystem.cacheDirectory,
  cleanup: cleanupPlaintextStaging,
  decodeJpeg: (bytes) =>
    decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 16,
    }),
  deleteAsync: FileSystem.deleteAsync,
  manipulate: (uri) =>
    manipulateAsync(uri, [{ resize: { width: SAMPLE_WIDTH } }], {
      compress: 0.72,
      format: SaveFormat.JPEG,
    }),
  markWritten: (handle) => markPlaintextStagingState(handle, 'plaintext_written'),
  moveAsync: FileSystem.moveAsync,
  readBytes: (uri) => new File(uri).bytes(),
  reserve: () => reservePlaintextStaging('photo_analysis_jpeg'),
  retryRecovery: retryPlaintextStagingRecovery,
  runGeneratedOperation: runPlaintextImageManipulatorOperation,
});

/** Measures a tiny local sample and resolves only after plaintext cleanup succeeds. */
export function analyzePhotoLighting(
  uri: string,
  control?: CaptureAnalysisControl,
): Promise<LightingAssessment> {
  return defaultAnalyzer(uri, control);
}
