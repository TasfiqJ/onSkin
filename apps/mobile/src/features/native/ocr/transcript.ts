import {
  LABEL_OCR_MAX_TRANSCRIPT_UTF8_BYTES,
  type LabelOcrBoundingBox,
  type LabelOcrNativeResponse,
  type LabelOcrObservation,
} from './contract';

export type LabelOcrConfidenceCue = 'clear' | 'review' | 'ambiguous';

export type LabelOcrTranscriptLine = Readonly<{
  text: string;
  /** Present only when two candidates are too close to prefer silently. */
  alternativeText: string | null;
  boundingBox: LabelOcrBoundingBox;
  confidenceCue: LabelOcrConfidenceCue;
  sourceObservationIndex: number;
}>;

export type LabelOcrTranscript = Readonly<{
  text: string;
  lines: readonly LabelOcrTranscriptLine[];
  confidenceCue: LabelOcrConfidenceCue;
  truncated: boolean;
}>;

type IndexedObservation = Readonly<{
  observation: LabelOcrObservation;
  sourceObservationIndex: number;
  topCenter: number;
  top: number;
  bottom: number;
}>;

const RTL_STRONG_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
const ANY_STRONG_LETTER = /\p{L}/u;

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function truncateToUtf8Bytes(value: string, maximumBytes: number): string {
  let output = '';
  let bytes = 0;
  for (const scalar of value) {
    const scalarBytes = utf8Bytes(scalar);
    if (bytes + scalarBytes > maximumBytes) break;
    output += scalar;
    bytes += scalarBytes;
  }
  return output.trimEnd();
}

function rowReadingDirection(entries: readonly IndexedObservation[]): 'ltr' | 'rtl' {
  const sourceOrdered = [...entries].sort(
    (left, right) => left.sourceObservationIndex - right.sourceObservationIndex,
  );
  for (const entry of sourceOrdered) {
    const text = entry.observation.candidates[0]?.text ?? '';
    for (const scalar of text) {
      if (RTL_STRONG_LETTER.test(scalar) && ANY_STRONG_LETTER.test(scalar)) return 'rtl';
      if (ANY_STRONG_LETTER.test(scalar)) return 'ltr';
    }
  }
  return 'ltr';
}

export function confidenceCueForObservation(
  observation: LabelOcrObservation,
): LabelOcrConfidenceCue {
  const top = observation.candidates[0];
  const alternative = observation.candidates[1];
  if (top === undefined) return 'review';
  if (alternative !== undefined && top.confidence - alternative.confidence < 0.1) {
    return 'ambiguous';
  }
  return top.confidence < 0.8 ? 'review' : 'clear';
}

/**
 * Vision reports normalized lower-left coordinates. Convert them to a
 * top-origin center, cluster nearby fragments into stable rows, then read each
 * row from left to right. Original indices are the final deterministic tie.
 */
export function sortLabelOcrObservations(
  observations: readonly LabelOcrObservation[],
): readonly IndexedObservation[] {
  const verticallySorted = observations
    .map(
      (observation, sourceObservationIndex): IndexedObservation => ({
        observation,
        sourceObservationIndex,
        topCenter: 1 - (observation.boundingBox.y + observation.boundingBox.height / 2),
        top: 1 - (observation.boundingBox.y + observation.boundingBox.height),
        bottom: 1 - observation.boundingBox.y,
      }),
    )
    .sort(
      (left, right) =>
        left.topCenter - right.topCenter ||
        left.observation.boundingBox.x - right.observation.boundingBox.x ||
        left.sourceObservationIndex - right.sourceObservationIndex,
    );

  const rows: { entries: IndexedObservation[]; createdAt: number }[] = [];
  for (const entry of verticallySorted) {
    let selectedRow: (typeof rows)[number] | null = null;
    let selectedOverlap = 0;
    for (const row of rows) {
      const overlap = Math.max(
        ...row.entries.map((member) => {
          const overlapHeight = Math.max(
            0,
            Math.min(member.bottom, entry.bottom) - Math.max(member.top, entry.top),
          );
          return (
            overlapHeight /
            Math.min(member.observation.boundingBox.height, entry.observation.boundingBox.height)
          );
        }),
      );
      if (overlap >= 0.5 && overlap > selectedOverlap) {
        selectedRow = row;
        selectedOverlap = overlap;
      }
    }
    if (selectedRow !== null) {
      selectedRow.entries.push(entry);
    } else {
      rows.push({ entries: [entry], createdAt: rows.length });
    }
  }

  return Object.freeze(
    rows
      .sort(
        (left, right) =>
          Math.min(...left.entries.map((entry) => entry.top)) -
            Math.min(...right.entries.map((entry) => entry.top)) ||
          Math.min(...left.entries.map((entry) => entry.observation.boundingBox.x)) -
            Math.min(...right.entries.map((entry) => entry.observation.boundingBox.x)) ||
          Math.min(...left.entries.map((entry) => entry.sourceObservationIndex)) -
            Math.min(...right.entries.map((entry) => entry.sourceObservationIndex)) ||
          left.createdAt - right.createdAt,
      )
      .flatMap((row) => {
        const horizontalDirection = rowReadingDirection(row.entries) === 'rtl' ? -1 : 1;
        return row.entries.sort(
          (left, right) =>
            horizontalDirection *
              (left.observation.boundingBox.x - right.observation.boundingBox.x) ||
            left.topCenter - right.topCenter ||
            left.sourceObservationIndex - right.sourceObservationIndex,
        );
      }),
  );
}

export function buildLabelOcrTranscript(response: LabelOcrNativeResponse): LabelOcrTranscript {
  if (response.status !== 'recognized') {
    return Object.freeze({
      text: '',
      lines: Object.freeze([]),
      confidenceCue: 'review',
      truncated: false,
    });
  }

  const lines: LabelOcrTranscriptLine[] = [];
  let text = '';
  let truncated = response.truncated;

  for (const entry of sortLabelOcrObservations(response.observations)) {
    const topCandidate = entry.observation.candidates[0];
    if (topCandidate === undefined) continue;
    const candidateText = topCandidate.text.normalize('NFC');
    const separator = text.length === 0 ? '' : '\n';
    const remainingBytes =
      LABEL_OCR_MAX_TRANSCRIPT_UTF8_BYTES - utf8Bytes(text) - utf8Bytes(separator);
    if (remainingBytes <= 0) {
      truncated = true;
      break;
    }
    const boundedText = truncateToUtf8Bytes(candidateText, remainingBytes);
    if (boundedText.length === 0) {
      truncated = true;
      break;
    }
    if (boundedText !== candidateText) truncated = true;
    text += `${separator}${boundedText}`;
    lines.push(
      Object.freeze({
        text: boundedText,
        alternativeText:
          confidenceCueForObservation(entry.observation) === 'ambiguous'
            ? (entry.observation.candidates[1]?.text.normalize('NFC') ?? null)
            : null,
        boundingBox: entry.observation.boundingBox,
        confidenceCue: confidenceCueForObservation(entry.observation),
        sourceObservationIndex: entry.sourceObservationIndex,
      }),
    );
    if (boundedText !== candidateText) break;
  }

  const confidenceCue: LabelOcrConfidenceCue = lines.some(
    (line) => line.confidenceCue === 'ambiguous',
  )
    ? 'ambiguous'
    : lines.some((line) => line.confidenceCue === 'review')
      ? 'review'
      : 'clear';

  return Object.freeze({
    text,
    lines: Object.freeze(lines),
    confidenceCue,
    truncated,
  });
}
