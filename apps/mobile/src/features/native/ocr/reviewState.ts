export type LabelOcrTextOwnership = 'empty' | 'ocr_unedited' | 'user_edited';

export type LabelOcrSuggestion = Readonly<{
  captureGeneration: number;
  text: string;
}>;

export type LabelOcrReviewState = Readonly<{
  captureGeneration: number;
  textEditRevision: number;
  text: string;
  ownership: LabelOcrTextOwnership;
  suggestion: LabelOcrSuggestion | null;
}>;

export type LabelOcrReviewFence = Readonly<{
  captureGeneration: number;
  textEditRevision: number;
}>;

function freezeState(state: LabelOcrReviewState): LabelOcrReviewState {
  return Object.freeze({
    ...state,
    suggestion: state.suggestion === null ? null : Object.freeze(state.suggestion),
  });
}

export function createLabelOcrReviewState(initialText = ''): LabelOcrReviewState {
  const text = initialText.normalize('NFC');
  return freezeState({
    captureGeneration: 0,
    textEditRevision: 0,
    text,
    ownership: text.length === 0 ? 'empty' : 'user_edited',
    suggestion: null,
  });
}

export function advanceLabelOcrCapture(state: LabelOcrReviewState): LabelOcrReviewState {
  const preserveUserText = state.ownership === 'user_edited';
  return freezeState({
    ...state,
    captureGeneration: state.captureGeneration + 1,
    text: preserveUserText ? state.text : '',
    ownership: preserveUserText ? 'user_edited' : 'empty',
    suggestion: null,
  });
}

export function beginLabelOcrReviewAttempt(state: LabelOcrReviewState): LabelOcrReviewFence {
  return Object.freeze({
    captureGeneration: state.captureGeneration,
    textEditRevision: state.textEditRevision,
  });
}

export function editLabelOcrReviewText(
  state: LabelOcrReviewState,
  nextText: string,
): LabelOcrReviewState {
  const text = nextText.normalize('NFC');
  return freezeState({
    ...state,
    text,
    textEditRevision: state.textEditRevision + 1,
    ownership: text.length === 0 ? 'empty' : 'user_edited',
  });
}

export function applyLabelOcrRecognition(
  state: LabelOcrReviewState,
  fence: LabelOcrReviewFence,
  recognizedText: string,
): LabelOcrReviewState {
  if (fence.captureGeneration !== state.captureGeneration) return state;
  const text = recognizedText.normalize('NFC').trim();
  if (text.length === 0) return state;

  if (fence.textEditRevision === state.textEditRevision && state.ownership !== 'user_edited') {
    return freezeState({
      ...state,
      text,
      ownership: 'ocr_unedited',
      suggestion: null,
    });
  }

  return freezeState({
    ...state,
    suggestion: Object.freeze({ captureGeneration: state.captureGeneration, text }),
  });
}

export function adoptLabelOcrSuggestion(state: LabelOcrReviewState): LabelOcrReviewState {
  if (state.suggestion === null || state.suggestion.captureGeneration !== state.captureGeneration) {
    return state;
  }
  return freezeState({
    ...state,
    text: state.suggestion.text,
    textEditRevision: state.textEditRevision + 1,
    ownership: 'ocr_unedited',
    suggestion: null,
  });
}
