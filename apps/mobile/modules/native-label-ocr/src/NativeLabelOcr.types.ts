export type NativeLabelOcrModule = Readonly<{
  labelOcrContractVersion: 1;
  labelOcrConfigured: true;
  labelOcrEngine: 'apple_vision_legacy';
  labelOcrRequestRevision: 3;
  labelOcrRecognitionLevel: 'accurate';
  labelOcrRunsOnDevice: true;
  recognizeLabelTextJSON: (managedPhotoUri: string, requestId: string) => Promise<string>;
  cancelLabelTextRecognitionJSON: (requestId: string) => string;
}>;
