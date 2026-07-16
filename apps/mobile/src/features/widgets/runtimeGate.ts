import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AppEnvironment } from '@/lib/env';
import { env } from '@/lib/env';

export type RoutineWidgetRuntimeGateInput = Readonly<{
  appEnvironment: AppEnvironment;
  iosWidgetExtensionBuildEnabled: unknown;
  platform: string;
}>;

/**
 * Native widget registration may run only inside an explicitly opted-in,
 * non-production iOS extension build. The app-config value is deliberately an
 * exact boolean: strings and other truthy values cannot activate native code.
 */
export function evaluateRoutineWidgetRuntimeGate(input: RoutineWidgetRuntimeGateInput): boolean {
  return (
    input.platform === 'ios' &&
    input.iosWidgetExtensionBuildEnabled === true &&
    input.appEnvironment !== 'production'
  );
}

export function routineWidgetRuntimeEnabled(): boolean {
  return evaluateRoutineWidgetRuntimeGate({
    platform: Platform.OS,
    appEnvironment: env.appEnvironment,
    iosWidgetExtensionBuildEnabled: Constants.expoConfig?.extra?.iosWidgetExtensionBuildEnabled,
  });
}

/**
 * JS-only getTimeline/updateTimeline cannot atomically coordinate with the
 * extension AppIntent process. Interactive publication stays hard-disabled
 * until a native atomic App Group action outbox (or equivalent native CAS
 * protocol) is implemented and verified on physical devices.
 */
export const ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED: false = false;
