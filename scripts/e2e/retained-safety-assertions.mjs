export function assertNoUncaughtErrors(snapshot, events) {
  if (
    /Uncaught Error|Uncaught \(in promise\)|LogBox|EXPLICIT_SIGN_OUT_LOCAL_BOUNDARY_INCOMPLETE/.test(
      snapshot.bodyText,
    )
  ) {
    throw new Error('Visible error overlay covers the recovery surface.');
  }
  const exceptions = events.filter((event) => event.method === 'Runtime.exceptionThrown');
  if (exceptions.length) throw new Error(`${exceptions.length} uncaught runtime exception(s).`);
}

export function isDisallowedLog(log) {
  if (log.method === 'Runtime.exceptionThrown') return true;
  const serialized = JSON.stringify(log);
  return ![
    'EXPO_PUBLIC_SUPABASE',
    'Notifications',
    'expo-notifications',
    'placeholder',
    '403',
    'supabase.co',
    'shadow',
    'props.pointerEvents is deprecated',
  ].some((text) => serialized.includes(text));
}

export function assertCompletedAccountRecovery(result) {
  for (const key of [
    'cleanupFailureStayedGated',
    'repeatedFailureStayedGated',
    'privateNamesHiddenAfterSignOut',
    'signedOutShelfAgeClosed',
    'signedOutTodayAgeClosed',
    'signedOutReloadAgeClosed',
    'terminalWelcome',
    'noUncaughtRuntimeExceptions',
  ]) {
    if (result[key] !== true) throw new Error(`Incomplete account recovery: ${key}`);
  }
}

export function assertCrossOwnerRaceOutcomes(results) {
  const allowed = [
    [
      'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY',
      'ACCOUNT_GENERATION_CHANGED',
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    ],
    [
      'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY',
      'ACCOUNT_GENERATION_CHANGED',
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    ],
    ['ACCOUNT_GENERATION_CHANGED'],
  ];
  if (
    !Array.isArray(results) ||
    results.length !== allowed.length ||
    results.some((result, index) => !allowed[index].includes(result))
  ) {
    throw new Error('Old-owner operation did not reject at its authority boundary.');
  }
}
