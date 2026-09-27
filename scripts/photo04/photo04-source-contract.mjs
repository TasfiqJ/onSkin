import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = {
  player: 'apps/mobile/src/features/photos/PhotoTimelapse.tsx',
  reducer: 'apps/mobile/src/features/photos/timelapsePlayback.ts',
  frames: 'apps/mobile/src/features/photos/timelapse.ts',
  progress: 'apps/mobile/src/app/(tabs)/progress.tsx',
};

const read = (name) => fs.readFileSync(path.join(ROOT, FILES[name]), 'utf8').replace(/\r\n/g, '\n');
const parse = (name, source) => ts.createSourceFile(FILES[name], source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function nodes(root, predicate) {
  const result = [];
  walk(root, (node) => { if (predicate(node)) result.push(node); });
  return result;
}

function functionNamed(root, name) {
  const fn = nodes(root, (node) =>
    (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
    (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))),
  )[0];
  if (!fn) throw new Error(`missing ${name}`);
  return ts.isVariableDeclaration(fn) ? fn.initializer : fn;
}

function callName(node) {
  if (!ts.isCallExpression(node)) return null;
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return null;
}

function jsxName(node) {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText();
  return null;
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
}

function caseText(root, name) {
  const reducer = functionNamed(root, 'timelapsePlaybackReducer');
  const clause = nodes(reducer.body, (node) =>
    ts.isCaseClause(node) && node.expression.getText(root) === `'${name}'`,
  )[0];
  if (!clause) throw new Error(`missing ${name} reducer case`);
  return clause.getText(root).replace(/\s/g, '');
}

function caseClause(root, name) {
  const reducer = functionNamed(root, 'timelapsePlaybackReducer');
  const clause = nodes(reducer.body, (node) =>
    ts.isCaseClause(node) && node.expression.getText(root) === `'${name}'`,
  )[0];
  if (!clause) throw new Error(`missing ${name} reducer case`);
  return clause;
}

function assertReducer(root) {
  const canPlay = functionNamed(root, 'canPlay').body.getText(root).replace(/\s/g, '');
  for (const predicate of [
    'state.appActive',
    'state.reduceMotion===false',
    "state.frameStatus==='ready'",
    'state.index<state.frameCount-1',
  ]) requireValue(canPlay.includes(predicate), 'playback admission must require active, normal-motion, displayed, nonterminal state');

  const appState = caseText(root, 'app-state');
  const appStateClause = caseClause(root, 'app-state');
  requireValue(
    appStateClause.statements.length === 2 &&
    appState.includes("if(!action.active){return{...state,appActive:false,playing:false,startWhenReady:false};}") &&
      appState.includes('return{...state,appActive:true,playing:false};'),
    'background must cancel playback and pending autoplay; foreground must not resume',
  );
  const motion = caseText(root, 'motion');
  const motionClause = caseClause(root, 'motion');
  const motionBlock = motionClause.statements[0];
  requireValue(
    motionClause.statements.length === 1 && ts.isBlock(motionBlock) &&
    motionBlock.statements.length === 4 &&
    motion.includes('if(action.reduceMotion!==false)') &&
      motion.includes('playing:false') && motion.includes('startWhenReady:false'),
    'Reduce Motion must cancel active and pending autoplay',
  );
  const ready = caseText(root, 'frame-ready');
  requireValue(
    ready.includes('action.index!==state.index||action.revision!==state.frameRevision') &&
      ready.includes("frameStatus:'ready'") && ready.includes('canPlay(next)'),
    'only the current displayed frame may begin playback',
  );
  const timer = caseText(root, 'timer-elapsed');
  requireValue(
    timer.includes('if(!state.playing||!canPlay(state))returnstate;') &&
      timer.includes("frameStatus:'pending'") && timer.includes('playing:false'),
    'timer advancement must stop until the next encrypted frame displays',
  );
  const toggle = caseText(root, 'toggle');
  requireValue(
    toggle.includes('state.reduceMotion!==false') && toggle.includes('state.appActive') &&
      toggle.includes('index:0') && toggle.includes('startWhenReady:true'),
    'manual pause/play/replay must stay lifecycle and motion safe',
  );
}

function assertPlayer(root) {
  const text = root.getText();
  requireValue(
    text.includes('animationType="none"') && text.includes('useReduceMotionPreference()'),
    'time-lapse modal must suppress transition motion and use the live Reduce Motion preference',
  );
  for (const token of [
    'onAccessibilityEscape={close}',
    'accessibilityViewIsModal',
    'accessibilityRole="adjustable"',
    "{ name: 'decrement', label: 'Previous photo' }",
    "{ name: 'increment', label: 'Next photo' }",
    'accessibilityRole="header"',
  ]) requireValue(text.includes(token), 'time-lapse must preserve modal focus and accessible frame navigation');
  requireValue(
    text.includes('<PhotoImage') && text.includes('onDisplayReady={frameReady}') && text.includes('onDisplayError={frameError}'),
    'playback readiness must come from the sensitive in-memory image boundary',
  );
  const timerEffect = nodes(root, (node) => ts.isIfStatement(node) && node.expression.getText(root).includes('playback.playing'))[0];
  requireValue(
    timerEffect?.expression.getText(root).replace(/\s/g, '') ===
      "!playback.playing||playback.frameStatus!=='ready'||atEnd",
    'component dwell timer must require a displayed ready frame',
  );
  const networkAliases = new Set();
  const forbiddenImports = nodes(root, (node) => {
    if (!ts.isImportDeclaration(node)) return false;
    const banned = /(analytics|sentry|posthog|sharing|file-system|fetch|http|axios|\bky\b|got)/iu.test(node.moduleSpecifier.text);
    if (banned) {
      if (node.importClause?.name) networkAliases.add(node.importClause.name.text);
      for (const specifier of node.importClause?.namedBindings?.elements ?? []) {
        networkAliases.add(specifier.name.text);
      }
    }
    return banned;
  });
  const forbidden = nodes(root, (node) =>
    ['fetch', 'track', 'shareAsync', 'writeAsStringAsync'].includes(callName(node)) ||
      networkAliases.has(callName(node)),
  );
  requireValue(forbidden.length === 0 && forbiddenImports.length === 0, 'time-lapse must not add network, analytics, share, or file-write capability');
}

function assertFrames(root) {
  const fn = functionNamed(root, 'timelapseFrames').body.getText(root).replace(/\s/g, '');
  requireValue(
    fn.includes('.filter(') && fn.includes('.slice()') && fn.includes('.sort(') &&
      fn.includes('left.takenLocalDate.localeCompare(right.takenLocalDate)') &&
      fn.includes('left.id.localeCompare(right.id)'),
    'time-lapse frames must be a finite copied oldest-to-newest sequence',
  );
  requireValue(
    nodes(functionNamed(root, 'timelapseFrames').body, (node) => callName(node) === 'reverse').length === 0,
    'oldest-to-newest frame order cannot be reversed after sorting',
  );
}

function assertProgressGate(root) {
  const outer = functionNamed(root, 'ProgressScreen');
  const outerText = outer.body.getText(root);
  requireValue(
    outerText.includes('<PhotoTimelineLockGate>') &&
      outerText.includes('<PhotoStorageGate tone="paper">') &&
      outerText.indexOf('<PhotoTimelineLockGate>') < outerText.indexOf('<PhotoStorageGate') &&
      outerText.includes('<PhotoProgressTab />'),
    'time-lapse owner must mount only after timeline unlock and encrypted storage readiness',
  );
  const content = functionNamed(root, 'PhotoProgressTab').body.getText(root);
  const timeline = functionNamed(root, 'TimelineView').body.getText(root);
  const outerOwners = nodes(outer.body, (node) => jsxName(node) === 'PhotoProgressTab');
  const directPlayers = nodes(outer.body, (node) => jsxName(node) === 'PhotoTimelapse');
  requireValue(
    directPlayers.length === 0 && outerOwners.length === 1 && content.includes('<TimelineView') &&
      timeline.includes('<PhotoTimelapse frames={frames}'),
    'gated Progress content must exclusively own the time-lapse modal',
  );
}

export function auditPhoto04Sources(overrides = {}) {
  const roots = Object.fromEntries(Object.keys(FILES).map((name) => [name, parse(name, overrides[name] ?? read(name))]));
  assertReducer(roots.reducer);
  assertPlayer(roots.player);
  assertFrames(roots.frames);
  assertProgressGate(roots.progress);
  return { checks: 4, status: 'pass' };
}

export function photo04Source(name) { return read(name); }
