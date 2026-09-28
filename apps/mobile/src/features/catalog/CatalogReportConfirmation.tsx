import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

import type { CatalogReportInput } from './client';
import {
  catalogReportDisclosureFields,
  catalogReportHasRequiredIdentity,
} from './reportPresentation';
import { catalogReportHasValidRequestId } from './reportTransport';

const REPORT_DATA_TREATMENT = `Your current ${BRAND.appName} account ID links this report to you. It is stored in ${BRAND.appName}'s Supabase backend and is available to ${BRAND.appName}'s catalog-review team and authorized operators. It is included in your ${BRAND.appName} data export. Account deletion or health-data consent withdrawal starts deletion from active ${BRAND.appName} systems; backup or legally required retention may not be immediate.`;
const REPORT_RECIPIENT_BOUNDARY =
  'Nothing is sent to Open Beauty Facts or any other third-party catalog provider.';

export function CatalogReportConfirmation({
  input,
  busy,
  confirmDisabled = false,
  tone = 'light',
  children,
  onCancel,
  onConfirm,
}: {
  input: CatalogReportInput;
  busy: boolean;
  confirmDisabled?: boolean;
  tone?: 'light' | 'night';
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const night = tone === 'night';
  const disclosureFields = catalogReportDisclosureFields(input);
  const sendDisabled =
    busy ||
    confirmDisabled ||
    !catalogReportHasValidRequestId(input) ||
    !catalogReportHasRequiredIdentity(input);

  return (
    <View
      accessibilityLabel="Confirm catalog report"
      className={cn(
        'rounded-[16px] border px-4 py-3.5',
        night ? 'border-clay-bright/30' : 'border-hairline bg-paper-raised',
      )}
      style={night ? { backgroundColor: 'rgba(244,239,231,0.08)' } : undefined}
    >
      <Text variant="body" tone={night ? 'inverse' : 'ink'} className="font-sans-bold">
        Confirm catalog report
      </Text>
      {children ? <View className="mt-3">{children}</View> : null}
      <Text variant="label" tone={night ? 'inverseMuted' : 'muted'} className="mt-3">
        Report details to send
      </Text>
      <View className="mt-1.5 gap-1">
        {disclosureFields.map((field) => (
          <Text
            key={`${field.label}:${field.value}`}
            variant="bodySm"
            tone={night ? 'inverse' : 'ink'}
            selectable
          >
            <Text variant="bodySm" tone={night ? 'inverseMuted' : 'muted'}>
              {field.label}:{' '}
            </Text>
            {field.value}
          </Text>
        ))}
      </View>
      <Text variant="bodySm" tone={night ? 'inverseMuted' : 'muted'} className="mt-3">
        {REPORT_DATA_TREATMENT}
      </Text>
      <Text
        variant="bodySm"
        className="mt-2 font-sans-semibold"
        style={{ color: night ? colors.clayBright : colors.clayDeep }}
      >
        {REPORT_RECIPIENT_BOUNDARY}
      </Text>
      <Text variant="label" tone={night ? 'inverseMuted' : 'muted'} className="mt-2">
        The list above is the sanitized product and report detail. A separate random retry ID with
        no product or account content prevents duplicate submissions. Your signed-in session and
        current health-data consent are checked separately to authorize it.
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: sendDisabled }}
          disabled={sendDisabled}
          onPress={onConfirm}
          className={cn(
            'min-h-[48px] flex-1 basis-[140px] items-center justify-center rounded-pill px-4 py-2.5',
            night ? 'bg-paper' : 'bg-ink',
            sendDisabled && 'opacity-40',
          )}
        >
          <Text variant="bodySm" tone={night ? 'ink' : 'inverse'} className="font-sans-bold">
            {busy ? 'Sending report...' : 'Send report'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onCancel}
          className={cn(
            'min-h-[48px] flex-1 basis-[110px] items-center justify-center rounded-pill border px-4 py-2.5',
            night ? 'border-paper/30' : 'border-hairline-strong',
            busy && 'opacity-40',
          )}
        >
          <Text variant="bodySm" tone={night ? 'inverse' : 'muted'} className="font-sans-bold">
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
