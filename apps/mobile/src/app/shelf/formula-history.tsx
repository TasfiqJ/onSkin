import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { useShelfMutations } from '@/features/shelf/mutations';
import { OWNED_BOTTLE38_MAX_VERSIONS } from '@/features/shelf/ownedBottleVersion38';
import {
  loadOwnedBottleHistory38,
  type OwnedBottleHistorySnapshot38,
} from '@/features/shelf/store';
import { useShelf } from '@/features/shelf/useShelf';
import { localDateString } from '@/features/today/useToday';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
  runCurrentHealthDataOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

type Draft = {
  snapshot: OwnedBottleHistorySnapshot38;
  source: NonNullable<ReturnType<typeof useShelf>['data']>;
  lease: ReturnType<typeof captureHealthDataWriteLease>;
  focus: number;
};

function ObservationField({ label, value, onChange, maxLength, multiline = false, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
  disabled: boolean;
}) {
  return (
    <View className="mt-4">
      <Text variant="label" tone="muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        accessibilityState={{ disabled }}
        maxLength={maxLength}
        multiline={multiline}
        autoCorrect={false}
        autoCapitalize="none"
        placeholder={label.startsWith('Date') ? 'YYYY-MM-DD' : 'Unknown if left empty'}
        placeholderTextColor={colors.mutedLight}
        style={{ minHeight: multiline ? 144 : 48, textAlignVertical: 'top' }}
        className="mt-1 rounded-[12px] border border-hairline bg-paper px-3.5 py-3 font-sans text-[16px] text-ink"
      />
    </View>
  );
}

export default function FormulaHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shelf = useShelf();
  // A new unit or health generation receives a fresh memory-only screen. The
  // key also masks former-owner drafts synchronously, before effect cleanup.
  return <FormulaHistoryContent key={`${id}/${shelf.data?.sourceGeneration ?? 'closed'}`} id={id} shelf={shelf} />;
}

function FormulaHistoryContent({ id, shelf }: { id: string; shelf: ReturnType<typeof useShelf> }) {
  const online = useSyncExternalStore(
    (notify) => onlineManager.subscribe(() => notify()),
    () => onlineManager.isOnline(),
    () => true,
  );
  const qc = useQueryClient();
  const mutations = useShelfMutations();
  const focus = useRef(0);
  const focused = useRef(false);
  const saving = useRef(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<'label' | 'unknown' | null>(null);
  const [label, setLabel] = useState('');
  const [market, setMarket] = useState('');
  const [variant, setVariant] = useState('');
  const [observed, setObserved] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const generation = shelf.data?.sourceGeneration;
  const product = [...(shelf.data?.items ?? []), ...(shelf.data?.archive ?? [])]
    .find((item) => item.id === id)?.product;
  const history = useQuery({
    queryKey: ['owned-bottle-history38', id, generation],
    enabled: !!product && generation !== undefined,
    networkMode: 'always',
    retry: false,
    queryFn: () => runCurrentHealthDataOperation(async (lease) => {
      lease.assertCurrent();
      const snapshot = await loadOwnedBottleHistory38(id);
      lease.assertCurrent();
      return { snapshot, generation: lease.generation };
    }),
  });
  useFocusEffect(useCallback(() => {
    focused.current = true;
    focus.current += 1;
    return () => {
      focused.current = false;
      focus.current += 1;
      setDraft(null);
      setLabel('');
      setMarket('');
      setVariant('');
      setObserved('');
      setFeedback(null);
    };
  }, []));

  const available = !!product && !!shelf.data && !shelf.isError && !shelf.isFetching &&
    !history.isError && history.data?.generation === generation;
  const snapshot = available ? history.data?.snapshot : null;
  const close = () => backOrReplace(router, APP_SHELF_ROUTE);

  function assertDraftCurrent(accepted: Draft) {
    assertHealthDataWriteLease(accepted.lease);
    const state = qc.getQueryState(['shelf']);
    if (!focused.current || focus.current !== accepted.focus ||
      qc.getQueryData(['shelf']) !== accepted.source || state?.status !== 'success' ||
      state.fetchStatus !== 'idle') throw new Error('FORMULA38_STALE');
  }

  function startDraft() {
    if (!snapshot || !shelf.data || !available || saving.current) return;
    try {
      const lease = captureHealthDataWriteLease();
      assertHealthDataWriteLease(lease);
      setDraft({ snapshot, source: shelf.data, lease, focus: focus.current });
      setMode(null);
      setLabel('');
      setMarket('');
      setVariant('');
      setObserved(localDateString());
      setFeedback(null);
    } catch {
      setFeedback('Your owner or consent changed. Leave this screen and reopen history.');
    }
  }

  async function confirm() {
    if (!draft || !mode || saving.current) return;
    const accepted = draft;
    saving.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      assertDraftCurrent(accepted);
      const result = await mutations.confirmBottleObservation({
        productId: id,
        expectedUpdatedAt: accepted.snapshot.productUpdatedAt,
        expectedProductIdentityHash: accepted.snapshot.productIdentityHash,
        expectedRevision: accepted.snapshot.revision,
        expectedCurrentVersionId: accepted.snapshot.currentVersionId,
        confirmation: mode === 'label' ? 'confirm_label' : 'retain_unknown',
        labelText: mode === 'label' ? label : null,
        market: market || null,
        variant: variant || null,
        observedOn: observed || null,
      }, () => assertDraftCurrent(accepted));
      assertHealthDataWriteLease(accepted.lease);
      if (!focused.current || focus.current !== accepted.focus) return;
      qc.setQueryData(['owned-bottle-history38', id, generation], { snapshot: result, generation });
      setDraft(null);
      setLabel('');
      setMarket('');
      setVariant('');
      setObserved('');
      setFeedback('Saved on this device and read back.');
      await history.refetch();
    } catch (error) {
      // Do not surface exception content, which could include personal label text.
      let currentOwner = false;
      try { assertHealthDataWriteLease(accepted.lease); currentOwner = true; } catch { /* retired */ }
      if (!currentOwner) {
        setDraft(null);
        setLabel('');
        setMarket('');
        setVariant('');
        setObserved('');
        setFeedback('Your owner or consent changed. Leave this screen and reopen history.');
      } else {
        const code = error instanceof Error ? error.message : '';
        setFeedback(code === 'FORMULA38_STALE'
          ? 'This draft is outdated. Cancel it and refresh history before recording again.'
          : code === 'FORMULA38_INVALID'
            ? 'Check the label, variant, market and observation date. Use plain text within the shown limits and a real date no later than today.'
            : 'Storage did not confirm this observation. Your draft is still here. Refresh history before retrying; an uncertain save may already be present.');
      }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function refresh() {
    if (saving.current) return;
    setFeedback(null);
    await shelf.refetch();
    await history.refetch();
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center gap-3">
        <RouteIconButton accessibilityLabel="Back" onPress={close} disabled={busy} />
        <Text variant="titleSm" className="flex-1">Bottle &amp; formula history</Text>
      </View>
      {feedback ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" variant="bodySm" className="mt-3 mb-2">{feedback}</Text> : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-8 pt-4">
        <Text variant="body" className="font-sans-semibold">{product?.name ?? 'Product unavailable'}</Text>
        <Text accessibilityLiveRegion="polite" variant="bodySm" className="mt-2">
          {online ? 'Works offline on this device when private storage is available.' : 'Offline. Bottle history and confirmation use private storage on this device.'}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-2">
          Local to this device. History is not sent to the cloud product mirror. A local-device data export can include this history and retained legacy Shelf data; importing or restoring that export is not supported. Removing this product or clearing local data removes its history. No cloud restore is promised.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-2">
          Your confirmed label is an observation of this bottle, not scientific or clinical validation. A name, barcode, parsed ingredient list or reviewed catalog entry does not confirm its formula. Ingredient order does not show concentration.
        </Text>
        {!available || !snapshot ? (
          <View className="mt-5 gap-3">
            <Text accessibilityRole="alert" variant="bodySm">
              {history.isPending && product ? 'Loading private bottle history…' : 'Bottle history unavailable. No data was reset. Your owner, consent or private storage may have changed.'}
            </Text>
            <Button label="Refresh history" onPress={() => void refresh()} disabled={busy || history.isFetching} />
          </View>
        ) : (
          <>
            <View className="mt-5 rounded-[16px] border border-hairline bg-paper-raised p-4">
              <Text variant="eyebrow">Current bottle version</Text>
              <Text variant="bodySm" className="mt-2">
                {snapshot.currentVersion ? `Revision ${snapshot.revision} · ${snapshot.currentVersion.formulaVersion.labelStatus === 'user_confirmed_label' ? 'User confirmed label' : 'Label unknown'}` : 'Unknown · no bottle observation confirmed'}
              </Text>
              <Text selectable variant="label" tone="muted" className="mt-2">Owned unit: {snapshot.ownedUnitId}</Text>
              <Text variant="bodySm" tone="muted" className="mt-2">
                Existing ingredient text: {product?.ingredients.length ? (product.addedVia === 'manual' ? 'user entered, unconfirmed' : product.ingredientParseStatus ? `parsed (${product.ingredientParseStatus}), unconfirmed for this bottle` : 'source text, unconfirmed for this bottle') : 'unknown'}.
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-2">
                Market: {snapshot.currentVersion?.formulaVersion.market ?? 'unknown'} · Variant: {snapshot.currentVersion?.formulaVersion.variant ?? 'unknown'}
              </Text>
            </View>
            {snapshot.revision >= OWNED_BOTTLE38_MAX_VERSIONS ? <Text variant="bodySm" className="mt-3">This bottle has reached the limit of {OWNED_BOTTLE38_MAX_VERSIONS} observations. Its history is retained; no further version can be added.</Text> : null}
            {!draft ? <Button className="mt-4" label="Record label observation" onPress={startDraft} disabled={!available || busy || snapshot.revision >= OWNED_BOTTLE38_MAX_VERSIONS} /> : (
              <View className="mt-4 rounded-[16px] border border-hairline bg-paper-raised p-4">
                <Text variant="titleSm">Draft observation</Text>
                <Text variant="bodySm" tone="muted" className="mt-2">Nothing is confirmed until you tap Confirm this bottle observation. Corrections append a version; the previous record stays factual.</Text>
                <Button className="mt-3" label="I have the printed label" variant={mode === 'label' ? 'primary' : 'inverse'} accessibilityState={{ selected: mode === 'label', disabled: busy }} onPress={() => setMode('label')} disabled={busy} />
                <Button className="mt-2" label="Keep label unknown" variant={mode === 'unknown' ? 'primary' : 'inverse'} accessibilityState={{ selected: mode === 'unknown', disabled: busy }} onPress={() => setMode('unknown')} disabled={busy} />
                {mode === 'label' ? <>
                  <ObservationField label="Ingredient label as printed" value={label} onChange={setLabel} maxLength={8000} multiline disabled={busy} />
                  <Text variant="label" tone="muted" className="mt-1">Up to 8,000 characters / 24,000 UTF-8 bytes. Transcribe the label; no parsing or formula inference.</Text>
                </> : null}
                {mode === 'unknown' ? <Text variant="bodySm" className="mt-3">The ingredient label will remain unknown. No existing text or prior bottle confirmation is copied.</Text> : null}
                <ObservationField label="Variant as printed" value={variant} onChange={setVariant} maxLength={160} disabled={busy} />
                <ObservationField label="Market as printed" value={market} onChange={setMarket} maxLength={80} disabled={busy} />
                <ObservationField label="Date observed (YYYY-MM-DD)" value={observed} onChange={setObserved} maxLength={10} disabled={busy} />
                <Text variant="label" tone="muted" className="mt-2">Leave unavailable fields empty. Market and variant are your observed text, not validated catalog provenance.</Text>
                <Button className="mt-5" label={busy ? 'Saving observation…' : 'Confirm this bottle observation'} onPress={() => void confirm()} disabled={busy || !mode || (mode === 'label' && !label.trim()) || !available} />
                <Button className="mt-2" label="Cancel draft" variant="ghost" disabled={busy} onPress={() => { setDraft(null); setLabel(''); setMarket(''); setVariant(''); setObserved(''); setFeedback(null); }} />
              </View>
            )}
            <Button className="mt-2" label="Refresh history" variant="ghost" onPress={() => void refresh()} disabled={busy || history.isFetching} />
            <Text variant="titleSm" className="mt-5">Recorded versions</Text>
            {!snapshot.versions.length ? <Text variant="bodySm" tone="muted" className="mt-2">No confirmed versions. This bottle’s label, market and variant remain unknown.</Text> : null}
            {[...snapshot.versions].reverse().map((version) => (
              <View key={version.id} className="mt-3 rounded-[16px] border border-hairline p-4">
                <Text variant="bodySm" className="font-sans-semibold">{version.id === snapshot.currentVersionId ? 'Current' : 'Prior'} · {version.formulaVersion.labelStatus === 'user_confirmed_label' ? 'User confirmed label' : 'Label unknown'}</Text>
                <Text variant="bodySm" className="mt-2">Identity when recorded: {version.productIdentity.name}{version.productIdentity.brand ? ` / ${version.productIdentity.brand}` : ''}</Text>
                <Text variant="bodySm" tone="muted" className="mt-2">Identity source: {version.productIdentity.addedVia === 'manual' ? 'user entered' : version.productIdentity.addedVia}. Catalog source: {version.productIdentity.catalogSource ?? 'unknown'} · catalog quality: {version.productIdentity.catalogMatchQuality ?? 'unknown'}. These describe identity metadata, not this bottle’s confirmation.</Text>
                <Text variant="bodySm" className="mt-2">Market: {version.formulaVersion.market ?? 'unknown'} · Variant: {version.formulaVersion.variant ?? 'unknown'}</Text>
                <Text selectable variant="bodySm" className="mt-2">{version.formulaVersion.labelText ?? 'Ingredient label unknown'}</Text>
                <Text variant="label" tone="muted" className="mt-2">Observed: {version.observedOn ?? 'unknown'} · Recorded: {version.recordedAt} · Basis: {version.basis === 'label_in_hand' ? 'owner observed printed label' : 'owner retained unknown'}</Text>
                <Text selectable variant="label" tone="muted" className="mt-2">Version: {version.id}{'\n'}Previous: {version.previousVersionId ?? 'none'}{'\n'}Content SHA256: {version.contentHash}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
