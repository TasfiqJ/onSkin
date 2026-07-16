import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readAskRenderDiagnostics,
  recordAskAcceptedTurn,
  recordAskHistoryCommit,
  recordAskLogicalMessageCount,
  recordAskMessageRender,
  recordAskVisibleMessageCount,
  resetAskRenderDiagnostics,
} from './renderDiagnostics';

const runtime = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __ONSKIN_ASK_RENDER_DIAGNOSTICS__?: unknown;
};
const originalDev = runtime.__DEV__;

describe('Ask content-free render diagnostics', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    delete runtime.__ONSKIN_ASK_RENDER_DIAGNOSTICS__;
  });

  afterEach(() => {
    delete runtime.__ONSKIN_ASK_RENDER_DIAGNOSTICS__;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('counts only fixed render and accepted-turn events', () => {
    recordAskHistoryCommit();
    recordAskMessageRender();
    recordAskMessageRender();
    recordAskAcceptedTurn();
    recordAskLogicalMessageCount(200);
    recordAskVisibleMessageCount(16);

    expect(readAskRenderDiagnostics()).toEqual({
      acceptedTurns: 1,
      historyCommits: 1,
      logicalMessages: 200,
      messageRenders: 2,
      visibleMessages: 16,
    });
  });

  it('resets without retaining any question, answer, or identifier content', () => {
    recordAskHistoryCommit();
    recordAskAcceptedTurn();
    resetAskRenderDiagnostics();

    const snapshot = readAskRenderDiagnostics();
    expect(snapshot).toEqual({
      acceptedTurns: 0,
      historyCommits: 0,
      logicalMessages: 0,
      messageRenders: 0,
      visibleMessages: 0,
    });
    expect(Object.keys(snapshot).sort()).toEqual([
      'acceptedTurns',
      'historyCommits',
      'logicalMessages',
      'messageRenders',
      'visibleMessages',
    ]);
  });

  it('bounds the content-free logical message count', () => {
    recordAskLogicalMessageCount(2.9);
    expect(readAskRenderDiagnostics().logicalMessages).toBe(2);

    recordAskLogicalMessageCount(-1);
    expect(readAskRenderDiagnostics().logicalMessages).toBe(0);

    recordAskLogicalMessageCount(Number.NaN);
    expect(readAskRenderDiagnostics().logicalMessages).toBe(0);

    recordAskVisibleMessageCount(16.9);
    expect(readAskRenderDiagnostics().visibleMessages).toBe(16);

    recordAskVisibleMessageCount(-1);
    expect(readAskRenderDiagnostics().visibleMessages).toBe(0);
  });

  it('does nothing outside development builds', () => {
    runtime.__DEV__ = false;

    recordAskHistoryCommit();
    recordAskMessageRender();
    recordAskAcceptedTurn();
    recordAskLogicalMessageCount(200);
    recordAskVisibleMessageCount(16);

    expect(readAskRenderDiagnostics()).toEqual({
      acceptedTurns: 0,
      historyCommits: 0,
      logicalMessages: 0,
      messageRenders: 0,
      visibleMessages: 0,
    });
    expect(runtime.__ONSKIN_ASK_RENDER_DIAGNOSTICS__).toBeUndefined();
  });
});
