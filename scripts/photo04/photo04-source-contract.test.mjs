import assert from 'node:assert/strict';
import test from 'node:test';
import { auditPhoto04Sources, photo04Source } from './photo04-source-contract.mjs';

test('repository satisfies aggregate PHOTO-04 AST/control-flow contract', () => {
  assert.deepEqual(auditPhoto04Sources(), { checks: 4, status: 'pass' });
});

test('rejects background playback that remains active', () => {
  assert.throws(() => auditPhoto04Sources({ reducer: photo04Source('reducer').replace('appActive: false, playing: false, startWhenReady: false', 'appActive: false, playing: true, startWhenReady: true') }), /background must cancel/u);
});

test('rejects foreground auto-resume', () => {
  assert.throws(() => auditPhoto04Sources({ reducer: photo04Source('reducer').replace('appActive: true, playing: false', 'appActive: true, playing: true') }), /foreground must not resume/u);
});

test('rejects playback admission without Reduce Motion protection', () => {
  assert.throws(() => auditPhoto04Sources({ reducer: photo04Source('reducer').replace('state.reduceMotion === false &&', 'true &&') }), /normal-motion/u);
});

test('rejects stale frame readiness starting playback', () => {
  assert.throws(() => auditPhoto04Sources({ reducer: photo04Source('reducer').replace('if (action.index !== state.index || action.revision !== state.frameRevision) return state;', 'if (false) return state;') }), /current displayed frame/u);
});

test('rejects dwell timers that do not require a ready displayed frame', () => {
  assert.throws(() => auditPhoto04Sources({ player: photo04Source('player').replace("if (!playback.playing || playback.frameStatus !== 'ready' || atEnd) return;", 'if (!playback.playing || atEnd) return;') }), /dwell timer must require/u);
});

test('rejects animated modal transitions', () => {
  assert.throws(() => auditPhoto04Sources({ player: photo04Source('player').replace('animationType="none"', 'animationType="fade"') }), /suppress transition motion/u);
});

test('rejects removal of accessibility escape', () => {
  assert.throws(() => auditPhoto04Sources({ player: photo04Source('player').replace('onAccessibilityEscape={close}', '') }), /accessible frame navigation/u);
});

test('rejects direct network capability', () => {
  assert.throws(() => auditPhoto04Sources({ player: `${photo04Source('player')}\nfetch('https://example.invalid');` }), /must not add network/u);
});

test('rejects time-lapse content mounted outside the timeline lock', () => {
  assert.throws(() => auditPhoto04Sources({ progress: photo04Source('progress').replace('<PhotoTimelineLockGate>', '<PhotoProgressTab /><PhotoTimelineLockGate>') }), /exclusively own/u);
});

test('rejects an early active app-state branch that resumes playback', () => {
  assert.throws(
    () => auditPhoto04Sources({ reducer: photo04Source('reducer').replace(
      "case 'app-state':",
      "case 'app-state':\n      if (action.active) return { ...state, appActive: true, playing: true };",
    ) }),
    /background must cancel playback and pending autoplay/u,
  );
});

test('rejects reversing frames after the checked oldest-first sort', () => {
  assert.throws(
    () => auditPhoto04Sources({ frames: photo04Source('frames').replace('    .map((photo)', '    .reverse()\n    .map((photo)') }),
    /cannot be reversed after sorting/u,
  );
});

test('rejects a direct PhotoTimelapse mount before PhotoTimelineLockGate', () => {
  assert.throws(
    () => auditPhoto04Sources({ progress: photo04Source('progress').replace('<PhotoTimelineLockGate>', '<PhotoTimelapse frames={[]} onClose={() => undefined} /><PhotoTimelineLockGate>') }),
    /exclusively own/u,
  );
});

test('rejects an early Reduce Motion branch that keeps playback active', () => {
  assert.throws(
    () => auditPhoto04Sources({ reducer: photo04Source('reducer').replace(
      "case 'motion': {",
      "case 'motion': {\n      if (action.reduceMotion) return { ...state, playing: true, startWhenReady: true };",
    ) }),
    /Reduce Motion must cancel/u,
  );
});

test('rejects aliased axios network capability', () => {
  assert.throws(
    () => auditPhoto04Sources({ player: `import client from 'axios';\n${photo04Source('player')}\nclient('https://example.invalid');` }),
    /must not add network/u,
  );
});
