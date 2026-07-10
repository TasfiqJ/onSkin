import { FaceDetectionProvider } from '@infinitered/react-native-mlkit-face-detection';
import type { ReactNode } from 'react';

const FACE_DETECTION_OPTIONS = {
  performanceMode: 'accurate',
  landmarkMode: false,
  contourMode: false,
  classificationMode: false,
  minFaceSize: 0.15,
  isTrackingEnabled: false,
} as const;

export function CaptureAnalysisProvider({ children }: { children: ReactNode }) {
  return (
    <FaceDetectionProvider deferInitialization options={FACE_DETECTION_OPTIONS}>
      {children}
    </FaceDetectionProvider>
  );
}
