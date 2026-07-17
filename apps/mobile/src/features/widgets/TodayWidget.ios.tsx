import { Button, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  containerBackground,
  controlSize,
  font,
  foregroundStyle,
  monospacedDigit,
  padding,
  privacySensitive,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { RoutineWidgetProps } from './contract';

export const RoutineKindTodayWidgetLayout = (
  props: RoutineWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';

  // App Group bytes are untrusted. Keep this decoder local because the widget
  // runtime serializes only this function body and cannot call app helpers.
  const expectedKeys = [
    'actionTokens',
    'completedCount',
    'deepLink',
    'interactionRevision',
    'localDate',
    'ownerGeneration',
    'pendingActionTokens',
    'phase',
    'schemaVersion',
    'snapshotNonce',
    'staleAtMs',
    'status',
    'totalCount',
    'updatedAtMs',
  ].sort();
  const propsAreRecord = typeof props === 'object' && props !== null && !Array.isArray(props);
  const actualKeys = propsAreRecord ? Object.keys(props).sort() : [];
  const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ownerBindingIsSafe =
    propsAreRecord &&
    typeof props.ownerGeneration === 'string' &&
    props.ownerGeneration === props.ownerGeneration.toLowerCase() &&
    tokenPattern.test(props.ownerGeneration) &&
    typeof props.snapshotNonce === 'string' &&
    props.snapshotNonce === props.snapshotNonce.toLowerCase() &&
    tokenPattern.test(props.snapshotNonce) &&
    props.ownerGeneration !== props.snapshotNonce;
  const actionTokensAreSafe =
    propsAreRecord &&
    Array.isArray(props.actionTokens) &&
    props.actionTokens.length <= 32 &&
    props.actionTokens.every(
      (token, index) =>
        typeof token === 'string' &&
        tokenPattern.test(token) &&
        token === token.toLowerCase() &&
        props.actionTokens.indexOf(token) === index,
    );
  const pendingTokensAreSafe =
    propsAreRecord &&
    Array.isArray(props.pendingActionTokens) &&
    props.pendingActionTokens.length <= 32 &&
    props.pendingActionTokens.every(
      (token, index) =>
        typeof token === 'string' &&
        tokenPattern.test(token) &&
        token === token.toLowerCase() &&
        props.pendingActionTokens.indexOf(token) === index,
    );
  const localDateTimestamp =
    propsAreRecord &&
    typeof props.localDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(props.localDate)
      ? Date.parse(`${props.localDate}T00:00:00.000Z`)
      : Number.NaN;
  const localDateIsSafe =
    Number.isFinite(localDateTimestamp) &&
    new Date(localDateTimestamp).toISOString().slice(0, 10) === props.localDate;
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
  const baseSchemaIsSafe =
    propsAreRecord &&
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]) &&
    props.schemaVersion === 2 &&
    ownerBindingIsSafe &&
    ['disabled', 'empty', 'ready', 'complete', 'stale'].includes(props.status) &&
    ['AM', 'PM', 'none'].includes(props.phase) &&
    localDateIsSafe &&
    [
      'routinekind-development://today',
      'routinekind-staging://today',
      'routinekind://today',
    ].includes(props.deepLink) &&
    Number.isSafeInteger(props.interactionRevision) &&
    props.interactionRevision >= 0 &&
    props.interactionRevision <= 10_000 &&
    countsAreSafe &&
    timestampsAreSafe &&
    actionTokensAreSafe &&
    pendingTokensAreSafe &&
    props.actionTokens.length + props.pendingActionTokens.length <= 32 &&
    !props.actionTokens.some((token) => props.pendingActionTokens.includes(token));
  const stateIsSafe =
    baseSchemaIsSafe &&
    ((props.status === 'empty' &&
      props.completedCount === 0 &&
      props.totalCount === 0 &&
      props.actionTokens.length === 0) ||
      ((props.status === 'disabled' || props.status === 'stale') &&
        props.phase === 'none' &&
        props.completedCount === 0 &&
        props.totalCount === 0 &&
        props.actionTokens.length === 0) ||
      (props.status === 'ready' &&
        props.phase !== 'none' &&
        props.totalCount > 0 &&
        props.completedCount < props.totalCount &&
        props.actionTokens.length === props.totalCount - props.completedCount &&
        props.pendingActionTokens.length <= props.completedCount) ||
      (props.status === 'complete' &&
        props.phase !== 'none' &&
        props.totalCount > 0 &&
        props.completedCount === props.totalCount &&
        props.actionTokens.length === 0 &&
        props.pendingActionTokens.length <= props.completedCount));

  const family = environment.widgetFamily;
  const isAccessory =
    family === 'accessoryCircular' ||
    family === 'accessoryInline' ||
    family === 'accessoryRectangular';
  const backgroundColor = environment.colorScheme === 'dark' ? '#1C1815' : '#F5F1EA';
  const rootModifiers = [
    containerBackground(isAccessory ? 'clear' : backgroundColor, 'widget'),
    privacySensitive(),
    ...(stateIsSafe ? [widgetURL(props.deepLink)] : []),
  ];
  const renderTimeMs = Date.now();
  const currentAtRender =
    stateIsSafe &&
    props.status !== 'stale' &&
    renderTimeMs >= props.updatedAtMs &&
    renderTimeMs < props.staleAtMs;
  const canCheckOff =
    currentAtRender &&
    !isAccessory &&
    props.status === 'ready' &&
    props.actionTokens.length > 0 &&
    props.pendingActionTokens.length < 32 &&
    props.interactionRevision < 10_000;
  const showsCounts = currentAtRender && (props.status === 'ready' || props.status === 'complete');
  const statusLabel =
    !stateIsSafe || !currentAtRender
      ? 'Open RoutineKind to refresh'
      : props.status === 'complete'
        ? 'Done for today'
        : props.status === 'empty'
          ? 'Nothing scheduled'
          : props.status === 'disabled'
            ? 'Widget unavailable'
            : props.phase === 'PM'
              ? 'Evening routine'
              : 'Morning routine';

  if (family === 'accessoryInline') {
    return (
      <Text
        modifiers={[
          ...rootModifiers,
          ...(showsCounts ? [privacySensitive(), monospacedDigit()] : []),
        ]}
      >
        {showsCounts ? `${props.completedCount} of ${props.totalCount} today` : statusLabel}
      </Text>
    );
  }

  if (isAccessory) {
    return (
      <VStack alignment="leading" spacing={2} modifiers={rootModifiers}>
        <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>Today</Text>
        <Text
          modifiers={[
            font({ textStyle: 'headline', weight: 'semibold' }),
            ...(showsCounts ? [privacySensitive(), monospacedDigit()] : []),
          ]}
        >
          {showsCounts ? `${props.completedCount} of ${props.totalCount}` : statusLabel}
        </Text>
      </VStack>
    );
  }

  const checkOffButton = canCheckOff ? (
    <Button
      label="Complete next"
      target="widget-action:complete-next"
      modifiers={[buttonStyle('borderedProminent'), controlSize('small'), tint('#A5694B')]}
      onPress={() => {
        const pressedAtMs = Date.now();
        if (pressedAtMs < props.updatedAtMs || pressedAtMs >= props.staleAtMs) {
          return {
            schemaVersion: 2,
            ownerGeneration: props.ownerGeneration,
            snapshotNonce: props.snapshotNonce,
            status: 'stale',
            phase: 'none',
            localDate: props.localDate,
            completedCount: 0,
            totalCount: 0,
            actionTokens: [],
            pendingActionTokens: props.pendingActionTokens,
            interactionRevision: props.interactionRevision,
            deepLink: props.deepLink,
            updatedAtMs: props.updatedAtMs,
            staleAtMs: props.staleAtMs,
          };
        }
        const actionToken = props.actionTokens[0];
        const completedCount = props.completedCount + 1;
        return {
          schemaVersion: 2,
          ownerGeneration: props.ownerGeneration,
          snapshotNonce: props.snapshotNonce,
          status: completedCount === props.totalCount ? 'complete' : 'ready',
          phase: props.phase,
          localDate: props.localDate,
          completedCount,
          totalCount: props.totalCount,
          actionTokens: props.actionTokens.slice(1),
          pendingActionTokens: [...props.pendingActionTokens, actionToken],
          interactionRevision: props.interactionRevision + 1,
          deepLink: props.deepLink,
          updatedAtMs: pressedAtMs,
          staleAtMs: props.staleAtMs,
        };
      }}
    />
  ) : null;

  if (family === 'systemMedium') {
    return (
      <HStack spacing={12} modifiers={[...rootModifiers, padding({ all: 4 })]}>
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>Today</Text>
          <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>
            {statusLabel}
          </Text>
          {showsCounts ? (
            <Text
              modifiers={[
                font({ textStyle: 'title2', weight: 'bold' }),
                foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                privacySensitive(),
                monospacedDigit(),
              ]}
            >
              {props.completedCount} of {props.totalCount}
            </Text>
          ) : null}
        </VStack>
        <Spacer />
        {checkOffButton}
      </HStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={6} modifiers={[...rootModifiers, padding({ all: 2 })]}>
      <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>Today</Text>
      <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>{statusLabel}</Text>
      {showsCounts ? (
        <Text
          modifiers={[
            font({ textStyle: 'title2', weight: 'bold' }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            privacySensitive(),
            monospacedDigit(),
          ]}
        >
          {props.completedCount} of {props.totalCount}
        </Text>
      ) : null}
      {checkOffButton}
    </VStack>
  );
};

export default createWidget<RoutineWidgetProps>('RoutineKindToday', RoutineKindTodayWidgetLayout);
