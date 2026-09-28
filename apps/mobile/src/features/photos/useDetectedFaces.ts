import type { FaceObservation } from './captureAnalysis';
import type { CaptureAnalysisLease } from './captureAnalysisCoordinator';

export type DetectedFacesStatus =
  | 'init'
  | 'modelLoading'
  | 'ready'
  | 'detecting'
  | 'done'
  | 'error'
  | 'unavailable';

export type DetectedFacesResult = {
  status: DetectedFacesStatus;
  faces: FaceObservation[];
};

export function useDetectedFaces(
  _uri: string | undefined,
  _lease?: CaptureAnalysisLease | null,
): DetectedFacesResult {
  return { status: 'unavailable', faces: [] };
}
