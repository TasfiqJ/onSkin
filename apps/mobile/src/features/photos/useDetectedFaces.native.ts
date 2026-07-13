import { useFaceDetection } from '@infinitered/react-native-mlkit-face-detection';
import { useEffect, useState } from 'react';

import { isOwnerQueryScopeCurrent, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { validatedFaceObservations } from './captureAnalysis';
import type { DetectedFacesResult } from './useDetectedFaces';

type DetectionRun = DetectedFacesResult & { uri: string | null };

export function useDetectedFaces(uri: string | undefined): DetectedFacesResult {
  const detector = useFaceDetection();
  const ownerScope = useOwnerQueryScope();
  const [run, setRun] = useState<DetectionRun>({
    uri: null,
    status: 'unavailable',
    faces: [],
  });

  useEffect(() => {
    if (!uri) return;

    let cancelled = false;
    void runOwnerQueryOperation(ownerScope, async (lease) => {
      await Promise.resolve();
      if (cancelled) return;
      lease.assertCurrent();
      setRun({ uri, status: 'modelLoading', faces: [] });
      if (detector.status !== 'ready' && detector.status !== 'done') {
        await detector.initialize();
      }
      if (cancelled) return;
      lease.assertCurrent();
      if (detector.status === 'error') {
        setRun({ uri, status: 'error', faces: [] });
        return;
      }

      lease.assertCurrent();
      setRun({ uri, status: 'detecting', faces: [] });
      const faces = validatedFaceObservations(await detector.detectFaces(uri));
      if (cancelled) return;
      lease.assertCurrent();
      if (!faces) {
        setRun({ uri, status: 'error', faces: [] });
        return;
      }
      setRun({ uri, status: 'done', faces });
    }).catch(() => {
      if (!cancelled && isOwnerQueryScopeCurrent(ownerScope)) {
        setRun({ uri, status: 'error', faces: [] });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [detector, ownerScope, uri]);

  if (run.uri !== (uri ?? null)) {
    return { status: uri ? 'init' : 'unavailable', faces: [] };
  }
  return { status: run.status, faces: run.faces };
}
