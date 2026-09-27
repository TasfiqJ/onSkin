import type { CaptureAnalysisControl } from './photoAnalysisCleanup';
import { validatedFaceObservations, type FaceDetectionResult } from './captureAnalysis';
import type { DetectedFacesResult } from './useDetectedFaces';

type FaceDetector = Readonly<{
  detectFaces: (uri: string) => Promise<FaceDetectionResult | null | undefined>;
  initialize: () => Promise<unknown>;
  status: string;
}>;

export async function runDetectedFacesOperation(options: {
  control: CaptureAnalysisControl;
  detector: FaceDetector;
  isCancelled: () => boolean;
  publish: (result: DetectedFacesResult) => void;
  uri: string;
}): Promise<void> {
  const { control, detector, isCancelled, publish, uri } = options;
  const publishIfCurrent = (result: DetectedFacesResult): boolean => {
    // Account/session abort is authoritative even if native work resolved in
    // the same turn. No post-await state may publish before this assertion.
    control.assertActive();
    if (isCancelled()) return false;
    publish(result);
    return true;
  };

  try {
    await Promise.resolve();
    if (!publishIfCurrent({ status: 'modelLoading', faces: [] })) return;
    if (detector.status !== 'ready' && detector.status !== 'done') {
      await detector.initialize();
      control.assertActive();
      if (isCancelled()) return;
    }
    if (detector.status === 'error') {
      publishIfCurrent({ status: 'error', faces: [] });
      return;
    }

    if (!publishIfCurrent({ status: 'detecting', faces: [] })) return;
    const faces = validatedFaceObservations(await detector.detectFaces(uri));
    control.assertActive();
    if (isCancelled()) return;
    if (!faces) {
      publishIfCurrent({ status: 'error', faces: [] });
      return;
    }
    publishIfCurrent({ status: 'done', faces });
  } catch {
    try {
      publishIfCurrent({ status: 'error', faces: [] });
    } catch {
      // An aborted account/URI lease must never publish a fallback error.
    }
  }
}
