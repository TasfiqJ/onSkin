import { describe, expect, it } from 'vitest';

import {
  createTimelapsePlaybackState,
  timelapsePlaybackReducer as reduce,
  type TimelapsePlaybackState,
} from './timelapsePlayback';

function normalReady(frameCount = 3): TimelapsePlaybackState {
  let state = createTimelapsePlaybackState(frameCount, true);
  state = reduce(state, { type: 'motion', reduceMotion: false });
  return ready(state, 0);
}

function ready(state: TimelapsePlaybackState, index = state.index): TimelapsePlaybackState {
  return reduce(state, { type: 'frame-ready', index, revision: state.frameRevision });
}

function error(state: TimelapsePlaybackState, index = state.index): TimelapsePlaybackState {
  return reduce(state, { type: 'frame-error', index, revision: state.frameRevision });
}

describe('time-lapse playback controller', () => {
  it('waits for the displayed frame before beginning its dwell', () => {
    let state = createTimelapsePlaybackState(3, true);
    state = reduce(state, { type: 'motion', reduceMotion: false });
    expect(state).toMatchObject({ playing: false, startWhenReady: true, frameStatus: 'pending' });

    state = reduce(state, { type: 'timer-elapsed' });
    expect(state.index).toBe(0);

    state = ready(state, 0);
    expect(state).toMatchObject({ playing: true, startWhenReady: false, frameStatus: 'ready' });
  });

  it('stops at the newest frame and waits for every intermediate frame to render', () => {
    let state = normalReady();
    state = reduce(state, { type: 'timer-elapsed' });
    expect(state).toMatchObject({ index: 1, frameStatus: 'pending', playing: false });

    state = reduce(state, { type: 'timer-elapsed' });
    expect(state.index).toBe(1);

    state = ready(state, 1);
    expect(state.playing).toBe(true);
    state = reduce(state, { type: 'timer-elapsed' });
    expect(state).toMatchObject({ index: 2, frameStatus: 'pending', playing: false });
    state = ready(state, 2);
    expect(state.playing).toBe(false);
  });

  it('cancels pending autoplay in the background and never resumes on foreground', () => {
    let state = createTimelapsePlaybackState(3, true);
    state = reduce(state, { type: 'app-state', active: false });
    state = reduce(state, { type: 'motion', reduceMotion: false });
    state = ready(state, 0);
    expect(state.playing).toBe(false);

    state = reduce(state, { type: 'app-state', active: true });
    expect(state.playing).toBe(false);
    state = reduce(state, { type: 'toggle' });
    expect(state.playing).toBe(true);
  });

  it('makes a live or initially enabled Reduce Motion decision permanently cancel autoplay', () => {
    let state = createTimelapsePlaybackState(3, true);
    state = ready(state, 0);
    state = reduce(state, { type: 'motion', reduceMotion: true });
    expect(state).toMatchObject({ playing: false, startWhenReady: false });

    state = reduce(state, { type: 'motion', reduceMotion: false });
    expect(state.playing).toBe(false);
  });

  it('ignores stale frame completion, stops on display error, and permits an explicit retry', () => {
    let state = normalReady();
    state = reduce(state, { type: 'timer-elapsed' });
    state = reduce(state, { type: 'frame-ready', index: 0, revision: state.frameRevision - 1 });
    expect(state.frameStatus).toBe('pending');

    state = error(state, 1);
    expect(state).toMatchObject({ frameStatus: 'error', playing: false });
    const failedRevision = state.frameRevision;
    state = reduce(state, { type: 'retry-frame' });
    expect(state).toMatchObject({ frameStatus: 'pending', playing: false });
    state = reduce(state, { type: 'frame-ready', index: 1, revision: failedRevision });
    expect(state.frameStatus).toBe('pending');
    state = ready(state, 1);
    state = reduce(state, { type: 'frame-error', index: 1, revision: failedRevision });
    expect(state.frameStatus).toBe('ready');
  });

  it('supports manual pause, unloaded-frame play intent, stepping, and replay', () => {
    let state = normalReady();
    state = reduce(state, { type: 'toggle' });
    expect(state.playing).toBe(false);
    state = reduce(state, { type: 'next' });
    expect(state).toMatchObject({ index: 1, frameStatus: 'pending' });
    state = reduce(state, { type: 'toggle' });
    expect(state.startWhenReady).toBe(true);
    state = ready(state, 1);
    expect(state.playing).toBe(true);

    state = reduce(state, { type: 'next' });
    state = ready(state, 2);
    state = reduce(state, { type: 'toggle' });
    expect(state).toMatchObject({ index: 0, frameStatus: 'pending', startWhenReady: true });
  });

  it('invalidates readiness when an equal-length frame set changes identity or order', () => {
    let state = createTimelapsePlaybackState(3, true, 'a,b,c');
    state = reduce(state, { type: 'motion', reduceMotion: false });
    state = ready(state);
    expect(state.playing).toBe(true);
    const priorRevision = state.frameRevision;

    state = reduce(state, {
      type: 'frames-changed',
      frameCount: 3,
      frameSignature: 'a,c,b',
    });

    expect(state).toMatchObject({
      frameStatus: 'pending',
      frameSignature: 'a,c,b',
      index: 0,
      playing: false,
      startWhenReady: false,
    });
    expect(state.frameRevision).toBe(priorRevision + 1);
    state = reduce(state, { type: 'frame-ready', index: 0, revision: priorRevision });
    expect(state.frameStatus).toBe('pending');
  });
});
