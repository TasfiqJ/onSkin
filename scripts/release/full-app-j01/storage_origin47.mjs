import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const ts = createRequire(path.resolve(process.cwd(), 'package.json'))('typescript');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const requireTrue = (value, message) => { if (!value) throw new Error('C47_STORAGE_ORIGIN05_' + message); };

// Fixed diagnostic scope, never a general rewrite or a product repair.
export const PLAN = {
  'apps/mobile/src/lib/storage/PrivateDataAvailabilityGate.tsx': ['availability', ['verifyPrivateStorage', 'check']],
  'apps/mobile/src/features/onboarding/AgePolicyGate.tsx': ['age-gate', ['readActiveReceipt']],
  'apps/mobile/src/features/onboarding/ageGateStore.ts': ['age-store', ['getAgePolicyReceiptStatus', 'setAgeVerified', 'classifyAgePolicyReceipt']],
  'apps/mobile/src/lib/storage/privateKV.ts': ['private-kv', ['getPrivateItem', 'assertPrivateKVReadable', 'getExistingContentKey', 'getOrCreateContentKey', 'validatePrivateItemsWithoutRetainingPlaintext', 'privateMutationReadGuard46', 'assertAccountScopedPrivateOperationAllowed', 'runAccountScopedPrivateOperation', 'commitPrivateMutation46', 'updatePrivateItemWithGuard', 'removePrivateItem']],
  'apps/mobile/src/lib/storage/privateKVContentKey.ts': ['content-key', ['getStoredPrivateKVContentKey', 'setStoredPrivateKVContentKey', 'storageUnavailable']],
  'apps/mobile/src/lib/auth/localAccountIsolation.ts': ['mutation', ['invalidPrivateMutation46', 'assertPrivateMutationReadGeneration46', 'assertPrivateMutationReadable46', 'assertPrivateMutationWritable46', 'waitForPrivateMutationReadWindow46', 'armPrivateMutation46', 'finishPrivateMutation46', 'abandonPrivateMutation46', 'decodePrivateMutationMarker46', 'decodeHistoryIntentMarker45', 'assertPlanHistoryReadable45', 'clearPrivateMutationAfterRemoval46']],
  'apps/mobile/src/lib/auth/accountGeneration.ts': ['account-generation', ['assertAccountGenerationLease', 'assertAccountIdentityGeneration', 'runAccountGenerationOperation']],
  'apps/mobile/src/features/healthConsent/lifecycle.ts': ['lifecycle', ['readLocal', 'runOwnerBoundLocalOperation', 'assertOwnerWorkflowFence', 'reconcileHealthDataLifecycle', 'reconcileUnconfigured']],
  'apps/mobile/src/features/photos/consent.ts': ['cloud-preference', ['clearUnavailableCloudBackupPreference']],
  'apps/mobile/src/lib/auth/sessionOwner.ts': ['owner-proof', ['readLocalDataOwnerProof', 'readLocalDataOwnership', 'claimLocalDataOwnership', 'localDataOwnerBinding']],
};

// Explicit current105 diagnostic successor; original PLAN remains historical and unchanged.
export const PLAN53 = {
  "apps/mobile/src/features/onboarding/OnboardingContext.tsx": [
    "onboarding",
    [
      "revalidate"
    ]
  ],
  "apps/mobile/src/features/onboarding/healthConsentStore.ts": [
    "consent-store",
    [
      "setHealthDataCollectionConsentLocal",
      "hasCurrentHealthDataCollectionConsentStrict",
      "hasCurrentHealthDataCollectionConsentForLease"
    ]
  ],
  "apps/mobile/src/lib/consent/healthDataWriteAdmission.ts": [
    "health-admission",
    [
      "captureHealthDataWriteLease",
      "assertHealthDataWriteLease",
      "assertOriginalHealthDataWriteLease"
    ]
  ],
  "apps/mobile/src/lib/storage/privateKV.ts": [
    "private-kv",
    [
      "getPrivateItem",
      "assertPrivateKVReadable",
      "getExistingContentKey",
      "getOrCreateContentKey",
      "validatePrivateItemsWithoutRetainingPlaintext",
      "privateMutationReadGuard46",
      "assertAccountScopedPrivateOperationAllowed",
      "runAccountScopedPrivateOperation",
      "commitPrivateMutation46",
      "updatePrivateItemWithGuard",
      "removePrivateItem",
      "getPrivateItemWhenReady",
      "runPreparedPrivateRead46",
      "getPrivateItemOnOriginalLease39",
      "runOwnedPrivateGateRead39",
      "assertPrivateGateAccountLease39",
      "waitForWidgetCapabilityClears49"
    ]
  ],
  "apps/mobile/src/lib/storage/privateKVContentKey.ts": [
    "content-key",
    [
      "getStoredPrivateKVContentKey",
      "setStoredPrivateKVContentKey",
      "storageUnavailable"
    ]
  ],
  "apps/mobile/src/lib/auth/localAccountIsolation.ts": [
    "mutation",
    [
      "invalidPrivateMutation46",
      "assertPrivateMutationReadGeneration46",
      "assertPrivateMutationReadable46",
      "assertPrivateMutationWritable46",
      "waitForPrivateMutationReadWindow46",
      "armPrivateMutation46",
      "finishPrivateMutation46",
      "abandonPrivateMutation46",
      "decodePrivateMutationMarker46",
      "decodeHistoryIntentMarker45",
      "assertPlanHistoryReadable45",
      "clearPrivateMutationAfterRemoval46"
    ]
  ],
  "apps/mobile/src/lib/auth/accountGeneration.ts": [
    "account-generation",
    [
      "assertAccountGenerationLease",
      "assertAccountIdentityGeneration",
      "runAccountGenerationOperation"
    ]
  ],
  "apps/mobile/src/features/healthConsent/lifecycle.ts": [
    "lifecycle",
    [
      "readLocal",
      "runOwnerBoundLocalOperation",
      "assertOwnerWorkflowFence",
      "reconcileHealthDataLifecycle",
      "reconcileUnconfigured",
      "completeHealthDataActivationRoute"
    ]
  ]
};

const HELPER = `
// C47 diagnostic-only, synchronous and failure-contained; no authority imports.
function c47StorageOrigin05(factory: () => Record<string, unknown>): number {
  try {
    const hook = (globalThis as typeof globalThis & {
      __C47_STORAGE_ORIGIN05__?: (event: Record<string, unknown>) => unknown;
    }).__C47_STORAGE_ORIGIN05__;
    if (typeof hook !== 'function') return 0;
    const id = hook(factory());
    return typeof id === 'number' && Number.isSafeInteger(id) && id >= 0 && id <= 1000000 ? id : 0;
  } catch { return 0; }
}
function c47StorageKeyCategory05(key: unknown): string {
  switch (key) {
    case 'layerwell.ageVerified': return 'age_receipt';
    case 'layerwell.private_kv.content_key.v1': return 'content_key';
    case 'layerwell.healthDataLifecycle.v1': return 'health_lifecycle';
    case 'layerwell.healthDataCollectionConsent.v1': return 'health_consent';
    case 'layerwell.photos.cloudBackup': return 'cloud_preference';
    case 'layerwell.routinePlanHistory.v1': return 'history';
    default: return typeof key === 'string' ? 'other_private' : 'unclassified';
  }
}
`;

const OWN_HELPER53 = `
// Diagnostic own-data lookup never invokes a supplied accessor.
function c47StorageOwnData53(value: unknown, key: string): unknown {
  try {
    if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; }
}
`;

const functionLike = node => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);
const asyncFunction = node => node.modifiers?.some(item => item.kind === ts.SyntaxKind.AsyncKeyword);
const callName = node => {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
    if (node.name.text === 'catch' && ts.isCallExpression(node.expression)) return callName(node.expression.expression);
    const base=callName(node.expression);
    return base ? base+'.'+node.name.text : null;
  }
  return null;
};
const FENCE = /^(?:assert|captureHealthPurpose|decodePrivate|decodeHistory|invalidPrivateMutation|livePrivateMutation|rethrowStaleWorkflow)/;
const ALL_NATIVE = /^(?:AsyncStorage|SecureStore)\./;

export function transformFile(relative, original, strict = true, plan = PLAN) {
  requireTrue(plan === PLAN || plan === PLAN53, 'FIXED_PROFILE');
  const targeted53 = plan === PLAN53;
  requireTrue(Object.hasOwn(plan, relative), 'FIXED_PATH');
  requireTrue(!original.includes('__C47_STORAGE_ORIGIN05__') && !original.includes('c47StorageOrigin05'), 'NOT_ALREADY_INSTRUMENTED');
  const [site, names] = plan[relative];
  const sf = ts.createSourceFile(relative, original, ts.ScriptTarget.Latest, true, relative.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  requireTrue(sf.parseDiagnostics.length === 0, 'PREIMAGE_PARSE');
  const line = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const roots = [];
  function collect(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body && names.includes(node.name.text)) roots.push({ node, operation: node.name.text });
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text) && node.initializer) {
      const init = node.initializer;
      const fn = functionLike(init) ? init : ts.isCallExpression(init) && functionLike(init.arguments[0]) ? init.arguments[0] : null;
      if (fn?.body) roots.push({ node: fn, operation: node.name.text });
    }
    ts.forEachChild(node, collect);
  }
  collect(sf);
  for (const name of names) requireTrue(roots.filter(x => x.operation === name).length === (strict ? 1 : roots.some(x => x.operation === name) ? 1 : 0), 'TARGET_' + name);
  requireTrue(roots.length > 0, 'SOME_TARGET');
  const wrappers = [...roots];
  for (const root of roots) {
    const nested = node => {
      if (node !== root.node && functionLike(node)) {
        if (asyncFunction(node) && node.body && !roots.some(x => x.node === node)) wrappers.push({ node, operation: root.operation });
      }
      ts.forEachChild(node, nested);
    };
    nested(root.node);
  }
  const unique = [...new Map(wrappers.map(x => [x.node.getStart(sf), x])).values()].sort((a,b) => a.node.getStart(sf)-b.node.getStart(sf));
  const insertions = [];
  const add = (position, order, text, kind) => insertions.push({ position, order, text, kind });
  const stages = new Set(['entry']);
  if (targeted53 && site === 'consent-store') {
    for (const root of roots.filter(item => item.operation === 'hasCurrentHealthDataCollectionConsentForLease')) {
      requireTrue(root.node.parameters.length === 1, 'EXACT_ORIGINAL_LEASE_PARAMETER53');
      // Only a diagnostic correlation number is added; default preserves JS arity1.
      add(root.node.parameters[0].end, 50, ', __c47ParentAttempt53: number | undefined = undefined', 'diagnostic-parent-parameter53');
    }
  }
  let serial = 0;
  for (const wrapper of unique) {
    wrapper.id = ++serial;
    wrapper.attempt = '__c47Attempt05_' + serial;
    wrapper.stage = '__c47Stage05_' + serial;
    wrapper.sourceLine = '__c47Line05_' + serial;
  }
  const owner = node => unique.filter(w => node.getStart(sf) >= w.node.body.getStart(sf) && node.end <= w.node.body.end).sort((a,b) => a.node.body.end-a.node.body.getStart(sf)-(b.node.body.end-b.node.body.getStart(sf)))[0];
  function metadata(w) {
    const parent = unique.filter(x => x !== w && w.node.getStart(sf) > x.node.getStart(sf) && w.node.end <= x.node.end).sort((a,b) => (a.node.end-a.node.pos)-(b.node.end-b.node.pos))[0];
    const fields = parent ? ['parentAttempt:' + parent.attempt] : [];
    const keyOwner = roots.find(root => w.node.getStart(sf) >= root.node.getStart(sf) && w.node.end <= root.node.end && root.node.parameters.some(p => ts.isIdentifier(p.name) && p.name.text === 'key'));
    if (keyOwner) fields.push('keyCategory:c47StorageKeyCategory05(key)');
    else if (site === 'mutation' && ['finishPrivateMutation46', 'abandonPrivateMutation46'].includes(w.operation))
      fields.push('keyCategory:c47StorageKeyCategory05(privateMutationTokens46.get(token)?.key)');
    if (site === 'mutation') {
      fields.push('liveClaims:privateMutationClaims46.size', 'failedClaims:Array.from(privateMutationClaims46.values()).filter(claim => claim.failed).length');
      if (w.operation === 'assertPrivateMutationReadGeneration46') fields.push('revisionEqual:expected === privateMutationRevision46');
    }
    if (site === 'private-kv') {
      fields.push('boundaryBlocked:accountBoundaryWriteBlocked');
      if (w.operation === 'assertAccountScopedPrivateOperationAllowed') fields.push('accountGenerationEqual:generation === accountBoundaryGeneration');
    }
    if (site === 'account-generation') {
      fields.push('boundaryBlocked:accountBoundaryDepth > 0');
      if (w.operation === 'assertAccountIdentityGeneration') fields.push('accountGenerationEqual:expectedGeneration === accountIdentityGeneration');
    }
    if (targeted53) {
      fields.push('outerOperation:' + roots.some(root => root.node === w.node));
      if (site === 'onboarding') {
        fields.push('mounted:mounted');
        if (asyncFunction(w.node)) fields.push('tokenCurrent:token === checkToken', 'draftCurrent:draft === accepted');
      }
      if (site === 'consent-store' && w.operation === 'setHealthDataCollectionConsentLocal')
        fields.push("grantRequested:c47StorageOwnData53(params, 'granted')");
    }
    return '{' + fields.join(',') + '}';
  }
  const event = (w, phase, error, disposition, sourceLine = w.sourceLine) => `c47StorageOrigin05(() => ({site:${JSON.stringify(site)},operation:${JSON.stringify(w.operation)},phase:${JSON.stringify(phase)},attempt:${w.attempt},error:${error},sourceLine:${sourceLine},stage:${w.stage},disposition:${JSON.stringify(disposition)},meta:${metadata(w)}}))`;
  for (const w of unique) {
    const b = w.node.body;
    const at = line(w.node);
    const begin = `\nlet ${w.stage} = 'entry'; let ${w.sourceLine} = ${at};\nconst ${w.attempt} = c47StorageOrigin05(() => ({site:${JSON.stringify(site)},operation:${JSON.stringify(w.operation)},phase:'begin',attempt:0,error:undefined,sourceLine:${at},stage:'entry',disposition:'probe',meta:${metadata(w)}}));\ntry {\n`;
    const end = `\n${event(w, 'pass', 'undefined', 'probe')};\n} catch (__c47Thrown05_${w.id}) { ${event(w, 'failure', '__c47Thrown05_' + w.id, 'throw')}; throw __c47Thrown05_${w.id}; }\n`;
    if (ts.isBlock(b)) {
      add(b.getStart(sf)+1, 10, begin, 'function-begin');
      add(b.end-1, 90, end, 'function-end');
    } else {
      add(b.getStart(sf), 1, '{' + begin + 'return (', 'expression-function-begin');
      add(b.end, 99, ');' + end + '}', 'expression-function-end');
    }
  }
  function traverse(node) {
    const w = owner(node);
    if (w && ts.isAwaitExpression(node)) {
      const name = ts.isCallExpression(node.expression) ? callName(node.expression.expression) : null;
      const stage = name ?? 'native_read'; stages.add(stage);
      add(node.getStart(sf), 30, `((${w.stage}=${JSON.stringify(stage)},${w.sourceLine}=${line(node)}),`, 'await-stage-open');
      add(node.end, 70, ')', 'await-stage-close');
    }
    if (w && ts.isCallExpression(node)) {
      const name = callName(node.expression);
      if (targeted53 && site === 'onboarding' && w.operation === 'revalidate' && name === 'hasCurrentHealthDataCollectionConsentForLease') {
        requireTrue(node.arguments.length === 1, 'EXACT_ORIGINAL_CONSENT_CALL53');
        add(node.arguments[0].end, 50, ', ' + w.attempt, 'diagnostic-parent-call53');
      }
      if (site === 'account-generation' && w.operation === 'runAccountGenerationOperation' && name === 'Promise.reject' && node.arguments.length === 1) {
        const argument = node.arguments[0], captured = '__c47Rejected05_' + node.getStart(sf);
        stages.add('account_fence');
        add(argument.getStart(sf), 35, '((' + captured + ': unknown) => { ' + w.stage + "='account_fence';" + w.sourceLine + '=' + line(node) + ';' + event(w, 'failure', captured, 'throw', String(line(node))) + '; return ' + captured + '; })(', 'original-reject-value-open');
        add(argument.end, 65, ')', 'original-reject-value-close');
      }
      if (name && (ALL_NATIVE.test(name) || FENCE.test(name) || name.endsWith('.assertCurrent') || (targeted53 && name === 'captureHealthDataWriteLease'))) {
        if (!(ts.isAwaitExpression(node.parent) && node.parent.expression === node)) {
          stages.add(name);
          add(node.getStart(sf), 40, `((${w.stage}=${JSON.stringify(name)},${w.sourceLine}=${line(node)}),`, 'sync-stage-open');
          add(node.end, 60, ')', 'sync-stage-close');
        }
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'catch' && node.arguments.length === 1 && functionLike(node.arguments[0])) {
        const callback = node.arguments[0];
        requireTrue(callback.parameters.length <= 1 && (!callback.parameters[0] || ts.isIdentifier(callback.parameters[0].name)), 'CATCH_CALLBACK_BINDING');
        const error = callback.parameters[0]?.name.text ?? '__c47CaughtPromise05_' + node.getStart(sf);
        if (!callback.parameters.length) {
          const arrow = original.slice(callback.getStart(sf),callback.body.getStart(sf));
          const paren = arrow.indexOf('('); requireTrue(paren >= 0, 'EMPTY_CATCH_CALLBACK_PARENS');
          add(callback.getStart(sf)+paren+1, 10, error, 'catch-callback-binding');
        }
        const emission = event(w, 'caught', error, 'caught', String(line(callback))) + ';';
        if (ts.isBlock(callback.body)) add(callback.body.getStart(sf)+1, 20, emission, 'catch-callback-observer');
        else {
          add(callback.body.getStart(sf), 1, '{' + emission + 'return (', 'catch-expression-open');
          add(callback.body.end, 99, ');}', 'catch-expression-close');
        }
      }
    }
    if (w && ts.isCatchClause(node)) {
      requireTrue(!node.variableDeclaration || ts.isIdentifier(node.variableDeclaration.name), 'CATCH_BINDING');
      const error = node.variableDeclaration?.name.text ?? '__c47Caught05_' + node.getStart(sf);
      if (!node.variableDeclaration) add(node.block.getStart(sf), 10, '(' + error + ')', 'catch-binding');
      const conversion = site === 'availability' && w.operation === 'check' || site === 'age-store' && w.operation === 'getAgePolicyReceiptStatus' || site === 'age-gate';
      const probe = site === 'mutation' && /decodeHistoryIntentMarker45/.test(node.block.getText(sf));
      let emission=event(w, 'caught', error, conversion ? 'ui_conversion' : probe ? 'probe' : 'caught', String(line(node)));
      if (conversion && site !== 'availability') emission=emission.replace('meta:{','meta:{ageStatus:"unavailable",');
      if (targeted53 && site === 'onboarding') {
        const current = asyncFunction(w.node) ? '(mounted && token === checkToken)' : 'mounted';
        emission = event(w, 'caught', error, 'caught', String(line(node)))
          .replace('disposition:"caught"', 'disposition:(' + current + '?"ui_conversion":"caught")')
          .replace('meta:{', 'meta:{atCurrentDenial:' + current + ',');
      }
      add(node.block.getStart(sf)+1, 20, emission + ';', 'existing-catch-observer');
    }
    if (w && site === 'age-gate' && ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) && ts.isIdentifier(node.expression.left) && node.expression.left.text === 'nextStatus' && ts.isAwaitExpression(node.expression.right)) {
      add(node.end, 20, event(w,'state','undefined','probe',String(line(node))).replace('meta:{','meta:{ageStatus:nextStatus,')+';', 'age-status-state');
    }

    if (targeted53 && w && site === 'onboarding' && ts.isIfStatement(node) &&
        ts.isPrefixUnaryExpression(node.expression) && node.expression.operator === ts.SyntaxKind.ExclamationToken &&
        ts.isIdentifier(node.expression.operand) && node.expression.operand.text === 'consent' &&
        ts.isThrowStatement(node.thenStatement)) {
      const emit = event(w,'state','undefined','probe',String(line(node)))
        .replace('stage:'+w.stage, 'stage:"consent_false"')
        .replace('meta:{','meta:{consentCurrent:false,');
      add(node.thenStatement.getStart(sf), 1, '{' + emit + ';', 'original-false-before-existing-throw-open');
      add(node.thenStatement.end, 99, '}', 'original-false-before-existing-throw-close');
    }
    if (targeted53 && w && site === 'onboarding' && ts.isExpressionStatement(node) &&
        ts.isBinaryExpression(node.expression) && ts.isIdentifier(node.expression.left) &&
        node.expression.left.text === 'status' && ts.isStringLiteral(node.expression.right) && node.expression.right.text === 'ready') {
      add(node.end,20,event(w,'state','undefined','probe',String(line(node)))
        .replace('stage:'+w.stage,'stage:"admitted"').replace('meta:{','meta:{privacyReady:true,')+';', 'actual-ready-assignment');
    }
    if (targeted53 && w && site === 'consent-store' &&
        ['hasCurrentHealthDataCollectionConsentStrict','hasCurrentHealthDataCollectionConsentForLease'].includes(w.operation) &&
        ts.isReturnStatement(node) && node.expression) {
      const parent = w.operation === 'hasCurrentHealthDataCollectionConsentForLease' ? 'parentAttempt:__c47ParentAttempt53,' : '';
      const meta = '{' + parent + 'consentCurrent:__c47Consent53,consentPresent:consent !== null,' +
        'rawPresent:raw !== null,grantCurrent:consent?.granted === true,' +
        'versionCurrent:consent?.version === HEALTH_DATA_CONSENT.version,' +
        'disclosureCurrent:consent?.consentTextHash === CURRENT_GRANT_HASH}';
      const emit = `c47StorageOrigin05(() => ({site:"consent-store",operation:${JSON.stringify(w.operation)},phase:"state",attempt:${w.attempt},sourceLine:${line(node)},stage:"consent_predicate",disposition:"probe",meta:${meta}}))`;
      add(node.expression.getStart(sf),1,'((__c47Consent53: boolean) => {'+emit+';return __c47Consent53;})(', 'original-consent-result-once-open');
      add(node.expression.end,99,')','original-consent-result-once-close');
    }
    if (targeted53 && site === 'onboarding' && ts.isGetAccessorDeclaration(node) &&
        ts.isIdentifier(node.name) && node.name.text === 'privacyStatus' && node.body) {
      const returns = node.body.statements.filter(ts.isReturnStatement);
      requireTrue(returns.length === 1 && returns[0].expression, 'EXACT_PRIVACY_GETTER53');
      const result = returns[0], stage = result.expression.getText(sf).includes('ctx.privacyStatus') ? 'route_status' : 'provider_status';
      const stateMeta = stage === "provider_status" ? "mounted:mounted,tokenCurrent:token === checkToken,draftCurrent:draft === accepted,providerReadyState:status === \"ready\",hasDraft:accepted !== null" : "routeTokenCurrent:acceptedToken === token,routeReady:ready,hasRouteLease:lease !== null,hasNavigation:navigation !== null && navigation !== undefined";
      const emit = `c47StorageOrigin05(() => ({site:"onboarding",operation:"privacyStatus",phase:"state",attempt:0,sourceLine:${line(result)},stage:${JSON.stringify(stage)},disposition:"probe",meta:{${stateMeta},privacyReady:__c47Status53 === "ready",privacyChecking:__c47Status53 === "checking",privacyDenied:__c47Status53 === "denied"}}))`;
      add(result.expression.getStart(sf),1,'((__c47Status53: PrivacyStatus) => {'+emit+';return __c47Status53;})(', 'actual-privacy-return-once-open');
      add(result.expression.end,99,')','actual-privacy-return-once-close');
    }
    if (targeted53 && w && site === 'lifecycle' && w.operation === 'completeHealthDataActivationRoute' &&
        ts.isReturnStatement(node) && node.expression && ts.isIdentifier(node.expression) && node.expression.text === 'current') {
      add(node.getStart(sf),20,`c47StorageOrigin05(() => ({site:"lifecycle",operation:"completeHealthDataActivationRoute",phase:"pass",attempt:${w.attempt},sourceLine:${line(node)},stage:"activation_complete",disposition:"probe",meta:{outerOperation:true,activeState:current.state === "active",activationPending:current.activationRoutePending === true}}));`, 'actual-activation-complete-return');
    }
    if (targeted53 && w && site === 'health-admission' && ts.isThrowStatement(node) && node.expression) {
      let meta = '{leaseCurrent:false}';
      if (w.operation === 'captureHealthDataWriteLease')
        meta = '{leaseCurrent:false,healthOwnerCurrent:active !== null && (expectedOwnerUserId === undefined || active.ownerUserId === expectedOwnerUserId)}';
      if (w.operation === 'assertHealthDataWriteLease')
        meta = '{leaseCurrent:false,healthOwnerCurrent:active?.ownerUserId === c47StorageOwnData53(lease, "ownerUserId"),healthGenerationEqual:active?.generation === c47StorageOwnData53(lease, "generation"),healthEpochEqual:active?.epoch === c47StorageOwnData53(lease, "epoch"),healthAccountGenerationEqual:active?.accountGeneration === c47StorageOwnData53(lease, "accountGeneration")}';
      if (w.operation === 'assertOriginalHealthDataWriteLease') meta = '{leaseCurrent:false,originalCapabilityCurrent:false}';
      const emit = `c47StorageOrigin05(() => ({site:"health-admission",operation:${JSON.stringify(w.operation)},phase:"failure",attempt:${w.attempt},error:__c47HealthError53,sourceLine:${line(node)},stage:"health_lease",disposition:"throw",meta:${meta}}))`;
      add(node.expression.getStart(sf),1,'((__c47HealthError53: unknown) => {'+emit+';return __c47HealthError53;})(', 'original-health-error-once-open');
      add(node.expression.end,99,')','original-health-error-once-close');
    }
    ts.forEachChild(node, traverse);
  }
  traverse(sf);
  const lastImport = sf.statements.filter(ts.isImportDeclaration).at(-1);
  add(lastImport?.end ?? 0, 0, HELPER + (targeted53 ? OWN_HELPER53 : ''), 'module-local-helper');
  const groups = new Map();
  for (const edit of insertions) { const list=groups.get(edit.position) ?? []; list.push(edit); groups.set(edit.position,list); }
  let transformed='', cursor=0;
  for (const [position, edits] of [...groups].sort((a,b)=>a[0]-b[0])) {
    transformed += original.slice(cursor, position) + edits.sort((a,b)=>a.order-b.order).map(x=>x.text).join(''); cursor=position;
  }
  transformed += original.slice(cursor);
  const after = ts.createSourceFile(relative, transformed, ts.ScriptTarget.Latest, true, relative.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  requireTrue(after.parseDiagnostics.length === 0, 'AFTERIMAGE_PARSE_' + relative + ':' + after.parseDiagnostics.map(x=>x.messageText).join('|'));
  const awaits = source => { let count=0; const walk=n=>{if(ts.isAwaitExpression(n))count++;ts.forEachChild(n,walk);};walk(source);return count; };
  requireTrue(awaits(sf) === awaits(after), 'NO_NEW_OR_REMOVED_AWAITS');
  let recovered=transformed;
  let offset=0; const spans=[];
  for (const [position, edits] of [...groups].sort((a,b)=>a[0]-b[0])) { const length=edits.reduce((n,x)=>n+x.text.length,0); spans.push([position+offset,length]);offset+=length; }
  for (const [position,length] of spans.reverse()) recovered=recovered.slice(0,position)+recovered.slice(position+length);
  requireTrue(recovered===original, 'EXACT_ORIGINAL_BYTES_RETAINED');
  return { source:transformed, proof:{site,operations:roots.map(x=>x.operation),wrappers:unique.length,stages:[...stages].sort(),insertions:insertions.length,awaits_before:awaits(sf),awaits_after:awaits(after),original_bytes_retained_exactly:true,edits_are_insertions_only:true,authority_calls_not_replaced:true,before:{bytes:Buffer.byteLength(original),sha256:sha(original)},after:{bytes:Buffer.byteLength(transformed),sha256:sha(transformed)}} };
}

function main(requestPath) {
  const request=JSON.parse(fs.readFileSync(requestPath,'utf8'));
  requireTrue(typeof request.root==='string' && typeof request.output==='string' && typeof request.manifest==='string' && request.expected && typeof request.expected==='object','REQUEST');
  const root=path.resolve(request.root), output=path.resolve(request.output);
  requireTrue(root!==output && !output.startsWith(root+path.sep), 'EXTERNAL_OUTPUT');
  requireTrue(request.profile === undefined || request.profile === 'ONBOARDING53_CURRENT105', 'FIXED_REQUEST_PROFILE');
  const plan = request.profile === 'ONBOARDING53_CURRENT105' ? PLAN53 : PLAN;
  requireTrue(Object.keys(request.expected).sort().join('\n')===Object.keys(plan).sort().join('\n'),'EXACT_EXPECTED_PATHS');
  const results=[];
  for (const relative of Object.keys(plan)) {
    const bytes=fs.readFileSync(path.join(root,relative));requireTrue(sha(bytes)===request.expected[relative],'PREIMAGE_HASH_'+relative);
    const text=bytes.toString('utf8');requireTrue(Buffer.from(text).equals(bytes),'UTF8');
    const result=transformFile(relative,text,true,plan);results.push({path:relative,...result.proof});
    const destination=path.join(output,relative);requireTrue(!fs.existsSync(destination),'NO_OVERWRITE');
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,result.source);
  }
  requireTrue(!fs.existsSync(request.manifest),'NO_MANIFEST_OVERWRITE');
  fs.writeFileSync(request.manifest,JSON.stringify({schema:1,diagnostic_only:true,source_head:request.source_head??null,files:results,all_stages:[...new Set(results.flatMap(x=>x.stages))].sort(),no_new_awaits:true,all_original_bytes_recoverable:true,normal_behavior_repair:false},null,2)+'\n');
  process.stdout.write(JSON.stringify({files:results.length,manifest:request.manifest,diagnostic_only:true})+'\n');
}
export async function selfTest() {
  let controls=0;
  const fixture=(relative,source,values,hook) => {
    const transformed=transformFile(relative,source,false);
    const javascript=ts.transpileModule(transformed.source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
    assert.equal(javascript.diagnostics?.length??0,0);
    const events=[];let attempt=0;
    const context=vm.createContext({...values,__C47_STORAGE_ORIGIN05__:hook??(event=>{events.push(event);return event.phase==='begin'?++attempt:0;})});
    vm.runInContext(javascript.outputText,context);
    return {context,events,proof:transformed.proof};
  };
  {
    const failure=new Error('PRIVATE_KV_ENVELOPE_INVALID');
    const x=fixture('apps/mobile/src/features/onboarding/ageGateStore.ts',`async function getAgePolicyReceiptStatus(){try {await fail();return 'current';}catch{return 'unavailable';}}`,{fail:async()=>{throw failure;}});
    assert.equal(await x.context.getAgePolicyReceiptStatus(),'unavailable');
    assert(x.events.some(e=>e.phase==='caught'&&e.disposition==='ui_conversion'&&e.error===failure));controls++;
  }
  {
    const failure={code:'E_KEYCHAIN_TEST05',nativeErrorCode:-34018,cause:{code:'E_INNER_TEST05'}};
    const x=fixture('apps/mobile/src/lib/storage/privateKVContentKey.ts',`function storageUnavailable(){return new Error('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');}async function getStoredPrivateKVContentKey(){try{return await SecureStore.getItemAsync('synthetic');}catch{throw storageUnavailable();}}`,{SecureStore:{getItemAsync:async()=>{throw failure;}}});
    await assert.rejects(x.context.getStoredPrivateKVContentKey(),/PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE/);
    assert(x.events.some(e=>e.phase==='caught'&&e.error===failure&&e.stage==='SecureStore.getItemAsync'));controls++;
  }
  {
    const x=fixture('apps/mobile/src/lib/auth/localAccountIsolation.ts',`const privateMutationClaims46=new Map();let privateMutationRevision46=2;function invalidPrivateMutation46(){throw new Error('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');}function assertPrivateMutationReadGeneration46(expected){if(expected!==privateMutationRevision46)invalidPrivateMutation46();}`,{});
    let caught;try{x.context.assertPrivateMutationReadGeneration46(1);}catch(error){caught=error;}
    assert.equal(caught.message,'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
    assert(x.events.some(e=>e.operation==='assertPrivateMutationReadGeneration46'&&e.phase==='failure'&&e.meta.revisionEqual===false&&e.error===caught));controls++;
  }
  {
    const failure={code:'E_NATIVE_TEST05'};
    const x=fixture('apps/mobile/src/lib/storage/privateKV.ts',`let accountBoundaryWriteBlocked=false;async function getPrivateItem(){return await fail();}`,{fail:async()=>{throw failure;}},()=>{throw new Error('OBSERVER_ONLY_FAILURE05');});
    await assert.rejects(x.context.getPrivateItem(),error=>error===failure);controls++;
  }
  {
    const failure={code:'E_REMOVE_TEST05'};
    const x=fixture('apps/mobile/src/features/photos/consent.ts',`async function clearUnavailableCloudBackupPreference(){await removePrivateItem('synthetic').catch(()=>undefined);}`,{removePrivateItem:async()=>{throw failure;}});
    assert.equal(await x.context.clearUnavailableCloudBackupPreference(),undefined);
    assert(x.events.some(e=>e.phase==='caught'&&e.error===failure));controls++;
  }
  {
    let total=0;
    for(const relative of Object.keys(PLAN)){
      const source=fs.readFileSync(path.resolve(process.cwd(),relative),'utf8');
      const result=transformFile(relative,source);
      assert.equal(result.proof.awaits_before,result.proof.awaits_after);
      assert(result.proof.original_bytes_retained_exactly);total++;
    }
    assert.equal(total,10);controls++;
  }
  {
    const x=fixture('apps/mobile/src/lib/storage/privateKV.ts',"let accountBoundaryWriteBlocked=false;async function getPrivateItem(key){throw new Error('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');}",{});
    await assert.rejects(x.context.getPrivateItem('layerwell.photos.cloudBackup'));
    assert(x.events.some(e=>e.meta.keyCategory==='cloud_preference'));
    assert(!JSON.stringify(x.events).includes('layerwell.photos.cloudBackup'));
    x.events.length=0;
    await assert.rejects(x.context.getPrivateItem('PRIVATE_UNREVIEWED_OWNER_KEY'));
    assert(x.events.some(e=>e.meta.keyCategory==='other_private'));
    assert(!JSON.stringify(x.events).includes('PRIVATE_UNREVIEWED_OWNER_KEY'));controls++;
  }
  {
    const failure = {code:'ACCOUNT_GENERATION_CHANGED'};
    const x=fixture('apps/mobile/src/lib/auth/accountGeneration.ts','let accountBoundaryDepth=1;function runAccountGenerationOperation(){if(accountBoundaryDepth>0)return Promise.reject(invalidLeaseError());return Promise.resolve();}',{invalidLeaseError:()=>failure});
    await assert.rejects(x.context.runAccountGenerationOperation(),error=>error===failure);
    assert(x.events.some(e=>e.phase==='failure' && e.error===failure && e.meta.boundaryBlocked===true && e.stage==='account_fence'));controls++;
  }
  assert.throws(()=>transformFile('apps/mobile/src/unapproved.ts',''),/FIXED_PATH/);controls++;
  assert.throws(()=>transformFile('apps/mobile/src/features/photos/consent.ts',"function clearUnavailableCloudBackupPreference(){const x='__C47_STORAGE_ORIGIN05__';}"),/NOT_ALREADY_INSTRUMENTED/);controls++;
  {
    const failure=new Error('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
    const brokenClaims={size:0,values(){throw new Error('METADATA_ITERATOR_ONLY_FAILURE05');}};
    const x=fixture('apps/mobile/src/lib/auth/localAccountIsolation.ts',`const privateMutationClaims46=claims;let privateMutationRevision46=2;function invalidPrivateMutation46(){throw originalFailure;}function assertPrivateMutationReadGeneration46(expected){if(expected!==privateMutationRevision46)invalidPrivateMutation46();}`,{claims:brokenClaims,originalFailure:failure});
    assert.throws(()=>x.context.assertPrivateMutationReadGeneration46(1),error=>error===failure);
    assert.equal(x.context.assertPrivateMutationReadGeneration46(2),undefined);controls++;
  }
  {
    const claim={};Object.defineProperty(claim,'failed',{get(){throw new Error('METADATA_GETTER_ONLY_FAILURE05');}});
    const x=fixture('apps/mobile/src/lib/auth/localAccountIsolation.ts',`const privateMutationClaims46=claims;let privateMutationRevision46=2;function assertPrivateMutationReadGeneration46(expected){if(expected!==privateMutationRevision46)throw originalFailure;}`,{claims:new Map([['synthetic',claim]]),originalFailure:new Error('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED')});
    assert.equal(x.context.assertPrivateMutationReadGeneration46(2),undefined);controls++;
  }
  return {controls,all_passed:true,actual_fixed_files:10,no_native_execution:true};
}
// C08 finite diagnostic only. No production imports, storage/authority calls or changed results.
export const PRIVACY08_HELPER = `
function c47Privacy08(factory: () => Record<string, unknown>, command = "event"): number {
  try {
    const hook = (globalThis as typeof globalThis & {__C47_PRIVACY_ORIGIN08__?: (command: string, event: Record<string, unknown>) => unknown}).__C47_PRIVACY_ORIGIN08__;
    if (typeof hook !== "function") return 0;
    const value = hook(command, factory());
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1000000 ? value : 0;
  } catch { return 0; }
}
`;

export function privacySource08(relative, original) {
  let text = original; const edits=[];
  const replace=(a,b)=>{assert.equal(text.split(a).length-1,1,'C08 exact original site: '+a.slice(0,90));text=text.replace(a,b);edits.push({before:a,after:b});};
  if (relative.endsWith('/OnboardingContext.tsx')) {
    const event=(site,meta='')=>`c47Privacy08(() => ({site:"${site}",provider:c08Provider,${meta}}));`;
    const state='mounted,tokenCurrent:token === checkToken,draftCurrent:draft === accepted,';
    replace('function createOnboardingSession(queryClient: ReturnType<typeof useQueryClient>) {', 'function createOnboardingSession(queryClient: ReturnType<typeof useQueryClient>) {\nconst c08Provider = c47Privacy08(() => ({}), "id");');
    replace('  function retire() {', '  function retire() {\n'+event('PROVIDER_RETIRE','mounted,hasDraft:draft !== null,'));
    replace('  function revalidate(fresh = false): Promise<HealthDataWriteLease | null> {','  function revalidate(fresh = false): Promise<HealthDataWriteLease | null> {\nconst c08Check = c47Privacy08(() => ({}), "id"); const c08Grant = c47Privacy08(() => ({}), "grant"); let c08Stage = "CAPTURE";\n'+event('REVALIDATE_ENTRY','check:c08Check,grant:c08Grant,mounted,fresh,'));
    replace('    } catch {\n      retire();', '    } catch (c08Error) {\n'+event('CAPTURE_REJECT','check:c08Check,grant:c08Grant,mounted,error:c08Error,')+'\n      retire();');
    replace('    if (draft?.lease.generation !== lease.generation) {\n      retire();','    if (draft?.lease.generation !== lease.generation) {\n'+event('DRAFT_REPLACE','check:c08Check,grant:c08Grant,mounted,hasDraft:draft !== null,')+'\n      retire();');
    replace('    const token = ++checkToken;\n    status', '    const token = ++checkToken;\n'+event('CHECK_BEGIN','check:c08Check,grant:c08Grant,'+state)+'\n    status');
    replace('        await runHealthDataWriteOperation(lease.ownerUserId, (operation) => {','        c08Stage = "PREFLIGHT";\n        await runHealthDataWriteOperation(lease.ownerUserId, (operation) => {\n c08Stage = "PREFLIGHT_LEASE";');
    replace('          operation.assertCurrent();','          c08Stage = "OPERATION_CURRENT";\n          operation.assertCurrent();');
    replace('        const consent = await hasCurrentHealthDataCollectionConsentForLease(lease);','        c08Stage = "CONSENT_READ";\n        const consent = await hasCurrentHealthDataCollectionConsentForLease(lease);\n'+event('CONSENT_RESULT','check:c08Check,grant:c08Grant,'+state+'consentCurrent:consent,'));
    replace('        if (!mounted || token !== checkToken || draft !== accepted) return null;','        if (!mounted || token !== checkToken || draft !== accepted) {\n'+event('CHECK_SUPERSEDED','check:c08Check,grant:c08Grant,'+state)+' return null; }');
    replace("        assertHealthDataWriteLease(lease);\n        if (!consent) throw new Error('CURRENT_HEALTH_CONSENT_REQUIRED');",'        c08Stage = "FINAL_LEASE";\n        assertHealthDataWriteLease(lease);\n        if (!consent) {\n'+event('CONSENT_FALSE','check:c08Check,grant:c08Grant,'+state)+" throw new Error('CURRENT_HEALTH_CONSENT_REQUIRED'); }");
    replace('        ++checkToken;\n        return lease;', '        ++checkToken;\n'+event('CHECK_READY_PUBLISHED','check:c08Check,grant:c08Grant,mounted,draftCurrent:draft === accepted,')+'\n        return lease;');
    replace('      } catch {\n        if (mounted && token === checkToken) retire();', '      } catch (c08Error) {\n'+event('CHECK_REJECT','check:c08Check,grant:c08Grant,stage:c08Stage,'+state+'error:c08Error,')+'\n        if (mounted && token === checkToken) retire();');
    replace('    const off = subscribeActiveHealthProcessingLeaseChanges(() => {','    const off = subscribeActiveHealthProcessingLeaseChanges(() => {\n'+event('LEASE_SUBSCRIPTION','mounted,'));
    replace('          () => {\n            retire();','          () => {\n'+event('LEASE_EXPIRY','mounted,')+'\n            retire();');
    replace('    return () => {\n      mounted = false;', '    return () => {\n'+event('PROVIDER_UNMOUNT','mounted,')+'\n      mounted = false;');
    replace("      if (!mounted || !accepted || draft !== accepted || token !== checkToken || status !== 'ready')\n        return false;", "      if (!mounted || !accepted || draft !== accepted || token !== checkToken || status !== 'ready') {\n"+event('PROVIDER_VIEW_REJECT','mounted,hasDraft:accepted !== null,tokenCurrent:token === checkToken,draftCurrent:draft === accepted,ready:status === "ready",')+'return false; }');
    replace('        assertHealthDataWriteLease(accepted.lease);\n        return true;\n      } catch {\n        return false;', '        assertHealthDataWriteLease(accepted.lease);\n        return true;\n      } catch (c08Error) {\n'+event('PROVIDER_VIEW_LEASE_REJECT','mounted,tokenCurrent:token === checkToken,error:c08Error,')+'\n        return false;');
    replace('function createRouteAdmission() {','function createRouteAdmission() {\nconst c08Route = c47Privacy08(() => ({}), "id");');
    const route=(site,meta='')=>`c47Privacy08(() => ({site:"${site}",route:c08Route,${meta}}));`;
    replace('    function blur() {\n      ++token;', '    function blur() {\n'+route('ROUTE_BLUR','active,ready,hasLease:lease !== null,')+'\n      ++token;');
    replace('    function enter() {\n      blur();', '    function enter() {\n'+route('ROUTE_ENTER','active,')+'\n      blur();');
    replace('      } catch {\n        lease = null;','      } catch (c08Error) {\n'+route('ROUTE_CAPTURE_REJECT','active,error:c08Error,')+'\n        lease = null;');
    replace('      if (!ctx.isCurrent()) return false;', '      const c08ProviderCurrent = ctx.isCurrent();\n      if (!c08ProviderCurrent) {\n'+route('ROUTE_PROVIDER_REJECT','routeTokenCurrent:acceptedToken === token,ready,hasLease:lease !== null,')+' return false; }');
    replace('      if (acceptedToken !== token || !ready || !navigation.isFocused() || !lease) return false;', '      let c08Focused: boolean | undefined;\n      if (acceptedToken !== token || !ready || !(c08Focused = navigation.isFocused()) || !lease) {\n'+route('ROUTE_WINDOW_REJECT','routeTokenCurrent:acceptedToken === token,ready,focused:c08Focused,hasLease:lease !== null,')+' return false; }');
    replace('        assertHealthDataWriteLease(lease);\n        return true;\n      } catch {\n        return false;', '        assertHealthDataWriteLease(lease);\n        return true;\n      } catch (c08Error) {\n'+route('ROUTE_VIEW_LEASE_REJECT','routeTokenCurrent:acceptedToken === token,ready,error:c08Error,')+'\n        return false;');
    replace("        return isCurrent() ? 'ready' : ctx.privacyStatus === 'denied' ? 'denied' : 'checking';",'        return ((c08Status: PrivacyStatus) => {\n'+route('ROUTE_PRIVACY_STATUS','routeTokenCurrent:acceptedToken === token,ready,hasLease:lease !== null,privacyDenied:c08Status === "denied",privacyReady:c08Status === "ready",')+'\n return c08Status; })(isCurrent() ? \'ready\' : ctx.privacyStatus === \'denied\' ? \'denied\' : \'checking\');');
  } else if (relative.endsWith('/lifecycle.ts')) {
    replace("  assertHealthDataConsentCopyReleaseAllowed('grant', env.appEnvironment);",'  c47Privacy08(() => ({site:"GRANT_BEGIN"}), "beginGrant");\n  assertHealthDataConsentCopyReleaseAllowed(\'grant\', env.appEnvironment);');
  } else if (relative.endsWith('/HealthDataLifecycleGate.tsx')) {
    replace('        const liveRecord = gateSnapshotRef.current.record;', '        c47Privacy08(() => ({site:"ACTIVATION_RETURN",activeState:next.state === "active",activationPending:next.activationRoutePending === true}));\n        const liveRecord = gateSnapshotRef.current.record;');
    replace('        commitLifecycleRecord(next);\n        const latest = gateSnapshotRef.current;', '        c47Privacy08(() => ({site:"ACTIVATION_CURRENT",ownerCurrent:liveRecord?.ownerUserId === pendingOwnerUserId,epochCurrent:liveRecord?.processingEpoch === pendingEpoch}));\n        commitLifecycleRecord(next);\n        const latest = gateSnapshotRef.current;');
    replace('      } catch {\n        const live = gateSnapshotRef.current;', '      } catch (c08Error) {\n        c47Privacy08(() => ({site:"ACTIVATION_REJECT",error:c08Error}));\n        const live = gateSnapshotRef.current;');
    replace('  if (!healthDataChildrenMayMount(gateSnapshot)) {','  const c08ChildrenMayMount = healthDataChildrenMayMount(gateSnapshot);\n  c47Privacy08(() => ({site:"ACTIVATION_MOUNT",childrenMayMount:c08ChildrenMayMount,routeSelected:activationRouteSelected,activeState:record.state === "active",activationPending:record.activationRoutePending === true}));\n  if (!c08ChildrenMayMount) {');
  }
  return {source:edits.length?PRIVACY08_HELPER+'\n'+text:original,edits};
}

export const ENTRY08 = String.raw`
// C47_PRIVACY_ORIGIN_DIAGNOSTIC_08: bounded memory only at synchronous guard sites.
try { (() => {
 const FS = require('expo-file-system/legacy');
 const SITES = new Set(['GRANT_BEGIN','REVALIDATE_ENTRY','CAPTURE_REJECT','DRAFT_REPLACE','CHECK_BEGIN','CONSENT_RESULT','CHECK_SUPERSEDED','CONSENT_FALSE','CHECK_READY_PUBLISHED','CHECK_REJECT','LEASE_SUBSCRIPTION','LEASE_EXPIRY','PROVIDER_RETIRE','PROVIDER_UNMOUNT','PROVIDER_VIEW_REJECT','PROVIDER_VIEW_LEASE_REJECT','ROUTE_BLUR','ROUTE_ENTER','ROUTE_CAPTURE_REJECT','ROUTE_PROVIDER_REJECT','ROUTE_WINDOW_REJECT','ROUTE_VIEW_LEASE_REJECT','ROUTE_PRIVACY_STATUS']);
 const CODES = new Set(['HEALTH_DATA_WRITE_ADMISSION_CLOSED','HEALTH_DATA_WRITE_OWNER_MISMATCH','CURRENT_HEALTH_CONSENT_REQUIRED','HEALTH_CONSENT_INVALID','HEALTH_CONSENT_UNSUPPORTED_VERSION','HEALTH_CONSENT_MUTATION_SUPERSEDED','ACCOUNT_GENERATION_CHANGED','PRIVATE_KV_CONTENT_KEY_MISSING','PRIVATE_KV_CONTENT_KEY_INVALID','PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE','PRIVATE_KV_DECRYPTION_FAILED','PRIVATE_KV_ENVELOPE_INVALID','PRIVATE_KV_ENVELOPE_UNSUPPORTED','PRIVATE_KV_RECOVERY_REQUIRED','PRIVATE_KV_WRITE_CONFLICT','LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED','LOCAL_DATA_HISTORY_RECOVERY_REQUIRED','LOCAL_DATA_OWNER_MISMATCH','LOCAL_DATA_CLEANUP_REQUIRED','ERR_KEY_CHAIN','ERR_INVALID_KEY','ERR_MISSING_PLIST_KEY','ERR_SEC_ACCESS_CONTROL']);
 for(const site of ['OBSERVER_READY','ACTIVATION_RETURN','ACTIVATION_CURRENT','ACTIVATION_REJECT','ACTIVATION_MOUNT'])SITES.add(site);
 const STAGES = new Set(['CAPTURE','PREFLIGHT','PREFLIGHT_LEASE','OPERATION_CURRENT','CONSENT_READ','FINAL_LEASE']);
 const BOOLS = ['mounted','fresh','hasDraft','tokenCurrent','draftCurrent','consentCurrent','ready','active','hasLease','routeTokenCurrent','focused','privacyDenied','privacyReady'];
 BOOLS.push('ownerCurrent','epochCurrent','activeState','activationPending','childrenMayMount','routeSelected');
 let sequence=0,id=0,grant=0,dropped=0,scheduled=false,writing=false,dirty=false,flushFailures=0,identity=null;const events=[];let denialWindow=null;
 function own(v,k){try {const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.prototype.hasOwnProperty.call(d,'value')?d.value:undefined;}catch{return undefined;}}
 function error(e){const chain=[],seen=new Set();for(let n=0;n<3&&e!==undefined&&!seen.has(e);n++){seen.add(e);const code=own(e,'code'),message=own(e,'message');const exact=CODES.has(code)?code:CODES.has(message)?message:CODES.has(e)?e:'UNCLASSIFIED';const numeric={};for(const k of ['code','nativeCode','nativeErrorCode','osStatus','errno']){const v=own(e,k);if(Number.isInteger(v)&&v>=-2147483648&&v<=2147483647)numeric[k]=v;}chain.push({code:exact,numeric});e=own(e,'cause');}return chain;}
 async function flush(){scheduled=false;if(writing||!dirty)return;writing=true;dirty=false;try{if(!identity){identity=JSON.parse(await FS.readAsStringAsync(FS.documentDirectory+'C47StorageOrigin05Identity.json'));}if(identity.sourceHead!=='__C47_SOURCE_HEAD05__'||identity.bundle!=='com.layerwell.app.staging'||!Number.isInteger(identity.pid)||identity.pid<=0)throw Error();const snapshot={schema:1,marker:'C47_PRIVACY_ORIGIN_DIAGNOSTIC_08',sourceHead:identity.sourceHead,pid:identity.pid,bundle:identity.bundle,eventLimit:512,sequence,dropped,flushFailures,events:events.slice(),denialWindow,ordinaryAdmitted:false,release:'NO_GO'};await FS.writeAsStringAsync(FS.documentDirectory+'C47PrivacyOrigin08-'+identity.pid+'.json',JSON.stringify(snapshot));}catch{flushFailures=Math.min(flushFailures+1,1000000);}finally{writing=false;if(dirty)schedule();}}
 function schedule(){dirty=true;if(!scheduled&&!writing){scheduled=true;Promise.resolve().then(flush).catch(()=>{});}}
 globalThis.__C47_PRIVACY_ORIGIN08__=(command,input)=>{try{if(command==='id')return id<1000000?++id:0;if(command==='grant')return grant;if(command==='beginGrant'){if(grant>=1000000)return 0;grant++;}else if(command!=='event')return 0;const site=own(input,'site');if(!SITES.has(site)||sequence>=1000000)return 0;const row={sequence:++sequence,site,grant};for(const k of ['provider','route','check']){const v=own(input,k);if(Number.isSafeInteger(v)&&v>0&&v<=1000000)row[k]=v;}const g=own(input,'grant');if(Number.isSafeInteger(g)&&g>=0&&g<=1000000)row.grant=g;for(const k of BOOLS){const v=own(input,k);if(typeof v==='boolean')row[k]=v;}const st=own(input,'stage');if(STAGES.has(st))row.stage=st;const e=own(input,'error');if(e!==undefined)row.error=error(e);events.push(row);if(events.length>512){events.shift();dropped++;}if(site==='ROUTE_PRIVACY_STATUS'&&row.privacyDenied===true&&grant>0&&denialWindow===null)denialWindow=events.slice(-128);schedule();return row.sequence;}catch{return 0;}};
 globalThis.__C47_PRIVACY_ORIGIN08__('event',{site:'OBSERVER_READY'});
 })(); } catch { /* Diagnostic observer failure cannot escape to admission. */ }
`;

export function mainPrivacy08(requestPath) {
 const req=JSON.parse(fs.readFileSync(requestPath,'utf8'));assert.equal(req.profile,'PRIVACY08_EXACT137');assert.match(req.source_head,/^[a-f0-9]{40}$/);const root=path.resolve(req.original),out=path.resolve(req.output);assert.deepEqual(Object.keys(req.expected).sort(),[...Object.keys(PLAN53),'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx'].sort());assert.ok(root!==out&&!out.startsWith(root+path.sep));assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});const files=[];
 for(const [relative,expected]of Object.entries(req.expected)){const before=fs.readFileSync(path.join(root,relative));assert.equal(sha(before),expected);const extra=privacySource08(relative,before.toString('utf8'));const legacy=Object.hasOwn(PLAN53,relative)?transformFile(relative,extra.source,true,PLAN53):{source:extra.source,proof:null};const kind=relative.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;const sourceTree=ts.createSourceFile(relative,before.toString('utf8'),ts.ScriptTarget.Latest,true,kind),afterTree=ts.createSourceFile(relative,legacy.source,ts.ScriptTarget.Latest,true,kind);assert.equal(afterTree.parseDiagnostics.length,0,'C08 parse '+relative);const countAwait=tree=>{let count=0;const walk=n=>{if(ts.isAwaitExpression(n))count++;ts.forEachChild(n,walk);};walk(tree);return count;};assert.equal(countAwait(afterTree),countAwait(sourceTree),'C08 original awaits preserved');const raw=Buffer.from(legacy.source);const target=path.join(out,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw,{flag:'wx'});files.push({path:relative,before:{bytes:before.length,sha256:sha(before)},after:{bytes:raw.length,sha256:sha(raw)},privacy08_edits:extra.edits,legacy_proof:legacy.proof});}
 const entry=ENTRY08.replaceAll('__C47_SOURCE_HEAD05__',req.source_head);fs.writeFileSync(path.join(out,'privacy08-entry.js'),entry,{flag:'wx'});fs.writeFileSync(req.manifest,JSON.stringify({profile:req.profile,source_head:req.source_head,files,entry:{bytes:Buffer.byteLength(entry),sha256:sha(entry)},ordinary_admitted:false,release:'NO_GO'},null,2)+'\n',{flag:'wx'});
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if(process.argv[2]==='--self-test')process.stdout.write(JSON.stringify(await selfTest())+'\n');
  else if(process.argv[2]==='--privacy08')mainPrivacy08(process.argv[3]);
  else main(process.argv[2]);
}
