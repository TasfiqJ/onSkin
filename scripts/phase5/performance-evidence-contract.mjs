import { isAbsolute, posix, resolve } from 'node:path';

import { normalizeNamedSignoff, placeholderEnvValue } from '../phase9/lib.mjs';
import {
  loadLaunchContract,
  platformRequirementStatus,
  requiredReleasePlatforms,
} from '../launch/contract.mjs';

export const PERFORMANCE_EVIDENCE_SCHEMA_VERSION = 4;
export const PERFORMANCE_EVIDENCE_ROOT = 'docs/phase-5/evidence/performance/';
export const PERFORMANCE_MIN_SAMPLE_COUNT = 5;

export const PERFORMANCE_METRICS = [
  { id: 'app_startup_cold_ms', unit: 'ms' },
  { id: 'product_add_manual_three_products_ms', unit: 'ms' },
  { id: 'product_add_search_three_products_ms', unit: 'ms' },
  { id: 'product_add_barcode_three_products_ms', unit: 'ms' },
  { id: 'product_add_ocr_manual_fallback_three_products_ms', unit: 'ms' },
  { id: 'barcode_camera_acquisition_ms', unit: 'ms' },
  { id: 'barcode_decode_ms', unit: 'ms' },
  { id: 'barcode_lookup_ms', unit: 'ms' },
  { id: 'barcode_no_match_recovery_ms', unit: 'ms' },
  { id: 'native_ocr_recognition_ms', unit: 'ms' },
  { id: 'routine_generation_three_products_ms', unit: 'ms' },
  { id: 'routine_generation_five_products_ms', unit: 'ms' },
  { id: 'routine_generation_ten_products_ms', unit: 'ms' },
  { id: 'photo_capture_analysis_ms', unit: 'ms' },
  { id: 'photo_timeline_first_render_ms', unit: 'ms' },
  { id: 'photo_timeline_restart_first_render_ms', unit: 'ms' },
  { id: 'photo_timeline_compare_open_ms', unit: 'ms' },
  { id: 'photo_timeline_peak_memory_mb', unit: 'mb' },
];

const launchContract = loadLaunchContract(resolve(import.meta.dirname, '../..'));
const MEASUREMENT_SOURCES = new Set(['instrumented_timer', 'manual_stopwatch', 'native_profiler']);
const EAS_BUILD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EAS_BUILD_URL =
  /^https:\/\/expo\.dev\/accounts\/[^/\s]+\/projects\/[^/\s]+\/builds\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:[?#].*)?$/i;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function normalizePerformanceEvidencePath(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !value ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.includes('%') ||
    /\s/u.test(value) ||
    isAbsolute(value) ||
    /^[A-Za-z]:/u.test(value) ||
    /^[a-z][a-z0-9+.-]*:/iu.test(value)
  ) {
    return null;
  }
  const normalized = posix.normalize(value);
  if (
    normalized !== value ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
    !normalized.startsWith(PERFORMANCE_EVIDENCE_ROOT) ||
    !normalized.endsWith('.json')
  ) {
    return null;
  }
  return normalized;
}

export function nearestRankPercentile(samples, percentile) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  if (!isPositiveNumber(percentile) || percentile > 1) return null;
  if (!samples.every(isPositiveNumber)) return null;

  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index];
}

export function summarizePerformanceSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0 || !samples.every(isPositiveNumber)) {
    return null;
  }

  return {
    sampleCount: samples.length,
    p50: nearestRankPercentile(samples, 0.5),
    p95: nearestRankPercentile(samples, 0.95),
    max: Math.max(...samples),
  };
}

function timestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function realText(value, minimumLength = 3) {
  const text = String(value ?? '').trim();
  return text.length >= minimumLength && !placeholderEnvValue(text);
}

function realBuildId(value) {
  const text = String(value ?? '').trim();
  return !placeholderEnvValue(text) && (EAS_BUILD_ID.test(text) || EAS_BUILD_URL.test(text));
}

function osMajor(value) {
  const match = String(value ?? '').match(/\b(\d{1,2})(?:\.\d+){0,2}\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function validateDevice(platform, device, errors) {
  const label = platform === 'ios' ? 'iOS' : 'Android';
  if (!isObject(device)) {
    errors.push(`devices.${platform} must be an object.`);
    return;
  }

  if (device.physical !== true) errors.push(`devices.${platform}.physical must be true.`);
  if (!realBuildId(device.buildId)) {
    errors.push(`devices.${platform}.buildId must be a real EAS build UUID or expo.dev build URL.`);
  }

  const model = String(device.deviceModel ?? '').trim();
  if (
    !realText(model) ||
    /\b(simulator|emulator|generic|device model|phone model)\b/i.test(model)
  ) {
    errors.push(`devices.${platform}.deviceModel must name a real physical device model.`);
  }

  const version = String(device.osVersion ?? '').trim();
  const major = osMajor(version);
  const minimumMajor = platform === 'ios' ? 17 : 10;
  if (!new RegExp(platform === 'ios' ? '\\biOS\\b' : '\\bAndroid\\b', 'i').test(version)) {
    errors.push(`devices.${platform}.osVersion must include ${label}.`);
  }
  if (major === null || major < minimumMajor) {
    errors.push(`devices.${platform}.osVersion must be ${label} ${minimumMajor} or newer.`);
  }

  const minimumWidth = platform === 'ios' ? 375 : 360;
  if (!isPositiveNumber(device.logicalWidth) || device.logicalWidth < minimumWidth) {
    errors.push(`devices.${platform}.logicalWidth must be at least ${minimumWidth}.`);
  }
  if (!isPositiveNumber(device.usableHeight) || device.usableHeight < 640) {
    errors.push(`devices.${platform}.usableHeight must be at least 640.`);
  }
}

export function createPerformanceEvidenceTemplate(contract = launchContract) {
  const platforms = requiredReleasePlatforms(contract);
  return {
    schemaVersion: PERFORMANCE_EVIDENCE_SCHEMA_VERSION,
    capturedAt: null,
    gitSha: null,
    thresholdsDefinedAt: null,
    thresholdsDefinedBy: null,
    platformStatus: {
      ios: platformRequirementStatus('ios', contract),
      android: platformRequirementStatus('android', contract),
    },
    devices: Object.fromEntries(
      platforms.map((platform) => [
        platform,
        platform === 'ios'
          ? {
              physical: true,
              buildId: null,
              deviceModel: null,
              osVersion: 'iOS 17.0 or newer',
              logicalWidth: 375,
              usableHeight: 667,
            }
          : {
              physical: true,
              buildId: null,
              deviceModel: null,
              osVersion: 'Android 10 or newer',
              logicalWidth: 360,
              usableHeight: 640,
            },
      ]),
    ),
    photoDataset: {
      encryptedPhotoCount: 50,
      source: null,
      plaintextDeletedAfterImport: true,
      zeroCrashes: null,
      zeroOsTerminations: null,
    },
    thresholds: Object.fromEntries(
      PERFORMANCE_METRICS.map(({ id, unit }) => [id, { unit, maxP95: null, rationale: null }]),
    ),
    measurements: platforms.flatMap((platform) =>
      PERFORMANCE_METRICS.map(({ id: metric }) => ({
        platform,
        metric,
        source: metric === 'photo_timeline_peak_memory_mb' ? 'native_profiler' : null,
        samples: [],
        sampleCount: null,
        p50: null,
        p95: null,
        max: null,
      })),
    ),
    knownCaveats: [],
    signoff: {
      decision: null,
      signedOffBy: null,
      signedAt: null,
    },
  };
}

export function validatePerformanceEvidence(evidence, contract = launchContract) {
  const errors = [];
  const warnings = [];
  const platforms = requiredReleasePlatforms(contract);
  const metricById = new Map(PERFORMANCE_METRICS.map((metric) => [metric.id, metric]));

  if (!isObject(evidence)) {
    return {
      errors: ['Performance evidence must be a JSON object.'],
      warnings,
      summary: { requiredMeasurements: PERFORMANCE_METRICS.length * platforms.length, found: 0 },
    };
  }

  if (evidence.schemaVersion !== PERFORMANCE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PERFORMANCE_EVIDENCE_SCHEMA_VERSION}.`);
  }

  const capturedAt = timestamp(evidence.capturedAt);
  const thresholdsDefinedAt = timestamp(evidence.thresholdsDefinedAt);
  if (capturedAt === null) errors.push('capturedAt must be a valid ISO timestamp.');
  if (thresholdsDefinedAt === null) {
    errors.push('thresholdsDefinedAt must be a valid ISO timestamp.');
  }
  if (capturedAt !== null && thresholdsDefinedAt !== null && thresholdsDefinedAt > capturedAt) {
    errors.push(
      'thresholdsDefinedAt must be before or equal to capturedAt; post-hoc targets are rejected.',
    );
  }

  if (!/^[0-9a-f]{40}$/i.test(String(evidence.gitSha ?? '').trim())) {
    errors.push('gitSha must be the 40-character source commit used by both builds.');
  }
  if (!normalizeNamedSignoff(evidence.thresholdsDefinedBy)) {
    errors.push('thresholdsDefinedBy must name a real owner, not a placeholder.');
  }

  for (const platform of ['ios', 'android']) {
    const expectedStatus = platformRequirementStatus(platform, contract);
    if (evidence.platformStatus?.[platform] !== expectedStatus) {
      errors.push(`platformStatus.${platform} must be ${expectedStatus}.`);
    }
  }

  for (const platform of platforms) {
    validateDevice(platform, evidence.devices?.[platform], errors);
  }

  const photoDataset = evidence.photoDataset;
  if (!isObject(photoDataset)) {
    errors.push('photoDataset must describe the encrypted local-photo load set.');
  } else {
    if (
      !Number.isInteger(photoDataset.encryptedPhotoCount) ||
      photoDataset.encryptedPhotoCount < 50
    ) {
      errors.push('photoDataset.encryptedPhotoCount must be at least 50.');
    }
    if (!realText(photoDataset.source, 8)) {
      errors.push(
        'photoDataset.source must describe the consented or synthetic non-sensitive dataset.',
      );
    }
    if (photoDataset.plaintextDeletedAfterImport !== true) {
      errors.push('photoDataset.plaintextDeletedAfterImport must be true.');
    }
    if (photoDataset.zeroCrashes !== true) errors.push('photoDataset.zeroCrashes must be true.');
    if (photoDataset.zeroOsTerminations !== true) {
      errors.push('photoDataset.zeroOsTerminations must be true.');
    }
  }

  const thresholds = isObject(evidence.thresholds) ? evidence.thresholds : {};
  if (!isObject(evidence.thresholds)) errors.push('thresholds must be an object.');
  for (const metric of PERFORMANCE_METRICS) {
    const threshold = thresholds[metric.id];
    if (!isObject(threshold)) {
      errors.push(`thresholds.${metric.id} is required.`);
      continue;
    }
    if (threshold.unit !== metric.unit) {
      errors.push(`thresholds.${metric.id}.unit must be ${metric.unit}.`);
    }
    if (!isPositiveNumber(threshold.maxP95)) {
      errors.push(
        `thresholds.${metric.id}.maxP95 must be a positive number defined before testing.`,
      );
    }
    if (!realText(threshold.rationale, 20)) {
      errors.push(`thresholds.${metric.id}.rationale must explain the owner-approved target.`);
    }
  }
  for (const metricId of Object.keys(thresholds)) {
    if (!metricById.has(metricId))
      errors.push(`Unknown performance threshold metric: ${metricId}.`);
  }

  const measurements = Array.isArray(evidence.measurements) ? evidence.measurements : [];
  if (!Array.isArray(evidence.measurements)) errors.push('measurements must be an array.');
  const seen = new Set();
  for (const [index, measurement] of measurements.entries()) {
    const prefix = `measurements[${index}]`;
    if (!isObject(measurement)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    if (!platforms.includes(measurement.platform)) {
      errors.push(
        `${prefix}.platform must be a required release platform (${platforms.join(', ')}).`,
      );
      continue;
    }
    const metric = metricById.get(measurement.metric);
    if (!metric) {
      errors.push(`${prefix}.metric is unknown: ${String(measurement.metric)}.`);
      continue;
    }
    const key = `${measurement.platform}:${measurement.metric}`;
    if (seen.has(key)) errors.push(`Duplicate measurement for ${key}.`);
    seen.add(key);

    if (!MEASUREMENT_SOURCES.has(measurement.source)) {
      errors.push(
        `${prefix}.source must be instrumented_timer, manual_stopwatch, or native_profiler.`,
      );
    }
    if (metric.id === 'photo_timeline_peak_memory_mb' && measurement.source !== 'native_profiler') {
      errors.push(`${prefix}.source must be native_profiler for photo timeline memory.`);
    }

    const samples = Array.isArray(measurement.samples) ? measurement.samples : [];
    if (!Array.isArray(measurement.samples)) {
      errors.push(`${prefix}.samples must be an array of raw observations.`);
    }
    for (const [sampleIndex, sample] of samples.entries()) {
      if (!isPositiveNumber(sample)) {
        errors.push(`${prefix}.samples[${sampleIndex}] must be a positive number.`);
      }
    }
    if (samples.length < PERFORMANCE_MIN_SAMPLE_COUNT) {
      errors.push(
        `${prefix}.samples must contain at least ${PERFORMANCE_MIN_SAMPLE_COUNT} raw observations.`,
      );
    }

    const calculated = summarizePerformanceSamples(samples);
    if (!Number.isInteger(measurement.sampleCount) || measurement.sampleCount !== samples.length) {
      errors.push(`${prefix}.sampleCount must equal samples.length (${samples.length}).`);
    }
    for (const field of ['p50', 'p95', 'max']) {
      if (!isPositiveNumber(measurement[field])) {
        errors.push(`${prefix}.${field} must be a positive number.`);
      }
      if (calculated && measurement[field] !== calculated[field]) {
        errors.push(
          `${prefix}.${field} must equal the calculated ${field} (${calculated[field]}).`,
        );
      }
    }
    const threshold = thresholds[metric.id];
    if (
      isObject(threshold) &&
      isPositiveNumber(threshold.maxP95) &&
      calculated &&
      calculated.p95 > threshold.maxP95
    ) {
      errors.push(
        `${key} calculated p95 ${calculated.p95} ${metric.unit} exceeds the approved ${threshold.maxP95} ${metric.unit} threshold.`,
      );
    }
  }

  for (const platform of platforms) {
    for (const metric of PERFORMANCE_METRICS) {
      const key = `${platform}:${metric.id}`;
      if (!seen.has(key)) errors.push(`Missing measurement for ${key}.`);
    }
  }

  if (!Array.isArray(evidence.knownCaveats)) {
    errors.push('knownCaveats must be an array.');
  } else {
    for (const [index, caveat] of evidence.knownCaveats.entries()) {
      if (!realText(caveat, 8)) errors.push(`knownCaveats[${index}] must be meaningful text.`);
    }
  }

  const signoff = evidence.signoff;
  if (!isObject(signoff)) {
    errors.push('signoff must be an object.');
  } else {
    if (
      String(signoff.decision ?? '')
        .trim()
        .toLowerCase() !== 'pass'
    ) {
      errors.push('signoff.decision must be pass only after every calculated threshold passes.');
    }
    if (!normalizeNamedSignoff(signoff.signedOffBy)) {
      errors.push('signoff.signedOffBy must name a real reviewer, not a placeholder.');
    }
    const signedAt = timestamp(signoff.signedAt);
    if (signedAt === null) errors.push('signoff.signedAt must be a valid ISO timestamp.');
    if (capturedAt !== null && signedAt !== null && signedAt < capturedAt) {
      errors.push('signoff.signedAt must be after or equal to capturedAt.');
    }
  }

  if (measurements.length > PERFORMANCE_METRICS.length * platforms.length) {
    warnings.push(
      'Extra measurements were supplied; each platform/metric pair must remain unique.',
    );
  }

  return {
    errors,
    warnings,
    summary: {
      requiredMeasurements: PERFORMANCE_METRICS.length * platforms.length,
      found: seen.size,
      metrics: PERFORMANCE_METRICS.length,
      platforms: platforms.length,
    },
  };
}
