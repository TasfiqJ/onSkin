import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const source = readFileSync(
  fileURLToPath(new URL('../../app/(tabs)/_layout.tsx', import.meta.url)),
  'utf8',
);
describe('Native V1 tab navigation', () => {
  it('uses full platform tab labels without a second floating bar', () => {
    expect(source).toContain('expo-router/unstable-native-tabs');
    for (const label of ['Today', 'Progress', 'Shelf', 'You']) {
      expect(source).toContain(`<NativeTabs.Trigger.Label>${label}</NativeTabs.Trigger.Label>`);
      expect(source).toContain(`<NativeTabs.Trigger name="${label.toLowerCase()}">`);
    }
    expect(source).not.toContain('FloatingTabBar');
    expect(source).not.toContain('Prog.');
  });
  it('preserves owner-bound lifecycle cancellation and local reminders', () => {
    expect(source).toContain('expectedStoreUserId: storeUserId');
    expect(source).toContain('!isOwnerQueryScopeCurrent(ownerScope)');
    expect(source).toContain('mounted = false');
    expect(source).toContain('lifecyclePromptId: prompt.promptId');
    expect(source).toContain('<BehaviouralTriggers />');
  });
});
