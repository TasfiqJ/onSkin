import { safetyRefusal, type AskAnswer } from './answer';

export type ShippedAskAnswer = Omit<AskAnswer, 'kind'> & {
  kind: Exclude<AskAnswer['kind'], 'grounded'>;
};

function isShippedAskAnswer(answer: AskAnswer): answer is ShippedAskAnswer {
  return answer.kind !== 'grounded';
}

/**
 * The shipped app has no cloud provider that can reserve quota before delivery.
 * Keep an unexpected grounded result fail-closed so post-answer accounting can
 * never leak a paid turn or race the local cap.
 */
export function blockUnreservedGroundedAnswer(answer: AskAnswer): ShippedAskAnswer {
  if (isShippedAskAnswer(answer)) return answer;
  return { ...safetyRefusal(answer.intent), kind: 'refuse' };
}
