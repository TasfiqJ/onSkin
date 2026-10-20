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
