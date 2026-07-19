import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  LABEL_OCR_MAX_AGGREGATE_CANDIDATE_UTF8_BYTES,
  LABEL_OCR_NATIVE_RESPONSE_INVALID,
  decodeLabelOcrNativeCancelReceiptJSON,
  decodeLabelOcrNativeResponseJSON,
  isManagedLabelPhotoUri,
  isLabelOcrNativeTimeoutError,
} from './contract';

const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
const NATIVE_MODULE = fileURLToPath(
  new URL('../../../../modules/native-label-ocr/ios/NativeLabelOcrModule.swift', import.meta.url),
);

function response(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    requestId: REQUEST_ID,
    status: 'recognized',
    truncated: false,
    observations: [
      {
        boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.1 },
        candidates: [
          { text: 'Cafe\u0301, Νιασιναμίδη, 水', confidence: 0.91 },
          { text: 'Café, Νιασιναμιδη, 水', confidence: 0.82 },
        ],
      },
    ],
    ...overrides,
  });
}

describe('native label OCR contract', () => {
  it('decodes an exact request-bound response and NFC-normalizes visible text', () => {
    const decoded = decodeLabelOcrNativeResponseJSON(response(), REQUEST_ID);

    expect(decoded).toEqual({
      schemaVersion: 1,
      requestId: REQUEST_ID,
      status: 'recognized',
      truncated: false,
      observations: [
        {
          boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.1 },
          candidates: [
            { text: 'Café, Νιασιναμίδη, 水', confidence: 0.91 },
            { text: 'Café, Νιασιναμιδη, 水', confidence: 0.82 },
          ],
        },
      ],
    });
    expect(Object.isFrozen(decoded.observations[0]?.candidates)).toBe(true);
  });

  it('accepts only a one-micro-unit edge tolerance and clamps the accepted box', () => {
    const decoded = decodeLabelOcrNativeResponseJSON(
      response({
        observations: [
          {
            boundingBox: { x: 0.2, y: 0.1, width: 0.8000005, height: 0.9000005 },
            candidates: [{ text: 'Water', confidence: 0.9 }],
          },
        ],
      }),
      REQUEST_ID,
    );
    expect(decoded.observations[0]?.boundingBox).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.8,
      height: 0.9,
    });

    expect(() =>
      decodeLabelOcrNativeResponseJSON(
        response({
          observations: [
            {
              boundingBox: { x: 0.2, y: 0.1, width: 0.800002, height: 0.1 },
              candidates: [{ text: 'Water', confidence: 0.9 }],
            },
          ],
        }),
        REQUEST_ID,
      ),
    ).toThrow(LABEL_OCR_NATIVE_RESPONSE_INVALID);
  });

  it('uses the same NFC and collapsed-whitespace candidate form emitted by native code', () => {
    const decoded = decodeLabelOcrNativeResponseJSON(
      response({
        observations: [
          {
            boundingBox: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 },
            candidates: [{ text: 'Cafe\u0301\u00a0  Glycerin', confidence: 0.9 }],
          },
        ],
      }),
      REQUEST_ID,
    );

    expect(decoded.observations[0]?.candidates[0]?.text).toBe('Café Glycerin');
  });

  it.each([
    ['extra response key', () => JSON.stringify({ ...JSON.parse(response()), extra: true })],
    ['wrong request', () => response({ requestId: '20000000-0000-4000-8000-000000000002' })],
    ['future schema', () => response({ schemaVersion: 2 })],
    ['empty recognized output', () => response({ observations: [] })],
    [
      'output on no-text',
      () => response({ status: 'no_text', observations: JSON.parse(response()).observations }),
    ],
    [
      'unordered candidates',
      () =>
        response({
          observations: [
            {
              boundingBox: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 },
              candidates: [
                { text: 'Water', confidence: 0.7 },
                { text: 'Aqua', confidence: 0.8 },
              ],
            },
          ],
        }),
    ],
    [
      'third candidate',
      () =>
        response({
          observations: [
            {
              boundingBox: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 },
              candidates: [
                { text: 'Water', confidence: 0.9 },
                { text: 'Aqua', confidence: 0.8 },
                { text: 'Eau', confidence: 0.7 },
              ],
            },
          ],
        }),
    ],
  ])('rejects %s', (_label, build) => {
    expect(() => decodeLabelOcrNativeResponseJSON(build(), REQUEST_ID)).toThrow(
      LABEL_OCR_NATIVE_RESPONSE_INVALID,
    );
  });

  it.each([
    ['line break', 'Water\nGlycerin'],
    ['bidi override', `Water\u202e`],
    ['BOM', `Water\ufeff`],
    ['lone surrogate', `Water\ud800`],
    ['noncharacter', `Water\ufdd0`],
    ['too many scalars', 'a'.repeat(513)],
  ])('rejects unsafe or oversized candidate text: %s', (_label, text) => {
    expect(() =>
      decodeLabelOcrNativeResponseJSON(
        response({
          observations: [
            {
              boundingBox: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 },
              candidates: [{ text, confidence: 0.9 }],
            },
          ],
        }),
        REQUEST_ID,
      ),
    ).toThrow(LABEL_OCR_NATIVE_RESPONSE_INVALID);
  });

  it('bounds aggregate candidate bytes independently of the JSON envelope', () => {
    const observations = Array.from(
      { length: LABEL_OCR_MAX_AGGREGATE_CANDIDATE_UTF8_BYTES / 1_024 + 1 },
      (_, index) => {
        const prefix = String(index).padStart(4, '0');
        return {
          boundingBox: { x: 0, y: index / 1_000, width: 0.9, height: 0.001 },
          candidates: [
            { text: `${prefix}${'a'.repeat(508)}`, confidence: 0.9 },
            { text: `${prefix}${'b'.repeat(508)}`, confidence: 0.8 },
          ],
        };
      },
    );
    expect(() => decodeLabelOcrNativeResponseJSON(response({ observations }), REQUEST_ID)).toThrow(
      LABEL_OCR_NATIVE_RESPONSE_INVALID,
    );
  });

  it('decodes exact no-text and cancellation receipts', () => {
    expect(
      decodeLabelOcrNativeResponseJSON(
        response({ status: 'no_text', observations: [], truncated: false }),
        REQUEST_ID,
      ),
    ).toMatchObject({ status: 'no_text', observations: [] });
    expect(
      decodeLabelOcrNativeCancelReceiptJSON(
        JSON.stringify({ schemaVersion: 1, requestId: REQUEST_ID, status: 'cancel_requested' }),
        REQUEST_ID,
      ),
    ).toEqual({ schemaVersion: 1, requestId: REQUEST_ID, status: 'cancel_requested' });
    expect(() =>
      decodeLabelOcrNativeCancelReceiptJSON(
        JSON.stringify({ schemaVersion: 1, requestId: REQUEST_ID, status: 'cancelled' }),
        REQUEST_ID,
      ),
    ).toThrow(LABEL_OCR_NATIVE_RESPONSE_INVALID);
  });

  it('accepts only queryless managed-cache label-photo URIs at the JS boundary', () => {
    const uri = 'file:///cache/catalog-label-photo-temp-00000000-0000-4000-8000-000000000001.jpg';
    expect(isManagedLabelPhotoUri(uri)).toBe(true);
    expect(isManagedLabelPhotoUri(`${uri}?token=secret`)).toBe(false);
    expect(isManagedLabelPhotoUri('https://example.com/label.jpg')).toBe(false);
    expect(isManagedLabelPhotoUri('file:///cache/unmanaged.jpg')).toBe(false);
    expect(
      isManagedLabelPhotoUri(
        'file:///cache/catalog-label-photo-temp-00000000-0000-1000-8000-000000000001.jpg',
      ),
    ).toBe(false);
    expect(
      isManagedLabelPhotoUri(
        'file:///cache/catalog-label-photo-temp-00000000-0000-4000-7000-000000000001.jpg',
      ),
    ).toBe(false);
  });

  it('keeps the native request and managed-file identities on the same UUIDv4 contract', () => {
    const nativeSource = readFileSync(NATIVE_MODULE, 'utf8');

    expect(nativeSource).toContain('private func isCanonicalUuidV4(_ value: String) -> Bool');
    expect(nativeSource).toContain('bytes[14] == 0x34');
    expect(nativeSource).toContain('return isCanonicalUuidV4(identifierText)');
    expect(nativeSource).toContain('guard isCanonicalUuidV4(requestId) else');
  });

  it('recognizes only the stable native timeout code and never trusts an error message', () => {
    expect(isLabelOcrNativeTimeoutError({ code: 'E_LABEL_OCR_TIMEOUT', message: 'private' })).toBe(
      true,
    );
    expect(isLabelOcrNativeTimeoutError(new Error('E_LABEL_OCR_TIMEOUT'))).toBe(false);
    expect(isLabelOcrNativeTimeoutError({ code: 'E_LABEL_OCR_VISION_FAILED' })).toBe(false);
  });
});
