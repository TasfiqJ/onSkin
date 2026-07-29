#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const paths = Object.freeze({
  packageJson: 'package.json',
  corpus: 'apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts',
  engine: 'apps/mobile/src/features/intelligence/engine.ts',
  choices: 'apps/mobile/src/features/intelligence/conflictChoices.ts',
  overrides: 'apps/mobile/src/features/intelligence/overrides.ts',
  presentation: 'apps/mobile/src/features/intelligence/presentation.ts',
  useShelf: 'apps/mobile/src/features/shelf/useShelf.ts',
  generate: 'apps/mobile/src/features/routine/generate.ts',
  orchestrate: 'apps/mobile/src/features/scheduler/orchestrate.ts',
  recommendations: 'apps/mobile/src/features/recommendations/engine.ts',
  ask: 'apps/mobile/src/features/ask/answer.ts',
  askCopy: 'apps/mobile/src/features/ask/copy.ts',
  askScreen: 'apps/mobile/src/app/ask/index.tsx',
  conflictRoute: 'apps/mobile/src/app/conflict/[ruleId].tsx',
  shareRoute: 'apps/mobile/src/app/share/conflict/[ruleId].tsx',
  publicShareRoute: 'apps/mobile/src/app/s/[shareId].tsx',
  shareLinks: 'apps/mobile/src/features/growth/shareLinks.ts',
  subscriptionCopy: 'apps/mobile/src/features/subscription/copy.ts',
  phase7: 'apps/mobile/src/lib/launch/phase7.ts',
  analyticsRegistry: 'apps/mobile/src/lib/analytics/eventRegistry.ts',
  quizContract: 'apps/mobile/src/features/onboarding/quizContract.ts',
  wave1Policy: 'docs/hugeToDo/US_WAVE1_PRIVACY_AND_CONSUMER_HEALTH_LAW_GATE.md',
  clinicalAudit: 'docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md',
  appStoreAudit: 'docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md',
  packetBuilder: 'scripts/phase3/build-review-packet.mjs',
  migration0066: 'supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql',
  migration0067: 'supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql',
  migration0068: 'supabase/migrations/20260726000068_routine_adherence_authority.sql',
  migration0069: 'supabase/migrations/20260726000069_routine_completion_sync_bridge.sql',
  migration0070: 'supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql',
  migration0071: 'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
  schemaContract: 'supabase/tests/database/schema_contract.test.sql',
  clinicalSealContract: 'supabase/tests/database/clinical_content_legacy_seal.test.sql',
  lintContract: 'supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql',
});

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

function bytes(path) {
  return readFileSync(resolve(root, path));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function walk(directory) {
  const absolute = resolve(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) return walk(relative(root, entryPath));
    return [relative(root, entryPath).replaceAll('\\', '/')];
  });
}

function mobileProductionSources() {
  return walk('apps/mobile/src').filter(
    (path) =>
      ['.ts', '.tsx'].includes(extname(path)) &&
      !/(?:^|\/)__tests__(?:\/|$)/u.test(path) &&
      !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path),
  );
}

function sourceFile(path) {
  return ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function findFunction(path, name) {
  let found = null;
  const source = sourceFile(path);
  source.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
  });
  assert.ok(found, `${path} must define ${name}().`);
  return { node: found, source, text: found.getText(source) };
}

function declaredFunctions(path) {
  const functions = [];
  const source = sourceFile(path);
  source.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push({ name: node.name.text, node, source, text: node.getText(source) });
    }
  });
  return functions;
}

function importedBindings(path) {
  const bindings = [];
  const source = sourceFile(path);
  source.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause) return;
    const moduleName = node.moduleSpecifier.getText(source).slice(1, -1);
    const clause = node.importClause;
    if (clause.name) {
      bindings.push({ imported: 'default', local: clause.name.text, moduleName });
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        bindings.push({
          imported: element.propertyName?.text ?? element.name.text,
          local: element.name.text,
          moduleName,
        });
      }
    }
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      bindings.push({
        imported: '*',
        local: clause.namedBindings.name.text,
        moduleName,
      });
    }
  });
  return bindings;
}

function identifierCalls(path, identifier) {
  const matches = [];
  const source = sourceFile(path);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === identifier
    ) {
      matches.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return matches;
}

function trackingCalls(path) {
  const matches = [];
  const source = sourceFile(path);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      /^track(?:$|[A-Z_])/u.test(node.expression.text)
    ) {
      matches.push({
        name: node.expression.text,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return matches;
}

function privateWeakSetNames(path) {
  const names = [];
  const source = sourceFile(path);
  source.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    const exported = node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (exported) return;
    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        ts.isNewExpression(declaration.initializer) &&
        declaration.initializer.expression.getText(source) === 'WeakSet'
      ) {
        names.push(declaration.name.text);
      }
    }
  });
  return names;
}

function assertContainsAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}.`);
  }
}

function countOccurrences(text, value) {
  return text.split(value).length - 1;
}

const expectedRuleIds = Object.freeze(
  Array.from({ length: 13 }, (_, index) => {
    const suffix = (index + 1).toString(16);
    return `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;
  }),
);

test('the bundled corpus remains a zero-publication draft with empty detached authority', () => {
  const corpus = read(paths.corpus);

  assert.match(
    corpus,
    /CONFLICT_RULE_CORPUS\s*:[\s\S]*?=\s*\{[\s\S]*?status:\s*['"]draft_blocked['"]/u,
  );
  assert.match(corpus, /CONFLICT_TRUSTED_REVIEW_AUTHORITIES\s*:[\s\S]*?=\s*\[\s*\]/u);
  assert.match(corpus, /CONFLICT_RULE_REVIEW_RECEIPTS\s*:[\s\S]*?=\s*\[\s*\]/u);
  assert.match(
    corpus,
    /function\s+verifyDetachedReceiptSignature\s*\([\s\S]*?\)\s*:\s*boolean\s*\{[\s\S]*?return\s+false\s*;/u,
    'signature admission must remain disabled until a real detached-signature verifier exists',
  );
  assert.match(
    corpus,
    /shippableConflictRuleCorpus\s*\(\s*\)[\s\S]*?admitConflictRuleCorpus\s*\(\s*CONFLICT_RULE_CORPUS\s*,\s*CONFLICT_RULE_REVIEW_RECEIPTS\s*\)/u,
  );
});

test('admission requires three independent roles and cryptographic, module-private provenance', () => {
  const corpus = read(paths.corpus);
  const admission = findFunction(paths.corpus, 'admitConflictRuleCorpus');
  const membership = findFunction(paths.corpus, 'isRuleAdmittedByCorpus');

  assertContainsAll(
    admission.text,
    [
      'board_certified_dermatologist',
      'cosmetic_chemist',
      'pharmacist',
      'regulatory_counsel',
      'verifyDetachedReceiptSignature',
      'immutableConflictRuleCorpusSnapshot',
      'authorityId',
      'reviewerIdentityKey',
      'credentialEvidenceRef',
      'credentialEvidenceSha256',
      'authorityPublicKeySha256',
      'publicKeySha256',
      'isValidatedConflictReviewAuthority',
      'hasIndependentConflictReviewAuthorities',
      'signedBodySha256',
    ],
    'corpus admission',
  );
  const normalizedAdmission = admission.text.replace(/\s+/gu, ' ');
  assert.ok(
    normalizedAdmission.includes(
      'new Set(orderedReceipts.map((receipt) => receipt.receiptId)).size !== 3',
    ),
  );
  assert.ok(
    normalizedAdmission.includes(
      'new Set(orderedReceipts.map((receipt) => receipt.authorityId)).size !== 3',
    ),
  );
  assert.ok(
    normalizedAdmission.includes(
      'new Set(orderedReceipts.map((receipt) => receipt.reviewerIdentityKey)).size !== 3',
    ),
  );
  assert.ok(
    normalizedAdmission.includes(
      'new Set(orderedReceipts.map((receipt) => receipt.authorityPublicKeySha256)).size !== 3',
    ),
    'review receipts must bind three independent public-key fingerprints',
  );
  assert.match(
    corpus,
    /bytes\?\.length\s*===\s*32[\s\S]*?sha256Bytes\s*\(\s*bytes\s*\)/u,
    'Ed25519 authority validation must fingerprint the exact canonical 32-byte public key',
  );
  assert.match(
    corpus,
    /new Set\s*\(\s*authorities\.map\s*\(\s*\(\s*authority\s*\)\s*=>\s*authority\.publicKeySha256\s*\)\s*\)\.size\s*===\s*3/u,
    'three review authorities must not share one Ed25519 public key',
  );
  assert.ok(
    normalizedAdmission.includes(
      'authority.credentialEvidenceSha256 === receipt.credentialEvidenceSha256',
    ),
    'credential evidence must be pinned by its reviewed byte hash',
  );
  assert.doesNotMatch(
    normalizedAdmission,
    /credentialEvidenceSha256\s*===\s*canonicalSha256\(receipt\.credentialEvidenceRef\)/u,
    'credential evidence hashes must never be derived from a reference string',
  );
  assert.match(
    corpus,
    /receiptId:\s*receipt\.receiptId/u,
    'the detached review body must bind its receipt identifier',
  );
  assert.match(
    admission.text,
    /const\s+admitted\s*=\s*immutableConflictRuleCorpusSnapshot\s*\(/u,
    'future admitted runtime data must be detached and recursively frozen before branding',
  );

  const provenanceSets = privateWeakSetNames(paths.corpus);
  assert.ok(
    provenanceSets.length > 0,
    'admitted corpora need a module-private WeakSet provenance brand created only after signature verification',
  );
  const corpusFunctions = declaredFunctions(paths.corpus);
  const provenanceSet = provenanceSets.find((name) => {
    const checkers = corpusFunctions.filter((candidate) => candidate.text.includes(`${name}.has(`));
    return (
      admission.text.includes(`${name}.add(`) &&
      checkers.some(
        (checker) =>
          checker.name === 'isRuleAdmittedByCorpus' || membership.text.includes(`${checker.name}(`),
      )
    );
  });
  assert.ok(
    provenanceSet,
    'isRuleAdmittedByCorpus() must check, and admitConflictRuleCorpus() must add, the same private provenance brand',
  );
  const verifyPosition = admission.text.indexOf('verifyDetachedReceiptSignature');
  const immutablePosition = admission.text.indexOf('immutableConflictRuleCorpusSnapshot');
  const brandPosition = admission.text.indexOf(`${provenanceSet}.add(`);
  assert.ok(
    verifyPosition >= 0 && brandPosition > verifyPosition,
    'the private admission brand may be added only after detached-signature verification',
  );
  assert.ok(
    immutablePosition > verifyPosition && brandPosition > immutablePosition,
    'the admitted snapshot must be frozen after signature verification and before provenance branding',
  );
  const corpusWithoutAdmission = `${corpus.slice(0, admission.node.getStart(admission.source))}${corpus.slice(admission.node.getEnd())}`;
  assert.doesNotMatch(
    corpusWithoutAdmission,
    new RegExp(`${provenanceSet}\\.add\\s*\\(`, 'u'),
    'no path outside admitConflictRuleCorpus() may mint admission provenance',
  );

  const evaluation = findFunction(paths.engine, 'evaluateConflicts');
  if (evaluation.node.parameters.length > 2) {
    const provenanceChecks = provenanceSets
      .flatMap((name) =>
        corpusFunctions
          .filter((candidate) => candidate.text.includes(`${name}.has(`))
          .map((candidate) => candidate.name),
      )
      .filter((name, index, values) => values.indexOf(name) === index);
    assert.ok(
      provenanceChecks.some((name) => evaluation.text.includes(`${name}(`)),
      'evaluateConflicts() may accept an injected corpus only when it verifies module-private admission provenance',
    );
  }
});

test('the corpus is pinned to the exact US-only Wave 1 legal-policy bytes', () => {
  const corpus = read(paths.corpus);
  const policySha256 = sha256(bytes(paths.wave1Policy));
  const quizContractSha256 = sha256(bytes(paths.quizContract));

  assert.equal(
    policySha256,
    '34ce160c765e9d7bde2e1d5e55de54c63b8c896e5db61de746a1f6a971080bce',
    'the Wave 1 policy changed; re-review and deliberately re-pin the clinical corpus',
  );
  assert.match(
    corpus,
    /sourceDocumentPath:\s*['"]docs\/hugeToDo\/US_WAVE1_PRIVACY_AND_CONSUMER_HEALTH_LAW_GATE\.md['"]/u,
  );
  assert.match(corpus, new RegExp(`sourceDocumentSha256:\\s*['"]${policySha256}['"]`, 'u'));
  assert.match(corpus, /storefrontJurisdictions:\s*\[\s*['"]US['"]\s*\]/u);
  assert.match(corpus, /targetJurisdictions:\s*\[\s*['"]US['"]\s*\]/u);
  assert.match(
    corpus,
    /canonicalJson\s*\(\s*content\.targetJurisdictions\s*\)[\s\S]*?canonicalJson\s*\(\s*CONFLICT_MARKET_SCOPE_POLICY\.storefrontJurisdictions\s*\)/u,
  );
  assertContainsAll(
    corpus,
    [
      'marketScopePolicyId',
      'marketScopeSha256',
      'marketScopeSourceDocumentPath',
      'marketScopeSourceDocumentSha256',
    ],
    'signed review body',
  );
  assert.equal(
    quizContractSha256,
    '2bbcbe2ab01b444fde4c0ffb132eef721a078a6f1118f044b5c4eb26303b9451',
    'the quiz pregnancy-answer contract changed; re-review and deliberately re-pin the clinical corpus',
  );
  assertContainsAll(
    corpus,
    [
      "semanticValue: 'pregnant_or_trying_combined'",
      "sourceDocumentPath: 'apps/mobile/src/features/onboarding/quizContract.ts'",
      `sourceDocumentSha256: '${quizContractSha256}'`,
      'profileContextStoredValue',
      'profileContextSemanticValue',
      'profileContextSourceDocumentPath',
      'profileContextSourceDocumentSha256',
    ],
    'signed profile-context contract',
  );
});

test('all candidate rules carry participant-specific applicability and stay review-required', () => {
  const corpus = read(paths.corpus);
  const engine = read(paths.engine);
  const dimensions = [
    'moleculeIds',
    'finishedProductIds',
    'finishedFormulationIds',
    'concentration',
    'applicationAmount',
    'applicationArea',
    'frequencyPerWeek',
    'durationDays',
    'ph',
    'vehicle',
    'occlusion',
    'barrierCondition',
    'exposure',
  ];

  for (const dimension of dimensions) {
    assert.ok(
      countOccurrences(corpus, `${dimension}:`) >= 2,
      `${dimension} must exist in the participant contract and candidate-condition constructor`,
    );
    assert.match(
      engine,
      new RegExp(`(?:participant\\.${dimension}|facts\\?\\.${dimension})`, 'u'),
      `${dimension} must be evaluated by the exact applicability matcher`,
    );
  }
  assert.match(corpus, /reviewStatus:\s*['"]review_required['"]/u);
  assert.match(corpus, /const\s+reviewRequired\s*=\s*\{\s*status:\s*['"]review_required['"]\s*\}/u);
  assert.match(
    corpus,
    /Object\.values\s*\(\s*conditions\.tagA\s*\)[\s\S]*?constraint\.status\s*!==\s*['"]review_required['"]/u,
  );
  assert.match(
    corpus,
    /Object\.values\s*\(\s*conditions\.tagB\s*\)[\s\S]*?constraint\.status\s*!==\s*['"]review_required['"]/u,
  );
  assert.match(corpus, /conditions\.reproductiveContexts\.status\s*!==\s*['"]review_required['"]/u);
  assert.match(corpus, /severityBranches:\s*\[\s*\]/u);
  assert.match(corpus, /coUseSensitivity:\s*null/u);
  assert.match(
    engine,
    /allowed\.length\s*>\s*0[\s\S]*?allowed\.includes\s*\(\s*actual\s*\)/u,
    'multi-value exact strings must be treated as allowed alternatives for singular facts',
  );
  assert.match(
    engine,
    /actual\.some\s*\(\s*\(\s*value\s*\)\s*=>\s*allowed\.includes\s*\(\s*value\s*\)\s*\)/u,
    'a product molecule may match any member of the exact reviewed molecule allowlist',
  );
  assert.match(
    engine,
    /evaluateReviewedSeverityForApplicability[\s\S]*?applicability\s*===\s*['"]missing_facts['"][\s\S]*?unsupported_missing_facts/u,
    'missing exact severity-branch facts must remain unsupported',
  );
  assert.match(
    engine,
    /matched\.length\s*>\s*1[\s\S]*?unsupported_ambiguous_branches/u,
    'overlapping reviewed severity branches must remain unsupported rather than using array order',
  );
  assertContainsAll(
    corpus,
    [
      'CONFLICT_NON_VARIABLE_SEVERITY_LABEL',
      'rule.copy.severityLabel !== canonicalSeverityLabel(rule)',
    ],
    'signed variable-severity presentation contract',
  );
});

test('production consumers cannot import previews or bypass coverage-aware evaluation', () => {
  const definitionFiles = new Set([paths.corpus, 'apps/mobile/src/features/intelligence/rules.ts']);
  const bannedImports = new Set([
    'STARTER_RULES',
    'previewConflictRules',
    'previewGeneratePlan',
    'previewOrchestrate',
    'previewRecommend',
  ]);
  const offenders = [];
  const rawDetectionCallers = [];

  for (const path of mobileProductionSources()) {
    if (!definitionFiles.has(path)) {
      for (const binding of importedBindings(path)) {
        if (bannedImports.has(binding.imported)) {
          offenders.push(`${path} imports ${binding.imported} from ${binding.moduleName}`);
        }
      }
    }
    if (path !== paths.engine) {
      for (const line of identifierCalls(path, 'detectConflicts')) {
        rawDetectionCallers.push(`${path}:${line}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `production sources must not import candidate preview authority:\n${offenders.join('\n')}`,
  );
  assert.deepEqual(
    rawDetectionCallers,
    [],
    `detectConflicts() is engine-private plumbing; consumers must use coverage-aware evaluation:\n${rawDetectionCallers.join('\n')}`,
  );

  for (const path of [paths.useShelf, paths.generate, paths.orchestrate]) {
    const source = read(path);
    assert.match(source, /\bevaluateConflicts\s*\(/u, `${path} must use evaluateConflicts().`);
    assert.match(source, /\bconflictCoverageStatus\b/u, `${path} must retain coverage status.`);
    assert.match(source, /\bunsupportedConflictPairs\b/u, `${path} must retain uncovered pairs.`);
  }

  const recommendations = read(paths.recommendations);
  assert.match(recommendations, /conflictCoverageStatus\s*\?\?\s*['"]unsupported_unreviewed['"]/u);
  assert.match(
    recommendations,
    /severity\.status\s*===\s*['"]unsupported_ambiguous_branches['"][\s\S]*?hasAmbiguousBranches\s*=\s*true[\s\S]*?if\s*\(\s*hasAmbiguousBranches\s*\)\s*return\s+['"]unsupported_ambiguous_branches['"]/u,
    'recommendations must exclude a type when reviewed severity branches overlap',
  );
  assert.match(
    recommendations,
    /youreSet:[\s\S]*?conflictCoverageStatus\s*===\s*['"]compatible['"]/u,
    'recommendations may claim the seventh state only after exact reviewed compatibility',
  );
  assert.match(recommendations, /Pregnant or trying setting/u);
  assert.doesNotMatch(recommendations, /Pregnancy setting/u);
  const ask = read(paths.ask);
  assert.match(ask, /conflictCoverageStatus\s*!==\s*['"]compatible['"]/u);
  assert.match(
    ask,
    /conflictCoverageStatus\s*===\s*['"]not_applicable['"][\s\S]*?shelfProductCount\s*>=\s*2[\s\S]*?conflictCoverageUnavailable/u,
    'Ask must reject not_applicable when two or more shelf products still require a pair assessment',
  );
  const askScreen = read(paths.askScreen);
  assert.match(
    askScreen,
    /interactionGuidanceAvailable\s*=[\s\S]*?conflictCoverageStatus\s*===\s*['"]compatible['"][\s\S]*?conflictCoverageStatus\s*===\s*['"]reviewed_interactions['"]/u,
    'Ask must derive conflict-prompt availability only from admitted coverage states',
  );
  assert.match(
    askScreen,
    /!interactionGuidanceAvailable[\s\S]*?baseEmptyPromptOrder\.filter\([\s\S]*?promptKey\s*!==\s*['"]conflict['"]\s*\|\|\s*interactionGuidanceAvailable/u,
    'Ask must suppress both proactive and suggested conflict prompts while coverage is unavailable',
  );

  const engine = read(paths.engine);
  const unassessableCoverage = findFunction(paths.engine, 'unassessablePairCoverageKeys').text;
  assert.match(
    unassessableCoverage,
    /unassessable_pair@routine@unknown#\$\{i\}-\$\{j\}/u,
    'every untagged physical product pair must retain a distinct unassessable coverage key',
  );
  assert.match(
    unassessableCoverage,
    /unassessable_pair@\$\{activeSafetyContext\}@unknown#\$\{i\}/u,
    'every untagged product must retain a distinct active safety-context coverage key',
  );
  const evaluateConflicts = findFunction(paths.engine, 'evaluateConflicts').text;
  assert.match(
    evaluateConflicts,
    /unassessablePairCoverageKeys[\s\S]*?status:\s*['"]unsupported_unreviewed['"][\s\S]*?status:\s*['"]not_applicable['"]/u,
    'evaluateConflicts must check unassessable multi-product pairs before returning not_applicable',
  );
  assert.match(
    evaluateConflicts,
    /pairs\.map\(\(pair\)\s*=>\s*pair\.coverageKey\)[\s\S]*?\.\.\.unassessablePairs/u,
    'missing-admission coverage must union assessable and unassessable pairs',
  );
  assert.match(
    evaluateConflicts,
    /\.\.\.unassessablePairs[\s\S]*?\.\.\.pairs[\s\S]*?\.filter/u,
    'admitted-corpus coverage must retain unassessable pairs alongside assessable pairs',
  );

  assert.equal(
    findFunction(paths.generate, 'generatePlan').node.parameters.length,
    4,
    'generatePlan() must not accept a clinical-rule/corpus override',
  );
  assert.equal(
    findFunction(paths.orchestrate, 'orchestrate').node.parameters.length,
    2,
    'orchestrate() must not accept a clinical-rule/corpus override',
  );
  assert.equal(
    findFunction(paths.recommendations, 'recommend').node.parameters.length,
    1,
    'recommend() must not accept a clinical-rule/corpus override',
  );
});

test('stored conflict choices require exact hashes and legacy state remains dormant', () => {
  const choices = read(paths.choices);
  const overrides = read(paths.overrides);

  assertContainsAll(
    choices,
    [
      'corpusSha256',
      'ruleContentSha256',
      'isReviewedRule(conflict.rule)',
      'record.corpusSha256 === conflict.rule.corpusSha256',
      'record.ruleContentSha256 === conflict.rule.ruleContentSha256',
    ],
    'choice eligibility and lookup',
  );
  assertContainsAll(
    overrides,
    [
      'corpusSha256: conflict.rule.corpusSha256',
      'ruleContentSha256: conflict.rule.ruleContentSha256',
      'corpusSha256: null',
      'ruleContentSha256: null',
      'A legacy pair key cannot supply the exact corpus and rule hashes.',
    ],
    'choice persistence',
  );
  const legacyWriter = findFunction(paths.overrides, 'setConflictOverride').text;
  assert.doesNotMatch(
    legacyWriter,
    /\[\s*identity\.key\s*\]\s*:/u,
    'the legacy writer may delete old state but must never create an active choice',
  );
  assert.match(legacyWriter, /if\s*\(\s*!overridden\s*\)\s*\{[\s\S]*?delete\s+next/u);
});

test('no client or Edge Function mirrors conflict choices before hashes exist in the schema', () => {
  const runtimeSources = [
    ...mobileProductionSources(),
    ...walk('supabase/functions').filter(
      (path) =>
        ['.ts', '.tsx'].includes(extname(path)) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path),
    ),
  ];
  const mirrorWrites = [];
  for (const path of runtimeSources) {
    const source = read(path);
    if (
      /\.from\s*\(\s*['"]routine_conflicts['"]\s*\)[\s\S]{0,500}?\.(?:insert|upsert|update)\s*\(/u.test(
        source,
      ) ||
      /(?:insert|upsert|update)[\s\S]{0,300}?routine_conflicts/iu.test(source)
    ) {
      mirrorWrites.push(path);
    }
  }
  assert.deepEqual(
    mirrorWrites,
    [],
    `routine_conflicts lacks corpus/rule hash identity; server writes stay disabled:\n${mirrorWrites.join('\n')}`,
  );

  const routineConflictSchema = [
    read('supabase/migrations/20260612000012_routine_conflicts.sql'),
    read('supabase/migrations/20260710000037_routine_conflict_choice_identity.sql'),
  ].join('\n');
  assert.doesNotMatch(routineConflictSchema, /\bcorpus_sha256\b|\brule_content_sha256\b/u);
});

test('claim-bearing private conflict surfaces require production admission and canonical rule.copy', () => {
  const presentation = read(paths.presentation);
  const ask = read(paths.ask);
  const conflictRoute = read(paths.conflictRoute);
  const shareRoute = read(paths.shareRoute);
  const recommendations = read(paths.recommendations);
  const phase7 = read(paths.phase7);

  assert.match(presentation, /isAdmittedDetectedConflict\s*\(\s*conflict\s*\)/u);
  assert.ok(
    countOccurrences(presentation, 'conflict.rule.copy.') >= 6,
    'presentation helpers must return canonical rule.copy fields',
  );
  assert.match(ask, /ctx\.conflicts\.filter\s*\(\s*isAdmittedDetectedConflict\s*\)/u);
  assert.ok(
    countOccurrences(ask, '.rule.copy.') >= 12,
    'Ask conflict claims must come from the admitted canonical copy bundle',
  );
  assert.match(
    conflictRoute,
    /isAdmittedDetectedConflict\s*\(\s*candidate\s*\)[\s\S]*?candidate\.rule\.id/u,
  );
  assert.match(conflictRoute, /\.rule\.copy\./u);
  assert.doesNotMatch(
    shareRoute,
    /DetectedConflict|\.rule\.copy\.|canShareConflictCard|useShelf/u,
    'literal-zero-admission share route must not read or render private conflict claims',
  );
  assert.match(
    phase7,
    /shareCard:\s*false/u,
    'Phase 7 must keep conflict sharing literally closed rather than deriving authority from review metadata',
  );
  assert.match(recommendations, /\bisAdmittedDetectedConflict\b/u);
  assert.ok(
    recommendations.includes('.rule.copy.'),
    'conflict recommendations must consume the canonical admitted rule.copy bundle',
  );

  for (const path of [
    paths.presentation,
    paths.ask,
    paths.conflictRoute,
    paths.shareRoute,
    paths.recommendations,
    paths.orchestrate,
  ]) {
    assert.doesNotMatch(
      read(path),
      /\.rule\.(?:resolutionCopy|mechanism|sourceCitation)\b/u,
      `${path} must not bypass the canonical copy bundle`,
    );
  }
});

test('analytics cannot encode conflict existence or resolution', () => {
  const forbiddenEvents = [
    'conflict_detected',
    'conflict_overridden',
    'conflict_resolution_chosen',
    'conflict_detail_viewed',
    'landing_viewed',
    'share_card_export_failed',
    'share_card_export_started',
    'share_card_export_succeeded',
    'share_card_exported',
    'share_link_created',
    'share_link_opened',
    'share_sheet_opened',
  ];
  const offenders = [];
  for (const path of mobileProductionSources()) {
    const source = read(path);
    for (const event of forbiddenEvents) {
      if (source.includes(event)) offenders.push(`${path} contains ${event}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `conflict existence/resolution is health-adjacent state and must not enter telemetry:\n${offenders.join('\n')}`,
  );

  const registry = read(paths.analyticsRegistry);
  for (const event of forbiddenEvents) {
    assert.ok(!registry.includes(event), `ANALYTICS_ALLOWED_EVENTS must not authorize ${event}.`);
  }
});

test('conflict-only detail, share, and public landing routes emit no analytics', () => {
  for (const path of [paths.conflictRoute, paths.shareRoute, paths.publicShareRoute]) {
    const analyticsImports = importedBindings(path).filter(
      (binding) =>
        /^track(?:$|[A-Z_])/u.test(binding.imported) ||
        /(?:^|\/)analytics(?:\/|$)/u.test(binding.moduleName),
    );
    assert.deepEqual(
      analyticsImports,
      [],
      `${path} is conflict-only and must not import analytics.`,
    );
    assert.deepEqual(
      trackingCalls(path),
      [],
      `${path} is conflict-only and must not emit analytics, including product-add helpers.`,
    );
  }
});

test('conflict public-link URLs carry no conflict-identifying attribution', () => {
  const conflictShareLink = findFunction(paths.shareLinks, 'createConflictShareLink').text;
  assert.doesNotMatch(
    conflictShareLink,
    /\b(?:campaign|content|creative_variant|platform|app_version|build_number)\s*:/u,
    'conflict public links must not carry campaign/content/creative/platform/build attribution',
  );
  assert.doesNotMatch(
    conflictShareLink,
    /shelf_conflict_card_v1|conflict_card/u,
    'a public URL must not identify the shared clinical/conflict surface',
  );
});

test('zero-admission paywalls do not sell unavailable clinical guidance', () => {
  const copy = read(paths.subscriptionCopy);
  const askCopy = read(paths.askCopy);
  assertContainsAll(
    copy,
    [
      'Health-related guidance requires independent professional review before availability',
      'Interaction guidance is unavailable.',
      'before product-interaction claims can be sold, unlocked, or shown',
    ],
    'zero-admission subscription copy',
  );
  assert.doesNotMatch(copy, /Reviewed by dermatologists/iu);
  assert.doesNotMatch(copy, /Unlimited (?:ingredient-)?conflict checks/iu);
  assert.doesNotMatch(copy, /Ingredient conflict checks, with evidence grades/iu);
  assert.doesNotMatch(copy, /Unlock your full skin-cycling scheduler/iu);
  assert.doesNotMatch(
    askCopy,
    /under independent review|being reviewed|evidence-grounded|evidence-graded|evidence-backed|zero-retention|no-training cloud/iu,
    'zero-admission Ask copy must not claim an active review, evidence level, or unconfigured cloud-provider posture',
  );
  assert.match(askCopy, /Cloud Ask is unavailable in this release/u);

  const runtimeOverclaims = [];
  for (const path of mobileProductionSources()) {
    const source = read(path);
    if (
      /Reviewed by dermatologists|Unlimited (?:ingredient-)?conflict checks|conflict checks are ready/iu.test(
        source,
      )
    ) {
      runtimeOverclaims.push(path);
    }
  }
  assert.deepEqual(
    runtimeOverclaims,
    [],
    `zero-admission runtime copy must not claim unavailable review or conflict capability:\n${runtimeOverclaims.join('\n')}`,
  );
});

test('migration 0066 seals legacy clinical tables and 0067 preserves the exact lint exception', () => {
  const migration0066 = read(paths.migration0066);
  const migration0067 = read(paths.migration0067);

  assertContainsAll(
    migration0066,
    [
      'alter table public.conflict_rules force row level security',
      'alter table public.sequencing_rules force row level security',
      'revoke all privileges on table',
      'from public, anon, authenticated, service_role',
      'LEGACY_CLINICAL_CONTENT_IMMUTABLE',
      "errcode = '55000'",
      'before insert or update or delete or truncate',
      'for each statement',
    ],
    'migration 0066',
  );
  assert.doesNotMatch(migration0066, /\bcreate\s+policy\b/iu);

  assertContainsAll(
    migration0067,
    [
      'PRAGMA:TABLE: pg_temp.catalog_launch_curation_release_validation_cache',
      'create temporary table catalog_launch_curation_release_validation_cache',
      'release_catalog_launch_curation_campaign_v0058',
      'from public, anon, authenticated, service_role',
    ],
    'migration 0067',
  );
  assert.doesNotMatch(
    migration0067,
    /\b(?:perform|select)\s+(?:public\.)?plpgsql_check_pragma\s*\(/iu,
  );
});

test('the database contract is exactly 70 migrations through head 0071', () => {
  const migrations = readdirSync(resolve(root, 'supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  assert.equal(migrations.length, 70);
  assert.equal(migrations.at(-1), '20260726000071_recommendation_zero_admission.sql');
  assert.match(read(paths.migration0068), /step_id IS NULL/u);
  assert.match(read(paths.migration0069), /public\.record_routine_completion/u);
  assert.match(read(paths.migration0070), /public\.stage_health_consent_copy_draft_successor/u);
  assert.match(read(paths.migration0071), /private\.recommendation_admission_control/u);

  for (const path of [paths.schemaContract, paths.clinicalSealContract, paths.lintContract]) {
    const source = read(path);
    assert.match(source, /\b70::bigint\b/u, `${path} must bind the exact migration count.`);
    assert.match(
      source,
      /['"]20260726000071['"]::text/u,
      `${path} must bind the exact migration head.`,
    );
  }
  assert.match(read(paths.clinicalSealContract), /select\s+plan\s*\(\s*26\s*\)/iu);
  assert.match(read(paths.lintContract), /select\s+plan\s*\(\s*7\s*\)/iu);
});

test('all 13 candidate IDs and both gap audits are in the Phase 3 packet contract', () => {
  const corpus = read(paths.corpus);
  const clinicalAudit = read(paths.clinicalAudit);
  const appStoreAudit = read(paths.appStoreAudit);
  const packetBuilder = read(paths.packetBuilder);

  for (const id of expectedRuleIds) {
    assert.ok(clinicalAudit.includes(id), `the clinical evidence audit is missing ${id}`);
  }
  const candidateRuleIds = [
    ...corpus.matchAll(/\bid:\s*['"](00000000-0000-4000-8000-[0-9a-f]{12})['"]/gu),
  ]
    .map((match) => match[1])
    .sort();
  const sourceMapRuleIds = [
    ...corpus.matchAll(/^\s*['"](00000000-0000-4000-8000-[0-9a-f]{12})['"]\s*:/gmu),
  ]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(candidateRuleIds, [...expectedRuleIds]);
  assert.deepEqual(sourceMapRuleIds, [...expectedRuleIds]);

  assert.match(appStoreAudit, /Release verdict:\*\*\s+no-go/u);
  assert.ok(
    countOccurrences(packetBuilder, paths.clinicalAudit) >= 3,
    'the clinical evidence audit must be in legal, clinical, and chemistry packets',
  );
  assert.ok(
    countOccurrences(packetBuilder, paths.appStoreAudit) >= 2,
    'the App Store/legal audit must be in legal and privacy/platform packets',
  );
});

test('the source contract is mandatory in Phase 3 and launch verification', () => {
  const packageJson = JSON.parse(read(paths.packageJson));
  assert.equal(
    packageJson.scripts['core02:clinical-rule-source-contract:test'],
    'node --test scripts/core02/clinical-rule-source-contract.test.mjs',
  );
  for (const parentScript of ['phase3:verify', 'launch:verify']) {
    const commands = String(packageJson.scripts[parentScript] ?? '').split(' && ');
    assert.ok(
      commands.includes('npm run core02:clinical-rule-source-contract:test'),
      `${parentScript} must run the CORE-02 source contract as a blocking gate`,
    );
  }
});
