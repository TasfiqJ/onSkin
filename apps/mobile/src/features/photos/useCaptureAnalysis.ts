import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { analyzePhotoLighting } from './analyzePhotoLighting';
import {
  assessFraming,
  captureAnalysisStatus,
  checkingFraming,
  checkingLighting,
  type CaptureAnalysis,
  type FramingAssessment,
  type LightingAssessment,
  unavailableFraming,
  unavailableLighting,
} from './captureAnalysis';
import { useDetectedFaces } from './useDetectedFaces';

const ANALYSIS_TIMEOUT_MS = 7_000;

export type CaptureAnalysisFixture = 'matched' | 'adjust' | 'no_face' | 'unavailable';

type LightingRun = {
  uri: string | null;
  assessment: LightingAssessment;
};

function fixtureAnalysis(fixture: CaptureAnalysisFixture): CaptureAnalysis {
  if (fixture === 'unavailable') {
    return {
      status: 'unavailable',
      framing: unavailableFraming(),
      lighting: unavailableLighting(),
    };
  }
  if (fixture === 'no_face') {
    return {
      status: 'complete',
      framing: {
        ...unavailableFraming(),
        state: 'no_face',
      },
      lighting: {
        state: 'good',
        score: 0.86,
        meanLuminance: 0.58,
        sideDifference: 0.05,
        clippedFraction: 0.02,
      },
    };
  }
  if (fixture === 'adjust') {
    return {
      status: 'complete',
      framing: {
        state: 'adjust',
        score: 0.48,
        headRoll: 4,
        headYaw: 17,
        headPitch: 3,
        centerOffsetX: 0.2,
        centerOffsetY: 0.08,
        faceHeightRatio: 0.46,
      },
      lighting: {
        state: 'too_dark',
        score: 0.41,
        meanLuminance: 0.2,
        sideDifference: 0.08,
        clippedFraction: 0.22,
      },
    };
  }
  return {
    status: 'complete',
    framing: {
      state: 'matched',
      score: 0.91,
      headRoll: 1,
      headYaw: 2,
      headPitch: -1,
      centerOffsetX: 0.02,
      centerOffsetY: 0.03,
      faceHeightRatio: 0.56,
    },
    lighting: {
      state: 'good',
      score: 0.88,
      meanLuminance: 0.56,
      sideDifference: 0.04,
      clippedFraction: 0.03,
    },
  };
}

export function devCaptureAnalysisFixture(
  value: string | undefined,
): CaptureAnalysisFixture | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  if (process.env.EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_ANALYSIS !== 'enabled') return null;
  return value === 'matched' || value === 'adjust' || value === 'no_face' || value === 'unavailable'
    ? value
    : null;
}

export function useCaptureAnalysis({
  uri,
  width,
  height,
  fixtureName,
}: {
  uri: string | null;
  width: number | null;
  height: number | null;
  fixtureName?: string;
}): CaptureAnalysis {
  const fixture = useMemo(() => devCaptureAnalysisFixture(fixtureName), [fixtureName]);
  const analysisUri = Platform.OS !== 'web' && fixture == null && uri ? uri : undefined;
  const faceResult = useDetectedFaces(analysisUri);
  const [lightingRun, setLightingRun] = useState<LightingRun>({
    uri: null,
    assessment: unavailableLighting(),
  });
  const [timedOutUri, setTimedOutUri] = useState<string | null>(null);
  const faceAnalysisTerminal =
    faceResult.status === 'done' ||
    faceResult.status === 'error' ||
    faceResult.status === 'unavailable';
  const analysisTerminal = faceAnalysisTerminal && lightingRun.uri === analysisUri;

  useEffect(() => {
    if (!analysisUri) return;
    let cancelled = false;
    void analyzePhotoLighting(analysisUri)
      .then((assessment) => {
        if (!cancelled) setLightingRun({ uri: analysisUri, assessment });
      })
      .catch(() => {
        if (!cancelled) {
          setLightingRun({ uri: analysisUri, assessment: unavailableLighting() });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [analysisUri]);

  useEffect(() => {
    if (!analysisUri || analysisTerminal) return;
    const timer = setTimeout(() => setTimedOutUri(analysisUri), ANALYSIS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [analysisTerminal, analysisUri]);

  if (fixture) return fixtureAnalysis(fixture);
  if (!analysisUri || width == null || height == null) {
    return {
      status: 'unavailable',
      framing: unavailableFraming(),
      lighting: unavailableLighting(),
    };
  }

  let framing: FramingAssessment;
  if (timedOutUri === analysisUri) {
    framing = unavailableFraming();
  } else if (faceResult.status === 'done') {
    framing = assessFraming(faceResult.faces, { width, height });
  } else if (faceResult.status === 'error' || faceResult.status === 'unavailable') {
    framing = unavailableFraming();
  } else {
    framing = checkingFraming();
  }

  const currentLighting =
    lightingRun.uri === analysisUri ? lightingRun.assessment : checkingLighting();
  const lighting = timedOutUri === analysisUri ? unavailableLighting() : currentLighting;

  return {
    status: captureAnalysisStatus(framing, lighting),
    framing,
    lighting,
  };
}
