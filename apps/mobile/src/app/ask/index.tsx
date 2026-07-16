import { router } from 'expo-router';
import { memo, Profiler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItem,
  type ViewToken,
} from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import type { AskAnswer } from '@/features/ask/answer';
import { ASK_COPY } from '@/features/ask/copy';
import {
  ASK_HISTORY_PAGE_SIZE,
  latestAskHistoryStart,
  nextAskLatestScrollAttempt,
  previousAskHistoryPage,
  type AskLatestScrollProgress,
} from '@/features/ask/historyWindow';
import {
  recordAskAcceptedTurn,
  recordAskHistoryCommit,
  recordAskLogicalMessageCount,
  recordAskMessageRender,
  recordAskVisibleMessageCount,
  readAskRenderDiagnostics,
} from '@/features/ask/renderDiagnostics';
import {
  buildAskStressHistory,
  parseAskStressHistoryTurns,
  type AskStressHistoryMessage,
} from '@/features/ask/stressHistoryFixture';
import { useAskViewModel } from '@/features/ask/useAsk';
import {
  PRIVATE_GUIDANCE_AVAILABILITY_COPY,
  ShelfDataUnavailableNotice,
} from '@/features/shelf/ShelfDataAvailabilityGate';
import { track } from '@/lib/analytics/track';
import { APP_HOME_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Ask. The conversational front-end to the on-device intelligence layer
// (docs/13). The DETERMINISTIC advisor (conflict / routine / fit answers about the user's
// own shelf) runs here at $0 and needs no consent. It is the free moat taste. The deeper
// cloud-grounded layer is Pro-gated and deferred (B-AI-ASSISTANT-VENDOR). The language
// model is the interface; the curated engine is the truth; substantive claims are
// template-bounded, never free-generated. Calm, reactive, non-anthropomorphic: no persona,
// no re-engagement, ends cleanly. Disclosed honestly as AI, never marketed as "AI".

type Msg = AskStressHistoryMessage;

type SuggestedPromptKey = 'conflict' | 'tonight' | 'fit';

const EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict', 'tonight', 'fit'];
const SHORT_PHONE_EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict', 'tonight'];
const SPLIT_SHORT_PHONE_EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict'];
const SUPPORT_FLOOR_PROMPT_LABELS: Record<SuggestedPromptKey, string> = {
  conflict: 'Conflicts',
  tonight: 'Plan tonight',
  fit: 'Check product fit',
};

function devAskStressHistoryTurns(): number {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return 0;
  return parseAskStressHistoryTurns(process.env.EXPO_PUBLIC_E2E_ASK_HISTORY_TURNS);
}

const ASK_STRESS_HISTORY_TURNS = devAskStressHistoryTurns();

type AskHistoryState = {
  messages: Msg[];
  visibleStartIndex: number;
};

type PendingAskLatestScroll = AskLatestScrollProgress & {
  messageId: string;
};

type PendingAskPrependAnchor = {
  retries: number;
  targetIndex: number;
};

type AskScrollToIndexFailure = {
  averageItemLength: number;
  index: number;
};

function askMessageKey(message: Msg): string {
  return message.id;
}

function recordAskHistoryProfilerCommit(): void {
  recordAskHistoryCommit();
  publishAskRenderDiagnostics();
}

function publishAskRenderDiagnostics(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || typeof document === 'undefined') return;

  const list = document.getElementById('ask-history-list');
  if (!list) return;
  const diagnostics = readAskRenderDiagnostics();
  list.setAttribute('data-ask-accepted-turns', String(diagnostics.acceptedTurns));
  list.setAttribute('data-ask-history-commits', String(diagnostics.historyCommits));
  list.setAttribute('data-ask-logical-messages', String(diagnostics.logicalMessages));
  list.setAttribute('data-ask-message-renders', String(diagnostics.messageRenders));
  list.setAttribute('data-ask-visible-messages', String(diagnostics.visibleMessages));
}

function MonoBadge({ label, tone }: { label: string; tone: 'deterministic' | 'fit' | 'escalate' }) {
  const bg = tone === 'deterministic' ? colors.sageTint : colors.clayTint;
  const fg = tone === 'deterministic' ? colors.sageDeep : colors.clayDeep;
  return (
    <View
      className="mb-2 flex-row items-center gap-2 self-start rounded-pill px-3 py-1.5"
      style={{ backgroundColor: bg }}
    >
      {tone === 'deterministic' ? (
        <Text className="text-[10px]" style={{ color: fg }}>
          ✓
        </Text>
      ) : (
        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: fg }} />
      )}
      <Text className="font-mono text-[9.5px]" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

function Chip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View
      className="flex-row items-center self-start rounded-pill px-2.5 py-1"
      style={{ backgroundColor: bg }}
    >
      <Text className="font-mono text-[9.5px]" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

function TriadRow({ label, text }: { label: string; text: string }) {
  return (
    <View className="flex-row gap-2.5">
      <Text
        numberOfLines={1}
        className="font-mono text-[9px] uppercase"
        style={{ color: colors.clay, marginTop: 2, width: 40, flexShrink: 0 }}
      >
        {label}
      </Text>
      <Text className="flex-1 text-[11.5px]" style={{ color: colors.mutedStrong, lineHeight: 17 }}>
        {text}
      </Text>
    </View>
  );
}

function AnswerCard({
  answer,
  compact = false,
  onReport,
  reported,
}: {
  answer: AskAnswer;
  compact?: boolean;
  onReport: () => void;
  reported: boolean;
}) {
  if (answer.kind === 'escalate') {
    return (
      <View className={compact ? 'mb-2 max-w-[88%] self-start' : 'mb-3 max-w-[88%] self-start'}>
        <View
          className={
            compact
              ? 'rounded-[18px] rounded-bl-[6px] bg-paper-raised p-3'
              : 'rounded-[18px] rounded-bl-[6px] bg-paper-raised p-4'
          }
          style={{ borderWidth: 1, borderColor: 'rgba(165,105,75,0.28)' }}
        >
          {answer.badge ? (
            <Text
              className="mb-2 font-mono text-[9px] uppercase"
              style={{ color: colors.clayDeep }}
            >
              {answer.badge}
            </Text>
          ) : null}
          <Text
            variant="body"
            className={compact ? 'text-[13px]' : 'text-[13.5px]'}
            style={{ lineHeight: compact ? 19 : 20 }}
          >
            {answer.claim}
          </Text>
          {answer.cta ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.select();
                router.push(answer.cta!.route);
              }}
              className="mt-3 h-[48px] flex-row items-center justify-center rounded-[12px]"
              style={{ backgroundColor: colors.ink }}
            >
              <Text className="font-sans-semibold text-[12.5px]" style={{ color: colors.cream }}>
                {answer.cta.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {answer.footnote ? (
          <Text
            className="mt-1.5 text-center font-mono text-[9px]"
            style={{ color: colors.mutedLight }}
          >
            {answer.footnote}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className={compact ? 'mb-2 max-w-[88%] self-start' : 'mb-3 max-w-[88%] self-start'}>
      {answer.badge ? (
        <MonoBadge
          label={answer.badge}
          tone={
            answer.kind === 'deterministic' && answer.severity != null
              ? 'deterministic'
              : answer.intent === 'product_fit_q'
                ? 'fit'
                : 'deterministic'
          }
        />
      ) : null}
      <View
        className={
          compact
            ? 'rounded-[18px] rounded-bl-[6px] bg-paper-raised p-3'
            : 'rounded-[18px] rounded-bl-[6px] bg-paper-raised p-4'
        }
        style={{ borderWidth: 1, borderColor: colors.hairline }}
      >
        {answer.headline ? (
          <Text variant="titleSm" className="mb-1.5 text-[18px]">
            {answer.headline}
          </Text>
        ) : null}
        <Text
          variant="body"
          className={compact ? 'text-[13px]' : 'text-[13.5px]'}
          style={{ lineHeight: compact ? 19 : 20 }}
        >
          {answer.claim}
        </Text>

        {answer.note ? (
          <View
            className="mt-2.5 rounded-[11px] px-3 py-2.5"
            style={{ backgroundColor: colors.paper }}
          >
            <Text className="text-[12.5px]" style={{ color: colors.mutedStrong, lineHeight: 18 }}>
              {answer.note}
            </Text>
          </View>
        ) : null}

        {answer.why || answer.how ? (
          <View className="mt-3 gap-2 border-t pt-3" style={{ borderTopColor: colors.hairline }}>
            {answer.why ? <TriadRow label={ASK_COPY.triad.whyLabel} text={answer.why} /> : null}
            {answer.how ? <TriadRow label={ASK_COPY.triad.howLabel} text={answer.how} /> : null}
          </View>
        ) : null}

        {answer.citation || answer.severityText ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
            {answer.severityText ? (
              <Chip label={answer.severityText} bg={colors.clayTint} fg={colors.clayDeep} />
            ) : null}
            {answer.citation ? (
              <Chip label={answer.citation.label} bg={colors.clayTint} fg={colors.clayDeep} />
            ) : null}
            {answer.citation ? (
              <Chip label={answer.citation.evidence} bg={colors.greige} fg={colors.mutedStrong} />
            ) : null}
          </View>
        ) : null}

        {answer.cta ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.select();
              router.push(answer.cta!.route as never);
            }}
            className="mt-3 min-h-[48px] self-start items-center justify-center rounded-pill px-4 py-2"
            style={{ backgroundColor: colors.greige }}
          >
            <Text className="font-sans-semibold text-[12px]" style={{ color: colors.ink }}>
              {answer.cta.label} ›
            </Text>
          </Pressable>
        ) : null}
      </View>

      {answer.recommendationNote ? (
        <View
          className="mt-2 flex-row items-center gap-2 rounded-[12px] px-3 py-2"
          style={{ backgroundColor: colors.greige }}
        >
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.muted }} />
          <Text
            className="flex-1 text-[11px]"
            style={{ color: colors.mutedStrong, lineHeight: 16 }}
          >
            {ASK_COPY.recommendationNote}
          </Text>
        </View>
      ) : null}

      {answer.claimSafeNote ? (
        <Text className="mt-2 text-[10.5px]" style={{ color: colors.clayDeep, lineHeight: 15 }}>
          {ASK_COPY.claimSafeNote}
        </Text>
      ) : null}

      {answer.footnote ? (
        <Text className="mt-2 text-[11.5px]" style={{ color: colors.mutedStrong, lineHeight: 16 }}>
          {answer.footnote}
        </Text>
      ) : null}

      {/* Content-free wrong-answer feedback loop (docs/13 §9). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Report a problem with this answer"
        onPress={() => {
          if (reported) return;
          onReport();
        }}
        className={
          compact
            ? 'mt-1 min-h-[48px] self-start justify-center'
            : 'mt-2 min-h-[48px] self-start justify-center py-1'
        }
      >
        <Text className="font-mono text-[9px]" style={{ color: colors.mutedLight }}>
          {reported
            ? ASK_COPY.feedback.thanks
            : `${ASK_COPY.feedback.prompt} · ${ASK_COPY.feedback.report}`}
        </Text>
      </Pressable>
    </View>
  );
}

function UserBubble({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <View
      className={
        compact
          ? 'mb-2 max-w-[80%] self-end rounded-[18px] rounded-br-[6px] px-3 py-2'
          : 'mb-3.5 max-w-[80%] self-end rounded-[18px] rounded-br-[6px] px-3.5 py-2.5'
      }
      style={{ backgroundColor: colors.ink }}
    >
      <Text className="text-[13px]" style={{ color: colors.cream, lineHeight: compact ? 17 : 18 }}>
        {text}
      </Text>
    </View>
  );
}

type AskMessageRowProps = {
  compact: boolean;
  message: Msg;
  onReport: (messageId: string, kind: AskAnswer['kind']) => void;
};

const AskMessageRow = memo(function AskMessageRow({
  compact,
  message,
  onReport,
}: AskMessageRowProps) {
  recordAskMessageRender();

  if (message.role === 'user') {
    return <UserBubble text={message.text} compact={compact} />;
  }

  return (
    <AnswerCard
      answer={message.answer}
      compact={compact}
      reported={message.reported === true}
      onReport={() => onReport(message.id, message.answer.kind)}
    />
  );
});

function SuggestedPrompt({
  label,
  onPress,
  supportFloor = false,
}: {
  label: string;
  onPress: () => void;
  supportFloor?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.select();
        onPress();
      }}
      className={
        supportFloor
          ? 'h-[48px] flex-row items-center justify-between rounded-[15px] bg-paper-raised px-4 py-2'
          : 'min-h-[48px] flex-row items-center justify-between rounded-[15px] bg-paper-raised px-4 py-2.5'
      }
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <Text
        numberOfLines={supportFloor ? 1 : undefined}
        className="flex-1 text-[13.5px]"
        style={{ color: colors.ink }}
      >
        {label}
      </Text>
      <Text style={{ color: colors.clay, fontSize: 15 }}>›</Text>
    </Pressable>
  );
}

function AskComposer({
  compactPhone,
  hidden,
  onSubmit,
  supportFloorPhone,
}: {
  compactPhone: boolean;
  hidden: boolean;
  onSubmit: (question: string) => void;
  supportFloorPhone: boolean;
}) {
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');

  const updateDraft = (nextDraft: string) => {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  };

  const submitDraft = () => {
    const question = draftRef.current.trim();
    if (question.length === 0) return;

    // Clear the synchronous source before publishing so Return and a near-simultaneous
    // Send press cannot publish the same analytics/message operation twice.
    draftRef.current = '';
    setDraft('');
    onSubmit(question);
  };

  // Keep this leaf mounted while private-data recovery temporarily replaces the route
  // body. Returning null preserves its raw draft without rerendering the history.
  if (hidden) return null;

  return (
    <View className={supportFloorPhone ? 'pb-2' : compactPhone ? 'pb-6' : 'pb-5'}>
      <View
        className="flex-row items-center gap-2.5 rounded-[16px] bg-paper-raised px-3.5 py-2.5"
        style={{ borderWidth: 1, borderColor: colors.hairlineStrong }}
      >
        <TextInput
          value={draft}
          onChangeText={updateDraft}
          onSubmitEditing={submitDraft}
          placeholder={ASK_COPY.home.inputPlaceholder}
          placeholderTextColor={colors.mutedLight}
          accessibilityLabel={ASK_COPY.home.inputA11y}
          returnKeyType="send"
          className="flex-1 text-[13px]"
          style={{ color: colors.ink, minHeight: 48, paddingVertical: 0 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          onPress={submitDraft}
          className="h-[48px] w-[48px] items-center justify-center rounded-[14px]"
          style={{ backgroundColor: colors.ink }}
        >
          <Text style={{ color: colors.cream, fontSize: 15 }}>↑</Text>
        </Pressable>
      </View>
      <Text
        className="mt-2 text-center font-mono"
        style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}
      >
        {ASK_COPY.home.disclosureFooter}
      </Text>
    </View>
  );
}

export default function AskScreen() {
  const { height, width } = useWindowDimensions();
  const { ask, askSuggested, isError, isFetching, isLoading, isSuccess, hasShelf, retry } =
    useAskViewModel();
  const [history, setHistory] = useState<AskHistoryState>({
    messages: [],
    visibleStartIndex: 0,
  });
  const { messages, visibleStartIndex } = history;
  const idRef = useRef(0);
  const ledRef = useRef(false);
  const reportedIdsRef = useRef(new Set<string>());
  const stressHistoryAppliedRef = useRef(false);
  const pendingScrollToLatestRef = useRef<PendingAskLatestScroll | null>(null);
  const pendingPrependAnchorRef = useRef<PendingAskPrependAnchor | null>(null);
  const latestWindowReadyRef = useRef(true);
  const scrollRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    track('ask_opened');
  }, []);

  useEffect(() => {
    recordAskLogicalMessageCount(messages.length);
    publishAskRenderDiagnostics();
  }, [messages.length]);

  const nextId = useCallback(() => {
    idRef.current += 1;
    return `m${idRef.current}`;
  }, []);

  const pushTurn = useCallback(
    (question: string, answer: AskAnswer, options: { scrollToEnd?: boolean } = {}) => {
      recordAskAcceptedTurn();
      const userMessage: Msg = { id: nextId(), role: 'user', text: question };
      const assistantMessage: Msg = {
        id: nextId(),
        role: 'assistant',
        answer,
        reported: false,
      };
      const scrollToLatest = options.scrollToEnd !== false;
      if (scrollToLatest) {
        latestWindowReadyRef.current = false;
        pendingPrependAnchorRef.current = null;
        pendingScrollToLatestRef.current = {
          attempts: 0,
          lastAttemptedHeight: -1,
          messageId: assistantMessage.id,
        };
      }
      setHistory((currentHistory) => {
        const nextMessages = [...currentHistory.messages, userMessage, assistantMessage];
        return {
          messages: nextMessages,
          visibleStartIndex: scrollToLatest
            ? latestAskHistoryStart(nextMessages.length)
            : currentHistory.visibleStartIndex,
        };
      });
    },
    [nextId],
  );

  const handleHistoryContentSizeChange = useCallback((_width: number, contentHeight: number) => {
    const pending = pendingScrollToLatestRef.current;
    if (!pending) return;
    if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
      // React Native Web can briefly report a collapsed list while variable-height
      // rows settle. Never turn that transient measurement into a scroll-to-top,
      // and allow the prior positive height to be retried after recovery.
      pending.lastAttemptedHeight = -1;
      return;
    }
    const nextAttempt = nextAskLatestScrollAttempt(pending, contentHeight);
    if (!nextAttempt) return;
    pending.attempts = nextAttempt.attempts;
    pending.lastAttemptedHeight = nextAttempt.lastAttemptedHeight;
    // The validated content height is the exact current extent; the scroll view
    // clamps this oversized offset to its real bottom. The latest page is bounded,
    // so retries cannot walk the complete transcript.
    scrollRef.current?.scrollToOffset({ animated: false, offset: contentHeight });
    if (nextAttempt.exhausted) {
      pendingScrollToLatestRef.current = null;
      latestWindowReadyRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!pendingPrependAnchorRef.current) return;

    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const pending = pendingPrependAnchorRef.current;
        if (pending) {
          scrollRef.current?.scrollToIndex({
            animated: false,
            index: pending.targetIndex,
            viewPosition: 0,
          });
          if (pendingPrependAnchorRef.current === pending && pending.retries === 0) {
            pendingPrependAnchorRef.current = null;
          }
        }
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [visibleStartIndex]);

  const handleHistoryScrollToIndexFailed = useCallback((failure: AskScrollToIndexFailure) => {
    const pending = pendingPrependAnchorRef.current;
    if (!pending || pending.targetIndex !== failure.index) return;

    // Older pages prepend in one bounded batch. This fallback is therefore at most
    // one page estimate, never an unbounded walk through the complete transcript.
    scrollRef.current?.scrollToOffset({
      animated: false,
      offset: failure.averageItemLength * failure.index,
    });

    if (pending.retries >= 1) {
      pendingPrependAnchorRef.current = null;
      return;
    }
    pending.retries += 1;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const retry = pendingPrependAnchorRef.current;
        if (!retry) return;
        scrollRef.current?.scrollToIndex({
          animated: false,
          index: retry.targetIndex,
          viewPosition: 0,
        });
        if (pendingPrependAnchorRef.current === retry) {
          pendingPrependAnchorRef.current = null;
        }
      });
    });
  }, []);

  const [handleHistoryViewabilityChange] = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken<Msg>[] }) => {
        const pending = pendingScrollToLatestRef.current;
        if (
          pending &&
          viewableItems.some(
            (viewToken) => viewToken.isViewable && viewToken.item.id === pending.messageId,
          )
        ) {
          pendingScrollToLatestRef.current = null;
          latestWindowReadyRef.current = true;
        }
      },
  );

  const loadEarlierHistory = useCallback(() => {
    if (
      !latestWindowReadyRef.current ||
      pendingPrependAnchorRef.current ||
      visibleStartIndex === 0
    ) {
      return;
    }

    const previousPage = previousAskHistoryPage(visibleStartIndex);
    pendingPrependAnchorRef.current = {
      retries: 0,
      targetIndex: previousPage.prependedMessages,
    };
    setHistory((currentHistory) => ({
      ...currentHistory,
      visibleStartIndex: previousPage.visibleStartIndex,
    }));
  }, [visibleStartIndex]);

  const reportAnswer = useCallback((messageId: string, kind: AskAnswer['kind']) => {
    if (reportedIdsRef.current.has(messageId)) return;
    reportedIdsRef.current.add(messageId);
    track('ask_reported_problem', { kind });
    setHistory((currentHistory) => ({
      ...currentHistory,
      messages: currentHistory.messages.map((message) =>
        message.id === messageId && message.role === 'assistant'
          ? { ...message, reported: true }
          : message,
      ),
    }));
  }, []);

  useEffect(() => {
    if (ASK_STRESS_HISTORY_TURNS === 0 || stressHistoryAppliedRef.current || !isSuccess) {
      return;
    }

    stressHistoryAppliedRef.current = true;
    ledRef.current = true;
    const fixtureMessages = buildAskStressHistory(
      ASK_STRESS_HISTORY_TURNS,
      askSuggested('tonight'),
    );
    const latestMessage = fixtureMessages.at(-1);
    if (latestMessage) {
      latestWindowReadyRef.current = false;
      pendingScrollToLatestRef.current = {
        attempts: 0,
        lastAttemptedHeight: -1,
        messageId: latestMessage.id,
      };
    }
    setHistory({
      messages: fixtureMessages,
      visibleStartIndex: latestAskHistoryStart(fixtureMessages.length),
    });
  }, [askSuggested, isSuccess]);

  // Proactive first answer (docs/13 §9/§14, "the conversion linchpin"): once the
  // context is ready and the user has a shelf, the assistant LEADS with a free,
  // deterministic answer about their own shelf rather than waiting for a good
  // question. Fires once. Users with an empty shelf still see the suggested prompts.
  useEffect(() => {
    if (
      ASK_STRESS_HISTORY_TURNS > 0 ||
      ledRef.current ||
      isLoading ||
      !hasShelf ||
      messages.length > 0
    ) {
      return;
    }
    ledRef.current = true;
    track('ask_proactive_lead_shown');
    pushTurn(ASK_COPY.home.prompts.conflict, askSuggested('conflict'), { scrollToEnd: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasShelf]);

  const empty = messages.length === 0;
  const visibleMessages = useMemo(
    () => messages.slice(visibleStartIndex),
    [messages, visibleStartIndex],
  );
  useEffect(() => {
    recordAskVisibleMessageCount(visibleMessages.length);
    publishAskRenderDiagnostics();
  }, [visibleMessages.length]);
  const compactPhone = height < 640;
  const shortPhone = height < 520;
  const ultraShortPhone = height < 460;
  const splitShortPhone = height < 410;
  const supportFloorPhone = width <= 320 && height < 520;
  const visibleTitle = compactPhone ? 'Ask' : ASK_COPY.home.title;
  const emptyPromptOrder =
    ultraShortPhone || splitShortPhone
      ? SPLIT_SHORT_PHONE_EMPTY_PROMPT_ORDER
      : shortPhone
        ? SHORT_PHONE_EMPTY_PROMPT_ORDER
        : EMPTY_PROMPT_ORDER;
  const promptLabels = supportFloorPhone ? SUPPORT_FLOOR_PROMPT_LABELS : ASK_COPY.home.prompts;
  const renderMessage = useCallback<ListRenderItem<Msg>>(
    ({ item }) => <AskMessageRow message={item} compact={shortPhone} onReport={reportAnswer} />,
    [reportAnswer, shortPhone],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      {isError ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}
        >
          <ShelfDataUnavailableNotice
            copy={PRIVATE_GUIDANCE_AVAILABILITY_COPY}
            onRetry={retry}
            retrying={isFetching}
            onExit={() => backOrReplace(router, APP_HOME_ROUTE)}
            exitLabel="Back to Today"
          />
        </ScrollView>
      ) : null}

      {/* Header */}
      <View
        className="flex-row items-center gap-3 pb-1 pt-1"
        style={isError ? { display: 'none' } : undefined}
      >
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_HOME_ROUTE)}
        />
        <View
          className="h-[30px] w-[30px] items-center justify-center rounded-[9px]"
          style={{ backgroundColor: colors.ink }}
        >
          <Text style={{ color: colors.clayBright, fontSize: 14 }}>✦</Text>
        </View>
        <Text
          variant="title"
          className="text-[24px]"
          accessibilityRole="header"
          accessibilityLabel={ASK_COPY.home.title}
          numberOfLines={1}
        >
          {visibleTitle}
        </Text>
      </View>

      <Profiler id="ask-history" onRender={recordAskHistoryProfilerCommit}>
        <FlatList
          ref={scrollRef}
          nativeID="ask-history-list"
          className="flex-1"
          style={isError ? { display: 'none' } : undefined}
          data={visibleMessages}
          keyExtractor={askMessageKey}
          renderItem={renderMessage}
          initialNumToRender={ASK_HISTORY_PAGE_SIZE}
          maxToRenderPerBatch={8}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={handleHistoryContentSizeChange}
          onScrollToIndexFailed={handleHistoryScrollToIndexFailed}
          onStartReached={loadEarlierHistory}
          onStartReachedThreshold={0}
          onViewableItemsChanged={handleHistoryViewabilityChange}
          showsVerticalScrollIndicator={false}
          contentContainerClassName={compactPhone ? 'pb-6' : 'pb-4'}
          ListHeaderComponent={empty ? null : <View className={shortPhone ? 'pt-1' : 'pt-3'} />}
          ListEmptyComponent={
            <View className={shortPhone ? 'pt-0' : 'pt-1'}>
              {!shortPhone ? (
                <View className="mb-3 flex-row flex-wrap gap-1.5">
                  {ASK_COPY.home.pills.map((p) => (
                    <View
                      key={p}
                      className="rounded-pill px-2.5 py-1"
                      style={{ backgroundColor: colors.greige }}
                    >
                      <Text
                        className="font-mono text-[9.5px]"
                        style={{ color: colors.mutedStrong }}
                      >
                        {p}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {ultraShortPhone || supportFloorPhone ? null : (
                <Text
                  variant="body"
                  tone="muted"
                  className={shortPhone ? 'mb-2 text-[12px]' : 'mb-3 text-[12.5px]'}
                  style={{ lineHeight: shortPhone ? 18 : 19 }}
                >
                  {ASK_COPY.home.intro}
                </Text>
              )}
              <Text
                className={
                  ultraShortPhone
                    ? 'mb-1 font-mono text-[9px] uppercase'
                    : shortPhone
                      ? 'mb-1.5 font-mono text-[10px] uppercase'
                      : 'mb-2 font-mono text-[10px] uppercase'
                }
                style={{ color: colors.mutedLight, letterSpacing: 1 }}
              >
                {ASK_COPY.home.groundedEyebrow}
              </Text>
              <View className={shortPhone ? 'gap-1.5' : 'gap-2'}>
                {emptyPromptOrder.map((promptKey) => (
                  <SuggestedPrompt
                    key={promptKey}
                    label={promptLabels[promptKey]}
                    supportFloor={supportFloorPhone}
                    onPress={() =>
                      pushTurn(ASK_COPY.home.prompts[promptKey], askSuggested(promptKey), {
                        scrollToEnd: false,
                      })
                    }
                  />
                ))}
              </View>
            </View>
          }
          ListFooterComponent={
            empty || compactPhone ? null : (
              <View className="mt-2 gap-2.5">
                <SuggestedPrompt
                  label={ASK_COPY.home.prompts.tonight}
                  onPress={() => pushTurn(ASK_COPY.home.prompts.tonight, askSuggested('tonight'))}
                />
                <SuggestedPrompt
                  label={ASK_COPY.home.prompts.fit}
                  onPress={() => pushTurn(ASK_COPY.home.prompts.fit, askSuggested('fit'))}
                />
              </View>
            )
          }
        />
      </Profiler>

      <AskComposer
        key="ask-composer"
        compactPhone={compactPhone}
        hidden={isError}
        onSubmit={(question) => pushTurn(question, ask(question))}
        supportFloorPhone={supportFloorPhone}
      />
    </Screen>
  );
}
