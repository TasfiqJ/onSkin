export type AuthDerivedActivityDependencies = {
  cancelQueries: () => void | Promise<unknown>;
  cancelScheduledNotifications: () => void | Promise<unknown>;
  clearRoutineWidgetActions: () => void | Promise<unknown>;
  clearRoutineWidgetNativeState: () => void | Promise<unknown>;
  clearQueries: () => void | Promise<unknown>;
  purgeSensitiveImageMemory: () => void | Promise<unknown>;
  resetAnalyticsIdentity: () => void | Promise<unknown>;
  resetRevenueCatIdentity: () => void | Promise<unknown>;
};

/**
 * Stop account-derived work and purge ephemeral identity-bearing state while
 * deliberately leaving owner-bound skincare records, preferences, and photos.
 */
export async function clearAuthDerivedLocalActivity(
  dependencies: AuthDerivedActivityDependencies,
): Promise<void> {
  const failed: string[] = [];
  const attempt = async (label: string, operation: () => void | Promise<unknown>) => {
    try {
      await operation();
    } catch {
      failed.push(label);
    }
  };

  // This operation closes native App Group admission synchronously before its
  // purge promise settles. Start it before any query/vendor await so a hung JS
  // drain cannot leave prior-owner widget counts or AppIntents live.
  const routineWidgetCleanup = Promise.all([
    attempt('routine_widget_native_state', dependencies.clearRoutineWidgetNativeState),
    attempt('routine_widget_actions', dependencies.clearRoutineWidgetActions),
  ]);
  await attempt('cancel_queries_before', dependencies.cancelQueries);
  await attempt('clear_queries_before', dependencies.clearQueries);
  await routineWidgetCleanup;
  await attempt('sensitive_image_memory', dependencies.purgeSensitiveImageMemory);
  await attempt('scheduled_notifications', dependencies.cancelScheduledNotifications);
  await attempt('analytics_identity', dependencies.resetAnalyticsIdentity);
  await attempt('revenuecat_identity', dependencies.resetRevenueCatIdentity);
  // A query or vendor callback already in flight must not repopulate account
  // state after the identity reset.
  await attempt('cancel_queries_after', dependencies.cancelQueries);
  await attempt('clear_queries_after', dependencies.clearQueries);

  if (failed.length > 0) {
    throw new Error(`AUTH_DERIVED_ACTIVITY_CLEAR_FAILED:${failed.join(',')}`);
  }
}
