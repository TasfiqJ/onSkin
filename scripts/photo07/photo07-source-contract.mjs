import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = {
  welcome: 'apps/mobile/src/app/index.tsx',
  consentCopy: 'apps/mobile/src/features/onboarding/consentCopy.ts',
  photoCopy: 'apps/mobile/src/features/photos/copy.ts',
  phase7: 'apps/mobile/src/lib/launch/phase7.ts',
  trend: 'apps/mobile/src/features/trend/useTrend.ts',
  export: 'apps/mobile/src/features/settings/localDeviceExport.ts',
  cleanup: 'apps/mobile/src/features/healthConsent/selectiveCleanup.ts',
};

const read = (name) => fs.readFileSync(path.join(ROOT, FILES[name]), 'utf8').replace(/\r\n/g, '\n');
const parse = (name, source) => ts.createSourceFile(FILES[name], source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(node, visit) { visit(node); ts.forEachChild(node, (child) => walk(child, visit)); }
function nodes(root, predicate) { const found = []; walk(root, (node) => { if (predicate(node)) found.push(node); }); return found; }
function callName(node) {
  if (!ts.isCallExpression(node)) return null;
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return null;
}
function functionNamed(root, name) {
  const fn = nodes(root, (node) =>
    (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
    (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))),
  )[0];
  if (!fn) throw new Error(`missing ${name}`);
  return ts.isVariableDeclaration(fn) ? fn.initializer : fn;
}
function requireValue(value, message) { if (!value) throw new Error(message); }
function unwrapExpression(expression) {
  let current = expression;
  while (
    current &&
    (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current))
  ) current = current.expression;
  return current;
}

function assertWelcome(root) {
  const text = root.getFullText();
  requireValue(
    text.includes('Photos stay encrypted on your') && text.includes('phone unless you choose to share one.'),
    'welcome privacy claim must disclose the explicit sharing exception',
  );
  requireValue(!/photos that never leave\s+your phone/iu.test(text), 'welcome cannot make an absolute no-egress claim');
  requireValue(
    !/(photos?\s+(?:are\s+)?(?:also\s+)?upload(?:ed)?\s+automatically|automatic(?:ally)?\s+uploads?|cloud backup (?:is|now) available)/iu.test(text),
    'welcome cannot append a contradictory automatic-upload or cloud-backup claim',
  );
}

function assertCaptureDisclosure(root) {
  const text = root.getFullText();
  for (const disclosure of [
    'Never uploaded automatically',
    'You can choose to share a photo.',
    'Cloud backup is not available in this build.',
    'No faceprint or biometric template is stored.',
    'A lost phone can mean lost photos.',
  ]) requireValue(text.includes(disclosure), 'capture disclosure must cover upload, sharing, backup, face signals, and key/device loss');
  requireValue(
    text.includes('PHOTO_CAPTURE_CONSENT_TITLE') && text.includes('PHOTO_CAPTURE_CONSENT_FOOTNOTE'),
    'the exact rendered capture disclosure must remain in the hashed consent text',
  );
}

function assertPhotoCopy(root) {
  const text = root.getFullText();
  for (const disclosure of [
    'never uploaded · no faceprint',
    'This sends the photo image you choose.',
    'your notes are not included',
    "It's removed from your phone. This can't be undone.",
    'matching account records',
    'Progress photo images are not uploaded in this build.',
    'Cloud backup is not available in this build.',
  ]) requireValue(text.includes(disclosure), 'photo UI must disclose local storage, sharing, deletion, and server-record scope');
}

function assertTrendDisabled(phaseRoot, trendRoot) {
  const phase = phaseRoot.getFullText();
  const flagsDeclaration = nodes(
    phaseRoot,
    (node) => ts.isVariableDeclaration(node) && node.name.getText(phaseRoot) === 'phase7Flags',
  )[0];
  const freezeCall = flagsDeclaration?.initializer;
  const flagArgument = freezeCall && ts.isCallExpression(freezeCall)
    ? unwrapExpression(freezeCall.arguments[0])
    : null;
  const flagObject = flagArgument && ts.isObjectLiteralExpression(flagArgument) ? flagArgument : null;
  requireValue(
    /trendEngine:\s*false/u.test(phase) && /trend:\s*false/u.test(phase) &&
      flagObject && nodes(flagObject, ts.isSpreadAssignment).length === 0 &&
      flagObject.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(phaseRoot) === 'trend' &&
          property.initializer.kind === ts.SyntaxKind.FalseKeyword,
      ) &&
      phase.includes('No validated trend engine ships in this release.') &&
      phase.includes('No Trend consent is requested.'),
    'Trend must remain literally disabled with truthful unavailable copy',
  );
  for (const name of ['useTrendConsent', 'useMonkBand', 'useTrendInsightFromPhotos', 'useTrendInsight']) {
    const body = functionNamed(trendRoot, name).body.getText(trendRoot);
    requireValue(!body.includes('useQuery') && !body.includes('fetch('), 'disabled Trend hooks must remain inert and read no photo or network state');
  }
}

function assertExport(root) {
  const text = root.getFullText();
  for (const redacted of ['localUri', 'encryptedLocalUri', 'thumbnailLocalUri', 'notesCiphertext', 'keyId']) {
    requireValue(text.includes(`'${redacted}'`), 'export must redact photo paths, ciphertext, and key material');
  }
  requireValue(
    text.includes('photo_files_included: false') && text.includes('thumbnails_included: false') &&
      !text.includes('photo_files_included: true') && !text.includes('thumbnails_included: true') &&
      text.includes('Sanitized photo metadata and notes saved on this device are included'),
    'export must truthfully separate metadata/notes from omitted photo bytes',
  );
}

function assertCleanup(root) {
  const fn = functionNamed(root, 'clearHealthPurposeLocalData');
  const directReturns = fn.body.statements.filter(ts.isReturnStatement);
  const terminal = fn.body.statements.at(-1);
  requireValue(
    directReturns.length === 0 &&
      ts.isIfStatement(terminal) &&
      terminal.expression.getText(root) === 'firstFailure' &&
      nodes(terminal.thenStatement, ts.isThrowStatement).length === 1,
    'local cleanup must remain reachable from entry and terminally propagate partial local deletion failure',
  );
  const calls = new Set(nodes(fn.body, (node) => ts.isCallExpression(node)).map(callName));
  const references = new Set(
    nodes(fn.body, ts.isIdentifier).map((node) => node.text),
  );
  for (const required of [
    'beginEncryptedPhotoAccountBoundary',
    'waitForEncryptedPhotoWritesToSettle',
    'purgeSensitiveImageMemory',
    'clearGeneratedPrivateCacheFiles',
    'multiRemove',
    'clearEncryptedPhotoStorage',
  ]) requireValue(calls.has(required) || references.has(required), 'health/account deletion must clear encrypted photos, metadata, memory, and generated caches');
  requireValue(
    fn.body.getText(root).includes('if (firstFailure) throw'),
    'partial local deletion failure must remain retryable rather than reporting success',
  );
}

export function auditPhoto07Sources(overrides = {}) {
  const roots = Object.fromEntries(Object.keys(FILES).map((name) => [name, parse(name, overrides[name] ?? read(name))]));
  assertWelcome(roots.welcome);
  assertCaptureDisclosure(roots.consentCopy);
  assertPhotoCopy(roots.photoCopy);
  assertTrendDisabled(roots.phase7, roots.trend);
  assertExport(roots.export);
  assertCleanup(roots.cleanup);
  return { checks: 6, status: 'pass' };
}

export function photo07Source(name) { return read(name); }
