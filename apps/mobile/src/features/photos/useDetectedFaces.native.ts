import { useFaceDetection } from '@infinitered/react-native-mlkit-face-detection';
import { useEffect, useState } from 'react';

import { validatedFaceObservations } from './captureAnalysis';
import type { DetectedFacesResult } from './useDetectedFaces';

type DetectionRun = DetectedFacesResult & { uri: string | null };

export function useDetectedFaces(uri: string | undefined): DetectedFacesResult {
  const detector = useFaceDetection();
  const [run, setRun] = useState<DetectionRun>({
    uri: null,
    status: 'unavailable',
    faces: [],
  });

  useEffect(() => {
    if (!uri) return;

    let cancelled = false;
    void (async () => {
      try {
        await Promise.resolve();
        if (cancelled) return;
        setRun({ uri, status: 'modelLoading', faces: [] });
        if (detector.status !== 'ready' && detector.status !== 'done') {
          await detector.initialize();
        }
        if (cancelled) return;
        if (detector.status === 'error') {
          setRun({ uri, status: 'error', faces: [] });
          return;
        }

        setRun({ uri, status: 'detecting', faces: [] });
        const faces = validatedFaceObservations(await detector.detectFaces(uri));
        if (cancelled) return;
        if (!faces) {
          setRun({ uri, status: 'error', faces: [] });
          return;
        }
        setRun({ uri, status: 'done', faces });
      } catch {
        if (!cancelled) setRun({ uri, status: 'error', faces: [] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detector, uri]);

  if (run.uri !== (uri ?? null)) {
    return { status: uri ? 'init' : 'unavailable', faces: [] };
  }
  return { status: run.status, faces: run.faces };
}
