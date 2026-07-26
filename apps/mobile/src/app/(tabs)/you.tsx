import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';

import {
  Button,
  Card,
  Screen,
  StateLoading,
  StateNotice,
  Text,
  ToggleSwitch,
} from '@/components/ui';
import {
  commerceConsentQueryOptions,
  commerceConsentWithdrawalPendingQueryOptions,
} from '@/features/commerce/consentQuery';
import { requestReviewAfterValue } from '@/features/review/prompt';
import { applySettingsPrivacyChoice } from '@/features/settings/applyPrivacyChoice';
import {
  persistSettingsPrivacyConsentChoice,
  retryableSettingsPrivacyChoice,
} from '@/features/settings/privacyConsentPersistence';
import {
  motionAllowed,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import {
  beginDataRightsConfirmation,
  beginDataRightsOperation,
  cancelDataRightsConfirmation,
  IDLE_DATA_RIGHTS_STATE,
  settleDataRightsOperation,
  type DataRightsState,
  type PendingDataRightsAction,
} from '@/features/settings/youDataRightsState';
import {
  readYouRenderDiagnostics,
  recordYouAccountRender,
  recordYouAppLockStart,
  recordYouCommerceRender,
  recordYouConsentCoordinatorRender,
  recordYouConsentStart,
  recordYouDataRender,
  recordYouDataRightsCoordinatorRender,
  recordYouDestructiveStart,
  recordYouExportStart,
  recordYouMutationShellRender,
  recordYouPoliciesRender,
  recordYouPolicyStart,
  recordYouPrivacyRender,
  recordYouScreenRender,
  recordYouSecurityRender,
  recordYouStaticOverviewRender,
  recordYouSubscriptionRender,
} from '@/features/settings/youRenderDiagnostics';
import { isEntitlementEvidenceUncertain } from '@/features/subscription/entitlement';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { track } from '@/lib/analytics/track';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { useAuth } from '@/lib/auth/AuthProvider';
import { BRAND } from '@/lib/brand';
import { localDiagnosticsAccessEnabled } from '@/lib/diagnostics/localDiagnosticsAccess';
import {
  consentManagementState,
  latestConsentsQueryOptions,
  type ConsentManagementState,
} from '@/lib/consent/consentQuery';
import {
  appLockUserMessage,
  dataRightsUserMessage,
  privacyChoiceUserMessage,
} from '@/lib/errors/userFacing';
import { NOT_MEDICAL_ADVICE } from '@/lib/legal/disclaimer';
import { type PolicyLinkKey, policyLinkRows } from '@/lib/legal/policyLinks';
import { phase7Flags } from '@/lib/launch/phase7';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { isOwnerQueryScopeCurrent, ownerQueryPrefixes, queryKeys } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

const POLICY_ROWS = policyLinkRows([
  'privacy',
  'consumerHealthPrivacy',
  'terms',
  'support',
  'accountDeletion',
  'dataExport',
]);

const POLICY_HINTS: Record<PolicyLinkKey, string> = {
  terms: `Rules for using ${BRAND.appName} and subscription terms.`,
  privacy: 'What data we collect, use, and share.',
  consumerHealthPrivacy: 'Consumer health data notice and rights.',
  support: 'Help with accounts, billing, deletion, or export.',
  accountDeletion: 'How account deletion works before and after deleting in app.',
  dataExport: 'How to request and read your export.',
};

const POLICY_LINK_UNAVAILABLE_MESSAGE =
  'Link unavailable. We could not open this policy link. Please try again.';
const PRIVACY_CHOICE_SAVE_FAILED_TITLE = 'Choice not saved';
const EXPORT_UNAVAILABLE_TITLE = 'Export unavailable';
const EXPORT_UNAVAILABLE_MESSAGE =
  "We couldn't open the export sheet on this device. The temporary export file was removed.";
const DATA_EXPORT_SCOPE_HINT =
  'Includes data saved to your account and on this device: profile, shelf, routine settings, completion history, preferences, and Progress notes. Photo files and thumbnails stay encrypted here; share images individually from Progress.';
const EXPORT_FAILED_TITLE = 'Export failed';
const WITHDRAW_HEALTH_DATA_CONFIRM_TITLE = 'Withdraw health-data consent?';
const WITHDRAW_HEALTH_DATA_CONFIRM_MESSAGE =
  'This records your withdrawal and deletes your collected health data. Your account and routine are closed. Apple or Google subscription billing continues until you cancel in the store.';
const WITHDRAW_HEALTH_DATA_FAILED_TITLE = 'Withdrawal failed';
const DELETE_ACCOUNT_CONFIRM_TITLE = 'Delete account?';
const DELETE_ACCOUNT_CONFIRM_MESSAGE =
  'This permanently deletes your account and data. Apple or Google subscription billing continues until you cancel in the store.';
const DELETE_ACCOUNT_FAILED_TITLE = 'Deletion failed';
const COMPACT_FOR_YOU_TOP_MARGIN = 240;
const COMPACT_SECONDARY_ROUTINE_TOP_MARGIN = 48;
const SUPPORT_FLOOR_SECONDARY_ROUTINE_TOP_MARGIN = 640;
const TALL_TEXT_PRESSURE_SECONDARY_ROUTINE_TOP_MARGIN = 640;
const SHORT_PHONE_SECONDARY_ROUTINE_TOP_MARGIN = 104;
const DATA_RIGHTS_CONFIRMATION_SCROLL_NUDGE = 144;
const PRIVACY_DIRECT_ENTRY_TOP_OFFSET = 16;
const PRIVACY_DIRECT_ENTRY_COMPACT_SCROLL_NUDGE = 0;
const PRIVACY_DIRECT_ENTRY_NARROW_SCROLL_NUDGE = 30;
const PRIVACY_DIRECT_ENTRY_SHORT_SCROLL_NUDGE = 8;
const PRIVACY_DIRECT_ENTRY_SUPPORT_SCROLL_NUDGE = 48;
const PRIVACY_DIRECT_ENTRY_ULTRA_SHORT_SCROLL_NUDGE = 56;
const PRIVACY_DIRECT_ENTRY_MICRO_SHORT_SCROLL_NUDGE = 64;
const PRIVACY_DIRECT_ENTRY_NARROW_WITHDRAW_MARGIN = 0;
const PRIVACY_DIRECT_ENTRY_SUPPORT_WITHDRAW_MARGIN = 80;
const PRIVACY_DIRECT_ENTRY_COMPACT_POLICY_MARGIN = 640;
const PRIVACY_DIRECT_ENTRY_SHORT_WIDE_POLICY_MARGIN = 180;
const PRIVACY_DIRECT_ENTRY_DATA_MARGIN = 72;
const PRIVACY_DIRECT_ENTRY_POLICY_CONSUMER_HEALTH_MARGIN = 120;
const PRIVACY_DIRECT_ENTRY_TALL_POLICY_CONSUMER_HEALTH_MARGIN = 220;
const PRIVACY_DIRECT_ENTRY_POLICY_SUPPORT_MARGIN = 300;
const PRIVACY_DIRECT_ENTRY_POLICY_TERMS_MARGIN = 48;
const PRIVACY_DIRECT_ENTRY_POLICY_DATA_EXPORT_MARGIN = 144;

type StaticRouteHref = Extract<Href, string>;
type PrivacyFeedbackKey = 'marketing' | 'data_sharing';
type PrivacyFeedbackPlacement = 'commerce' | 'privacy';
type InlineNotice = {
  title: string;
  message: string;
};
type PrivacyFeedback = {
  granted: boolean;
  key: PrivacyFeedbackKey;
  ownerGeneration: number;
  placement: PrivacyFeedbackPlacement;
  message: string;
};
type PolicyFeedback = {
  key: PolicyLinkKey;
  message: string;
};
type ConsentControl = ConsentManagementState;
type ConsentContextValue = Readonly<{
  commerceConsentControl: ConsentControl;
  marketingConsentControl: ConsentControl;
  privacyFeedback: PrivacyFeedback | null;
  savingPrivacy: 'marketing' | 'data_sharing' | null;
  retryCommerceConsent: () => void;
  retryMarketingConsent: () => void;
  retryPrivacyChoice: () => void;
  setConsent: (
    type: 'marketing' | 'data_sharing',
    granted: boolean,
    placement: PrivacyFeedbackPlacement,
  ) => void;
}>;
type DataRightsContextValue = Readonly<{
  cancelConfirmation: () => void;
  dataRightsFeedback: InlineNotice | null;
  exportFeedback: InlineNotice | null;
  privacyActionFeedback: InlineNotice | null;
  promptAction: (action: PendingDataRightsAction) => void;
  runAction: (action: PendingDataRightsAction) => void;
  startExport: () => void;
  state: DataRightsState;
}>;

const YouConsentContext = createContext<ConsentContextValue | null>(null);
const YouDataRightsContext = createContext<DataRightsContextValue | null>(null);

function ConsentReadState({
  label,
  onRetry,
  state,
}: {
  label: string;
  onRetry: () => void;
  state: ConsentManagementState;
}) {
  if (state.isUnavailable) {
    return (
      <StateNotice
        kind="unavailable"
        compact
        className="mb-2"
        title={`${label} status unavailable`}
        body={
          state.hasVerifiedValue
            ? 'The last confirmed choice is shown. You can turn an active choice off, or try the read again.'
            : 'We could not safely read this choice. Nothing was changed, and the switch remains unavailable.'
        }
      >
        <Button
          accessibilityLabel={`Retry ${label} consent status`}
          className="mt-2"
          disabled={!state.canRetry}
          label={state.isChecking ? 'Trying again...' : 'Try again'}
          variant="ghost"
          onPress={onRetry}
        />
      </StateNotice>
    );
  }

  if (!state.isChecking) return null;
  return <StateLoading label={`Checking ${label.toLowerCase()} consent...`} className="pb-2" />;
}

function Row({
  label,
  hint,
  children,
  compact,
  disabled,
  onPress,
}: {
  label: string;
  hint?: string;
  children?: React.ReactNode;
  compact?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const labelContent = (
    <>
      <View className="flex-1 pr-3">
        <Text
          variant="body"
          className="font-sans-medium"
          style={compact ? { fontSize: 14, lineHeight: 17 } : undefined}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            variant="bodySm"
            tone="muted"
            className="mt-0.5"
            style={compact ? { fontSize: 12, lineHeight: 16 } : undefined}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      {onPress ? (
        <View className="h-[44px] w-[44px] items-center justify-center">
          <Text variant="body" tone="muted" style={{ fontSize: 18 }}>
            &gt;
          </Text>
        </View>
      ) : (
        children
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        className={
          compact
            ? 'min-h-[48px] flex-row items-center justify-between py-0.5'
            : 'min-h-[56px] flex-row items-center justify-between py-2'
        }
        style={({ pressed }) =>
          disabled ? { opacity: 0.68 } : pressed ? { opacity: 0.82 } : undefined
        }
      >
        {labelContent}
      </Pressable>
    );
  }

  return (
    <View
      className={
        compact
          ? 'min-h-[48px] flex-row items-center justify-between py-0.5'
          : 'min-h-[56px] flex-row items-center justify-between py-2'
      }
    >
      {labelContent}
    </View>
  );
}

function Toggle({
  value,
  disabled,
  onChange,
  accessibilityLabel,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  accessibilityLabel: string;
}) {
  return (
    <ToggleSwitch
      accessibilityLabel={accessibilityLabel}
      value={value}
      disabled={disabled}
      inactiveTrackColor={colors.greigeDeep}
      onChange={onChange}
    />
  );
}

function InlineNoticeCard({
  notice,
  className = 'mt-2',
}: {
  notice: InlineNotice;
  className?: string;
}) {
  return (
    <StateNotice
      kind="error"
      compact
      align="center"
      className={className}
      title={notice.title}
      body={notice.message}
    />
  );
}

function InlineConfirmCard({
  title,
  message,
  confirmLabel,
  disabled,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <StateNotice
      kind="destructive"
      compact
      align="center"
      className="mt-2"
      title={title}
      body={message}
    >
      <Button
        className="mt-3"
        label={confirmLabel}
        variant="accent"
        disabled={disabled}
        onPress={onConfirm}
      />
      <Button
        className="mt-2"
        label="Cancel"
        variant="ghost"
        disabled={disabled}
        onPress={onCancel}
      />
    </StateNotice>
  );
}

function openPolicyUrl(url: string): Promise<boolean> {
  return openExternalHttpsUrl(url, {
    invalidTitle: 'Link not configured',
    invalidMessage: 'This policy URL must be configured before launch.',
    failureTitle: 'Link unavailable',
    failureMessage: 'We could not open this policy link. Please try again.',
    alertOnFailure: false,
  });
}

function publishYouRenderDiagnostics(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || typeof document === 'undefined') return;

  const screen = document.getElementById('you-screen');
  if (!screen) return;
  const diagnostics = readYouRenderDiagnostics();
  for (const [key, value] of Object.entries(diagnostics)) {
    const attribute = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    screen.setAttribute(`data-you-${attribute}`, String(value));
  }
}

function usePublishYouRenderDiagnostics(): void {
  useEffect(() => {
    publishYouRenderDiagnostics();
  });
}

function useMountedRef() {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}

function waitForDuplicateActivationFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function useYouConsent(): ConsentContextValue {
  const context = useContext(YouConsentContext);
  if (!context) throw new Error('You consent sections must be inside YouConsentCoordinator.');
  return context;
}

function useYouDataRights(): DataRightsContextValue {
  const context = useContext(YouDataRightsContext);
  if (!context) {
    throw new Error('You data-rights sections must be inside YouDataRightsCoordinator.');
  }
  return context;
}

const YouConsentCoordinator = memo(function YouConsentCoordinator({
  children,
  pendingFeedbackPlacement,
}: {
  children: ReactNode;
  pendingFeedbackPlacement: PrivacyFeedbackPlacement;
}) {
  recordYouConsentCoordinatorRender();
  usePublishYouRenderDiagnostics();
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const mountedRef = useMountedRef();
  const [savingPrivacy, setSavingPrivacy] = useState<'marketing' | 'data_sharing' | null>(null);
  const [privacyFeedback, setPrivacyFeedback] = useState<PrivacyFeedback | null>(null);
  const savingPrivacyRef = useRef(false);
  const consentRequestIdRef = useRef(0);
  const consents = useQuery(latestConsentsQueryOptions(ownerScope));
  // Both data-sharing switches observe the effective commerce gate: either explicit
  // false locks it, while local absence lets a new device honor its server grant.
  const commerceConsent = useQuery(commerceConsentQueryOptions(ownerScope));
  const commerceConsentWithdrawalPending = useQuery(
    commerceConsentWithdrawalPendingQueryOptions(ownerScope),
  );
  const marketingConsentControl = consentManagementState(
    consents,
    (latest) => latest.marketing === true,
  );
  const commerceConsentControl = consentManagementState(
    commerceConsent,
    (effective) => effective === true,
  );

  const visiblePrivacyFeedback = useMemo<PrivacyFeedback | null>(() => {
    const currentOwnerFeedback =
      privacyFeedback?.ownerGeneration === ownerScope.generation ? privacyFeedback : null;
    if (commerceConsentWithdrawalPending.data !== true) return currentOwnerFeedback;
    if (currentOwnerFeedback?.key === 'data_sharing' && currentOwnerFeedback.granted === false) {
      return currentOwnerFeedback;
    }
    return {
      granted: false,
      key: 'data_sharing',
      ownerGeneration: ownerScope.generation,
      placement: pendingFeedbackPlacement,
      message: privacyChoiceUserMessage(),
    };
  }, [
    commerceConsentWithdrawalPending.data,
    ownerScope.generation,
    pendingFeedbackPlacement,
    privacyFeedback,
  ]);

  const setConsent = useCallback(
    async (
      type: 'marketing' | 'data_sharing',
      granted: boolean,
      placement: PrivacyFeedbackPlacement,
    ) => {
      if (type === 'data_sharing' && granted && commerceConsentWithdrawalPending.data === true) {
        setPrivacyFeedback({
          granted: false,
          key: 'data_sharing',
          ownerGeneration: ownerScope.generation,
          placement,
          message: privacyChoiceUserMessage(),
        });
        return;
      }
      if (savingPrivacyRef.current) return;
      savingPrivacyRef.current = true;
      const requestId = ++consentRequestIdRef.current;
      recordYouConsentStart();
      setSavingPrivacy(type);
      setPrivacyFeedback(null);

      const canPublishUi = () =>
        mountedRef.current &&
        consentRequestIdRef.current === requestId &&
        isOwnerQueryScopeCurrent(ownerScope);
      let choiceOperationSucceeded = false;

      try {
        await applySettingsPrivacyChoice({
          save: async () => {
            await persistSettingsPrivacyConsentChoice(ownerScope, {
              type,
              granted,
              onLocalDataSharingSaved: (localGranted) => {
                qc.setQueryData<boolean>(queryKeys.commerceConsent(ownerScope), localGranted);
                qc.setQueryData<boolean>(
                  queryKeys.commerceConsentWithdrawalPending(ownerScope),
                  !localGranted,
                );
              },
              onDataSharingWithdrawalCompleted: () => {
                qc.setQueryData<boolean>(
                  queryKeys.commerceConsentWithdrawalPending(ownerScope),
                  false,
                );
              },
            });
            choiceOperationSucceeded = true;
          },
          onSaved: () => {
            if (isOwnerQueryScopeCurrent(ownerScope)) {
              qc.setQueryData<Record<string, boolean>>(queryKeys.consents(ownerScope), (prev) => ({
                ...(prev ?? {}),
                [type]: granted,
              }));
              if (type === 'data_sharing') {
                qc.setQueryData<boolean>(queryKeys.commerceConsent(ownerScope), granted);
              }
            }
            if (canPublishUi()) setPrivacyFeedback(null);
          },
          onFailure: () => {
            if (canPublishUi()) {
              setPrivacyFeedback({
                granted,
                key: type,
                ownerGeneration: ownerScope.generation,
                placement,
                message: privacyChoiceUserMessage(),
              });
            }
          },
          onSettled: async () => {
            if (!isOwnerQueryScopeCurrent(ownerScope)) return;
            await qc.invalidateQueries({ queryKey: ownerQueryPrefixes.consents(ownerScope) });
            if (type === 'data_sharing' && choiceOperationSucceeded) {
              await qc.invalidateQueries({
                queryKey: ownerQueryPrefixes.commerceConsent(ownerScope),
              });
            }
            if (type === 'data_sharing') {
              await qc.invalidateQueries({
                queryKey: ownerQueryPrefixes.commerceConsentWithdrawalPending(ownerScope),
              });
            }
          },
        });
      } finally {
        await waitForDuplicateActivationFrame();
        if (consentRequestIdRef.current === requestId) savingPrivacyRef.current = false;
        if (mountedRef.current && consentRequestIdRef.current === requestId) {
          setSavingPrivacy(null);
        }
      }
    },
    [commerceConsentWithdrawalPending.data, mountedRef, ownerScope, qc],
  );

  const retryPrivacyChoice = useCallback(() => {
    const failed = visiblePrivacyFeedback;
    if (!failed) return;
    const retry = retryableSettingsPrivacyChoice(
      {
        granted: failed.granted,
        ownerGeneration: failed.ownerGeneration,
        placement: failed.placement,
        type: failed.key,
      },
      ownerScope,
    );
    if (!retry) {
      setPrivacyFeedback(null);
      return;
    }
    void setConsent(retry.type, retry.granted, retry.placement);
  }, [ownerScope, setConsent, visiblePrivacyFeedback]);

  const retryCommerceConsent = useCallback(() => {
    void commerceConsent.refetch();
    void commerceConsentWithdrawalPending.refetch();
  }, [commerceConsent, commerceConsentWithdrawalPending]);
  const retryMarketingConsent = useCallback(() => {
    void consents.refetch();
  }, [consents]);
  const context = useMemo<ConsentContextValue>(
    () => ({
      commerceConsentControl,
      marketingConsentControl,
      privacyFeedback: visiblePrivacyFeedback,
      savingPrivacy,
      retryCommerceConsent,
      retryMarketingConsent,
      retryPrivacyChoice,
      setConsent,
    }),
    [
      commerceConsentControl,
      marketingConsentControl,
      retryCommerceConsent,
      retryMarketingConsent,
      retryPrivacyChoice,
      savingPrivacy,
      setConsent,
      visiblePrivacyFeedback,
    ],
  );

  return <YouConsentContext.Provider value={context}>{children}</YouConsentContext.Provider>;
});

const YouDataRightsCoordinator = memo(function YouDataRightsCoordinator({
  children,
  onConfirmationDismissed,
  onConfirmationRequested,
}: {
  children: ReactNode;
  onConfirmationDismissed: () => void;
  onConfirmationRequested: () => void;
}) {
  recordYouDataRightsCoordinatorRender();
  usePublishYouRenderDiagnostics();
  const { signOut } = useAuth();
  const ownerScope = useOwnerQueryScope();
  const mountedRef = useMountedRef();
  const [state, setState] = useState<DataRightsState>(IDLE_DATA_RIGHTS_STATE);
  const [privacyActionFeedback, setPrivacyActionFeedback] = useState<InlineNotice | null>(null);
  const [exportFeedback, setExportFeedback] = useState<InlineNotice | null>(null);
  const [dataRightsFeedback, setDataRightsFeedback] = useState<InlineNotice | null>(null);
  const stateRef = useRef<DataRightsState>(IDLE_DATA_RIGHTS_STATE);
  const nextOperationIdRef = useRef(0);

  const clearFeedback = useCallback(() => {
    setPrivacyActionFeedback(null);
    setExportFeedback(null);
    setDataRightsFeedback(null);
  }, []);

  const settleOperation = useCallback(
    (operationId: number) => {
      const settled = settleDataRightsOperation(stateRef.current, operationId);
      if (!settled) return;
      stateRef.current = settled;
      if (mountedRef.current) setState(settled);
    },
    [mountedRef],
  );

  const promptAction = useCallback(
    (action: PendingDataRightsAction) => {
      const next = beginDataRightsConfirmation(stateRef.current, action);
      if (!next) return;
      stateRef.current = next;
      setState(next);
      clearFeedback();
      onConfirmationRequested();
    },
    [clearFeedback, onConfirmationRequested],
  );

  const cancelConfirmation = useCallback(() => {
    const next = cancelDataRightsConfirmation(stateRef.current);
    if (!next) return;
    stateRef.current = next;
    setState(next);
    onConfirmationDismissed();
  }, [onConfirmationDismissed]);

  const startExport = useCallback(() => {
    const operationId = nextOperationIdRef.current + 1;
    const next = beginDataRightsOperation(stateRef.current, 'export', operationId);
    if (!next) return;
    nextOperationIdRef.current = operationId;
    stateRef.current = next;
    recordYouExportStart();
    setState(next);
    clearFeedback();

    void (async () => {
      try {
        const { exportData } = await import('@/features/settings/actions');
        if (!mountedRef.current || !isOwnerQueryScopeCurrent(ownerScope)) return;
        const shared = await exportData();
        if (
          !mountedRef.current ||
          stateRef.current.phase !== 'running' ||
          stateRef.current.operationId !== operationId ||
          !isOwnerQueryScopeCurrent(ownerScope)
        ) {
          return;
        }
        if (!shared) {
          setExportFeedback({
            title: EXPORT_UNAVAILABLE_TITLE,
            message: EXPORT_UNAVAILABLE_MESSAGE,
          });
          return;
        }
        void requestReviewAfterValue('data_export_success');
      } catch {
        if (
          mountedRef.current &&
          stateRef.current.phase === 'running' &&
          stateRef.current.operationId === operationId &&
          isOwnerQueryScopeCurrent(ownerScope)
        ) {
          setExportFeedback({ title: EXPORT_FAILED_TITLE, message: dataRightsUserMessage() });
        }
      } finally {
        await waitForDuplicateActivationFrame();
        settleOperation(operationId);
      }
    })();
  }, [clearFeedback, mountedRef, ownerScope, settleOperation]);

  const runAction = useCallback(
    (action: PendingDataRightsAction) => {
      const operationId = nextOperationIdRef.current + 1;
      const next = beginDataRightsOperation(stateRef.current, action, operationId);
      if (!next) return;
      nextOperationIdRef.current = operationId;
      stateRef.current = next;
      onConfirmationDismissed();
      recordYouDestructiveStart();
      setState(next);
      clearFeedback();

      void (async () => {
        try {
          const actions = await import('@/features/settings/actions');
          if (!mountedRef.current || !isOwnerQueryScopeCurrent(ownerScope)) return;
          if (action === 'withdraw_health_data') {
            await actions.withdrawHealthDataConsent(signOut);
          } else {
            await actions.deleteAccount(signOut);
          }
          router.replace('/');
        } catch {
          if (
            mountedRef.current &&
            stateRef.current.phase === 'running' &&
            stateRef.current.operationId === operationId &&
            isOwnerQueryScopeCurrent(ownerScope)
          ) {
            const notice = {
              title:
                action === 'withdraw_health_data'
                  ? WITHDRAW_HEALTH_DATA_FAILED_TITLE
                  : DELETE_ACCOUNT_FAILED_TITLE,
              message: dataRightsUserMessage(),
            };
            if (action === 'withdraw_health_data') setPrivacyActionFeedback(notice);
            else setDataRightsFeedback(notice);
          }
        } finally {
          settleOperation(operationId);
        }
      })();
    },
    [clearFeedback, mountedRef, onConfirmationDismissed, ownerScope, settleOperation, signOut],
  );

  const context = useMemo<DataRightsContextValue>(
    () => ({
      cancelConfirmation,
      dataRightsFeedback,
      exportFeedback,
      privacyActionFeedback,
      promptAction,
      runAction,
      startExport,
      state,
    }),
    [
      cancelConfirmation,
      dataRightsFeedback,
      exportFeedback,
      privacyActionFeedback,
      promptAction,
      runAction,
      startExport,
      state,
    ],
  );

  return <YouDataRightsContext.Provider value={context}>{children}</YouDataRightsContext.Provider>;
});

const YouAccountCard = memo(function YouAccountCard({ compactPhone }: { compactPhone: boolean }) {
  recordYouAccountRender();
  usePublishYouRenderDiagnostics();
  const { user, isAnonymous, signOut } = useAuth();
  const accountLabel = isAnonymous ? 'Guest (not saved)' : (user?.email ?? 'Signed in');

  return (
    <Card className={compactPhone ? 'mt-3 p-3' : 'mt-6'}>
      <Text variant="label" tone="muted">
        ACCOUNT
      </Text>
      {compactPhone ? (
        <View className="mt-1 min-h-[48px] flex-row items-center justify-between gap-3">
          <Text variant="body" className="flex-1 font-sans-medium">
            {accountLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isAnonymous ? 'Create an account' : 'Sign out'}
            onPress={() => (isAnonymous ? router.push('/onboarding/account') : void signOut())}
            className="min-h-[48px] items-center justify-center rounded-pill px-4 py-2"
            style={({ pressed }) => [
              { backgroundColor: colors.greige },
              pressed ? { opacity: 0.82 } : undefined,
            ]}
          >
            <Text className="font-sans-semibold text-[13px]" style={{ color: colors.ink }}>
              {isAnonymous ? 'Create' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text variant="body" className="mt-2 font-sans-medium">
            {accountLabel}
          </Text>
          {isAnonymous ? (
            <Button
              className="mt-4"
              label="Create an account"
              onPress={() => router.push('/onboarding/account')}
            />
          ) : (
            <Button
              className="mt-4"
              label="Sign out"
              variant="ghost"
              onPress={() => void signOut()}
            />
          )}
        </>
      )}
    </Card>
  );
});

const YouSubscriptionCard = memo(function YouSubscriptionCard({
  compactPhone,
}: {
  compactPhone: boolean;
}) {
  recordYouSubscriptionRender();
  usePublishYouRenderDiagnostics();
  const { data: ent, isError: entitlementError, isLoading: entitlementLoading } = useEntitlement();
  const entitlementUncertain = !ent ? entitlementError : isEntitlementEvidenceUncertain(ent);
  const planLabel =
    entitlementLoading || (!ent && !entitlementError)
      ? 'Checking plan'
      : !ent || entitlementUncertain
        ? 'Plan status unavailable'
        : ent.inReverseTrial
          ? 'Exploring Pro'
          : ent.inTrial
            ? 'Free trial · Pro'
            : ent.isPro
              ? `${BRAND.proName} · active`
              : 'Free plan';

  return (
    <Card className={compactPhone ? 'mt-2 p-3' : 'mt-4'}>
      <Text variant="label" tone="muted" className="mb-1">
        SUBSCRIPTION
      </Text>
      <Row
        label="Manage subscription"
        hint={planLabel}
        compact={compactPhone}
        onPress={() => router.push('/settings/subscription')}
      />
    </Card>
  );
});

const YouStaticOverview = memo(function YouStaticOverview({
  compactPhone,
  height,
  highTextPressureYou,
  privacyDirectEntry,
  secondaryRoutineTopMargin,
}: {
  compactPhone: boolean;
  height: number;
  highTextPressureYou: boolean;
  privacyDirectEntry: boolean;
  secondaryRoutineTopMargin: number;
}) {
  recordYouStaticOverviewRender();
  usePublishYouRenderDiagnostics();
  const routineRows: { label: string; href: StaticRouteHref }[] = [
    { label: 'Your plan', href: '/routine/plan' },
    { label: 'Edit the order', href: '/routine/reorder' },
    { label: 'Retinoid ramp', href: '/routine/ramp' },
    { label: 'Streak & adherence', href: '/routine/streak' },
    { label: 'Weekly check-in', href: '/routine/tolerance' },
    { label: 'Recent changes', href: '/routine/adaptation' },
  ];
  if (phase7Flags.widgets) {
    routineRows.push({ label: 'Widgets & Live Activity', href: '/routine/widgets' });
  }
  const shortPhone = compactPhone && height < 600;
  const primaryRoutineRows = highTextPressureYou
    ? routineRows.slice(0, 1)
    : shortPhone
      ? routineRows.slice(0, 2)
      : compactPhone
        ? routineRows.slice(0, 3)
        : routineRows;
  const secondaryRoutineRows = highTextPressureYou
    ? routineRows.slice(1)
    : shortPhone
      ? routineRows.slice(2)
      : compactPhone
        ? routineRows.slice(3)
        : [];
  const forYouRows: { label: string; href: StaticRouteHref; hint?: string }[] = [
    {
      label: 'Pregnancy & breastfeeding',
      href: '/settings/skin-profile',
      hint: 'Review your routine safety setting.',
    },
    { label: 'Recommendations', href: '/recommendations' },
    { label: 'Recommendation preferences', href: '/recommendations/preferences' },
    {
      label: 'Skin Notes',
      href: '/community',
      hint: 'Myth vs evidence, reviewed and claim-safe.',
    },
  ];
  if (phase7Flags.cloudAsk) {
    forYouRows.unshift({
      label: BRAND.askName,
      href: '/ask',
      hint: 'Your evidence-grounded advisor.',
    });
  }
  if (phase7Flags.commerce) {
    forYouRows.push({ label: 'Shoppable routines', href: '/commerce/stacks' });
  }

  return (
    <>
      <Text variant="title" className={compactPhone ? 'mt-1' : 'mt-2'}>
        You
      </Text>
      <YouAccountCard compactPhone={compactPhone} />
      <YouSubscriptionCard compactPhone={compactPhone} />
      <Card className={compactPhone ? 'mt-2 p-3' : 'mt-4'}>
        <Text variant="label" tone="muted" className="mb-1">
          YOUR ROUTINE
        </Text>
        {primaryRoutineRows.map(({ label, href }) => (
          <Row key={href} label={label} compact={compactPhone} onPress={() => router.push(href)} />
        ))}
      </Card>
      {secondaryRoutineRows.length > 0 ? (
        <Card className="p-3" style={{ marginTop: secondaryRoutineTopMargin }}>
          <Text variant="label" tone="muted" className="mb-1">
            MORE ROUTINE
          </Text>
          {secondaryRoutineRows.map(({ label, href }) => (
            <Row
              key={href}
              label={label}
              compact={compactPhone}
              onPress={() => router.push(href)}
            />
          ))}
        </Card>
      ) : null}
      {privacyDirectEntry ? null : (
        <Card
          className={compactPhone ? undefined : 'mt-4'}
          style={compactPhone ? { marginTop: COMPACT_FOR_YOU_TOP_MARGIN } : undefined}
        >
          <Text variant="label" tone="muted" className="mb-1">
            FOR YOU
          </Text>
          {forYouRows.map(({ label, href, hint }) => (
            <Row key={href} label={label} hint={hint} onPress={() => router.push(href)} />
          ))}
        </Card>
      )}
    </>
  );
});

function ConsentFeedbackText({
  feedback,
  feedbackKey,
  onRetry,
  placement,
  retryDisabled,
}: {
  feedback: PrivacyFeedback | null;
  feedbackKey: PrivacyFeedbackKey;
  onRetry: () => void;
  placement: PrivacyFeedbackPlacement;
  retryDisabled: boolean;
}) {
  if (feedback?.key !== feedbackKey || feedback.placement !== placement) return null;
  return (
    <View className="items-center gap-2 pb-2">
      <Text accessibilityRole="alert" variant="bodySm" tone="muted" className="text-center">
        {PRIVACY_CHOICE_SAVE_FAILED_TITLE}
        {'\n'}
        {feedback.message}
      </Text>
      <Button
        accessibilityLabel={`Try saving ${feedbackKey.replace('_', ' ')} choice again`}
        disabled={retryDisabled}
        fullWidth={false}
        label="Try again"
        onPress={onRetry}
        variant="ghost"
      />
    </View>
  );
}

const YouCommerceSection = memo(function YouCommerceSection() {
  recordYouCommerceRender();
  usePublishYouRenderDiagnostics();
  const {
    commerceConsentControl,
    privacyFeedback,
    retryCommerceConsent,
    retryPrivacyChoice,
    savingPrivacy,
    setConsent,
  } = useYouConsent();

  return (
    <Card className="mt-4">
      <Text variant="label" tone="muted" className="mb-1">
        WHERE TO BUY
      </Text>
      <Row
        label="How we stay honest"
        hint="Why recommendations and money stay separate. And every paid link is disclosed."
        onPress={() => router.push('/commerce/transparency')}
      />
      <Row
        label="Share data with partners (where-to-buy)"
        hint="Off by default. A separate, revocable MHMDA choice. Turn off and we won’t show paid links."
      >
        <Toggle
          accessibilityLabel="Share data with partners for where-to-buy"
          value={commerceConsentControl.value}
          disabled={savingPrivacy !== null || !commerceConsentControl.canChange}
          onChange={(value) => void setConsent('data_sharing', value, 'commerce')}
        />
      </Row>
      <ConsentFeedbackText
        feedback={privacyFeedback}
        feedbackKey="data_sharing"
        onRetry={retryPrivacyChoice}
        placement="commerce"
        retryDisabled={savingPrivacy !== null}
      />
      <ConsentReadState
        label="Data sharing"
        state={commerceConsentControl}
        onRetry={retryCommerceConsent}
      />
    </Card>
  );
});

const YouSecuritySection = memo(function YouSecuritySection({
  privacyDirectEntry,
}: {
  privacyDirectEntry: boolean;
}) {
  recordYouSecurityRender();
  usePublishYouRenderDiagnostics();
  const { enabled: lockEnabled, setEnabled: setLockEnabled } = useAppLock();
  const mountedRef = useMountedRef();
  const [savingAppLock, setSavingAppLock] = useState(false);
  const [appLockFeedback, setAppLockFeedback] = useState<string | null>(null);
  const savingAppLockRef = useRef(false);
  const appLockRequestIdRef = useRef(0);

  const setAppLockChoice = useCallback(
    async (enabled: boolean) => {
      if (savingAppLockRef.current) return;
      savingAppLockRef.current = true;
      const requestId = ++appLockRequestIdRef.current;
      recordYouAppLockStart();
      setSavingAppLock(true);
      setAppLockFeedback(null);
      try {
        await setLockEnabled(enabled);
        if (mountedRef.current && appLockRequestIdRef.current === requestId) {
          setAppLockFeedback(null);
        }
      } catch {
        if (mountedRef.current && appLockRequestIdRef.current === requestId) {
          setAppLockFeedback(appLockUserMessage());
        }
      } finally {
        await waitForDuplicateActivationFrame();
        if (appLockRequestIdRef.current === requestId) savingAppLockRef.current = false;
        if (mountedRef.current && appLockRequestIdRef.current === requestId) {
          setSavingAppLock(false);
        }
      }
    },
    [mountedRef, setLockEnabled],
  );

  return (
    <Card
      className={privacyDirectEntry ? undefined : 'mt-4'}
      style={privacyDirectEntry ? { marginTop: PRIVACY_DIRECT_ENTRY_DATA_MARGIN } : undefined}
    >
      <Text variant="label" tone="muted" className="mb-1">
        SECURITY
      </Text>
      <Row
        label="App lock"
        hint="Require your phone's unlock to open the app and your photo timeline."
      >
        <Toggle
          accessibilityLabel="App lock"
          value={lockEnabled}
          disabled={savingAppLock}
          onChange={(value) => void setAppLockChoice(value)}
        />
      </Row>
      {appLockFeedback ? (
        <Text accessibilityRole="alert" variant="bodySm" tone="muted" className="pb-2 text-center">
          {PRIVACY_CHOICE_SAVE_FAILED_TITLE}
          {'\n'}
          {appLockFeedback}
        </Text>
      ) : null}
      <Row
        label="Progress photo storage"
        hint="Encrypted on this device. Cloud backup is not available in this build."
      >
        <Text variant="bodySm" tone="muted" className="text-right">
          Device only
        </Text>
      </Row>
    </Card>
  );
});

const YouStaticUtilitySections = memo(function YouStaticUtilitySections({
  compactPhone,
  privacyDirectEntry,
}: {
  compactPhone: boolean;
  privacyDirectEntry: boolean;
}) {
  if (privacyDirectEntry) return null;
  return (
    <>
      <Card className="mt-4">
        <Text variant="label" tone="muted" className="mb-1">
          REMINDERS
        </Text>
        <Row
          label="Reminders & notifications"
          hint="Tiered, capped, at times you choose. Quiet hours & lock-screen discretion."
          onPress={() => router.push('/settings/notifications')}
        />
      </Card>
      <Card className="mt-4">
        <Text variant="label" tone="muted" className="mb-1">
          HELP
        </Text>
        <Row
          label="Beta feedback"
          hint="Send a categorized issue through support."
          compact={compactPhone}
          onPress={() => router.push('/settings/beta-feedback')}
        />
        {localDiagnosticsAccessEnabled() ? (
          <Row
            label="Local diagnostics"
            hint="Development-only content-free health and timing snapshot."
            compact={compactPhone}
            onPress={() => router.push('/settings/diagnostics' as Href)}
          />
        ) : null}
      </Card>
    </>
  );
});

const YouPrivacySection = memo(function YouPrivacySection({
  compactPhone,
  narrowPrivacyWithdrawStyle,
  onLayout,
  privacyDirectEntry,
  supportFloorPrivacyEntry,
  ultraShortPrivacyEntry,
}: {
  compactPhone: boolean;
  narrowPrivacyWithdrawStyle: { marginTop: number } | undefined;
  onLayout: (event: LayoutChangeEvent) => void;
  privacyDirectEntry: boolean;
  supportFloorPrivacyEntry: boolean;
  ultraShortPrivacyEntry: boolean;
}) {
  recordYouPrivacyRender();
  usePublishYouRenderDiagnostics();
  const {
    commerceConsentControl,
    marketingConsentControl,
    privacyFeedback,
    retryCommerceConsent,
    retryMarketingConsent,
    retryPrivacyChoice,
    savingPrivacy,
    setConsent,
  } = useYouConsent();
  const {
    cancelConfirmation,
    privacyActionFeedback,
    promptAction,
    runAction,
    state: dataRightsState,
  } = useYouDataRights();
  const confirmingWithdraw =
    dataRightsState.phase === 'confirming' && dataRightsState.action === 'withdraw_health_data';
  const withdrawing =
    dataRightsState.phase === 'running' && dataRightsState.action === 'withdraw_health_data';
  const dataRightsBusy = dataRightsState.phase !== 'idle';

  return (
    <Card className="mt-4" onLayout={onLayout}>
      <Text variant="label" tone="muted" className="mb-1">
        PRIVACY &amp; CONSENT
      </Text>
      <Row
        label="Marketing emails"
        hint={
          supportFloorPrivacyEntry || ultraShortPrivacyEntry
            ? undefined
            : 'Off by default. Opt in anytime.'
        }
      >
        <Toggle
          accessibilityLabel="Marketing emails"
          value={marketingConsentControl.value}
          disabled={savingPrivacy !== null || !marketingConsentControl.canChange}
          onChange={(value) => void setConsent('marketing', value, 'privacy')}
        />
      </Row>
      <ConsentFeedbackText
        feedback={privacyFeedback}
        feedbackKey="marketing"
        onRetry={retryPrivacyChoice}
        placement="privacy"
        retryDisabled={savingPrivacy !== null}
      />
      <ConsentReadState
        label="Marketing"
        state={marketingConsentControl}
        onRetry={retryMarketingConsent}
      />
      {phase7Flags.commerce ? (
        <>
          <Row
            label="Share data with partners"
            hint="Separate from collection (MHMDA). Off by default."
          >
            <Toggle
              accessibilityLabel="Share data with partners"
              value={commerceConsentControl.value}
              disabled={savingPrivacy !== null || !commerceConsentControl.canChange}
              onChange={(value) => void setConsent('data_sharing', value, 'privacy')}
            />
          </Row>
          <ConsentFeedbackText
            feedback={privacyFeedback}
            feedbackKey="data_sharing"
            onRetry={retryPrivacyChoice}
            placement="privacy"
            retryDisabled={savingPrivacy !== null}
          />
          <ConsentReadState
            label="Data sharing"
            state={commerceConsentControl}
            onRetry={retryCommerceConsent}
          />
        </>
      ) : null}
      {privacyDirectEntry ? null : (
        <Row
          label="Photos & the no-AI-score promise"
          compact={compactPhone}
          onPress={() => router.push('/progress/about')}
        />
      )}
      {phase7Flags.trend ? (
        <Row
          label="Changes in your own photos"
          hint="Optional · on-device · off by default · no score, ever."
          onPress={() => router.push('/trend/optin')}
        />
      ) : null}
      {phase7Flags.cloudAsk ? (
        <Row
          label={`${BRAND.askName}. Private advisor`}
          hint="Optional · the deeper cloud advisor · off by default. The on-device answers about your own shelf are always free."
          onPress={() => router.push('/ask/consent')}
        />
      ) : null}
      <View style={narrowPrivacyWithdrawStyle}>
        <Row
          label="Withdraw health-data consent"
          hint={
            supportFloorPrivacyEntry || ultraShortPrivacyEntry
              ? undefined
              : compactPhone
                ? 'Records withdrawal and deletes collected health data.'
                : 'Records your withdrawal in the consent ledger and deletes your collected health data.'
          }
          compact={compactPhone}
          disabled={dataRightsBusy}
          onPress={() => promptAction('withdraw_health_data')}
        />
        {confirmingWithdraw || withdrawing ? (
          <InlineConfirmCard
            title={WITHDRAW_HEALTH_DATA_CONFIRM_TITLE}
            message={WITHDRAW_HEALTH_DATA_CONFIRM_MESSAGE}
            confirmLabel={withdrawing ? 'Working...' : 'Withdraw & delete'}
            disabled={withdrawing}
            onCancel={cancelConfirmation}
            onConfirm={() => runAction('withdraw_health_data')}
          />
        ) : null}
        {privacyActionFeedback ? (
          <InlineNoticeCard notice={privacyActionFeedback} className="mt-3" />
        ) : null}
      </View>
    </Card>
  );
});

const YouPoliciesSection = memo(function YouPoliciesSection({
  compactPhone,
  privacyDirectEntry,
  privacyPolicyCardMarginTop,
  tallPhonePrivacyEntry,
  ultraShortPrivacyEntry,
}: {
  compactPhone: boolean;
  privacyDirectEntry: boolean;
  privacyPolicyCardMarginTop: number | undefined;
  tallPhonePrivacyEntry: boolean;
  ultraShortPrivacyEntry: boolean;
}) {
  recordYouPoliciesRender();
  usePublishYouRenderDiagnostics();
  const mountedRef = useMountedRef();
  const [pendingPolicy, setPendingPolicy] = useState<PolicyLinkKey | null>(null);
  const [policyFeedback, setPolicyFeedback] = useState<PolicyFeedback | null>(null);
  const pendingPolicyRef = useRef<PolicyLinkKey | null>(null);
  const policyRequestIdRef = useRef(0);

  const openPolicyRow = useCallback(
    async (row: (typeof POLICY_ROWS)[number]) => {
      if (pendingPolicyRef.current !== null) return;
      pendingPolicyRef.current = row.key;
      const requestId = ++policyRequestIdRef.current;
      recordYouPolicyStart();
      setPendingPolicy(row.key);
      setPolicyFeedback(null);
      try {
        let opened = false;
        try {
          opened = await openPolicyUrl(row.url);
        } catch {
          opened = false;
        }
        if (row.key === 'support') {
          if (opened) {
            track('support_contact_opened', { source: 'settings', result: 'opened' });
          } else {
            track('support_contact_failed', { source: 'settings', result: 'unavailable' });
          }
        }
        if (!opened && mountedRef.current && policyRequestIdRef.current === requestId) {
          setPolicyFeedback({ key: row.key, message: POLICY_LINK_UNAVAILABLE_MESSAGE });
        }
      } finally {
        await waitForDuplicateActivationFrame();
        if (policyRequestIdRef.current === requestId) pendingPolicyRef.current = null;
        if (mountedRef.current && policyRequestIdRef.current === requestId) setPendingPolicy(null);
      }
    },
    [mountedRef],
  );

  return (
    <Card
      className={privacyPolicyCardMarginTop === undefined ? 'mt-4' : undefined}
      style={
        privacyPolicyCardMarginTop === undefined
          ? undefined
          : { marginTop: privacyPolicyCardMarginTop }
      }
    >
      <Text variant="label" tone="muted" className="mb-1">
        POLICIES
      </Text>
      {POLICY_ROWS.map((row) => (
        <View
          key={row.key}
          style={
            privacyDirectEntry && row.key === 'consumerHealthPrivacy'
              ? {
                  marginTop: tallPhonePrivacyEntry
                    ? PRIVACY_DIRECT_ENTRY_TALL_POLICY_CONSUMER_HEALTH_MARGIN
                    : PRIVACY_DIRECT_ENTRY_POLICY_CONSUMER_HEALTH_MARGIN,
                }
              : privacyDirectEntry && row.key === 'terms'
                ? { marginTop: PRIVACY_DIRECT_ENTRY_POLICY_TERMS_MARGIN }
                : privacyDirectEntry && row.key === 'dataExport'
                  ? { marginTop: PRIVACY_DIRECT_ENTRY_POLICY_DATA_EXPORT_MARGIN }
                  : privacyDirectEntry && row.key === 'support'
                    ? { marginTop: PRIVACY_DIRECT_ENTRY_POLICY_SUPPORT_MARGIN }
                    : undefined
          }
        >
          <Row
            label={row.label}
            hint={ultraShortPrivacyEntry ? undefined : POLICY_HINTS[row.key]}
            compact={compactPhone}
            disabled={pendingPolicy !== null}
            onPress={() => void openPolicyRow(row)}
          />
          {policyFeedback?.key === row.key ? (
            <Text
              accessibilityRole="alert"
              variant="bodySm"
              tone="muted"
              className="pb-2 text-center"
            >
              {policyFeedback.message}
            </Text>
          ) : null}
        </View>
      ))}
    </Card>
  );
});

const YouDataSection = memo(function YouDataSection() {
  recordYouDataRender();
  usePublishYouRenderDiagnostics();
  const {
    cancelConfirmation,
    dataRightsFeedback,
    exportFeedback,
    promptAction,
    runAction,
    startExport,
    state,
  } = useYouDataRights();
  const confirmingDelete = state.phase === 'confirming' && state.action === 'delete_account';
  const deleting = state.phase === 'running' && state.action === 'delete_account';
  const exportRunning = state.phase === 'running' && state.action === 'export';
  const dataRightsBusy = state.phase !== 'idle';

  return (
    <Card className="mt-4">
      <Text variant="label" tone="muted" className="mb-1">
        YOUR DATA
      </Text>
      <Button
        className="mt-2"
        label={exportRunning ? 'Preparing...' : 'Export my data'}
        variant="ghost"
        disabled={dataRightsBusy}
        onPress={startExport}
      />
      <Text variant="bodySm" tone="muted" className="mt-2 px-1">
        {DATA_EXPORT_SCOPE_HINT}
      </Text>
      <Button
        className="mt-2"
        label="Delete account"
        variant="ghost"
        disabled={dataRightsBusy}
        onPress={() => promptAction('delete_account')}
      />
      {confirmingDelete || deleting ? (
        <InlineConfirmCard
          title={DELETE_ACCOUNT_CONFIRM_TITLE}
          message={DELETE_ACCOUNT_CONFIRM_MESSAGE}
          confirmLabel={deleting ? 'Working...' : 'Delete'}
          disabled={deleting}
          onCancel={cancelConfirmation}
          onConfirm={() => runAction('delete_account')}
        />
      ) : null}
      {dataRightsFeedback ? (
        <InlineNoticeCard notice={dataRightsFeedback} className="mt-3" />
      ) : null}
      {exportFeedback ? <InlineNoticeCard notice={exportFeedback} className="mt-3" /> : null}
      <Text variant="bodySm" tone="muted" className="mt-3 text-center">
        Progress photos stay encrypted here unless you share one. No ads. No data sales.
      </Text>
    </Card>
  );
});

const YouMutationSections = memo(function YouMutationSections() {
  const reduceMotion = useReduceMotionPreference();
  recordYouMutationShellRender();
  usePublishYouRenderDiagnostics();
  const { fontScale = 1, height, width } = useWindowDimensions();
  const params = useLocalSearchParams<{ section?: string }>();
  const [privacyCardReady, setPrivacyCardReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const privacyCardY = useRef(0);
  const confirmationScrollFrameRef = useRef<number | null>(null);
  const confirmationScrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const privacyLayoutScrollFrameRef = useRef<number | null>(null);
  const privacyLayoutScrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compactPhone = height < 640 || width < 430;
  const supportFloorTextPressureYou =
    width <= 390 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const tallTextPressureYou =
    width <= 430 && height >= 900 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web');
  const highTextPressureYou = supportFloorTextPressureYou || tallTextPressureYou;
  const privacyDirectEntry = params.section === 'privacy';
  const narrowPhone = compactPhone && width < 360;
  const shortPrivacyEntry = privacyDirectEntry && narrowPhone && height < 600;
  const supportFloorPrivacyEntry =
    privacyDirectEntry && narrowPhone && height >= 460 && height < 520;
  const tallPhonePrivacyEntry = privacyDirectEntry && width <= 430 && height >= 900 && height < 980;
  const shortWidePrivacyEntry = privacyDirectEntry && width <= 430 && height >= 640 && height < 780;
  const ultraShortPrivacyEntry = privacyDirectEntry && narrowPhone && height < 460;
  const microShortPrivacyEntry = privacyDirectEntry && narrowPhone && height < 380;
  const privacyDirectEntryScrollNudge = microShortPrivacyEntry
    ? PRIVACY_DIRECT_ENTRY_MICRO_SHORT_SCROLL_NUDGE
    : ultraShortPrivacyEntry
      ? PRIVACY_DIRECT_ENTRY_ULTRA_SHORT_SCROLL_NUDGE
      : supportFloorPrivacyEntry
        ? PRIVACY_DIRECT_ENTRY_SUPPORT_SCROLL_NUDGE
        : shortPrivacyEntry
          ? PRIVACY_DIRECT_ENTRY_SHORT_SCROLL_NUDGE
          : narrowPhone
            ? PRIVACY_DIRECT_ENTRY_NARROW_SCROLL_NUDGE
            : compactPhone
              ? PRIVACY_DIRECT_ENTRY_COMPACT_SCROLL_NUDGE
              : 0;
  const narrowPrivacyWithdrawStyle = supportFloorPrivacyEntry
    ? { marginTop: PRIVACY_DIRECT_ENTRY_SUPPORT_WITHDRAW_MARGIN }
    : privacyDirectEntry && narrowPhone
      ? { marginTop: PRIVACY_DIRECT_ENTRY_NARROW_WITHDRAW_MARGIN }
      : undefined;
  const privacyPolicyCardMarginTop =
    compactPhone && privacyDirectEntry
      ? PRIVACY_DIRECT_ENTRY_COMPACT_POLICY_MARGIN
      : shortWidePrivacyEntry
        ? PRIVACY_DIRECT_ENTRY_SHORT_WIDE_POLICY_MARGIN
        : undefined;
  const shortPhone = compactPhone && height < 600;
  const secondaryRoutineTopMargin = tallTextPressureYou
    ? TALL_TEXT_PRESSURE_SECONDARY_ROUTINE_TOP_MARGIN
    : supportFloorTextPressureYou
      ? SUPPORT_FLOOR_SECONDARY_ROUTINE_TOP_MARGIN
      : shortPhone
        ? SHORT_PHONE_SECONDARY_ROUTINE_TOP_MARGIN
        : COMPACT_SECONDARY_ROUTINE_TOP_MARGIN;

  useEffect(() => {
    if (!privacyDirectEntry || !privacyCardReady) return;

    const scrollToPrivacyCard = () => {
      scrollRef.current?.scrollTo({
        animated: false,
        y: Math.max(
          privacyCardY.current - PRIVACY_DIRECT_ENTRY_TOP_OFFSET + privacyDirectEntryScrollNudge,
          0,
        ),
      });
    };
    const frame = requestAnimationFrame(scrollToPrivacyCard);
    const retry = setTimeout(scrollToPrivacyCard, 180);
    const lateRetry = setTimeout(scrollToPrivacyCard, 360);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(retry);
      clearTimeout(lateRetry);
    };
  }, [privacyDirectEntry, privacyCardReady, privacyDirectEntryScrollNudge]);

  const cancelDataRightsConfirmationScroll = useCallback(() => {
    if (confirmationScrollFrameRef.current !== null) {
      cancelAnimationFrame(confirmationScrollFrameRef.current);
      confirmationScrollFrameRef.current = null;
    }
    if (confirmationScrollRetryRef.current !== null) {
      clearTimeout(confirmationScrollRetryRef.current);
      confirmationScrollRetryRef.current = null;
    }
  }, []);

  const cancelPrivacyLayoutScroll = useCallback(() => {
    if (privacyLayoutScrollFrameRef.current !== null) {
      cancelAnimationFrame(privacyLayoutScrollFrameRef.current);
      privacyLayoutScrollFrameRef.current = null;
    }
    if (privacyLayoutScrollRetryRef.current !== null) {
      clearTimeout(privacyLayoutScrollRetryRef.current);
      privacyLayoutScrollRetryRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      cancelDataRightsConfirmationScroll();
      cancelPrivacyLayoutScroll();
    },
    [cancelDataRightsConfirmationScroll, cancelPrivacyLayoutScroll],
  );

  useEffect(() => {
    if (!privacyDirectEntry) cancelPrivacyLayoutScroll();
  }, [cancelPrivacyLayoutScroll, privacyDirectEntry]);

  const nudgeDataRightsConfirmationIntoView = useCallback(() => {
    cancelDataRightsConfirmationScroll();
    const scrollToConfirmation = () => {
      scrollRef.current?.scrollTo({
        animated: motionAllowed(reduceMotion),
        y: Math.max(scrollY.current + DATA_RIGHTS_CONFIRMATION_SCROLL_NUDGE, 0),
      });
    };

    confirmationScrollFrameRef.current = requestAnimationFrame(scrollToConfirmation);
    confirmationScrollRetryRef.current = setTimeout(scrollToConfirmation, 80);
  }, [cancelDataRightsConfirmationScroll, reduceMotion]);

  const onPrivacyCardLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextPrivacyCardY = event.nativeEvent.layout.y;
      privacyCardY.current = nextPrivacyCardY;
      setPrivacyCardReady(true);
      if (!privacyDirectEntry) return;
      cancelPrivacyLayoutScroll();
      const scrollToCurrentPrivacyCard = () => {
        scrollRef.current?.scrollTo({
          animated: false,
          y: Math.max(
            nextPrivacyCardY - PRIVACY_DIRECT_ENTRY_TOP_OFFSET + privacyDirectEntryScrollNudge,
            0,
          ),
        });
      };
      privacyLayoutScrollFrameRef.current = requestAnimationFrame(scrollToCurrentPrivacyCard);
      privacyLayoutScrollRetryRef.current = setTimeout(scrollToCurrentPrivacyCard, 80);
    },
    [cancelPrivacyLayoutScroll, privacyDirectEntry, privacyDirectEntryScrollNudge],
  );

  return (
    <YouConsentCoordinator pendingFeedbackPlacement={privacyDirectEntry ? 'privacy' : 'commerce'}>
      <YouDataRightsCoordinator
        onConfirmationDismissed={cancelDataRightsConfirmationScroll}
        onConfirmationRequested={nudgeDataRightsConfirmationIntoView}
      >
        <Screen edges={['top']}>
          <ScrollView
            nativeID="you-screen"
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerClassName={compactPhone ? 'pb-32' : 'pb-8'}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <YouStaticOverview
              compactPhone={compactPhone}
              height={height}
              highTextPressureYou={highTextPressureYou}
              privacyDirectEntry={privacyDirectEntry}
              secondaryRoutineTopMargin={secondaryRoutineTopMargin}
            />

            {phase7Flags.commerce ? <YouCommerceSection /> : null}

            <YouSecuritySection privacyDirectEntry={privacyDirectEntry} />
            <YouStaticUtilitySections
              compactPhone={compactPhone}
              privacyDirectEntry={privacyDirectEntry}
            />

            <YouPrivacySection
              compactPhone={compactPhone}
              narrowPrivacyWithdrawStyle={narrowPrivacyWithdrawStyle}
              onLayout={onPrivacyCardLayout}
              privacyDirectEntry={privacyDirectEntry}
              supportFloorPrivacyEntry={supportFloorPrivacyEntry}
              ultraShortPrivacyEntry={ultraShortPrivacyEntry}
            />

            <YouPoliciesSection
              compactPhone={compactPhone}
              privacyDirectEntry={privacyDirectEntry}
              privacyPolicyCardMarginTop={privacyPolicyCardMarginTop}
              tallPhonePrivacyEntry={tallPhonePrivacyEntry}
              ultraShortPrivacyEntry={ultraShortPrivacyEntry}
            />

            <YouDataSection />

            {/* Standing not-medical-advice disclaimer (docs/02 §9). */}
            <Text variant="bodySm" tone="muted" className="mt-5 px-2 text-center text-[12px]">
              {NOT_MEDICAL_ADVICE}
            </Text>
          </ScrollView>
        </Screen>
      </YouDataRightsCoordinator>
    </YouConsentCoordinator>
  );
});

export default function YouScreen() {
  recordYouScreenRender();
  usePublishYouRenderDiagnostics();
  return <YouMutationSections />;
}
