#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const paths = Object.freeze({
  packageJson: 'package.json',
  admission: 'apps/mobile/src/features/routine/routineSequencingCorpus.v1.ts',
  sequencing: 'apps/mobile/src/features/routine/sequencing.ts',
  reviewGate: 'apps/mobile/src/features/routine/reviewGate.ts',
  generate: 'apps/mobile/src/features/routine/generate.ts',
  cadence: 'apps/mobile/src/features/scheduler/cadence.ts',
  cycleStore: 'apps/mobile/src/features/scheduler/cycleStore.ts',
  useCycle: 'apps/mobile/src/features/scheduler/useCycle.ts',
  rampStore: 'apps/mobile/src/features/routine/rampStore.ts',
  ramp: 'apps/mobile/src/features/routine/ramp.ts',
  classes: 'apps/mobile/src/features/scheduler/classes.ts',
  orchestrate: 'apps/mobile/src/features/scheduler/orchestrate.ts',
  planProfileAdmission: 'apps/mobile/src/features/routine/planProfileAdmission.ts',
  usePlan: 'apps/mobile/src/features/routine/usePlan.ts',
  useRamp: 'apps/mobile/src/features/routine/useRamp.ts',
  planRoute: 'apps/mobile/src/app/routine/plan.tsx',
  milestones: 'apps/mobile/src/features/streak/milestones.ts',
  behaviouralTriggers: 'apps/mobile/src/features/notifications/BehaviouralTriggers.tsx',
  notificationDelivery: 'apps/mobile/src/features/notifications/deliver.ts',
});

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

test('the routine sequencing corpus is exact-hash bound and zero-admission', () => {
  const admission = read(paths.admission);
  const sequencing = read(paths.sequencing);

  assert.match(sequencing, /status:\s*['"]draft_blocked['"]/u);
  assert.match(
    sequencing,
    /contentSha256:\s*canonicalSha256\(ROUTINE_SEQUENCING_CORPUS_CONTENT\)/u,
  );
  assert.match(sequencing, /candidateDisposition:\s*['"]draft_blocked['"]/u);
  assert.match(sequencing, /cadencePolicy:\s*\{/u);
  assert.match(sequencing, /claimMappings:\s*\(/u);
  assert.match(sequencing, /retainedArtifactId:\s*null/u);
  assert.match(sequencing, /retainedArtifactSha256:\s*null/u);
  assert.match(sequencing, /stopRefer:\s*\{[\s\S]*?unavailable_pending_review/u);
  assert.match(admission, /ROUTINE_SEQUENCING_TRUSTED_AUTHORITIES[^=]*=\s*\[\]/u);
  assert.match(admission, /ROUTINE_SEQUENCING_REVIEW_RECEIPTS[^=]*=\s*\[\]/u);
  assert.match(admission, /const admittedCorpusInstances = new WeakSet/u);
  assert.match(admission, /function verifyDetachedReceiptSignature[\s\S]*?return false;/u);
  assert.match(admission, /canonicalSha256\(corpus\.content\)\s*!==\s*corpus\.contentSha256/u);
  assert.match(admission, /source\.retainedArtifactId\s*===\s*null/u);
  assert.match(admission, /source\.retainedArtifactSha256\s*===\s*null/u);
  assert.match(admission, /!hasSha256\(source\.retainedArtifactSha256\)/u);
  assert.match(admission, /mapping\.sourceIds\.length\s*===\s*0/u);
  assert.match(admission, /mapping\.propositionIds\.length\s*===\s*0/u);
  assert.match(admission, /cadencePolicy\.stopRefer\.status\s*!==\s*['"]approved['"]/u);
});

test('free-text review metadata and structural injection cannot publish sequencing', () => {
  const sequencing = read(paths.sequencing);
  const reviewGate = read(paths.reviewGate);
  const generate = read(paths.generate);

  assert.match(
    sequencing,
    /function isReviewedSequencingRule[\s\S]*?return false;/u,
    'legacy reviewedBy metadata must never authorize production sequencing',
  );
  assert.match(
    sequencing,
    /function runtimeAdmittedRoutineSequencingCorpus[\s\S]*?admitRoutineSequencingCorpus[\s\S]*?isRuntimeAdmittedRoutineSequencingCorpus/u,
  );
  assert.match(
    sequencing,
    /if\s*\(\s*!isDev\s*\)[\s\S]*?runtimeAdmittedRoutineSequencingCorpus\(\)/u,
  );
  assert.match(sequencing, /Ignore caller-supplied structural rules in production/u);
  assert.match(
    generate,
    /availableSequencingRules\s*=\s*shippableSequencingRules\(sequencingRules\)/u,
  );
  assert.match(reviewGate, /Object\.values\(shippableSequencingRules\(rules\)\)\.some/u);
});

test('cadence arithmetic rejects malformed numbers and avoids unsafe multiplication', () => {
  const cadence = read(paths.cadence);

  assert.match(cadence, /Number\.isSafeInteger/u);
  assert.match(cadence, /requiredRecoveryNights\s*>\s*lengthNights/u);
  assert.match(cadence, /requiredRecoveryNights\s*>\s*maxLength/u);
  assert.match(cadence, /occurrences\s*>\s*maxLength\s*-\s*requiredRecoveryNights/u);
  assert.match(cadence, /while\s*\(\s*lowerBound\s*<\s*upperBound\s*\)/u);
  assert.doesNotMatch(cadence, /Math\.floor\(\s*\(\s*maxFrequencyPerWeek\s*\*\s*lengthNights/u);
});

test('cadence publication has no Boolean or conservative numeric fallback', () => {
  const admission = read(paths.admission);
  const reviewGate = read(paths.reviewGate);
  const classes = read('apps/mobile/src/features/scheduler/classes.ts');

  assert.doesNotMatch(reviewGate, /ROUTINE_CADENCE_REVIEWED/u);
  assert.doesNotMatch(classes, /CAPS_REVIEWED/u);
  assert.match(
    reviewGate,
    /canUseRoutineCadence[\s\S]*?shippableRoutineCadencePolicy\(\)\s*!==\s*null/u,
  );
  assert.match(
    classes,
    /frequencyCap[\s\S]*?shippableRoutineCadencePolicy\(\)[\s\S]*?if\s*\(\s*!policy\s*\)\s*return null/u,
  );
  assert.doesNotMatch(classes, /const\s+FREQUENCY_CAPS/u);
  assert.match(admission, /cadencePolicy\.candidateDisposition\s*!==\s*['"]approved['"]/u);
});

test('executable cadence values and copy come from the exact admitted corpus', () => {
  const admission = read(paths.admission);
  const sequencing = read(paths.sequencing);
  const classes = read(paths.classes);
  const orchestrate = read(paths.orchestrate);
  const ramp = read(paths.ramp);
  const useCycle = read(paths.useCycle);
  const procedureRoute = read('apps/mobile/src/app/cycle/procedure.tsx');
  const recoveryRoute = read('apps/mobile/src/app/cycle/recovery.tsx');
  const toleranceRoute = read('apps/mobile/src/app/routine/tolerance.tsx');
  const rampRoute = read('apps/mobile/src/app/routine/ramp.tsx');

  assert.match(
    admission,
    /type AdmittedRoutineSequencingCorpus[\s\S]*?cadencePolicy:\s*RoutineCadencePolicy[\s\S]*?copy:\s*RoutineGuidanceCopy/u,
  );
  assert.match(
    sequencing,
    /shippableRoutineCadencePolicy[\s\S]*?runtimeAdmittedRoutineSequencingCorpus\(\)\?\.cadencePolicy/u,
  );
  assert.match(
    sequencing,
    /shippableRoutineGuidanceCopy[\s\S]*?runtimeAdmittedRoutineSequencingCorpus\(\)\?\.copy/u,
  );
  assert.match(classes, /policy\.frequencyCapsPerWeek\[cls\]/u);
  assert.doesNotMatch(orchestrate, /const\s+RECOVERY/u);
  assert.match(orchestrate, /cadencePolicy\.cycleRecoveryNights\[variant\]/u);
  assert.match(orchestrate, /guidanceCopy\.phasedIntroductionNoteTemplate/u);
  assert.match(ramp, /rampPolicy\.minimumStableDaysBeforeOffer/u);
  assert.match(ramp, /rampPolicy\.irritationStepDownPerWeek/u);
  assert.doesNotMatch(ramp, />=\s*21/u);
  assert.match(useCycle, /routinePhasedIntroductionDelayDays\(\)/u);
  assert.doesNotMatch(useCycle, /daysSince\([^)]*\)\s*<=\s*3/u);
  assert.match(procedureRoute, /cadencePolicy\.recoveryWindows\.procedureChoicesDays/u);
  assert.match(procedureRoute, /cadencePolicy\.recoveryWindows\.defaultProcedureDays/u);
  assert.match(procedureRoute, /guidanceCopy\.recoveryProcedureExplanation/u);
  assert.doesNotMatch(procedureRoute, /const\s+REST\s*=/u);
  assert.match(toleranceRoute, /cadencePolicy\.recoveryWindows\.irritationDays/u);
  assert.doesNotMatch(toleranceRoute, /beginRecovery\(\s*7\s*,\s*['"]irritation['"]/u);
  assert.match(recoveryRoute, /guidanceCopy\.recoveryIrritationExplanation/u);
  assert.match(recoveryRoute, /guidanceCopy\.recoveryProcedureExplanation/u);
  assert.match(rampRoute, /guidanceCopy\.rampIrritationExplanation/u);
});

test('unavailable stop/refer authority cannot open recovery or irritation writes', () => {
  const admission = read(paths.admission);
  const sequencing = read(paths.sequencing);
  const reviewGate = read(paths.reviewGate);
  const cycleStore = read(paths.cycleStore);
  const rampStore = read(paths.rampStore);

  assert.match(
    sequencing,
    /shippableRoutineStopReferPolicy[\s\S]*?status\s*===\s*['"]approved['"]/u,
  );
  assert.match(
    reviewGate,
    /canUseRoutineRecovery[\s\S]*?shippableRoutineStopReferPolicy\(\)[\s\S]*?stopReferPolicy\s*!==\s*null[\s\S]*?isRoutineStopReferEvaluatorImplemented\(stopReferPolicy\)/u,
  );
  assert.match(admission, /ROUTINE_STOP_REFER_EVALUATOR_BLOCKER/u);
  assert.match(admission, /function isRoutineStopReferEvaluatorImplemented[\s\S]*?return false;/u);
  assert.match(
    cycleStore,
    /startRecovery[\s\S]*?assertRoutineRecoveryAvailable\(\)[\s\S]*?mutateCycleConfig/u,
  );
  assert.match(
    rampStore,
    /applyToleranceToRamps[\s\S]*?answer\s*===\s*['"]irritated['"][\s\S]*?assertRoutineRecoveryAvailable\(\)/u,
  );
});

test('unbound claim-bearing explainability copy remains production-closed', () => {
  const admission = read(paths.admission);
  const reviewGate = read(paths.reviewGate);
  const whyTonight = read('apps/mobile/src/app/cycle/why-tonight.tsx');
  const phasedIntro = read('apps/mobile/src/app/cycle/phased-intro.tsx');

  assert.match(admission, /ROUTINE_EXPLAINABILITY_COPY_BINDING_BLOCKER/u);
  assert.match(
    admission,
    /function isRoutineExplainabilityCopyBindingImplemented[\s\S]*?return false;/u,
  );
  assert.match(
    reviewGate,
    /canUseRoutineExplainabilityCopy[\s\S]*?isRoutineExplainabilityCopyBindingImplemented\(\)/u,
  );
  for (const [path, source, contentName] of [
    ['apps/mobile/src/app/cycle/why-tonight.tsx', whyTonight, 'AdmittedWhyTonightScreen'],
    ['apps/mobile/src/app/cycle/phased-intro.tsx', phasedIntro, 'PhasedIntroScreenContent'],
  ]) {
    const wrapper = source.slice(
      source.indexOf('export default function'),
      source.indexOf(`function ${contentName}`),
    );
    assert.match(
      wrapper,
      /canUseRoutineExplainabilityCopy\(\)/u,
      `${path} must close before mounting unbound claim-bearing copy`,
    );
  }
});

test('cycle and ramp mutations refuse before storage, cache, or analytics', () => {
  const cycleStore = read(paths.cycleStore);
  const useCycle = read(paths.useCycle);
  const rampStore = read(paths.rampStore);

  assert.match(cycleStore, /ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED/u);
  assert.match(
    cycleStore,
    /async function mutateCycleConfig[\s\S]*?assertRoutineCadenceMutationAdmission\(\)[\s\S]*?runCurrentHealthDataOperation/u,
  );
  assert.match(
    cycleStore,
    /assertRoutineCadenceMutationAdmission\(\)[\s\S]*?updatePrivateItem\(KEY/u,
  );
  assert.match(
    useCycle,
    /const commit[\s\S]*?assertRoutineCadenceMutationAdmission\(\)[\s\S]*?runCurrentHealthDataOperation[\s\S]*?cancelQueries/u,
  );
  for (const functionName of ['ensureRamp', 'stepUpRamp', 'applyToleranceToRamps']) {
    assert.match(
      rampStore,
      new RegExp(
        `(?:async )?function ${functionName}[\\s\\S]*?assertRoutineCadenceMutationAdmission\\(\\)[\\s\\S]*?updatePrivateItem\\(KEY`,
        'u',
      ),
      `${functionName} must gate before private ramp writes`,
    );
  }
});

test('real shelves cannot inherit the synthetic example profile', () => {
  const planProfileAdmission = read(paths.planProfileAdmission);
  const usePlan = read(paths.usePlan);

  assert.match(
    planProfileAdmission,
    /routineGenerationProfileForRealShelf[\s\S]*?!profile\s*\|\|\s*profile\.source\s*===\s*['"]unavailable['"][\s\S]*?return null/u,
  );
  assert.match(
    usePlan,
    /if\s*\(\s*items\.length\s*>\s*0\s*\)[\s\S]*?routineGenerationProfileForRealShelf\(profile\.data\)[\s\S]*?if\s*\(\s*!real\s*\)[\s\S]*?data:\s*undefined[\s\S]*?sourceReady:\s*false[\s\S]*?isExample:\s*false/u,
  );
  assert.doesNotMatch(usePlan, /const real:[\s\S]*?profile\.data[\s\S]*?:\s*MAYA_PROFILE/u);
});

test('ramp state and cadence-derived notifications close before reads or side effects', () => {
  const useRamp = read(paths.useRamp);
  const behaviouralTriggers = read(paths.behaviouralTriggers);
  const notificationDelivery = read(paths.notificationDelivery);

  assert.match(
    useRamp,
    /const planCurrent\s*=\s*plan\.sourceReady\s*&&\s*!plan\.isError\s*&&\s*!plan\.isLoading\s*&&\s*!plan\.isRefreshing\s*&&\s*plan\.isSourceCurrent\(\)/u,
  );
  assert.match(useRamp, /enabled:\s*cadenceReady\s*&&\s*planCurrent/u);
  assert.match(useRamp, /const items\s*=\s*!cadenceReady\s*\|\|\s*!planCurrent\s*\?\s*\[\]/u);
  assert.match(
    useRamp,
    /recoveryReady\s*\|\|\s*item\.state\.toleranceState\s*!==\s*['"]paused_irritation['"]/u,
  );
  assert.match(
    useRamp,
    /function acceptStepUp[\s\S]*?assertRoutineCadenceMutationAdmission\(\)[\s\S]*?runCurrentHealthDataOperation/u,
  );
  assert.match(
    behaviouralTriggers,
    /ramp:\s*prefs\?\.streakNudges\s*===\s*true\s*&&\s*canUseRoutineCadence\(\)/u,
  );

  const notifyStart = notificationDelivery.indexOf('export async function notifyBehavioural');
  const preferenceRead = notificationDelivery.indexOf(
    'const p = await loadNotifPrefs()',
    notifyStart,
  );
  const rampGate = notificationDelivery.indexOf(
    "if (kind === 'rampup' && !canUseRoutineCadence()) return false;",
    notifyStart,
  );
  const recoveryGate = notificationDelivery.indexOf(
    "if (kind === 'deescalation' && !canUseRoutineRecovery()) return false;",
    notifyStart,
  );
  assert.ok(notifyStart >= 0 && preferenceRead > notifyStart);
  assert.ok(rampGate > notifyStart && rampGate < preferenceRead);
  assert.ok(recoveryGate > rampGate && recoveryGate < preferenceRead);
});

test('plan and streak surfaces do not synthesize sequencing or cycle authority', () => {
  const planRoute = read(paths.planRoute);
  const milestones = read(paths.milestones);

  assert.match(
    planRoute,
    /if\s*\(\s*canUseRoutineCadence\(\)\s*&&\s*canUseRoutineRecovery\(\)\s*&&\s*cycleData\?\.cycle\s*\)[\s\S]*?cycleMutations\.start\(\)/u,
  );
  assert.match(
    planRoute,
    /canUseRoutineSequencing\(\)\s*&&\s*plan\s*&&\s*plan\.unplacedProducts\.length\s*===\s*0[\s\S]*?plan\.gaps\[0\]/u,
  );
  assert.match(
    milestones,
    /cycleLength\s*!==\s*null\s*&&\s*Number\.isFinite\(cycleLength\)\s*&&\s*cycleLength\s*>=\s*2/u,
  );
  assert.doesNotMatch(milestones, /threshold:\s*4/u);
});

test('closed recovery publication preserves stored bytes while exposing only neutral state', () => {
  const cycleStore = read(paths.cycleStore);
  const useCycle = read(paths.useCycle);

  assert.match(
    cycleStore,
    /if\s*\(\s*normalized\.recovery\s*&&\s*!recoveryAllowed\s*\)\s*return normalized;/u,
  );
  assert.match(
    cycleStore,
    /if\s*\(\s*current\.recovery\s*&&\s*!recoveryAllowed\s*\)[\s\S]*?return currentRaw;/u,
  );
  assert.match(
    useCycle,
    /if\s*\(\s*!cadenceReady\s*\|\|\s*phasedIntroductionDelayDays\s*===\s*null\s*\)[\s\S]*?closedCadenceCycleData\(config\)/u,
  );
  assert.match(
    useCycle,
    /const publishedConfig\s*=\s*recoveryReady\s*\?\s*config\s*:\s*\{\s*\.\.\.config,\s*recovery:\s*null\s*\}/u,
  );
  assert.match(
    useCycle,
    /recoveryReady\s*\?\s*recoveryProgress\(config\.recovery,\s*today\)\s*:\s*\{\s*active:\s*false,\s*day:\s*0,\s*days:\s*0\s*\}/u,
  );
});

test('every direct-entry cadence route closes before sensitive hooks or guidance analytics mount', () => {
  const routes = [
    {
      path: 'apps/mobile/src/app/cycle/week.tsx',
      wrapper: 'WeekScreen',
      content: 'AdmittedWeekScreen',
      forbidden: ['useCycle()', "track('"],
    },
    {
      path: 'apps/mobile/src/app/cycle/settings.tsx',
      wrapper: 'CycleSettingsScreen',
      content: 'AdmittedCycleSettingsScreen',
      forbidden: ['useCycle()', 'useCycleMutations()'],
    },
    {
      path: 'apps/mobile/src/app/cycle/why-tonight.tsx',
      wrapper: 'WhyTonightScreen',
      content: 'AdmittedWhyTonightScreen',
      forbidden: ['useCycle()', "track('why_tonight_viewed')"],
    },
    {
      path: 'apps/mobile/src/app/cycle/disruption.tsx',
      wrapper: 'DisruptionScreen',
      content: 'DisruptionScreenContent',
      forbidden: ['useCycle()', 'useCycleMutations()'],
    },
    {
      path: 'apps/mobile/src/app/cycle/recovery.tsx',
      wrapper: 'RecoveryScreen',
      content: 'RecoveryScreenContent',
      forbidden: ['useCycle()', 'useCycleMutations()'],
      recovery: true,
    },
    {
      path: 'apps/mobile/src/app/cycle/phased-intro.tsx',
      wrapper: 'PhasedIntroScreen',
      content: 'PhasedIntroScreenContent',
      forbidden: ['useCycle()', 'useCycleMutations()'],
    },
    {
      path: 'apps/mobile/src/app/cycle/procedure.tsx',
      wrapper: 'ProcedureScreen',
      content: 'ProcedureScreenContent',
      forbidden: ['useCycleMutations()'],
      recovery: true,
    },
    {
      path: 'apps/mobile/src/app/routine/ramp.tsx',
      wrapper: 'RampScreen',
      content: 'RampContent',
      forbidden: ['useRamp()'],
    },
    {
      path: 'apps/mobile/src/app/routine/tolerance.tsx',
      wrapper: 'ToleranceScreen',
      content: 'ToleranceCheckIn',
      forbidden: ['useCycleMutations()'],
      recovery: true,
    },
  ];

  for (const route of routes) {
    const source = read(route.path);
    const wrapperStart = source.indexOf(`function ${route.wrapper}`);
    const contentStart = source.indexOf(`function ${route.content}`);
    assert.ok(wrapperStart >= 0, `${route.path} must define ${route.wrapper}`);
    assert.ok(contentStart > wrapperStart, `${route.path} must isolate admitted content`);
    const wrapper = source.slice(wrapperStart, contentStart);
    assert.match(
      wrapper,
      /canUseRoutineCadence\(\)/u,
      `${route.path} must check cadence admission`,
    );
    if (route.recovery) {
      assert.match(
        wrapper,
        /canUseRoutineRecovery\(\)/u,
        `${route.path} must independently check stop/refer recovery admission`,
      );
    }
    assert.match(
      wrapper,
      /return <[A-Za-z]+(?:ReviewGate|Gate)/u,
      `${route.path} must return closed UI`,
    );
    for (const forbidden of route.forbidden) {
      assert.doesNotMatch(
        wrapper,
        new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
        `${route.path} must not mount ${forbidden} before admission`,
      );
    }
  }

  const week = read('apps/mobile/src/app/cycle/week.tsx');
  const closedWeek = week.slice(
    week.indexOf('function ReviewGateWeekScreen()'),
    week.indexOf('function ReviewGateEmptyState()'),
  );
  assert.match(closedWeek, /Available from Today/u);
  assert.doesNotMatch(closedWeek, /amSummary\(|moisturizer|SPF/u);
});

test('the CORE-03 source contract is mandatory in Phase 3 and launch verification', () => {
  const packageJson = JSON.parse(read(paths.packageJson));
  assert.equal(
    packageJson.scripts['core03:routine-guidance-source-contract:test'],
    'node --test scripts/core03/routine-guidance-source-contract.test.mjs',
  );
  for (const parentScript of ['phase3:verify', 'launch:verify']) {
    const commands = String(packageJson.scripts[parentScript] ?? '').split(' && ');
    assert.ok(
      commands.includes('npm run core03:routine-guidance-source-contract:test'),
      `${parentScript} must run the CORE-03 source contract as a blocking gate`,
    );
  }
});
