import { StateNotice } from '@/components/ui';
import type { InterfaceStateKind } from '@/theme/stateTokens';

export type CommerceLinkFeedback = {
  title: string;
  body: string;
  kind?: Extract<InterfaceStateKind, 'offline' | 'error' | 'unavailable'>;
};

export function CommerceLinkNotice({ feedback }: { feedback: CommerceLinkFeedback }) {
  return (
    <StateNotice
      kind={feedback.kind ?? 'error'}
      compact
      className="mt-3"
      title={feedback.title}
      body={feedback.body}
    />
  );
}
