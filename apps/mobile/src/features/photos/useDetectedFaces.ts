import type { FaceObservation } from './captureAnalysis';

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

export function useDetectedFaces(_uri: string | undefined): DetectedFacesResult {
  return { status: 'unavailable', faces: [] };
}
