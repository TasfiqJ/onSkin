import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));
const ASK_FEATURE_DIR = fileURLToPath(new URL('./', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function readAskFeature(path: string): string {
  return readFileSync(`${ASK_FEATURE_DIR}/${path}`, 'utf8');
}

describe('Ask route launch contracts', () => {
  it('keeps the deterministic Ask home independent from the cloud Ask flag', () => {
    const layout = readAppRoute('ask/_layout.tsx');

    expect(layout).toContain('screenLayout={AskScreenLayout}');
    expect(layout).toContain('screenOptions={{ headerShown: false }}');
    expect(layout).not.toContain('phase7Flags.cloudAsk');
    expect(layout).not.toContain('DeferredSurface');
  });

  it('defers only the cloud consent surface while cloud Ask is unavailable', () => {
    const consent = readAppRoute('ask/consent.tsx');

    expect(consent).toContain('phase7Flags.cloudAsk');
    expect(consent).toContain('surface="cloudAsk"');
    expect(consent).toContain('fallbackRoute={APP_ASK_ROUTE}');
    expect(consent).toContain('fallbackLabel="Back to Ask"');
  });

  it('saves cloud Ask consent before applying visible toggle state', () => {
    const consent = readAppRoute('ask/consent.tsx');

    expect(consent).toContain('applyAskConsentChoice');
    expect(consent).toContain('savingRef.current');
    expect(consent).toContain('disabled={saving || !consentControl.canChange}');
    expect(consent).toContain('ASK_COPY.privacy.saveFailedTitle');
    expect(consent).toContain('const [saveFailed, setSaveFailed] = useState(false)');
    expect(consent).toContain('accessibilityRole="alert"');
    expect(consent).toContain('EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE');
    expect(consent).toContain('EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER');
    expect(consent).toContain("process.env.EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER === 'local_only'");
    expect(consent).toContain("modes.has('grant_once') || modes.has('all_once')");
    expect(consent).toContain("modes.has('revoke_once') || modes.has('all_once')");
    expect(consent).toContain('setAskConsentLocal(true)');
    expect(consent).toContain('clearAskStore()');
    expect(consent).toContain("new Error('E2E_ASK_CONSENT_GRANT_FAILURE')");
    expect(consent).toContain("new Error('E2E_ASK_CONSENT_REVOKE_FAILURE')");
    expect(consent).toContain('onSaved: () => {');
    expect(consent).toContain('qc.setQueryData(queryKeys.askConsent(ownerScope), enabled);');
    expect(consent).toContain('askConsentQueryOptions(ownerScope)');
    expect(consent).toContain('consentManagementState(consented');
    expect(consent).toContain('value={consentControl.value}');
    expect(consent).toContain('disabled={saving || !consentControl.canChange}');
    expect(consent).toContain('Consent status unavailable');
    expect(consent).toContain('onPress={() => void consented.refetch()}');
    expect(consent).toContain('ToggleSwitch');
    expect(consent).toContain('accessibilityLabel={ASK_COPY.privacy.toggleLabel}');
    expect(consent).not.toContain('Alert.alert');
    expect(consent).not.toContain('import { Alert');
    expect(consent).not.toContain("qc.setQueryData(['ask_onskin'], enabled);");
    expect(consent).not.toContain('<Switch');
  });

  it('keeps direct-entry Ask exits touchable and routed to safe surfaces', () => {
    const home = readAppRoute('ask/index.tsx');
    const consent = readAppRoute('ask/consent.tsx');

    expect(home).toContain('RouteIconButton');
    expect(home).toContain('APP_HOME_ROUTE');
    expect(home).toContain('backOrReplace(router, APP_HOME_ROUTE)');
    expect(home).not.toContain('hitSlop={8}');
    expect(consent).toContain('RouteIconButton');
    expect(consent).toContain('APP_ASK_ROUTE');
    expect(consent).toContain('backOrReplace(router, APP_ASK_ROUTE)');
    expect(consent).not.toContain('hitSlop={8}');
  });

  it('keeps Ask composer utility controls comfortably above 44px on phones', () => {
    const home = readAppRoute('ask/index.tsx');

    expect(home).toContain('mt-2 min-h-[48px] self-start justify-center py-1');
    expect(home).toContain("'mt-1 min-h-[48px] self-start justify-center'");
    expect(home).toContain('function AnswerCard({ answer, compact = false }');
    expect(home).toContain('function UserBubble({ text, compact = false }');
    expect(home).toContain("className={shortPhone ? 'pt-1' : 'pt-3'}");
    expect(home).toContain('<UserBubble key={m.id} text={m.text} compact={shortPhone} />');
    expect(home).toContain('<AnswerCard key={m.id} answer={m.answer} compact={shortPhone} />');
    expect(home).toContain('className="h-[48px] w-[48px] items-center justify-center');
    expect(home).toContain('minHeight: 48');
    expect(home).toContain('mt-3 min-h-[48px] self-start items-center justify-center');
  });

  it('isolates raw composer typing state from the Ask history tree', () => {
    const home = readAppRoute('ask/index.tsx');
    const composerStart = home.indexOf('function AskComposer({');
    const screenStart = home.indexOf('export default function AskScreen()');
    const composer = home.slice(composerStart, screenStart);
    const screen = home.slice(screenStart);

    expect(composerStart).toBeGreaterThan(0);
    expect(screenStart).toBeGreaterThan(composerStart);
    expect(composer).toContain("const [draft, setDraft] = useState('');");
    expect(composer).toContain("const draftRef = useRef('');");
    expect(screen).not.toContain("const [draft, setDraft] = useState('');");
    expect(screen).not.toContain("const [input, setInput] = useState('');");
    expect(screen).toContain('<AskComposer');
    expect(screen).toContain('key="ask-composer"');
    expect(screen).toContain('hidden={isError}');
    expect(screen).not.toContain('if (isError)');
    expect(composer).toContain('if (hidden) return null;');
  });

  it('binds the route to the shared-snapshot Ask view model', () => {
    const home = readAppRoute('ask/index.tsx');
    const viewModel = readAskFeature('useAsk.ts');

    expect(home).toContain("import { useAskViewModel } from '@/features/ask/useAsk';");
    expect(home).toContain('useAskViewModel();');
    expect(home).not.toContain('useAsk();');
    expect(viewModel).toContain('const shelf = useShelf();');
    expect(viewModel).toContain('const profile = useProfileBits();');
    expect(viewModel).toContain('const plan = usePlanFromSources(shelf, profile);');
    expect(viewModel).toContain('const recs = useRecommendationsFromSources(shelf, profile);');
    expect(viewModel.match(/useShelf\(\)/g)).toHaveLength(1);
    expect(viewModel.match(/useProfileBits\(\)/g)).toHaveLength(1);
  });

  it('uses one trim, blank-rejection, and publish path for Return and Send', () => {
    const home = readAppRoute('ask/index.tsx');
    const composerStart = home.indexOf('function AskComposer({');
    const screenStart = home.indexOf('export default function AskScreen()');
    const composer = home.slice(composerStart, screenStart);
    const screen = home.slice(screenStart);
    const clearRef = composer.indexOf(
      "draftRef.current = '';",
      composer.indexOf('const submitDraft'),
    );
    const clearState = composer.indexOf("setDraft('');", clearRef);
    const publish = composer.indexOf('onSubmit(question);', clearState);

    expect(composer).toContain('const question = draftRef.current.trim();');
    expect(composer).toContain('if (question.length === 0) return;');
    expect(composer).toContain('onSubmitEditing={submitDraft}');
    expect(composer).toContain('onPress={submitDraft}');
    expect(clearRef).toBeGreaterThan(0);
    expect(clearState).toBeGreaterThan(clearRef);
    expect(publish).toBeGreaterThan(clearState);
    expect(composer.match(/onSubmit\(question\);/g)).toHaveLength(1);
    expect(screen).toContain('onSubmit={(question) => pushTurn(question, ask(question))}');
    expect(screen.match(/ask\(question\)/g)).toHaveLength(1);
  });

  it('keeps Ask answer what/why/how labels readable on 320px phones', () => {
    const home = readAppRoute('ask/index.tsx');

    expect(home).toContain('numberOfLines={1}');
    expect(home).toContain(
      'style={{ color: colors.clay, marginTop: 2, width: 40, flexShrink: 0 }}',
    );
    expect(home).not.toContain('className="w-8 font-mono text-[9px] uppercase"');
  });

  it('keeps suggested prompts clear of the fixed Ask composer on short phones', () => {
    const home = readAppRoute('ask/index.tsx');

    expect(home).toContain("contentContainerClassName={compactPhone ? 'pb-6' : 'pb-4'}");
    expect(home).toContain(
      "const EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict', 'tonight', 'fit'];",
    );
    expect(home).toContain(
      "const SHORT_PHONE_EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict', 'tonight'];",
    );
    expect(home).toContain(
      "const SPLIT_SHORT_PHONE_EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict'];",
    );
    expect(home).toContain(
      'const SUPPORT_FLOOR_PROMPT_LABELS: Record<SuggestedPromptKey, string> = {',
    );
    expect(home).toContain("conflict: 'Conflicts'");
    expect(home).toContain("tonight: 'Plan tonight'");
    expect(home).toContain("fit: 'Check product fit'");
    expect(home).toContain('const { height, width } = useWindowDimensions();');
    expect(home).toContain('const shortPhone = height < 520');
    expect(home).toContain('const ultraShortPhone = height < 460;');
    expect(home).toContain('const splitShortPhone = height < 410;');
    expect(home).toContain('const supportFloorPhone = width <= 320 && height < 520;');
    expect(home).toContain("const visibleTitle = compactPhone ? 'Ask' : ASK_COPY.home.title;");
    expect(home).toContain('accessibilityLabel={ASK_COPY.home.title}');
    expect(home).toContain('{visibleTitle}');
    expect(home).toContain('const emptyPromptOrder =');
    expect(home).toContain('ultraShortPhone || splitShortPhone');
    expect(home).toContain('? SPLIT_SHORT_PHONE_EMPTY_PROMPT_ORDER');
    expect(home).toContain('? SHORT_PHONE_EMPTY_PROMPT_ORDER');
    expect(home).toContain(
      "? 'h-[48px] flex-row items-center justify-between rounded-[15px] bg-paper-raised px-4 py-2'",
    );
    expect(home).toContain(
      ": 'min-h-[48px] flex-row items-center justify-between rounded-[15px] bg-paper-raised px-4 py-2.5'",
    );
    expect(home).toContain('numberOfLines={supportFloor ? 1 : undefined}');
    expect(home).toContain("className={shortPhone ? 'pt-0' : 'pt-1'}");
    expect(home).toContain('{!shortPhone ? (');
    expect(home).toContain('{ultraShortPhone || supportFloorPhone ? null : (');
    expect(home).toContain('className="mb-3 flex-row flex-wrap gap-1.5"');
    expect(home).toContain("className={shortPhone ? 'mb-2 text-[12px]' : 'mb-3 text-[12.5px]'}");
    expect(home).toContain('style={{ lineHeight: shortPhone ? 18 : 19 }}');
    expect(home).toContain("'mb-1 font-mono text-[9px] uppercase'");
    expect(home).toContain("'mb-1.5 font-mono text-[10px] uppercase'");
    expect(home).toContain("'mb-2 font-mono text-[10px] uppercase'");
    expect(home).toContain("className={shortPhone ? 'gap-1.5' : 'gap-2'}");
    expect(home).toContain('{emptyPromptOrder.map((promptKey) => (');
    expect(home).toContain(
      'const promptLabels = supportFloorPhone ? SUPPORT_FLOOR_PROMPT_LABELS : ASK_COPY.home.prompts;',
    );
    expect(home).toContain('label={promptLabels[promptKey]}');
    expect(home).toContain('supportFloor={supportFloorPhone}');
    expect(home).toContain('askSuggested(promptKey)');
    expect(home).not.toContain('py-3.5');
  });

  it('keeps the Ask disclosure footer legible above compact-phone bottom edges', () => {
    const home = readAppRoute('ask/index.tsx');

    expect(home).toContain(
      "className={supportFloorPhone ? 'pb-2' : compactPhone ? 'pb-6' : 'pb-5'}",
    );
    expect(home).toContain('className="mt-2 text-center font-mono"');
    expect(home).toContain('style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}');
    expect(home).toContain('{ASK_COPY.home.disclosureFooter}');
  });

  it('does not auto-scroll the first answer under the header on short phones', () => {
    const home = readAppRoute('ask/index.tsx');

    expect(home).toContain('useWindowDimensions');
    expect(home).toContain('const compactPhone = height < 640');
    expect(home).toContain('options: { scrollToEnd?: boolean } = {}');
    expect(home).toContain('if (options.scrollToEnd !== false)');
    expect(home).toContain(
      "pushTurn(ASK_COPY.home.prompts.conflict, askSuggested('conflict'), { scrollToEnd: false })",
    );
    expect(home).toContain(
      'pushTurn(ASK_COPY.home.prompts[promptKey], askSuggested(promptKey), {\n                      scrollToEnd: false,',
    );
    expect(home).toContain('{!compactPhone ? (');
  });

  it('hides post-answer suggested prompts on compact phones so they do not peek under the composer', () => {
    const home = readAppRoute('ask/index.tsx');
    const followUpStart = home.indexOf('Suggested prompts kept as a follow-up affordance');
    const followUpEnd = home.indexOf('</ScrollView>', followUpStart);
    const followUpBlock = home.slice(followUpStart, followUpEnd);

    expect(followUpStart).toBeGreaterThan(0);
    expect(followUpEnd).toBeGreaterThan(followUpStart);
    expect(followUpBlock.indexOf('{!compactPhone ? (')).toBeLessThan(
      followUpBlock.indexOf('<SuggestedPrompt'),
    );
    expect(followUpBlock).toContain('label={ASK_COPY.home.prompts.tonight}');
    expect(followUpBlock).toContain('label={ASK_COPY.home.prompts.fit}');
  });

  it('refuses any grounded answer until a provider can reserve quota before delivery', () => {
    const source = readAskFeature('useAsk.ts');
    const reservationSource = readAskFeature('groundedTurnReservation.ts');
    const readinessSource = readAskFeature('readiness.ts');

    expect(source).toContain("import { useQuery } from '@tanstack/react-query';");
    expect(source).toContain('groundedTurnsQueryOptions');
    expect(source).toContain('const cloudGateEnabled = phase7Flags.cloudAsk || quotaFixtureEnabled');
    expect(source).toContain('useEntitlement({ enabled: cloudGateEnabled })');
    expect(source).toContain('isEntitlementEvidenceUncertain(ent)');
    expect(source).toContain('ent !== undefined && !entitlementUncertain');
    expect(source).not.toContain(
      'entitlement.isSuccess && ent !== undefined && !entitlementUncertain',
    );
    expect(source).toContain('cloudGateEnabled &&\n    entitlementResolved &&');
    expect(source).toContain('requiresTrialGroundedQuota(ent)');
    expect(source).toContain('groundedTurnsQueryOptions(ownerScope, period, trialQuotaRequired)');
    expect(source).toContain('const cloudGroundingReady =');
    expect(source).toContain('(!trialQuotaRequired || turns.isSuccess)');
    expect(source).toContain('cloudGroundingReady && gate.groundedAllowed');
    expect(source).toContain('groundedReasonForCloudReadiness(');
    expect(readinessSource).toContain('input.quotaFixtureEnabled && input.turns.isError');
    expect(readinessSource).not.toContain('cloudGateEnabled');
    expect(source).toContain('blockUnreservedGroundedAnswer(guarded)');
    expect(source).toContain('grounded: false');
    expect(source).not.toContain('void recordGroundedTurn');
    expect(source).not.toContain('void runGroundedTurnForOwner');
    expect(reservationSource).toContain('export function runGroundedTurnForOwner');
    expect(reservationSource).toContain("access.kind === 'trial'");
    expect(reservationSource).toContain("kind: 'uncapped';");
    expect(reservationSource).toContain('await reserveTrialGroundedTurn');
    expect(reservationSource).toContain("endpoint: 'ask_grounded'");
    expect(reservationSource).toContain('runRequestWithLease(');
    expect(reservationSource).toContain('queryKeys.askGroundedTurns(ownerScope, access.period)');
    expect(reservationSource).toContain('published = execution.publish(');
    expect(reservationSource).toContain('requestFingerprint: GroundedTurnRequestFingerprint');
  });

  it('reports persistent recommendation retry failures to the Ask recovery notice', () => {
    const source = readAskFeature('useAsk.ts');

    expect(source).toContain('async function retry(): Promise<{ isError: boolean }>');
    expect(source).toContain('recs.isError ? recs.retry() : Promise.resolve()');
    expect(source).toContain("'isError' in result && result.isError");
  });
});
