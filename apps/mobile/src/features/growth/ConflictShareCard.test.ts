import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./ConflictShareCard.tsx', import.meta.url)),
  'utf8',
);

describe('ConflictShareCard source boundary', () => {
  it('renders only the sanitized projection and includes the watermark and disclaimer', () => {
    expect(source).toContain('projection: ConflictShareProjection');
    expect(source).toContain('{projection.attributionLabel}');
    expect(source).toContain('{projection.disclaimer}');
    expect(source).toContain('testID="conflict-share-card"');
  });

  it.each([
    'DetectedConflict',
    'ShelfData',
    'productAName',
    'productBName',
    'productId',
    'userId',
    'skinProfile',
    'pregnancyStatus',
    'reviewedBy',
    'sourceCitation',
    'shareUrl',
    'fetch(',
    'track(',
  ])('does not accept or read private/internal field %s', (forbidden) => {
    expect(source).not.toContain(forbidden);
  });

  it('keeps the renderer free of capture, file, network, and native-share side effects', () => {
    expect(source).not.toContain('react-native-view-shot');
    expect(source).not.toContain('expo-file-system');
    expect(source).not.toContain('expo-sharing');
    expect(source).not.toContain('Share.share');
  });
});
