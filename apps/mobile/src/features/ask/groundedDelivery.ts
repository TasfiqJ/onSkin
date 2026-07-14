import { safetyRefusal, type AskAnswer } from './answer';

/**
 * The shipped app has no cloud provider that can reserve quota before delivery.
 * Keep an unexpected grounded result fail-closed so post-answer accounting can
 * never leak a paid turn or race the local cap.
 */
export function blockUnreservedGroundedAnswer(answer: AskAnswer): AskAnswer {
  return answer.kind === 'grounded' ? safetyRefusal(answer.intent) : answer;
}
