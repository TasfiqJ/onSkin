import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import type { AskAnswer } from '@/features/ask/answer';
import { ASK_COPY } from '@/features/ask/copy';
import { useAsk } from '@/features/ask/useAsk';
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

type Msg =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; answer: AskAnswer };

type SuggestedPromptKey = 'conflict' | 'tonight' | 'fit';

const EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict', 'tonight', 'fit'];
const SHORT_PHONE_EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict', 'tonight'];
const SPLIT_SHORT_PHONE_EMPTY_PROMPT_ORDER: readonly SuggestedPromptKey[] = ['conflict'];
const SUPPORT_FLOOR_PROMPT_LABELS: Record<SuggestedPromptKey, string> = {
  conflict: 'Conflicts',
  tonight: 'Plan tonight',
  fit: 'Check product fit',
};

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

function AnswerCard({ answer, compact = false }: { answer: AskAnswer; compact?: boolean }) {
  const [reported, setReported] = useState(false);

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
          setReported(true);
          track('ask_reported_problem', { kind: answer.kind });
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

export default function AskScreen() {
  const { height, width } = useWindowDimensions();
  const { ask, askSuggested, isLoading, hasShelf } = useAsk();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const idRef = useRef(0);
  const ledRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    track('ask_opened');
  }, []);

  const nextId = () => {
    idRef.current += 1;
    return `m${idRef.current}`;
  };

  const pushTurn = (
    question: string,
    answer: AskAnswer,
    options: { scrollToEnd?: boolean } = {},
  ) => {
    setMessages((m) => [
      ...m,
      { id: nextId(), role: 'user', text: question },
      { id: nextId(), role: 'assistant', answer },
    ]);
    if (options.scrollToEnd !== false) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  // Proactive first answer (docs/13 §9/§14, "the conversion linchpin"): once the
  // context is ready and the user has a shelf, the assistant LEADS with a free,
  // deterministic answer about their own shelf rather than waiting for a good
  // question. Fires once. Users with an empty shelf still see the suggested prompts.
  useEffect(() => {
    if (ledRef.current || isLoading || !hasShelf || messages.length > 0) return;
    ledRef.current = true;
    track('ask_proactive_lead_shown');
    pushTurn(ASK_COPY.home.prompts.conflict, askSuggested('conflict'), { scrollToEnd: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasShelf]);

  const onSend = () => {
    const q = input.trim();
    if (q.length === 0) return;
    pushTurn(q, ask(q));
    setInput('');
  };

  const empty = messages.length === 0;
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

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 pb-1 pt-1">
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

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactPhone ? 'pb-6' : 'pb-4'}
      >
        {empty ? (
          <View className={shortPhone ? 'pt-0' : 'pt-1'}>
            {!shortPhone ? (
              <View className="mb-3 flex-row flex-wrap gap-1.5">
                {ASK_COPY.home.pills.map((p) => (
                  <View
                    key={p}
                    className="rounded-pill px-2.5 py-1"
                    style={{ backgroundColor: colors.greige }}
                  >
                    <Text className="font-mono text-[9.5px]" style={{ color: colors.mutedStrong }}>
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
        ) : (
          <View className={shortPhone ? 'pt-1' : 'pt-3'}>
            {messages.map((m) =>
              m.role === 'user' ? (
                <UserBubble key={m.id} text={m.text} compact={shortPhone} />
              ) : (
                <AnswerCard key={m.id} answer={m.answer} compact={shortPhone} />
              ),
            )}
            {/* Suggested prompts kept as a follow-up affordance after the lead. */}
            {!compactPhone ? (
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
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View className={supportFloorPhone ? 'pb-2' : compactPhone ? 'pb-6' : 'pb-5'}>
        <View
          className="flex-row items-center gap-2.5 rounded-[16px] bg-paper-raised px-3.5 py-2.5"
          style={{ borderWidth: 1, borderColor: colors.hairlineStrong }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={onSend}
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
            onPress={onSend}
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
    </Screen>
  );
}
