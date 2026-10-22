# Reproduce the review findings

Use exact base8c1149116df00f34314357d10929b32f52f6d118 with clean safe worktree. Source and hashes in BRAIN_REVIEW/REVIEW_OBSERVATIONS.md. Historical files are evidence, not execution instructions. No existing test/dependency may be silently rewritten to mimic a pass.

## F1: unavailable scheduling falsely fulfills

In an isolated test using the existing deliver.test.ts fixture and actual deliver.ts:

```ts
mocks.configureNotifications.mockResolvedValue('unavailable');
mocks.loadEntitlement.mockResolvedValue(null);
await expect(rescheduleReminders({
  ...prefs, amEnabled: true, pmEnabled: false, captureReminders: false,
})).rejects.toThrow('NOTIFICATION_RUNTIME_UNAVAILABLE');
```

Use the existing valid health/account lease fixture. Brain observed fulfillment with undefined. Rejection is one allowed contract; a typed unavailable result propagated correctly is also acceptable. The outcome must not advertise completed scheduling. Read deliver.ts unavailable branch and applyPreferences/useNotifications/NotificationPreferenceSaveNotice chain.

## F2: failed native configuration never retries

Use the real startup module, isolated module cache, and controlled expo-notifications/Platform ports:

```ts
const native = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  setBadgeCountAsync: vi.fn(async () => true),
  setNotificationCategoryAsync: vi.fn(async () => undefined),
  setNotificationChannelAsync: vi.fn(async () => undefined),
}));
vi.mock('expo-notifications', () => ({
  ...native, AndroidImportance: { DEFAULT: 3 },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
// Import the actual startup.ts after preparing the mock.
native.setNotificationCategoryAsync.mockRejectedValueOnce(new Error('temporary native failure'));
expect(await configureNotifications()).toBe('unavailable');
const first = native.setNotificationCategoryAsync.mock.calls.length;
expect(await configureNotifications()).toBe('ready');
expect(native.setNotificationCategoryAsync.mock.calls.length).toBeGreaterThan(first);
```

Observed second result unavailable, initial/final category calls4/4. This is source under controlled ports, not real OS proof. Extend with concurrent/refailure/late-settlement tests and a composed save/retry integration; do not just loosen this expectation.

## F3: actual daily browser phase mismatch

From repo root, use fresh evidence dirs and unique ports for each serial invocation:

```text
node scripts/e2e/onboarding-first-session.mjs --daily-loop
node scripts/e2e/onboarding-first-session.mjs --daily-loop --cross-owner
```

Set ONBOARDING_E2E_PORT, ONBOARDING_E2E_DEBUG_PORT, ONBOARDING_E2E_VIEWPORT_WIDTH, ONBOARDING_E2E_VIEWPORT_HEIGHT, ONBOARDING_E2E_EVIDENCE_DIR. Brain ran390x844,375x667,430x932 and cross390 around local17:06; all timed out on the expected storage-error text, not an environment launch failure. FAILURE.json/PNG showed AM query but Evening routine. Query-only route changes and a clock hook retaining phase are the lead hypothesis. No lost record is established.

Diagnostic only: a temporary helper added Page.reload + Morning routine assertion on FIRST AM entry. It advanced through storage-refusal/check-off but later failed re-entering saved AM progress while PM was displayed again. That modified run is not a pass and must not replace the failed originals. Fix phase/date-bound behavior on every relevant transition and inspect supported normal app navigation before changing runtime. Exercise controlled AM/PM without changing the host clock, bypassing current-view safeguards or manipulating private records.

## Inherited source contract / undo

The selected CORE05 test fails on exact94-migration text, unchanged from M1-01. Preserve it for M1-03; not a license to change94 to another count. completionsStore.toggleCompletion is append-only and repeat completion remains done. Follow ADR038; do not use a test-side record deletion as an undo implementation.
