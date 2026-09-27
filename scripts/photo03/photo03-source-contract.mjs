import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = {
  analysis: 'apps/mobile/src/features/photos/captureAnalysis.ts',
  detector: 'apps/mobile/src/features/photos/detectedFacesOperation.ts',
  lighting: 'apps/mobile/src/features/photos/analyzePhotoLighting.ts',
  hook: 'apps/mobile/src/features/photos/useCaptureAnalysis.ts',
  provider: 'apps/mobile/src/features/photos/CaptureAnalysisProvider.native.tsx',
  review: 'apps/mobile/src/app/progress/review.tsx',
};

const read = (name) => fs.readFileSync(path.join(ROOT, FILES[name]), 'utf8').replace(/\r\n/g, '\n');
const parse = (name, source) =>
  ts.createSourceFile(FILES[name], source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function nodes(root, predicate) {
  const found = [];
  walk(root, (node) => {
    if (predicate(node)) found.push(node);
  });
  return found;
}

function callName(node) {
  if (!ts.isCallExpression(node)) return null;
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return null;
}

function functionNamed(root, name) {
  const fn = nodes(
    root,
    (node) =>
      (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
      (ts.isFunctionExpression(node) && node.name?.text === name) ||
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))),
  )[0];
  if (!fn) throw new Error(`missing ${name}`);
  return ts.isVariableDeclaration(fn) ? fn.initializer : fn;
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function requireNoEgress(root, name) {
  const bannedBindings = new Set();
  const forbiddenImports = nodes(
    root,
    (node) => {
      if (!ts.isImportDeclaration(node)) return false;
      const bannedModule = /(supabase|analytics|sentry|posthog|http|network|fetch)/iu.test(
        node.moduleSpecifier.text,
      );
      for (const specifier of node.importClause?.namedBindings?.elements ?? []) {
        if (specifier.propertyName?.text === 'fetch' || specifier.name.text === 'fetch') {
          bannedBindings.add(specifier.name.text);
        }
      }
      return bannedModule;
    },
  );
  const forbiddenCalls = nodes(root, (node) =>
    ['fetch', 'track', 'capture', 'from', 'upload'].includes(callName(node)) ||
      bannedBindings.has(callName(node)),
  );
  requireValue(
    forbiddenImports.length === 0 && forbiddenCalls.length === 0,
    `${name} must have no cloud, network, or analytics egress`,
  );
}

function requireCallOrder(root, fnName, names, message) {
  const fn = functionNamed(root, fnName);
  const calls = nodes(fn.body, (node) => names.includes(callName(node)));
  const positions = names.map((name) => calls.find((node) => callName(node) === name)?.pos ?? -1);
  requireValue(
    positions.every((position) => position >= 0) &&
      positions.every((position, index) => index === 0 || positions[index - 1] < position),
    message,
  );
}

function assertProvider(root) {
  const declaration = nodes(
    root,
    (node) => ts.isVariableDeclaration(node) && node.name.getText(root) === 'FACE_DETECTION_OPTIONS',
  )[0];
  requireValue(declaration?.initializer, 'native detector options must be explicit');
  const text = declaration.initializer.getText(root).replace(/\s/g, '');
  requireValue(
    nodes(declaration.initializer, ts.isSpreadAssignment).length === 0,
    'native detector options cannot contain overriding object spreads',
  );
  for (const option of [
    'landmarkMode:false',
    'contourMode:false',
    'classificationMode:false',
    'isTrackingEnabled:false',
  ]) {
    requireValue(text.includes(option), 'face identity, landmark, contour, classification, and tracking signals must stay disabled');
  }
}

function assertAnalysis(root) {
  const faceType = nodes(
    root,
    (node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'FaceObservation',
  )[0];
  const allowed = new Set(['frame', 'headEulerAngleX', 'headEulerAngleY', 'headEulerAngleZ']);
  const members = faceType?.type?.members ?? [];
  requireValue(
    members.length === 4 && members.every((member) => allowed.has(member.name?.getText(root))),
    'face observations must allowlist geometry and finite pose only',
  );
  const validate = functionNamed(root, 'validatedFaceObservations');
  requireValue(
    nodes(validate.body, ts.isSpreadAssignment).length === 0,
    'native face objects must never flow into app state',
  );
  const framing = functionNamed(root, 'assessFraming').body.getText(root);
  const poseDeclaration = nodes(
    functionNamed(root, 'assessFraming').body,
    (node) => ts.isVariableDeclaration(node) && node.name.getText(root) === 'poseSignalsPresent',
  )[0];
  requireValue(
    poseDeclaration?.initializer?.getText(root).replace(/\s/g, '') ===
      'headRoll!==null&&headYaw!==null&&headPitch!==null',
    'pose completeness must be derived from all three finite pose signals',
  );
  requireValue(
    framing.includes('poseSignalsPresent &&') &&
      framing.includes('const matched = withinTolerance && rawScore >= t.matchedScore;'),
    'matched framing must require every finite pose signal and every tolerance',
  );
}

function assertDetector(root) {
  const fn = functionNamed(root, 'runDetectedFacesOperation');
  const validated = nodes(fn.body, (node) => callName(node) === 'validatedFaceObservations')[0];
  const detection = nodes(validated ?? fn.body, (node) => callName(node) === 'detectFaces')[0];
  const donePublish = nodes(
    fn.body,
    (node) => callName(node) === 'publishIfCurrent' && node.getText(root).includes("status: 'done'"),
  )[0];
  requireValue(
    validated && detection && donePublish && validated.pos < donePublish.pos,
    'native face output must be allowlisted before publication',
  );
  const text = fn.body.getText(root);
  requireValue(
    text.includes('control.assertActive();') &&
      text.includes("publishIfCurrent({ status: 'done', faces })"),
    'detector publication must remain account/URI-current and use only validated faces',
  );
}

function assertLighting(root) {
  requireCallOrder(
    root,
    'run',
    ['reserve', 'manipulate', 'moveAsync', 'markWritten', 'readBytes', 'cleanupOwnedSample'],
    'lighting sample must be journaled, adopted, read, and cleaned before success',
  );
  requireValue(
    root.getText().includes('const SAMPLE_WIDTH = 64;') &&
      root.getText().includes("reservePlaintextStaging('photo_analysis_jpeg')"),
    'lighting must use the bounded journal-owned local sample',
  );
  const sampleWidth = nodes(
    root,
    (node) => ts.isVariableDeclaration(node) && node.name.getText(root) === 'SAMPLE_WIDTH',
  )[0];
  const resizeWidth = nodes(
    root,
    (node) =>
      ts.isPropertyAssignment(node) &&
      node.name.getText(root) === 'width' &&
      node.parent.parent?.getText(root).startsWith('resize'),
  )[0];
  requireValue(
    sampleWidth?.initializer?.getText(root) === '64' &&
      resizeWidth?.initializer.getText(root) === 'SAMPLE_WIDTH',
    'lighting resize must bind its effective width to the bounded sample constant',
  );
  const cleanupFunction = functionNamed(root, 'cleanupOwnedSample');
  requireValue(
    nodes(cleanupFunction.body, ts.isReturnStatement).length === 0 &&
      nodes(cleanupFunction.body, (node) => callName(node) === 'deleteAsync').length === 1 &&
      nodes(cleanupFunction.body, (node) => callName(node) === 'cleanup').length === 1 &&
      nodes(cleanupFunction.body, (node) => ts.isThrowStatement(node)).length === 1,
    'owned lighting cleanup must delete generated and journal-owned plaintext and propagate failure',
  );
  const run = functionNamed(root, 'run');
  const cleanup = nodes(run.body, (node) => callName(node) === 'cleanupOwnedSample')[0];
  const successReturns = nodes(
    run.body,
    (node) => ts.isReturnStatement(node) && node.expression?.getText(root) === 'assessment!',
  );
  requireValue(
    cleanup && successReturns.length === 1 && successReturns[0].pos > cleanup.pos,
    'lighting plaintext must be cleaned before success',
  );
}

function assertHook(root) {
  const fixture = functionNamed(root, 'devCaptureAnalysisFixture').body.getText(root);
  requireValue(
    fixture.includes("typeof __DEV__ === 'undefined' || !__DEV__") &&
      fixture.includes("EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_ANALYSIS !== 'enabled'"),
    'capture fixtures must stay double-gated to development E2E',
  );
  const hook = functionNamed(root, 'useCaptureAnalysis').body.getText(root);
  requireValue(
    hook.includes("Platform.OS !== 'web'") &&
      hook.includes('activeCoordinator.activate(analysisUri ?? null)') &&
      hook.includes('activeCoordinator.abort();') &&
      hook.includes('timedOutUri === analysisUri ? unavailableLighting()'),
    'analysis must stay native, URI-scoped, abortable, and fail-safe on timeout',
  );
}

function assertReview(root) {
  const text = root.getText();
  requireValue(
    text.includes("? ('post_capture_measurement' as const)") &&
      text.includes('alignmentScore: analysis.framing.score') &&
      text.includes('lightingScore: analysis.lighting.score'),
    'review must label measured provenance and persist only bounded assessment fields',
  );
}

export function auditPhoto03Sources(overrides = {}) {
  const roots = Object.fromEntries(
    Object.keys(FILES).map((name) => [name, parse(name, overrides[name] ?? read(name))]),
  );
  assertProvider(roots.provider);
  assertAnalysis(roots.analysis);
  assertDetector(roots.detector);
  assertLighting(roots.lighting);
  assertHook(roots.hook);
  assertReview(roots.review);
  for (const name of ['analysis', 'detector', 'lighting', 'hook', 'provider']) {
    requireNoEgress(roots[name], name);
  }
  return { checks: 11, status: 'pass' };
}

export function photo03Source(name) {
  return read(name);
}
