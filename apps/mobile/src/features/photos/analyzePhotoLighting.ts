import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { assessLighting, type LightingAssessment } from './captureAnalysis';

const SAMPLE_WIDTH = 64;

/**
 * Downsamples the captured local file before decoding so JS only inspects a
 * tiny image. The temporary sample is deleted immediately after measurement.
 */
export async function analyzePhotoLighting(uri: string): Promise<LightingAssessment> {
  const sample = await manipulateAsync(uri, [{ resize: { width: SAMPLE_WIDTH } }], {
    compress: 0.72,
    format: SaveFormat.JPEG,
  });
  const sampleFile = new File(sample.uri);
  try {
    const bytes = await sampleFile.bytes();
    const decoded = decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 16,
    });
    return assessLighting(decoded);
  } finally {
    try {
      sampleFile.delete();
    } catch {
      // Cache cleanup is best effort; the original captured file is untouched.
    }
  }
}
