import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED,
  evaluateRoutineWidgetRuntimeGate,
  routineWidgetRuntimeEnabled,
} from './runtimeGate';

const mocks = vi.hoisted(() => ({
  appEnvironment: 'development' as 'development' | 'staging' | 'production',
  extensionBuildEnabled: true as unknown,
  platform: 'ios',
}));

vi.mock('expo-constants', () => ({
  default: {
    get expoConfig() {
      return {
        extra: {
          iosWidgetExtensionBuildEnabled: mocks.extensionBuildEnabled,
        },
      };
    },
  },
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platform;
    },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    get appEnvironment() {
      return mocks.appEnvironment;
    },
  },
}));

describe('routine widget native runtime gate', () => {
  beforeEach(() => {
    mocks.platform = 'ios';
    mocks.extensionBuildEnabled = true;
    mocks.appEnvironment = 'development';
  });

  it('opens only for an exact opted-in non-production iOS extension build', () => {
    expect(routineWidgetRuntimeEnabled()).toBe(true);

    mocks.appEnvironment = 'staging';
    expect(routineWidgetRuntimeEnabled()).toBe(true);

    mocks.platform = 'android';
    expect(routineWidgetRuntimeEnabled()).toBe(false);

    mocks.platform = 'ios';
    mocks.appEnvironment = 'production';
    expect(routineWidgetRuntimeEnabled()).toBe(false);
  });

  it('rejects missing, string, numeric, and otherwise truthy config values', () => {
    for (const value of [undefined, null, 'true', '1', 1, {}, []]) {
      mocks.extensionBuildEnabled = value;
      expect(routineWidgetRuntimeEnabled()).toBe(false);
    }
  });

  it('keeps the pure gate fail-closed for every partial match', () => {
    expect(
      evaluateRoutineWidgetRuntimeGate({
        platform: 'ios',
        appEnvironment: 'development',
        iosWidgetExtensionBuildEnabled: true,
      }),
    ).toBe(true);
    expect(
      evaluateRoutineWidgetRuntimeGate({
        platform: 'web',
        appEnvironment: 'development',
        iosWidgetExtensionBuildEnabled: true,
      }),
    ).toBe(false);
    expect(
      evaluateRoutineWidgetRuntimeGate({
        platform: 'ios',
        appEnvironment: 'production',
        iosWidgetExtensionBuildEnabled: true,
      }),
    ).toBe(false);
  });

  it('keeps interactive publication compile-time hard-disabled', () => {
    expect(ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED).toBe(false);
  });
});
