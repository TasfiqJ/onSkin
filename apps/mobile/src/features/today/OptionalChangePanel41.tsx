import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { assertHealthDataWriteLease, type HealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { colors } from '@/theme/tokens';

import { appendOptionalChange41, getOptionalChanges41, type OptionalChangeSnapshot41 } from './completionsStore';
import { completionQueryScope } from './localCompletionAccess';
import { OPTIONAL_CHANGE41_MAX_TEXT, type OptionalChangeEvent41, type OptionalChangeInput41 } from './optionalChange41';
import { localDateString } from './useToday';

const categories = [
  ['skipped_step', 'Skipped a step'],
  ['used_different', 'Used something different'],
  ['noticed_reaction', 'Irritation or uncertain reaction I noticed'],
  ['personal_note', 'Other personal note'],
  ['no_change', 'No change to report'],
] as const;
const categoryLabel = (category: OptionalChangeEvent41['category']) => categories.find(([key]) => key === category)?.[1] ?? category;
type Draft41 = {
  id: string;
  lease: HealthDataWriteLease;
  snapshot: OptionalChangeSnapshot41;
  sourceCurrent: () => boolean;
  focus: number;
  kind: OptionalChangeInput41['kind'];
  target: OptionalChangeEvent41 | null;
  observedOn: string;
  category: OptionalChangeInput41['category'] | null;
  text: string;
  reviewing: boolean;
  attempted: boolean;
  editorToken: number;
};

type PanelProps41 = {
  lease: HealthDataWriteLease;
  isSourceCurrent: () => boolean;
  dark?: boolean;
};

export function OptionalChangePanel41(props: PanelProps41) {
  const [opened, setOpened] = useState(false);
  if (opened) return <OptionalChangeContent41 {...props} />;
  return <View className="mt-4 rounded-card border border-hairline p-4"
    style={{ backgroundColor: props.dark ? colors.nightSurface : colors.paperRaised }}>
    <Button label="Record a change (optional)" variant={props.dark ? 'inverse' : 'primary'} onPress={() => {
      try {
        assertHealthDataWriteLease(props.lease);
        if (props.isSourceCurrent()) setOpened(true);
      } catch { /* A retired entry cannot open a successor owner's history. */ }
    }} />
    <Text variant="bodySm" className="mt-2" style={{ color: props.dark ? colors.cream : colors.muted }}>
      Open your private recorded changes or start a factual note. This is separate from check-offs.
    </Text>
  </View>;
}

function OptionalChangeContent41({ lease, isSourceCurrent, dark = false }: PanelProps41) {
  const focus = useRef(0);
  const focused = useRef(false);
  const saving = useRef(false);
  const opening = useRef(false);
  const editorToken = useRef(0);
  const [draft, setDraft] = useState<Draft41 | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const renderedEditorToken = editorToken.current;
  const changes = useQuery({
    queryKey: ['optional-changes41', ...completionQueryScope(lease)],
    queryFn: () => getOptionalChanges41(lease),
    networkMode: 'always', retry: false, staleTime: 0, refetchOnMount: 'always',
  });
  useFocusEffect(useCallback(() => {
    focused.current = true;
    focus.current += 1;
    setBusy(saving.current || opening.current);
    return () => {
      focused.current = false;
      focus.current += 1;
      editorToken.current += 1;
      setDraft(null);
      setFeedback(null);
    };
  }, []));
  const ink = dark ? colors.cream : colors.ink;
  const muted = dark ? 'rgba(244,239,231,0.72)' : colors.muted;
  let authorityCurrent = false;
  try { assertHealthDataWriteLease(lease); authorityCurrent = isSourceCurrent(); } catch { /* Mask retired authority during render. */ }
  const available = authorityCurrent && !changes.isError && !changes.isFetching && changes.data !== undefined;
  const snapshot = available ? changes.data : undefined;
  const status = feedback ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="mt-3" style={{ color: ink }}>{feedback}</Text> : null;

  function assertDraftCurrent(accepted: Draft41) {
    assertHealthDataWriteLease(accepted.lease);
    if (!focused.current || focus.current !== accepted.focus || editorToken.current !== accepted.editorToken || !accepted.sourceCurrent()) {
      throw new Error('OPTIONAL_CHANGE41_STALE');
    }
  }
  async function start(kind: Draft41['kind'], target: OptionalChangeEvent41 | null = null) {
    if (!snapshot || !available || saving.current || opening.current || renderedEditorToken !== editorToken.current) return;
    const token = ++editorToken.current;
    const openedLease = Object.freeze({ ...lease });
    const openedFocus = focus.current;
    opening.current = true;
    setBusy(true);
    setFeedback('Opening private draft…');
    try {
      assertHealthDataWriteLease(openedLease);
      if (!focused.current || !isSourceCurrent()) throw new Error('OPTIONAL_CHANGE41_STALE');
      // Original check-offs and their sync worker share this encrypted record.
      // Opening an editor must capture a real fresh source, never a cached CAS.
      const [fresh, { randomUUID }] = await Promise.all([getOptionalChanges41(openedLease), import('expo-crypto')]);
      assertHealthDataWriteLease(openedLease);
      if (!focused.current || focus.current !== openedFocus || token !== editorToken.current || !isSourceCurrent()) return;
      if (target && !fresh.events.some((event) => event.id === target.id)) throw new Error('OPTIONAL_CHANGE41_STALE');
      setDraft({ id: randomUUID().toLowerCase(), lease: openedLease, snapshot: fresh,
        sourceCurrent: isSourceCurrent, focus: openedFocus, kind, target,
        observedOn: target?.observedOn ?? localDateString(),
        category: kind === 'retraction' ? 'personal_note' : null, text: '', reviewing: false, attempted: false, editorToken: token });
      setFeedback(null);
    } catch {
      try { assertHealthDataWriteLease(openedLease);
        if (token === editorToken.current && focused.current && focus.current === openedFocus) {
          setFeedback('Private storage did not open this draft. Refresh changes and try again. Nothing was submitted.');
        }
      } catch { /* Retired authority receives no feedback or draft. */ }
    } finally {
      opening.current = false;
      try { assertHealthDataWriteLease(openedLease); if (focused.current) setBusy(saving.current); } catch { /* Retired panel. */ }
    }
  }
  function change(update: Partial<Draft41>) {
    if (saving.current || opening.current || busy || !draft || draft.attempted || draft.editorToken !== editorToken.current) return;
    const token = ++editorToken.current;
    setDraft((current) => current ? { ...current, ...update, editorToken: token } : null);
  }
  function cancel() {
    if (saving.current || !draft || draft.editorToken !== editorToken.current) return;
    editorToken.current += 1;
    setFeedback(draft?.attempted
      ? 'Draft closed. An unconfirmed save may already be recorded; refresh to check.'
      : 'Draft canceled. Nothing was saved.');
    setDraft(null);
  }
  async function refresh() {
    if (saving.current || renderedEditorToken !== editorToken.current) return;
    editorToken.current += 1;
    setDraft(null);
    setFeedback(null);
    await changes.refetch();
  }
  async function confirm() {
    if (!draft?.reviewing || !draft.category || saving.current) return;
    const accepted = draft;
    // State updates are asynchronous. Revoke callbacks through the synchronous
    // token before they can replace or save a canceled/changed/newer editor.
    try { assertDraftCurrent(accepted); } catch { return; }
    saving.current = true;
    setBusy(true);
    setFeedback(null);
    setDraft({ ...accepted, attempted: true });
    try {
      assertDraftCurrent(accepted);
      const input: OptionalChangeInput41 = {
        id: accepted.id, expectedRevision: accepted.snapshot.revision,
        expectedSourceProof: accepted.snapshot.sourceProof, expectedSourceBytes: accepted.snapshot.sourceBytes,
        observedOn: accepted.observedOn, category: accepted.category!, text: accepted.text,
        kind: accepted.kind, targetEventId: accepted.target?.id ?? null, confirmation: true,
      };
      await appendOptionalChange41(input, accepted.lease, () => assertDraftCurrent(accepted));
      assertDraftCurrent(accepted);
      const readback = await changes.refetch();
      assertDraftCurrent(accepted);
      if (readback.isError || !readback.data?.events.some((event) => event.id === accepted.id)) {
        throw new Error('OPTIONAL_CHANGE41_READBACK_UNCONFIRMED');
      }
      setDraft(null);
      editorToken.current += 1;
      setFeedback('Saved on this device and read back.');
    } catch (error) {
      let current = false;
      try { assertDraftCurrent(accepted); current = true; } catch { /* An old callback cannot adopt a later lease. */ }
      if (editorToken.current !== accepted.editorToken) {
        // This callback owns no successor draft or feedback.
      } else if (!current) {
        editorToken.current += 1;
        setDraft(null);
        setFeedback(null);
      } else {
        const code = error instanceof Error ? error.message : '';
        if (code === 'OPTIONAL_CHANGE41_INVALID') {
          setDraft({ ...accepted, reviewing: false, attempted: false, editorToken: ++editorToken.current });
          setFeedback('Check the real local date and plain text within the shown limits. Future dates and unsafe characters cannot be saved.');
        } else if (code === 'OPTIONAL_CHANGE41_STALE' || code === 'OPTIONAL_CHANGE41_OWNER_MISMATCH') {
          editorToken.current += 1;
          setDraft(null);
          setFeedback('This draft is outdated. Refresh changes before recording again.');
        } else if (code === 'OPTIONAL_CHANGE41_BOUND') {
          editorToken.current += 1;
          setDraft(null);
          setFeedback('This device has reached the change history limit. Existing history is retained.');
        } else {
          setFeedback('Storage did not confirm this save. It may already be recorded. Retry the same confirmation or refresh changes to check.');
        }
      }
    } finally {
      saving.current = false;
      // This state belongs only to this keyed panel, never a successor owner.
      try { assertHealthDataWriteLease(accepted.lease); if (focused.current) setBusy(false); } catch { /* Retired panel. */ }
    }
  }

  return (
    <View className="mt-4 rounded-card border border-hairline p-4"
      style={{ backgroundColor: dark ? colors.nightSurface : colors.paperRaised }}>
      <Text variant="titleSm" style={{ color: ink }}>Your optional change notes</Text>
      <Text variant="bodySm" className="mt-2" style={{ color: muted }}>
        Factual notes you choose to record, separate from check-offs. These are your reports, not a diagnosis or an app observation.
      </Text>
      {!authorityCurrent ? <Text accessibilityRole="alert" className="mt-3" style={{ color: ink }}>Private changes unavailable. Your owner, consent or source changed.</Text> : <>
        {!snapshot ? <><Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="mt-3" style={{ color: ink }}>
          {changes.isFetching ? 'Loading private changes…' : 'Private changes unavailable. No data was reset.'}
        </Text>{!draft ? status : null}</> : <>
          {snapshot.events.length === 0 ? <Text className="mt-3" style={{ color: ink }}>Nothing recorded</Text> : snapshot.events.map((event) => (
            <View key={event.id} className="mt-4 border-t border-hairline pt-3">
              <Text className="font-sans-semibold" style={{ color: ink }}>{event.observedOn} · {categoryLabel(event.category)}</Text>
              <Text variant="bodySm" className="mt-1" style={{ color: muted }}>
                {event.kind === 'note' ? 'Owner reported' : `${event.kind === 'correction' ? 'Correction' : 'Retraction'} of entry ${snapshot.events.find((prior) => prior.id === event.targetEventId)?.revision ?? event.targetEventId}`} · Entry {event.revision} · Recorded {event.recordedAt}
              </Text>
              {event.text ? <Text selectable className="mt-2" style={{ color: ink }}>{event.text}</Text> : null}
              <Text selectable variant="label" className="mt-2" style={{ color: muted }}>Event {event.id}</Text>
              {!draft ? <View className="mt-2 gap-2">
                <Button label={`Correct entry ${event.revision}`} variant={dark ? 'inverseGhost' : 'inverse'} disabled={busy} onPress={() => start('correction', event)} />
                <Button label={`Retract entry ${event.revision}`} variant={dark ? 'inverseGhost' : 'inverse'} disabled={busy} onPress={() => start('retraction', event)} />
              </View> : null}
            </View>
          ))}
          {!draft ? status : null}
          {!draft ? <Button className="mt-4" label="Record a change (optional)" variant={dark ? 'inverse' : 'primary'} disabled={busy} onPress={() => start('note')} /> : null}
        </>}
        {draft ? <View className="mt-4 gap-3">
          <Text variant="titleSm" style={{ color: ink }}>{draft.kind === 'note' ? 'Draft change' : draft.kind === 'correction' ? `Correct entry ${draft.target?.revision}` : `Retract entry ${draft.target?.revision}`}</Text>
          <Text variant="bodySm" style={{ color: muted }}>Previous entries stay recorded. Nothing is saved until you confirm.</Text>
          <Text style={{ color: ink }}>Observed local date (YYYY-MM-DD)</Text>
          <TextInput accessibilityLabel="Observed local date" value={draft.observedOn}
            onChangeText={(observedOn) => change({ observedOn })} editable={!busy && !draft.reviewing && !draft.target && !draft.attempted}
            maxLength={10} autoCapitalize="none" autoCorrect={false}
            className="min-h-[48px] rounded-[12px] border border-hairline px-3 py-3 text-[16px]"
            style={{ color: ink }} />
          {draft.target ? <Text variant="bodySm" style={{ color: muted }}>The original observed date is retained. This new event has its own recorded time.</Text> : null}
          {!draft.reviewing ? <>
            {draft.kind !== 'retraction' ? categories.map(([category, label]) => <Button key={category} label={label}
              variant={draft.category === category ? 'accent' : dark ? 'inverseGhost' : 'inverse'}
              accessibilityState={{ selected: draft.category === category, disabled: busy }} disabled={busy}
              onPress={() => change({ category, text: category === 'no_change' ? '' : draft.text })} />) : null}
            {draft.category && draft.category !== 'no_change' ? <>
              <Text style={{ color: ink }}>{draft.kind === 'retraction' ? 'Retraction reason' : 'Your factual note'}</Text>
              <TextInput accessibilityLabel={draft.kind === 'retraction' ? 'Retraction reason' : 'Your factual note'}
                value={draft.text} onChangeText={(text) => change({ text })} editable={!busy && !draft.attempted}
                multiline maxLength={OPTIONAL_CHANGE41_MAX_TEXT} textAlignVertical="top" autoCorrect={false}
                className="rounded-[12px] border border-hairline px-3 py-3 text-[16px]"
                style={{ minHeight: 120, color: ink }} />
              <Text variant="bodySm" style={{ color: muted }}>Up to 2,000 characters / 6,000 UTF-8 bytes. Record only what you noticed.</Text>
            </> : null}
            {status}
            <Button label="Review this change" disabled={busy || !draft.category || (draft.category !== 'no_change' && !draft.text.trim())}
              onPress={() => change({ reviewing: true })} />
          </> : <>
            <Text style={{ color: ink }}>{categoryLabel(draft.category!)}{draft.text ? `: ${draft.text}` : ''}</Text>
            <Text variant="bodySm" style={{ color: muted }}>Confirm this owner-reported event for {draft.observedOn}. A correction or retraction appends history.</Text>
            {status}
            <Button label={busy ? 'Saving change…' : 'Confirm and save this change'} disabled={busy} onPress={() => void confirm()} />
            {!draft.attempted ? <Button label="Back to draft" variant={dark ? 'inverseGhost' : 'inverse'} disabled={busy} onPress={() => change({ reviewing: false })} /> : null}
          </>}
          <Button label="Cancel draft" variant={dark ? 'inverseGhost' : 'inverse'} disabled={busy} onPress={cancel} />
        </View> : null}
        <Button className="mt-3" label="Refresh changes" variant={dark ? 'inverseGhost' : 'ghost'} disabled={busy || changes.isFetching} onPress={() => void refresh()} />
      </>}
      <Text variant="bodySm" className="mt-3" style={{ color: muted }}>
        Local to this device; notes are not sent with check-offs. Clearing local data removes this history. Uninstalling or losing the encryption key may lose it. Local exports may include it; exported copies cannot be revoked and cannot be imported here.
      </Text>
    </View>
  );
}
