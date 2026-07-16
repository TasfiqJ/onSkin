import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  monospacedDigit,
  padding,
  privacySensitive,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { RoutineLiveActivityProps } from './contract';

export const RoutineKindEveningActivityLayout = (
  props: RoutineLiveActivityProps,
  environment: LiveActivityEnvironment,
) => {
  'widget';

  // Live Activity state may outlive the app process. Decode the closed schema
  // locally because no app helper is available in the isolated widget runtime.
  const expectedKeys = [
    'completedCount',
    'schemaVersion',
    'staleAtMs',
    'status',
    'totalCount',
    'updatedAtMs',
  ].sort();
  const propsAreRecord = typeof props === 'object' && props !== null && !Array.isArray(props);
  const actualKeys = propsAreRecord ? Object.keys(props).sort() : [];
  const countsAreSafe =
    propsAreRecord &&
    Number.isSafeInteger(props.completedCount) &&
    props.completedCount >= 0 &&
    props.completedCount <= 32 &&
    Number.isSafeInteger(props.totalCount) &&
    props.totalCount >= 0 &&
    props.totalCount <= 32 &&
    props.completedCount <= props.totalCount;
  const timestampsAreSafe =
    propsAreRecord &&
    Number.isSafeInteger(props.updatedAtMs) &&
    props.updatedAtMs >= 0 &&
    Number.isSafeInteger(props.staleAtMs) &&
    props.staleAtMs > props.updatedAtMs &&
    props.staleAtMs - props.updatedAtMs <= 300_000;
  const stateIsSafe =
    propsAreRecord &&
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]) &&
    props.schemaVersion === 1 &&
    ['in_progress', 'complete', 'stale'].includes(props.status) &&
    countsAreSafe &&
    timestampsAreSafe &&
    ((props.status === 'in_progress' &&
      props.totalCount > 0 &&
      props.completedCount < props.totalCount) ||
      (props.status === 'complete' &&
        props.totalCount > 0 &&
        props.completedCount === props.totalCount) ||
      (props.status === 'stale' && props.completedCount === 0 && props.totalCount === 0));
  const renderTimeMs = Date.now();
  const currentAtRender =
    stateIsSafe &&
    props.status !== 'stale' &&
    renderTimeMs >= props.updatedAtMs &&
    renderTimeMs < props.staleAtMs;
  const statusLabel = !currentAtRender
    ? 'Open RoutineKind to refresh'
    : props.status === 'complete'
      ? 'Routine complete'
      : 'In progress';
  const accentColor = environment.isLuminanceReduced ? '#D8C8BD' : '#A5694B';
  const backgroundColor = environment.colorScheme === 'dark' ? '#1C1815' : '#F5F1EA';
  const countModifiers = [
    font({ textStyle: 'headline', weight: 'semibold' }),
    privacySensitive(),
    monospacedDigit(),
  ];

  const banner = (
    <HStack
      spacing={10}
      modifiers={[
        padding({ all: 14 }),
        activityBackgroundTint(backgroundColor),
        privacySensitive(),
      ]}
    >
      <Image systemName="moon.stars.fill" size={22} color={accentColor} />
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>
          Evening routine
        </Text>
        <Text
          modifiers={[
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            privacySensitive(),
          ]}
        >
          {statusLabel}
        </Text>
      </VStack>
      <Spacer />
      {currentAtRender ? (
        <Text modifiers={countModifiers}>
          {props.completedCount} of {props.totalCount}
        </Text>
      ) : null}
    </HStack>
  );

  return {
    banner,
    bannerSmall: (
      <HStack spacing={6} modifiers={[padding({ all: 8 }), privacySensitive()]}>
        <Image systemName="moon.stars.fill" size={16} color={accentColor} />
        <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>
          Evening routine
        </Text>
        {currentAtRender ? (
          <Text modifiers={[privacySensitive(), monospacedDigit()]}>
            {props.completedCount}/{props.totalCount}
          </Text>
        ) : null}
      </HStack>
    ),
    compactLeading: <Image systemName="moon.stars.fill" size={14} color={accentColor} />,
    compactTrailing: currentAtRender ? (
      <Text modifiers={[privacySensitive(), monospacedDigit()]}>
        {props.completedCount}/{props.totalCount}
      </Text>
    ) : (
      <Text>Open</Text>
    ),
    minimal: <Image systemName="moon.stars.fill" size={14} color={accentColor} />,
    expandedCenter: (
      <VStack
        alignment="center"
        spacing={3}
        modifiers={[padding({ horizontal: 8 }), privacySensitive()]}
      >
        <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>
          Evening routine
        </Text>
        <Text
          modifiers={[
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            privacySensitive(),
          ]}
        >
          {statusLabel}
        </Text>
        {currentAtRender ? (
          <Text modifiers={countModifiers}>
            {props.completedCount} of {props.totalCount}
          </Text>
        ) : null}
      </VStack>
    ),
  };
};

export default createLiveActivity<RoutineLiveActivityProps>(
  'RoutineKindEvening',
  RoutineKindEveningActivityLayout,
);
