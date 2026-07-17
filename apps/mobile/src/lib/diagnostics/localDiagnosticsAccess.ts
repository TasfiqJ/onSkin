import { env } from '@/lib/env';

import { resolveLocalDiagnosticsAccess } from './localDiagnostics';

export function localDiagnosticsAccessEnabled(): boolean {
  return resolveLocalDiagnosticsAccess(
    typeof __DEV__ !== 'undefined' && __DEV__,
    env.appEnvironment,
  );
}
