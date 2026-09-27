import { clampTimelapseIndex } from './timelapse';

export type TimelapseFrameStatus = 'pending' | 'ready' | 'error';

export type TimelapsePlaybackState = Readonly<{
  appActive: boolean;
  frameRevision: number;
  frameCount: number;
  frameSignature: string;
  frameStatus: TimelapseFrameStatus;
  index: number;
  playing: boolean;
  reduceMotion: boolean | null;
  startWhenReady: boolean;
}>;

export type TimelapsePlaybackAction =
  | { type: 'app-state'; active: boolean }
  | { type: 'frames-changed'; frameCount: number; frameSignature: string }
  | { type: 'frame-error'; index: number; revision: number }
  | { type: 'frame-ready'; index: number; revision: number }
  | { type: 'motion'; reduceMotion: boolean | null }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'retry-frame' }
  | { type: 'timer-elapsed' }
  | { type: 'toggle' };

function validFrameCount(frameCount: number): number {
  return Number.isSafeInteger(frameCount) && frameCount > 0 ? frameCount : 0;
}

export function createTimelapsePlaybackState(
  frameCount: number,
  appActive: boolean,
  frameSignature = '',
): TimelapsePlaybackState {
  const validCount = validFrameCount(frameCount);
  return {
    appActive,
    frameRevision: 0,
    frameCount: validCount,
    frameSignature,
    frameStatus: validCount > 0 ? 'pending' : 'error',
    index: 0,
    playing: false,
    reduceMotion: null,
    startWhenReady: validCount > 1 && appActive,
  };
}

function moveToIndex(
  state: TimelapsePlaybackState,
  index: number,
  startWhenReady = false,
): TimelapsePlaybackState {
  const nextIndex = clampTimelapseIndex(index, state.frameCount);
  if (nextIndex === state.index) {
    return { ...state, playing: false, startWhenReady: false };
  }
  return {
    ...state,
    frameRevision: state.frameRevision + 1,
    frameStatus: 'pending',
    index: nextIndex,
    playing: false,
    startWhenReady,
  };
}

function canPlay(state: TimelapsePlaybackState): boolean {
  return (
    state.appActive &&
    state.reduceMotion === false &&
    state.frameCount > 1 &&
    state.frameStatus === 'ready' &&
    state.index < state.frameCount - 1
  );
}

export function timelapsePlaybackReducer(
  state: TimelapsePlaybackState,
  action: TimelapsePlaybackAction,
): TimelapsePlaybackState {
  switch (action.type) {
    case 'app-state':
      if (!action.active) {
        return { ...state, appActive: false, playing: false, startWhenReady: false };
      }
      // Foregrounding never resumes playback without another explicit user action.
      return { ...state, appActive: true, playing: false };
    case 'frames-changed': {
      const frameCount = validFrameCount(action.frameCount);
      if (frameCount === state.frameCount && action.frameSignature === state.frameSignature) {
        return state;
      }
      return {
        ...createTimelapsePlaybackState(frameCount, state.appActive, action.frameSignature),
        frameRevision: state.frameRevision + 1,
        reduceMotion: state.reduceMotion,
        // A live frame-set replacement is not permission to resume or restart.
        startWhenReady: false,
      };
    }
    case 'motion': {
      if (action.reduceMotion !== false) {
        return {
          ...state,
          playing: false,
          reduceMotion: action.reduceMotion,
          startWhenReady: false,
        };
      }
      const next = { ...state, reduceMotion: false };
      if (!next.startWhenReady || !canPlay(next)) return next;
      return { ...next, playing: true, startWhenReady: false };
    }
    case 'frame-ready': {
      if (action.index !== state.index || action.revision !== state.frameRevision) return state;
      const next = { ...state, frameStatus: 'ready' as const };
      if (!next.startWhenReady || !canPlay(next)) return next;
      return { ...next, playing: true, startWhenReady: false };
    }
    case 'frame-error':
      if (action.index !== state.index || action.revision !== state.frameRevision) return state;
      return { ...state, frameStatus: 'error', playing: false, startWhenReady: false };
    case 'retry-frame':
      return {
        ...state,
        frameRevision: state.frameRevision + 1,
        frameStatus: 'pending',
        playing: false,
        startWhenReady: false,
      };
    case 'previous':
      return moveToIndex(state, state.index - 1);
    case 'next':
      return moveToIndex(state, state.index + 1);
    case 'toggle':
      if (!state.appActive || state.reduceMotion !== false || state.frameCount < 2) return state;
      if (state.playing) return { ...state, playing: false, startWhenReady: false };
      if (state.index >= state.frameCount - 1) {
        return {
          ...state,
          frameRevision: state.frameRevision + 1,
          frameStatus: 'pending',
          index: 0,
          playing: false,
          startWhenReady: true,
        };
      }
      if (state.frameStatus === 'ready') {
        return { ...state, playing: true, startWhenReady: false };
      }
      if (state.frameStatus === 'pending') {
        return { ...state, startWhenReady: true };
      }
      return state;
    case 'timer-elapsed': {
      if (!state.playing || !canPlay(state)) return state;
      const nextIndex = state.index + 1;
      const atLastFrame = nextIndex >= state.frameCount - 1;
      return {
        ...state,
        frameRevision: state.frameRevision + 1,
        frameStatus: 'pending',
        index: nextIndex,
        playing: false,
        startWhenReady: !atLastFrame,
      };
    }
  }
}
