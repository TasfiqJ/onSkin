import { useFaceDetection } from '@infinitered/react-native-mlkit-face-detection';
import { useEffect, useState } from 'react';

import type { CaptureAnalysisLease } from './captureAnalysisCoordinator';
import { runDetectedFacesOperation } from './detectedFacesOperation';
import type { DetectedFacesResult } from './useDetectedFaces';

type DetectionRun = DetectedFacesResult & { uri: string | null };

export function useDetectedFaces(
  uri: string | undefined,
  lease?: CaptureAnalysisLease | null,
): DetectedFacesResult {
  const detector = useFaceDetection();
  const [run, setRun] = useState<DetectionRun>({
    uri: null,
    status: 'unavailable',
    faces: [],
  });

  useEffect(() => {
    if (!uri || !lease) return;

    let cancelled = false;
    void lease
      .run((control) =>
        runDetectedFacesOperation({
          control,
          detector,
          isCancelled: () => cancelled,
          publish: (result) => setRun({ uri, ...result }),
          uri,
        }),
      )
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [detector, lease, uri]);

  if (run.uri !== (uri ?? null)) {
    return { status: uri ? 'init' : 'unavailable', faces: [] };
  }
  return { status: run.status, faces: run.faces };
}
