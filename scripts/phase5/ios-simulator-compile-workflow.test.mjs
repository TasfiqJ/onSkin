import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { parseDocument } from 'yaml';

const repoRoot = resolve(import.meta.dirname, '../..');
const workflowPath = resolve(repoRoot, '.github/workflows/ios-simulator-compile.yml');
const workflowText = readFileSync(workflowPath, 'utf8');

const expectedEnvironment = {
  APP_VARIANT: 'staging',
  CI: 'true',
  DEVELOPER_DIR: '/Applications/Xcode_26.4.app/Contents/Developer',
  EXPO_NO_GIT_STATUS: '1',
  EXPO_NO_TELEMETRY: '1',
  EXPO_PUBLIC_APP_ENV: 'staging',
  EXPO_PUBLIC_CAMERA_STACK: 'expo-camera',
  EXPO_PUBLIC_NATIVE_CAMERA_ENABLED: 'true',
  EXPO_PUBLIC_NATIVE_OCR_ENABLED: 'true',
  EXPO_USE_PRECOMPILED_MODULES: '1',
  IOS_WIDGET_EXTENSION_BUILD_ENABLED: 'false',
  SENTRY_DISABLE_AUTO_UPLOAD: 'true',
};

function parseWorkflow(text) {
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 0 && text.length <= 100_000);
  const document = parseDocument(text, {
    merge: false,
    strict: true,
    uniqueKeys: true,
  });
  assert.deepEqual(document.errors, []);
  assert.deepEqual(document.warnings, []);
  return document.toJS({ maxAliasCount: 0 });
}

function stepByName(job, name) {
  const matches = job.steps.filter((step) => step?.name === name);
  assert.equal(matches.length, 1, `Expected exactly one ${name} step.`);
  return matches[0];
}

function validateWorkflow(text) {
  const workflow = parseWorkflow(text);
  assert.deepEqual(Object.keys(workflow).sort(), [
    'concurrency',
    'env',
    'jobs',
    'name',
    'on',
    'permissions',
  ]);
  assert.equal(workflow.name, 'iOS Simulator compile');
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.concurrency, {
    group: 'ios-simulator-compile-${{ github.workflow }}-${{ github.ref }}',
    'cancel-in-progress': true,
  });
  assert.deepEqual(workflow.env, expectedEnvironment);

  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.on.workflow_dispatch, null);

  assert.deepEqual(Object.keys(workflow.jobs), ['simulator-compile']);
  const job = workflow.jobs['simulator-compile'];
  assert.deepEqual(Object.keys(job).sort(), ['name', 'runs-on', 'steps', 'timeout-minutes']);
  assert.equal(job.name, 'Unsigned iOS Simulator compile and link');
  assert.equal(job['runs-on'], 'macos-26');
  assert.equal(job['timeout-minutes'], 50);
  assert.ok(Array.isArray(job.steps) && job.steps.length === 10);
  for (const step of job.steps) {
    assert.ok(step && typeof step === 'object' && !Array.isArray(step));
    assert.equal(Object.hasOwn(step, 'if'), false);
    assert.equal(Object.hasOwn(step, 'continue-on-error'), false);
    assert.equal(Object.hasOwn(step, 'env'), false);
  }

  const actionSteps = job.steps.filter((step) => typeof step.uses === 'string');
  assert.deepEqual(
    actionSteps.map((step) => step.uses),
    [
      'actions/checkout@9f698171ed81b15d1823a05fc7211befd50c8ae0',
      'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
    ],
  );
  assert.ok(actionSteps.every((step) => /^[^@\s]+@[0-9a-f]{40}$/u.test(step.uses)));
  assert.deepEqual(actionSteps[0].with, { 'persist-credentials': false });
  assert.deepEqual(actionSteps[1].with, {
    'node-version': '22.22.2',
    cache: 'npm',
    'cache-dependency-path': 'package-lock.json',
  });

  assert.equal(stepByName(job, 'Install from lockfile').run, 'npm ci');
  const reviewedInputs = stepByName(job, 'Verify reviewed native inputs').run;
  assert.match(
    reviewedInputs,
    /^npm run postinstall:check\nnpm run cat05:native-ocr-source-contract:test\n?$/u,
  );

  const prebuild = stepByName(job, 'Generate a clean staging iOS project');
  assert.equal(prebuild['working-directory'], 'apps/mobile');
  assert.match(
    prebuild.run,
    /^npx --no-install expo prebuild --platform ios --clean --no-install --template \.\.\/\.\.\/node_modules\/expo\/template\.tgz\n?$/u,
  );
  assert.deepEqual(stepByName(job, 'Install CocoaPods dependencies'), {
    name: 'Install CocoaPods dependencies',
    'working-directory': 'apps/mobile',
    run: 'pod install --project-directory=ios',
  });

  const autolinking = stepByName(job, 'Verify native OCR autolinking').run;
  assert.match(autolinking, /test -f ios\/Podfile\.lock/u);
  assert.match(autolinking, /NativeLabelOcr/u);

  const build = stepByName(job, 'Build and link an unsigned Simulator app').run;
  assert.match(build, /xcodebuild/u);
  assert.match(build, /-configuration Release/u);
  assert.match(build, /-sdk iphonesimulator/u);
  assert.match(build, /generic\/platform=iOS Simulator/u);
  assert.match(build, /CODE_SIGNING_ALLOWED=NO/u);
  assert.match(build, /CODE_SIGNING_REQUIRED=NO/u);
  assert.match(build, /CODE_SIGN_IDENTITY=/u);
  assert.match(build, /\bbuild\n?$/u);

  const product = stepByName(job, 'Verify the linked Simulator product').run;
  assert.match(product, /CFBundleExecutable/u);
  assert.match(product, /Mach-O/u);
  assert.match(product, /lipo -archs/u);
  assert.match(product, /test -n "\$architectures"/u);

  assert.doesNotMatch(text, /pull_request_target/u);
  assert.doesNotMatch(text, /\$\{\{\s*secrets\./u);
  assert.doesNotMatch(text, /\bmapfile\b/u);
  assert.doesNotMatch(text, /\buname\s+-m\b|\bARCHS=|\bONLY_ACTIVE_ARCH=/u);
  assert.doesNotMatch(text, /\bxcodebuild\s+archive\b|\b-archivePath\b/u);
  assert.doesNotMatch(text, /\beas\s+(?:build|submit)\b/u);
  assert.doesNotMatch(text, /actions\/upload-artifact/u);
  assert.doesNotMatch(text, /\bCODE_SIGNING_(?:ALLOWED|REQUIRED)=YES\b/u);
  assert.doesNotMatch(text, /\b(?:curl|wget|brew|sudo)\b/u);
  assert.doesNotMatch(text, /\bnpm\s+(?:install|i)\b/u);
}

test('macOS workflow is a manual, unsigned Simulator compile/link release gate', () => {
  assert.doesNotThrow(() => validateWorkflow(workflowText));
});

test('workflow contract rejects privilege, signing, submission, portability, and proof regressions', () => {
  const mutations = [
    ['contents: read', 'contents: write'],
    ['workflow_dispatch:', 'push:'],
    ['actions/checkout@9f698171ed81b15d1823a05fc7211befd50c8ae0', 'actions/checkout@main'],
    ['timeout-minutes: 50', 'timeout-minutes: 0'],
    ['-sdk iphonesimulator', '-sdk iphoneos'],
    ['CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_ALLOWED=YES'],
    ['npm ci', 'npm install'],
    ['pod install --project-directory=ios', 'eas build --platform ios'],
    ['workspace_count=', 'mapfile workspace_count='],
    ['lipo -archs', 'file'],
  ];
  for (const [before, after] of mutations) {
    assert.ok(workflowText.includes(before), `Fixture is missing ${before}.`);
    assert.throws(
      () => validateWorkflow(workflowText.replaceAll(before, after)),
      `Workflow mutation ${before} -> ${after} must be rejected.`,
    );
  }
});
