import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(join(SRC_DIR, path), 'utf8');
}

describe('tokenized interface-state surfaces', () => {
  it('keeps meaning, accessibility, and presentation in the shared primitive', () => {
    const notice = readSource('components/ui/StateNotice.tsx');

    expect(notice).toContain('interfaceStateTokens(kind, tone)');
    expect(notice).toContain("kind === 'loading' && !showIndicator ? 'progressbar'");
    expect(notice).toContain("alert ? 'alert' : undefined");
    expect(notice).toContain('{tokens.label}');
    expect(notice).toContain('accessibilityLiveRegion="polite"');
    expect(notice).toContain('accessibilityRole="progressbar"');
    expect(notice).toContain('accessibilityLabel={title ?? tokens.label}');
  });

  it('defines every distinct state requested by the visual contract', () => {
    const tokens = readSource('theme/stateTokens.ts');

    for (const kind of [
      'loading',
      'empty',
      'offline',
      'error',
      'unavailable',
      'corrupt',
      'locked',
      'destructive',
    ]) {
      expect(tokens, kind).toContain(`  ${kind}: {`);
    }
  });

  it('routes shared startup, private-data, schedule, notification, and commerce states through it', () => {
    const noticeOwners = [
      'lib/auth/SessionBoundaryGate.tsx',
      'lib/storage/PrivateDataAvailabilityGate.tsx',
      'lib/storage/PlaintextStagingStartupGate.tsx',
      'features/photos/PhotoStorageGate.tsx',
      'features/photos/PhotoTimelineLockGate.tsx',
      'features/shelf/ShelfDataAvailabilityGate.tsx',
      'features/scheduler/ActiveScheduleUnavailableNotice.tsx',
      'features/scheduler/CycleMutationError.tsx',
      'features/notifications/NotificationPreferenceState.tsx',
      'features/today/CompletionHistoryState.tsx',
      'features/subscription/PaywallFeedback.tsx',
      'features/commerce/CommerceLinkNotice.tsx',
      'app/(tabs)/you.tsx',
      'app/index.tsx',
      'app/onboarding/age.tsx',
      'app/shelf/search.tsx',
    ];

    for (const path of noticeOwners) {
      expect(readSource(path), path).toContain('StateNotice');
    }

    const loadingOwners = [
      'lib/auth/SessionBoundaryGate.tsx',
      'lib/storage/PrivateDataAvailabilityGate.tsx',
      'lib/storage/PlaintextStagingStartupGate.tsx',
      'features/photos/PhotoStorageGate.tsx',
      'features/shelf/ShelfDataAvailabilityGate.tsx',
      'features/scheduler/CycleDataAvailabilityGate.tsx',
      'features/notifications/NotificationPreferenceState.tsx',
      'features/today/CompletionHistoryState.tsx',
      'app/(tabs)/you.tsx',
      'app/onboarding/age.tsx',
      'app/shelf/search.tsx',
    ];

    for (const path of loadingOwners) {
      expect(readSource(path), path).toContain('StateLoading');
      expect(readSource(path), path).not.toContain('ActivityIndicator');
    }
  });

  it('keeps catalog result meanings distinct instead of flattening them into one message', () => {
    const search = readSource('app/shelf/search.tsx');

    expect(search).toContain("kind: 'offline'");
    expect(search).toContain("kind: 'error'");
    expect(search).toContain("kind: 'empty'");
    expect(search).toContain('kind={notice.kind}');
    expect(search).toContain(': results.map((product) => {');
  });
});
